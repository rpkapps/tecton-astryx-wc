import {html, nothing, type CSSResultGroup, type PropertyValues, type TemplateResult} from 'lit';
import {property} from 'lit/decorators.js';
import {ifDefined} from 'lit/directives/if-defined.js';
import {live} from 'lit/directives/live.js';
import inputMessages from '@tecton-astryx/locales/en/input.js';
import numberInputMessages from '@tecton-astryx/locales/en/numberInput.js';
import numberInputExtra from '@tecton-astryx/locales/en/number-input.js';
import {announce} from '@tecton-astryx/core/a11y/announcer.js';
import {TctClearEvent} from '@tecton-astryx/core/events/tct-clear.js';
import {TctEnterEvent} from '@tecton-astryx/core/events/tct-enter.js';
import {LocaleController} from '@tecton-astryx/core/i18n/locale-controller.js';
import type {Validator} from '@tecton-astryx/core/mixins/form-control.js';
import type {TctElementConstructor} from '@tecton-astryx/core/tct-element.js';
import {devWarn} from '@tecton-astryx/core/utils/dev.js';
import {isImeKeyEvent} from '@tecton-astryx/core/utils/ime.js';
import type {InputStatus} from '../field/field.types.js';
import {TctInputClearButton} from '../field/tct-input-clear-button.js';
import {TctBoxControl} from '../text-area/tct-box-control.js';
import {formatEditableNumber} from './number-parser.js';
import {parseNumberInput, resolveNumberInputCommit} from './number-input-commit.js';
import {steppedValue, type StepDirection} from './number-stepping.js';
import type {NumberFormatter} from './number-input.types.js';
import styles from './tct-number-input.styles.css';

/** Text that is not yet a value: the draft is committed (or dropped) when the field is left or Enter is pressed. */
type Draft = string | null;

/** A finite number from an attribute or property, else `undefined`. */
const finite = (value: number | null | undefined): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

/** The browser's own localized message for a value outside the range, from a probe input. */
function rangeMessage(kind: 'min' | 'max', bound: number): string {
  const probe = document.createElement('input');
  probe.type = 'number';
  if (kind === 'min') {
    probe.min = String(bound);
    probe.value = String(bound - 1);
  } else {
    probe.max = String(bound);
    probe.value = String(bound + 1);
  }
  return probe.validationMessage;
}

/**
 * A number field with its label, description and status: quantities, prices, sizes. It takes what a
 * person in their language types or pastes (`1.234,5` in German, full-width digits from an IME, a
 * spreadsheet's grouping and signs), keeps the text as a draft while they type, and commits one number
 * when they leave the field or press Enter: out of range is clamped, unreadable text goes back to the
 * last value (and is `aria-invalid` and announced while it stands). Arrow keys, the mouse wheel over the
 * focused field and optional stepper buttons step by `step`.
 *
 * It is a form-associated element that submits the number in its plain machine form (`1234.5`), whatever
 * the text shows, so a server never has to parse a locale. The value is a string like a native `<input
 * type="number">`'s; `valueAsNumber` gives the number (`NaN` when empty). `input` and `change` fire when
 * the committed value changes (a commit, a step or a clear), never for a property write and never for
 * every keystroke. The text is a `role="spinbutton"` with `aria-valuenow` and, with `formatValue`,
 * `aria-valuetext`. [mwg:form-associated-custom-elements] [mwg:validate-input-after-interaction]
 * [mwg:ime-safe-enter-submit] [mwg:accessible-error-announcement]
 *
 * @summary Locale-aware number field with steppers, units and a clear button.
 * @tag tct-number-input
 * @upstream NumberInput
 * @csspart field - The whole field: label, control and status.
 * @csspart label - The label.
 * @csspart description - The description.
 * @csspart label-indicator - The "Required" or "Optional" text.
 * @csspart label-tip - The info-tip button.
 * @csspart label-icon - The icon before the label text.
 * @csspart input - The painted box around the control.
 * @csspart control - The native text input.
 * @csspart start-icon - The start icon.
 * @csspart units - The units text.
 * @csspart steppers - The column of stepper buttons.
 * @csspart stepper-increment - The increment button.
 * @csspart stepper-decrement - The decrement button.
 * @csspart status-icon - The status icon inside the box.
 * @csspart status-button - The status button of the `tooltip` status variant.
 * @csspart status - The status message box.
 * @cssstate user-invalid - Invalidity is displayed (after a commit, a submit attempt or `reportValidity()`, and at once for unreadable text).
 * @cssstate invalid - The value does not satisfy its constraints (not displayed).
 * @cssstate busy - `loading` is set.
 * @fires input - Native, when the committed value changes by a commit, a step or a clear; composed.
 * @fires change - Native, once after `input`; composed and dispatched from the host.
 * @fires tct-enter - The user pressed an unmodified Enter (never one that commits an IME conversion), after the draft was committed; cancelable, and preventing it stops the form's implicit submission.
 * @fires tct-clear - The user pressed the clear button; cancelable, and preventing it keeps the value.
 * @cloakDisplay block
 * @cloakMinBlockSize 4.5rem
 */
export class TctNumberInput extends TctBoxControl {
  static override readonly tagName = 'tct-number-input';
  static override readonly dependencies: readonly TctElementConstructor[] = [
    ...TctBoxControl.dependencies,
    TctInputClearButton,
  ];
  static override styles: CSSResultGroup = [TctBoxControl.styles, styles];

  /** The smallest value: a smaller entry is committed as this. */
  @property({type: Number}) min: number | undefined;

  /** The largest value: a larger entry is committed as this. */
  @property({type: Number}) max: number | undefined;

  /** The amount an arrow key, the wheel or a stepper button changes the value by. Default 1. */
  @property({type: Number}) step: number | undefined;

  /** Only whole numbers: the numeric keypad on touch devices, and a fraction is not accepted. */
  @property({type: Boolean, reflect: true, attribute: 'integer-only'}) integerOnly = false;

  /** Text after the number (`%`, `GB`), also part of the field's description. */
  @property() units = '';

  /** Shows a clear (x) button while there is a value: it clears, fires `tct-clear` and returns focus. */
  @property({type: Boolean, attribute: 'has-clear'}) hasClear = false;

  /** Shows increment and decrement buttons at the end of the field. They are not tab stops. */
  @property({type: Boolean, attribute: 'has-steppers'}) hasSteppers = false;

  /** Turns off stepping with the mouse wheel over the focused field. */
  @property({type: Boolean, attribute: 'no-wheel'}) noWheel = false;

  /** Name of an icon shown at the start of the field (a registered icon such as `search`). */
  @property({attribute: 'start-icon'}) startIcon = '';

  /** The native `autocomplete` attribute, forwarded to the input unchanged. */
  @property() autocomplete = '';

  /**
   * Formats the committed number for display while the field is not being edited (`(n) => n + ' GB'`).
   * The plain editable number shows while the field has focus, and the submitted value is unaffected.
   */
  @property({attribute: false}) formatValue: NumberFormatter | undefined;

  /**
   * The value as a plain number string (`"1234.5"`), or `""`. Reads the `value` attribute until set. Text
   * that is not a number is `""`, as on a native number input.
   */
  @property({attribute: false})
  override get value(): string {
    return TctNumberInput.#sanitize(super.value);
  }
  override set value(value: string | number | null | undefined) {
    this.#draft = null;
    super.value = TctNumberInput.#sanitize(value);
  }

  /** The value as a number, `NaN` while empty. */
  get valueAsNumber(): number {
    const value = this.value;
    return value === '' ? NaN : Number(value);
  }
  set valueAsNumber(value: number) {
    this.value = Number.isFinite(value) ? String(value) : '';
  }

  readonly #locale = new LocaleController(this, {
    namespace: 'numberInput',
    defaults: {...numberInputMessages, ...numberInputExtra, ...inputMessages},
  });
  #draft: Draft = null;
  #focused = false;

  static #sanitize(value: string | number | null | undefined): string {
    const text = String(value ?? '').trim();
    if (text === '') return '';
    return Number.isFinite(Number(text)) ? text : '';
  }

  // ------------------------------------------------------------------------------ mixin hooks

  protected override get formControl(): HTMLInputElement | null {
    return this.renderRoot.querySelector<HTMLInputElement>('input.input');
  }

  /** The number field submits the form on Enter (after committing what was typed). */
  protected override get submitsOnEnter(): boolean {
    return true;
  }

  protected override get validators(): Validator<this>[] {
    return [
      (field) =>
        !field.#draftIsValid
          ? {
              flags: {badInput: true},
              message: field.#locale.t('@tct.number-input.invalidNumber'),
            }
          : null,
      (field) =>
        field.required && !field.optional && field.value === '' && field.#draftBlank
          ? {flags: {valueMissing: true}, message: TctNumberInput.#missingMessage()}
          : null,
      (field) => {
        const number = field.valueAsNumber;
        const min = finite(field.min);
        const max = finite(field.max);
        if (min !== undefined && number < min) {
          return {flags: {rangeUnderflow: true}, message: rangeMessage('min', min)};
        }
        if (max !== undefined && number > max) {
          return {flags: {rangeOverflow: true}, message: rangeMessage('max', max)};
        }
        return null;
      },
    ];
  }

  static #missingMessage(): string {
    const probe = document.createElement('input');
    probe.required = true;
    return probe.validationMessage || 'Please fill out this field.';
  }

  protected override formResetValue(): void {
    this.#draft = null;
    super.formResetValue();
  }

  /** Text that cannot be read as a number is invalid at once (it would be dropped when the field is left). */
  override get showInvalid(): boolean {
    return super.showInvalid || !this.#draftIsValid;
  }

  /** Unreadable text has no visible message (the muted text and `aria-invalid` say it, once announced). */
  protected override get effectiveStatus(): InputStatus | undefined {
    if (!this.statusType && !this.#draftIsValid) return undefined;
    return super.effectiveStatus;
  }

  protected override get helperIds(): string[] {
    return [...super.helperIds, this.ids.id('units')];
  }

  /** Focuses the input itself (not the first stepper). */
  override focus(options?: FocusOptions): void {
    const control = this.formControl;
    if (control) control.focus(options);
    else super.focus(options);
  }

  /** Selects the text of the input. */
  select(): void {
    this.formControl?.select();
  }

  // ---------------------------------------------------------------------------------- derived

  get #locales(): string {
    return this.#locale.locale;
  }

  /** The committed value as a number, or `null` when empty. */
  get #number(): number | null {
    const number = this.valueAsNumber;
    return Number.isNaN(number) ? null : number;
  }

  get #draftBlank(): boolean {
    return this.#draft === null || this.#draft.trim() === '';
  }

  /** The draft parses as a number inside the range and (with `integer-only`) is whole; blank text is fine. */
  get #draftIsValid(): boolean {
    if (this.#draftBlank) return true;
    return (
      parseNumberInput(this.#draft ?? '', {
        min: finite(this.min),
        max: finite(this.max),
        integerOnly: this.integerOnly,
        locale: this.#locales,
      }) !== null
    );
  }

  /** The number steps start from: the readable draft, else the committed value. */
  get #steppingFrom(): number | null {
    if (this.#draft === null) return this.#number;
    if (this.#draft.trim() === '') return null;
    return (
      parseNumberInput(this.#draft, {
        min: finite(this.min),
        max: finite(this.max),
        integerOnly: this.integerOnly,
        locale: this.#locales,
      }) ?? this.#number
    );
  }

  #nextValue(direction: StepDirection): number | null {
    return steppedValue({
      currentValue: this.#steppingFrom,
      direction,
      min: finite(this.min),
      max: finite(this.max),
      step: finite(this.step),
      integerOnly: this.integerOnly,
    });
  }

  /** The text in the field: the draft while editing, the plain number while focused, else the formatted one. */
  get #displayText(): string {
    if (this.#draft !== null) return this.#draft;
    const number = this.#number;
    if (number === null) return '';
    if (this.#focused) return formatEditableNumber(number, this.#locales);
    return this.formatValue?.(number) ?? formatEditableNumber(number, this.#locales);
  }

  get #stepsBlocked(): boolean {
    return this.isDisabled || this.readonly;
  }

  // ---------------------------------------------------------------------------------- lifecycle

  protected override firstUpdated(): void {
    // A native, non-passive listener: the page must not scroll while the wheel steps the value.
    this.formControl?.addEventListener('wheel', this.#onWheel, {passive: false});
    if (!this.hasAttribute('autofocus')) return;
    void this.updateComplete.then(() => {
      this.focus({preventScroll: true});
    });
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed);
    if (changed.has('min') || changed.has('max') || changed.has('integerOnly')) {
      const min = finite(this.min);
      const max = finite(this.max);
      if (min !== undefined && max !== undefined && min > max) {
        devWarn(
          `${this.localName}:min-max`,
          `min (${min}) is greater than max (${max}); an entry returns to the last value.`,
        );
      }
    }
  }

  // -------------------------------------------------------------------------------- rendering

  override render() {
    return this.renderFieldLayout(this.renderBoxWrapper(this.#renderContent()));
  }

  #renderContent(): TemplateResult {
    const status = this.effectiveStatus;
    const inert = this.showsDisabledMessage;
    const disabled = this.isDisabled;
    const number = this.#number;
    const min = finite(this.min);
    const max = finite(this.max);
    const showClear = this.hasClear && this.value !== '' && !disabled && !this.readonly;
    const formatted = number !== null && this.formatValue ? this.formatValue(number) : undefined;
    return html`
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
      <input
        class="input"
        part="control"
        type="text"
        role="spinbutton"
        inputmode=${this.integerOnly ? 'numeric' : 'decimal'}
        .value=${live(this.#displayText)}
        placeholder=${ifDefined(this.placeholder || undefined)}
        autocomplete=${ifDefined(this.autocomplete || undefined)}
        spellcheck="false"
        ?disabled=${disabled && !inert}
        ?readonly=${this.readonly || inert}
        aria-disabled=${ifDefined(inert ? 'true' : undefined)}
        aria-required=${ifDefined(
          (this.required && !this.optional) || (!this.required && this.announcesRequired)
            ? 'true'
            : undefined,
        )}
        aria-valuemin=${ifDefined(min)}
        aria-valuemax=${ifDefined(max)}
        aria-valuenow=${ifDefined(number ?? undefined)}
        aria-valuetext=${ifDefined(formatted)}
        aria-busy=${ifDefined(this.busy ? 'true' : undefined)}
        aria-labelledby=${ifDefined(this.groupLabelId)}
        @input=${this.#onInput}
        @focus=${this.#onFocus}
        @blur=${this.#onBlur}
        @keydown=${this.#onKeyDown}
      />
      ${
        this.units
          ? html`<span class="units" part="units" id=${this.ids.id('units')}>${this.units}</span>`
          : nothing
      }
      ${
        showClear
          ? html`<tct-input-clear-button
              label=${this.#locale.t('@astryx.numberInput.clearLabel', {label: this.label})}
              @click=${this.#onClear}
            ></tct-input-clear-button>`
          : nothing
      }
      ${this.renderBusy()}${status ? this.renderStatusIcon() : nothing}
      ${this.hasSteppers ? this.#renderSteppers() : nothing}
    `;
  }

  #renderSteppers(): TemplateResult {
    const blocked = this.#stepsBlocked;
    const from = this.#steppingFrom;
    const canIncrement = !blocked && this.#nextValue(1) !== from;
    const canDecrement = !blocked && this.#nextValue(-1) !== from;
    return html`<div class="steppers" part="steppers">
      <button
        type="button"
        class="stepper stepper-increment"
        part="stepper-increment"
        tabindex="-1"
        ?disabled=${!canIncrement}
        aria-label=${this.#locale.t('@astryx.numberInput.incrementLabel', {label: this.label})}
        @pointerdown=${this.#keepFocus}
        @click=${() => {
          this.#stepFromButton(1);
        }}
      >
        <tct-icon name="numberInput:stepperDown" size="xsm" color="inherit"></tct-icon>
      </button>
      <button
        type="button"
        class="stepper stepper-decrement"
        part="stepper-decrement"
        tabindex="-1"
        ?disabled=${!canDecrement}
        aria-label=${this.#locale.t('@astryx.numberInput.decrementLabel', {label: this.label})}
        @pointerdown=${this.#keepFocus}
        @click=${() => {
          this.#stepFromButton(-1);
        }}
      >
        <tct-icon name="numberInput:stepperDown" size="xsm" color="inherit"></tct-icon>
      </button>
    </div>`;
  }

  // ---------------------------------------------------------------------------------- events

  /** Typing only changes the draft: the inner `input` event does not leave the field. */
  readonly #onInput = (event: Event): void => {
    event.stopPropagation();
    if (this.#stepsBlocked || this.showsDisabledMessage) return;
    const input = event.target as HTMLInputElement;
    this.#setDraft(input.value);
  };

  readonly #onFocus = (): void => {
    this.#focused = true;
    this.requestUpdate();
  };

  readonly #onBlur = (): void => {
    this.#commit('blur');
    this.#focused = false;
    this.requestUpdate();
  };

  readonly #onKeyDown = (event: KeyboardEvent): void => {
    // The Enter that commits an IME candidate, and the arrows that walk its window, are not commands.
    if (isImeKeyEvent(event)) return;
    const modified = event.altKey || event.ctrlKey || event.metaKey || event.shiftKey;
    if (!modified && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
      event.preventDefault();
      this.#step(event.key === 'ArrowUp' ? 1 : -1);
      return;
    }
    if (event.key === 'Enter' && !modified) {
      this.#commit('Enter');
      if (!this.dispatch(new TctEnterEvent())) event.preventDefault();
    }
  };

  readonly #onWheel = (event: WheelEvent): void => {
    const control = this.formControl;
    // Bail before preventDefault so a field that cannot step never swallows the page scroll.
    if (
      this.noWheel ||
      !control ||
      this.shadowRoot?.activeElement !== control ||
      this.#stepsBlocked ||
      event.deltaY === 0 ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey
    ) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    this.#step(event.deltaY < 0 ? 1 : -1);
  };

  readonly #keepFocus = (event: Event): void => {
    event.preventDefault();
  };

  #stepFromButton(direction: StepDirection): void {
    this.formControl?.focus();
    this.#step(direction);
  }

  readonly #onClear = (event: MouseEvent): void => {
    if (!this.dispatch(new TctClearEvent())) return;
    this.#draft = null;
    this.#commitValue('');
    const control = this.formControl;
    if (!control) return;
    // Keyboard: focus is restored synchronously, before the button leaves the DOM. Pointer: after the
    // button's own task, so touch browsers do not jump the page scroll (iOS Safari).
    if (event.detail === 0) control.focus();
    else requestAnimationFrame(() => control.focus({preventScroll: true}));
  };

  // ------------------------------------------------------------------------ draft and commit

  /** Keeps `text` as the draft, and says (once) when it stops being a number. */
  #setDraft(text: string): void {
    const wasValid = this.#draftIsValid;
    this.#draft = text;
    this.syncFormState();
    this.requestUpdate();
    if (wasValid && !this.#draftIsValid) {
      announce(this.#locale.t('@tct.number-input.invalidNumber'), {
        politeness: 'assertive',
        element: this,
      });
    }
  }

  /**
   * Turns the draft into the value: text that is empty clears (with `has-clear`, else the value returns),
   * unreadable text returns to the last value, everything else is clamped into range. Blur always ends
   * the draft; Enter keeps text that could not be committed so the person can fix it.
   */
  #commit(trigger: 'blur' | 'Enter'): void {
    const draft = this.#draft;
    if (draft === null) return;
    const decision = resolveNumberInputCommit(draft, {
      min: finite(this.min),
      max: finite(this.max),
      integerOnly: this.integerOnly,
      locale: this.#locales,
      clearable: this.hasClear,
    });
    if (trigger === 'blur' || (decision.type === 'commit' && decision.didClamp)) {
      this.#draft = null;
    }
    if (decision.type === 'clear') {
      if (this.hasClear && this.value !== '') this.#commitValue('');
    } else if (decision.type === 'commit' && decision.value !== this.#number) {
      this.#commitValue(String(decision.value));
    }
    this.syncFormState();
    this.requestUpdate();
  }

  #step(direction: StepDirection): void {
    if (this.#stepsBlocked) return;
    const next = this.#nextValue(direction);
    if (next === null) return;
    this.#draft = null;
    if (next !== this.#number) this.#commitValue(String(next));
    else {
      this.syncFormState();
      this.requestUpdate();
    }
  }

  /** Sets the value for the user: `input`, then `change`, like a native control's discrete commit. */
  #commitValue(next: string): void {
    if (TctNumberInput.#sanitize(next) === this.value) {
      this.#draft = null;
      return;
    }
    this.value = next;
    this.syncFormState();
    this.dispatchEvent(new Event('input', {bubbles: true, composed: true}));
    this.redispatchChange();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-number-input': TctNumberInput;
  }
}
