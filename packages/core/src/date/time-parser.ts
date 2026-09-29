/**
 * Time-of-day text and machine shapes (upstream `utils/timeParser.ts`, MIT, adapted). A time value is
 * stored as `HH:MM` or `HH:MM:SS` (24-hour ISO 8601, no time zone, no locale) and only *displayed* as
 * 12-hour or 24-hour text. Parsing reads what people type: `2:30 PM`, `2:30pm`, `14:30`, `1430`,
 * `2pm`, and, when a locale is given, digits of other scripts and the locale's own AM/PM markers
 * (`٢:٣٠ م`, `下午2:30`).
 *
 * Without a locale the functions behave exactly as upstream (English `AM`/`PM`, ASCII digits); with a
 * non-English locale the display comes from `Intl.DateTimeFormat`, so the digits, the day-period marker
 * and the separators are the reader's own. Times are wall-clock values: nothing here knows a zone
 * [mwg:model-partial-time-concepts].
 */
import type {ISOTimeString} from './date-types.js';
import {normalizeDateText} from './date-parser.js';

/** A parsed time. */
export interface ParsedTime {
  /** 0-23. */
  hour: number;
  /** 0-59. */
  minute: number;
  /** 0-59. */
  second: number;
}

/** Parses `HH:MM` or `HH:MM:SS`; `null` when it is not a valid 24-hour time. */
export function parseISOTime(time: string): ParsedTime | null {
  if (!time) return null;
  const parts = time.split(':');
  if (parts.length < 2 || parts.length > 3) return null;
  const hour = parseInt(parts[0]!, 10);
  const minute = parseInt(parts[1]!, 10);
  const second = parts.length === 3 ? parseInt(parts[2]!, 10) : 0;
  if (
    Number.isNaN(hour) ||
    Number.isNaN(minute) ||
    Number.isNaN(second) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59 ||
    second < 0 ||
    second > 59
  ) {
    return null;
  }
  return {hour, minute, second};
}

/** Serialises to `HH:MM` (or `HH:MM:SS` with `includeSeconds`). */
export function formatISOTime(time: ParsedTime, includeSeconds = false): ISOTimeString {
  const hh = time.hour.toString().padStart(2, '0');
  const mm = time.minute.toString().padStart(2, '0');
  if (includeSeconds)
    return `${hh}:${mm}:${time.second.toString().padStart(2, '0')}` as ISOTimeString;
  return `${hh}:${mm}` as ISOTimeString;
}

/** A valid ISO time in canonical form, or `null`. */
export function createISOTimeString(value: string): ISOTimeString | null {
  const parsed = parseISOTime(value);
  if (!parsed) return null;
  return formatISOTime(parsed, value.split(':').length === 3);
}

const isEnglish = (locale: string | undefined): boolean => !locale || /^en(?:-|$)/i.test(locale);

const displayFormatters = new Map<string, Intl.DateTimeFormat>();

function localizedTime(parsed: ParsedTime, includeSeconds: boolean, locale: string, h12: boolean) {
  const key = `${locale}|${includeSeconds}|${h12}`;
  let formatter = displayFormatters.get(key);
  if (!formatter) {
    try {
      formatter = new Intl.DateTimeFormat(locale, {
        hour: 'numeric',
        minute: '2-digit',
        ...(includeSeconds ? {second: '2-digit'} : {}),
        hourCycle: h12 ? 'h12' : 'h23',
        timeZone: 'UTC',
        calendar: 'gregory',
      });
    } catch {
      formatter = new Intl.DateTimeFormat('en', {
        hour: 'numeric',
        minute: '2-digit',
        hourCycle: h12 ? 'h12' : 'h23',
        timeZone: 'UTC',
      });
    }
    displayFormatters.set(key, formatter);
  }
  return formatter.format(
    new Date(Date.UTC(2000, 0, 1, parsed.hour, parsed.minute, parsed.second)),
  );
}

/** 12-hour display ("2:30 PM"). With a non-English `locale`, the locale's own digits and day-period marker. */
export function formatDisplayTime12h(
  time: ISOTimeString | string | undefined,
  includeSeconds = false,
  locale?: string,
): string {
  if (!time) return '';
  const parsed = parseISOTime(time);
  if (!parsed) return '';
  if (!isEnglish(locale)) return localizedTime(parsed, includeSeconds, locale!, true);
  const hour12 = parsed.hour === 0 ? 12 : parsed.hour > 12 ? parsed.hour - 12 : parsed.hour;
  const meridiem = parsed.hour < 12 ? 'AM' : 'PM';
  const mm = parsed.minute.toString().padStart(2, '0');
  if (includeSeconds)
    return `${hour12}:${mm}:${parsed.second.toString().padStart(2, '0')} ${meridiem}`;
  return `${hour12}:${mm} ${meridiem}`;
}

/** 24-hour display ("14:30"). With a non-English `locale`, the locale's own digits. */
export function formatDisplayTime24h(
  time: ISOTimeString | string | undefined,
  includeSeconds = false,
  locale?: string,
): string {
  if (!time) return '';
  const parsed = parseISOTime(time);
  if (!parsed) return '';
  if (!isEnglish(locale)) return localizedTime(parsed, includeSeconds, locale!, false);
  const hh = parsed.hour.toString().padStart(2, '0');
  const mm = parsed.minute.toString().padStart(2, '0');
  if (includeSeconds) return `${hh}:${mm}:${parsed.second.toString().padStart(2, '0')}`;
  return `${hh}:${mm}`;
}

const meridiemTables = new Map<string, {am: string; pm: string}>();

/** The locale's morning and afternoon markers as its 12-hour clock writes them (`AM`/`PM`, `ص`/`م`). */
export function getMeridiemLabels(locale: string): {am: string; pm: string} {
  let labels = meridiemTables.get(locale);
  if (labels) return labels;
  labels = {am: 'AM', pm: 'PM'};
  try {
    const formatter = new Intl.DateTimeFormat(locale, {
      hour: 'numeric',
      hourCycle: 'h12',
      timeZone: 'UTC',
    });
    const marker = (hour: number): string =>
      formatter
        .formatToParts(new Date(Date.UTC(2000, 0, 1, hour)))
        .find((part) => part.type === 'dayPeriod')?.value ?? '';
    labels = {am: marker(9) || 'AM', pm: marker(15) || 'PM'};
  } catch {
    // Keep English.
  }
  meridiemTables.set(locale, labels);
  return labels;
}

type Meridiem = 'am' | 'pm' | null;

/** Removes a localized day-period marker (prefix or suffix) and says which it was. */
function stripLocalizedMeridiem(text: string, locale: string): {text: string; meridiem: Meridiem} {
  const {am, pm} = getMeridiemLabels(locale);
  const lower = text.toLocaleLowerCase();
  for (const [label, meridiem] of [
    [pm, 'pm'],
    [am, 'am'],
  ] as const) {
    const key = label.toLocaleLowerCase().replace(/[\s.]+$/u, '');
    if (!key) continue;
    if (lower.endsWith(key) || lower.endsWith(`${key}.`)) {
      return {text: text.slice(0, lower.lastIndexOf(key)).trim(), meridiem};
    }
    if (lower.startsWith(key)) return {text: text.slice(key.length).trim(), meridiem};
  }
  return {text, meridiem: null};
}

/**
 * Parses user input into an ISO time, or `null`. Accepts `2:30 PM`, `2:30pm`, `2:30 p.m.`, `14:30`,
 * `1430`, `143000`, `2pm`. With `locale`, digits of other scripts and that locale's AM/PM markers too.
 */
export function parseTimeInput(
  input: string,
  includeSeconds = false,
  locale?: string,
): ISOTimeString | null {
  if (!input) return null;
  let trimmed = (isEnglish(locale) ? input : normalizeDateText(input)).trim().toLowerCase();
  if (!trimmed) return null;

  let isPM: boolean;
  let isAM: boolean;
  let timeStr: string;
  if (!isEnglish(locale)) {
    const stripped = stripLocalizedMeridiem(trimmed, locale!);
    if (stripped.meridiem) {
      trimmed = stripped.text;
      isPM = stripped.meridiem === 'pm';
      isAM = stripped.meridiem === 'am';
      timeStr = trimmed;
    } else {
      isPM = /p\.?m?\.?\s*$/i.test(trimmed);
      isAM = /a\.?m?\.?\s*$/i.test(trimmed);
      timeStr = trimmed.replace(/\s*[ap]\.?m?\.?\s*$/i, '').trim();
    }
  } else {
    // hasMeridiem derives from isPM/isAM so the detection cannot drift from them: dotted meridiems
    // ("2:30 p.m.") must convert 12h to 24h too.
    isPM = /p\.?m?\.?\s*$/i.test(trimmed);
    isAM = /a\.?m?\.?\s*$/i.test(trimmed);
    timeStr = trimmed.replace(/\s*[ap]\.?m?\.?\s*$/i, '').trim();
  }
  const hasMeridiem = isPM || isAM;

  const to24 = (hour: number): number | null => {
    if (!hasMeridiem) return hour;
    if (hour < 1 || hour > 12) return null;
    if (isPM && hour !== 12) return hour + 12;
    if (isAM && hour === 12) return 0;
    return hour;
  };

  // "2pm" -> "2"
  if (/^\d{1,2}$/.test(timeStr)) {
    const hour24 = to24(parseInt(timeStr, 10));
    if (hour24 === null || hour24 < 0 || hour24 > 23) return null;
    return formatISOTime({hour: hour24, minute: 0, second: 0}, includeSeconds);
  }

  // "1430"
  if (/^\d{4}$/.test(timeStr)) {
    const hour24 = to24(parseInt(timeStr.slice(0, 2), 10));
    const minute = parseInt(timeStr.slice(2, 4), 10);
    if (hour24 !== null && hour24 >= 0 && hour24 <= 23 && minute >= 0 && minute <= 59) {
      return formatISOTime({hour: hour24, minute, second: 0}, includeSeconds);
    }
    return null;
  }

  // "143000"
  if (/^\d{6}$/.test(timeStr)) {
    const hour24 = to24(parseInt(timeStr.slice(0, 2), 10));
    const minute = parseInt(timeStr.slice(2, 4), 10);
    const second = parseInt(timeStr.slice(4, 6), 10);
    if (
      hour24 !== null &&
      hour24 >= 0 &&
      hour24 <= 23 &&
      minute >= 0 &&
      minute <= 59 &&
      second >= 0 &&
      second <= 59
    ) {
      return formatISOTime({hour: hour24, minute, second}, includeSeconds);
    }
    return null;
  }

  // "2:30", "14:30:15" (a "." separates hours and minutes in some locales: "14.30")
  const colonParts = timeStr.replace(/(\d)\.(\d)/g, '$1:$2').split(':');
  if (colonParts.length >= 2 && colonParts.length <= 3) {
    let hour = parseInt(colonParts[0]!, 10);
    const minute = parseInt(colonParts[1]!, 10);
    const second = colonParts.length === 3 ? parseInt(colonParts[2]!, 10) : 0;
    if (Number.isNaN(hour) || Number.isNaN(minute) || Number.isNaN(second)) return null;
    if (minute < 0 || minute > 59 || second < 0 || second > 59) return null;
    if (hasMeridiem) {
      if (hour < 1 || hour > 12) return null;
      if (isPM && hour !== 12) hour += 12;
      if (isAM && hour === 12) hour = 0;
    } else if (hour < 0 || hour > 23) {
      return null;
    }
    return formatISOTime({hour, minute, second}, includeSeconds);
  }
  return null;
}

/** Negative, zero or positive: chronological order of two times (a missing time sorts first). */
export function compareTime(
  a: ISOTimeString | string | undefined,
  b: ISOTimeString | string | undefined,
): number {
  if (!a && !b) return 0;
  if (!a) return -1;
  if (!b) return 1;
  const parsedA = parseISOTime(a);
  const parsedB = parseISOTime(b);
  if (!parsedA && !parsedB) return 0;
  if (!parsedA) return -1;
  if (!parsedB) return 1;
  const totalA = parsedA.hour * 3600 + parsedA.minute * 60 + parsedA.second;
  const totalB = parsedB.hour * 3600 + parsedB.minute * 60 + parsedB.second;
  return totalA - totalB;
}

/** Whether a time is inside `min`..`max`, both inclusive; either bound may be absent. */
export function isTimeInRange(
  time: ISOTimeString | string,
  min?: ISOTimeString | string,
  max?: ISOTimeString | string,
): boolean {
  // A bound that is not a time is no bound (an unreadable attribute never rules every time out).
  if (min && parseISOTime(min) && compareTime(time, min) < 0) return false;
  if (max && parseISOTime(max) && compareTime(time, max) > 0) return false;
  return true;
}

/** Clamps a time into `min`..`max`. */
export function clampTime(
  time: ISOTimeString,
  min?: ISOTimeString | string,
  max?: ISOTimeString | string,
  includeSeconds = false,
): ISOTimeString {
  const parsed = parseISOTime(time);
  if (!parsed) return time;
  if (min && compareTime(time, min) < 0) {
    const parsedMin = parseISOTime(min);
    if (parsedMin) return formatISOTime(parsedMin, includeSeconds);
  }
  if (max && compareTime(time, max) > 0) {
    const parsedMax = parseISOTime(max);
    if (parsedMax) return formatISOTime(parsedMax, includeSeconds);
  }
  return time;
}

/** Adds (or subtracts) minutes, wrapping around midnight. A non-finite delta returns the time unchanged. */
export function adjustTime(
  time: ISOTimeString | string,
  deltaMinutes: number,
  includeSeconds = false,
): ISOTimeString {
  const parsed = parseISOTime(time);
  if (!parsed) return time as ISOTimeString;
  if (!Number.isFinite(deltaMinutes)) return time as ISOTimeString;
  const day = 24 * 60;
  const total = (((parsed.hour * 60 + parsed.minute + deltaMinutes) % day) + day) % day;
  return formatISOTime(
    {hour: Math.floor(total / 60), minute: total % 60, second: parsed.second},
    includeSeconds,
  );
}
