import {html, nothing, type CSSResultGroup, type PropertyValues, type TemplateResult} from 'lit';
import {property} from 'lit/decorators.js';
import {ifDefined} from 'lit/directives/if-defined.js';
import {live} from 'lit/directives/live.js';
import {styleMap} from 'lit/directives/style-map.js';
import textAreaMessages from '@tecton-astryx/locales/en/textArea.js';
import {announce} from '@tecton-astryx/core/a11y/announcer.js';
import {observeResize} from '@tecton-astryx/core/controllers/resize.js';
import {features} from '@tecton-astryx/core/features.js';
import {LocaleController} from '@tecton-astryx/core/i18n/locale-controller.js';
import type {Validator} from '@tecton-astryx/core/mixins/form-control.js';
import type {FormValue} from '@tecton-astryx/core/mixins/form-control.js';
import {devWarn} from '@tecton-astryx/core/utils/dev.js';
import type {InputStatus} from '../field/field.types.js';
import {TctBoxControl} from './tct-box-control.js';
import {
  characterCount,
  COUNTER_WARNING_THRESHOLD,
  TEXT_AREA_SIZES,
  type CounterZone,
} from './text-area.types.js';
import styles from './tct-text-area.styles.css';

/** Attributes that are forwarded to the inner textarea but are not reactive properties. */
const FORWARDED_ATTRIBUTES = ['enterkeyhint', 'inputmode'] as const;

/**
 * A multi-line text field with its label, description and status: comments, descriptions, messages. It is a
 * form-associated element, so it submits, resets, restores, validates and joins a `<fieldset disabled>` like
 * a native `<textarea>`; Enter adds a line, never submits.
 *
 * **Default (shadow) mode** renders a native `<textarea>` in its shadow root, with the label, description
 * and status in the same root, so every id relationship stays inside one tree. **Slotted-textarea mode**,
 * `<tct-text-area><textarea slot="input" name="notes"></textarea></tct-text-area>`, makes your own
 * `<textarea>` the control: it submits itself and browser features that key on a native field see it; the
 * label, description and status become satellites in the light DOM next to it. In that mode the textarea
 * owns `name`, `value`, `required`, `disabled`, `rows` and `autocomplete`.
 *
 * `rows` sets the visible height. `auto-grow` makes the field grow with its text, up to `max-rows`: it uses
 * CSS `field-sizing: content` where the browser has it and measures the text otherwise. `maxlength` shows a
 * counter of user-perceived characters (an emoji counts as one); it does not stop typing: past the limit
 * the counter turns to an error, the field is `aria-invalid`, the form will not submit, and the count is
 * announced (once when it nears the limit, assertively when it is passed). Validation is displayed only
 * after the user acted. [mwg:form-associated-custom-elements] [mwg:form-fields-automatically-fit-contents]
 * [mwg:validate-input-after-interaction] [mwg:accessible-error-announcement]
 *
 * @summary Multi-line text field with label, description, status, counter and auto-grow.
 * @tag tct-text-area
 * @upstream TextArea
 * @slot input - Your own `<textarea>`: switches to slotted-textarea mode.
 * @slot label - The label satellite (slotted-textarea mode). Do not fill it.
 * @slot description - The description satellite (slotted-textarea mode). Do not fill it.
 * @slot status - The status satellite (slotted-textarea mode). Do not fill it.
 * @csspart field - The whole field: label, control and status.
 * @csspart label - The label.
 * @csspart description - The description.
 * @csspart label-indicator - The "Required" or "Optional" text.
 * @csspart label-tip - The info-tip button.
 * @csspart input - The painted box around the control.
 * @csspart control - The native `<textarea>` (shadow mode).
 * @csspart start-icon - The start icon.
 * @csspart status-icon - The status icon inside the box.
 * @csspart status-button - The status button of the `tooltip` status variant.
 * @csspart counter - The character counter.
 * @csspart status - The status message box.
 * @cssstate user-invalid - Invalidity is displayed (after a user commit, a submit attempt or `reportValidity()`, and at once past `maxlength`).
 * @cssstate invalid - The value does not satisfy its constraints (not displayed).
 * @cssstate busy - A `changeAction` is pending or `loading` is set.
 * @fires input - Native, on every edit; composed and retargeted from the inner textarea.
 * @fires change - Native, when the user commits the edit (blur); dispatched once from the host.
 * @fires paste - Native, when content is pasted; composed, retargeted from the inner textarea.
 * @cloakDisplay block
 * @cloakMinBlockSize 6rem
 */
export class TctTextArea extends TctBoxControl {
  static override readonly tagName = 'tct-text-area';
  static override styles: CSSResultGroup = [TctBoxControl.styles, styles];

  static override get observedAttributes(): string[] {
    return [...super.observedAttributes, ...FORWARDED_ATTRIBUTES];
  }

  /** The number of visible text rows: the field's height. */
  @property({type: Number}) rows = 3;

  /**
   * Maximum number of characters, counted as user-perceived characters. It shows a counter and does not
   * stop typing: past the limit the field is invalid and the count is announced.
   */
  @property({type: Number}) maxlength: number | undefined;

  /** The native `autocomplete` attribute, forwarded to the textarea unchanged (`off`, `on`...). */
  @property() autocomplete = '';

  /** Name of an icon shown at the start of the field (a registered icon such as `search`). */
  @property({attribute: 'start-icon'}) startIcon = '';

  /**
   * Grows the field with its text instead of scrolling, from `rows` up to `max-rows`: CSS `field-sizing:
   * content` where the browser has it, measured text height otherwise. The resize grip is off meanwhile.
   */
  @property({type: Boolean, reflect: true, attribute: 'auto-grow'}) autoGrow = false;

  /** With `auto-grow`, the number of rows after which the field scrolls. Unset: it grows without limit. */
  @property({type: Number, attribute: 'max-rows'}) maxRows: number | undefined;

  /**
   * Async action run after every user edit, with the new value and the event. While its promise is
   * pending the field is busy (`:state(busy)`, a spinner and `aria-busy`).
   */
  @property({attribute: false}) changeAction:
    ((value: string, event: Event) => void | Promise<void>) | undefined;

  /** The value of the field: the inner textarea's, or your slotted textarea's in slotted-textarea mode. */
  @property({attribute: false})
  override get value(): string {
    const slotted = this.#slottedTextArea;
    return slotted ? slotted.value : super.value;
  }
  override set value(value: string) {
    const slotted = this.#slottedTextArea;
    if (slotted) slotted.value = value ?? '';
    else super.value = value;
  }

  readonly #locale = new LocaleController(this, {
    namespace: 'textArea',
    defaults: textAreaMessages,
  });
  #zone: CounterZone = 'under';
  #lastInlineSize = -1;
  #stopResize: (() => void) | undefined;
  #observed: Element | null = null;

  // ------------------------------------------------------------------------------ mixin hooks

  /** The author's own textarea (slotted-textarea mode). */
  get #slottedTextArea(): HTMLTextAreaElement | null {
    return this.querySelector<HTMLTextAreaElement>(':scope > textarea[slot="input"]');
  }

  protected override get slottedControl(): HTMLElement | null {
    return this.#slottedTextArea;
  }

  protected override get formControl(): HTMLTextAreaElement | null {
    return (
      this.#slottedTextArea ??
      this.renderRoot.querySelector<HTMLTextAreaElement>('textarea.area-control') ??
      null
    );
  }

  protected override formValue(): FormValue {
    return this.#slottedTextArea ? null : this.value;
  }

  protected override formState(): FormValue {
    return this.#slottedTextArea ? null : this.value;
  }

  /** Characters past `maxlength` are invalid, whatever the interaction state (upstream `aria-invalid`). */
  protected override get validators(): Validator<this>[] {
    return [
      (element) => {
        const over = element.#overBy;
        return over > 0
          ? {
              flags: {tooLong: true},
              message: element.#locale.t('@astryx.textArea.charactersOverLimit', {count: over}),
            }
          : null;
      },
    ];
  }

  override get showInvalid(): boolean {
    return super.showInvalid || this.#overBy > 0;
  }

  /** The counter already says "N over the limit": no second message for it. */
  protected override get effectiveStatus(): InputStatus | undefined {
    if (!this.statusType && this.#overBy > 0) return undefined;
    return super.effectiveStatus;
  }

  protected override get helperIds(): string[] {
    return [...super.helperIds, this.ids.id('counter')];
  }

  /** Focuses the textarea itself. */
  override focus(options?: FocusOptions): void {
    const control = this.formControl;
    if (control) control.focus(options);
    else super.focus(options);
  }

  /** Selects the text of the textarea. */
  select(): void {
    this.formControl?.select();
  }

  // ---------------------------------------------------------------------------------- derived

  /** The count, in user-perceived characters. */
  get #length(): number {
    return this.maxlength === undefined ? 0 : characterCount(this.value);
  }

  /** Characters past the limit (0 while within it, or without a limit). */
  get #overBy(): number {
    return this.maxlength !== undefined && this.maxlength > 0
      ? Math.max(0, this.#length - this.maxlength)
      : 0;
  }

  get #rows(): number {
    return Number.isFinite(this.rows) && this.rows >= 1 ? Math.floor(this.rows) : 3;
  }

  // ---------------------------------------------------------------------------------- lifecycle

  constructor() {
    super();
    // Slotted-textarea mode: the author's textarea fires the events; the host reacts (counter, autosize).
    this.addEventListener('input', this.#onHostInput);
  }

  override attributeChangedCallback(name: string, old: string | null, value: string | null): void {
    super.attributeChangedCallback(name, old, value);
    if ((FORWARDED_ATTRIBUTES as readonly string[]).includes(name)) this.requestUpdate();
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.#zone = this.#zoneOf(this.#length);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#stopResize?.();
    this.#stopResize = undefined;
    this.#observed = null;
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed);
    if (changed.has('size') && this.size && !TEXT_AREA_SIZES.includes(this.size)) {
      devWarn(
        `text-area:size:${this.size}`,
        `size "${this.size}" is not one of ${TEXT_AREA_SIZES.join(', ')}.`,
      );
    }
  }

  protected override firstUpdated(): void {
    if (!this.hasAttribute('autofocus')) return;
    // The inner textarea is only focusable once the first render has settled (upstream `hasAutoFocus`).
    void this.updateComplete.then(() => {
      this.focus({preventScroll: true});
    });
  }

  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed);
    this.#autosize();
    this.#watchWidth();
  }

  protected override syncControlAttributes(): void {
    const slotted = this.#slottedTextArea;
    if (!slotted) return;
    // The author owns the textarea's own attributes; only the state that has no native equivalent is ours.
    if (this.busy) slotted.setAttribute('aria-busy', 'true');
    else slotted.removeAttribute('aria-busy');
    if (this.showsDisabledMessage) slotted.setAttribute('aria-disabled', 'true');
  }

  // -------------------------------------------------------------------------------- rendering

  override render() {
    const slotted = this.#slottedTextArea !== null;
    return this.renderFieldLayout(this.renderBoxWrapper(this.#renderArea(slotted)));
  }

  #renderArea(slotted: boolean): TemplateResult {
    const status = this.effectiveStatus;
    const showStatusIcon =
      status !== undefined && !this.inGroup && this.effectiveStatusVariant !== 'detached';
    const endSlot = this.busy || showStatusIcon;
    const disabled = this.isDisabled;
    const inert = this.showsDisabledMessage;
    const over = this.#overBy > 0;
    return html`<div
      class="area"
      data-size=${this.fieldSize}
      ?data-auto-grow=${this.autoGrow}
      ?data-start-icon=${this.startIcon !== ''}
      ?data-end-slot=${endSlot}
      ?data-busy=${this.busy}
      ?data-counter=${this.maxlength !== undefined}
      ?data-max-rows=${this.maxRows !== undefined}
      style=${styleMap({
        '--_rows': String(this.#rows),
        '--_max-rows': this.maxRows === undefined ? undefined : String(this.maxRows),
      })}
    >
      ${
        this.startIcon
          ? html`<tct-icon
              class="start-icon"
              part="start-icon"
              name=${this.startIcon}
              size="sm"
              color="secondary"
            ></tct-icon>`
          : nothing
      }
      ${
        slotted
          ? html`<slot name="input"></slot>`
          : html`<textarea
              class="area-control"
              part="control"
              .value=${live(this.value)}
              rows=${this.#rows}
              placeholder=${ifDefined(this.placeholder || undefined)}
              autocomplete=${ifDefined(this.autocomplete || undefined)}
              inputmode=${ifDefined(this.getAttribute('inputmode') ?? undefined)}
              enterkeyhint=${ifDefined(this.getAttribute('enterkeyhint') ?? undefined)}
              .spellcheck=${this.spellcheck}
              ?required=${this.required && !this.optional}
              ?disabled=${disabled && !inert}
              ?readonly=${this.readonly || inert}
              aria-disabled=${ifDefined(inert ? 'true' : undefined)}
              aria-required=${ifDefined(!this.required && this.announcesRequired ? 'true' : undefined)}
              aria-busy=${ifDefined(this.busy ? 'true' : undefined)}
              aria-labelledby=${ifDefined(this.groupLabelId)}
              @input=${this.#onInput}
              @change=${this.#onChange}
            ></textarea>`
      }
      ${
        endSlot
          ? html`<span class="end-slot">${this.renderBusy()}${this.renderStatusIcon()}</span>`
          : nothing
      }
      ${
        this.maxlength !== undefined
          ? html`<div
              class="counter"
              part="counter"
              id=${this.ids.id('counter')}
              ?data-over=${over}
            >
              ${over ? html`<tct-icon name="warning" size="sm" color="inherit"></tct-icon>` : nothing}
              ${this.#length}/${this.maxlength}
            </div>`
          : nothing
      }
    </div>`;
  }

  // ---------------------------------------------------------------------------------- events

  readonly #onInput = (event: Event): void => {
    const area = event.target as HTMLTextAreaElement;
    this.value = area.value;
    this.#afterEdit(event);
  };

  /** `change` is not composed: the host re-dispatches it exactly once. */
  readonly #onChange = (): void => {
    this.redispatchChange();
  };

  /** Slotted-textarea mode: an edit in the author's textarea re-renders the counter and the height. */
  readonly #onHostInput = (event: Event): void => {
    const slotted = this.#slottedTextArea;
    if (!slotted || event.target !== slotted) return;
    this.#afterEdit(event);
  };

  #afterEdit(event: Event): void {
    this.#announceCounter();
    this.#autosize();
    this.requestUpdate();
    this.#runChangeAction(this.value, event);
  }

  /** Runs `changeAction` after a user edit; busy (`:state(busy)`, `aria-busy`) while its promise is pending. */
  #runChangeAction(value: string, event: Event): void {
    const action = this.changeAction;
    if (!action) return;
    const settled = this.trackAction(action(value, event));
    if (!settled) return;
    void settled.then(() => {
      this.settleAction();
    });
  }

  // -------------------------------------------------------------------------------- the counter

  #zoneOf(length: number): CounterZone {
    const max = this.maxlength;
    if (max === undefined || max <= 0) return 'under';
    if (length > max) return 'over';
    return length >= max * COUNTER_WARNING_THRESHOLD ? 'near' : 'under';
  }

  /** Speaks when the count crosses into "near" or "over": once per crossing, never on every keystroke. */
  #announceCounter(): void {
    const max = this.maxlength;
    if (max === undefined) return;
    const length = this.#length;
    const zone = this.#zoneOf(length);
    if (zone === this.#zone) return;
    this.#zone = zone;
    if (zone === 'over') {
      announce(this.#locale.t('@astryx.textArea.charactersOverLimit', {count: length - max}), {
        politeness: 'assertive',
        element: this,
      });
    } else if (zone === 'near') {
      announce(this.#locale.t('@astryx.textArea.charactersRemaining', {count: max - length}), {
        politeness: 'polite',
        element: this,
      });
    }
  }

  // ------------------------------------------------------------------------------- auto-grow

  /**
   * The JS half of `auto-grow`: where CSS `field-sizing: content` is missing, the height is the measured
   * text height (`scrollHeight` of a collapsed field); `min-block-size` (rows) and `max-block-size`
   * (max-rows) in the stylesheet clamp it. Where the property exists the stylesheet does everything.
   */
  #autosize(): void {
    const area = this.formControl;
    if (!area) return;
    if (!this.autoGrow || features.fieldSizing) {
      area.style.removeProperty('block-size');
      return;
    }
    area.style.blockSize = 'auto';
    area.style.blockSize = `${area.scrollHeight}px`;
  }

  /** A change of width re-wraps the text: measure again (only the fallback measures). */
  #watchWidth(): void {
    const area = this.formControl;
    const wanted = this.autoGrow && !features.fieldSizing ? area : null;
    if (wanted === this.#observed) return;
    this.#stopResize?.();
    this.#stopResize = undefined;
    this.#observed = wanted;
    if (!wanted) return;
    this.#lastInlineSize = -1;
    this.#stopResize = observeResize(wanted, (entry) => {
      const inline = entry.contentBoxSize[0]?.inlineSize ?? entry.contentRect.width;
      if (inline === this.#lastInlineSize) return;
      this.#lastInlineSize = inline;
      this.#autosize();
    });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-text-area': TctTextArea;
  }
}
