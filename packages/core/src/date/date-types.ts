/**
 * Shared date and time vocabulary of the date family (upstream `utils/dateTypes.ts`): the machine
 * shapes a value is stored and submitted as, the immutable calendar-date record, and the weekday
 * helpers. Storage is always ISO 8601 and never depends on a locale, a calendar system or a time zone;
 * display and time zone are separate concerns handled in `format.ts` and `zoned.ts`
 * [mwg:capture-location-agnostic-data] [mwg:support-global-calendar-systems].
 */

/** An ISO 8601 calendar date, `YYYY-MM-DD` (`2026-01-28`). No time zone, no locale. */
export type ISODateString =
  `${number}${number}${number}${number}-${number}${number}-${number}${number}`;

/** An ISO 8601 wall-clock time, `HH:MM` or `HH:MM:SS`, 24-hour, no time zone. */
export type ISOTimeString = string & {readonly __brand: 'ISOTimeString'};

/** An ISO 8601 local date and time, `YYYY-MM-DDTHH:MM` or `YYYY-MM-DDTHH:MM:SS`, no time zone. */
export type ISODateTimeString = `${ISODateString}T${string}`;

/** Day of week: 0 = Sunday through 6 = Saturday. */
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** Three-letter lowercase weekday name, `sun` through `sat`. */
export type DayOfWeekName = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat';

const WEEKDAY_NAMES: readonly DayOfWeekName[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

/**
 * Normalizes a weekday to its numeric {@link DayOfWeek}. Accepts a number (0-6) or a three-letter
 * day name (case-insensitive), so `week-starts-on` can be written either way. Anything else falls
 * back to 0 (Sunday).
 */
export function normalizeDayOfWeek(value: number | string): DayOfWeek {
  if (typeof value === 'number') {
    return Number.isInteger(value) && value >= 0 && value <= 6 ? (value as DayOfWeek) : 0;
  }
  const text = String(value).trim().toLowerCase();
  if (/^[0-6]$/.test(text)) return Number(text) as DayOfWeek;
  const index = WEEKDAY_NAMES.indexOf(text as DayOfWeekName);
  return index === -1 ? 0 : (index as DayOfWeek);
}

/** An immutable calendar date with a 1-based month (Gregorian). */
export interface PlainDate {
  readonly year: number;
  /** 1 = January, 12 = December. */
  readonly month: number;
  readonly day: number;
}

/** A date range, both ends inclusive. */
export interface DateRange {
  start: ISODateString;
  end: ISODateString;
}
