/**
 * Which months a calendar shows and how it moves between them (upstream `useCalendarNavigation`, MIT,
 * adapted as a reactive controller). The controller owns the *visible* month (the "focus date"), asks the
 * host before every user-initiated change (the host raises the cancelable `tct-focus-date-change`), and
 * remembers which date should take keyboard focus once the new month has rendered (`pendingFocus`), so
 * an arrow key across a month boundary lands on the neighbouring day.
 *
 * Property writes never ask: `set()` is what the host calls for `focus-date` and `navigateTo()`.
 */
import type {ReactiveController, ReactiveControllerHost} from 'lit';
import type {ISODateString, PlainDate} from '@tecton-wc/core/date/date-types.js';
import {DATE_FORMAT_MONTH_YEAR, plainDateFormat} from '@tecton-wc/core/date/format.js';
import {
  plainDateAddDays,
  plainDateAddMonths,
  plainDateSetFirstOfMonth,
  plainDateToISO,
} from '@tecton-wc/core/date/plain-date.js';

export interface CalendarNavigationOptions {
  /** The date to start on. */
  initial: () => PlainDate;
  /** One or two panes. */
  numberOfMonths: () => number;
  locale: () => string;
  /**
   * Asked before a user-initiated move; return `false` to keep the visible month (the host dispatches the
   * cancelable event and returns whether it was left alone).
   */
  request: (next: PlainDate) => boolean;
}

export class CalendarNavigationController implements ReactiveController {
  readonly #host: ReactiveControllerHost;
  readonly #options: CalendarNavigationOptions;
  #focusDate: PlainDate | undefined;
  #pendingFocus: ISODateString | null = null;

  constructor(host: ReactiveControllerHost, options: CalendarNavigationOptions) {
    this.#host = host;
    this.#options = options;
    host.addController(this);
  }

  hostConnected(): void {
    // Nothing to attach: the state is plain data.
  }

  /** The date whose month is the first visible one. */
  get focusDate(): PlainDate {
    return (this.#focusDate ??= this.#options.initial());
  }

  /** Sets the visible month without asking (property writes, `navigateTo()`). */
  set(date: PlainDate): void {
    const current = this.#focusDate;
    this.#focusDate = date;
    if (current?.year !== date.year || current.month !== date.month || current.day !== date.day) {
      this.#host.requestUpdate();
    }
  }

  /** The first day of the first visible month. */
  get baseMonth(): PlainDate {
    return plainDateSetFirstOfMonth(this.focusDate);
  }

  /** The first day of each visible month. */
  get visibleMonths(): PlainDate[] {
    const base = this.baseMonth;
    return Array.from({length: this.#options.numberOfMonths()}, (_, index) =>
      plainDateAddMonths(base, index),
    );
  }

  /** "January 2026", or "January 2026 – February 2026" with two months. */
  get monthYearLabel(): string {
    const locale = this.#options.locale();
    return this.visibleMonths
      .map((month) => plainDateFormat(month, DATE_FORMAT_MONTH_YEAR, locale))
      .join(' – ');
  }

  /** The date that should take focus after the next render, if any. */
  get pendingFocus(): ISODateString | null {
    return this.#pendingFocus;
  }

  clearPendingFocus(): void {
    this.#pendingFocus = null;
  }

  /** Whether a date's month is currently visible. */
  isMonthVisible(date: PlainDate): boolean {
    return this.visibleMonths.some(
      (month) => month.year === date.year && month.month === date.month,
    );
  }

  /**
   * Moves the visible month by `delta`. With `focusedDate`, focus follows to `focusedDate + delta *
   * offset` days (1 for a horizontal arrow, 7 for a vertical one). Returns whether the move happened.
   */
  navigateMonth(
    delta: number,
    focusedDate?: ISODateString,
    offset = 7,
    focus?: PlainDate,
  ): boolean {
    const next = plainDateAddMonths(this.baseMonth, delta);
    if (!this.#options.request(next)) return false;
    if (focus) this.#pendingFocus = plainDateToISO(focus);
    else if (focusedDate) {
      const [year, month, day] = focusedDate.split('-').map(Number);
      const from: PlainDate = {year: year!, month: month!, day: day!};
      this.#pendingFocus = plainDateToISO(plainDateAddDays(from, delta * offset));
    }
    this.set(next);
    return true;
  }

  /**
   * Shows the month of `date` (as the first pane, or as the last pane when it lies before the visible
   * months and two are shown), focusing `date` afterwards. Returns whether the move happened.
   */
  showDate(date: PlainDate, focus = true): boolean {
    if (this.isMonthVisible(date)) {
      if (focus) this.#pendingFocus = plainDateToISO(date);
      this.#host.requestUpdate();
      return true;
    }
    const first = this.visibleMonths[0]!;
    const before = date.year < first.year || (date.year === first.year && date.month < first.month);
    const panes = this.#options.numberOfMonths();
    const next = before
      ? plainDateSetFirstOfMonth(date)
      : plainDateAddMonths(plainDateSetFirstOfMonth(date), -(panes - 1));
    if (!this.#options.request(next)) return false;
    if (focus) this.#pendingFocus = plainDateToISO(date);
    this.set(next);
    return true;
  }
}
