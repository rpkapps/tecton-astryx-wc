import {html, nothing, type CSSResultGroup, type PropertyValues, type TemplateResult} from 'lit';
import {property} from 'lit/decorators.js';
import {ifDefined} from 'lit/directives/if-defined.js';
import {repeat} from 'lit/directives/repeat.js';
import calendarMessages from '@tecton-wc/locales/en/calendar.js';
import {announce} from '@tecton-wc/core/a11y/announcer.js';
import {GridFocusController} from '@tecton-wc/core/controllers/grid-focus.js';
import type {
  DateRange,
  DayOfWeek,
  ISODateString,
  PlainDate,
} from '@tecton-wc/core/date/date-types.js';
import {normalizeDayOfWeek} from '@tecton-wc/core/date/date-types.js';
import {
  DATE_FORMAT_MONTH_YEAR,
  DATE_FORMAT_WITH_WEEKDAY,
  getLongWeekdayNames,
  plainDateFormat,
} from '@tecton-wc/core/date/format.js';
import {
  plainDateAddDays,
  plainDateAddMonths,
  plainDateAddYears,
  plainDateFromISO,
  plainDateGetWeekNumber,
  plainDateIsAfter,
  plainDateIsBefore,
  plainDateIsEqual,
  plainDateToday,
  plainDateToISO,
  tryPlainDateFromISO,
} from '@tecton-wc/core/date/plain-date.js';
import {TctFocusDateChangeEvent} from '@tecton-wc/core/events/tct-focus-date-change.js';
import {TctValueChangeEvent} from '@tecton-wc/core/events/tct-value-change.js';
import type {ChangeReason} from '@tecton-wc/core/events/tct-event.js';
import {LocaleController} from '@tecton-wc/core/i18n/locale-controller.js';
import {TctElement, type TctElementConstructor} from '@tecton-wc/core/tct-element.js';
import {devWarn} from '@tecton-wc/core/utils/dev.js';
import {deepActiveElement} from '@tecton-wc/core/utils/focus.js';
import {isImeKeyEvent} from '@tecton-wc/core/utils/ime.js';
import {TctIconButton} from '../icon-button/tct-icon-button.js';
import base from '../styles/base.styles.css';
import focusRing from '../styles/focus-ring.styles.css';
import {createCalendarConstraints, type CalendarConstraints} from './calendar-constraints.js';
import {getCalendarDays, type CalendarDay} from './calendar-days.js';
import {CalendarNavigationController} from './calendar-navigation.js';
import {CALENDAR_MODES, type CalendarMode, type CalendarValue} from './calendar.types.js';
import {
  computeDayCellState,
  computeDayNeighborContinuity,
  computePreviewRounding,
  computeRangeRounding,
  isEndpoint,
} from './day-cell-utils.js';
import {getInitialFocusDate} from './get-initial-focus-date.js';
import styles from './tct-calendar.styles.css';

/** A value attribute: `2026-03-21` for one date, `2026-03-01/2026-03-07` (an ISO 8601 interval) for a range. */
const valueConverter = {
  fromAttribute(text: string | null): CalendarValue | undefined {
    if (text === null || text.trim() === '') return undefined;
    const parts = text.split('/').map((part) => part.trim());
    if (parts.length === 2 && parts[0] && parts[1]) {
      return {start: parts[0] as ISODateString, end: parts[1] as ISODateString};
    }
    return text.trim() as ISODateString;
  },
};

/** The selection the calendar reads from `value` in its current mode. */
interface Selection {
  single: PlainDate | null;
  start: PlainDate | null;
  end: PlainDate | null;
}

/** Steps to look through when the target of a move is unavailable. */
const SCAN_LIMIT = 62;

/**
 * A calendar for picking a date, or a start and an end date, from a month grid. It is the APG date grid:
 * one tab stop, arrow keys move by day and week (mirrored in right-to-left layouts), Home and End go to the
 * start and end of the week, Ctrl or Cmd with Home and End to the first and last day of the grid, PageUp and
 * PageDown move by a month (Shift: by a year) keeping the day of the month, Enter and Space select.
 * Moving past the edge of a month turns the page, and the new month is announced.
 *
 * `mode="single"` (default) holds `value="2026-03-21"`; `mode="range"` holds a range, as a property
 * `{start, end}` or the attribute `value="2026-03-01/2026-03-07"`. In range mode the first pick sets the
 * start and is announced, the second completes the range in chronological order, hovering previews the
 * range, and Escape cancels a pick in progress (the calendar keeps that Escape; without one it falls through
 * to a popover around it). Days before `min`, after `max`, outside `min-range-span` and `max-range-span` of the
 * start, or refused by `dateConstraints` are unavailable: not selectable and not reachable by keyboard.
 *
 * The value is a calendar date (`YYYY-MM-DD`), never a time or a zone; months, weekdays and digits display in
 * the language of the element (Gregorian, so `ar-SA` reads Arabic-Indic digits and `he-IL` Hebrew names).
 * The element holds its own state: setting `value` or `focus-date` never fires an event; a user choosing a
 * date fires the cancelable `tct-value-change`, then `input` and `change`. `navigateTo(date)` shows a month.
 * [mwg:spatial-navigation] [mwg:support-global-calendar-systems] [mwg:capture-location-agnostic-data]
 *
 * @summary A month grid for picking a date or a date range, with the APG date-grid keyboard model.
 * @tag tct-calendar
 * @upstream Calendar
 * @csspart calendar - The painted calendar: header and months.
 * @csspart header - The row with the previous and next buttons and the visible month.
 * @csspart nav - Each of the previous and next month buttons (`data-nav="prev"` or `"next"`).
 * @csspart month-year - The label of the visible month or months.
 * @csspart months - The container of the month grids.
 * @csspart grid - One month grid (`role="grid"`).
 * @csspart day-name - A weekday column header.
 * @csspart week-number - The ISO week number of a row.
 * @csspart day - A day button. `data-selected`, `data-today`, `data-in-range`, `data-outside` and `data-unavailable` mark its state.
 * @fires {TctValueChangeEvent} tct-value-change - Before a user pick changes the value (the date in single mode, the completed range in range mode); cancelable. The first click of a range does not fire it.
 * @fires input - Native, after a user pick changed the value; composed.
 * @fires change - Native, once after `input`; composed.
 * @fires {TctFocusDateChangeEvent} tct-focus-date-change - Before the user moves the visible month; cancelable.
 * @cloakDisplay inline-block
 * @cloakMinBlockSize 18rem
 */
export class TctCalendar extends TctElement {
  static override readonly tagName = 'tct-calendar';
  static override readonly dependencies: readonly TctElementConstructor[] = [TctIconButton];
  static override styles: CSSResultGroup = [base, focusRing, styles];

  /** `single` (default) picks one date; `range` picks a start and an end. */
  @property({reflect: true}) mode: CalendarMode = 'single';

  /**
   * The selected date (`single`: `YYYY-MM-DD`) or range (`range`: `{start, end}`, or the attribute
   * `start/end`). Not reflected; a write never fires an event.
   */
  @property({converter: valueConverter}) value: CalendarValue | undefined;

  /** How many months show side by side: 1 (default) or 2. */
  @property({type: Number, attribute: 'number-of-months'}) numberOfMonths: 1 | 2 = 1;

  /** Earliest selectable date, `YYYY-MM-DD`. */
  @property() min: string | undefined;

  /** Latest selectable date, `YYYY-MM-DD`. */
  @property() max: string | undefined;

  /**
   * Predicates over a local `Date`: a date is unavailable when any of them returns `false` ("weekdays
   * only", "no holidays").
   */
  @property({attribute: false}) dateConstraints: readonly ((date: Date) => boolean)[] | undefined;

  /**
   * Range mode: the most days a range may span, both endpoints counted (`7` is a week). Once a start is
   * picked, days farther from it are unavailable; before that every day stays selectable.
   */
  @property({type: Number, attribute: 'max-range-span'}) maxRangeSpan: number | undefined;

  /**
   * Range mode: the fewest days a range must span, both endpoints counted (`2` forbids a one-day range).
   * Once a start is picked, days nearer than this are unavailable, except the start: clicking it again
   * commits a one-day range when the minimum allows it and otherwise cancels the pick so the start can move.
   */
  @property({type: Number, attribute: 'min-range-span'}) minRangeSpan: number | undefined;

  /**
   * A date in the month to show, `YYYY-MM-DD`. Unset, the calendar opens on the selected date, else today
   * clamped into `min` and `max`. It follows the month the user pages to.
   */
  @property({attribute: 'focus-date'}) focusDate: string | undefined;

  /** Shows no days from the neighbouring months (upstream `hasOutsideDays=false`). */
  @property({type: Boolean, attribute: 'no-outside-days'}) noOutsideDays = false;

  /** Shows the ISO week number of each row. */
  @property({type: Boolean, attribute: 'has-week-numbers'}) hasWeekNumbers = false;

  /** As many weeks as the month needs, instead of a fixed six rows that keep the height steady. */
  @property({type: Boolean, attribute: 'has-variable-row-count'}) hasVariableRowCount = false;

  /** First day of the week: 0 (Sunday, default) to 6, or `sun` to `sat`. */
  @property({attribute: 'week-starts-on'}) weekStartsOn: DayOfWeek | string = 0;

  /** Shows the month of `date` (`YYYY-MM-DD`) without an intent event (upstream `handleRef.navigateTo`). */
  navigateTo(date: string): void {
    const parsed = tryPlainDateFromISO(date);
    if (!parsed) return;
    this.#nav.set(parsed);
    this.focusDate = plainDateToISO(parsed);
  }

  /** Focuses the day that is the tab stop: the selected day, else today, else the first available one. */
  override focus(options?: FocusOptions): void {
    const stop =
      this.renderRoot.querySelector<HTMLElement>('.day[tabindex="0"]') ??
      this.renderRoot.querySelector<HTMLElement>('.day:not([data-outside], [data-unavailable])');
    if (stop) stop.focus(options);
    else super.focus(options);
  }

  readonly #locale: LocaleController = new LocaleController(this, {
    namespace: 'calendar',
    defaults: calendarMessages,
  });

  readonly #nav: CalendarNavigationController = new CalendarNavigationController(this, {
    initial: () => this.#initialFocusDate(),
    numberOfMonths: () => this.#months,
    locale: () => this.#locale.locale,
    request: (next) =>
      this.dispatch(new TctFocusDateChangeEvent(plainDateToISO(next), this.#reason)),
  });

  readonly #grids: GridFocusController[] = [0, 1].map(
    (index) =>
      new GridFocusController(this, {
        container: () => this.renderRoot.querySelectorAll<HTMLElement>('.grid')[index] ?? null,
        columns: 7,
        cellSelector: '[role="gridcell"]',
        // Only in-month, available days take part: outside and unavailable days keep the true geometry
        // (they are cells) but are never a stop, so an arrow key at the edge of a month turns the page.
        isCellFocusable: (cell) =>
          cell.querySelector('.day:not([data-outside], [data-unavailable])') !== null,
        getFocusTarget: (cell) => cell.querySelector<HTMLElement>('.day'),
        hasRovingTabIndex: true,
        initialTabStop: (targets) => this.#seedTabStop(targets),
        onNavigateBefore: (_column, offset) => {
          this.#arrowOffGrid(-offset);
        },
        onNavigateAfter: (_column, offset) => {
          this.#arrowOffGrid(offset);
        },
        onPageUp: (event) => {
          this.#page(-1, event.shiftKey);
        },
        onPageDown: (event) => {
          this.#page(1, event.shiftKey);
        },
      }),
  );

  #today: PlainDate = plainDateToday();
  #rangeAnchor: ISODateString | null = null;
  #hovered: ISODateString | null = null;
  #lastMonthLabel: string | undefined;
  /** What the next focus-date intent event reports as its reason. */
  #reason: ChangeReason = 'trigger';

  constructor() {
    super();
    this.addEventListener('keydown', this.#onKeyDown);
  }

  override connectedCallback(): void {
    super.connectedCallback();
    // "Today" is read once per mount (upstream memoises it), and again when the calendar reconnects.
    this.#today = plainDateToday();
  }

  // ---------------------------------------------------------------------------------- derived

  get #mode(): CalendarMode {
    return this.mode === 'range' ? 'range' : 'single';
  }

  get #months(): 1 | 2 {
    return Number(this.numberOfMonths) === 2 ? 2 : 1;
  }

  get #weekStart(): DayOfWeek {
    return normalizeDayOfWeek(this.weekStartsOn);
  }

  #initialFocusDate(): PlainDate {
    return getInitialFocusDate({
      focusDate: this.focusDate,
      value: this.value,
      min: this.min,
      max: this.max,
      numberOfMonths: this.#months,
      today: this.#today,
    });
  }

  #constraints(): CalendarConstraints {
    return createCalendarConstraints({
      min: this.min,
      max: this.max,
      dateConstraints: this.dateConstraints,
      maxRangeSpan: this.#mode === 'range' ? this.maxRangeSpan : undefined,
      minRangeSpan: this.#mode === 'range' ? this.minRangeSpan : undefined,
      rangeAnchor: this.#mode === 'range' ? tryPlainDateFromISO(this.#rangeAnchor) : null,
    });
  }

  #selection(): Selection {
    const value = this.value;
    if (this.#mode === 'single' && typeof value === 'string') {
      return {single: tryPlainDateFromISO(value), start: null, end: null};
    }
    if (this.#mode === 'range' && typeof value === 'object' && value !== null) {
      let start = tryPlainDateFromISO(value.start);
      let end = tryPlainDateFromISO(value.end);
      if (start && end && plainDateIsAfter(start, end)) [start, end] = [end, start];
      return {single: null, start, end};
    }
    return {single: null, start: null, end: null};
  }

  get #canNavigatePrevious(): boolean {
    const min = tryPlainDateFromISO(this.min);
    if (!min) return true;
    const base = this.#nav.baseMonth;
    return min.year < base.year || (min.year === base.year && min.month < base.month);
  }

  get #canNavigateNext(): boolean {
    const max = tryPlainDateFromISO(this.max);
    if (!max) return true;
    const last = plainDateAddMonths(this.#nav.baseMonth, this.#months - 1);
    return max.year > last.year || (max.year === last.year && max.month > last.month);
  }

  /** The tab stop of a month grid before the user moves: the selected day, else today, else the first. */
  #seedTabStop(targets: HTMLElement[]): HTMLElement | undefined {
    const selection = this.#selection();
    const wanted = [selection.single ?? selection.start, this.#today]
      .filter((date): date is PlainDate => date !== null)
      .map((date) => plainDateToISO(date));
    for (const iso of wanted) {
      const found = targets.find((element) => element.dataset.date === iso);
      if (found) return found;
    }
    return undefined;
  }

  #focusedIso(): ISODateString | null {
    const active = deepActiveElement(this.renderRoot as ShadowRoot);
    const iso = active instanceof HTMLElement ? active.dataset.date : undefined;
    return iso ? (iso as ISODateString) : null;
  }

  // ---------------------------------------------------------------------------------- lifecycle

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('mode') && !CALENDAR_MODES.includes(this.mode)) {
      devWarn(
        'tct-calendar:mode',
        `mode "${String(this.mode)}" is not one of ${CALENDAR_MODES.join(', ')}; using "single".`,
      );
    }
    if (changed.has('focusDate') && this.focusDate) {
      const parsed = tryPlainDateFromISO(this.focusDate);
      if (parsed) this.#nav.set(parsed);
      else devWarn('tct-calendar:focus-date', `focus-date "${this.focusDate}" is not YYYY-MM-DD.`);
    }
    if (changed.has('numberOfMonths') && changed.get('numberOfMonths') !== undefined) {
      // The visible months are derived; nothing to recompute, but the pane count changed the label.
      this.#lastMonthLabel = undefined;
    }
    if (changed.has('mode') && changed.get('mode') !== undefined) {
      this.#rangeAnchor = null;
      this.#hovered = null;
    }
    // A range in progress ends when the calendar is told a new value or new bounds.
    if (changed.has('value') && this.#rangeAnchor !== null && changed.get('value') !== undefined) {
      this.#rangeAnchor = null;
    }
  }

  protected override updated(): void {
    // A page turn is announced (the label is not a live region): not the first render, and not a change
    // of the selection, which does not move the grid.
    const label = this.#nav.monthYearLabel;
    if (this.#lastMonthLabel !== undefined && label !== this.#lastMonthLabel) {
      announce(label, {element: this});
    }
    this.#lastMonthLabel = label;

    const pending = this.#nav.pendingFocus;
    if (pending) {
      this.#nav.clearPendingFocus();
      const target =
        this.renderRoot.querySelector<HTMLElement>(
          `.day[data-date="${pending}"]:not([data-outside], [data-unavailable])`,
        ) ??
        this.renderRoot.querySelector<HTMLElement>('.day:not([data-outside], [data-unavailable])');
      target?.focus();
    }
  }

  // -------------------------------------------------------------------------------- rendering

  override render(): TemplateResult {
    const nav = this.#nav;
    const t = (key: string, args?: Record<string, unknown>): string =>
      this.#locale.t(`@tct.calendar.${key}`, args);
    const previous = t('previousMonth');
    const next = t('nextMonth');
    const constraints = this.#constraints();
    const selection = this.#selection();
    const disabledCache = new Map<string, boolean>();
    const isDisabled = (date: PlainDate): boolean => {
      const key = plainDateToISO(date);
      let result = disabledCache.get(key);
      if (result === undefined) {
        result = constraints.isDateDisabled(date);
        disabledCache.set(key, result);
      }
      return result;
    };

    return html`<div class="calendar" part="calendar" data-mode=${this.#mode}>
      <div class="header" part="header">
        <tct-icon-button
          class="nav"
          part="nav"
          data-nav="prev"
          variant="ghost"
          size="sm"
          icon="chevronLeft"
          label=${previous}
          tooltip=${previous}
          ?disabled=${!this.#canNavigatePrevious}
          @click=${() => {
            this.#step(-1);
          }}
        ></tct-icon-button>
        <span class="month-year" part="month-year">${nav.monthYearLabel}</span>
        <tct-icon-button
          class="nav"
          part="nav"
          data-nav="next"
          variant="ghost"
          size="sm"
          icon="chevronRight"
          label=${next}
          tooltip=${next}
          ?disabled=${!this.#canNavigateNext}
          @click=${() => {
            this.#step(1);
          }}
        ></tct-icon-button>
      </div>
      <div class="months" part="months">
        ${repeat(
          nav.visibleMonths,
          (month) => `${month.year}-${month.month}`,
          (month, index) => this.#renderMonth(month, index, selection, isDisabled),
        )}
      </div>
    </div>`;
  }

  #renderMonth(
    month: PlainDate,
    paneIndex: number,
    selection: Selection,
    isDisabled: (date: PlainDate) => boolean,
  ): TemplateResult {
    const locale = this.#locale.locale;
    const weekStart = this.#weekStart;
    const {weeks, dayNames} = getCalendarDays({
      year: month.year,
      month: month.month,
      weekStartsOn: weekStart,
      hasVariableRowCount: this.hasVariableRowCount,
      locale,
    });
    const longNames = getLongWeekdayNames(locale);
    const monthLabel = plainDateFormat(month, DATE_FORMAT_MONTH_YEAR, locale);
    const mode = this.#mode;

    let rangeStart = selection.start;
    let rangeEnd = selection.end;
    const anchor = mode === 'range' ? tryPlainDateFromISO(this.#rangeAnchor) : null;
    if (anchor) {
      rangeStart = anchor;
      rangeEnd = anchor;
    }
    let previewStart: PlainDate | null = null;
    let previewEnd: PlainDate | null = null;
    const hovered = tryPlainDateFromISO(this.#hovered);
    if (mode === 'range' && anchor && hovered && !plainDateIsEqual(anchor, hovered)) {
      [previewStart, previewEnd] = plainDateIsBefore(hovered, anchor)
        ? [hovered, anchor]
        : [anchor, hovered];
    }

    return html`<div class="month" data-pane=${paneIndex}>
      <div
        class="grid"
        part="grid"
        role="grid"
        aria-label=${monthLabel}
        aria-multiselectable=${mode === 'range' ? 'true' : nothing}
        ?data-week-numbers=${this.hasWeekNumbers}
        @keydown=${this.#grids[paneIndex]!.handleKeyDown}
        @focusin=${this.#grids[paneIndex]!.handleFocus}
      >
        <div class="row" role="row">
          ${this.hasWeekNumbers ? html`<div class="day-name" role="columnheader"></div>` : nothing}
          ${dayNames.map(
            (name, offset) =>
              html`<div
                class="day-name"
                part="day-name"
                role="columnheader"
                aria-label=${longNames[(weekStart + offset) % 7]!}
              >
                ${name}
              </div>`,
          )}
        </div>
        ${weeks.map((week) => {
          const weekDate = week.find((day) => !day.isOutside)?.date ?? week[0]!.date;
          return html`<div class="row" role="row">
            ${
              this.hasWeekNumbers
                ? html`<div class="week-number" part="week-number" role="rowheader">
                    ${plainDateGetWeekNumber(weekDate)}
                  </div>`
                : nothing
            }
            ${week.map((day, dayIndex) => {
              const neighbors = computeDayNeighborContinuity({
                week,
                dayIndex,
                mode,
                rangeStart,
                rangeEnd,
                previewStart,
                previewEnd,
                isDisabled,
              });
              return this.#renderDay(day, dayIndex, {
                selection,
                rangeStart,
                rangeEnd,
                previewStart,
                previewEnd,
                disabled: isDisabled(day.date),
                neighbors,
              });
            })}
          </div>`;
        })}
      </div>
    </div>`;
  }

  #renderDay(
    day: CalendarDay,
    dayIndex: number,
    context: {
      selection: Selection;
      rangeStart: PlainDate | null;
      rangeEnd: PlainDate | null;
      previewStart: PlainDate | null;
      previewEnd: PlainDate | null;
      disabled: boolean;
      neighbors: ReturnType<typeof computeDayNeighborContinuity>;
    },
  ): TemplateResult {
    if (day.isOutside && this.noOutsideDays) {
      // An empty placeholder is still a cell, so the grid keeps seven columns for keyboard navigation.
      return html`<div class="cell" role="gridcell"></div>`;
    }
    const locale = this.#locale.locale;
    const mode = this.#mode;
    const state = computeDayCellState({
      date: day.date,
      dayIndex,
      mode,
      selectedDate: context.selection.single,
      rangeStart: context.rangeStart,
      rangeEnd: context.rangeEnd,
      previewStart: context.previewStart,
      previewEnd: context.previewEnd,
      today: this.#today,
      isDisabled: context.disabled,
      isOutside: day.isOutside,
    });
    const endpoint = isEndpoint(state);
    const dateLabel = plainDateFormat(day.date, DATE_FORMAT_WITH_WEEKDAY, locale);
    const t = (key: string): string => this.#locale.t(`@tct.calendar.${key}`, {date: dateLabel});
    const inProgress = this.#rangeAnchor !== null;
    // The button, not the cell, takes focus, and aria-selected is not valid on a button: the selection
    // is part of its name (WCAG 4.1.2).
    const label = state.isSelected
      ? t('daySelected')
      : state.isRangeStart && state.isRangeEnd
        ? inProgress
          ? t('dayRangeStart')
          : t('dayRangeStartAndEnd')
        : state.isRangeStart
          ? t('dayRangeStart')
          : state.isRangeEnd
            ? t('dayRangeEnd')
            : state.isInRange
              ? t('dayInRange')
              : dateLabel;
    const rangeRounding = computeRangeRounding(state, {
      prevInRange: context.neighbors.prevInRange,
      nextInRange: context.neighbors.nextInRange,
    });
    const previewRounding = computePreviewRounding(state, {
      prevInPreview: context.neighbors.prevInPreview,
      nextInPreview: context.neighbors.nextInPreview,
    });
    const inert = state.effectivelyDisabled;

    return html`<div
      class="cell"
      role="gridcell"
      aria-selected=${state.isSelected || state.isInRange ? 'true' : nothing}
    >
      ${
        state.isInRange
          ? html`<div
              class="range-bg"
              ?data-round-start=${rangeRounding.roundStart}
              ?data-round-end=${rangeRounding.roundEnd}
              ?data-start=${state.isRangeStart}
              ?data-end=${state.isRangeEnd}
            ></div>`
          : nothing
      }
      ${
        state.isInPreview
          ? html`<div
              class="preview-bg"
              ?data-round-start=${previewRounding.roundStart}
              ?data-round-end=${previewRounding.roundEnd}
            ></div>`
          : nothing
      }
      <button
        type="button"
        class="day focus-ring"
        part="day"
        data-date=${day.iso}
        aria-label=${label}
        aria-current=${state.isToday ? 'date' : nothing}
        aria-disabled=${inert ? 'true' : nothing}
        ?disabled=${context.disabled && !day.isOutside}
        ?data-selected=${endpoint}
        ?data-today=${state.isToday}
        ?data-in-range=${state.isInRange}
        ?data-outside=${day.isOutside}
        ?data-unavailable=${context.disabled}
        tabindex=${ifDefined(inert ? '-1' : undefined)}
        @click=${() => {
          if (!inert) this.#onDayClick(day.date);
        }}
        @mouseenter=${() => {
          if (!inert) this.#setHovered(day.iso);
        }}
        @mouseleave=${() => {
          this.#setHovered(null);
        }}
      >
        ${day.dayNumber}
      </button>
    </div>`;
  }

  // ---------------------------------------------------------------------------------- selection

  #setHovered(iso: ISODateString | null): void {
    if (this.#hovered === iso) return;
    this.#hovered = iso;
    if (this.#rangeAnchor !== null) this.requestUpdate();
  }

  /** Commits a value for the user: the cancelable intent first, then the change events. */
  #commit(next: CalendarValue, reason: ChangeReason): boolean {
    if (!this.dispatch(new TctValueChangeEvent<CalendarValue>(next, this.value, reason)))
      return false;
    this.value = next;
    this.dispatchEvent(new Event('input', {bubbles: true, composed: true}));
    this.dispatchEvent(new Event('change', {bubbles: true, composed: true}));
    return true;
  }

  #onDayClick(date: PlainDate): void {
    const iso = plainDateToISO(date);
    const locale = this.#locale.locale;
    const spoken = (value: PlainDate): string =>
      plainDateFormat(value, DATE_FORMAT_WITH_WEEKDAY, locale);

    if (this.#mode === 'single') {
      this.#commit(iso, 'selection');
      return;
    }

    const anchor = tryPlainDateFromISO(this.#rangeAnchor);
    if (!anchor) {
      // Nothing else about a first pick is perceivable without sight (the grid does not move), so the
      // progress is spoken (WCAG 1.3.1).
      this.#rangeAnchor = iso;
      this.requestUpdate();
      announce(this.#locale.t('@tct.calendar.rangeStartAnnounce', {date: spoken(date)}), {
        element: this,
      });
      return;
    }

    // Clicking the start again is a one-day range when the minimum allows it; with a longer minimum it
    // clears the pick, the only nearby day that stays enabled, so the start can still be moved.
    if (plainDateIsEqual(date, anchor) && (this.minRangeSpan ?? 1) > 1) {
      this.#rangeAnchor = null;
      this.requestUpdate();
      announce(this.#locale.t('@tct.calendar.rangeClearedAnnounce', {date: spoken(date)}), {
        element: this,
      });
      return;
    }

    const [start, end] = plainDateIsBefore(date, anchor) ? [date, anchor] : [anchor, date];
    const range: DateRange = {start: plainDateToISO(start), end: plainDateToISO(end)};
    if (!this.#commit(range, 'selection')) return;
    this.#rangeAnchor = null;
    this.#hovered = null;
    this.requestUpdate();
    announce(
      this.#locale.t('@tct.calendar.rangeCompleteAnnounce', {
        start: spoken(start),
        end: spoken(end),
      }),
      {element: this},
    );
  }

  // ---------------------------------------------------------------------------------- navigation

  #step(delta: number): void {
    this.#reason = 'trigger';
    this.#nav.navigateMonth(delta);
    this.#syncFocusDateProperty();
  }

  /** `focus-date` follows the page the user turned to. */
  #syncFocusDateProperty(): void {
    this.focusDate = plainDateToISO(this.#nav.focusDate);
  }

  /**
   * Resolves where a keyboard move lands: `target` clamped into `min`..`max`, else the nearest available
   * day in the direction of travel (then against it). `null` when nothing is available.
   */
  #resolve(target: PlainDate, direction: 1 | -1, step = 1): PlainDate | null {
    const {isDateDisabled, minDate, maxDate} = this.#constraints();
    let date = target;
    if (minDate && plainDateIsBefore(date, minDate)) date = minDate;
    if (maxDate && plainDateIsAfter(date, maxDate)) date = maxDate;
    for (const heading of [direction, -direction] as const) {
      let candidate = date;
      for (let count = 0; count < SCAN_LIMIT; count++) {
        if (!isDateDisabled(candidate)) return candidate;
        candidate = plainDateAddDays(candidate, heading * step);
        if (
          (minDate && plainDateIsBefore(candidate, minDate)) ||
          (maxDate && plainDateIsAfter(candidate, maxDate))
        ) {
          break;
        }
      }
    }
    return null;
  }

  /** Moves focus to a date: in the visible months it takes focus directly, else the month turns first. */
  #moveTo(target: PlainDate, direction: 1 | -1, step = 1): void {
    const resolved = this.#resolve(target, direction, step);
    if (!resolved) return;
    this.#reason = 'keyboard';
    if (this.#nav.isMonthVisible(resolved)) {
      const button = this.renderRoot.querySelector<HTMLElement>(
        `.day[data-date="${plainDateToISO(resolved)}"]:not([data-outside], [data-unavailable])`,
      );
      button?.focus();
      return;
    }
    if (this.#nav.showDate(resolved)) this.#syncFocusDateProperty();
  }

  /** An arrow key ran off the grid: continue by `delta` days from the focused day. */
  #arrowOffGrid(delta: number): void {
    const focused = this.#focusedIso();
    if (!focused) return;
    const from = plainDateFromISO(focused);
    this.#moveTo(plainDateAddDays(from, delta), delta > 0 ? 1 : -1, Math.abs(delta));
  }

  /** PageUp / PageDown: the same day a month (Shift: a year) away, clamped to the shorter month. */
  #page(direction: 1 | -1, byYear: boolean): void {
    const focused = this.#focusedIso();
    if (!focused) return;
    const from = plainDateFromISO(focused);
    this.#moveTo(
      byYear ? plainDateAddYears(from, direction) : plainDateAddMonths(from, direction),
      direction,
    );
  }

  // ---------------------------------------------------------------------------------- keyboard

  readonly #onKeyDown = (event: KeyboardEvent): void => {
    if (isImeKeyEvent(event) || event.key !== 'Escape') return;
    if (this.#mode !== 'range' || this.#rangeAnchor === null) return;
    // Escape cancels a pick in progress and stops there: it must not also close a popover around us.
    this.#rangeAnchor = null;
    this.#hovered = null;
    this.requestUpdate();
    event.preventDefault();
    event.stopPropagation();
  };
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-calendar': TctCalendar;
  }
}
