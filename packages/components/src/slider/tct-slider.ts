import {html, nothing, type CSSResultGroup, type PropertyValues, type TemplateResult} from 'lit';
import {property} from 'lit/decorators.js';
import {ifDefined} from 'lit/directives/if-defined.js';
import {styleMap} from 'lit/directives/style-map.js';
import sliderMessages from '@tecton-wc/locales/en/slider.js';
import {LocaleController} from '@tecton-wc/core/i18n/locale-controller.js';
import type {ElementSize} from '@tecton-wc/core/context/keys.js';
import type {FormValue} from '@tecton-wc/core/mixins/form-control.js';
import type {TctElementConstructor} from '@tecton-wc/core/tct-element.js';
import {devWarn} from '@tecton-wc/core/utils/dev.js';
import {oneOf} from '../field/field-utils.js';
import {TctFieldControl} from '../text-area/tct-field-control.js';
import base from '../styles/base.styles.css';
import field from '../styles/field.styles.css';
import motion from '../styles/motion.styles.css';
import visuallyHidden from '../styles/visually-hidden.styles.css';
import {TctTooltip} from '../tooltip/tct-tooltip.js';
import {
  SLIDER_ORIENTATIONS,
  SLIDER_VALUE_DISPLAYS,
  clamp,
  parseValues,
  percentOf,
  snapToStep,
  type SliderMark,
  type SliderOrientation,
  type SliderValueDisplay,
} from './slider.types.js';
import styles from './tct-slider.styles.css';

/** The thumb's diameter in px. The travel maths and the stylesheet's `--_thumb-size` agree on it. */
const THUMB_SIZE = 20;

/** `marks` from an attribute: a JSON array of `{value, label?}`. */
const marksConverter = {
  fromAttribute(value: string | null): SliderMark[] | undefined {
    if (!value) return undefined;
    try {
      const parsed: unknown = JSON.parse(value);
      return Array.isArray(parsed) ? (parsed as SliderMark[]) : undefined;
    } catch {
      return undefined;
    }
  },
};

const finite = (value: number | undefined, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

/**
 * A slider for choosing a number, or a range of two, by dragging a thumb or with the keyboard: volume,
 * price range, opacity. It is a form-associated element that submits the value under `name` (a range
 * submits two entries, the start then the end, as two paired native range inputs do), resets to the
 * `value` attribute, and joins a `<fieldset disabled>`.
 *
 * Each thumb is a `role="slider"` with `aria-valuemin`, `aria-valuemax`, `aria-valuenow` and a localised
 * `aria-valuetext`. The arrow keys step by `step`, Page Up and Page Down by ten steps, Home and End go to
 * the ends of the range (in right-to-left text Left increases and Right decreases, as on a native range).
 * `input` fires on every change while dragging and `change` when the drag ends (for the keyboard, with each
 * key). Writing `value` fires nothing. `value` is a number string, `"50"`, or with `range` two numbers,
 * `"20,80"`; `values` is the array. `format-value` writes the value for the bubble, the text and
 * `aria-valuetext`. [mwg:form-associated-custom-elements] [mwg:accessible-web-components]
 * [mwg:brand-consistent-forms]
 *
 * @summary Single or range slider with keyboard, marks, a value bubble and localised value text.
 * @tag tct-slider
 * @upstream Slider
 * @csspart field - The whole field: label, control and status.
 * @csspart label - The label.
 * @csspart description - The description.
 * @csspart label-indicator - The "Required" or "Optional" text.
 * @csspart label-tip - The info-tip button.
 * @csspart control - The track container that takes pointer input.
 * @csspart track - The rail behind the thumbs.
 * @csspart fill - The filled part of the rail.
 * @csspart thumb - A thumb.
 * @csspart bubble - The value bubble over a thumb.
 * @csspart mark - A tick on the track.
 * @csspart mark-label - The label of a tick.
 * @csspart value - The value text after the track (`value-display="text"`).
 * @csspart status - The status message box.
 * @cssstate user-invalid - Invalidity is displayed.
 * @cssstate invalid - The value does not satisfy its constraints (not displayed).
 * @cssstate busy - `loading` is set.
 * @cssstate dragging - A thumb is being dragged.
 * @fires input - Native, on every change while dragging and with every key; composed.
 * @fires change - Native, when a drag ends or a key changed the value; composed and dispatched from the host.
 * @cloakDisplay block
 * @cloakMinBlockSize 3.5rem
 */
export class TctSlider extends TctFieldControl {
  static override readonly tagName = 'tct-slider';
  static override readonly dependencies: readonly TctElementConstructor[] = [
    ...TctFieldControl.dependencies,
    TctTooltip,
  ];
  static override styles: CSSResultGroup = [base, visuallyHidden, motion, field, styles];

  /** The smallest value. Default 0. */
  @property({type: Number}) min = 0;

  /** The largest value. Default 100. */
  @property({type: Number}) max = 100;

  /** The amount a key press or a snap moves by. Default 1. */
  @property({type: Number}) step = 1;

  /** `horizontal` (default) or `vertical`, where the minimum is at the bottom. */
  @property({reflect: true}) orientation: SliderOrientation = 'horizontal';

  /** Two thumbs: the value is a start and an end. */
  @property({type: Boolean, reflect: true}) range = false;

  /** With `range`, the least number of steps between the two thumbs. */
  @property({type: Number, attribute: 'min-steps-between-thumbs'}) minStepsBetweenThumbs = 0;

  /** Where the value is shown: in a `tooltip` bubble over the thumb (default), as `text`, or `none`. */
  @property({attribute: 'value-display'}) valueDisplay: SliderValueDisplay = 'tooltip';

  /** Writes a value for the bubble, the text and `aria-valuetext` (`(n) => n + '%'`). */
  @property({attribute: false}) formatValue: ((value: number) => string) | undefined;

  /** Ticks on the track with optional labels: `[{value: 0, label: 'Low'}, {value: 100}]`. */
  @property({converter: marksConverter}) marks: SliderMark[] | undefined;

  /**
   * The value as text: `"50"`, or with `range` `"20,80"`. The `value` attribute is the default that a
   * form reset restores.
   */
  @property({attribute: false})
  override get value(): string {
    return this.values.join(',');
  }
  override set value(value: string | number | readonly number[] | null | undefined) {
    if (value === null || value === undefined) this.#values = undefined;
    else if (typeof value === 'number') this.#values = [value];
    else if (typeof value === 'string') this.#values = parseValues(value);
    else this.#values = Array.from(value);
    this.requestUpdate('value');
  }

  /** The value as numbers: one, or two with `range`, each inside `min` and `max`. */
  @property({attribute: false})
  get values(): number[] {
    return this.#normalize(this.#values ?? parseValues(this.defaultValue));
  }
  set values(value: Iterable<number> | null | undefined) {
    this.value = value === null || value === undefined ? undefined : Array.from(value);
  }

  /** The first (or only) value, as a number. */
  get valueAsNumber(): number {
    return this.values[0] ?? this.#min;
  }
  set valueAsNumber(value: number) {
    this.value = [value];
  }

  readonly #locale: LocaleController = new LocaleController(this, {
    namespace: 'slider',
    defaults: sliderMessages,
  });
  #values: number[] | undefined;
  #drag: {index: number; start: number[]; pointerId: number} | null = null;
  /** The thumb pressed by a pointer (focused from script): it does not draw the keyboard ring. */
  #pointerFocus: number | null = null;

  // ------------------------------------------------------------------------------ mixin hooks

  /** The first thumb: the focus target and validation anchor. */
  protected override get formControl(): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>('.thumb');
  }

  /** A range's group carries the name and description; a single thumb carries its own. */
  protected override get chromeTarget(): HTMLElement | null {
    return this.range ? this.renderRoot.querySelector<HTMLElement>('.track') : this.formControl;
  }

  protected override get fieldSize(): ElementSize {
    return 'md';
  }

  /** The label names the slider (or the range's group) by `aria-labelledby`: it is a caption, not a `<label>`. */
  protected override get groupLabel(): boolean {
    return true;
  }

  /** A required slider is conveyed by a hidden "Required" text (`aria-required` is not defined for a slider). */
  protected override get helperIds(): string[] {
    return [...super.helperIds, this.ids.id('required')];
  }

  /** Each value is one entry under `name`; a range submits the start, then the end. */
  protected override formValue(): FormValue {
    if (!this.name) return null;
    const data = new FormData();
    for (const value of this.values) data.append(this.name, String(value));
    return data;
  }

  protected override formResetValue(): void {
    this.#values = undefined;
    super.formResetValue();
  }

  protected override formRestoreState(state: FormValue): void {
    if (state instanceof FormData) {
      this.value = state.getAll(this.name).map((entry) => Number(entry));
    } else if (typeof state === 'string') {
      this.value = state;
    }
  }

  /** Focuses the first thumb. */
  override focus(options?: FocusOptions): void {
    const control = this.formControl;
    if (control) control.focus(options);
    else super.focus(options);
  }

  // ---------------------------------------------------------------------------------- derived

  get #min(): number {
    return finite(this.min, 0);
  }

  get #max(): number {
    return Math.max(finite(this.max, 100), this.#min);
  }

  get #step(): number {
    const step = finite(this.step, 1);
    return step > 0 ? step : 1;
  }

  get #isHorizontal(): boolean {
    return oneOf(this.orientation, SLIDER_ORIENTATIONS, 'horizontal') === 'horizontal';
  }

  get #blocked(): boolean {
    return this.isDisabled || this.readonly || this.busy;
  }

  get #minGap(): number {
    return this.range ? Math.max(0, finite(this.minStepsBetweenThumbs, 0)) * this.#step : 0;
  }

  /** One value, or two ordered ones with `range`; missing ones default to the ends; all clamped. */
  #normalize(list: readonly number[]): number[] {
    const min = this.#min;
    const max = this.#max;
    if (!this.range) return [clamp(list[0] ?? min, min, max)];
    const start = clamp(list[0] ?? min, min, max);
    const end = clamp(list[1] ?? max, min, max);
    return start <= end ? [start, end] : [end, start];
  }

  #text(value: number): string {
    return this.formatValue?.(value) ?? this.#numberFormat.format(value);
  }

  get #numberFormat(): Intl.NumberFormat {
    try {
      return new Intl.NumberFormat(this.#locale.locale, {maximumFractionDigits: 20});
    } catch {
      return new Intl.NumberFormat('en', {maximumFractionDigits: 20});
    }
  }

  // ---------------------------------------------------------------------------------- lifecycle

  constructor() {
    super();
    this.addEventListener('click', this.#onLabelClick);
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed);
    if (changed.has('orientation') && !SLIDER_ORIENTATIONS.includes(this.orientation)) {
      devWarn(
        `slider:orientation:${this.orientation}`,
        `orientation "${this.orientation}" is not one of ${SLIDER_ORIENTATIONS.join(', ')}.`,
      );
    }
    if (changed.has('valueDisplay') && !SLIDER_VALUE_DISPLAYS.includes(this.valueDisplay)) {
      devWarn(
        `slider:value-display:${this.valueDisplay}`,
        `value-display "${this.valueDisplay}" is not one of ${SLIDER_VALUE_DISPLAYS.join(', ')}.`,
      );
    }
    // The host disappears as a box so a parent grid places the label and the slider in its columns.
    this.toggleAttribute(
      'data-horizontal-labels',
      this.layoutContext.value?.direction === 'horizontal-labels' && !this.groupContext.value,
    );
  }

  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed);
    // The mixin puts `aria-invalid` on the first thumb; a range's second thumb follows it.
    const thumbs = [...this.renderRoot.querySelectorAll<HTMLElement>('.thumb')];
    const first = thumbs[0];
    for (const thumb of thumbs.slice(1)) {
      if (first?.getAttribute('aria-invalid') === 'true')
        thumb.setAttribute('aria-invalid', 'true');
      else thumb.removeAttribute('aria-invalid');
    }
    if (!this.label && !this.hasAttribute('aria-label') && !this.hasAttribute('aria-labelledby')) {
      devWarn(
        'slider:label',
        '<tct-slider> needs a `label`: it is the accessible name of the slider.',
      );
    }
  }

  // -------------------------------------------------------------------------------- rendering

  override render() {
    const horizontal = this.layoutContext.value?.direction === 'horizontal-labels';
    const orientation = this.#isHorizontal ? 'horizontal' : 'vertical';
    const values = this.values;
    const display = oneOf(this.valueDisplay, SLIDER_VALUE_DISPLAYS, 'tooltip');
    return html`<div
        class="field"
        part="field"
        data-layout=${ifDefined(horizontal ? 'horizontal-labels' : undefined)}
        ?data-label-hidden=${this.labelHidden}
        style=${styleMap({'--_field-width': this.cssWidth})}
      >
        <div class="label-cell">
          <div class="label-row">${this.renderLabelRow()}</div>
          ${this.renderDescriptionText()}
        </div>
        <div class="control-cell">
          <tct-tooltip
            content=${this.showsDisabledMessage ? this.disabledMessage : ''}
            placement="above"
            focus-trigger="always"
            ><div
              class="row"
              data-orientation=${orientation}
              ?data-mark-labels=${this.marks?.some((mark) => mark.label) ?? false}
            >
              ${this.#renderTrack(values, orientation, display)}
              ${
                display === 'text'
                  ? html`<span class="value" part="value" aria-hidden="true"
                      >${values.map((value) => this.#text(value)).join(' – ')}</span
                    >`
                  : nothing
              }
            </div></tct-tooltip
          >
          ${this.renderStatusMessage()}
        </div>
      </div>
      ${this.renderHelpers()}`;
  }

  protected override renderHelpers(): TemplateResult {
    const required =
      (this.required && !this.optional) || (!this.required && this.announcesRequired);
    return html`${super.renderHelpers()}${
      required
        ? html`<span class="visually-hidden" id=${this.ids.id('required')}
            >${this.fieldLocale.t('required')}</span
          >`
        : nothing
    }`;
  }

  #renderTrack(
    values: readonly number[],
    orientation: SliderOrientation,
    display: SliderValueDisplay,
  ): TemplateResult {
    const min = this.#min;
    const max = this.#max;
    const percents = values.map((value) => percentOf(value, min, max));
    const start = this.range ? (percents[0] ?? 0) : 0;
    const end = percents[percents.length - 1] ?? 0;
    return html`<div
      class="track"
      part="control"
      role=${ifDefined(this.range ? 'group' : undefined)}
      data-orientation=${orientation}
      ?data-disabled=${this.isDisabled}
      ?data-dragging=${this.#drag !== null}
      @pointerdown=${this.#onPointerDown}
      @pointermove=${this.#onPointerMove}
      @pointerup=${this.#onPointerEnd}
      @pointercancel=${this.#onPointerEnd}
    >
      <div class="rail" part="track" aria-hidden="true"></div>
      <div
        class="fill"
        part="fill"
        aria-hidden="true"
        style=${styleMap({'--_start': String(start), '--_end': String(end)})}
      ></div>
      ${this.marks ? this.#renderMarks(values) : nothing}
      ${values.map((value, index) => this.#renderThumb(index, value, values, percents[index] ?? 0, display))}
    </div>`;
  }

  #renderMarks(values: readonly number[]): TemplateResult {
    const min = this.#min;
    const max = this.#max;
    return html`<div class="marks" aria-hidden="true">
      ${(this.marks ?? []).map((mark) => {
        const percent = percentOf(mark.value, min, max);
        const filled = this.range
          ? mark.value >= (values[0] ?? min) && mark.value <= (values[1] ?? max)
          : mark.value <= (values[0] ?? min);
        return html`<span
            class="mark"
            part="mark"
            data-mark-value=${mark.value}
            ?data-filled=${filled}
            style=${styleMap({'--_pct': String(percent)})}
          ></span
          >${
            mark.label
              ? html`<span
                  class="mark-label"
                  part="mark-label"
                  data-mark-value=${mark.value}
                  style=${styleMap({'--_pct': String(percent)})}
                  >${mark.label}</span
                >`
              : nothing
          }`;
      })}
    </div>`;
  }

  #renderThumb(
    index: number,
    value: number,
    values: readonly number[],
    percent: number,
    display: SliderValueDisplay,
  ): TemplateResult {
    const min = this.#min;
    const max = this.#max;
    const gap = this.#minGap;
    // The bounds agree with how far the thumb can move: it cannot pass its sibling.
    const lower = this.range && index === 1 ? clamp((values[0] ?? min) + gap, min, max) : min;
    const upper = this.range && index === 0 ? clamp((values[1] ?? max) - gap, min, max) : max;
    const inert = this.showsDisabledMessage;
    const disabled = this.isDisabled;
    const text = this.#text(value);
    return html`<div
      class="thumb"
      part="thumb"
      role="slider"
      tabindex=${disabled && !inert ? -1 : 0}
      aria-valuemin=${lower}
      aria-valuemax=${upper}
      aria-valuenow=${value}
      aria-valuetext=${ifDefined(text !== String(value) ? text : undefined)}
      aria-orientation=${this.#isHorizontal ? 'horizontal' : 'vertical'}
      aria-disabled=${ifDefined(disabled ? 'true' : undefined)}
      aria-readonly=${ifDefined(this.readonly ? 'true' : undefined)}
      aria-busy=${ifDefined(this.busy ? 'true' : undefined)}
      aria-label=${ifDefined(
        this.range
          ? this.#locale.t(index === 0 ? '@tct.slider.minimumValue' : '@tct.slider.maximumValue')
          : undefined,
      )}
      data-index=${index}
      ?data-dragging=${this.#drag?.index === index}
      ?data-pointer=${this.#pointerFocus === index}
      ?data-disabled=${disabled}
      style=${styleMap({'--_pct': String(percent)})}
      @keydown=${(event: KeyboardEvent) => {
        this.#onKeyDown(index, event);
      }}
      @focus=${() => {
        if (this.#pointerFocus !== null && this.#pointerFocus !== index) {
          this.#pointerFocus = null;
          this.requestUpdate();
        }
      }}
      @blur=${this.#onThumbBlur}
    >
      ${
        display === 'tooltip' && !inert
          ? html`<span class="bubble" part="bubble" aria-hidden="true">${text}</span>`
          : nothing
      }
    </div>`;
  }

  // ---------------------------------------------------------------------------------- events

  /** A press on the caption moves focus to the first thumb (a `<label>` cannot label a `div`). */
  readonly #onLabelClick = (event: MouseEvent): void => {
    const origin = event.composedPath()[0];
    if (this.isDisabled || !(origin instanceof Element)) return;
    if (origin.closest('[part="label"], [part="description"]')) this.formControl?.focus();
  };

  readonly #onThumbBlur = (): void => {
    if (this.#pointerFocus === null) return;
    this.#pointerFocus = null;
    this.requestUpdate();
  };

  /** The value under a pointer, on the thumb's travel (the box less half a thumb at each end). */
  #valueAt(track: HTMLElement, clientX: number, clientY: number): number {
    const rect = track.getBoundingClientRect();
    const size = this.#isHorizontal ? rect.width : rect.height;
    const offset = this.#isHorizontal
      ? getComputedStyle(track).direction === 'rtl'
        ? rect.right - clientX
        : clientX - rect.left
      : rect.bottom - clientY;
    const travel = size - THUMB_SIZE;
    // Narrower than the thumb there is no travel to map onto: the raw fraction, not a division by zero.
    const fraction = travel > 0 ? (offset - THUMB_SIZE / 2) / travel : size > 0 ? offset / size : 0;
    const min = this.#min;
    const max = this.#max;
    const raw = min + clamp(fraction, 0, 1) * (max - min);
    return clamp(snapToStep(raw, min, this.#step), min, max);
  }

  readonly #onPointerDown = (event: PointerEvent): void => {
    if (this.#blocked || event.button !== 0) return;
    const track = event.currentTarget as HTMLElement;
    event.preventDefault();
    const origin = event.target as Element;
    // A press on a tick snaps to that tick's value, whatever the pointer's position on a wide label.
    const mark = origin.closest<HTMLElement>('[data-mark-value]');
    const target = mark
      ? Number(mark.dataset.markValue)
      : this.#valueAt(track, event.clientX, event.clientY);
    const values = this.values;
    const pressed = origin.closest<HTMLElement>('.thumb');
    // A press on a thumb owns that thumb even when the range's values coincide; the track and the ticks
    // choose the nearest one (the lower when equidistant).
    const index = pressed
      ? Number(pressed.dataset.index)
      : this.range && Math.abs(target - (values[0] ?? 0)) > Math.abs(target - (values[1] ?? 0))
        ? 1
        : 0;
    this.#drag = {index, start: values, pointerId: event.pointerId};
    this.#pointerFocus = index;
    this.toggleState('dragging', true);
    this.#move(index, target);
    this.renderRoot.querySelectorAll<HTMLElement>('.thumb')[index]?.focus();
    try {
      track.setPointerCapture(event.pointerId);
    } catch {
      // A synthetic pointer has nothing to capture.
    }
    this.requestUpdate();
  };

  readonly #onPointerMove = (event: PointerEvent): void => {
    const drag = this.#drag;
    if (!drag || this.#blocked) return;
    this.#move(
      drag.index,
      this.#valueAt(event.currentTarget as HTMLElement, event.clientX, event.clientY),
    );
  };

  readonly #onPointerEnd = (): void => {
    const drag = this.#drag;
    if (!drag) return;
    this.#drag = null;
    this.toggleState('dragging', false);
    this.requestUpdate();
    if (!sameValues(drag.start, this.values)) this.redispatchChange();
  };

  #onKeyDown(index: number, event: KeyboardEvent): void {
    if (this.#blocked) return;
    // The ring is for the keyboard: a key press after a mouse drag brings it back.
    if (this.#pointerFocus !== null && event.key !== 'Shift') {
      this.#pointerFocus = null;
      this.requestUpdate();
    }
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const current = this.values[index] ?? this.#min;
    const step = this.#step;
    // Right-to-left: the minimum is at the right, so Left goes toward the maximum (a native range does the same).
    const rtl = this.#isHorizontal && getComputedStyle(this).direction === 'rtl';
    let next: number;
    switch (event.key) {
      case 'ArrowUp':
        next = current + step;
        break;
      case 'ArrowDown':
        next = current - step;
        break;
      case 'ArrowRight':
        next = rtl ? current - step : current + step;
        break;
      case 'ArrowLeft':
        next = rtl ? current + step : current - step;
        break;
      case 'PageUp':
        next = current + step * 10;
        break;
      case 'PageDown':
        next = current - step * 10;
        break;
      case 'Home':
        next = this.#min;
        break;
      case 'End':
        next = this.#max;
        break;
      default:
        return;
    }
    event.preventDefault();
    const before = this.values;
    this.#move(index, next);
    if (!sameValues(before, this.values)) this.redispatchChange();
  }

  /** Moves one thumb to `raw`: snapped, clamped, and (with `range`) kept from passing the other. */
  #move(index: number, raw: number): void {
    if (this.#blocked) return;
    const min = this.#min;
    const max = this.#max;
    const next = [...this.values];
    next[index] = clamp(snapToStep(raw, min, this.#step), min, max);
    if (this.range) {
      const gap = this.#minGap;
      if (index === 0) next[0] = Math.min(next[0] ?? min, (next[1] ?? max) - gap);
      else next[1] = Math.max(next[1] ?? max, (next[0] ?? min) + gap);
      next[0] = clamp(next[0] ?? min, min, max);
      next[1] = clamp(next[1] ?? max, min, max);
    }
    if (sameValues(next, this.values)) return;
    this.#values = next;
    this.syncFormState();
    this.requestUpdate();
    this.dispatchEvent(new Event('input', {bubbles: true, composed: true}));
  }
}

function sameValues(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-slider': TctSlider;
  }
}
