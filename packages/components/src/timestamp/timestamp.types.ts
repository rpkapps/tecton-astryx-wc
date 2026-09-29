import type {InstantFormat, InstantLineEntry} from '@tecton-wc/core/date/instant.js';

/** How a timestamp reads: relative ("2 hours ago"), an absolute date or time, or a machine shape. */
export const TIMESTAMP_FORMATS = [
  'relative',
  'relative_short',
  'auto',
  'date',
  'date_long',
  'date_weekday',
  'date_time',
  'time',
  'system_date',
  'system_date_time',
  'system_time',
  'unix_seconds',
] as const;
export type TimestampFormat = (typeof TIMESTAMP_FORMATS)[number];

/** How a line of the card reads the instant: any absolute format, or `full` (the long style with a zone name). */
export type TimestampTooltipFormat = InstantFormat;

/**
 * One line of the card: `timezoneID` (an IANA zone, or `local`/omitted for the viewer's own), `format`
 * (default `full`), a `label` (supplied already translated) and `isCopyable` (a copy button; default `false`).
 */
export type TimestampTooltipEntry = InstantLineEntry;

/** Default of `auto-threshold`: seven days, in seconds. */
export const DEFAULT_AUTO_THRESHOLD = 7 * 86400;
