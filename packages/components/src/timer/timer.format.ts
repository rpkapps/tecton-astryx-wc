/**
 * Pure duration maths for `tct-timer`: the shapes of the two standard formats and the cadence of the next
 * change. Kept free of the clock and of the element so it is trivially testable.
 */
import type {TimerFormat} from './timer.types.js';

export const ONE_SECOND_MS = 1000;
export const ONE_MINUTE_MS = 60 * ONE_SECOND_MS;
const ONE_HOUR_SECONDS = 60 * 60;
/** `setTimeout` clamps delays above this (a signed 32-bit integer) to 1 ms. */
export const MAX_TIMEOUT_MS = 2_147_483_647;

/** The number parts of one reading; the element turns them into localised text. */
export interface TimerReading {
  /** ISO 8601 duration for `<time datetime>`. */
  dateTime: string;
  /** `clock`: `[h?, m, s]`; `elapsed`: the units to show, largest first (`s` | `m s` | `h m`). */
  parts: readonly TimerPart[];
}

export interface TimerPart {
  unit: 'hour' | 'minute' | 'second';
  value: number;
  /** Zero-padded to two digits (every part but the leading one). */
  padded: boolean;
}

/** Reads the whole elapsed milliseconds into the parts of `format` (never negative). */
export function readDuration(elapsedMilliseconds: number, format: TimerFormat): TimerReading {
  const elapsedSeconds = Math.floor(Math.max(0, elapsedMilliseconds) / ONE_SECOND_MS);

  if (format === 'clock') {
    const hours = Math.floor(elapsedSeconds / ONE_HOUR_SECONDS);
    const minutes = Math.floor((elapsedSeconds % ONE_HOUR_SECONDS) / 60);
    const seconds = elapsedSeconds % 60;
    return {
      dateTime: `PT${elapsedSeconds}S`,
      parts:
        hours > 0
          ? [
              {unit: 'hour', value: hours, padded: false},
              {unit: 'minute', value: minutes, padded: true},
              {unit: 'second', value: seconds, padded: true},
            ]
          : [
              {unit: 'minute', value: minutes, padded: false},
              {unit: 'second', value: seconds, padded: true},
            ],
    };
  }

  if (elapsedSeconds < 60) {
    return {
      dateTime: `PT${elapsedSeconds}S`,
      parts: [{unit: 'second', value: elapsedSeconds, padded: false}],
    };
  }

  const totalMinutes = Math.floor(elapsedSeconds / 60);
  if (totalMinutes < 60) {
    return {
      dateTime: `PT${elapsedSeconds}S`,
      parts: [
        {unit: 'minute', value: totalMinutes, padded: false},
        {unit: 'second', value: elapsedSeconds % 60, padded: true},
      ],
    };
  }

  // From an hour on the elapsed format drops the seconds; the datetime says what is shown.
  return {
    dateTime: `PT${totalMinutes * 60}S`,
    parts: [
      {unit: 'hour', value: Math.floor(totalMinutes / 60), padded: false},
      {unit: 'minute', value: totalMinutes % 60, padded: true},
    ],
  };
}

/** Milliseconds until the text can next change, so the timer wakes once per visible change. */
export function millisecondsUntilNextChange(
  now: number,
  startTime: number,
  elapsedMilliseconds: number,
  format: TimerFormat,
): number {
  // A start in the future reads zero; its first visible change is one second after it begins.
  if (now < startTime) return Math.min(startTime - now + ONE_SECOND_MS, MAX_TIMEOUT_MS);
  const precision =
    format === 'elapsed' && elapsedMilliseconds >= ONE_HOUR_SECONDS * ONE_SECOND_MS
      ? ONE_MINUTE_MS
      : ONE_SECOND_MS;
  return precision - (elapsedMilliseconds % precision);
}
