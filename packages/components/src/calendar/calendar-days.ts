/**
 * The days a month grid shows (upstream `useCalendarDays`, MIT, adapted as a pure function: a
 * controller adds nothing to a calculation that depends only on its inputs, so the host calls it
 * during render and Lit re-renders on the inputs' changes).
 *
 * The grid holds the month's days plus the days of the neighbouring months that fill the first and last
 * week: `hasVariableRowCount` keeps as many weeks as the month needs, otherwise the grid is always six
 * rows so the calendar keeps one height as you page.
 */
import {
  getDaysInMonth,
  plainDateAddDays,
  plainDateDayOfWeek,
  plainDateToISO,
} from '@tecton-wc/core/date/plain-date.js';
import type {DayOfWeek, ISODateString, PlainDate} from '@tecton-wc/core/date/date-types.js';
import {getWeekdayHeaders} from '@tecton-wc/core/date/format.js';

/** One day of the grid. */
export interface CalendarDay {
  /** The calendar date. */
  date: PlainDate;
  /** ISO date string (`YYYY-MM-DD`). */
  iso: ISODateString;
  /** Whether the day belongs to a neighbouring month. */
  isOutside: boolean;
  /** The day number (1-31). */
  dayNumber: number;
}

export interface CalendarDaysOptions {
  /** The year to generate days for. */
  year: number;
  /** The month, 1-based. */
  month: number;
  /** First day of the week, 0 = Sunday. Default 0. */
  weekStartsOn?: DayOfWeek;
  /** As many weeks as the month needs instead of a fixed six. Default `false`. */
  hasVariableRowCount?: boolean;
  /** Locale of the weekday headers. Default `en`. */
  locale?: string;
}

export interface CalendarDaysResult {
  /** Every day of the grid, outside days included. */
  days: CalendarDay[];
  /** The days grouped into weeks of seven. */
  weeks: CalendarDay[][];
  /** The localized short weekday names for the header, starting at `weekStartsOn`. */
  dayNames: string[];
  /** The number of cells in the grid (a multiple of seven). */
  totalCells: number;
}

/** Computes the grid of a month. */
export function getCalendarDays(options: CalendarDaysOptions): CalendarDaysResult {
  const {year, month, weekStartsOn = 0, hasVariableRowCount = false, locale = 'en'} = options;
  const daysInMonth = getDaysInMonth(year, month);
  const leading = (plainDateDayOfWeek({year, month, day: 1}) - weekStartsOn + 7) % 7;
  const rows = hasVariableRowCount ? Math.ceil((daysInMonth + leading) / 7) : 6;
  const totalCells = rows * 7;
  const first: PlainDate = {year, month, day: 1};

  const days: CalendarDay[] = [];
  for (let index = 0; index < totalCells; index++) {
    const offset = index - leading + 1;
    const isOutside = offset < 1 || offset > daysInMonth;
    const date: PlainDate = isOutside
      ? plainDateAddDays(first, offset - 1)
      : {year, month, day: offset};
    days.push({date, iso: plainDateToISO(date), isOutside, dayNumber: date.day});
  }

  const weeks: CalendarDay[][] = [];
  for (let index = 0; index < days.length; index += 7) weeks.push(days.slice(index, index + 7));

  return {days, weeks, dayNames: getWeekdayHeaders(locale, weekStartsOn), totalCells};
}
