import {html, nothing, type CSSResultGroup, type PropertyValues, type TemplateResult} from 'lit';
import {property} from 'lit/decorators.js';
import {ifDefined} from 'lit/directives/if-defined.js';
import {live} from 'lit/directives/live.js';
import dateInputMessages from '@tecton-wc/locales/en/dateInput.js';
import dateTimeInputMessages from '@tecton-wc/locales/en/dateTimeInput.js';
import fieldMessages from '@tecton-wc/locales/en/field.js';
import inputMessages from '@tecton-wc/locales/en/input.js';
import timeInputMessages from '@tecton-wc/locales/en/timeInput.js';
import {announce} from '@tecton-wc/core/a11y/announcer.js';
import {
  adjustTime,
  compareTime,
  createISOTimeString,
  formatDisplayTime12h,
  formatDisplayTime24h,
  formatISOTime,
  isTimeInRange,
  parseISOTime,
  parseTimeInput,
} from '@tecton-wc/core/date/time-parser.js';
import {TctEnterEvent} from '@tecton-wc/core/events/tct-enter.js';
import {nativeMessage} from '@tecton-wc/core/forms/validators.js';
import {LocaleController} from '@tecton-wc/core/i18n/locale-controller.js';
import type {Validator} from '@tecton-wc/core/mixins/form-control.js';
import {devWarn} from '@tecton-wc/core/utils/dev.js';
import {isImeKeyEvent} from '@tecton-wc/core/utils/ime.js';
import type {InputStatus} from '../field/field.types.js';
import {DraftEntry} from '../date-input/draft-entry.js';
import {
  TIME_PRESENTATIONS,
  type LegacyNativePicker,
  type PickerSurface,
} from '../date-input/picker-presentation.js';
import {TctPickerField} from '../date-input/tct-picker-field.js';
import {TIME_HOUR_FORMATS, type TimeHourFormat} from './time-input.types.js';

/** The browser's localized message for a time outside `min` or `max`, from a probe input. */
function rangeMessage(kind: 'min' | 'max', bound: string): string {
  const probe = document.createElement('input');
  probe.type = 'time';
  const outside = adjustTime(bound, kind === 'min' ? -1 : 1);
  // A bound at the edge of the day has no time beyond it to probe with.
  if (compareTime(outside, bound) === 0 || (kind === 'min' ? outside > bound : outside < bound)) {
    return nativeMessage('invalid');
  }
  probe[kind] = bound;
  probe.value = outside;
  return probe.validationMessage || nativeMessage('invalid');
}

/**
 * A time field: type a time or step it with the arrow keys. The typed text reads what people write in their
 * language (`2:30 PM`, `2:30pm`, `14:30`, `1430`, `2pm`, `٢:٣٠ م`); Arrow Up and Down step it by `increment`
 * minutes (wrapping past midnight) and announce the new time. The committed time is shown as 12-hour or
 * 24-hour text (`hour-format`), and is stored, submitted and read back as a wall-clock `HH:MM` (with
 * `has-seconds`, `HH:MM:SS`) whatever the locale: it names no day and no time zone. On a device with a coarse
 * pointer it is the browser's own time input (`presentation`), and as a bottom sheet with hour, minute and AM/PM
 * columns when asked for.
 *
 * It is a form-associated element that submits the time (or an empty string for an empty field), resets to its
 * `value` attribute and restores like a native input. `input` and `change` fire when the committed time changes
 * (a step, a pick, a clear, or typed text when the entry ends by Enter or by leaving the field); nothing fires
 * for a property or attribute write. Text that is not a time, or a time `min` and `max` rule out, is
 * `aria-invalid` and announced while it stands and is dropped when the field is left. Invalidity of the
 * committed value (`required`, `min`, `max`) shows after the user acted or a submit attempt.
 * [mwg:model-partial-time-concepts] [mwg:validate-input-after-interaction]
 * [mwg:form-associated-custom-elements] [mwg:ime-safe-enter-submit] [mwg:accessible-error-announcement]
 *
 * @summary Time field: type a time or step it with the arrow keys; native or bottom-sheet pickers on touch.
 * @tag tct-time-input
 * @upstream TimeInput
 * @csspart field - The whole field: label, control and status.
 * @csspart label - The label.
 * @csspart description - The description.
 * @csspart label-indicator - The "Required" or "Optional" text.
 * @csspart label-tip - The info-tip button.
 * @csspart label-icon - The icon before the label text.
 * @csspart input - The painted box around the control.
 * @csspart control - The typed text input, or the native time input.
 * @csspart toggle - The clock button that opens the bottom sheet.
 * @csspart sheet - The bottom sheet of the touch presentation.
 * @csspart panel - The time columns inside the sheet.
 * @csspart status-icon - The status icon inside the box.
 * @csspart status-button - The status button of the `tooltip` status variant.
 * @csspart status - The status message box.
 * @cssstate open - The bottom sheet is open.
 * @cssstate user-invalid - Invalidity is displayed.
 * @cssstate invalid - The value does not satisfy its constraints (not displayed).
 * @cssstate busy - A `changeAction` is pending or `loading` is set.
 * @fires input - Native, when the committed time changes; composed.
 * @fires change - Native, when the change is committed; composed and dispatched from the host.
 * @fires tct-enter - The user pressed an unmodified Enter (never one that commits an IME conversion), after the draft was committed; cancelable, and preventing it stops the form's implicit submission.
 * @fires tct-clear - The user pressed the clear button; cancelable, and preventing it keeps the value.
 * @fires {TctOpenChangeEvent} tct-open-change - Before the user opens or closes the bottom sheet; cancelable.
 * @fires {TctAfterOpenChangeEvent} tct-after-open-change - After the bottom sheet opened or closed and settled.
 * @cloakDisplay block
 * @cloakMinBlockSize 4.5rem
 */
export class TctTimeInput extends TctPickerField {
  static override readonly tagName = 'tct-time-input';
  static override styles: CSSResultGroup = TctPickerField.styles;

  /** Shows a clear (x) button while there is a value; it clears, fires `tct-clear` and returns focus. */
  @property({type: Boolean, attribute: 'has-clear'}) hasClear = false;

  /**
   * Deprecated: use `presentation` (`touch` is `adaptive-native`, `always` is `native`, `never` is
   * `text-input`). `presentation` wins when both are set.
   */
  @property({attribute: 'native-picker'}) nativePicker: LegacyNativePicker | undefined;

  /** Earliest time, `HH:MM` or `HH:MM:SS`. A native constraint: an earlier value is `rangeUnderflow`, and a typed or stepped time before it is refused. */
  @property() min: string | undefined;

  /** Latest time, `HH:MM` or `HH:MM:SS`. A native constraint: a later value is `rangeOverflow`, and a typed or stepped time after it is refused. */
  @property() max: string | undefined;

  /** Whether the time has seconds (`HH:MM:SS`). */
  @property({type: Boolean, attribute: 'has-seconds'}) hasSeconds = false;

  /** `12h` (default, "2:30 PM") or `24h` ("14:30"): how the committed time is displayed. */
  @property({attribute: 'hour-format'}) hourFormat: TimeHourFormat = '12h';

  /** Minutes the arrow keys step by. Default 1. */
  @property({type: Number}) increment = 1;

  /**
   * The time as `HH:MM` (or `HH:MM:SS`), or `""`. Text that is not a real time reads as `""`. The `value`
   * attribute is the default a form reset restores.
   */
  @property({attribute: false})
  override get value(): string {
    return TctTimeInput.#sanitize(super.value);
  }
  override set value(value: string) {
    if (!this.#userWrite) this.#entry.drop();
    super.value = TctTimeInput.#sanitize(value);
  }

  readonly #locale: LocaleController = new LocaleController(this, {
    namespace: 'timeInput',
    defaults: {
      ...timeInputMessages,
      ...dateTimeInputMessages,
      ...dateInputMessages,
      ...inputMessages,
      ...fieldMessages,
    },
  });
  #userWrite = false;
  #focused = false;
  #rejected: string | null = null;

  /** The text being typed, until the entry ends (see {@link DraftEntry}). */
  readonly #entry: DraftEntry = new DraftEntry({
    host: this,
    issueOf: (text) => (this.#parse(text) === null ? 'unreadable' : null),
    messageFor: () => this.#locale.t('@tct.timeInput.invalidTime'),
    apply: (text) => {
      const parsed = this.#parse(text);
      if (parsed && parsed !== this.value) this.commitValue(parsed, {commit: false});
    },
    clear: () => {
      if (this.value !== '') this.commitValue('', {commit: false});
    },
    changed: () => {
      this.requestUpdate();
      this.syncFormState();
    },
  });

  static #sanitize(value: string | null | undefined): string {
    return createISOTimeString(String(value ?? '').trim()) ?? '';
  }

  protected override sanitize(value: string): string {
    return TctTimeInput.#sanitize(value);
  }

  /** Typed text as a time inside `min`..`max`, or `null`. */
  #parse(text: string): string | null {
    const parsed = parseTimeInput(text, this.hasSeconds, this.#locale.locale);
    return parsed && isTimeInRange(parsed, this.min, this.max) ? parsed : null;
  }

  // ------------------------------------------------------------------------------ mixin hooks

  protected override get pickerKind(): 'time' {
    return 'time';
  }

  protected override get legacyNativePicker(): LegacyNativePicker | undefined {
    return this.nativePicker;
  }

  /**
   * The surface in effect: the browser's own picker cannot show seconds or step by `increment`, so a coarse
   * pointer that would get it keeps the typed field then; an explicit `presentation="native"` is never
   * replaced.
   */
  protected override get surface(): PickerSurface {
    const surface = super.surface;
    if (surface !== 'native' || this.presentation === 'native') return surface;
    return !this.hasSeconds && this.increment === 1 ? 'native' : 'text-input';
  }

  protected override get formControl(): HTMLInputElement | null {
    return this.renderRoot.querySelector<HTMLInputElement>('input.input');
  }

  /** A time field submits the form on Enter (after committing what was typed). */
  protected override get submitsOnEnter(): boolean {
    return true;
  }

  protected override get validators(): Validator<this>[] {
    return [
      (field) =>
        field.#entry.issue !== null
          ? {flags: {badInput: true}, message: field.#locale.t('@tct.timeInput.invalidTime')}
          : null,
      (field) =>
        field.required && !field.optional && field.value === ''
          ? {flags: {valueMissing: true}, message: nativeMessage('text')}
          : null,
      (field) => {
        if (!field.value) return null;
        if (field.min && parseISOTime(field.min) && compareTime(field.value, field.min) < 0) {
          return {flags: {rangeUnderflow: true}, message: rangeMessage('min', field.min)};
        }
        if (field.max && parseISOTime(field.max) && compareTime(field.value, field.max) > 0) {
          return {flags: {rangeOverflow: true}, message: rangeMessage('max', field.max)};
        }
        return null;
      },
    ];
  }

  protected override formResetValue(): void {
    this.#entry.drop();
    this.#rejected = null;
    this.forgetPendingChange();
    super.formResetValue();
  }

  /** Text that is not an available time is invalid once the typing has paused (it is dropped when the field is left). */
  override get showInvalid(): boolean {
    return super.showInvalid || this.#entry.surfaced !== null;
  }

  /** An unreadable draft has no visible message (the muted text and `aria-invalid` say it, once announced). */
  protected override get effectiveStatus(): InputStatus | undefined {
    if (!this.statusType && (this.#entry.surfaced !== null || this.#rejected !== null)) {
      return undefined;
    }
    return super.effectiveStatus;
  }

  /** Focuses the input itself. */
  override focus(options?: FocusOptions): void {
    const control = this.formControl;
    if (control) control.focus(options);
    else super.focus(options);
  }

  /** Selects the text of the input. */
  select(): void {
    this.formControl?.select();
  }

  protected override commitValue(next: string, options: {commit?: boolean} = {}): boolean {
    this.#userWrite = true;
    try {
      return super.commitValue(next, options);
    } finally {
      this.#userWrite = false;
    }
  }

  protected override clearValue(): void {
    this.#entry.drop();
    this.commitValue('');
  }

  protected override warnEnum(name: string, value: string): void {
    devWarn(
      `time-input:${name}:${value}`,
      `${name} "${value}" is not one of ${TIME_PRESENTATIONS.join(', ')}.`,
    );
  }

  // ---------------------------------------------------------------------------------- derived

  get #format(): (time: string) => string {
    const locale = this.#locale.locale;
    return this.hourFormat === '24h'
      ? (time) => formatDisplayTime24h(time, this.hasSeconds, locale)
      : (time) => formatDisplayTime12h(time, this.hasSeconds, locale);
  }

  get #displayText(): string {
    if (this.#entry.text !== null) return this.#entry.text;
    return this.value ? this.#format(this.value) : '';
  }

  get #placeholderText(): string {
    if (this.placeholder) return this.placeholder;
    // A focused, empty field shows what to type.
    if (this.#focused && !this.#displayText && this.surface === 'text-input' && this.canEdit) {
      return this.#locale.t(
        this.hourFormat === '24h'
          ? '@tct.dateTimeInput.timeHint24h'
          : '@tct.dateTimeInput.timeHint12h',
      );
    }
    return this.#locale.t('@tct.timeInput.placeholder');
  }

  /** The current wall-clock time, as the field would store it. */
  #now(): string {
    const now = new Date();
    return formatISOTime(
      {hour: now.getHours(), minute: now.getMinutes(), second: now.getSeconds()},
      this.hasSeconds,
    );
  }

  // --------------------------------------------------------------------------------- picker hooks

  protected override get dialogLabel(): string {
    return this.label;
  }

  protected override get toggleLabel(): string {
    return this.#locale.t('@tct.timeInput.openPicker', {label: this.label});
  }

  protected override get closeLabel(): string {
    return this.#locale.t('@tct.dateInput.closeCalendar');
  }

  protected override get clearLabel(): string {
    return this.#locale.t('@tct.timeInput.clearLabel', {label: this.label});
  }

  protected override get toggleIcon(): string {
    return 'clock';
  }

  protected override renderPickerContent(): TemplateResult {
    return html`<div class="sheet-body">
      <tct-time-panel
        class="panel"
        part="panel"
        data-autofocus
        .value=${this.value}
        min=${ifDefined(this.min)}
        max=${ifDefined(this.max)}
        hour-format=${this.hourFormat === '24h' ? '24h' : '12h'}
        ?has-seconds=${this.hasSeconds}
        @change=${this.#onPanelChange}
      ></tct-time-panel>
      <tct-button
        class="save"
        variant="primary"
        width="100%"
        label=${this.#locale.t('@tct.dateInput.savePicking')}
        @click=${this.#onSave}
      ></tct-button>
    </div>`;
  }

  /** The panel picks live, like the wheels of upstream: every pick is a change, Save only closes the sheet. */
  readonly #onPanelChange = (event: Event): void => {
    event.stopPropagation();
    const panel = event.currentTarget as HTMLElement & {value: string};
    this.#entry.drop();
    this.commitValue(panel.value);
  };

  readonly #onSave = (): void => {
    this.requestOpen(false, 'selection');
  };

  // ---------------------------------------------------------------------------------- lifecycle

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed);
    if (
      changed.has('hourFormat') &&
      !(TIME_HOUR_FORMATS as readonly string[]).includes(this.hourFormat)
    ) {
      devWarn(
        `time-input:hour-format:${this.hourFormat}`,
        `hour-format "${this.hourFormat}" is not one of ${TIME_HOUR_FORMATS.join(', ')}; using "12h".`,
      );
    }
    if ((changed.has('min') || changed.has('max')) && this.min && this.max && this.min > this.max) {
      devWarn(`time-input:min-max`, `min (${this.min}) is after max (${this.max}).`);
    }
    if (changed.has('increment') && !(this.increment > 0)) {
      devWarn(
        `time-input:increment`,
        `increment ${String(this.increment)} must be a positive number of minutes.`,
      );
    }
  }

  protected override firstUpdated(): void {
    if (!this.hasAttribute('autofocus')) return;
    void this.updateComplete.then(() => {
      this.focus({preventScroll: true});
    });
  }

  // -------------------------------------------------------------------------------- rendering

  override render() {
    const surface = this.surface;
    const disabled = this.isDisabled;
    const inert = this.showsDisabledMessage;
    const content = html`
      ${
        surface === 'sheet'
          ? this.renderToggle()
          : html`<tct-icon
              class="clock"
              part="clock"
              name="clock"
              size="sm"
              color="secondary"
            ></tct-icon>`
      }
      ${
        surface === 'native'
          ? this.#renderNative(disabled, inert)
          : surface === 'sheet'
            ? this.#renderSheetField(disabled, inert)
            : this.#renderTyped(disabled, inert)
      }
      ${this.renderClear(this.hasClear && this.value !== '')}
      ${this.renderBusy()}${this.effectiveStatus ? this.renderStatusIcon() : nothing}
    `;
    return this.renderFieldLayout(
      html`${this.renderBoxWrapper(content)}${this.renderPickerSurface()}`,
    );
  }

  #ariaRequired(): string | undefined {
    return (this.required && !this.optional) || (!this.required && this.announcesRequired)
      ? 'true'
      : undefined;
  }

  #renderTyped(disabled: boolean, inert: boolean): TemplateResult {
    return html`<input
      class="input"
      part="control"
      type="text"
      .value=${live(this.#displayText)}
      placeholder=${this.#placeholderText}
      autocomplete="off"
      spellcheck="false"
      ?disabled=${disabled && !inert}
      ?readonly=${this.readonly || inert}
      aria-disabled=${ifDefined(inert ? 'true' : undefined)}
      aria-required=${ifDefined(this.#ariaRequired())}
      aria-busy=${ifDefined(this.busy ? 'true' : undefined)}
      aria-labelledby=${ifDefined(this.groupLabelId)}
      @input=${this.#onInput}
      @focus=${this.#onFocus}
      @blur=${this.#onBlur}
      @keydown=${this.#onKeyDown}
    />`;
  }

  /** A read-only field that opens the bottom sheet: the time is chosen in the columns, not typed. */
  #renderSheetField(disabled: boolean, inert: boolean): TemplateResult {
    return html`<input
      class="input"
      part="control"
      type="text"
      role="combobox"
      readonly
      inputmode="none"
      .value=${live(this.#displayText)}
      placeholder=${this.#placeholderText}
      autocomplete="off"
      ?disabled=${disabled && !inert}
      aria-disabled=${ifDefined(inert ? 'true' : undefined)}
      aria-required=${ifDefined(this.#ariaRequired())}
      aria-busy=${ifDefined(this.busy ? 'true' : undefined)}
      aria-expanded=${this.open ? 'true' : 'false'}
      aria-haspopup="dialog"
      aria-autocomplete="none"
      aria-labelledby=${ifDefined(this.groupLabelId)}
      @click=${this.#onSheetFieldClick}
      @keydown=${this.#onSheetFieldKeyDown}
    />`;
  }

  /**
   * The native control: a real `<input type="time">` the platform draws, with the field's own text painted
   * over it while it is not focused, so `hour-format` and the placeholder still apply; on focus the platform's
   * editable segments (or, on a touch device, its picker) show through.
   */
  #renderNative(disabled: boolean, inert: boolean): TemplateResult {
    const overlay = this.value ? this.#format(this.value) : this.#placeholderText;
    return html`<span class="native-slot">
      <input
        class="input native"
        part="control"
        type="time"
        .value=${live(this.value)}
        min=${ifDefined(this.min)}
        max=${ifDefined(this.max)}
        step=${ifDefined(this.hasSeconds ? '1' : undefined)}
        ?required=${this.required && !this.optional}
        ?disabled=${disabled && !inert}
        ?readonly=${this.readonly || inert}
        aria-disabled=${ifDefined(inert ? 'true' : undefined)}
        aria-required=${ifDefined(this.#ariaRequired())}
        aria-busy=${ifDefined(this.busy ? 'true' : undefined)}
        aria-labelledby=${ifDefined(this.groupLabelId)}
        @input=${this.#onNativeInput}
        @change=${this.#onNativeChange}
        @blur=${this.#onNativeBlur}
      />
      <span
        class="native-overlay"
        part="overlay"
        aria-hidden="true"
        ?data-placeholder=${!this.value}
        >${overlay}</span
      >
    </span>`;
  }

  // ---------------------------------------------------------------------------------- typed events

  /** Typing only changes the draft: the inner `input` event does not leave the field. */
  readonly #onInput = (event: Event): void => {
    event.stopPropagation();
    if (!this.canEdit || this.showsDisabledMessage) return;
    this.#entry.input((event.target as HTMLInputElement).value);
  };

  readonly #onFocus = (): void => {
    this.#focused = true;
    this.requestUpdate();
  };

  /** Turns the draft into the value: blank clears, a readable time inside the window commits, the rest is dropped. */
  #commitDraft(): void {
    this.#entry.commit();
    this.settleChange();
    this.syncFormState();
    this.requestUpdate();
  }

  readonly #onBlur = (): void => {
    this.#focused = false;
    this.#commitDraft();
  };

  readonly #onKeyDown = (event: KeyboardEvent): void => {
    // The Enter that commits an IME candidate, and the arrows of its window, are not commands.
    if (isImeKeyEvent(event)) return;
    const modified = event.ctrlKey || event.metaKey || event.shiftKey || event.altKey;
    if ((event.key === 'ArrowUp' || event.key === 'ArrowDown') && !modified) {
      event.preventDefault();
      if (this.canEdit && !this.showsDisabledMessage) this.#step(event.key === 'ArrowUp' ? 1 : -1);
      return;
    }
    if (event.key === 'Enter' && !modified) {
      this.#commitDraft();
      if (!this.dispatch(new TctEnterEvent())) event.preventDefault();
    }
  };

  /** Steps the time by `increment` minutes from what the field shows (else from now), inside `min`..`max`. */
  #step(direction: 1 | -1): void {
    const draft = this.#entry.text;
    const shown = draft !== null && draft.trim() !== '' ? this.#parse(draft) : null;
    const base = shown ?? (this.value || this.#now());
    const step = this.increment > 0 ? this.increment : 1;
    const next = adjustTime(base, direction * step, this.hasSeconds);
    if (!isTimeInRange(next, this.min, this.max)) return;
    this.#entry.drop();
    this.commitValue(next);
    // Stepping rewrites the text of a plain textbox, and screen readers do not announce that.
    announce(this.#format(next), {element: this});
    this.requestUpdate();
  }

  // -------------------------------------------------------------------------------- sheet events

  readonly #onSheetFieldClick = (): void => {
    if (!this.canOpen || this.open) return;
    this.openPicker('trigger', true);
  };

  readonly #onSheetFieldKeyDown = (event: KeyboardEvent): void => {
    if (isImeKeyEvent(event) || event.ctrlKey || event.metaKey || event.altKey) return;
    if (['Enter', ' ', 'ArrowDown'].includes(event.key)) {
      event.preventDefault();
      if (this.canOpen && !this.open) this.openPicker('keyboard', true);
    }
  };

  // ---------------------------------------------------------------------------------- native events

  readonly #onNativeInput = (event: Event): void => {
    event.stopPropagation();
    this.#commitNative(event.target as HTMLInputElement, false);
  };

  readonly #onNativeChange = (event: Event): void => {
    event.stopPropagation();
    this.#commitNative(event.target as HTMLInputElement, true);
  };

  #commitNative(control: HTMLInputElement, commit: boolean): void {
    if (!this.canEdit || this.showsDisabledMessage) return;
    const raw = control.value;
    if (raw === '') {
      if (this.value !== '') this.commitValue('', {commit});
      else if (commit) this.settleChange();
      return;
    }
    const time = createISOTimeString(raw);
    if (!time) return;
    // A native picker may not show min and max (iOS treats them as validity flags, not clamps): a refused
    // time is announced and the control snaps back when it loses focus.
    if (!isTimeInRange(time, this.min, this.max)) {
      this.#rejected = raw;
      announce(this.#locale.t('@tct.timeInput.invalidTime'), {
        politeness: 'assertive',
        element: this,
      });
      this.requestUpdate();
      return;
    }
    this.#rejected = null;
    this.commitValue(time, {commit});
    if (commit) this.settleChange();
  }

  readonly #onNativeBlur = (event: Event): void => {
    this.settleChange();
    if (this.#rejected !== null) {
      this.#rejected = null;
      (event.target as HTMLInputElement).value = this.value;
      this.requestUpdate();
    }
  };

  protected override initialPickerFocus(): HTMLElement | null {
    const panel = this.renderRoot.querySelector<HTMLElement>('tct-time-panel');
    return panel?.shadowRoot?.querySelector<HTMLElement>('[role="option"][tabindex="0"]') ?? null;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-time-input': TctTimeInput;
  }
}
