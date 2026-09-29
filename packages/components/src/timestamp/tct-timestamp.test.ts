/**
 * tct-timestamp: the element suite, the value (ISO strings, Unix seconds and milliseconds, junk), every format,
 * the relative readings and live updates under a fake clock, the hover card (default line, entries in several
 * zones, labels, copy buttons), languages and direction, and accessibility and contrast, light and dark.
 * Ported from upstream Timestamp.test.tsx and tooltipEntries.test.ts where the behaviour applies. The instant is
 * fixed by a fake clock, the zones a card names are explicit (UTC, Tokyo, Los Angeles), and the readings in the
 * viewer's own zone are compared with the `Date` getters, so the tests hold in any time zone of the machine.
 */
import {html} from 'lit';
import {userEvent} from 'vitest/browser';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {getAnnouncerRegions} from '@tecton-wc/core/a11y/announcer.js';
import {overrideFeature} from '@tecton-wc/core/features.js';
import {resetDevWarnings} from '@tecton-wc/core/utils/dev.js';
import {axNode, expectAccessible} from '@tecton-wc/testing/a11y.js';
import {emulateMedia} from '@tecton-wc/testing/emulate.js';
import {recordEvents} from '@tecton-wc/testing/events.js';
import {fixture} from '@tecton-wc/testing/fixture.js';
import {runElementSuite} from '@tecton-wc/testing/suites/element.js';
import {isChromium} from '@tecton-wc/testing/tier.js';
import {waitUntil} from '@tecton-wc/testing/timing.js';
import {
  backgroundOf,
  contrast,
  over,
  parseColor,
  settleAnimations,
} from '../date-input/fixtures/picker-test-helpers.js';
import './define.js';
import type {TctTimestamp} from './tct-timestamp.js';
import type {TimestampTooltipEntry} from './timestamp.types.js';

/** 2026-03-21 at 14:51:53 UTC. */
const INSTANT = new Date(Date.UTC(2026, 2, 21, 14, 51, 53));
const ISO = '2026-03-21T14:51:53Z';
/** The clock of the tests: 2026-03-21 at 16:51:53 UTC, two hours after the instant. */
const NOW = new Date(Date.UTC(2026, 2, 21, 16, 51, 53));

runElementSuite({
  tag: 'tct-timestamp',
  render: () => html`<tct-timestamp value="2026-03-21T14:51:53Z"></tct-timestamp>`,
  properties: {
    value: '2020-01-01T00:00:00Z',
    format: 'date_long',
    autoThreshold: 3600,
    noTooltip: true,
    timezoneShown: true,
    live: true,
    type: 'body',
    color: 'primary',
    weight: 'semibold',
    size: 'lg',
  },
  attributes: {
    value: 'value',
    format: 'format',
    autoThreshold: 'auto-threshold',
    noTooltip: 'no-tooltip',
    timezoneShown: 'timezone-shown',
    live: 'live',
    type: 'type',
    color: 'color',
  },
});

const timeOf = (element: TctTimestamp): HTMLTimeElement =>
  element.shadowRoot!.querySelector<HTMLTimeElement>('time')!;
const cardOf = (element: TctTimestamp): HTMLElement | null =>
  element.shadowRoot!.querySelector<HTMLElement>('tct-hover-card');
const rows = (element: TctTimestamp): {label: string | null; value: string}[] =>
  [...element.shadowRoot!.querySelectorAll('.row')].map((row) => ({
    label: row.querySelector('dt')?.textContent?.trim() ?? null,
    value: row.querySelector('dd')!.textContent.trim(),
  }));
const copyButtons = (element: TctTimestamp): HTMLElement[] => [
  ...element.shadowRoot!.querySelectorAll<HTMLElement>('tct-icon-button'),
];
const pad = (value: number): string => String(value).padStart(2, '0');

/** Mounts a timestamp; a card loads lazily, so wait for it where one is due. */
async function make(
  attributes: string,
  options: {entries?: TimestampTooltipEntry[]; lang?: string; dir?: 'rtl'; card?: boolean} = {},
): Promise<TctTimestamp> {
  const wrapper = await fixture<HTMLElement>(
    `<div style="padding:60px"><tct-timestamp ${attributes}></tct-timestamp></div>`,
    {lang: options.lang, dir: options.dir},
  );
  const element = wrapper.querySelector<TctTimestamp>('tct-timestamp')!;
  if (options.entries) element.tooltipEntries = options.entries;
  await element.updateComplete;
  if (options.card) await waitUntil(() => cardOf(element) !== null, 'card attached');
  return element;
}

/** Opens the card without waiting for the hover delay. */
async function openCard(element: TctTimestamp): Promise<void> {
  const card = cardOf(element) as (HTMLElement & {show(): Promise<void>; open: boolean}) | null;
  await card!.show();
  await settleAnimations();
}

describe('tct-timestamp', () => {
  beforeEach(() => {
    vi.useFakeTimers({toFake: ['Date']});
    vi.setSystemTime(NOW);
    resetDevWarnings();
    globalThis.tctDevMode = true;
  });
  afterEach(() => {
    globalThis.tctDevMode = undefined;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('the value', () => {
    it('is a <time> with the ISO 8601 datetime (always UTC) inside tct-text, supporting and secondary by default', async () => {
      const element = await make(`value="${ISO}" format="date"`);
      const time = timeOf(element);
      expect(time.localName).toBe('time');
      expect(time.getAttribute('datetime')).toBe('2026-03-21T14:51:53.000Z');
      const text = element.shadowRoot!.querySelector('tct-text')!;
      expect(text.getAttribute('type')).toBe('supporting');
      expect(text.getAttribute('color')).toBe('secondary');
      expect(time.closest('tct-text')).toBe(text);
      if (isChromium) {
        const node = await axNode(time);
        expect(node.role).toBe('time');
      }
    });

    it('reads Unix seconds and milliseconds, as a property or a numeric attribute, and ISO strings with an offset', async () => {
      const seconds = await make(
        `value="${Math.floor(INSTANT.getTime() / 1000)}" format="unix_seconds"`,
      );
      expect(timeOf(seconds).getAttribute('datetime')).toBe('2026-03-21T14:51:53.000Z');
      expect(timeOf(seconds).textContent).toBe(String(Math.floor(INSTANT.getTime() / 1000)));
      const millis = await make('format="unix_seconds"');
      millis.value = INSTANT.getTime();
      await millis.updateComplete;
      expect(timeOf(millis).getAttribute('datetime')).toBe('2026-03-21T14:51:53.000Z');
      const offset = await make('value="2026-03-21T16:51:53+02:00" format="unix_seconds"');
      expect(timeOf(offset).getAttribute('datetime')).toBe('2026-03-21T14:51:53.000Z');
      const secondsProperty = await make('format="unix_seconds"');
      secondsProperty.value = 1_742_565_113;
      await secondsProperty.updateComplete;
      expect(timeOf(secondsProperty).textContent).toBe('1742565113');
    });

    it('renders nothing for a value that names no moment, and warns once', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      for (const junk of ['not a date', '2026-13-45', 'NaN']) {
        const element = await make(`value="${junk}"`);
        expect(element.shadowRoot!.querySelector('time'), junk).toBeNull();
      }
      const empty = await make('');
      expect(empty.shadowRoot!.querySelector('time')).toBeNull();
      const nan = await make('');
      nan.value = Number.NaN;
      await nan.updateComplete;
      expect(nan.shadowRoot!.querySelector('time')).toBeNull();
      expect(warn).toHaveBeenCalled();
    });

    it('reads an ISO string with no offset in the viewer zone, and never throws for a stray unit', async () => {
      const local = await make('value="2026-03-21T14:51:53" format="system_date_time"');
      expect(timeOf(local).textContent).toBe('2026-03-21 14:51:53');
      const unknown = await make(`value="${ISO}" format="bogus"`);
      // An unknown format falls back to auto: two hours ago is relative.
      expect(timeOf(unknown).textContent).toBe('2 hours ago');
    });

    it('sets the typography of tct-text from type, size, color and weight', async () => {
      const element = await make(
        `value="${ISO}" format="date" type="body" size="lg" color="primary" weight="semibold"`,
      );
      const text = element.shadowRoot!.querySelector('tct-text')!;
      expect(text.getAttribute('type')).toBe('body');
      expect(text.getAttribute('size')).toBe('lg');
      expect(text.getAttribute('color')).toBe('primary');
      expect(text.getAttribute('weight')).toBe('semibold');
    });
  });

  describe('the formats', () => {
    it('reads the absolute formats in the viewer zone and the language of the element', async () => {
      const local = new Date(ISO);
      const month = local.toLocaleString('en', {month: 'short'});
      const longMonth = local.toLocaleString('en', {month: 'long'});
      const weekday = local.toLocaleString('en', {weekday: 'short'});
      const y = local.getFullYear();
      const d = local.getDate();
      const hours = local.getHours();
      const twelve = `${hours % 12 === 0 ? 12 : hours % 12}:${pad(local.getMinutes())} ${hours < 12 ? 'AM' : 'PM'}`;
      const cases: [string, string][] = [
        ['date', `${month} ${d}, ${y}`],
        ['date_long', `${longMonth} ${d}, ${y}`],
        ['date_weekday', `${weekday}, ${month} ${d}, ${y}`],
        ['date_time', `${month} ${d}, ${y}, ${twelve}`],
        ['time', twelve],
        ['system_date', `${y}-${pad(local.getMonth() + 1)}-${pad(d)}`],
        [
          'system_date_time',
          `${y}-${pad(local.getMonth() + 1)}-${pad(d)} ${pad(hours)}:${pad(local.getMinutes())}:${pad(local.getSeconds())}`,
        ],
        ['system_time', `${pad(hours)}:${pad(local.getMinutes())}:${pad(local.getSeconds())}`],
        ['unix_seconds', String(Math.floor(local.getTime() / 1000))],
      ];
      for (const [format, expected] of cases) {
        const element = await make(`value="${ISO}" format="${format}"`);
        expect(timeOf(element).textContent, format).toBe(expected);
      }
    });

    it('timezone-shown appends the abbreviation to date_time and time only', async () => {
      const dateTime = await make(`value="${ISO}" format="date_time" timezone-shown`);
      const bare = await make(`value="${ISO}" format="date_time"`);
      expect(timeOf(dateTime).textContent.length).toBeGreaterThan(timeOf(bare).textContent.length);
      expect(timeOf(dateTime).textContent.startsWith(timeOf(bare).textContent)).toBe(true);
      const time = await make(`value="${ISO}" format="time" timezone-shown`);
      const plain = await make(`value="${ISO}" format="time"`);
      expect(timeOf(time).textContent.length).toBeGreaterThan(timeOf(plain).textContent.length);
      for (const format of [
        'system_date_time',
        'system_time',
        'system_date',
        'date',
        'date_long',
        'unix_seconds',
      ]) {
        const shown = await make(`value="${ISO}" format="${format}" timezone-shown`);
        const off = await make(`value="${ISO}" format="${format}"`);
        expect(timeOf(shown).textContent, format).toBe(timeOf(off).textContent);
      }
    });

    it('reads relative in long and short form, the future, and "now" for a hair either side', async () => {
      const at = (seconds: number): string =>
        new Date(NOW.getTime() - seconds * 1000).toISOString();
      const cases: [string, number, string][] = [
        ['relative', 5, 'now'],
        ['relative', 30, '30 seconds ago'],
        ['relative', 2 * 3600, '2 hours ago'],
        ['relative', 86400, 'yesterday'],
        ['relative', -3 * 3600, 'in 3 hours'],
        ['relative', -20, 'now'],
        ['relative_short', 2 * 3600, '2h ago'],
        ['relative_short', 86400, '1d ago'],
        ['relative_short', 3 * 86400, '3d ago'],
      ];
      for (const [format, seconds, expected] of cases) {
        const element = await make(`value="${at(seconds)}" format="${format}"`);
        expect(timeOf(element).textContent, `${format} ${seconds}`).toBe(expected);
      }
    });

    it('auto is relative up to the threshold, then date and time', async () => {
      const at = (seconds: number): string =>
        new Date(NOW.getTime() - seconds * 1000).toISOString();
      const recent = await make(`value="${at(3600)}"`);
      expect(timeOf(recent).textContent).toBe('1 hour ago');
      const old = await make(`value="${at(8 * 86400)}"`);
      expect(timeOf(old).textContent).not.toMatch(/ago/);
      expect(timeOf(old).textContent).toMatch(/2026/);
      const custom = await make(`value="${at(7200)}" auto-threshold="3600"`);
      expect(timeOf(custom).textContent).not.toMatch(/ago/);
      const future = await make(`value="${at(-3 * 86400)}"`);
      expect(timeOf(future).textContent).toBe('in 3 days');
    });

    it('a relative reading is named by the full date with the zone spelled out; an absolute one keeps its text', async () => {
      const relative = await make(`value="${ISO}" format="relative"`);
      const label = timeOf(relative).getAttribute('aria-label')!;
      expect(label).toMatch(/March 21, 2026/);
      // The zone is spelled out (Coordinated Universal Time, Pacific Daylight Time...), never an initialism alone.
      expect(label).toMatch(/(Time|Standard|Daylight)/);
      const absolute = await make(`value="${ISO}" format="date"`);
      expect(timeOf(absolute).hasAttribute('aria-label')).toBe(false);
      if (isChromium) {
        expect((await axNode(timeOf(relative))).name).toBe(label);
      }
    });

    it('updates a relative reading live at the pace it can change, and stops when disconnected', async () => {
      vi.useRealTimers();
      vi.useFakeTimers({toFake: ['Date', 'setTimeout', 'clearTimeout']});
      vi.setSystemTime(NOW);
      const start = new Date(NOW.getTime() - 12_000).toISOString();
      const live = await make(`value="${start}" format="relative" live`);
      const still = await make(`value="${start}" format="relative"`);
      expect(timeOf(live).textContent).toBe('12 seconds ago');
      await vi.advanceTimersByTimeAsync(3000);
      await live.updateComplete;
      expect(timeOf(live).textContent).toBe('15 seconds ago');
      expect(timeOf(still).textContent).toBe('12 seconds ago');
      // From a minute on it redraws every 30 seconds.
      await vi.advanceTimersByTimeAsync(60_000);
      await live.updateComplete;
      expect(timeOf(live).textContent).toBe('1 minute ago');
      live.remove();
      const before = timeOf(still).textContent;
      await vi.advanceTimersByTimeAsync(120_000);
      expect(timeOf(still).textContent).toBe(before);
    });

    it('live does nothing for an absolute reading', async () => {
      vi.useRealTimers();
      vi.useFakeTimers({toFake: ['Date', 'setTimeout', 'clearTimeout']});
      vi.setSystemTime(NOW);
      const element = await make(`value="${ISO}" format="system_date" live`);
      const text = timeOf(element).textContent;
      await vi.advanceTimersByTimeAsync(600_000);
      expect(timeOf(element).textContent).toBe(text);
    });

    it('a changed value refreshes "now"', async () => {
      const element = await make(
        `value="${new Date(NOW.getTime() - 3600_000).toISOString()}" format="relative"`,
      );
      expect(timeOf(element).textContent).toBe('1 hour ago');
      vi.setSystemTime(new Date(NOW.getTime() + 3 * 3600_000));
      element.value = new Date(NOW.getTime() + 3600_000).toISOString();
      await element.updateComplete;
      expect(timeOf(element).textContent).toBe('2 hours ago');
    });
  });

  describe('the hover card', () => {
    it('is attached to a relative reading, which becomes a tab stop; absolute readings have none by default', async () => {
      const relative = await make(`value="${ISO}" format="relative"`, {card: true});
      expect(timeOf(relative).getAttribute('tabindex')).toBe('0');
      expect(cardOf(relative)!.getAttribute('hover-indication')).toBe('always');
      expect(cardOf(relative)!.getAttribute('label')).toBe('Timestamp details');
      expect(relative.matches(':state(card)')).toBe(true);
      const absolute = await make(`value="${ISO}" format="date"`);
      await absolute.updateComplete;
      expect(cardOf(absolute)).toBeNull();
      expect(timeOf(absolute).hasAttribute('tabindex')).toBe(false);
      const off = await make(`value="${ISO}" format="relative" no-tooltip`);
      expect(cardOf(off)).toBeNull();
      expect(timeOf(off).hasAttribute('tabindex')).toBe(false);
    });

    it('the default card is one copyable line with the full date and time', async () => {
      const element = await make(`value="${ISO}" format="relative"`, {card: true});
      const full = new Intl.DateTimeFormat('en', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        timeZoneName: 'short',
        calendar: 'gregory',
      }).format(INSTANT);
      expect(rows(element)).toEqual([{label: null, value: full}]);
      expect(copyButtons(element)).toHaveLength(1);
    });

    it('entries attach a card to absolute readings too, in the order given, in the zones they name', async () => {
      const entries: TimestampTooltipEntry[] = [
        {label: 'Your time'},
        {timezoneID: 'UTC', label: 'UTC'},
        {timezoneID: 'Asia/Tokyo', label: 'Tokyo', format: 'time'},
        {timezoneID: 'UTC', format: 'system_date_time', label: 'ISO', isCopyable: true},
      ];
      const element = await make(`value="${ISO}" format="date"`, {entries, card: true});
      const lines = rows(element);
      expect(lines.map((line) => line.label)).toEqual(['Your time', 'UTC', 'Tokyo', 'ISO']);
      expect(lines[1]!.value).toBe('March 21, 2026 at 2:51:53 PM UTC');
      expect(lines[2]!.value).toBe('11:51 PM GMT+9');
      expect(lines[3]!.value).toBe('2026-03-21 14:51:53');
      // Only the row that asked for it has a copy button, in a column of its own.
      expect(copyButtons(element)).toHaveLength(1);
      expect(element.shadowRoot!.querySelector('.details')!.getAttribute('data-columns')).toBe(
        'label-value-action',
      );
      expect(timeOf(element).getAttribute('tabindex')).toBe('0');
    });

    it('drops the label and action columns nobody uses, and treats an empty array as no entries', async () => {
      const plain = await make(`value="${ISO}" format="relative"`, {
        entries: [{timezoneID: 'UTC'}, {timezoneID: 'Asia/Tokyo'}],
        card: true,
      });
      expect(plain.shadowRoot!.querySelector('.details')!.getAttribute('data-columns')).toBe(
        'value',
      );
      expect(copyButtons(plain)).toHaveLength(0);
      const labelled = await make(`value="${ISO}" format="relative"`, {
        entries: [{label: 'UTC', timezoneID: 'UTC'}],
        card: true,
      });
      expect(labelled.shadowRoot!.querySelector('.details')!.getAttribute('data-columns')).toBe(
        'label-value',
      );
      const empty = await make(`value="${ISO}" format="date"`, {entries: []});
      expect(cardOf(empty)).toBeNull();
      const suppressed = await make(`value="${ISO}" format="relative" no-tooltip`, {
        entries: [{label: 'UTC', timezoneID: 'UTC'}],
      });
      expect(cardOf(suppressed)).toBeNull();
    });

    it('marks a date_time or time line with its zone when the lines must be told apart, and never a system_* line', async () => {
      const element = await make(`value="${ISO}" format="relative"`, {
        entries: [
          {format: 'date_time'},
          {timezoneID: 'UTC', format: 'date_time'},
          {timezoneID: 'UTC', format: 'system_time'},
        ],
        card: true,
      });
      const lines = rows(element);
      expect(lines[1]!.value).toBe('Mar 21, 2026, 2:51 PM UTC');
      expect(lines[2]!.value).toBe('14:51:53');
    });

    it('an unknown zone falls back to the viewer zone with a warning, and the local alias is the viewer zone', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      const element = await make(`value="${ISO}" format="relative"`, {
        entries: [
          {timezoneID: 'local', format: 'system_time'},
          {timezoneID: 'Nowhere/Land', format: 'system_time'},
        ],
        card: true,
      });
      const [local, unknown] = rows(element);
      expect(unknown!.value).toBe(local!.value);
      expect(warn).toHaveBeenCalled();
    });

    it('opens on the card, keeps the readings, and its own open events stay inside', async () => {
      const element = await make(`value="${ISO}" format="relative"`, {card: true});
      const leaks = recordEvents(element, ['tct-open-change', 'tct-after-open-change']);
      await openCard(element);
      const card = cardOf(element) as HTMLElement & {open: boolean};
      expect(card.open).toBe(true);
      expect(rows(element)).toHaveLength(1);
      expect(leaks.events).toHaveLength(0);
    });

    it('a keyboard user reaches the card: Tab focuses the <time>, and focus opens the card', async () => {
      const element = await make(`value="${ISO}" format="relative"`, {card: true});
      timeOf(element).focus();
      const card = cardOf(element) as HTMLElement & {open: boolean};
      await waitUntil(() => card.open, 'opened by keyboard focus', 3000);
      expect(element.shadowRoot!.activeElement).toBe(timeOf(element));
    });

    it('copy writes the value, flips to a check with "Copied" and announces it, then goes back', async () => {
      const restore = overrideFeature('ariaNotify', false);
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', {value: {writeText}, configurable: true});
      try {
        const element = await make(`value="${ISO}" format="relative"`, {
          entries: [
            {timezoneID: 'UTC', format: 'system_date_time', label: 'ISO', isCopyable: true},
          ],
          card: true,
        });
        await openCard(element);
        const button = copyButtons(element)[0]!;
        expect(button.getAttribute('icon')).toBe('copy');
        expect(button.getAttribute('label')).toBe('Copy 2026-03-21 14:51:53');
        expect(button.getAttribute('tooltip')).toBe('Copy');
        await userEvent.click(button);
        await waitUntil(() => writeText.mock.calls.length === 1, 'copied');
        expect(writeText).toHaveBeenCalledWith('2026-03-21 14:51:53');
        await waitUntil(
          () => copyButtons(element)[0]!.getAttribute('icon') === 'check',
          'check shown',
        );
        expect(copyButtons(element)[0]!.getAttribute('label')).toBe('Copied');
        expect(copyButtons(element)[0]!.getAttribute('tooltip')).toBe('Copied');
        await waitUntil(() => getAnnouncerRegions().polite?.textContent === 'Copied', 'announced');
        await waitUntil(
          () => copyButtons(element)[0]!.getAttribute('icon') === 'copy',
          'copy icon back',
          4000,
        );
      } finally {
        restore();
        Reflect.deleteProperty(navigator, 'clipboard');
      }
    });

    it('a refused clipboard write is a silent no-op', async () => {
      const writeText = vi.fn().mockRejectedValue(new Error('denied'));
      Object.defineProperty(navigator, 'clipboard', {value: {writeText}, configurable: true});
      try {
        const element = await make(`value="${ISO}" format="relative"`, {card: true});
        await openCard(element);
        await userEvent.click(copyButtons(element)[0]!);
        await waitUntil(() => writeText.mock.calls.length === 1, 'attempted');
        expect(copyButtons(element)[0]!.getAttribute('icon')).toBe('copy');
      } finally {
        Reflect.deleteProperty(navigator, 'clipboard');
      }
    });
  });

  describe('languages and direction', () => {
    it('speaks the language of the element: German, Hebrew and Arabic readings', async () => {
      const de = await make(`value="${ISO}" format="relative"`, {lang: 'de-DE'});
      expect(timeOf(de).textContent).toBe('vor 2 Stunden');
      const deDate = await make(`value="${ISO}" format="date_long"`, {lang: 'de-DE'});
      expect(timeOf(deDate).textContent).toMatch(/März 2026$/);
      const he = await make(`value="${ISO}" format="date_long"`, {lang: 'he-IL', dir: 'rtl'});
      expect(timeOf(he).textContent).toMatch(/[א-ת]/);
      const ar = await make(`value="${ISO}" format="date_long"`, {lang: 'ar-SA', dir: 'rtl'});
      expect(timeOf(ar).textContent).toMatch(/[٠-٩]/);
    });

    it('the card labels come from the catalog of the language, and the datetime stays ISO', async () => {
      const element = await make(`value="${ISO}" format="relative"`, {lang: 'de-DE', card: true});
      await waitUntil(
        () => cardOf(element)!.getAttribute('label') !== 'Timestamp details',
        'catalog loaded',
      );
      expect(timeOf(element).getAttribute('datetime')).toBe('2026-03-21T14:51:53.000Z');
    });

    it('lays the card out for the right-to-left reader: the action column at the inline end', async () => {
      const element = await make(`value="${ISO}" format="relative"`, {
        lang: 'he-IL',
        dir: 'rtl',
        entries: [{label: 'א', timezoneID: 'UTC', isCopyable: true}],
        card: true,
      });
      await openCard(element);
      const action = element.shadowRoot!.querySelector('.action')!.getBoundingClientRect();
      const label = element.shadowRoot!.querySelector('dt')!.getBoundingClientRect();
      expect(action.left).toBeLessThan(label.left);
    });
  });

  describe('accessibility and contrast', () => {
    for (const scheme of ['light', 'dark'] as const) {
      it(`passes axe for every reading, and with the card open (${scheme})`, async () => {
        await emulateMedia({colorScheme: scheme});
        const wrapper = await fixture<HTMLElement>(
          `<div style="padding:60px;background:var(--color-background-surface)"><tct-timestamp value="${ISO}" format="relative"></tct-timestamp> <tct-timestamp value="${ISO}" format="date_time"></tct-timestamp> <tct-timestamp value="${ISO}" format="system_date_time" color="primary" type="body"></tct-timestamp></div>`,
          {theme: scheme},
        );
        const [relative] = wrapper.querySelectorAll<TctTimestamp>('tct-timestamp');
        await waitUntil(() => cardOf(relative!) !== null, 'card attached');
        await settleAnimations();
        await expectAccessible(wrapper);
        await openCard(relative!);
        await expectAccessible(wrapper);
      });

      it(`the reading meets 4.5:1 in the secondary and primary colours, and the card text in its roles (${scheme})`, async () => {
        await emulateMedia({colorScheme: scheme});
        const wrapper = await fixture<HTMLElement>(
          `<div style="padding:60px;background:var(--color-background-surface)"><tct-timestamp value="${ISO}" format="relative"></tct-timestamp> <tct-timestamp value="${ISO}" format="date" color="primary"></tct-timestamp></div>`,
          {theme: scheme},
        );
        const [relative, absolute] = wrapper.querySelectorAll<TctTimestamp>('tct-timestamp');
        await waitUntil(() => cardOf(relative!) !== null, 'card attached');
        relative!.tooltipEntries = [{label: 'UTC', timezoneID: 'UTC', isCopyable: true}];
        await relative!.updateComplete;
        await openCard(relative!);
        const surface = backgroundOf(wrapper);
        for (const element of [relative!, absolute!]) {
          const style = getComputedStyle(timeOf(element));
          expect(
            contrast(parseColor(style.color), surface),
            `${scheme} reading`,
          ).toBeGreaterThanOrEqual(4.5);
        }
        const layer = cardOf(relative!)!.shadowRoot!.querySelector('.card')!;
        const cardSurface = over(parseColor(getComputedStyle(layer).backgroundColor), surface);
        for (const selector of ['dt', 'dd']) {
          const cell = relative!.shadowRoot!.querySelector(selector)!;
          expect(
            contrast(parseColor(getComputedStyle(cell).color), cardSurface),
            `${scheme} ${selector}`,
          ).toBeGreaterThanOrEqual(4.5);
        }
      });
    }
  });
});
