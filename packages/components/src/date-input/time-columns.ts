/**
 * The arithmetic behind the time columns of the touch picker (upstream TouchTimeField, MIT, adapted): which
 * options each column offers, which of them the `min`..`max` window rules out, and the time a pick composes
 * with the columns that did not change. Pure functions: the panel and the date-time field share them, and a
 * time is a wall-clock value here, never an instant [mwg:model-partial-time-concepts].
 */
import type {ISOTimeString} from '@tecton-wc/core/date/date-types.js';
import {
  clampTime,
  formatISOTime,
  isTimeInRange,
  parseISOTime,
  type ParsedTime,
} from '@tecton-wc/core/date/time-parser.js';

export type TimeUnit = 'hour' | 'minute' | 'second' | 'meridiem';
export type HourFormat = '12h' | '24h';

export interface TimeColumnOption {
  /** 24-hour value for the hour column in `24h`, the 12-hour value (1-12) in `12h`; 0-59; 0 (AM) or 1 (PM). */
  value: number;
  label: string;
  /** No time inside `min`..`max` has this option. */
  disabled: boolean;
}

export interface TimeColumn {
  unit: TimeUnit;
  options: TimeColumnOption[];
  /** The option that is selected now. */
  selected: number;
}

export const hour12From24 = (hour: number): number =>
  hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;

/** 12-hour value (1-12) and meridiem (0 AM, 1 PM) to 24-hour. */
export const hour24From12 = (hour: number, meridiem: number): number =>
  meridiem === 0 ? (hour === 12 ? 0 : hour) : hour === 12 ? 12 : hour + 12;

function seconds(time: ISOTimeString | string | undefined): number | null {
  if (!time) return null;
  const parsed = parseISOTime(time);
  return parsed ? parsed.hour * 3600 + parsed.minute * 60 + parsed.second : null;
}

/** Whether some time in `[start, end]` seconds of the day lies inside `min`..`max`. */
export function windowOverlaps(
  start: number,
  end: number,
  min: string | undefined,
  max: string | undefined,
): boolean {
  const low = seconds(min);
  const high = seconds(max);
  return (low === null || end >= low) && (high === null || start <= high);
}

export interface TimeColumnsOptions {
  time: ParsedTime;
  hasSeconds: boolean;
  hourFormat: HourFormat;
  min?: string | undefined;
  max?: string | undefined;
  /** Text of a number 0-59 (two digits, the reader's own digits). */
  formatNumber: (value: number, pad: boolean) => string;
  meridiemLabels: {am: string; pm: string};
}

/** The columns, in reading order: hour, minute, [second], [AM/PM]. */
export function buildTimeColumns(options: TimeColumnsOptions): TimeColumn[] {
  const {time, hasSeconds, hourFormat, min, max, formatNumber, meridiemLabels} = options;
  const meridiem = time.hour < 12 ? 0 : 1;
  const columns: TimeColumn[] = [];

  if (hourFormat === '24h') {
    columns.push({
      unit: 'hour',
      selected: time.hour,
      options: Array.from({length: 24}, (_, hour) => ({
        value: hour,
        label: formatNumber(hour, true),
        disabled: !windowOverlaps(hour * 3600, hour * 3600 + 3599, min, max),
      })),
    });
  } else {
    columns.push({
      unit: 'hour',
      selected: hour12From24(time.hour),
      options: Array.from({length: 12}, (_, index) => {
        const hour = index + 1;
        const hour24 = hour24From12(hour, meridiem);
        return {
          value: hour,
          label: formatNumber(hour, false),
          disabled: !windowOverlaps(hour24 * 3600, hour24 * 3600 + 3599, min, max),
        };
      }),
    });
  }

  columns.push({
    unit: 'minute',
    selected: time.minute,
    options: Array.from({length: 60}, (_, minute) => {
      const start = time.hour * 3600 + minute * 60;
      return {
        value: minute,
        label: formatNumber(minute, true),
        disabled: !windowOverlaps(start, start + (hasSeconds ? 59 : 0), min, max),
      };
    }),
  });

  if (hasSeconds) {
    columns.push({
      unit: 'second',
      selected: time.second,
      options: Array.from({length: 60}, (_, second) => ({
        value: second,
        label: formatNumber(second, true),
        disabled: !isTimeInRange(
          formatISOTime({hour: time.hour, minute: time.minute, second}, true),
          min,
          max,
        ),
      })),
    });
  }

  if (hourFormat === '12h') {
    columns.push({
      unit: 'meridiem',
      selected: meridiem,
      options: [
        {
          value: 0,
          label: meridiemLabels.am,
          disabled: !windowOverlaps(0, 11 * 3600 + 3599, min, max),
        },
        {
          value: 1,
          label: meridiemLabels.pm,
          disabled: !windowOverlaps(12 * 3600, 23 * 3600 + 3599, min, max),
        },
      ],
    });
  }
  return columns;
}

/**
 * The time a pick composes: `value` of `unit` replaces that part of `time`, the rest stays, and the result is
 * clamped into `min`..`max`. In the 12-hour hour column the pick keeps the meridiem.
 */
export function composeTime(
  time: ParsedTime,
  unit: TimeUnit,
  value: number,
  options: {
    hasSeconds: boolean;
    hourFormat: HourFormat;
    min?: string | undefined;
    max?: string | undefined;
  },
): ISOTimeString {
  const meridiem = time.hour < 12 ? 0 : 1;
  let hour = time.hour;
  let minute = time.minute;
  let second = time.second;
  switch (unit) {
    case 'hour':
      hour = options.hourFormat === '24h' ? value : hour24From12(value, meridiem);
      break;
    case 'meridiem':
      hour = hour24From12(hour12From24(hour), value);
      break;
    case 'minute':
      minute = value;
      break;
    case 'second':
      second = value;
      break;
  }
  const composed = formatISOTime(
    {hour, minute, second: options.hasSeconds ? second : 0},
    options.hasSeconds,
  );
  return clampTime(composed, options.min, options.max, options.hasSeconds);
}
