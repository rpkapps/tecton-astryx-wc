import {html, nothing, type CSSResultGroup, type PropertyValues, type TemplateResult} from 'lit';
import {property} from 'lit/decorators.js';
import {ifDefined} from 'lit/directives/if-defined.js';
import {live} from 'lit/directives/live.js';
import dateInputMessages from '@tecton-wc/locales/en/dateInput.js';
import dateInputExtra from '@tecton-wc/locales/en/date-input.js';
import fieldMessages from '@tecton-wc/locales/en/field.js';
import inputMessages from '@tecton-wc/locales/en/input.js';
import {announce} from '@tecton-wc/core/a11y/announcer.js';
import type {DayOfWeek, ISODateString} from '@tecton-wc/core/date/date-types.js';
import {parseDateInput} from '@tecton-wc/core/date/date-parser.js';
import {formatSharedDate, type SharedDateFormat} from '@tecton-wc/core/date/format.js';
import {
  plainDateAddDays,
  plainDateToday,
  plainDateToISO,
  tryPlainDateFromISO,
} from '@tecton-wc/core/date/plain-date.js';
import {TctEnterEvent} from '@tecton-wc/core/events/tct-enter.js';
import {LocaleController} from '@tecton-wc/core/i18n/locale-controller.js';
import {nativeMessage} from '@tecton-wc/core/forms/validators.js';
import type {Validator} from '@tecton-wc/core/mixins/form-control.js';
import type {TctElementConstructor} from '@tecton-wc/core/tct-element.js';
import {devWarn} from '@tecton-wc/core/utils/dev.js';
import {deepActiveElement} from '@tecton-wc/core/utils/focus.js';
import {isImeKeyEvent} from '@tecton-wc/core/utils/ime.js';
import {createCalendarConstraints} from '../calendar/calendar-constraints.js';
import {getInitialFocusDate} from '../calendar/get-initial-focus-date.js';
import {TctCalendar} from '../calendar/tct-calendar.js';
import type {InputStatus} from '../field/field.types.js';
import {oneOf} from '../field/field-utils.js';
import {
  DATE_INPUT_FORMATS,
  type DateInputFormat,
  type DateInputFormatter,
} from './date-input.types.js';
import {DraftEntry, type DraftIssue} from './draft-entry.js';
import {PICKER_PRESENTATIONS, type LegacyNativePicker} from './picker-presentation.js';
import {TctPickerField} from './tct-picker-field.js';

/** The browser's localized message for a date outside `min` or `max`, from a probe input. */
function rangeMessage(kind: 'min' | 'max', bound: string): string {
  const probe = document.createElement('input');
  probe.type = 'date';
  const from = tryPlainDateFromISO(bound);
  if (!from) return nativeMessage('invalid');
  if (kind === 'min') {
    probe.min = bound;
    probe.value = plainDateToISO(plainDateAddDays(from, -1));
  } else {
    probe.max = bound;
    probe.value = plainDateToISO(plainDateAddDays(from, 1));
  }
  return probe.validationMessage || nativeMessage('invalid');
}

/**
 * A date field: type a date or pick it from a calendar. The typed text reads what people write in their
 * language (`Jan 25, 2026`, `25/1/2026`, `٢٥‏/١‏/٢٠٢٦`, `21 במרץ 2026`); the calendar opens under the field
 * (Arrow Down, or a click), and on a compact touch device as a bottom sheet. The committed date is shown in
 * the language of the element in the `format` you choose and is stored, submitted and read back as
 * `YYYY-MM-DD`, whatever the locale, calendar or time zone.
 *
 * It is a form-associated element that submits the ISO date (`2026-01-25`, or an empty string for an empty field),
 * resets to its `value` attribute and restores like a native input. The value is a string, like a native
 * `<input type="date">`'s. `input` fires when the committed date changes (typing a complete date, a pick,
 * a clear), `change` once when the edit is committed (Enter, leaving the field, a pick); nothing fires for a
 * property or attribute write. Text that is not a date, or a date `min`, `max` or `dateConstraints` rule
 * out, is `aria-invalid` and announced while it stands and is dropped when the field is left. Invalidity of
 * the committed value (`required`, `min`, `max`) shows after the user acted: a change, leaving the field
 * after an edit, or a submit attempt. [mwg:capture-location-agnostic-data]
 * [mwg:support-global-calendar-systems] [mwg:validate-input-after-interaction]
 * [mwg:form-associated-custom-elements] [mwg:ime-safe-enter-submit] [mwg:accessible-error-announcement]
 *
 * @summary Date field: type a date or pick it in a calendar popover (a bottom sheet on touch).
 * @tag tct-date-input
 * @upstream DateInput
 * @csspart field - The whole field: label, control and status.
 * @csspart label - The label.
 * @csspart description - The description.
 * @csspart label-indicator - The "Required" or "Optional" text.
 * @csspart label-tip - The info-tip button.
 * @csspart label-icon - The icon before the label text.
 * @csspart input - The painted box around the control.
 * @csspart control - The typed text input, or the native date input.
 * @csspart toggle - The calendar toggle button.
 * @csspart picker - The positioned popover layer.
 * @csspart picker-surface - The painted popover surface that holds the calendar.
 * @csspart picker-close-button - The close button, revealed only when keyboard focus reaches it.
 * @csspart sheet - The bottom sheet of the touch presentation.
 * @csspart calendar - The calendar inside the picker.
 * @csspart status-icon - The status icon inside the box.
 * @csspart status-button - The status button of the `tooltip` status variant.
 * @csspart status - The status message box.
 * @cssstate open - The picker is open.
 * @cssstate user-invalid - Invalidity is displayed.
 * @cssstate invalid - The value does not satisfy its constraints (not displayed).
 * @cssstate busy - A `changeAction` is pending or `loading` is set.
 * @fires input - Native, when the committed date changes; composed.
 * @fires change - Native, once when the edit is committed; composed and dispatched from the host.
 * @fires tct-enter - The user pressed an unmodified Enter (never one that commits an IME conversion), after the draft was committed; cancelable, and preventing it stops the form's implicit submission.
 * @fires tct-clear - The user pressed the clear button; cancelable, and preventing it keeps the value.
 * @fires {TctOpenChangeEvent} tct-open-change - Before the user opens or closes the picker (toggle, input click, Arrow Down, Escape, outside press, a pick); cancelable.
 * @fires {TctAfterOpenChangeEvent} tct-after-open-change - After the picker opened or closed and settled.
 * @cloakDisplay block
 * @cloakMinBlockSize 4.5rem
 */
export class TctDateInput extends TctPickerField {
  static override readonly tagName = 'tct-date-input';
  static override readonly dependencies: readonly TctElementConstructor[] = [
    ...TctPickerField.dependencies,
    TctCalendar,
  ];
  static override styles: CSSResultGroup = TctPickerField.styles;

  /** Shows a clear (x) button while there is a value; it clears, fires `tct-clear` and returns focus. */
  @property({type: Boolean, attribute: 'has-clear'}) hasClear = false;

  /**
   * Deprecated: use `presentation` (`touch` is `adaptive-native`, `always` is `native`, `never` is
   * `adaptive-bottom-sheet`). `presentation` wins when both are set.
   */
  @property({attribute: 'native-picker'}) nativePicker: LegacyNativePicker | undefined;

  /** Earliest selectable date, `YYYY-MM-DD`. A native constraint: an earlier value is `rangeUnderflow`. */
  @property() min: string | undefined;

  /** Latest selectable date, `YYYY-MM-DD`. A native constraint: a later value is `rangeOverflow`. */
  @property() max: string | undefined;

  /** Predicates over a local `Date`: a date is unavailable when any returns `false` (weekdays only, no holidays). */
  @property({attribute: false}) dateConstraints: readonly ((date: Date) => boolean)[] | undefined;

  /** How many months the calendar shows side by side: 1 (default) or 2. */
  @property({type: Number, attribute: 'number-of-months'}) numberOfMonths: 1 | 2 = 1;

  /** First day of the week in the calendar: 0 (Sunday, default) to 6, or `sun` to `sat`. */
  @property({attribute: 'week-starts-on'}) weekStartsOn: DayOfWeek | string = 0;

  /**
   * How the committed date is displayed: `date_long` (default, "March 21, 2026"), `date` ("Mar 21, 2026"),
   * `date_weekday` ("Sat, Mar 21, 2026"), `system_date` ("2026-03-21"), or a function from the ISO value to
   * the text. Applies to the committed value only, never to text being typed.
   */
  @property({
    converter: {
      fromAttribute: (value: string | null) => value ?? undefined,
    },
  })
  format: DateInputFormat | DateInputFormatter = 'date_long';

  /** The date as `YYYY-MM-DD`, or `""`. Text that is not a real date reads as `""`. The `value` attribute is the default. */
  @property({attribute: false})
  override get value(): string {
    return TctDateInput.#sanitize(super.value);
  }
  override set value(value: string) {
    if (!this.#userWrite) this.#entry.drop();
    super.value = TctDateInput.#sanitize(value);
  }

  readonly #locale: LocaleController = new LocaleController(this, {
    namespace: 'dateInput',
    defaults: {...dateInputMessages, ...dateInputExtra, ...inputMessages, ...fieldMessages},
  });
  #userWrite = false;
  #rejected: string | null = null;

  /** The text being typed, until the entry ends (see {@link DraftEntry}). */
  readonly #entry: DraftEntry = new DraftEntry({
    host: this,
    issueOf: (text) => this.#issueOf(text),
    messageFor: (issue) =>
      issue === 'unavailable'
        ? this.#locale.t('@tct.date-input.dateUnavailable')
        : this.#locale.t('@tct.dateInput.invalidDate'),
    apply: (text) => {
      const parsed = parseDateInput(text, this.#locale.locale);
      if (!parsed) return;
      const iso = plainDateToISO(parsed);
      if (iso !== this.value) this.commitValue(iso, {commit: false});
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
    const date = tryPlainDateFromISO(String(value ?? '').trim());
    return date ? plainDateToISO(date) : '';
  }

  protected override sanitize(value: string): string {
    return TctDateInput.#sanitize(value);
  }

  // ------------------------------------------------------------------------------ mixin hooks

  protected override get pickerKind(): 'date' {
    return 'date';
  }

  protected override get legacyNativePicker(): LegacyNativePicker | undefined {
    return this.nativePicker;
  }

  protected override get formControl(): HTMLInputElement | null {
    return this.renderRoot.querySelector<HTMLInputElement>('input.input');
  }

  /** A date field submits the form on Enter (after committing what was typed). */
  protected override get submitsOnEnter(): boolean {
    return true;
  }

  protected override get validators(): Validator<this>[] {
    return [
      (field) => {
        const issue = field.#entry.issue;
        return issue !== null
          ? {
              flags: {badInput: true},
              message:
                issue === 'unavailable'
                  ? field.#locale.t('@tct.date-input.dateUnavailable')
                  : field.#locale.t('@tct.dateInput.invalidDate'),
            }
          : null;
      },
      (field) =>
        field.required && !field.optional && field.value === ''
          ? {flags: {valueMissing: true}, message: nativeMessage('text')}
          : null,
      (field) => {
        const date = tryPlainDateFromISO(field.value);
        if (!date) return null;
        const {minDate, maxDate} = createCalendarConstraints({min: field.min, max: field.max});
        if (minDate && field.value < plainDateToISO(minDate)) {
          return {flags: {rangeUnderflow: true}, message: rangeMessage('min', field.min!)};
        }
        if (maxDate && field.value > plainDateToISO(maxDate)) {
          return {flags: {rangeOverflow: true}, message: rangeMessage('max', field.max!)};
        }
        return null;
      },
      (field) => {
        const date = tryPlainDateFromISO(field.value);
        if (!date || !field.dateConstraints) return null;
        return field.#constraints().isDateDisabled(date)
          ? {
              flags: {customError: true},
              message: field.#locale.t('@tct.date-input.dateUnavailable'),
            }
          : null;
      },
    ];
  }

  protected override formResetValue(): void {
    this.#entry.drop();
    this.#rejected = null;
    this.forgetPendingChange();
    super.formResetValue();
  }

  /** Text that is not an available date is invalid once the typing has paused (it is dropped when the field is left). */
  override get showInvalid(): boolean {
    return super.showInvalid || this.#entry.surfaced !== null;
  }

  /** An unreadable draft has no visible message (the muted text and `aria-invalid` say it, once announced). */
  protected override get effectiveStatus(): InputStatus | undefined {
    if (!this.statusType && (this.#entry.surfaced !== null || this.#rejected !== null))
      return undefined;
    return super.effectiveStatus;
  }

  /** Focuses the input itself (not the toggle button). */
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
      `date-input:${name}:${value}`,
      `${name} "${value}" is not one of ${PICKER_PRESENTATIONS.join(', ')}.`,
    );
  }

  // ---------------------------------------------------------------------------------- derived

  #constraints() {
    return createCalendarConstraints({
      min: this.min,
      max: this.max,
      dateConstraints: this.dateConstraints,
    });
  }

  /** Why non-blank text cannot be committed as the date, if it cannot. */
  #issueOf(text: string): DraftIssue | null {
    const parsed = parseDateInput(text, this.#locale.locale);
    if (!parsed) return 'unreadable';
    return this.#constraints().isDateDisabled(parsed) ? 'unavailable' : null;
  }

  /** The committed value in the requested display. */
  #formatValue(iso: string): string {
    const format = this.format;
    if (typeof format === 'function') return format(iso);
    const date = tryPlainDateFromISO(iso);
    if (!date) return '';
    return formatSharedDate(
      date,
      oneOf<SharedDateFormat>(format, DATE_INPUT_FORMATS, 'date_long'),
      this.#locale.locale,
    );
  }

  get #displayText(): string {
    if (this.#entry.text !== null) return this.#entry.text;
    return this.value ? this.#formatValue(this.value) : '';
  }

  get #placeholderText(): string {
    return this.placeholder || this.#locale.t('@tct.dateInput.placeholder');
  }

  // --------------------------------------------------------------------------------- picker hooks

  protected override get dialogLabel(): string {
    return this.#locale.t('@tct.dateInput.dialogLabel');
  }

  protected override get toggleLabel(): string {
    return this.open
      ? this.#locale.t('@tct.dateInput.toggleCalendarClose')
      : this.#locale.t('@tct.dateInput.openCalendar');
  }

  protected override get closeLabel(): string {
    return this.#locale.t('@tct.dateInput.closeCalendar');
  }

  protected override get clearLabel(): string {
    return this.#locale.t('@tct.dateInput.clear', {label: this.label});
  }

  get #calendar(): TctCalendar | null {
    return this.renderRoot.querySelector<TctCalendar>('tct-calendar');
  }

  protected override initialPickerFocus(): HTMLElement | null {
    return this.#calendar?.shadowRoot?.querySelector<HTMLElement>('.day[tabindex="0"]') ?? null;
  }

  /** The calendar opens on the selected date, else today clamped into the window. */
  protected override async preparePicker(): Promise<void> {
    const calendar = this.#calendar;
    if (!calendar) return;
    const focus = getInitialFocusDate({
      value: this.value || undefined,
      min: this.min,
      max: this.max,
      numberOfMonths: this.numberOfMonths === 2 ? 2 : 1,
      today: plainDateToday(),
    });
    calendar.value = (this.value || undefined) as ISODateString | undefined;
    calendar.navigateTo(plainDateToISO(focus));
    await calendar.updateComplete;
  }

  protected override renderPickerContent(surface: 'popover' | 'sheet'): TemplateResult {
    return html`<tct-calendar
      class="calendar"
      part="calendar"
      ?data-autofocus=${surface === 'sheet'}
      mode="single"
      .value=${this.value || undefined}
      min=${ifDefined(this.min)}
      max=${ifDefined(this.max)}
      .dateConstraints=${this.dateConstraints}
      number-of-months=${this.numberOfMonths === 2 ? 2 : 1}
      week-starts-on=${String(this.weekStartsOn)}
      @change=${this.#onCalendarChange}
      @input=${this.#stop}
      @tct-value-change=${this.#stop}
    ></tct-calendar>`;
  }

  /** The calendar's own events describe its selection, not the field's: only the field's commit leaves it. */
  readonly #stop = (event: Event): void => {
    event.stopPropagation();
  };

  readonly #onCalendarChange = (event: Event): void => {
    event.stopPropagation();
    const calendar = event.currentTarget as TctCalendar;
    const picked = typeof calendar.value === 'string' ? calendar.value : '';
    this.#entry.drop();
    this.commitValue(picked);
    this.requestOpen(false, 'selection');
  };

  // ---------------------------------------------------------------------------------- lifecycle

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed);
    if (
      changed.has('format') &&
      typeof this.format === 'string' &&
      !(DATE_INPUT_FORMATS as readonly string[]).includes(this.format)
    ) {
      devWarn(
        `date-input:format:${this.format}`,
        `format "${this.format}" is not one of ${DATE_INPUT_FORMATS.join(', ')}; using "date_long".`,
      );
    }
    if ((changed.has('min') || changed.has('max')) && this.min && this.max && this.min > this.max) {
      devWarn(`date-input:min-max`, `min (${this.min}) is after max (${this.max}).`);
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
    const native = this.surface === 'native';
    const disabled = this.isDisabled;
    const inert = this.showsDisabledMessage;
    const content = html`
      ${this.renderToggle()}
      ${native ? this.#renderNative(disabled, inert) : this.#renderTyped(disabled, inert)}
      ${this.renderClear(this.hasClear && this.value !== '')}
      ${this.renderBusy()}${this.effectiveStatus ? this.renderStatusIcon() : nothing}
    `;
    return this.renderFieldLayout(
      html`${this.renderBoxWrapper(content)}${this.renderPickerSurface()}`,
    );
  }

  #renderTyped(disabled: boolean, inert: boolean): TemplateResult {
    const sheet = this.surface === 'sheet';
    return html`<input
      class="input"
      part="control"
      type="text"
      role="combobox"
      .value=${live(this.#displayText)}
      placeholder=${this.#placeholderText}
      autocomplete="off"
      spellcheck="false"
      ?disabled=${disabled && !inert}
      ?readonly=${this.readonly || inert || sheet}
      aria-disabled=${ifDefined(inert ? 'true' : undefined)}
      aria-required=${ifDefined(
        (this.required && !this.optional) || (!this.required && this.announcesRequired)
          ? 'true'
          : undefined,
      )}
      aria-busy=${ifDefined(this.busy ? 'true' : undefined)}
      aria-expanded=${this.open ? 'true' : 'false'}
      aria-haspopup="dialog"
      aria-controls=${ifDefined(this.open && !sheet ? this.pickerId : undefined)}
      aria-autocomplete="none"
      aria-labelledby=${ifDefined(this.groupLabelId)}
      @input=${this.#onInput}
      @blur=${this.#onBlur}
      @click=${this.#onInputClick}
      @keydown=${this.#onKeyDown}
    />`;
  }

  /**
   * The native control: a real `<input type="date">` the platform draws, with the field's own text painted
   * over it while it is not focused, so `format` and the placeholder still apply; on focus the platform's
   * editable segments (or, on a touch device, its picker) show through.
   */
  #renderNative(disabled: boolean, inert: boolean): TemplateResult {
    const overlay = this.value ? this.#formatValue(this.value) : this.#placeholderText;
    return html`<span class="native-slot">
      <input
        class="input native"
        part="control"
        type="date"
        .value=${live(this.value)}
        min=${ifDefined(this.min)}
        max=${ifDefined(this.max)}
        ?required=${this.required && !this.optional}
        ?disabled=${disabled && !inert}
        ?readonly=${this.readonly || inert}
        aria-disabled=${ifDefined(inert ? 'true' : undefined)}
        aria-required=${ifDefined(
          (this.required && !this.optional) || (!this.required && this.announcesRequired)
            ? 'true'
            : undefined,
        )}
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
    const input = event.target as HTMLInputElement;
    this.#entry.input(input.value);
    // The text is a draft until the entry ends (Enter, leaving the field, a pick): every prefix of a
    // complete date ("2026-03-2") is a date too, so committing as it is typed would keep the wrong one.
    // The calendar follows the date being typed, though.
    if (this.#entry.issue === null && input.value.trim() !== '') {
      const parsed = parseDateInput(input.value, this.#locale.locale);
      if (parsed) this.#calendar?.navigateTo(plainDateToISO(parsed));
    }
  };

  /** Turns the draft into the value: blank clears, a readable available date commits, the rest is dropped. */
  #commitDraft(): void {
    this.#entry.commit();
    this.settleChange();
    this.syncFormState();
    this.requestUpdate();
  }

  readonly #onBlur = (): void => {
    // Focus moving into the picker (a day click, the sheet) is not the end of the edit.
    this.#commitDraft();
  };

  /** A click opens the calendar without taking focus from the field (APG combobox), a touch sheet with focus inside. */
  readonly #onInputClick = (event: Event): void => {
    // A chrome press reaches the input as a programmatic click, which does not focus it.
    const control = event.currentTarget as HTMLInputElement;
    if (deepActiveElement(this.renderRoot as ShadowRoot) !== control && !this.readonly)
      control.focus();
    if (!this.canOpen || this.open || this.surface === 'native') return;
    this.openPicker('trigger', this.surface === 'sheet');
  };

  readonly #onKeyDown = (event: KeyboardEvent): void => {
    // The Enter that commits an IME candidate, and the arrows of its window, are not commands.
    if (isImeKeyEvent(event)) return;
    const modified = event.ctrlKey || event.metaKey || event.shiftKey;
    if (event.key === 'ArrowDown' && !modified && this.surface !== 'native') {
      event.preventDefault();
      if (!this.canOpen) return;
      if (!this.open) this.openPicker('keyboard', false);
      // With the calendar open, Arrow Down moves into it (APG combobox with a dialog popup).
      else this.initialPickerFocus()?.focus();
      return;
    }
    if (event.key === 'Enter' && !modified && !event.altKey) {
      this.#commitDraft();
      if (!this.dispatch(new TctEnterEvent())) event.preventDefault();
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
    const parsed = tryPlainDateFromISO(raw);
    if (!parsed) return;
    // A native picker may not show min, max or the constraints (iOS treats them as validity flags, not
    // clamps): a refused date is announced and the control snaps back when it loses focus.
    if (this.#constraints().isDateDisabled(parsed)) {
      this.#rejected = raw;
      announce(this.#locale.t('@tct.date-input.dateUnavailable'), {
        politeness: 'assertive',
        element: this,
      });
      this.requestUpdate();
      return;
    }
    this.#rejected = null;
    this.commitValue(raw, {commit});
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
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-date-input': TctDateInput;
  }
}
