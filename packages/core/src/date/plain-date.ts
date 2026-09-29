/**
 * Immutable calendar-date arithmetic (upstream `utils/plainDate.ts`, MIT, adapted). The only module
 * of the library that imports `@internationalized/date` besides `zoned.ts` (ARCHITECTURE §2.2, §18.1):
 * month and day arithmetic, weekday and instant conversions run through its Gregorian calendar, so
 * `Jan 31 + 1 month` is `Feb 28/29` (clamped, like `Temporal.PlainDate.add`), a DST change never
 * adds or drops a day, and nothing here reads the host time zone except `plainDateToday()` and the
 * `Date` conversions, which are named for it.
 *
 * A `PlainDate` is `{year, month (1-based), day}`: a calendar date with no time zone and no locale. It is
 * what a date value is stored as, serialised as (`YYYY-MM-DD`) and compared as; display and time
 * zones are separate concerns (`format.ts`, `zoned.ts`) [mwg:capture-location-agnostic-data]
 * [mwg:support-global-calendar-systems].
 */
import {CalendarDate} from '@internationalized/date';
import type {ISODateString, PlainDate} from './date-types.js';

const ISO_DATE = /^(\d{4,})-(\d{1,2})-(\d{1,2})$/;

/** Number of days in a Gregorian month. */
export function getDaysInMonth(year: number, month: number): number {
  const first = new CalendarDate(year, month, 1);
  return first.calendar.getDaysInMonth(first);
}

/** Creates a date; throws a `RangeError` for a year below 1, a month outside 1-12 or a day the month does not have. */
export function plainDateCreate(year: number, month: number, day: number): PlainDate {
  if (!Number.isInteger(year) || year < 1) {
    throw new RangeError(`year must be a positive integer, got ${year}`);
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new RangeError(`month must be 1-12, got ${month}`);
  }
  const maxDay = getDaysInMonth(year, month);
  if (!Number.isInteger(day) || day < 1 || day > maxDay) {
    throw new RangeError(
      `day must be 1-${maxDay} for ${year}-${String(month).padStart(2, '0')}, got ${day}`,
    );
  }
  return {year, month, day};
}

/** Parses `YYYY-MM-DD`; throws a `RangeError` when it is not a real date. */
export function plainDateFromISO(text: string): PlainDate {
  const match = ISO_DATE.exec(text.trim());
  if (!match) throw new RangeError(`not an ISO date (YYYY-MM-DD): "${text}"`);
  return plainDateCreate(Number(match[1]), Number(match[2]), Number(match[3]));
}

/** Like {@link plainDateFromISO}, but `null` instead of throwing (for attribute and property input). */
export function tryPlainDateFromISO(text: string | null | undefined): PlainDate | null {
  if (typeof text !== 'string') return null;
  try {
    return plainDateFromISO(text);
  } catch {
    return null;
  }
}

/** Serialises to `YYYY-MM-DD`. */
export function plainDateToISO(date: PlainDate): ISODateString {
  const year = String(date.year).padStart(4, '0');
  const month = String(date.month).padStart(2, '0');
  const day = String(date.day).padStart(2, '0');
  return `${year}-${month}-${day}` as ISODateString;
}

/** A `Date` at local midnight of that calendar date (for `dateConstraints` callbacks). */
export function plainDateToDate(date: PlainDate): Date {
  const result = new Date(2000, 0, 1);
  // setFullYear, not the constructor: years 0-99 would be read as 1900-1999.
  result.setFullYear(date.year, date.month - 1, date.day);
  result.setHours(0, 0, 0, 0);
  return result;
}

/** A `Date` at UTC midnight of that calendar date: formats the same everywhere when read with `timeZone: 'UTC'`. */
export function plainDateToUTCDate(date: PlainDate): Date {
  return new Date(utcMidnight(date));
}

/** The local calendar date of a `Date`. */
export function plainDateFromDate(value: Date): PlainDate {
  return {year: value.getFullYear(), month: value.getMonth() + 1, day: value.getDate()};
}

/** Today's date in the host time zone. Tests fix it with fake timers (`vi.setSystemTime`). */
export function plainDateToday(): PlainDate {
  return plainDateFromDate(new Date());
}

const toCalendar = (date: PlainDate): CalendarDate =>
  new CalendarDate(date.year, date.month, date.day);
const fromCalendar = (date: CalendarDate): PlainDate => ({
  year: date.year,
  month: date.month,
  day: date.day,
});

/** Milliseconds of the date's UTC midnight (setUTCFullYear keeps years 0-99 literal). */
function utcMidnight(date: PlainDate): number {
  const result = new Date(0);
  result.setUTCFullYear(date.year, date.month - 1, date.day);
  return result.getTime();
}

/** Day of the week, 0 = Sunday. Independent of locale and time zone. */
export function plainDateDayOfWeek(date: PlainDate): number {
  return new Date(utcMidnight(date)).getUTCDay();
}

/** Adds months, clamping the day (`Jan 31 + 1` is `Feb 28/29`). */
export function plainDateAddMonths(date: PlainDate, months: number): PlainDate {
  return fromCalendar(toCalendar(date).add({months}));
}

/** Adds years, clamping Feb 29 to Feb 28 in a common year. */
export function plainDateAddYears(date: PlainDate, years: number): PlainDate {
  return fromCalendar(toCalendar(date).add({years}));
}

/** Adds days (negative subtracts). */
export function plainDateAddDays(date: PlainDate, days: number): PlainDate {
  return fromCalendar(toCalendar(date).add({days}));
}

/**
 * Whole calendar days from `a` to `b` (positive when `b` is later). Uses UTC midnights, so a DST shift
 * never adds or drops a day.
 */
export function plainDateDiffDays(a: PlainDate, b: PlainDate): number {
  return Math.round((utcMidnight(b) - utcMidnight(a)) / 86_400_000);
}

function compare(a: PlainDate, b: PlainDate): number {
  if (a.year !== b.year) return a.year - b.year;
  if (a.month !== b.month) return a.month - b.month;
  return a.day - b.day;
}

/** Negative, zero or positive: chronological order of two dates. */
export const plainDateCompare = compare;

export function plainDateIsBefore(a: PlainDate, b: PlainDate): boolean {
  return compare(a, b) < 0;
}

export function plainDateIsAfter(a: PlainDate, b: PlainDate): boolean {
  return compare(a, b) > 0;
}

/** Whether two dates are the same day (upstream `isSameDay`). */
export function plainDateIsEqual(a: PlainDate, b: PlainDate): boolean {
  return compare(a, b) === 0;
}

export function plainDateMax(a: PlainDate, b: PlainDate): PlainDate {
  return compare(a, b) >= 0 ? a : b;
}

export function plainDateMin(a: PlainDate, b: PlainDate): PlainDate {
  return compare(a, b) <= 0 ? a : b;
}

/** Whether a date is inside `range`, both ends inclusive (upstream `isDateInRange`). */
export function plainDateIsInRange(
  date: PlainDate,
  range: readonly [PlainDate, PlainDate],
): boolean {
  return compare(date, range[0]) >= 0 && compare(date, range[1]) <= 0;
}

/** The first day of the date's month. */
export function plainDateSetFirstOfMonth(date: PlainDate): PlainDate {
  return {year: date.year, month: date.month, day: 1};
}

/** The first day of the week (`weekStartsOn`, 0 = Sunday) that contains the date. */
export function plainDateSetStartOfWeek(date: PlainDate, weekStartsOn: number): PlainDate {
  const delta = (plainDateDayOfWeek(date) - weekStartsOn + 7) % 7;
  return plainDateAddDays(date, -delta);
}

/** The day after the last day of the week that contains the date. */
export function plainDateSetEndOfWeekExclusive(date: PlainDate, weekStartsOn: number): PlainDate {
  return plainDateAddDays(plainDateSetStartOfWeek(date, weekStartsOn), 7);
}

/** ISO 8601 week number (weeks start Monday; week 1 holds the year's first Thursday). Upstream `getWeekNumber`. */
export function plainDateGetWeekNumber(date: PlainDate): number {
  const dayNumber = plainDateDayOfWeek(date) || 7;
  // The Thursday of this week decides the ISO year.
  const thursday = plainDateAddDays(date, 4 - dayNumber);
  const yearStart: PlainDate = {year: thursday.year, month: 1, day: 1};
  return Math.ceil((plainDateDiffDays(yearStart, thursday) + 1) / 7);
}

/** Upstream names (`Calendar/utils`). */
export {
  plainDateFromISO as parseISO,
  plainDateToISO as dateToISO,
  plainDateIsEqual as isSameDay,
  plainDateIsInRange as isDateInRange,
  plainDateGetWeekNumber as getWeekNumber,
};
