/**
 * Locale-aware date display (upstream `utils/plainDate.ts` formatting half, MIT, adapted). Display is
 * kept apart from storage: a date is stored as `YYYY-MM-DD` and rendered here with `Intl.DateTimeFormat`
 * in the reader's language. The library models Gregorian dates, so every format pins
 * `calendar: 'gregory'` (the digits and month names still follow the locale: `ar-SA` reads Arabic-Indic
 * digits, `he-IL` Hebrew month names), and reads a UTC-midnight `Date` with `timeZone: 'UTC'`, so the
 * result never depends on the host's time zone or its DST rules
 * [mwg:support-global-calendar-systems].
 */
import type {PlainDate} from './date-types.js';
import {plainDateToISO, plainDateToUTCDate} from './plain-date.js';
import {getStandaloneShortWeekdayNames} from './weekday-names.js';

/** e.g. "Wednesday, May 21, 2026". */
export const DATE_FORMAT_WITH_WEEKDAY: Intl.DateTimeFormatOptions = {
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
};

/** e.g. "Wed, May 21, 2026". Backs the shared `date_weekday` format. */
export const DATE_FORMAT_SHORT_WITH_WEEKDAY: Intl.DateTimeFormatOptions = {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
};

/** e.g. "May 21, 2026". */
export const DATE_FORMAT_LONG: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
};

/** e.g. "January 2026". */
export const DATE_FORMAT_MONTH_YEAR: Intl.DateTimeFormatOptions = {year: 'numeric', month: 'long'};

/** e.g. "Sun": the abbreviated weekday on its own. */
export const DATE_FORMAT_WEEKDAY_ONLY: Intl.DateTimeFormatOptions = {weekday: 'short'};

/** e.g. "January": the month on its own. */
export const DATE_FORMAT_MONTH_ONLY: Intl.DateTimeFormatOptions = {month: 'long'};

/** e.g. "Jan 25". */
export const DATE_FORMAT_SHORT: Intl.DateTimeFormatOptions = {month: 'short', day: 'numeric'};

/** e.g. "Jan 25, 2026". */
export const DATE_FORMAT_SHORT_WITH_YEAR: Intl.DateTimeFormatOptions = {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
};

const formatters = new Map<string, Intl.DateTimeFormat>();

/** A cached `Intl.DateTimeFormat` (constructing one per day cell is measurable). */
export function getDateTimeFormat(
  locale: string,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let formatter = formatters.get(key);
  if (!formatter) {
    try {
      formatter = new Intl.DateTimeFormat(locale, options);
    } catch {
      // An invalid language tag: fall back to English rather than throwing from render.
      formatter = new Intl.DateTimeFormat('en', options);
    }
    formatters.set(key, formatter);
  }
  return formatter;
}

/**
 * Formats a date with `Intl` options. The locale defaults to `en`; `options.calendar` defaults to
 * Gregorian and is a display-only escape hatch (arithmetic, parsing and serialisation stay Gregorian).
 */
export function plainDateFormat(
  date: PlainDate,
  options: Intl.DateTimeFormatOptions,
  locale = 'en',
): string {
  return getDateTimeFormat(locale, {
    ...options,
    calendar: options.calendar ?? 'gregory',
    timeZone: 'UTC',
  }).format(plainDateToUTCDate(date));
}

/**
 * The date-only members of the `format` vocabulary that a calendar-date field can render: `date`
 * ("Mar 21, 2026"), `date_long` ("March 21, 2026"), `date_weekday` ("Wed, Mar 21, 2026") and
 * `system_date` ("2026-03-21"). `tct-timestamp` and `tct-date-input` share them so the same word renders
 * the same shape in both.
 */
export type SharedDateFormat = 'date' | 'date_long' | 'date_weekday' | 'system_date';

/** Option bags of the locale-aware members. `system_date` is a fixed ISO string, not an `Intl` format. */
export const SHARED_DATE_FORMAT_OPTIONS: Record<
  Exclude<SharedDateFormat, 'system_date'>,
  Intl.DateTimeFormatOptions
> = {
  date: DATE_FORMAT_SHORT_WITH_YEAR,
  date_long: DATE_FORMAT_LONG,
  date_weekday: DATE_FORMAT_SHORT_WITH_WEEKDAY,
};

/** Renders a date with one of the {@link SharedDateFormat} members. */
export function formatSharedDate(date: PlainDate, format: SharedDateFormat, locale = 'en'): string {
  if (format === 'system_date') return plainDateToISO(date);
  return plainDateFormat(date, SHARED_DATE_FORMAT_OPTIONS[format], locale);
}

/**
 * The seven weekday column headers of a month grid, starting at `weekStartsOn` (0 = Sunday). Two-letter
 * stand-alone names where CLDR has them (the table in `weekday-names.ts`), else `Intl`'s abbreviated
 * names. Built from indices, never from a `Date` anchor, so the header cannot shift with the host time
 * zone.
 */
export function getWeekdayHeaders(locale: string, weekStartsOn: number): string[] {
  const table = getStandaloneShortWeekdayNames(locale);
  const names =
    table ??
    Array.from({length: 7}, (_, index) =>
      // 2000-01-02 was a Sunday.
      getDateTimeFormat(locale, {weekday: 'short', timeZone: 'UTC'}).format(
        new Date(Date.UTC(2000, 0, 2 + index)),
      ),
    );
  return Array.from({length: 7}, (_, index) => names[(index + weekStartsOn) % 7]!);
}

/** The full weekday names, Sunday first (`Sunday`), for accessible column names. */
export function getLongWeekdayNames(locale: string): string[] {
  return Array.from({length: 7}, (_, index) =>
    getDateTimeFormat(locale, {weekday: 'long', timeZone: 'UTC'}).format(
      new Date(Date.UTC(2000, 0, 2 + index)),
    ),
  );
}
