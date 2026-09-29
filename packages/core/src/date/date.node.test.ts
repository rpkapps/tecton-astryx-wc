// Ports of the upstream plainDate, dateParser and timeParser unit tests (MIT, adapted), plus what the
// boundary adds: locale digits and month names, Hebrew and Arabic display, and time zones through
// `@internationalized/date`. Time zone tests name their zone; nothing reads the host zone or today.
import {describe, expect, it, vi} from 'vitest';
import {normalizeDayOfWeek} from './date-types.js';
import {isLocaleDayFirst, parseDateInput} from './date-parser.js';
import {
  DATE_FORMAT_LONG,
  DATE_FORMAT_MONTH_YEAR,
  DATE_FORMAT_WITH_WEEKDAY,
  formatSharedDate,
  getWeekdayHeaders,
  plainDateFormat,
} from './format.js';
import {
  getDaysInMonth,
  plainDateAddDays,
  plainDateAddMonths,
  plainDateAddYears,
  plainDateCreate,
  plainDateDayOfWeek,
  plainDateDiffDays,
  plainDateFromDate,
  plainDateFromISO,
  plainDateGetWeekNumber,
  plainDateIsAfter,
  plainDateIsBefore,
  plainDateIsEqual,
  plainDateIsInRange,
  plainDateMax,
  plainDateMin,
  plainDateSetEndOfWeekExclusive,
  plainDateSetFirstOfMonth,
  plainDateSetStartOfWeek,
  plainDateToDate,
  plainDateToISO,
  plainDateToday,
  tryPlainDateFromISO,
} from './plain-date.js';
import {
  adjustTime,
  clampTime,
  compareTime,
  createISOTimeString,
  formatDisplayTime12h,
  formatDisplayTime24h,
  formatISOTime,
  getMeridiemLabels,
  isTimeInRange,
  parseISOTime,
  parseTimeInput,
} from './time-parser.js';
import {
  getTimeZoneParts,
  isValidTimeZone,
  plainDateFromInstant,
  plainDateToInstant,
} from './zoned.js';

const d = (year: number, month: number, day: number) => ({year, month, day});

describe('plainDateCreate and ISO', () => {
  it('creates a valid date and rejects impossible ones', () => {
    expect(plainDateCreate(2026, 1, 25)).toEqual(d(2026, 1, 25));
    expect(() => plainDateCreate(0, 1, 1)).toThrow(RangeError);
    expect(() => plainDateCreate(-1, 1, 1)).toThrow(RangeError);
    expect(() => plainDateCreate(2026.5, 1, 1)).toThrow(RangeError);
    expect(() => plainDateCreate(2026, 0, 1)).toThrow(RangeError);
    expect(() => plainDateCreate(2026, 13, 1)).toThrow(RangeError);
    expect(() => plainDateCreate(2026, 2, 0)).toThrow(RangeError);
    expect(() => plainDateCreate(2026, 2, 29)).toThrow(RangeError);
    expect(plainDateCreate(2024, 2, 29)).toEqual(d(2024, 2, 29));
  });

  it('round-trips ISO strings, padding month, day and year', () => {
    expect(plainDateFromISO('2026-05-13')).toEqual(d(2026, 5, 13));
    expect(plainDateFromISO('2026-5-3')).toEqual(d(2026, 5, 3));
    expect(plainDateToISO(d(2026, 1, 5))).toBe('2026-01-05');
    expect(plainDateToISO(d(50, 1, 5))).toBe('0050-01-05');
    for (const iso of ['2026-01-01', '2024-02-29', '1999-12-31']) {
      expect(plainDateToISO(plainDateFromISO(iso))).toBe(iso);
    }
  });

  it('throws for text that is not a real ISO date, and tryPlainDateFromISO returns null', () => {
    expect(() => plainDateFromISO('2026-02-30')).toThrow(RangeError);
    expect(() => plainDateFromISO('tomorrow')).toThrow(RangeError);
    expect(tryPlainDateFromISO('2026-02-30')).toBeNull();
    expect(tryPlainDateFromISO(undefined)).toBeNull();
    expect(tryPlainDateFromISO('2026-02-28')).toEqual(d(2026, 2, 28));
  });

  it('converts to and from a local Date without drifting a day', () => {
    const date = plainDateToDate(d(2026, 3, 8));
    expect([date.getFullYear(), date.getMonth(), date.getDate()]).toEqual([2026, 2, 8]);
    expect(plainDateFromDate(date)).toEqual(d(2026, 3, 8));
    expect(plainDateToDate(d(50, 1, 1)).getFullYear()).toBe(50);
  });

  it('reads today from the (faked) system time', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date(2026, 8, 29, 12, 0, 0));
      expect(plainDateToday()).toEqual(d(2026, 9, 29));
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('arithmetic', () => {
  it('counts days in a month, including leap and century years', () => {
    expect(getDaysInMonth(2026, 1)).toBe(31);
    expect(getDaysInMonth(2026, 2)).toBe(28);
    expect(getDaysInMonth(2024, 2)).toBe(29);
    expect(getDaysInMonth(2100, 2)).toBe(28);
    expect(getDaysInMonth(2000, 2)).toBe(29);
    expect(getDaysInMonth(2026, 4)).toBe(30);
  });

  it('finds the day of the week (0 = Sunday), independent of the host zone', () => {
    expect(plainDateDayOfWeek(d(2026, 1, 25))).toBe(0);
    expect(plainDateDayOfWeek(d(2026, 1, 26))).toBe(1);
    expect(plainDateDayOfWeek(d(2026, 1, 31))).toBe(6);
  });

  it('adds months with day clamping (Jan 31 + 1 month is the end of February)', () => {
    expect(plainDateAddMonths(d(2026, 1, 31), 1)).toEqual(d(2026, 2, 28));
    expect(plainDateAddMonths(d(2024, 1, 31), 1)).toEqual(d(2024, 2, 29));
    expect(plainDateAddMonths(d(2026, 12, 15), 1)).toEqual(d(2027, 1, 15));
    expect(plainDateAddMonths(d(2026, 1, 15), -1)).toEqual(d(2025, 12, 15));
    expect(plainDateAddMonths(d(2026, 3, 31), -1)).toEqual(d(2026, 2, 28));
    expect(plainDateAddMonths(d(2026, 1, 31), 14)).toEqual(d(2027, 3, 31));
  });

  it('adds years, clamping Feb 29', () => {
    expect(plainDateAddYears(d(2024, 2, 29), 1)).toEqual(d(2025, 2, 28));
    expect(plainDateAddYears(d(2024, 2, 29), 4)).toEqual(d(2028, 2, 29));
    expect(plainDateAddYears(d(2026, 6, 15), -1)).toEqual(d(2025, 6, 15));
  });

  it('adds days across month and year boundaries', () => {
    expect(plainDateAddDays(d(2026, 1, 25), 10)).toEqual(d(2026, 2, 4));
    expect(plainDateAddDays(d(2026, 12, 31), 1)).toEqual(d(2027, 1, 1));
    expect(plainDateAddDays(d(2026, 3, 1), -1)).toEqual(d(2026, 2, 28));
  });

  it('counts whole days between dates, ignoring DST', () => {
    expect(plainDateDiffDays(d(2026, 1, 1), d(2026, 1, 4))).toBe(3);
    expect(plainDateDiffDays(d(2026, 1, 4), d(2026, 1, 1))).toBe(-3);
    expect(plainDateDiffDays(d(2026, 1, 1), d(2026, 1, 1))).toBe(0);
    expect(plainDateDiffDays(d(2025, 12, 30), d(2026, 1, 2))).toBe(3);
    // US DST began 2026-03-08: two calendar days, one of 23 hours.
    expect(plainDateDiffDays(d(2026, 3, 7), d(2026, 3, 9))).toBe(2);
  });

  it('compares dates', () => {
    expect(plainDateIsBefore(d(2026, 1, 1), d(2026, 1, 2))).toBe(true);
    expect(plainDateIsBefore(d(2026, 1, 1), d(2026, 1, 1))).toBe(false);
    expect(plainDateIsAfter(d(2026, 2, 1), d(2026, 1, 31))).toBe(true);
    expect(plainDateIsAfter(d(2025, 12, 31), d(2026, 1, 1))).toBe(false);
    expect(plainDateIsEqual(d(2026, 1, 1), d(2026, 1, 1))).toBe(true);
    expect(plainDateIsEqual(d(2026, 1, 1), d(2026, 2, 1))).toBe(false);
    expect(plainDateMax(d(2026, 1, 1), d(2026, 1, 2))).toEqual(d(2026, 1, 2));
    expect(plainDateMin(d(2026, 1, 1), d(2026, 1, 2))).toEqual(d(2026, 1, 1));
  });

  it('checks a range with both ends inclusive', () => {
    const range = [d(2026, 1, 10), d(2026, 1, 20)] as const;
    expect(plainDateIsInRange(d(2026, 1, 15), range)).toBe(true);
    expect(plainDateIsInRange(d(2026, 1, 10), range)).toBe(true);
    expect(plainDateIsInRange(d(2026, 1, 20), range)).toBe(true);
    expect(plainDateIsInRange(d(2026, 1, 9), range)).toBe(false);
    expect(plainDateIsInRange(d(2026, 1, 21), range)).toBe(false);
  });

  it('finds week and month boundaries', () => {
    // 2026-01-28 is a Wednesday.
    expect(plainDateSetStartOfWeek(d(2026, 1, 28), 0)).toEqual(d(2026, 1, 25));
    expect(plainDateSetStartOfWeek(d(2026, 1, 28), 1)).toEqual(d(2026, 1, 26));
    expect(plainDateSetEndOfWeekExclusive(d(2026, 1, 28), 0)).toEqual(d(2026, 2, 1));
    expect(plainDateSetFirstOfMonth(d(2026, 1, 28))).toEqual(d(2026, 1, 1));
  });

  it('numbers ISO weeks', () => {
    expect(plainDateGetWeekNumber(d(2026, 1, 1))).toBe(1);
    expect(plainDateGetWeekNumber(d(2020, 12, 31))).toBe(53);
    expect(plainDateGetWeekNumber(d(2026, 1, 4))).toBe(1);
    expect(plainDateGetWeekNumber(d(2027, 1, 1))).toBe(53);
  });

  it('normalizes a weekday given as a number or a name', () => {
    expect(normalizeDayOfWeek(3)).toBe(3);
    expect(normalizeDayOfWeek('mon')).toBe(1);
    expect(normalizeDayOfWeek('SAT')).toBe(6);
    expect(normalizeDayOfWeek('2')).toBe(2);
    expect(normalizeDayOfWeek('nope')).toBe(0);
    expect(normalizeDayOfWeek(9)).toBe(0);
  });
});

describe('time zones stay apart from the date', () => {
  it('reads an instant as the wall clock of a zone', () => {
    const instant = Date.UTC(2026, 4, 13, 16, 30);
    expect(getTimeZoneParts(instant, 'America/Los_Angeles')).toEqual({
      year: 2026,
      month: 5,
      day: 13,
      hour: 9,
      minute: 30,
      second: 0,
    });
    expect(getTimeZoneParts(instant, 'Asia/Tokyo').day).toBe(14);
    expect(plainDateFromInstant(instant, 'Pacific/Kiritimati')).toEqual(d(2026, 5, 14));
  });

  it('turns a date and wall clock in a zone into an instant, and back', () => {
    expect(plainDateToInstant(d(2026, 5, 13), 'America/Los_Angeles')).toBe(
      Date.UTC(2026, 4, 13, 7),
    );
    expect(plainDateToInstant(d(2026, 5, 13), 'America/Los_Angeles', 9, 30)).toBe(
      Date.UTC(2026, 4, 13, 16, 30),
    );
    const date = d(2026, 5, 13);
    expect(
      plainDateFromInstant(plainDateToInstant(date, 'America/Los_Angeles'), 'America/Los_Angeles'),
    ).toEqual(date);
  });

  it('resolves a wall time skipped by DST with the compatible rule (later time)', () => {
    // 2026-03-08 02:30 does not exist in New York; it resolves to 03:30 EDT.
    const instant = plainDateToInstant(d(2026, 3, 8), 'America/New_York', 2, 30);
    expect(instant).toBe(Date.UTC(2026, 2, 8, 7, 30));
    expect(getTimeZoneParts(instant, 'America/New_York').hour).toBe(3);
  });

  it('validates zone identifiers', () => {
    expect(isValidTimeZone('UTC')).toBe(true);
    expect(isValidTimeZone('Europe/Berlin')).toBe(true);
    expect(isValidTimeZone('Mars/Olympus')).toBe(false);
  });
});

describe('formatting', () => {
  it('formats with the requested locale and defaults to English', () => {
    expect(plainDateFormat(d(2026, 8, 22), DATE_FORMAT_MONTH_YEAR)).toBe('August 2026');
    expect(plainDateFormat(d(2026, 8, 22), DATE_FORMAT_MONTH_YEAR, 'fr')).toBe('août 2026');
    expect(plainDateFormat(d(2026, 1, 25), DATE_FORMAT_WITH_WEEKDAY)).toContain('2026');
  });

  it('uses Gregorian fields for a non-Gregorian locale extension', () => {
    expect(plainDateFormat(d(2026, 8, 22), {year: 'numeric'}, 'en-US-u-ca-buddhist')).toBe('2026');
    expect(plainDateFormat(d(2026, 8, 22), {year: 'numeric', calendar: 'buddhist'}, 'en-US')).toBe(
      '2569 BE',
    );
  });

  it('formats the shared shapes', () => {
    const date = d(2026, 1, 25);
    expect(formatSharedDate(date, 'date')).toBe('Jan 25, 2026');
    expect(formatSharedDate(date, 'date_long')).toBe('January 25, 2026');
    expect(formatSharedDate(date, 'date_weekday')).toBe('Sun, Jan 25, 2026');
    expect(formatSharedDate(date, 'system_date')).toBe('2026-01-25');
    expect(formatSharedDate(date, 'date_long', 'es-ES')).toBe('25 de enero de 2026');
  });

  it('renders he-IL with Hebrew names and ar-SA with Arabic-Indic digits (Gregorian calendar)', () => {
    const date = d(2026, 3, 21);
    const hebrew = plainDateFormat(date, DATE_FORMAT_LONG, 'he-IL');
    expect(hebrew).toMatch(/מרץ/u);
    expect(hebrew).toContain('2026');
    const arabic = plainDateFormat(date, DATE_FORMAT_LONG, 'ar-SA');
    expect(arabic).toMatch(/[٠-٩]{4}/u);
    expect(arabic).toContain('مارس');
  });

  it('is independent of the host time zone: the same date formats the same', () => {
    // The formatter reads UTC midnight with timeZone: 'UTC', so no zone can move the day.
    expect(plainDateFormat(d(2026, 3, 8), {day: 'numeric', month: 'numeric'}, 'en-US')).toBe('3/8');
  });

  it('builds weekday headers from the CLDR table, rotated to the week start', () => {
    expect(getWeekdayHeaders('en-US', 0)).toEqual(['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']);
    expect(getWeekdayHeaders('en-US', 1)).toEqual(['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']);
    expect(getWeekdayHeaders('he-IL', 0)[0]).toBe('א׳');
    expect(getWeekdayHeaders('ar-SA', 0)[0]).toBe('أحد');
    expect(getWeekdayHeaders('not a locale', 0)[0]).toBe('Su');
    // A locale the table lacks falls back to Intl's abbreviated names.
    expect(getWeekdayHeaders('sw', 0)).toHaveLength(7);
  });
});

describe('parseDateInput', () => {
  const YEAR = new Date().getFullYear();

  it('reads ISO dates and rejects impossible ones', () => {
    expect(parseDateInput('2026-01-25')).toEqual(d(2026, 1, 25));
    expect(parseDateInput('2026-1-5')).toEqual(d(2026, 1, 5));
    expect(parseDateInput('  2026-01-25  ')).toEqual(d(2026, 1, 25));
    expect(parseDateInput('2026-13-25')).toBeNull();
    expect(parseDateInput('2026-02-30')).toBeNull();
  });

  it('reads English month names in any order, case-insensitively', () => {
    for (const text of [
      'January 25, 2026',
      'Jan 25, 2026',
      '25 January 2026',
      '25 Jan 2026',
      'January 25 2026',
      'JANUARY 25, 2026',
      'january 25, 2026',
      'Wed, Jan 25, 2026',
      'Sunday, January 25, 2026',
    ]) {
      expect(parseDateInput(text), text).toEqual(d(2026, 1, 25));
    }
    expect(parseDateInput('Sept 1, 2026')).toEqual(d(2026, 9, 1));
    expect(parseDateInput('February 29, 2024')).toEqual(d(2024, 2, 29));
    expect(parseDateInput('February 29, 2025')).toBeNull();
  });

  it('defaults a missing year to the current year', () => {
    expect(parseDateInput('January 25')).toEqual(d(YEAR, 1, 25));
    expect(parseDateInput('25 Jan')).toEqual(d(YEAR, 1, 25));
    expect(parseDateInput('1/25')).toEqual(d(YEAR, 1, 25));
    expect(parseDateInput('25/1')).toEqual(d(YEAR, 1, 25));
    expect(parseDateInput('12-31')).toEqual(d(YEAR, 12, 31));
  });

  it('settles numeric order by a number above 12, else by the locale', () => {
    expect(parseDateInput('25/1/2026')).toEqual(d(2026, 1, 25));
    expect(parseDateInput('1/25/2026')).toEqual(d(2026, 1, 25));
    expect(parseDateInput('31-12-2026')).toEqual(d(2026, 12, 31));
    expect(parseDateInput('25/31/2026')).toBeNull();
    expect(parseDateInput('0/15/2026')).toBeNull();
    expect(parseDateInput('3/4/2026')).toEqual(d(2026, 3, 4));
    expect(parseDateInput('3/4/2026', 'en-US')).toEqual(d(2026, 3, 4));
    expect(parseDateInput('3/4/2026', 'es-ES')).toEqual(d(2026, 4, 3));
    expect(parseDateInput('3/4/2026', 'en-GB')).toEqual(d(2026, 4, 3));
    expect(parseDateInput('3.4.2026', 'de-DE')).toEqual(d(2026, 4, 3));
  });

  it('rejects mixed separators, bare numbers and text', () => {
    expect(parseDateInput('1/25.2026')).toBeNull();
    expect(parseDateInput('')).toBeNull();
    expect(parseDateInput('   ')).toBeNull();
    expect(parseDateInput('not a date')).toBeNull();
    expect(parseDateInput('abc xyz')).toBeNull();
    for (const partial of ['0', '1', '00', '01', '12', '2026', '9', '99']) {
      expect(parseDateInput(partial), partial).toBeNull();
    }
  });

  it('keeps years 0-99 literal', () => {
    expect(parseDateInput('01/01/0050')).toEqual(d(50, 1, 1));
  });

  it('reads digits of other scripts and locale separators', () => {
    expect(parseDateInput('٢٥/٣/٢٠٢٦', 'ar-SA')).toEqual(d(2026, 3, 25));
    expect(parseDateInput('２０２６－０３－２１')).toEqual(d(2026, 3, 21));
    expect(parseDateInput('‏21/3/2026‏', 'he-IL')).toEqual(d(2026, 3, 21));
  });

  it('reads back the text a field displays in each locale (display round trip)', () => {
    const date = d(2026, 3, 21);
    for (const locale of [
      'en-US',
      'he-IL',
      'ar-SA',
      'de-DE',
      'fr-FR',
      'ru-RU',
      'ja-JP',
      'es-ES',
      'vi-VN',
    ]) {
      // Vietnamese writes a numeric weekday ("Thứ 7, 21 thg 3, 2026"): only its date shapes round-trip.
      for (const format of ['date', 'date_long', 'date_weekday'] as const) {
        if (locale === 'vi-VN' && format === 'date_weekday') continue;
        const text = formatSharedDate(date, format, locale);
        expect(parseDateInput(text, locale), `${locale} ${format}: ${text}`).toEqual(date);
      }
    }
  });

  it('knows which locales put the day first', () => {
    expect(isLocaleDayFirst()).toBe(false);
    expect(isLocaleDayFirst('en-US')).toBe(false);
    expect(isLocaleDayFirst('en-GB')).toBe(true);
    expect(isLocaleDayFirst('de-DE')).toBe(true);
    expect(isLocaleDayFirst('he-IL')).toBe(true);
    expect(isLocaleDayFirst('ar-SA')).toBe(true);
  });

  it('requests Gregorian calendar data for locale ordering', () => {
    const Original = globalThis.Intl.DateTimeFormat;
    const spy = vi
      .spyOn(globalThis.Intl, 'DateTimeFormat')
      .mockImplementation(function DateTimeFormat(locale, options) {
        return new Original(locale, options);
      });
    try {
      isLocaleDayFirst('en-US-u-ca-buddhist');
      expect(spy).toHaveBeenCalledWith('en-US-u-ca-buddhist', {calendar: 'gregory'});
    } finally {
      spy.mockRestore();
    }
  });
});

describe('time parsing and display', () => {
  it('parses and formats ISO times', () => {
    expect(parseISOTime('14:30')).toEqual({hour: 14, minute: 30, second: 0});
    expect(parseISOTime('23:59:59')).toEqual({hour: 23, minute: 59, second: 59});
    for (const bad of ['', '14', '14:30:45:00', '25:00', '14:60', '14:30:60', 'abc']) {
      expect(parseISOTime(bad), bad).toBeNull();
    }
    expect(formatISOTime({hour: 9, minute: 5, second: 3})).toBe('09:05');
    expect(formatISOTime({hour: 9, minute: 5, second: 3}, true)).toBe('09:05:03');
    expect(createISOTimeString('9:5')).toBe('09:05');
    expect(createISOTimeString('nope')).toBeNull();
  });

  it('displays 12-hour and 24-hour time', () => {
    expect(formatDisplayTime12h('00:00')).toBe('12:00 AM');
    expect(formatDisplayTime12h('12:00')).toBe('12:00 PM');
    expect(formatDisplayTime12h('14:30')).toBe('2:30 PM');
    expect(formatDisplayTime12h('14:30:15', true)).toBe('2:30:15 PM');
    expect(formatDisplayTime24h('09:05')).toBe('09:05');
    expect(formatDisplayTime24h('09:05:03', true)).toBe('09:05:03');
    expect(formatDisplayTime12h(undefined)).toBe('');
  });

  it('parses typed times in the usual shapes', () => {
    const cases: [string, string | null][] = [
      ['2:30 PM', '14:30'],
      ['2:30pm', '14:30'],
      ['2:30 p.m.', '14:30'],
      ['12:15 AM', '00:15'],
      ['12:15 PM', '12:15'],
      ['14:30', '14:30'],
      ['1430', '14:30'],
      ['2pm', '14:00'],
      ['2 PM', '14:00'],
      ['9', '09:00'],
      ['25:00', null],
      ['13:00 PM', null],
      ['abc', null],
      ['', null],
      ['2:75', null],
    ];
    for (const [text, expected] of cases) {
      expect(parseTimeInput(text), text).toBe(expected);
    }
    expect(parseTimeInput('143005', true)).toBe('14:30:05');
    expect(parseTimeInput('2:30:15 PM', true)).toBe('14:30:15');
  });

  it('compares, bounds, clamps and adjusts times', () => {
    expect(compareTime('09:00', '10:00')).toBeLessThan(0);
    expect(compareTime('10:00', '10:00')).toBe(0);
    expect(compareTime(undefined, '10:00')).toBeLessThan(0);
    expect(isTimeInRange('10:00', '09:00', '11:00')).toBe(true);
    expect(isTimeInRange('08:59', '09:00', '11:00')).toBe(false);
    expect(isTimeInRange('11:01', '09:00', '11:00')).toBe(false);
    expect(clampTime('08:00' as never, '09:00', '11:00')).toBe('09:00');
    expect(clampTime('12:00' as never, '09:00', '11:00')).toBe('11:00');
    expect(adjustTime('23:59', 1)).toBe('00:00');
    expect(adjustTime('00:00', -1)).toBe('23:59');
    expect(adjustTime('10:00', Number.NaN)).toBe('10:00');
    expect(adjustTime('10:00', -Infinity)).toBe('10:00');
  });

  it('displays and reads times in the locale: digits and day-period markers', () => {
    const arabic = formatDisplayTime12h('14:30', false, 'ar-SA');
    expect(arabic).toMatch(/[٠-٩]/u);
    expect(parseTimeInput(arabic, false, 'ar-SA')).toBe('14:30');
    expect(parseTimeInput('٢:٣٠ م', false, 'ar-SA')).toBe('14:30');
    expect(parseTimeInput('٢:٣٠ ص', false, 'ar-SA')).toBe('02:30');
    const hebrew = formatDisplayTime12h('14:30', false, 'he-IL');
    expect(parseTimeInput(hebrew, false, 'he-IL')).toBe('14:30');
    expect(formatDisplayTime24h('14:30', false, 'ar-SA')).toMatch(/[٠-٩]/u);
    expect(parseTimeInput(formatDisplayTime24h('14:30', false, 'ar-SA'), false, 'ar-SA')).toBe(
      '14:30',
    );
    expect(parseTimeInput('下午2:30', false, 'zh-CN')).toBe('14:30');
    expect(getMeridiemLabels('en-US')).toEqual({am: 'AM', pm: 'PM'});
    expect(formatDisplayTime12h('14:30', false, 'en-GB')).toBe('2:30 PM');
  });
});
