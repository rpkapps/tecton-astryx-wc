import {html, nothing, type CSSResultGroup, type PropertyValues, type TemplateResult} from 'lit';
import {property} from 'lit/decorators.js';
import {ifDefined} from 'lit/directives/if-defined.js';
import dateInputMessages from '@tecton-wc/locales/en/dateInput.js';
import dateInputExtra from '@tecton-wc/locales/en/date-input.js';
import dateRangeInputMessages from '@tecton-wc/locales/en/dateRangeInput.js';
import fieldMessages from '@tecton-wc/locales/en/field.js';
import type {DateRange, DayOfWeek} from '@tecton-wc/core/date/date-types.js';
import {
  DATE_FORMAT_SHORT,
  DATE_FORMAT_SHORT_WITH_YEAR,
  plainDateFormat,
} from '@tecton-wc/core/date/format.js';
import {
  plainDateDiffDays,
  plainDateIsAfter,
  plainDateToday,
  plainDateToISO,
  tryPlainDateFromISO,
} from '@tecton-wc/core/date/plain-date.js';
import {LocaleController} from '@tecton-wc/core/i18n/locale-controller.js';
import {nativeMessage} from '@tecton-wc/core/forms/validators.js';
import type {Validator} from '@tecton-wc/core/mixins/form-control.js';
import type {TctElementConstructor} from '@tecton-wc/core/tct-element.js';
import {devWarn} from '@tecton-wc/core/utils/dev.js';
import {createCalendarConstraints} from '../calendar/calendar-constraints.js';
import {getInitialFocusDate} from '../calendar/get-initial-focus-date.js';
import {TctCalendar} from '../calendar/tct-calendar.js';
import {DATE_RANGE_PRESENTATIONS, type DateRangePreset} from './date-range-input.types.js';
import {TctPickerField} from '../date-input/tct-picker-field.js';
import type {TimePresentation} from '../date-input/picker-presentation.js';
import styles from './tct-date-range-input.styles.css';

/** A range as its ISO 8601 interval, `start/end`, both real dates, the earlier first; `null` for anything else. */
function parseInterval(value: string | null | undefined): DateRange | null {
  const parts = String(value ?? '')
    .trim()
    .split('/');
  if (parts.length !== 2) return null;
  const first = tryPlainDateFromISO(parts[0]!.trim());
  const second = tryPlainDateFromISO(parts[1]!.trim());
  if (!first || !second) return null;
  const [start, end] = plainDateIsAfter(first, second) ? [second, first] : [first, second];
  return {start: plainDateToISO(start), end: plainDateToISO(end)};
}

const intervalOf = (range: DateRange): string => `${range.start}/${range.end}`;

/** Both endpoints counted, so a single day is a span of 1. */
function spanOf(range: DateRange): number {
  const start = tryPlainDateFromISO(range.start);
  const end = tryPlainDateFromISO(range.end);
  return start && end ? Math.abs(plainDateDiffDays(start, end)) + 1 : 0;
}

/**
 * A date range field: a button that shows the range ("Jan 5 – Jan 9", the year added when it is not the
 * current one) and opens a calendar of two months under it, with optional presets ("Last 7 days") beside it.
 * The first click in the calendar picks the start, the second the end; a preset applies at once. On a
 * compact touch device the picker is a bottom sheet with one month.
 *
 * It is a form-associated element that submits the range as an ISO 8601 interval, `2026-01-05/2026-01-09`
 * (or an empty string for an empty field), whatever the locale, calendar or time zone; the same string is `value`,
 * and `range` reads and writes it as `{start, end}`. It resets to its `value` attribute and restores like a
 * native input. `input` and then `change` fire when a user picks a range, applies a preset or clears it;
 * nothing fires for a property or attribute write. `min`, `max` and `dateConstraints` bound the days that can
 * be picked and are constraints on the value; `max-range-span` and `min-range-span` bound the length of the
 * range being picked and never rewrite a value that is already outside them. The `value` is invalid, and
 * shown so, after the user acted (a pick, leaving the field after an edit) or a submit attempt.
 * [mwg:capture-location-agnostic-data] [mwg:support-global-calendar-systems]
 * [mwg:validate-input-after-interaction] [mwg:form-associated-custom-elements]
 *
 * @summary Date range field: a button that opens a two-month range calendar with optional presets.
 * @tag tct-date-range-input
 * @upstream DateRangeInput
 * @csspart field - The whole field: label, control and status.
 * @csspart label - The label.
 * @csspart description - The description.
 * @csspart label-indicator - The "Required" or "Optional" text.
 * @csspart label-tip - The info-tip button.
 * @csspart label-icon - The icon before the label text.
 * @csspart input - The painted box around the trigger.
 * @csspart toggle-icon - The calendar icon at the start of the box.
 * @csspart control - The trigger button that shows the range.
 * @csspart picker - The positioned popover layer.
 * @csspart picker-surface - The painted popover surface that holds the presets and the calendar.
 * @csspart picker-close-button - The close button, revealed only when keyboard focus reaches it.
 * @csspart sheet - The bottom sheet of the touch presentation.
 * @csspart presets - The group of preset buttons.
 * @csspart preset - A preset button.
 * @csspart calendar - The range calendar inside the picker.
 * @csspart status-icon - The status icon inside the box.
 * @csspart status-button - The status button of the `tooltip` status variant.
 * @csspart status - The status message box.
 * @cssstate open - The picker is open.
 * @cssstate user-invalid - Invalidity is displayed.
 * @cssstate invalid - The value does not satisfy its constraints (not displayed).
 * @cssstate busy - A `changeAction` is pending or `loading` is set.
 * @fires input - Native, when a user picked a range, applied a preset or cleared it; composed.
 * @fires change - Native, right after that `input`; composed and dispatched from the host.
 * @fires tct-clear - The user pressed the clear button; cancelable, and preventing it keeps the value.
 * @fires {TctOpenChangeEvent} tct-open-change - Before the user opens or closes the picker (the trigger, Escape, an outside press, a pick); cancelable.
 * @fires {TctAfterOpenChangeEvent} tct-after-open-change - After the picker opened or closed and settled.
 * @cloakDisplay block
 * @cloakMinBlockSize 4.5rem
 */
export class TctDateRangeInput extends TctPickerField {
  static override readonly tagName = 'tct-date-range-input';
  static override readonly dependencies: readonly TctElementConstructor[] = [
    ...TctPickerField.dependencies,
    TctCalendar,
  ];
  static override styles: CSSResultGroup = [TctPickerField.styles, styles];

  /** Shows the clear (x) button while there is a range. On by default; `no-clear` turns it off. */
  @property({type: Boolean, attribute: 'no-clear'}) noClear = false;

  /** Earliest selectable date, `YYYY-MM-DD`. A range starting earlier is `rangeUnderflow`. */
  @property() min: string | undefined;

  /** Latest selectable date, `YYYY-MM-DD`. A range ending later is `rangeOverflow`. */
  @property() max: string | undefined;

  /** Predicates over a local `Date`: a day is unavailable when any returns `false`. */
  @property({attribute: false}) dateConstraints: readonly ((date: Date) => boolean)[] | undefined;

  /**
   * The most days a picked range may span, both endpoints counted: `7` allows a start and six more days.
   * Once the start is picked, later days are unavailable. It limits the pick only: it never rewrites a value
   * that is already longer, and a preset that breaks it is disabled.
   */
  @property({type: Number, attribute: 'max-range-span'}) maxRangeSpan: number | undefined;

  /**
   * The fewest days a picked range may span, both endpoints counted: `2` forbids a one-day range. Once the
   * start is picked, nearer days are unavailable, except the start itself.
   */
  @property({type: Number, attribute: 'min-range-span'}) minRangeSpan: number | undefined;

  /** Quick-select ranges beside the calendar; a preset that breaks `min`, `max`, `dateConstraints` or a span is disabled. */
  @property({attribute: false}) presets: readonly DateRangePreset[] | undefined;

  /** How many months the calendar shows side by side: 2 (default) or 1. A bottom sheet always shows one. */
  @property({type: Number, attribute: 'number-of-months'}) numberOfMonths: 1 | 2 = 2;

  /** First day of the week in the calendar: 0 (Sunday, default) to 6, or `sun` to `sat`. */
  @property({attribute: 'week-starts-on'}) weekStartsOn: DayOfWeek | string = 0;

  /**
   * The range as an ISO 8601 interval, `2026-01-05/2026-01-09`, or `""`. Anything that is not two real dates
   * reads as `""`; a reversed pair is put in order. The `value` attribute is the default a form reset restores.
   */
  @property({attribute: false})
  override get value(): string {
    return TctDateRangeInput.#sanitize(super.value);
  }
  override set value(value: string) {
    super.value = TctDateRangeInput.#sanitize(value);
  }

  /** The range as `{start, end}` (ISO dates), or `null` for none. Writing it never fires an event. */
  get range(): DateRange | null {
    return parseInterval(this.value);
  }
  set range(range: DateRange | null | undefined) {
    this.value = range ? intervalOf(range) : '';
  }

  readonly #locale: LocaleController = new LocaleController(this, {
    namespace: 'dateRangeInput',
    defaults: {
      ...dateRangeInputMessages,
      ...dateInputMessages,
      ...dateInputExtra,
      ...fieldMessages,
    },
  });

  static #sanitize(value: string | null | undefined): string {
    const range = parseInterval(value);
    return range ? intervalOf(range) : '';
  }

  protected override sanitize(value: string): string {
    return TctDateRangeInput.#sanitize(value);
  }

  // ------------------------------------------------------------------------------ mixin hooks

  protected override get pickerKind(): 'date' {
    return 'date';
  }

  /** There is no native range control: a popover, a bottom sheet, or the popover with a bottom sheet on touch. */
  protected override get presentationPolicy(): TimePresentation {
    const presentation = this.presentation;
    return (DATE_RANGE_PRESENTATIONS as readonly string[]).includes(presentation ?? '')
      ? presentation!
      : 'adaptive-bottom-sheet';
  }

  protected override get formControl(): HTMLButtonElement | null {
    return this.renderRoot.querySelector<HTMLButtonElement>('button.trigger');
  }

  protected override get toggleButton(): HTMLElement | null {
    return this.formControl;
  }

  protected override get validators(): Validator<this>[] {
    return [
      (field) =>
        field.required && !field.optional && field.value === ''
          ? {flags: {valueMissing: true}, message: nativeMessage('text')}
          : null,
      (field) => {
        const range = field.range;
        if (!range) return null;
        const {minDate, maxDate} = createCalendarConstraints({min: field.min, max: field.max});
        if (minDate && range.start < plainDateToISO(minDate)) {
          return {flags: {rangeUnderflow: true}, message: nativeMessage('invalid')};
        }
        if (maxDate && range.end > plainDateToISO(maxDate)) {
          return {flags: {rangeOverflow: true}, message: nativeMessage('invalid')};
        }
        return null;
      },
      (field) => {
        const range = field.range;
        if (!range || !field.dateConstraints) return null;
        const {isDateDisabled} = field.#constraints();
        const start = tryPlainDateFromISO(range.start);
        const end = tryPlainDateFromISO(range.end);
        return (start && isDateDisabled(start)) || (end && isDateDisabled(end))
          ? {
              flags: {customError: true},
              message: field.#locale.t('@tct.date-input.dateUnavailable'),
            }
          : null;
      },
    ];
  }

  /** Focuses the trigger button. */
  override focus(options?: FocusOptions): void {
    const control = this.formControl;
    if (control) control.focus(options);
    else super.focus(options);
  }

  protected override clearValue(): void {
    this.commitValue('');
  }

  protected override warnEnum(name: string, value: string): void {
    devWarn(
      `date-range-input:${name}:${value}`,
      `${name} "${value}" is not one of ${DATE_RANGE_PRESENTATIONS.join(', ')}; using "adaptive-bottom-sheet".`,
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

  /** "Jan 5 – Jan 9", with the year on both ends unless the range is inside the current year. */
  get #displayText(): string {
    const range = this.range;
    if (!range) return '';
    const start = tryPlainDateFromISO(range.start);
    const end = tryPlainDateFromISO(range.end);
    if (!start || !end) return '';
    const sameYear = start.year === end.year && start.year === plainDateToday().year;
    const format = sameYear ? DATE_FORMAT_SHORT : DATE_FORMAT_SHORT_WITH_YEAR;
    const locale = this.#locale.locale;
    return `${plainDateFormat(start, format, locale)} – ${plainDateFormat(end, format, locale)}`;
  }

  get #placeholderText(): string {
    return this.placeholder || this.#locale.t('@tct.dateRangeInput.placeholder');
  }

  // --------------------------------------------------------------------------------- picker hooks

  protected override get dialogLabel(): string {
    return this.#locale.t('@tct.dateRangeInput.dialogLabel');
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

  /** The calendar opens on the start of the range, else today clamped into the window. */
  protected override async preparePicker(): Promise<void> {
    const calendar = this.#calendar;
    if (!calendar) return;
    const range = this.range;
    const focus = getInitialFocusDate({
      value: range ?? undefined,
      min: this.min,
      max: this.max,
      numberOfMonths: this.#months,
      today: plainDateToday(),
    });
    calendar.value = range ?? undefined;
    calendar.navigateTo(plainDateToISO(focus));
    await calendar.updateComplete;
  }

  get #months(): 1 | 2 {
    return this.surface === 'sheet' || this.numberOfMonths === 1 ? 1 : 2;
  }

  protected override renderPickerContent(surface: 'popover' | 'sheet'): TemplateResult {
    const presets = this.presets ?? [];
    return html`<div class="layout" data-surface=${surface}>
      ${
        presets.length > 0
          ? html`<div
              class="presets"
              part="presets"
              role="group"
              aria-label=${this.#locale.t('@tct.dateRangeInput.presetDateRanges')}
            >
              ${presets.map((preset) => this.#renderPreset(preset))}
            </div>`
          : nothing
      }
      <tct-calendar
        class="calendar"
        part="calendar"
        mode="range"
        .value=${this.range ?? undefined}
        min=${ifDefined(this.min)}
        max=${ifDefined(this.max)}
        .dateConstraints=${this.dateConstraints}
        max-range-span=${ifDefined(this.maxRangeSpan)}
        min-range-span=${ifDefined(this.minRangeSpan)}
        number-of-months=${this.#months}
        week-starts-on=${String(this.weekStartsOn)}
        @change=${this.#onCalendarChange}
        @input=${this.#stop}
        @tct-value-change=${this.#stop}
      ></tct-calendar>
    </div>`;
  }

  #renderPreset(preset: DateRangePreset): TemplateResult {
    const range = preset.getRange();
    const current = this.range;
    const active = current?.start === range.start && current.end === range.end;
    return html`<button
      type="button"
      class="preset focus-ring"
      part="preset"
      aria-current=${ifDefined(active ? 'true' : undefined)}
      ?disabled=${this.#isPresetDisabled(range)}
      @click=${() => {
        this.#apply(range);
      }}
    >
      ${preset.label}
    </button>`;
  }

  /** A preset is disabled by an unavailable endpoint or a span outside `min-range-span` / `max-range-span`. */
  #isPresetDisabled(range: DateRange): boolean {
    const span = spanOf(range);
    if (this.maxRangeSpan != null && span > this.maxRangeSpan) return true;
    if (this.minRangeSpan != null && span < this.minRangeSpan) return true;
    const {isDateDisabled} = this.#constraints();
    const start = tryPlainDateFromISO(range.start);
    const end = tryPlainDateFromISO(range.end);
    return !start || !end || isDateDisabled(start) || isDateDisabled(end);
  }

  #apply(range: DateRange): void {
    this.commitValue(intervalOf(range));
    this.requestOpen(false, 'selection');
  }

  /** The calendar's own events describe its selection, not the field's: only the field's commit leaves it. */
  readonly #stop = (event: Event): void => {
    event.stopPropagation();
  };

  readonly #onCalendarChange = (event: Event): void => {
    event.stopPropagation();
    const value = (event.currentTarget as TctCalendar).value;
    if (typeof value === 'object' && value !== null) this.#apply(value);
  };

  // ---------------------------------------------------------------------------------- lifecycle

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed);
    if ((changed.has('min') || changed.has('max')) && this.min && this.max && this.min > this.max) {
      devWarn(`date-range-input:min-max`, `min (${this.min}) is after max (${this.max}).`);
    }
    if (
      (changed.has('minRangeSpan') || changed.has('maxRangeSpan')) &&
      this.minRangeSpan != null &&
      this.maxRangeSpan != null &&
      this.minRangeSpan > this.maxRangeSpan
    ) {
      devWarn(
        `date-range-input:span`,
        `min-range-span (${this.minRangeSpan}) is above max-range-span (${this.maxRangeSpan}).`,
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
    const inert = this.showsDisabledMessage;
    const disabled = this.isDisabled;
    const text = this.#displayText;
    const shown = text || this.#placeholderText;
    const content = html`
      <tct-icon
        class="toggle-icon"
        part="toggle-icon"
        name="calendar"
        size="sm"
        color="secondary"
      ></tct-icon>
      <button
        type="button"
        class="input trigger"
        part="control"
        ?data-placeholder=${!text}
        ?disabled=${disabled && !inert}
        aria-disabled=${ifDefined(inert || this.busy ? 'true' : undefined)}
        aria-label=${`${this.label}: ${shown}`}
        aria-required=${ifDefined(
          (this.required && !this.optional) || (!this.required && this.announcesRequired)
            ? 'true'
            : undefined,
        )}
        aria-busy=${ifDefined(this.busy ? 'true' : undefined)}
        aria-expanded=${this.open ? 'true' : 'false'}
        aria-haspopup="dialog"
        aria-controls=${ifDefined(this.open && this.surface === 'popover' ? this.pickerId : undefined)}
        @click=${this.onToggleClick}
      >
        ${shown}
      </button>
      ${this.renderClear(!this.noClear && this.value !== '')}
      ${this.renderBusy()}${this.effectiveStatus ? this.renderStatusIcon() : nothing}
    `;
    return this.renderFieldLayout(
      html`${this.renderBoxWrapper(content)}${this.renderPickerSurface()}`,
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-date-range-input': TctDateRangeInput;
  }
}
