import {describe, expect, it} from 'vitest';
import {
  buildTimeColumns,
  composeTime,
  hour12From24,
  hour24From12,
  windowOverlaps,
} from './time-columns.js';

const format = (value: number, pad: boolean): string =>
  pad ? String(value).padStart(2, '0') : String(value);
const labels = {am: 'AM', pm: 'PM'};

describe('time columns: 12-hour arithmetic', () => {
  it('maps between 24-hour and 12-hour hours in both directions', () => {
    expect([0, 1, 11, 12, 13, 23].map(hour12From24)).toEqual([12, 1, 11, 12, 1, 11]);
    expect(hour24From12(12, 0)).toBe(0);
    expect(hour24From12(12, 1)).toBe(12);
    expect(hour24From12(1, 1)).toBe(13);
    expect(hour24From12(11, 0)).toBe(11);
    for (let hour = 0; hour < 24; hour += 1) {
      expect(hour24From12(hour12From24(hour), hour < 12 ? 0 : 1)).toBe(hour);
    }
  });
});

describe('time columns: the options a window allows', () => {
  it('finds whether any second of a span lies inside min..max', () => {
    expect(windowOverlaps(0, 3599, '09:00', '17:00')).toBe(false);
    expect(windowOverlaps(8 * 3600, 9 * 3600, '09:00', '17:00')).toBe(true);
    expect(windowOverlaps(17 * 3600, 18 * 3600, '09:00', '17:00')).toBe(true);
    expect(windowOverlaps(17 * 3600 + 1, 18 * 3600, '09:00', '17:00')).toBe(false);
    expect(windowOverlaps(0, 86399, undefined, undefined)).toBe(true);
    expect(windowOverlaps(0, 100, 'soon', 'never')).toBe(true);
  });

  it('builds hour, minute and AM/PM columns, and adds seconds', () => {
    const columns = buildTimeColumns({
      time: {hour: 14, minute: 30, second: 0},
      hasSeconds: false,
      hourFormat: '12h',
      formatNumber: format,
      meridiemLabels: labels,
    });
    expect(columns.map((column) => column.unit)).toEqual(['hour', 'minute', 'meridiem']);
    expect(columns.map((column) => column.selected)).toEqual([2, 30, 1]);
    expect(columns[0]!.options.map((option) => option.label)).toEqual(
      Array.from({length: 12}, (_, index) => String(index + 1)),
    );
    const withSeconds = buildTimeColumns({
      time: {hour: 14, minute: 30, second: 5},
      hasSeconds: true,
      hourFormat: '24h',
      formatNumber: format,
      meridiemLabels: labels,
    });
    expect(withSeconds.map((column) => column.unit)).toEqual(['hour', 'minute', 'second']);
    expect(withSeconds[0]!.options).toHaveLength(24);
    expect(withSeconds[0]!.options[14]!.label).toBe('14');
  });

  it('disables options that no time inside the window can produce', () => {
    const [hour, minute, meridiem] = buildTimeColumns({
      time: {hour: 10, minute: 30, second: 0},
      hasSeconds: false,
      hourFormat: '12h',
      min: '09:00',
      max: '11:15',
      formatNumber: format,
      meridiemLabels: labels,
    });
    const disabled = (column: typeof hour): number[] =>
      column!.options.filter((option) => option.disabled).map((option) => option.value);
    // AM is selected: 1..8 AM and 12 AM are before min; 12 AM is hour 0.
    expect(disabled(hour)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 12]);
    expect(disabled(meridiem)).toEqual([1]);
    // 10:xx is inside for every minute.
    expect(disabled(minute)).toEqual([]);
  });
});

describe('time columns: composing a pick', () => {
  const options = {hasSeconds: false, hourFormat: '12h' as const};

  it('replaces one part and keeps the rest', () => {
    const time = {hour: 14, minute: 35, second: 20};
    expect(composeTime(time, 'minute', 5, options)).toBe('14:05');
    expect(composeTime(time, 'hour', 9, options)).toBe('21:35');
    expect(composeTime(time, 'meridiem', 0, options)).toBe('02:35');
    expect(composeTime(time, 'hour', 9, {...options, hourFormat: '24h'})).toBe('09:35');
    expect(composeTime(time, 'second', 7, {...options, hasSeconds: true})).toBe('14:35:07');
    expect(composeTime(time, 'second', 7, options)).toBe('14:35');
  });

  it('clamps the result into the window', () => {
    const time = {hour: 10, minute: 30, second: 0};
    expect(composeTime(time, 'hour', 11, {...options, min: '09:00', max: '11:15'})).toBe('11:15');
    expect(composeTime(time, 'hour', 8, {...options, min: '09:00', max: '11:15'})).toBe('09:00');
  });
});
