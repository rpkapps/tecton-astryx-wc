/**
 * Instants: how one moment on the timeline (a `Date`, an epoch value) reads as text (upstream
 * `Timestamp/formatInstant.ts`, `formatRelativeTime.ts` and `tooltipEntries.ts`, MIT, adapted). An instant
 * has no zone of its own: the zone is a *display* choice made per line of text, kept apart from the value
 * (`toISOString()` is always UTC), and the viewer's own zone is what `Intl` uses when none is named
 * [mwg:coordinate-global-events]. Relative wording, plural rules and word order come from `Intl.RelativeTimeFormat`.
 *
 * Boundary modules: `Intl` and `zoned.ts` are the only platform pieces used; `@internationalized/date` stays
 * behind `zoned.ts`.
 */
import {devWarn} from '../utils/dev.js';
import {SHARED_DATE_FORMAT_OPTIONS} from './format.js';

// ---------------------------------------------------------------------------------------- formats

/** Formats that read one fixed instant. `full` is the long style ("March 21, 2026 at 5:00:00 PM UTC"). */
export const INSTANT_FORMATS = [
  'date',
  'date_long',
  'date_weekday',
  'date_time',
  'time',
  'system_date',
  'system_date_time',
  'system_time',
  'unix_seconds',
  'full',
] as const;
export type InstantFormat = (typeof INSTANT_FORMATS)[number];

export interface FormatInstantOptions {
  /**
   * IANA time zone. Omit for the viewer's own zone, which is what `Intl` does with no `timeZone`: the omitted
   * path never builds an explicit-zone formatter. Must already be valid (see {@link resolveTimeZoneId}).
   */
  timeZone?: string | undefined;
  /** Append the zone abbreviation. Honoured by `date_time` and `time` only (`full` always has one). */
  timezoneShown?: boolean;
  /** How `full` spells its zone: `short` ("PST") or `long` ("Pacific Standard Time"). */
  timeZoneNameStyle?: 'short' | 'long';
}

const FULL_OPTIONS: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  second: '2-digit',
  timeZoneName: 'short',
};

const TIME_OPTIONS: Intl.DateTimeFormatOptions = {hour: 'numeric', minute: '2-digit'};

const DATE_TIME_OPTIONS: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  ...TIME_OPTIONS,
};

const pad = (value: number): string => String(value).padStart(2, '0');

interface Wall {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

/** Whether the platform knows the IANA zone. Plain `Intl`: a timestamp must not pull in the date library for this. */
function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', {timeZone});
    return true;
  } catch {
    return false;
  }
}

const zoneParts = new Map<string, Intl.DateTimeFormat>();

/** The wall clock an instant reads as in a zone: Gregorian, 24-hour, in numbers (stable in every locale). */
function getTimeZoneParts(instant: number, timeZone: string): Wall {
  let formatter = zoneParts.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      calendar: 'gregory',
      numberingSystem: 'latn',
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    });
    zoneParts.set(timeZone, formatter);
  }
  const wall = {year: 0, month: 0, day: 0, hour: 0, minute: 0, second: 0};
  for (const part of formatter.formatToParts(instant)) {
    if (part.type in wall) wall[part.type as keyof Wall] = Number(part.value);
  }
  return wall;
}

/** Wall-clock fields for an instant: in the named zone, or in the viewer's own, read straight off the `Date`. */
function wallClock(date: Date, timeZone: string | undefined): Wall {
  return timeZone === undefined
    ? {
        year: date.getFullYear(),
        month: date.getMonth() + 1,
        day: date.getDate(),
        hour: date.getHours(),
        minute: date.getMinutes(),
        second: date.getSeconds(),
      }
    : getTimeZoneParts(date.getTime(), timeZone);
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function dateTimeFormat(locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let formatter = formatters.get(key);
  if (!formatter) {
    try {
      formatter = new Intl.DateTimeFormat(locale, options);
    } catch {
      formatter = new Intl.DateTimeFormat('en', options);
    }
    formatters.set(key, formatter);
  }
  return formatter;
}

/** Renders one instant in one absolute format. Pure for a given locale (and, with no `timeZone`, host zone). */
export function formatInstant(
  date: Date,
  format: InstantFormat,
  locale: string,
  {timeZone, timezoneShown = false, timeZoneNameStyle = 'short'}: FormatInstantOptions = {},
): string {
  const zone = timeZone === undefined ? {} : {timeZone};
  const zoneName = timezoneShown ? {timeZoneName: 'short' as const} : {};
  switch (format) {
    case 'full':
      return dateTimeFormat(locale, {
        ...FULL_OPTIONS,
        timeZoneName: timeZoneNameStyle,
        ...zone,
        calendar: 'gregory',
      }).format(date);
    case 'date':
      return dateTimeFormat(locale, {
        ...SHARED_DATE_FORMAT_OPTIONS.date,
        ...zone,
        calendar: 'gregory',
      }).format(date);
    case 'date_long':
      return dateTimeFormat(locale, {
        ...SHARED_DATE_FORMAT_OPTIONS.date_long,
        ...zone,
        calendar: 'gregory',
      }).format(date);
    case 'date_weekday':
      return dateTimeFormat(locale, {
        ...SHARED_DATE_FORMAT_OPTIONS.date_weekday,
        ...zone,
        calendar: 'gregory',
      }).format(date);
    case 'date_time':
      return dateTimeFormat(locale, {
        ...DATE_TIME_OPTIONS,
        ...zoneName,
        ...zone,
        calendar: 'gregory',
      }).format(date);
    case 'time':
      return dateTimeFormat(locale, {...TIME_OPTIONS, ...zoneName, ...zone}).format(date);
    case 'system_date': {
      const wall = wallClock(date, timeZone);
      return `${wall.year}-${pad(wall.month)}-${pad(wall.day)}`;
    }
    case 'system_date_time': {
      const wall = wallClock(date, timeZone);
      return `${wall.year}-${pad(wall.month)}-${pad(wall.day)} ${pad(wall.hour)}:${pad(wall.minute)}:${pad(wall.second)}`;
    }
    case 'system_time': {
      const wall = wallClock(date, timeZone);
      return `${pad(wall.hour)}:${pad(wall.minute)}:${pad(wall.second)}`;
    }
    case 'unix_seconds':
      // Whole seconds since the epoch: an absolute instant, so a zone cannot change it.
      return String(Math.floor(date.getTime() / 1000));
  }
}

// ---------------------------------------------------------------------------------------- relative

const MINUTE = 60;
const HOUR = 3600;
const DAY = 86400;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

/** A future instant this close is clock skew, not a scheduled future: it reads as the present. */
const FUTURE_SKEW_TOLERANCE = 30;

export type RelativeTimeStyle = 'long' | 'narrow';

const relativeFormatters = new Map<string, Intl.RelativeTimeFormat>();

function relativeFormat(
  locale: string,
  style: RelativeTimeStyle,
  numeric: Intl.RelativeTimeFormatNumeric,
): Intl.RelativeTimeFormat {
  const key = `${locale}|${style}|${numeric}`;
  let formatter = relativeFormatters.get(key);
  if (!formatter) {
    try {
      formatter = new Intl.RelativeTimeFormat(locale, {numeric, style});
    } catch {
      formatter = new Intl.RelativeTimeFormat('en', {numeric, style});
    }
    relativeFormatters.set(key, formatter);
  }
  return formatter;
}

/**
 * The relative phrase for `date` at `now` ("2 hours ago", "in 3 days", "now"). The tier (seconds, minutes,
 * hours, days, months, years) is chosen here; the wording, plural rules and word order are the platform's.
 * `narrow` is the compact numeric form ("2h ago", "1d ago"); `long` keeps the "yesterday" idiom.
 */
export function formatRelativeTime(
  date: Date,
  now: Date,
  locale: string,
  style: RelativeTimeStyle,
): string {
  const diffSeconds = Math.round((now.getTime() - date.getTime()) / 1000);
  const absolute = Math.abs(diffSeconds);
  if (absolute < 10 || (diffSeconds < 0 && absolute <= FUTURE_SKEW_TOLERANCE)) {
    return relativeFormat(locale, style, 'auto').format(0, 'second');
  }
  let count: number;
  let unit: Intl.RelativeTimeFormatUnit;
  if (absolute < MINUTE) {
    count = absolute;
    unit = 'second';
  } else if (absolute < HOUR) {
    count = Math.floor(absolute / MINUTE);
    unit = 'minute';
  } else if (absolute < DAY) {
    count = Math.floor(absolute / HOUR);
    unit = 'hour';
  } else if (absolute < MONTH) {
    count = Math.floor(absolute / DAY);
    unit = 'day';
  } else if (absolute < YEAR) {
    count = Math.floor(absolute / MONTH);
    unit = 'month';
  } else {
    count = Math.floor(absolute / YEAR);
    unit = 'year';
  }
  // `Intl` counts the future as positive and the past as negative.
  const value = diffSeconds < 0 ? count : -count;
  const numeric = style === 'long' && unit === 'day' && value === -1 ? 'auto' : 'always';
  return relativeFormat(locale, style, numeric).format(value, unit);
}

/** Milliseconds until a live relative reading is worth redrawing, by how far away the instant is. */
export function liveInterval(diffSeconds: number): number {
  const absolute = Math.abs(diffSeconds);
  if (absolute < MINUTE) return 1000;
  if (absolute < HOUR) return 30_000;
  if (absolute < DAY) return 60_000;
  return 300_000;
}

// ---------------------------------------------------------------------------------- tooltip lines

/** One line of a timestamp's card: an instant in a zone and a format, with an optional label. */
export interface InstantLineEntry {
  /** IANA zone (`UTC`, `America/Los_Angeles`); omit or `local` for the viewer's own. */
  timezoneID?: string;
  /** How the line reads the instant. Default `full`. */
  format?: InstantFormat;
  /** Text beside the time, supplied already translated. */
  label?: string;
  /** Whether the line has a copy button. Default `false`. */
  isCopyable?: boolean;
}

/** A rendered line. */
export interface InstantLine {
  label?: string;
  value: string;
  isCopyable: boolean;
}

/** Spelling of a zone identifier that means "the viewer's own zone". */
const LOCAL_ZONE_ALIAS = 'local';
const warnedZones = new Set<string>();

/**
 * A zone identifier `Intl` accepts, or `undefined` for the viewer's own zone (the `local` alias, no identifier,
 * or one the platform does not know: that warns once and falls back rather than throwing).
 */
export function resolveTimeZoneId(timeZoneId: string | undefined): string | undefined {
  if (timeZoneId === undefined || timeZoneId.trim() === '') return undefined;
  if (timeZoneId.toLowerCase() === LOCAL_ZONE_ALIAS) return undefined;
  if (!isValidTimeZone(timeZoneId)) {
    if (!warnedZones.has(timeZoneId)) {
      warnedZones.add(timeZoneId);
      devWarn(
        `timestamp:zone:${timeZoneId}`,
        `unknown time zone ${JSON.stringify(timeZoneId)} in tooltipEntries. Falling back to the viewer's time zone.`,
      );
    }
    return undefined;
  }
  return timeZoneId;
}

/** Keyed on the *requested* zone, so the lines of a card do not change shape with where the reader is. */
const zoneKey = (resolved: string | undefined): string =>
  resolved === undefined ? LOCAL_ZONE_ALIAS : resolved.toLowerCase();

/**
 * Whether a line carries a zone abbreviation: `full` always does, `system_*` never does (a trailing "PST" would
 * break anything parsing it), and `date_time` and `time` do when the reader must tell several lines apart or the
 * line shows a zone the author named (an unmarked foreign time announced after a local one would mislead).
 */
function showsZoneName(format: InstantFormat, hasMultipleZones: boolean, named: boolean): boolean {
  if (format === 'full') return true;
  if (format === 'date_time' || format === 'time') return hasMultipleZones || named;
  return false;
}

/** One line per entry, in order. Pure for a given host zone and locale. */
export function formatInstantLines(
  date: Date,
  entries: readonly InstantLineEntry[],
  locale: string,
): InstantLine[] {
  const resolved = entries.map((entry) => resolveTimeZoneId(entry.timezoneID));
  const multiple = new Set(resolved.map(zoneKey)).size > 1;
  return entries.map((entry, index) => {
    const format = entry.format ?? 'full';
    const timeZone = resolved[index];
    return {
      ...(entry.label === undefined ? {} : {label: entry.label}),
      isCopyable: entry.isCopyable ?? false,
      value: formatInstant(date, format, locale, {
        timeZone,
        timezoneShown: showsZoneName(format, multiple, timeZone !== undefined),
      }),
    };
  });
}
