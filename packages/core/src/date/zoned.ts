/**
 * Time zones, kept apart from storage and display. A date-only value is a `PlainDate` and a
 * time-of-day value is an `ISOTimeString`: neither knows a zone. A zone enters only here, where an
 * absolute instant (a Unix time, an ISO string with an offset) is read as the wall clock of an IANA
 * zone, or a wall clock in a zone is turned into an instant. Ambiguous or skipped wall times around a
 * DST change resolve with the platform's `compatible` rule (the later time for a gap, the earlier for
 * an overlap) [mwg:coordinate-global-events] [mwg:capture-location-agnostic-data].
 *
 * Runs on `@internationalized/date`'s `ZonedDateTime`, which is Temporal-shaped and works in every
 * Tier-1 engine (native Temporal is not in Safari).
 */
import {CalendarDateTime, fromAbsolute, toZoned} from '@internationalized/date';
import {plainDateCreate} from './plain-date.js';
import type {PlainDate} from './date-types.js';

/** The wall-clock fields an instant reads as in a zone. */
export interface WallClock {
  year: number;
  /** 1-based. */
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

/** The IANA identifier of the viewer's own time zone. */
export function getLocalTimeZoneId(): string {
  return new Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/** Whether the platform knows the IANA zone (`UTC`, `America/New_York`). */
export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', {timeZone});
    return true;
  } catch {
    return false;
  }
}

/**
 * The wall clock an instant (milliseconds since the epoch) reads as in a zone, Gregorian, 24-hour, in
 * numbers: stable whatever the viewer's locale, so callers can assemble machine shapes from them.
 */
export function getTimeZoneParts(instant: number, timeZone: string): WallClock {
  const zoned = fromAbsolute(instant, timeZone);
  return {
    year: zoned.year,
    month: zoned.month,
    day: zoned.day,
    hour: zoned.hour,
    minute: zoned.minute,
    second: zoned.second,
  };
}

/** The instant (ms since the epoch) at which `date` and `hour:minute` is the wall clock in `timeZone`. */
export function plainDateToInstant(
  date: PlainDate,
  timeZone: string,
  hour = 0,
  minute = 0,
): number {
  const wall = new CalendarDateTime(date.year, date.month, date.day, hour, minute);
  return toZoned(wall, timeZone, 'compatible').toDate().getTime();
}

/** The calendar date an instant falls on in `timeZone`. */
export function plainDateFromInstant(instant: number, timeZone: string): PlainDate {
  const parts = getTimeZoneParts(instant, timeZone);
  return plainDateCreate(parts.year, parts.month, parts.day);
}
