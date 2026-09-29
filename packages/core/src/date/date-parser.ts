/**
 * Date text to `PlainDate` (upstream `utils/dateParser.ts`, MIT, adapted): what a person types or
 * pastes into a date field. Storage stays ISO; this only reads *display* text, so it is generous:
 *
 * - ISO (`2026-01-25`), English month names (`Jan 25, 2026`, `25 January`), numeric dates with `/`, `-`
 *   or `.` with or without a year (`3/4/2026`, `25.1`), the way upstream reads them;
 * - digits of other scripts (`٢٥/٣/٢٠٢٦` in Arabic, full-width digits from an IME) are folded to ASCII first;
 * - month names of the reader's own language, so the text a field *displays* (`21 במרץ 2026`, `21. März
 *   2026`, `2026年3月21日`) reads back as the same date. A leading weekday (`Wed, Mar 21, 2026`) is ignored.
 *
 * Ambiguous numeric input (both numbers 12 or below) takes its order from the locale
 * ({@link isLocaleDayFirst}); a number above 12 settles it. Nothing here is a general parser: unreadable
 * text is `null`, and a bare number (`2026`, `01`) is an in-progress edit, not a date.
 */
import type {PlainDate} from './date-types.js';
import {plainDateCreate, plainDateFromDate} from './plain-date.js';

/** Whether the locale writes the day before the month (`DD/MM/YYYY`). */
export function isLocaleDayFirst(locale = 'en'): boolean {
  const parts = new Intl.DateTimeFormat(locale, {calendar: 'gregory'}).formatToParts(
    new Date(2000, 0, 15),
  );
  const dayIndex = parts.findIndex((part) => part.type === 'day');
  const monthIndex = parts.findIndex((part) => part.type === 'month');
  return dayIndex < monthIndex;
}

// Zero code points of the decimal-digit blocks people type or paste.
const DIGIT_ZEROS = [0x0660, 0x06f0, 0x07c0, 0x0966, 0x09e6, 0x0a66, 0x0ae6, 0x0e50, 0xff10];

/**
 * Folds digits of other scripts to ASCII, drops directional marks and reads locale separators
 * (Arabic comma, decimal and date separators, non-breaking spaces) as their ASCII equivalents.
 */
export function normalizeDateText(text: string): string {
  let result = '';
  for (const char of text.normalize('NFKC')) {
    const code = char.codePointAt(0) ?? 0;
    const zero = DIGIT_ZEROS.find((start) => code >= start && code <= start + 9);
    if (zero !== undefined) result += String(code - zero);
    else if (/[‎‏؜‪-‮⁦-⁩]/.test(char)) continue;
    else if (char === '،' || char === '٫') result += ',';
    else if (char === '٬') result += '/';
    else if (/\s/.test(char)) result += ' ';
    else result += char;
  }
  return result.trim();
}

const ENGLISH_MONTHS = [
  ['january', 'jan'],
  ['february', 'feb'],
  ['march', 'mar'],
  ['april', 'apr'],
  ['may'],
  ['june', 'jun'],
  ['july', 'jul'],
  ['august', 'aug'],
  ['september', 'sep', 'sept'],
  ['october', 'oct'],
  ['november', 'nov'],
  ['december', 'dec'],
] as const;

const wordKey = (word: string): string =>
  word
    .normalize('NFC')
    .toLocaleLowerCase()
    .replace(/[.’']+$/u, '')
    .trim();

const monthTables = new Map<string, Map<string, number>>();
const weekdayTables = new Map<string, Set<string>>();

/** Month names (long, short, stand-alone and in-date forms) of a locale, plus English, to month numbers. */
function monthNames(locale: string): Map<string, number> {
  let table = monthTables.get(locale);
  if (table) return table;
  table = new Map<string, number>();
  ENGLISH_MONTHS.forEach((names, index) => {
    for (const name of names) table.set(name, index + 1);
  });
  const shapes: Intl.DateTimeFormatOptions[] = [
    {month: 'long'},
    {month: 'short'},
    {day: 'numeric', month: 'long'},
    {day: 'numeric', month: 'short'},
    {year: 'numeric', month: 'long', day: 'numeric'},
  ];
  try {
    for (const shape of shapes) {
      const formatter = new Intl.DateTimeFormat(locale, {
        ...shape,
        calendar: 'gregory',
        timeZone: 'UTC',
      });
      for (let month = 0; month < 12; month++) {
        for (const part of formatter.formatToParts(new Date(Date.UTC(2000, month, 15)))) {
          if (part.type === 'month' && /\p{L}/u.test(part.value)) {
            const key = wordKey(part.value);
            if (!table.has(key)) table.set(key, month + 1);
          }
        }
      }
    }
  } catch {
    // An invalid tag: English names only.
  }
  monthTables.set(locale, table);
  return table;
}

/** Weekday names (long and short) of a locale, plus English: read and ignored in a date. */
function weekdayNames(locale: string): Set<string> {
  let table = weekdayTables.get(locale);
  if (table) return table;
  table = new Set<string>();
  for (const language of new Set(['en', locale])) {
    for (const weekday of ['long', 'short'] as const) {
      try {
        const formatter = new Intl.DateTimeFormat(language, {weekday, timeZone: 'UTC'});
        for (let day = 0; day < 7; day++) {
          table.add(wordKey(formatter.format(new Date(Date.UTC(2000, 0, 2 + day)))));
        }
      } catch {
        // Skip an invalid tag.
      }
    }
  }
  weekdayTables.set(locale, table);
  return table;
}

function tryCreate(year: number, month: number, day: number): PlainDate | null {
  try {
    return plainDateCreate(year, month, day);
  } catch {
    return null;
  }
}

function monthFromWord(word: string, locale: string): number | null {
  const names = monthNames(locale);
  const key = wordKey(word);
  const direct = names.get(key);
  if (direct !== undefined) return direct;
  // Hebrew attaches the preposition "ב" ("in") to the month: `במרץ` is "in March".
  if (/^\p{Script=Hebrew}/u.test(key) && key.length > 2) return names.get(key.slice(1)) ?? null;
  return null;
}

/**
 * Reads text with a month word. The other tokens are day and year: a four-digit token is the year,
 * a one- or two-digit token the day; without a year the current year is used. Weekday words are ignored.
 */
function parseWithMonthName(
  words: string[],
  numbers: string[],
  locale: string,
  currentYear: number,
): PlainDate | null {
  let month: number | null = null;
  for (const word of words) {
    const found = monthFromWord(word, locale);
    if (found !== null) {
      if (month !== null) return null;
      month = found;
    } else if (!weekdayNames(locale).has(wordKey(word)) && wordKey(word).length > 3) {
      // Short leftovers are date noise ("г." after a Russian year); anything longer is not a date.
      return null;
    }
  }
  if (month === null) return null;
  const year = numbers.find((token) => token.length === 4);
  const days = numbers.filter((token) => token.length <= 2);
  if (days.length !== 1 || numbers.length !== days.length + (year ? 1 : 0)) return null;
  return tryCreate(year ? Number(year) : currentYear, month, Number(days[0]));
}

function parseNumericDate(
  first: number,
  second: number,
  year: number,
  locale: string,
): PlainDate | null {
  let day: number;
  let month: number;
  if (first > 12 && second <= 12) {
    day = first;
    month = second;
  } else if (second > 12 && first <= 12) {
    month = first;
    day = second;
  } else if (first > 12 && second > 12) {
    return null;
  } else if (isLocaleDayFirst(locale)) {
    day = first;
    month = second;
  } else {
    month = first;
    day = second;
  }
  return tryCreate(year, month, day);
}

/** Three numbers with a four-digit year: day and month follow the number order of the locale. */
function parseNumbersInLocaleOrder(numbers: string[], locale: string): PlainDate | null {
  const yearIndex = numbers.findIndex((token) => token.length === 4);
  if (yearIndex === -1) return null;
  const rest = numbers.filter((_, index) => index !== yearIndex).map(Number);
  return parseNumericDate(rest[0]!, rest[1]!, Number(numbers[yearIndex]), locale);
}

/**
 * Parses user input into a `PlainDate`, or `null` when it is not a complete, real date.
 *
 * `locale` picks the day/month order of ambiguous numeric input and the month names it reads besides
 * English. It does not read other calendar systems: Gregorian only.
 */
export function parseDateInput(input: string, locale = 'en'): PlainDate | null {
  const trimmed = normalizeDateText(input);
  if (!trimmed) return null;
  const currentYear = new Date().getFullYear();

  // 1. ISO is unambiguous.
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(trimmed);
  if (iso) return tryCreate(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  // 2. Numeric with separators, with a year: "25/1/2026", "31-12-2026", "3.4.2026".
  const withYear = /^(\d{1,2})([-/.])(\d{1,2})([-/.])(\d{4})$/.exec(trimmed);
  if (withYear) {
    if (withYear[2] !== withYear[4]) return null;
    return parseNumericDate(Number(withYear[1]), Number(withYear[3]), Number(withYear[5]), locale);
  }

  // 3. Year first with any separators: "2026/03/21", "2026.3.21", "2026年3月21日", "2026. 3. 21.".
  const yearFirst = /^(\d{4})\D+(\d{1,2})\D+(\d{1,2})\D*$/.exec(trimmed);
  if (yearFirst) return tryCreate(Number(yearFirst[1]), Number(yearFirst[2]), Number(yearFirst[3]));

  // 4. Numeric without a year: "1/25", "25.1", "12-31".
  const noYear = /^(\d{1,2})[-/.](\d{1,2})\.?$/.exec(trimmed);
  if (noYear) return parseNumericDate(Number(noYear[1]), Number(noYear[2]), currentYear, locale);

  // 5. Month names, English or the locale's, in any order.
  const words = trimmed.match(/[\p{L}\p{M}][\p{L}\p{M}.'’]*/gu) ?? [];
  const numbers = trimmed.match(/\d+/g) ?? [];
  if (words.length > 0 && numbers.length > 0) {
    const named = parseWithMonthName(words, numbers, locale, currentYear);
    if (named) return named;
  }

  // 5b. Words that name no month around three numbers ("21 tháng 3, 2026"): the numbers keep their order.
  if (words.length > 0 && words.length <= 2 && numbers.length === 3) {
    const spelled = parseNumbersInLocaleOrder(numbers, locale);
    if (spelled && words.every((word) => wordKey(word).length <= 6)) return spelled;
  }

  // 6. Day, month, year separated by anything but a month word or a bare separator: "21 3 2026".
  const spaced = /^(\d{1,2}) +(\d{1,2}) +(\d{4})$/.exec(trimmed);
  if (spaced)
    return parseNumericDate(Number(spaced[1]), Number(spaced[2]), Number(spaced[3]), locale);

  // 7. Bare numbers are edits in progress ("0", "01", "2026"); native parsing would coerce them.
  if (/^\d+$/.test(trimmed) || words.length > 0 || !/\d{4}/.test(trimmed)) return null;

  // 8. Whatever the platform can read (RFC 2822, ISO with time), only with an explicit year.
  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    const date = plainDateFromDate(parsed);
    return tryCreate(date.year, date.month, date.day);
  }
  return null;
}
