import {html, nothing, type CSSResultGroup, type PropertyValues, type TemplateResult} from 'lit';
import {property} from 'lit/decorators.js';
import {ifDefined} from 'lit/directives/if-defined.js';
import {live} from 'lit/directives/live.js';
import dateInputMessages from '@tecton-wc/locales/en/dateInput.js';
import dateInputExtra from '@tecton-wc/locales/en/date-input.js';
import dateTimeInputMessages from '@tecton-wc/locales/en/dateTimeInput.js';
import fieldMessages from '@tecton-wc/locales/en/field.js';
import inputMessages from '@tecton-wc/locales/en/input.js';
import timeInputMessages from '@tecton-wc/locales/en/timeInput.js';
import {announce} from '@tecton-wc/core/a11y/announcer.js';
import type {DayOfWeek} from '@tecton-wc/core/date/date-types.js';
import {parseDateInput} from '@tecton-wc/core/date/date-parser.js';
import {formatSharedDate} from '@tecton-wc/core/date/format.js';
import {
  plainDateAddDays,
  plainDateToday,
  plainDateToISO,
  tryPlainDateFromISO,
} from '@tecton-wc/core/date/plain-date.js';
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
import type {TctElementConstructor} from '@tecton-wc/core/tct-element.js';
import {devWarn} from '@tecton-wc/core/utils/dev.js';
import {deepActiveElement} from '@tecton-wc/core/utils/focus.js';
import {isImeKeyEvent} from '@tecton-wc/core/utils/ime.js';
import {createCalendarConstraints} from '../calendar/calendar-constraints.js';
import {getInitialFocusDate} from '../calendar/get-initial-focus-date.js';
import {TctCalendar} from '../calendar/tct-calendar.js';
import type {FieldStatusVariant, InputStatus} from '../field/field.types.js';
import {DraftEntry} from '../date-input/draft-entry.js';
import {PICKER_PRESENTATIONS, type LegacyNativePicker} from '../date-input/picker-presentation.js';
import {PickerSurfaceController, renderPickerSurface} from '../date-input/picker-surface.js';
import {TctPickerField} from '../date-input/tct-picker-field.js';
import {
  DATE_TIME_INCREMENTS,
  DATE_TIME_OPTION_INTERVALS,
  type DateTimeIncrement,
  type DateTimeOptionInterval,
} from './date-time-input.types.js';
import styles from './tct-date-time-input.styles.css';

/** A date-time as the two parts it is made of: `YYYY-MM-DD` and `HH:MM[:SS]`, each `undefined` when absent or unreadable. */
function splitDateTime(value: string | null | undefined): {
  date: string | undefined;
  time: string | undefined;
} {
  const text = String(value ?? '').trim();
  if (!text) return {date: undefined, time: undefined};
  const index = text.indexOf('T');
  const datePart = index === -1 ? text : text.slice(0, index);
  const timePart = index === -1 ? undefined : text.slice(index + 1);
  const date = tryPlainDateFromISO(datePart);
  return {
    date: date ? plainDateToISO(date) : undefined,
    time: timePart ? (createISOTimeString(timePart) ?? undefined) : undefined,
  };
}

/** The browser's localized message for a date-time outside `min` or `max`, from a probe input. */
function rangeMessage(kind: 'min' | 'max', bound: string): string {
  const {date, time} = splitDateTime(bound);
  const from = date ? tryPlainDateFromISO(date) : null;
  if (!from) return nativeMessage('invalid');
  const probe = document.createElement('input');
  probe.type = 'datetime-local';
  const day = plainDateToISO(plainDateAddDays(from, kind === 'min' ? -1 : 1));
  probe[kind] = `${date}T${time ?? '00:00'}`;
  probe.value = `${day}T${time ?? '00:00'}`;
  return probe.validationMessage || nativeMessage('invalid');
}

/** Chronological order of two date-times (a bound with no time reads as the start of its day). */
function compareDateTime(a: string, b: string): number {
  const first = splitDateTime(a);
  const second = splitDateTime(b);
  if (first.date !== second.date) return (first.date ?? '') < (second.date ?? '') ? -1 : 1;
  return compareTime(first.time ?? '00:00', second.time ?? '00:00');
}

const MINUTES_PER_DAY = 24 * 60;

/**
 * A date and time field: a date and a time, side by side under one label, stored and submitted as one
 * `YYYY-MM-DDTHH:MM` (`YYYY-MM-DDTHH:MM:SS` with `has-seconds`). The date part types and picks like
 * `tct-date-input` (a calendar popover, a bottom sheet on touch); the time part types and steps like
 * `tct-time-input`, and with `time-option-interval` also lists times ("9:00 AM", "9:15 AM") to choose from.
 * Choosing a date on an empty field takes the current time, and a time chosen before any date is kept until the
 * date is. When the date is the date of `min` or `max`, their time of day bounds the time part.
 *
 * The value is a wall-clock date and time: it names no time zone and no calendar system, whatever the locale, so
 * it submits and reads back the same everywhere; keep the zone in your own data. It is form-associated,
 * resets to its `value` attribute and restores like a native input. `input` and `change` fire when the combined
 * value changes (typed text when the entry ends, a pick, a step, a clear); nothing fires for a property or
 * attribute write. Text that is not a date or a time, or one the constraints rule out, is `aria-invalid` and
 * announced while it stands and is dropped when its part is left. [mwg:model-partial-time-concepts]
 * [mwg:capture-location-agnostic-data] [mwg:support-global-calendar-systems]
 * [mwg:validate-input-after-interaction] [mwg:form-associated-custom-elements]
 * [mwg:ime-safe-enter-submit] [mwg:accessible-error-announcement]
 *
 * @summary Date and time field: a date and a time under one label, as one ISO date-time.
 * @tag tct-date-time-input
 * @upstream DateTimeInput
 * @csspart field - The whole field: label, control and status.
 * @csspart label - The label.
 * @csspart description - The description.
 * @csspart label-indicator - The "Required" or "Optional" text.
 * @csspart label-tip - The info-tip button.
 * @csspart label-icon - The icon before the label text.
 * @csspart row - The row that holds the date box and the time box.
 * @csspart input - The painted box around each part.
 * @csspart control - The typed or native input of the date part.
 * @csspart time-control - The typed or native input of the time part.
 * @csspart toggle - The calendar toggle button (the clock button on the touch sheet).
 * @csspart picker - The positioned popover layer.
 * @csspart picker-surface - The painted popover surface that holds the calendar or the times.
 * @csspart picker-close-button - The close button, revealed only when keyboard focus reaches it.
 * @csspart time-listbox - The listbox of preset times.
 * @csspart time-option - A preset time.
 * @csspart sheet - The bottom sheet of the touch presentation.
 * @csspart calendar - The calendar inside the picker.
 * @csspart panel - The time columns inside the sheet.
 * @csspart status - The status message box.
 * @cssstate open - The calendar popover or the bottom sheet is open.
 * @cssstate user-invalid - Invalidity is displayed.
 * @cssstate invalid - The value does not satisfy its constraints (not displayed).
 * @cssstate busy - A `changeAction` is pending or `loading` is set.
 * @fires input - Native, when the combined value changes; composed.
 * @fires change - Native, when the change is committed; composed and dispatched from the host.
 * @fires tct-enter - The user pressed an unmodified Enter in the date or the time part (never one that commits an IME conversion, or picks a preset time), after the text was committed; cancelable, and preventing it stops the form's implicit submission.
 * @fires tct-clear - The user pressed the clear button; cancelable, and preventing it keeps the value.
 * @fires {TctOpenChangeEvent} tct-open-change - Before the user opens or closes the calendar popover or the bottom sheet; cancelable.
 * @fires {TctAfterOpenChangeEvent} tct-after-open-change - After the calendar popover or the bottom sheet opened or closed and settled.
 * @cloakDisplay block
 * @cloakMinBlockSize 4.5rem
 */
export class TctDateTimeInput extends TctPickerField {
  static override readonly tagName = 'tct-date-time-input';
  static override readonly dependencies: readonly TctElementConstructor[] = [
    ...TctPickerField.dependencies,
    TctCalendar,
  ];
  static override styles: CSSResultGroup = [TctPickerField.styles, styles];

  /** Shows a clear (x) button while there is a value; it clears both parts, fires `tct-clear` and returns focus. */
  @property({type: Boolean, attribute: 'has-clear'}) hasClear = false;

  /**
   * Deprecated: use `presentation` (`touch` is `adaptive-native`, `always` is `native`, `never` is
   * `adaptive-bottom-sheet`). `presentation` wins when both are set.
   */
  @property({attribute: 'native-picker'}) nativePicker: LegacyNativePicker | undefined;

  /**
   * Earliest date-time, `YYYY-MM-DDTHH:MM[:SS]`. A native constraint: an earlier value is `rangeUnderflow`. It
   * bounds the days of the calendar, and its time of day bounds the time part on its own day.
   */
  @property() min: string | undefined;

  /** Latest date-time, `YYYY-MM-DDTHH:MM[:SS]`. A native constraint: a later value is `rangeOverflow`. */
  @property() max: string | undefined;

  /** Predicates over a local `Date`: a day is unavailable when any returns `false`. */
  @property({attribute: false}) dateConstraints: readonly ((date: Date) => boolean)[] | undefined;

  /** Whether the time has seconds (`HH:MM:SS`). */
  @property({type: Boolean, attribute: 'has-seconds'}) hasSeconds = false;

  /** `12h` (default, "2:30 PM") or `24h` ("14:30"): how the time is displayed. */
  @property({attribute: 'hour-format'}) hourFormat: '12h' | '24h' = '12h';

  /**
   * Minutes the arrow keys of the time part step by: 1 (default), 5, 10, 15 or 30. The browser's own time input
   * cannot step like this, so a value other than 1 keeps the typed time part on a touch device.
   */
  @property({type: Number, attribute: 'time-increment'}) timeIncrement: DateTimeIncrement = 1;

  /**
   * Minutes between the times of a dropdown of preset times (5, 10, 15, 30 or 60) that turns the time part
   * into a combobox. Typing any time still works: the list is a shortcut, not a restriction. Unset, the time part
   * is a plain text input.
   */
  @property({type: Number, attribute: 'time-option-interval'}) timeOptionInterval:
    DateTimeOptionInterval | undefined;

  /** Placeholder of the time part. Default "Select a time". */
  @property({attribute: 'time-placeholder'}) timePlaceholder = '';

  /** Accessible name of the time part. Default "{label} time". */
  @property({attribute: 'time-label'}) timeLabel = '';

  /** How many months the calendar shows side by side: 1 (default) or 2. A bottom sheet always shows one. */
  @property({type: Number, attribute: 'number-of-months'}) numberOfMonths: 1 | 2 = 1;

  /** First day of the week in the calendar: 0 (Sunday, default) to 6, or `sun` to `sat`. */
  @property({attribute: 'week-starts-on'}) weekStartsOn: DayOfWeek | string = 0;

  /**
   * The date-time as `YYYY-MM-DDTHH:MM` (or with `:SS`), or `""`. Anything that is not a real date and a real
   * time reads as `""`. The `value` attribute is the default a form reset restores.
   */
  @property({attribute: false})
  override get value(): string {
    return TctDateTimeInput.#sanitize(super.value);
  }
  override set value(value: string) {
    if (!this.#userWrite) {
      this.#dateEntry.drop();
      this.#timeEntry.drop();
      this.#heldTime = null;
    }
    super.value = TctDateTimeInput.#sanitize(value);
  }

  readonly #locale: LocaleController = new LocaleController(this, {
    namespace: 'dateTimeInput',
    defaults: {
      ...dateTimeInputMessages,
      ...dateInputMessages,
      ...dateInputExtra,
      ...timeInputMessages,
      ...inputMessages,
      ...fieldMessages,
    },
  });
  #userWrite = false;
  /** A time chosen before any date exists, kept until the date is chosen. */
  #heldTime: string | null = null;
  #focusedPart: 'date' | 'time' | null = null;
  #rejectedDate: string | null = null;
  #rejectedTime: string | null = null;
  /** The tab of the touch sheet. */
  #tab: 'date' | 'time' = 'date';

  /** The date text being typed, until the entry ends. */
  readonly #dateEntry: DraftEntry = new DraftEntry({
    host: this,
    issueOf: (text) => {
      const parsed = parseDateInput(text, this.#locale.locale);
      if (!parsed) return 'unreadable';
      return this.#constraints().isDateDisabled(parsed) ? 'unavailable' : null;
    },
    messageFor: (issue) =>
      issue === 'unavailable'
        ? this.#locale.t('@tct.date-input.dateUnavailable')
        : this.#locale.t('@tct.dateInput.invalidDate'),
    apply: (text) => {
      const parsed = parseDateInput(text, this.#locale.locale);
      if (parsed) this.#commitDate(plainDateToISO(parsed), {commit: false});
    },
    // Emptying the date clears the whole value; emptying the time only reverts it.
    clear: () => {
      this.#heldTime = null;
      if (this.value !== '') this.commitValue('', {commit: false});
    },
    changed: () => {
      this.requestUpdate();
      this.syncFormState();
    },
  });

  /** The time text being typed, until the entry ends. */
  readonly #timeEntry: DraftEntry = new DraftEntry({
    host: this,
    issueOf: (text) => (this.#parseTime(text) === null ? 'unreadable' : null),
    messageFor: () => this.#locale.t('@tct.timeInput.invalidTime'),
    apply: (text) => {
      const parsed = this.#parseTime(text);
      if (parsed) this.#commitTime(parsed, {commit: false});
    },
    clear: () => {
      // Nothing is emitted for an empty time: the display goes back.
    },
    changed: () => {
      this.requestUpdate();
      this.syncFormState();
    },
  });

  static #sanitize(value: string | null | undefined): string {
    const {date, time} = splitDateTime(value);
    return date && time ? `${date}T${time}` : '';
  }

  protected override sanitize(value: string): string {
    return TctDateTimeInput.#sanitize(value);
  }

  // ------------------------------------------------------------------------------ derived state

  get #parts(): {date: string | undefined; time: string | undefined} {
    return splitDateTime(this.value);
  }

  /** The time of day the value's own date bounds from below: only on the date of `min`. */
  get #timeMin(): string | undefined {
    const min = splitDateTime(this.min);
    const {date} = this.#parts;
    return min.date && min.time && date === min.date ? min.time : undefined;
  }

  get #timeMax(): string | undefined {
    const max = splitDateTime(this.max);
    const {date} = this.#parts;
    return max.date && max.time && date === max.date ? max.time : undefined;
  }

  #constraints() {
    return createCalendarConstraints({
      min: splitDateTime(this.min).date,
      max: splitDateTime(this.max).date,
      dateConstraints: this.dateConstraints,
    });
  }

  /** Typed text as a time inside the bounds of the current date, or `null`. */
  #parseTime(text: string): string | null {
    const parsed = parseTimeInput(text, this.hasSeconds, this.#locale.locale);
    return parsed && isTimeInRange(parsed, this.#timeMin, this.#timeMax) ? parsed : null;
  }

  #now(): string {
    const now = new Date();
    return formatISOTime(
      {hour: now.getHours(), minute: now.getMinutes(), second: now.getSeconds()},
      this.hasSeconds,
    );
  }

  get #formatTime(): (time: string) => string {
    const locale = this.#locale.locale;
    return this.hourFormat === '24h'
      ? (time) => formatDisplayTime24h(time, this.hasSeconds, locale)
      : (time) => formatDisplayTime12h(time, this.hasSeconds, locale);
  }

  get #dateText(): string {
    if (this.#dateEntry.text !== null) return this.#dateEntry.text;
    const date = tryPlainDateFromISO(this.#parts.date);
    return date ? formatSharedDate(date, 'date_long', this.#locale.locale) : '';
  }

  get #timeText(): string {
    if (this.#timeEntry.text !== null) return this.#timeEntry.text;
    const time = this.#parts.time ?? this.#heldTime;
    return time ? this.#formatTime(time) : '';
  }

  get #datePlaceholder(): string {
    return this.placeholder || this.#locale.t('@tct.dateTimeInput.placeholder');
  }

  get #timePlaceholderText(): string {
    if (this.timePlaceholder) return this.timePlaceholder;
    if (this.#focusedPart === 'time' && !this.#timeText && this.canEdit) {
      return this.#locale.t(
        this.hourFormat === '24h'
          ? '@tct.dateTimeInput.timeHint24h'
          : '@tct.dateTimeInput.timeHint12h',
      );
    }
    return this.#locale.t('@tct.dateTimeInput.timePlaceholder');
  }

  get #timeLabelText(): string {
    return this.timeLabel || this.#locale.t('@tct.dateTimeInput.timeSuffix', {label: this.label});
  }

  // ------------------------------------------------------------------------------ mixin hooks

  protected override get pickerKind(): 'date' {
    return 'date';
  }

  protected override get legacyNativePicker(): LegacyNativePicker | undefined {
    return this.nativePicker;
  }

  /** The status message is always the detached message box (upstream has no other for this field). */
  protected override get effectiveStatusVariant(): FieldStatusVariant {
    return 'detached';
  }

  /**
   * Whether the time part is the browser's own input. The native time input cannot show seconds, step by
   * an increment or list preset times, so a coarse pointer that would get it keeps the typed part then; an
   * explicit `presentation="native"` is never replaced.
   */
  get #nativeTime(): boolean {
    if (this.surface !== 'native') return false;
    if (this.presentation === 'native') return true;
    return !this.hasSeconds && this.timeIncrement === 1 && this.timeOptionInterval === undefined;
  }

  protected override get formControl(): HTMLInputElement | null {
    return this.renderRoot.querySelector<HTMLInputElement>('input.input:not(.time)');
  }

  get #timeControl(): HTMLInputElement | null {
    return this.renderRoot.querySelector<HTMLInputElement>('input.input.time');
  }

  /** A date-time field submits the form on Enter in either part (after committing what was typed). */
  protected override get submitsOnEnter(): boolean {
    return true;
  }

  protected override get validators(): Validator<this>[] {
    return [
      (field) => {
        const issue = field.#dateEntry.issue;
        if (issue === null) return null;
        return {
          flags: {badInput: true},
          message:
            issue === 'unavailable'
              ? field.#locale.t('@tct.date-input.dateUnavailable')
              : field.#locale.t('@tct.dateInput.invalidDate'),
        };
      },
      (field) =>
        field.#timeEntry.issue !== null
          ? {flags: {badInput: true}, message: field.#locale.t('@tct.timeInput.invalidTime')}
          : null,
      (field) =>
        field.required && !field.optional && field.value === ''
          ? {flags: {valueMissing: true}, message: nativeMessage('text')}
          : null,
      (field) => {
        if (!field.value) return null;
        if (
          field.min &&
          splitDateTime(field.min).date &&
          compareDateTime(field.value, field.min) < 0
        ) {
          return {flags: {rangeUnderflow: true}, message: rangeMessage('min', field.min)};
        }
        if (
          field.max &&
          splitDateTime(field.max).date &&
          compareDateTime(field.value, field.max) > 0
        ) {
          return {flags: {rangeOverflow: true}, message: rangeMessage('max', field.max)};
        }
        return null;
      },
      (field) => {
        const date = tryPlainDateFromISO(field.#parts.date);
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
    this.#dateEntry.drop();
    this.#timeEntry.drop();
    this.#heldTime = null;
    this.#rejectedDate = null;
    this.#rejectedTime = null;
    this.forgetPendingChange();
    super.formResetValue();
  }

  /** Text that is not an available date or time is invalid once the typing has paused. */
  override get showInvalid(): boolean {
    return (
      super.showInvalid || this.#dateEntry.surfaced !== null || this.#timeEntry.surfaced !== null
    );
  }

  /** An unreadable draft has no visible message (the muted text and `aria-invalid` say it, once announced). */
  protected override get effectiveStatus(): InputStatus | undefined {
    if (
      !this.statusType &&
      (this.#dateEntry.surfaced !== null ||
        this.#timeEntry.surfaced !== null ||
        this.#rejectedDate !== null ||
        this.#rejectedTime !== null)
    ) {
      return undefined;
    }
    return super.effectiveStatus;
  }

  /** Focuses the date part (not its toggle button). */
  override focus(options?: FocusOptions): void {
    const control = this.formControl;
    if (control) control.focus(options);
    else super.focus(options);
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
    this.#dateEntry.drop();
    this.#timeEntry.drop();
    this.#heldTime = null;
    this.commitValue('');
  }

  protected override warnEnum(name: string, value: string): void {
    devWarn(
      `date-time-input:${name}:${value}`,
      `${name} "${value}" is not one of ${PICKER_PRESENTATIONS.join(', ')}.`,
    );
  }

  // ------------------------------------------------------------------------------ committing

  /**
   * A date was chosen (typed, picked): the value is that date with the time it already has, else the time chosen
   * before it, else the current time, moved inside `min` and `max` when the date is theirs.
   */
  #commitDate(date: string, options: {commit?: boolean} = {}): boolean {
    const parts = this.#parts;
    let time = parts.time ?? this.#heldTime ?? this.#now();
    const min = splitDateTime(this.min);
    const max = splitDateTime(this.max);
    if (min.date === date && min.time && !isTimeInRange(time, min.time, undefined)) time = min.time;
    if (max.date === date && max.time && !isTimeInRange(time, undefined, max.time)) time = max.time;
    this.#heldTime = null;
    return this.commitValue(`${date}T${time}`, options);
  }

  /** A time was chosen (typed, stepped, picked): with a date it is the value, without one it waits for it. */
  #commitTime(time: string, options: {commit?: boolean} = {}): boolean {
    if (!isTimeInRange(time, this.#timeMin, this.#timeMax)) return false;
    const {date} = this.#parts;
    if (!date) {
      this.#heldTime = time;
      this.requestUpdate();
      return true;
    }
    this.#heldTime = null;
    return this.commitValue(`${date}T${time}`, options);
  }

  // --------------------------------------------------------------------------------- picker hooks

  protected override get dialogLabel(): string {
    return this.#locale.t('@tct.dateTimeInput.dialogLabel');
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
    const date = this.#parts.date;
    const focus = getInitialFocusDate({
      value: date,
      min: splitDateTime(this.min).date,
      max: splitDateTime(this.max).date,
      numberOfMonths: this.numberOfMonths === 2 ? 2 : 1,
      today: plainDateToday(),
    });
    calendar.value = date as never;
    calendar.navigateTo(plainDateToISO(focus));
    await calendar.updateComplete;
  }

  protected override renderPickerContent(surface: 'popover' | 'sheet'): TemplateResult {
    if (surface === 'popover') return this.#renderCalendar(false);
    return html`<div class="sheet-body">
      <tct-segmented-control
        class="tabs"
        label=${this.#locale.t('@tct.dateTimeInput.pickerMode')}
        layout="fill"
        .value=${this.#tab}
        @change=${this.#onTabChange}
      >
        <tct-segmented-control-item
          value="date"
          label=${this.#locale.t('@tct.dateTimeInput.dateTab')}
        ></tct-segmented-control-item>
        <tct-segmented-control-item
          value="time"
          label=${this.#locale.t('@tct.dateTimeInput.timeTab')}
        ></tct-segmented-control-item>
      </tct-segmented-control>
      ${
        this.#tab === 'date'
          ? this.#renderCalendar(true)
          : html`<tct-time-panel
              class="panel"
              part="panel"
              data-autofocus
              .value=${this.#parts.time ?? this.#heldTime ?? ''}
              min=${ifDefined(this.#timeMin)}
              max=${ifDefined(this.#timeMax)}
              hour-format=${this.hourFormat === '24h' ? '24h' : '12h'}
              ?has-seconds=${this.hasSeconds}
              @change=${this.#onPanelChange}
            ></tct-time-panel>`
      }
      <tct-button
        class="save"
        variant="primary"
        width="100%"
        label=${
          this.#tab === 'date'
            ? this.#locale.t('@tct.dateTimeInput.saveDatePicking')
            : this.#locale.t('@tct.dateInput.savePicking')
        }
        @click=${this.#onSave}
      ></tct-button>
    </div>`;
  }

  #renderCalendar(sheet: boolean): TemplateResult {
    return html`<tct-calendar
      class="calendar"
      part="calendar"
      ?data-autofocus=${sheet}
      mode="single"
      .value=${this.#parts.date}
      min=${ifDefined(splitDateTime(this.min).date)}
      max=${ifDefined(splitDateTime(this.max).date)}
      .dateConstraints=${this.dateConstraints}
      number-of-months=${sheet || this.numberOfMonths === 1 ? 1 : 2}
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
    const value = (event.currentTarget as TctCalendar).value;
    if (typeof value !== 'string') return;
    this.#dateEntry.drop();
    this.#commitDate(value);
    // A popover is done with the date; the touch sheet goes on to the time (its Save date button moves too).
    if (this.surface !== 'sheet') this.requestOpen(false, 'selection');
  };

  readonly #onTabChange = (event: Event): void => {
    event.stopPropagation();
    const value = (event.currentTarget as HTMLElement & {value: string}).value;
    this.#tab = value === 'time' ? 'time' : 'date';
    this.requestUpdate();
  };

  /** The panel picks live, like the wheels of upstream: every pick is a change, Save only moves on or closes. */
  readonly #onPanelChange = (event: Event): void => {
    event.stopPropagation();
    const panel = event.currentTarget as HTMLElement & {value: string};
    this.#timeEntry.drop();
    this.#commitTime(panel.value);
  };

  readonly #onSave = (): void => {
    if (this.#tab === 'date') {
      this.#tab = 'time';
      this.requestUpdate();
      return;
    }
    this.requestOpen(false, 'selection');
  };

  /** Opens the touch sheet on `tab`. */
  #openSheetOn(tab: 'date' | 'time'): void {
    if (!this.canOpen) return;
    if (this.open) {
      this.#tab = tab;
      this.requestUpdate();
      return;
    }
    this.#tab = tab;
    this.openPicker('trigger', true);
  }

  // ---------------------------------------------------------------------------- preset time list

  get #hasTimeOptions(): boolean {
    return (
      this.timeOptionInterval !== undefined &&
      this.surface !== 'native' &&
      this.surface !== 'sheet' &&
      this.canEdit
    );
  }

  #highlight = -1;
  /** Whether the highlight is still the one typing derived; Enter honours typed text only then. */
  #followTyping = true;
  #timeListOpen = false;

  readonly #timeList: PickerSurfaceController = new PickerSurfaceController(this, {
    surface: () =>
      this.renderRoot.querySelector<HTMLElement>('.picker:has(> [data-variant="time-options"])'),
    anchor: () => this.timeBox,
    trigger: () => this.#timeControl,
    inside: () => [this.timeBox],
    haspopup: 'listbox',
    trapFocus: false,
    matchAnchorWidth: 'min',
    initialFocus: () => 'none',
    returnFocus: () => null,
    onDismissRequest: () => {
      void this.#hideTimeList();
    },
    onNativeClose: () => {
      this.#timeListOpen = false;
      this.requestUpdate();
    },
    onHidden: () => {
      this.#highlight = -1;
      this.#timeListOpen = false;
      this.requestUpdate();
    },
  });

  get timeBox(): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>('.input-wrapper.time-box');
  }

  /** Every time at the cadence that the typed path would accept, in order. */
  get #timeOptions(): {time: string; label: string}[] {
    const interval = this.timeOptionInterval;
    if (!interval || !this.#hasTimeOptions) return [];
    const options: {time: string; label: string}[] = [];
    for (let minutes = 0; minutes < MINUTES_PER_DAY; minutes += interval) {
      const time = formatISOTime(
        {hour: Math.floor(minutes / 60), minute: minutes % 60, second: 0},
        this.hasSeconds,
      );
      if (!isTimeInRange(time, this.#timeMin, this.#timeMax)) continue;
      options.push({time, label: this.#formatTime(time)});
    }
    return options;
  }

  /** The time in the shape the options carry (a value with seconds and a field without them still matches). */
  get #selectedOptionTime(): string | undefined {
    const time = this.#parts.time;
    const parsed = time ? parseISOTime(time) : null;
    return parsed ? formatISOTime(parsed, this.hasSeconds) : undefined;
  }

  /** Index of the option at or before `time`, so opening on a time that is no option still highlights something. */
  #closestOption(options: {time: string}[], time: string | undefined): number {
    if (options.length === 0) return -1;
    if (!time) return 0;
    let candidate = -1;
    for (let index = 0; index < options.length; index += 1) {
      if (options[index]!.time <= time) candidate = index;
      else break;
    }
    return candidate === -1 ? 0 : candidate;
  }

  async #showTimeList(): Promise<void> {
    const options = this.#timeOptions;
    if (!this.#hasTimeOptions || this.#timeList.isOpen || options.length === 0) return;
    this.#highlight = this.#closestOption(options, this.#selectedOptionTime);
    this.#followTyping = true;
    this.#timeListOpen = true;
    this.requestUpdate();
    await this.updateComplete;
    // The field must hold DOM focus or aria-activedescendant announces nothing.
    if (deepActiveElement(this.renderRoot as ShadowRoot) !== this.#timeControl) {
      this.#timeControl?.focus();
    }
    await this.#timeList.show();
  }

  async #hideTimeList(): Promise<void> {
    if (!this.#timeList.isOpen && !this.#timeListOpen) return;
    await this.#timeList.hide();
    this.#timeListOpen = false;
    this.#highlight = -1;
    this.requestUpdate();
  }

  /** The single commit path for a time chosen from the list: the same as typing it. */
  #commitOption(time: string): void {
    if (!this.canEdit || !isTimeInRange(time, this.#timeMin, this.#timeMax)) return;
    this.#timeEntry.drop();
    if (time !== this.#selectedOptionTime || !this.#parts.date) this.#commitTime(time);
    void this.#hideTimeList();
    this.#timeControl?.focus();
  }

  #renderTimeList(): TemplateResult {
    const open = this.#timeListOpen;
    const options = open ? this.#timeOptions : [];
    const selected = this.#selectedOptionTime;
    const active = Math.min(this.#highlight, options.length - 1);
    return renderPickerSurface({
      label: '',
      role: 'none',
      variant: 'time-options',
      content: html`${
        open
          ? html`<div
              class="time-listbox"
              part="time-listbox"
              id=${this.ids.id('time-listbox')}
              role="listbox"
              aria-label=${this.#locale.t('@tct.dateTimeInput.timeOptionsLabel', {
                label: this.#timeLabelText,
              })}
            >
              ${options.map(
                (option, index) =>
                  html`<div
                    class="time-option"
                    part="time-option"
                    id=${this.ids.id(`time-option-${index}`)}
                    role="option"
                    tabindex="-1"
                    aria-selected=${option.time === selected ? 'true' : 'false'}
                    ?data-highlighted=${index === active}
                    @pointerdown=${(event: Event) => {
                      // The field must not lose focus to the option, or its blur would commit first.
                      event.preventDefault();
                    }}
                    @click=${() => {
                      this.#commitOption(option.time);
                    }}
                    @mouseenter=${() => {
                      this.#highlight = index;
                      this.#followTyping = false;
                      this.requestUpdate();
                    }}
                  >
                    ${option.label}
                  </div>`,
              )}
            </div>`
          : nothing
      }`,
    });
  }

  // ---------------------------------------------------------------------------------- lifecycle

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed);
    if (changed.has('hourFormat') && this.hourFormat !== '12h' && this.hourFormat !== '24h') {
      const given = String(this.hourFormat);
      devWarn(
        `date-time-input:hour-format:${given}`,
        `hour-format "${given}" is not one of 12h, 24h; using "12h".`,
      );
    }
    if (
      changed.has('timeIncrement') &&
      !(DATE_TIME_INCREMENTS as readonly number[]).includes(this.timeIncrement)
    ) {
      devWarn(
        `date-time-input:time-increment:${String(this.timeIncrement)}`,
        `time-increment ${String(this.timeIncrement)} is not one of ${DATE_TIME_INCREMENTS.join(', ')}; using 1.`,
      );
    }
    if (
      changed.has('timeOptionInterval') &&
      this.timeOptionInterval !== undefined &&
      !(DATE_TIME_OPTION_INTERVALS as readonly number[]).includes(this.timeOptionInterval)
    ) {
      devWarn(
        `date-time-input:time-option-interval:${String(this.timeOptionInterval)}`,
        `time-option-interval ${String(this.timeOptionInterval)} is not one of ${DATE_TIME_OPTION_INTERVALS.join(', ')}.`,
      );
    }
  }

  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed);
    // A list that can no longer be offered (disabled, busy, an emptied window) leaves the top layer.
    if (this.#timeList.isOpen && (!this.#hasTimeOptions || this.#timeOptions.length === 0)) {
      void this.#hideTimeList();
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
    const native = surface === 'native';
    const sheet = surface === 'sheet';
    const dateContent = html`
      ${this.renderToggle()}
      ${native ? this.#renderNativeDate(disabled, inert) : this.#renderTypedDate(disabled, inert, sheet)}
      ${this.renderClear(this.hasClear && this.value !== '')} ${this.renderBusy()}
    `;
    const timeContent = html`
      ${
        sheet
          ? this.#renderClockButton()
          : html`<tct-icon
              class="clock"
              part="clock"
              name="clock"
              size="sm"
              color="secondary"
            ></tct-icon>`
      }
      ${
        native && this.#nativeTime
          ? this.#renderNativeTime(disabled, inert)
          : this.#renderTypedTime(disabled, inert, sheet)
      }
    `;
    return this.renderFieldLayout(
      html`<div class="row" part="row" @click=${this.#onRowClick}>
          ${this.renderBoxWrapper(dateContent)}${this.#renderTimeBox(timeContent)}
        </div>
        ${this.renderPickerSurface()}${this.#renderTimeList()}`,
    );
  }

  /** A press on the gap between the two boxes is a press on the field: the date part takes focus. */
  readonly #onRowClick = (event: MouseEvent): void => {
    if (event.target !== event.currentTarget || (this.isDisabled && !this.showsDisabledMessage))
      return;
    this.formControl?.focus();
  };

  /** The time part's own painted box (the shared wrapper focuses the date part, so it cannot be reused). */
  #renderTimeBox(content: TemplateResult): TemplateResult {
    const status = this.effectiveStatus;
    return html`<div
      class="input-wrapper focus-within-ring time-box"
      part="input time-box"
      data-size=${this.fieldSize}
      data-status=${ifDefined(status?.type)}
      ?data-disabled=${this.isDisabled}
      ?data-readonly=${this.readonly}
      @click=${this.#onTimeBoxClick}
    >
      ${content}
    </div>`;
  }

  #ariaRequired(): string | undefined {
    return (this.required && !this.optional) || (!this.required && this.announcesRequired)
      ? 'true'
      : undefined;
  }

  #renderTypedDate(disabled: boolean, inert: boolean, sheet: boolean): TemplateResult {
    return html`<input
      class="input"
      part="control"
      type="text"
      role="combobox"
      .value=${live(this.#dateText)}
      placeholder=${this.#datePlaceholder}
      autocomplete="off"
      spellcheck="false"
      ?disabled=${disabled && !inert}
      ?readonly=${this.readonly || inert || sheet}
      inputmode=${ifDefined(sheet ? 'none' : undefined)}
      aria-disabled=${ifDefined(inert ? 'true' : undefined)}
      aria-required=${ifDefined(this.#ariaRequired())}
      aria-busy=${ifDefined(this.busy ? 'true' : undefined)}
      aria-expanded=${this.open ? 'true' : 'false'}
      aria-haspopup="dialog"
      aria-controls=${ifDefined(this.open && !sheet ? this.pickerId : undefined)}
      aria-autocomplete="none"
      aria-labelledby=${ifDefined(this.groupLabelId)}
      @input=${this.#onDateInput}
      @focus=${this.#onDateFocus}
      @blur=${this.#onDateBlur}
      @click=${this.#onDateClick}
      @keydown=${this.#onDateKeyDown}
    />`;
  }

  #renderTypedTime(disabled: boolean, inert: boolean, sheet: boolean): TemplateResult {
    const listing = this.#hasTimeOptions;
    const options = this.#timeOptions;
    const listOpen = this.#timeListOpen && options.length > 0;
    const active = Math.min(this.#highlight, options.length - 1);
    return html`<input
      class="input time"
      part="time-control"
      type="text"
      role=${ifDefined(listing || sheet ? 'combobox' : undefined)}
      .value=${live(this.#timeText)}
      placeholder=${this.#timePlaceholderText}
      autocomplete="off"
      spellcheck="false"
      ?disabled=${disabled && !inert}
      ?readonly=${this.readonly || inert || sheet}
      inputmode=${ifDefined(sheet ? 'none' : undefined)}
      aria-label=${this.#timeLabelText}
      aria-disabled=${ifDefined(inert ? 'true' : undefined)}
      aria-required=${ifDefined(this.#ariaRequired())}
      aria-invalid=${ifDefined(
        this.statusType === 'error' || this.#timeEntry.surfaced !== null ? 'true' : undefined,
      )}
      aria-busy=${ifDefined(this.busy ? 'true' : undefined)}
      aria-haspopup=${ifDefined(sheet ? 'dialog' : undefined)}
      aria-expanded=${ifDefined(listing ? String(listOpen) : sheet ? String(this.open) : undefined)}
      aria-controls=${ifDefined(listing && listOpen ? this.ids.id('time-listbox') : undefined)}
      aria-autocomplete=${ifDefined(listing ? 'list' : sheet ? 'none' : undefined)}
      aria-activedescendant=${ifDefined(
        listing && listOpen && active >= 0 ? this.ids.id(`time-option-${active}`) : undefined,
      )}
      @input=${this.#onTimeInput}
      @focus=${this.#onTimeFocus}
      @blur=${this.#onTimeBlur}
      @click=${this.#onTimeClick}
      @keydown=${this.#onTimeKeyDown}
    />`;
  }

  /** The clock button of the touch sheet: it opens the sheet on the Time tab. */
  #renderClockButton(): TemplateResult {
    const disabled = !this.canOpen;
    return html`<button
      type="button"
      class="toggle time-toggle focus-ring"
      part="toggle"
      ?disabled=${disabled && !this.showsDisabledMessage}
      aria-disabled=${disabled && this.showsDisabledMessage ? 'true' : nothing}
      aria-label=${this.#locale.t('@tct.dateTimeInput.openTimePicker', {
        label: this.#timeLabelText,
      })}
      aria-haspopup="dialog"
      aria-expanded=${this.open ? 'true' : 'false'}
      @click=${(event: Event) => {
        event.stopPropagation();
        this.#openSheetOn('time');
      }}
    >
      <tct-icon name="clock" size="sm" color="secondary" class="toggle-icon"></tct-icon>
    </button>`;
  }

  #renderNativeDate(disabled: boolean, inert: boolean): TemplateResult {
    const date = this.#parts.date ?? '';
    const parsed = tryPlainDateFromISO(date);
    const overlay = parsed
      ? formatSharedDate(parsed, 'date_long', this.#locale.locale)
      : this.#datePlaceholder;
    const min = splitDateTime(this.min).date;
    const max = splitDateTime(this.max).date;
    return html`<span class="native-slot">
      <input
        class="input native"
        part="control"
        type="date"
        .value=${live(date)}
        min=${ifDefined(min)}
        max=${ifDefined(max)}
        ?required=${this.required && !this.optional}
        ?disabled=${disabled && !inert}
        ?readonly=${this.readonly || inert}
        aria-disabled=${ifDefined(inert ? 'true' : undefined)}
        aria-required=${ifDefined(this.#ariaRequired())}
        aria-busy=${ifDefined(this.busy ? 'true' : undefined)}
        aria-labelledby=${ifDefined(this.groupLabelId)}
        @input=${(event: Event) => {
          this.#commitNativeDate(event.target as HTMLInputElement, false, event);
        }}
        @change=${(event: Event) => {
          this.#commitNativeDate(event.target as HTMLInputElement, true, event);
        }}
        @blur=${this.#onNativeBlur}
      />
      <span class="native-overlay" part="overlay" aria-hidden="true" ?data-placeholder=${!parsed}
        >${overlay}</span
      >
    </span>`;
  }

  #renderNativeTime(disabled: boolean, inert: boolean): TemplateResult {
    const time = this.#parts.time ?? this.#heldTime ?? '';
    const overlay = time ? this.#formatTime(time) : this.#timePlaceholderText;
    return html`<span class="native-slot">
      <input
        class="input native time"
        part="time-control"
        type="time"
        .value=${live(time)}
        min=${ifDefined(this.#timeMin)}
        max=${ifDefined(this.#timeMax)}
        step=${ifDefined(this.hasSeconds ? '1' : undefined)}
        ?disabled=${disabled && !inert}
        ?readonly=${this.readonly || inert}
        aria-label=${this.#timeLabelText}
        aria-disabled=${ifDefined(inert ? 'true' : undefined)}
        aria-required=${ifDefined(this.#ariaRequired())}
        aria-busy=${ifDefined(this.busy ? 'true' : undefined)}
        @input=${(event: Event) => {
          this.#commitNativeTime(event.target as HTMLInputElement, false, event);
        }}
        @change=${(event: Event) => {
          this.#commitNativeTime(event.target as HTMLInputElement, true, event);
        }}
        @blur=${this.#onNativeBlur}
      />
      <span class="native-overlay" part="overlay" aria-hidden="true" ?data-placeholder=${!time}
        >${overlay}</span
      >
    </span>`;
  }

  // ---------------------------------------------------------------------------------- date events

  readonly #onDateInput = (event: Event): void => {
    event.stopPropagation();
    if (!this.canEdit || this.showsDisabledMessage) return;
    const input = event.target as HTMLInputElement;
    this.#dateEntry.input(input.value);
    if (this.#dateEntry.issue === null && input.value.trim() !== '') {
      const parsed = parseDateInput(input.value, this.#locale.locale);
      if (parsed) this.#calendar?.navigateTo(plainDateToISO(parsed));
    }
  };

  readonly #onDateFocus = (): void => {
    this.#focusedPart = 'date';
  };

  #commitDateDraft(): void {
    this.#dateEntry.commit();
    this.settleChange();
    this.syncFormState();
    this.requestUpdate();
  }

  readonly #onDateBlur = (): void => {
    if (this.#focusedPart === 'date') this.#focusedPart = null;
    this.#commitDateDraft();
  };

  /** A click opens the calendar without taking focus from the field (APG combobox), a touch sheet with focus inside. */
  readonly #onDateClick = (event: Event): void => {
    const control = event.currentTarget as HTMLInputElement;
    if (deepActiveElement(this.renderRoot as ShadowRoot) !== control && !this.readonly) {
      control.focus();
    }
    if (!this.canOpen || this.open || this.surface === 'native') return;
    if (this.surface === 'sheet') this.#openSheetOn('date');
    else this.openPicker('trigger', false);
  };

  readonly #onDateKeyDown = (event: KeyboardEvent): void => {
    if (isImeKeyEvent(event)) return;
    const modified = event.ctrlKey || event.metaKey || event.shiftKey;
    if (event.key === 'ArrowDown' && !modified && this.surface !== 'native') {
      event.preventDefault();
      if (!this.canOpen) return;
      if (this.surface === 'sheet') {
        this.#openSheetOn('date');
        return;
      }
      if (!this.open) this.openPicker('keyboard', false);
      else this.initialPickerFocus()?.focus();
      return;
    }
    if (event.key === 'Enter' && !modified && !event.altKey) {
      if (this.surface === 'sheet') {
        event.preventDefault();
        this.#openSheetOn('date');
        return;
      }
      this.#commitDateDraft();
      if (!this.dispatch(new TctEnterEvent())) event.preventDefault();
    }
  };

  // ---------------------------------------------------------------------------------- time events

  readonly #onTimeInput = (event: Event): void => {
    event.stopPropagation();
    if (!this.canEdit || this.showsDisabledMessage) return;
    const text = (event.target as HTMLInputElement).value;
    this.#timeEntry.input(text);
    // Typing narrows nothing: the list follows the typed value so Enter lands where the user expects.
    if (this.#timeList.isOpen) {
      const parsed = this.#parseTime(text);
      if (parsed) {
        this.#followTyping = true;
        this.#highlight = this.#closestOption(this.#timeOptions, parsed);
        this.requestUpdate();
      }
    }
  };

  readonly #onTimeFocus = (): void => {
    this.#focusedPart = 'time';
    this.requestUpdate();
  };

  #commitTimeDraft(): void {
    this.#timeEntry.commit();
    this.settleChange();
    this.syncFormState();
    this.requestUpdate();
  }

  readonly #onTimeBlur = (event: FocusEvent): void => {
    if (this.#focusedPart === 'time') this.#focusedPart = null;
    // Focus moving into the list (never: options do not take focus) or out of the field closes it.
    const next = event.relatedTarget;
    if (!(next instanceof Node) || !this.renderRoot.contains(next)) void this.#hideTimeList();
    this.#commitTimeDraft();
    this.requestUpdate();
  };

  readonly #onTimeClick = (): void => {
    if (this.surface === 'sheet') {
      this.#openSheetOn('time');
      return;
    }
    if (this.#hasTimeOptions) void this.#showTimeList();
  };

  readonly #onTimeBoxClick = (event: MouseEvent): void => {
    if (this.isDisabled && !this.showsDisabledMessage) return;
    const origin = event.composedPath()[0];
    const control = this.#timeControl;
    if (!control || origin === control) return;
    if (origin instanceof Element && origin.closest('button, tct-input-clear-button')) return;
    if (this.surface === 'sheet') {
      this.#openSheetOn('time');
      return;
    }
    control.focus();
    if (this.#hasTimeOptions) void this.#showTimeList();
  };

  readonly #onTimeKeyDown = (event: KeyboardEvent): void => {
    if (isImeKeyEvent(event)) return;
    const modified = event.ctrlKey || event.metaKey || event.shiftKey;
    if (this.surface === 'sheet') {
      if (['Enter', ' ', 'ArrowDown'].includes(event.key) && !modified && !event.altKey) {
        event.preventDefault();
        this.#openSheetOn('time');
      }
      return;
    }
    const editable = this.canEdit && !this.showsDisabledMessage;
    const listing = this.#hasTimeOptions && editable;
    if (listing) {
      // The list claims the arrows only while it is open; closed, they keep stepping the time, and
      // Alt+Arrow Down (the APG "open without moving") opens it.
      if (event.key === 'ArrowDown' && event.altKey) {
        event.preventDefault();
        void this.#showTimeList();
        return;
      }
      const options = this.#timeOptions;
      if (this.#timeList.isOpen && options.length > 0) {
        const active = Math.min(this.#highlight, options.length - 1);
        switch (event.key) {
          case 'ArrowDown':
            event.preventDefault();
            this.#followTyping = false;
            this.#highlight = Math.min(options.length - 1, active + 1);
            this.requestUpdate();
            return;
          case 'ArrowUp':
            event.preventDefault();
            this.#followTyping = false;
            this.#highlight = Math.max(0, active - 1);
            this.requestUpdate();
            return;
          case 'Home':
            event.preventDefault();
            this.#followTyping = false;
            this.#highlight = 0;
            this.requestUpdate();
            return;
          case 'End':
            event.preventDefault();
            this.#followTyping = false;
            this.#highlight = options.length - 1;
            this.requestUpdate();
            return;
          case 'Enter': {
            event.preventDefault();
            // Typed text wins over the highlight, which only tracks the option at or before it.
            const draft = this.#timeEntry.text;
            const typed = this.#followTyping && draft !== null ? this.#parseTime(draft) : null;
            const option = options[active];
            if (typed) this.#commitOption(typed);
            else if (option) this.#commitOption(option.time);
            return;
          }
          case 'Tab':
            void this.#hideTimeList();
            return;
          default:
            break;
        }
      }
    }
    if ((event.key === 'ArrowUp' || event.key === 'ArrowDown') && !modified && !event.altKey) {
      event.preventDefault();
      if (editable) this.#step(event.key === 'ArrowUp' ? 1 : -1);
      return;
    }
    if (event.key === 'Enter' && !modified && !event.altKey) {
      this.#commitTimeDraft();
      if (!this.dispatch(new TctEnterEvent())) event.preventDefault();
    }
  };

  /** Steps the time by `time-increment` minutes from what the field shows (else from now), inside its bounds. */
  #step(direction: 1 | -1): void {
    const draft = this.#timeEntry.text;
    const shown = draft !== null && draft.trim() !== '' ? this.#parseTime(draft) : null;
    const base = shown ?? this.#parts.time ?? this.#heldTime ?? this.#now();
    const step = (DATE_TIME_INCREMENTS as readonly number[]).includes(this.timeIncrement)
      ? this.timeIncrement
      : 1;
    const next = adjustTime(base, direction * step, this.hasSeconds);
    if (!isTimeInRange(next, this.#timeMin, this.#timeMax)) return;
    this.#timeEntry.drop();
    this.#commitTime(next);
    // Stepping rewrites the text of a plain textbox, and screen readers do not announce that.
    announce(this.#formatTime(next), {element: this});
    this.requestUpdate();
  }

  // ---------------------------------------------------------------------------------- native events

  #commitNativeDate(control: HTMLInputElement, commit: boolean, event: Event): void {
    event.stopPropagation();
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
      this.#rejectedDate = raw;
      announce(this.#locale.t('@tct.date-input.dateUnavailable'), {
        politeness: 'assertive',
        element: this,
      });
      this.requestUpdate();
      return;
    }
    this.#rejectedDate = null;
    this.#commitDate(raw, {commit});
    if (commit) this.settleChange();
  }

  #commitNativeTime(control: HTMLInputElement, commit: boolean, event: Event): void {
    event.stopPropagation();
    if (!this.canEdit || this.showsDisabledMessage) return;
    const raw = control.value;
    if (raw === '') {
      this.#heldTime = null;
      // An empty time is not a partial value: the date-time goes back to nothing only with its date.
      if (commit) this.settleChange();
      return;
    }
    const time = createISOTimeString(raw);
    if (!time) return;
    if (!isTimeInRange(time, this.#timeMin, this.#timeMax)) {
      this.#rejectedTime = raw;
      announce(this.#locale.t('@tct.timeInput.invalidTime'), {
        politeness: 'assertive',
        element: this,
      });
      this.requestUpdate();
      return;
    }
    this.#rejectedTime = null;
    this.#commitTime(time, {commit});
    if (commit) this.settleChange();
  }

  readonly #onNativeBlur = (event: Event): void => {
    this.settleChange();
    const control = event.target as HTMLInputElement;
    const isTime = control.classList.contains('time');
    if (isTime ? this.#rejectedTime !== null : this.#rejectedDate !== null) {
      if (isTime) {
        this.#rejectedTime = null;
        control.value = this.#parts.time ?? this.#heldTime ?? '';
      } else {
        this.#rejectedDate = null;
        control.value = this.#parts.date ?? '';
      }
      this.requestUpdate();
    }
  };
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-date-time-input': TctDateTimeInput;
  }
}
