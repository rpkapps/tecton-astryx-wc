import {describe, expect, it} from 'vitest';
import {
  formatInstant,
  formatInstantLines,
  formatRelativeTime,
  liveInterval,
  resolveTimeZoneId,
} from './instant.js';

// 2026-03-21T14:51:53Z: a Saturday, 07:51 in Los Angeles (PDT), 23:51 in Tokyo.
const INSTANT = new Date(Date.UTC(2026, 2, 21, 14, 51, 53));

describe('formatInstant: the zone is a display choice, never part of the instant', () => {
  it('reads the same instant in different zones', () => {
    expect(formatInstant(INSTANT, 'system_date_time', 'en', {timeZone: 'UTC'})).toBe(
      '2026-03-21 14:51:53',
    );
    expect(
      formatInstant(INSTANT, 'system_date_time', 'en', {timeZone: 'America/Los_Angeles'}),
    ).toBe('2026-03-21 07:51:53');
    expect(formatInstant(INSTANT, 'system_date_time', 'en', {timeZone: 'Asia/Tokyo'})).toBe(
      '2026-03-21 23:51:53',
    );
    expect(formatInstant(INSTANT, 'system_date', 'en', {timeZone: 'Pacific/Kiritimati'})).toBe(
      '2026-03-22',
    );
    expect(formatInstant(INSTANT, 'system_time', 'en', {timeZone: 'UTC'})).toBe('14:51:53');
  });

  it('reads the viewer zone from the Date when no zone is named', () => {
    const pad = (value: number): string => String(value).padStart(2, '0');
    expect(formatInstant(INSTANT, 'system_date_time', 'en')).toBe(
      `${INSTANT.getFullYear()}-${pad(INSTANT.getMonth() + 1)}-${pad(INSTANT.getDate())} ${pad(INSTANT.getHours())}:${pad(INSTANT.getMinutes())}:${pad(INSTANT.getSeconds())}`,
    );
  });

  it('unix_seconds is absolute: a zone cannot change it', () => {
    const seconds = String(Math.floor(INSTANT.getTime() / 1000));
    expect(formatInstant(INSTANT, 'unix_seconds', 'en')).toBe(seconds);
    expect(formatInstant(INSTANT, 'unix_seconds', 'en', {timeZone: 'Asia/Tokyo'})).toBe(seconds);
  });

  it('writes the human formats in the locale, Gregorian', () => {
    expect(formatInstant(INSTANT, 'date', 'en', {timeZone: 'UTC'})).toBe('Mar 21, 2026');
    expect(formatInstant(INSTANT, 'date_long', 'en', {timeZone: 'UTC'})).toBe('March 21, 2026');
    expect(formatInstant(INSTANT, 'date_weekday', 'en', {timeZone: 'UTC'})).toBe(
      'Sat, Mar 21, 2026',
    );
    expect(formatInstant(INSTANT, 'date_time', 'en', {timeZone: 'UTC'})).toBe(
      'Mar 21, 2026, 2:51 PM',
    );
    expect(formatInstant(INSTANT, 'time', 'en', {timeZone: 'UTC'})).toBe('2:51 PM');
    expect(formatInstant(INSTANT, 'date_long', 'de-DE', {timeZone: 'UTC'})).toBe('21. März 2026');
    expect(formatInstant(INSTANT, 'time', 'de-DE', {timeZone: 'UTC'})).toBe('14:51');
    expect(formatInstant(INSTANT, 'date_long', 'ar-SA', {timeZone: 'UTC'})).toMatch(/[٠-٩]/);
    expect(formatInstant(INSTANT, 'date_long', 'he-IL', {timeZone: 'UTC'})).toMatch(/מרץ/);
  });

  it('appends the zone abbreviation only where asked, and never to system_* formats', () => {
    expect(formatInstant(INSTANT, 'date_time', 'en', {timeZone: 'UTC', timezoneShown: true})).toBe(
      'Mar 21, 2026, 2:51 PM UTC',
    );
    expect(formatInstant(INSTANT, 'time', 'en', {timeZone: 'UTC', timezoneShown: true})).toBe(
      '2:51 PM UTC',
    );
    expect(
      formatInstant(INSTANT, 'system_time', 'en', {timeZone: 'UTC', timezoneShown: true}),
    ).toBe('14:51:53');
    expect(formatInstant(INSTANT, 'date', 'en', {timeZone: 'UTC', timezoneShown: true})).toBe(
      'Mar 21, 2026',
    );
  });

  it('full always names its zone, and can spell it out for a screen reader', () => {
    expect(formatInstant(INSTANT, 'full', 'en', {timeZone: 'UTC'})).toBe(
      'March 21, 2026 at 2:51:53 PM UTC',
    );
    expect(
      formatInstant(INSTANT, 'full', 'en', {
        timeZone: 'America/Los_Angeles',
        timeZoneNameStyle: 'long',
      }),
    ).toMatch(/Pacific Daylight Time/);
  });
});

describe('formatRelativeTime', () => {
  const now = new Date(Date.UTC(2026, 2, 21, 12, 0, 0));
  const ago = (seconds: number): Date => new Date(now.getTime() - seconds * 1000);

  it('chooses the tier and lets Intl write the words', () => {
    const cases: [number, string, string][] = [
      [3, 'now', 'now'],
      [30, '30 seconds ago', '30s ago'],
      [90, '1 minute ago', '1m ago'],
      [2 * 3600, '2 hours ago', '2h ago'],
      [86400, 'yesterday', '1d ago'],
      [3 * 86400, '3 days ago', '3d ago'],
      [45 * 86400, '1 month ago', '1mo ago'],
      [400 * 86400, '1 year ago', '1y ago'],
    ];
    for (const [seconds, long, narrow] of cases) {
      expect(formatRelativeTime(ago(seconds), now, 'en', 'long'), `${seconds}s long`).toBe(long);
      expect(formatRelativeTime(ago(seconds), now, 'en', 'narrow'), `${seconds}s narrow`).toBe(
        narrow,
      );
    }
  });

  it('reads the future, and treats a hair ahead as clock skew', () => {
    expect(formatRelativeTime(ago(-3 * 3600), now, 'en', 'long')).toBe('in 3 hours');
    expect(formatRelativeTime(ago(-20), now, 'en', 'long')).toBe('now');
    expect(formatRelativeTime(ago(-45), now, 'en', 'long')).toBe('in 45 seconds');
  });

  it('speaks the language of the reader', () => {
    expect(formatRelativeTime(ago(2 * 3600), now, 'de-DE', 'long')).toBe('vor 2 Stunden');
    expect(formatRelativeTime(ago(2 * 3600), now, 'he-IL', 'long')).toMatch(/[א-ת]/);
    expect(formatRelativeTime(ago(2 * 3600), now, 'ar-SA', 'long')).toMatch(/[؀-ۿ]/);
  });

  it('redraws a live reading as often as it can change', () => {
    expect(liveInterval(5)).toBe(1000);
    expect(liveInterval(600)).toBe(30_000);
    expect(liveInterval(7200)).toBe(60_000);
    expect(liveInterval(3 * 86400)).toBe(300_000);
    expect(liveInterval(-5)).toBe(1000);
  });
});

describe('tooltip lines', () => {
  it('resolves local, unknown and known zones', () => {
    expect(resolveTimeZoneId(undefined)).toBeUndefined();
    expect(resolveTimeZoneId('local')).toBeUndefined();
    expect(resolveTimeZoneId('LOCAL')).toBeUndefined();
    expect(resolveTimeZoneId('Not/AZone')).toBeUndefined();
    expect(resolveTimeZoneId('UTC')).toBe('UTC');
  });

  it('renders one line per entry, in order, with the label and copy flag kept', () => {
    const lines = formatInstantLines(
      INSTANT,
      [
        {label: 'UTC', timezoneID: 'UTC'},
        {label: 'Tokyo', timezoneID: 'Asia/Tokyo', format: 'time'},
        {timezoneID: 'UTC', format: 'system_date_time', isCopyable: true},
      ],
      'en',
    );
    expect(lines).toEqual([
      {label: 'UTC', isCopyable: false, value: 'March 21, 2026 at 2:51:53 PM UTC'},
      {label: 'Tokyo', isCopyable: false, value: '11:51 PM GMT+9'},
      {isCopyable: true, value: '2026-03-21 14:51:53'},
    ]);
  });

  it('marks time and date_time with a zone only when the lines must be told apart or the zone was named', () => {
    const [local] = formatInstantLines(INSTANT, [{format: 'time'}], 'en');
    expect(local!.value).not.toMatch(/M\s\S+$/);
    const [named] = formatInstantLines(INSTANT, [{format: 'time', timezoneID: 'UTC'}], 'en');
    expect(named!.value).toBe('2:51 PM UTC');
    const [localA, utcB] = formatInstantLines(
      INSTANT,
      [{format: 'date_time'}, {format: 'date_time', timezoneID: 'UTC'}],
      'en',
    );
    expect(localA!.value).toMatch(/\S$/);
    expect(utcB!.value).toBe('Mar 21, 2026, 2:51 PM UTC');
    // A system_* line never carries one.
    const [system] = formatInstantLines(
      INSTANT,
      [{format: 'system_time', timezoneID: 'UTC'}],
      'en',
    );
    expect(system!.value).toBe('14:51:53');
  });

  it('an unknown zone falls back to the viewer zone instead of throwing', () => {
    const [line] = formatInstantLines(
      INSTANT,
      [{timezoneID: 'Nowhere/Land', format: 'system_date'}],
      'en',
    );
    expect(line!.value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
