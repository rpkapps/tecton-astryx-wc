import {html} from 'lit';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {resetDevWarnings} from '@tecton-wc/core/utils/dev.js';
import {axNode, expectAccessible} from '@tecton-wc/testing/a11y.js';
import {fixture} from '@tecton-wc/testing/fixture.js';
import {runElementSuite} from '@tecton-wc/testing/suites/element.js';
import {isChromium} from '@tecton-wc/testing/tier.js';
import {waitUntil} from '@tecton-wc/testing/timing.js';
import {millisecondsUntilNextChange, readDuration} from './timer.format.js';
import './define.js';
import type {TctTimer} from './tct-timer.js';

runElementSuite({
  tag: 'tct-timer',
  render: () => `<tct-timer></tct-timer>`,
  properties: {startTime: 1_000_000, format: 'clock', type: 'body', color: 'primary'},
  attributes: {startTime: 'start-time', format: 'format', type: 'type', color: 'color'},
});

const timeOf = (timer: TctTimer): HTMLTimeElement => timer.shadowRoot!.querySelector('time')!;
const textOf = (timer: TctTimer): HTMLElement => timer.shadowRoot!.querySelector('tct-text')!;

/** Mounts a timer under the fake clock (set before calling). */
async function make(attributes = '', properties: Partial<TctTimer> = {}): Promise<TctTimer> {
  const wrapper = await fixture<HTMLElement>(`<div><tct-timer ${attributes}></tct-timer></div>`);
  const timer = wrapper.querySelector<TctTimer>('tct-timer')!;
  Object.assign(timer, properties);
  await timer.updateComplete;
  return timer;
}

describe('tct-timer (Timer.test.tsx)', () => {
  beforeEach(() => {
    vi.useFakeTimers({toFake: ['setTimeout', 'clearTimeout', 'Date']});
    vi.setSystemTime(new Date('2026-09-22T00:00:00Z'));
  });

  afterEach(() => {
    // Spies on the fake `setTimeout` first, so restoring them cannot put the fake back after the real one.
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('renders deterministic zero-duration markup for each standard format', async () => {
    const timer = await make();
    const time = timeOf(timer);
    expect(time.localName).toBe('time');
    expect(time.textContent).toBe('0s');
    expect(time.getAttribute('datetime')).toBe('PT0S');

    timer.format = 'clock';
    await timer.updateComplete;
    expect(timeOf(timer)).toBe(time);
    expect(time.textContent).toBe('0:00');
    expect(time.getAttribute('datetime')).toBe('PT0S');
  });

  it('derives elapsed time from the clock without accumulating callback count', async () => {
    const timer = await make();
    vi.advanceTimersByTime(8750);
    expect(timeOf(timer).textContent).toBe('8s');
    expect(timeOf(timer).getAttribute('datetime')).toBe('PT8S');
    // The clock jumps a minute ahead (a throttled tab, a suspended laptop); the next wake-up catches up.
    vi.setSystemTime(Date.now() + 60_000);
    vi.advanceTimersByTime(1000);
    expect(timeOf(timer).textContent).toBe('1m 09s');
    expect(timeOf(timer).getAttribute('datetime')).toBe('PT69S');
  });

  it('formats elapsed durations across seconds, minutes, and hours', async () => {
    const now = Date.now();
    const timer = await make('', {startTime: now - 34_000});
    const time = timeOf(timer);
    expect(time.textContent).toBe('34s');
    expect(time.getAttribute('datetime')).toBe('PT34S');

    timer.startTime = now - 128_000;
    await timer.updateComplete;
    expect(time.textContent).toBe('2m 08s');
    expect(time.getAttribute('datetime')).toBe('PT128S');

    timer.startTime = now - 3_753_000;
    await timer.updateComplete;
    expect(time.textContent).toBe('1h 02m');
    expect(time.getAttribute('datetime')).toBe('PT3720S');
  });

  it('formats clock durations across minutes and hours', async () => {
    const now = Date.now();
    const timer = await make('format="clock"', {startTime: now - 128_000});
    const time = timeOf(timer);
    expect(time.textContent).toBe('2:08');
    expect(time.getAttribute('datetime')).toBe('PT128S');

    timer.startTime = now - 3_753_000;
    await timer.updateComplete;
    expect(time.textContent).toBe('1:02:33');
    expect(time.getAttribute('datetime')).toBe('PT3753S');
  });

  it('uses second cadence until elapsed format reaches an hour, then minute cadence', async () => {
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    const timer = await make('', {startTime: Date.now() - 3_599_000});
    const time = timeOf(timer);
    expect(time.textContent).toBe('59m 59s');
    expect(setTimeoutSpy).toHaveBeenLastCalledWith(expect.any(Function), 1000);

    vi.advanceTimersByTime(1000);
    expect(time.textContent).toBe('1h 00m');
    expect(time.getAttribute('datetime')).toBe('PT3600S');
    expect(setTimeoutSpy).toHaveBeenLastCalledWith(expect.any(Function), 60_000);
  });

  it('keeps clock format on second cadence after an hour', async () => {
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    const timer = await make('format="clock"', {startTime: Date.now() - 3_723_000});
    expect(timeOf(timer).textContent).toBe('1:02:03');
    expect(setTimeoutSpy).toHaveBeenLastCalledWith(expect.any(Function), 1000);
  });

  it('counts from a finite caller-provided start time', async () => {
    const timer = await make('', {startTime: Date.now() - 12_400});
    expect(timeOf(timer).textContent).toBe('12s');
    expect(timeOf(timer).getAttribute('datetime')).toBe('PT12S');
  });

  it('accepts the start time as the start-time attribute', async () => {
    const timer = await make(`start-time="${Date.now() - 65_000}"`);
    expect(timer.startTime).toBe(Date.now() - 65_000);
    expect(timeOf(timer).textContent).toBe('1m 05s');
  });

  it('returns to the original mount origin when startTime is removed', async () => {
    const mountedAt = Date.now();
    const timer = await make('', {startTime: mountedAt - 10_000});
    vi.advanceTimersByTime(2000);
    timer.startTime = undefined;
    await timer.updateComplete;
    expect(timeOf(timer).textContent).toBe('2s');
    expect(timeOf(timer).getAttribute('datetime')).toBe('PT2S');
  });

  it('falls back to mount time for a non-finite start time', async () => {
    const timer = await make('', {startTime: Number.NaN});
    vi.advanceTimersByTime(2000);
    expect(timeOf(timer).textContent).toBe('2s');
  });

  it('clamps a future origin to zero and schedules its first visible change directly', async () => {
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    const timer = await make('', {startTime: Date.now() + 5000});
    expect(timeOf(timer).textContent).toBe('0s');
    expect(timeOf(timer).getAttribute('datetime')).toBe('PT0S');
    expect(setTimeoutSpy).toHaveBeenLastCalledWith(expect.any(Function), 6000);

    vi.advanceTimersByTime(6000);
    expect(timeOf(timer).textContent).toBe('1s');
    expect(timeOf(timer).getAttribute('datetime')).toBe('PT1S');
  });

  it('updates format without replacing the node or losing current elapsed time', async () => {
    const now = Date.now();
    const timer = await make('', {startTime: now - 3_723_000});
    const time = timeOf(timer);
    expect(time.textContent).toBe('1h 02m');
    expect(time.getAttribute('datetime')).toBe('PT3720S');

    timer.format = 'clock';
    await timer.updateComplete;
    expect(timeOf(timer)).toBe(time);
    expect(time.textContent).toBe('1:02:03');
    expect(time.getAttribute('datetime')).toBe('PT3723S');
  });

  it('does not re-render as time advances (zero updates per tick)', async () => {
    const timer = await make();
    let updates = 0;
    const original = (timer as unknown as {updated: () => void}).updated.bind(timer);
    (timer as unknown as {updated: () => void}).updated = (): void => {
      updates++;
      original();
    };
    vi.advanceTimersByTime(5000);
    expect(timeOf(timer).textContent).toBe('5s');
    expect(updates).toBe(0);
    expect(timer.isUpdatePending).toBe(false);
  });

  it('owns one timer resource: restarts do not stack, disconnecting clears it', async () => {
    const timer = await make();
    expect(vi.getTimerCount()).toBe(1);
    timer.format = 'clock';
    await timer.updateComplete;
    timer.startTime = Date.now() - 4000;
    await timer.updateComplete;
    expect(vi.getTimerCount()).toBe(1);

    const parent = timer.parentElement!;
    timer.remove();
    expect(vi.getTimerCount()).toBe(0);
    parent.append(timer);
    await timer.updateComplete;
    expect(vi.getTimerCount()).toBe(1);
  });

  it('keeps counting from the original mount origin across a move', async () => {
    const timer = await make();
    vi.advanceTimersByTime(3000);
    const parent = timer.parentElement!;
    timer.remove();
    vi.advanceTimersByTime(4000);
    parent.append(timer);
    await timer.updateComplete;
    expect(timeOf(timer).textContent).toBe('7s');
  });

  it('matches Timestamp typography defaults and accepts overrides', async () => {
    const timer = await make();
    const text = textOf(timer);
    expect(text.getAttribute('type')).toBe('supporting');
    expect(text.getAttribute('color')).toBe('secondary');
    expect(text.getAttribute('part')).toBe('text');

    timer.type = 'body';
    timer.size = 'lg';
    timer.color = 'primary';
    timer.weight = 'bold';
    await timer.updateComplete;
    expect(text.getAttribute('type')).toBe('body');
    expect(text.getAttribute('size')).toBe('lg');
    expect(text.getAttribute('color')).toBe('primary');
    expect(text.getAttribute('weight')).toBe('bold');
    expect(timeOf(timer).getAttribute('part')).toBe('time');
  });

  it('exposes the inner time element and keeps host attributes on the host', async () => {
    const timer = await make('id="elapsed" class="custom-class" style="color: rgb(1, 2, 3)"');
    expect(timer.timeElement).toBe(timeOf(timer));
    expect(timer.id).toBe('elapsed');
    expect(timer.classList.contains('custom-class')).toBe(true);
    expect(getComputedStyle(timer).color).toBe('rgb(1, 2, 3)');
  });

  it('does not add live-region semantics by default', async () => {
    const timer = await make();
    expect(timer.hasAttribute('aria-live')).toBe(false);
    expect(timeOf(timer).hasAttribute('aria-live')).toBe(false);
    expect(timeOf(timer).hasAttribute('role')).toBe(false);
  });
});

describe('tct-timer: appearance, localisation and semantics', () => {
  it('shows tabular numerals inheriting the wrapper typography', async () => {
    const timer = await make();
    const style = getComputedStyle(timeOf(timer));
    expect(style.fontVariantNumeric).toContain('tabular-nums');
    expect(style.fontStyle).toBe('normal');
    expect(style.fontSize).toBe(
      getComputedStyle(textOf(timer).shadowRoot!.querySelector('.text')!).fontSize,
    );
  });

  it('inherits size and colour from the surrounding text with type and color inherit', async () => {
    const wrapper = await fixture<HTMLElement>(
      html`<p style="font-size: 20px; color: rgb(10, 20, 30)">
        Processing for <tct-timer type="inherit" color="inherit"></tct-timer>
      </p>`,
    );
    const timer = wrapper.querySelector<TctTimer>('tct-timer')!;
    await timer.updateComplete;
    const style = getComputedStyle(timeOf(timer));
    expect(style.fontSize).toBe('20px');
    expect(style.color).toBe('rgb(10, 20, 30)');
  });

  it('localises digits and unit letters with the language of the element', async () => {
    const wrapper = await fixture<HTMLElement>(
      html`<div>
        <tct-timer format="clock" start-time=${Date.now() - 128_000}></tct-timer>
        <tct-timer start-time=${Date.now() - 128_000}></tct-timer>
      </div>`,
      {lang: 'ar-EG'},
    );
    const [clock, elapsed] = [...wrapper.querySelectorAll<TctTimer>('tct-timer')];
    await clock!.updateComplete;
    const arabicDigits = /^[٠-٩:]+$/;
    expect(timeOf(clock!).textContent).toMatch(arabicDigits);
    expect(timeOf(elapsed!).textContent).toMatch(/[٠-٩]/);
    expect(timeOf(elapsed!).textContent).not.toMatch(/[0-9]/);
  });

  it('re-formats when the document language changes', async () => {
    const timer = await make(`format="clock" start-time="${Date.now() - 128_000}"`);
    expect(timeOf(timer).textContent).toBe('2:08');
    const previous = document.documentElement.getAttribute('lang');
    try {
      document.documentElement.lang = 'ar-EG';
      await waitUntil(() => /^[٠-٩:]+$/.test(timeOf(timer).textContent), 'Arabic digits');
    } finally {
      if (previous === null) document.documentElement.removeAttribute('lang');
      else document.documentElement.setAttribute('lang', previous);
    }
    await waitUntil(() => timeOf(timer).textContent === '2:08', 'English digits again');
  });

  it('is a native time element in the accessibility tree and passes axe', async () => {
    const wrapper = await fixture<HTMLElement>(
      html`<p>Waiting <tct-timer start-time=${Date.now() - 5000}></tct-timer></p>`,
    );
    const timer = wrapper.querySelector<TctTimer>('tct-timer')!;
    await timer.updateComplete;
    if (isChromium) expect((await axNode(timeOf(timer))).role).toBe('time');
    await expectAccessible(wrapper);
  });

  it('lets a host aria-live make it a live region', async () => {
    const timer = await make('aria-live="polite"');
    expect(timer.getAttribute('aria-live')).toBe('polite');
  });

  it('falls back to elapsed for an unknown format and warns in dev', async () => {
    resetDevWarnings();
    globalThis.tctDevMode = true;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      const timer = await make('format="stopwatch"', {startTime: Date.now() - 128_000});
      expect(timeOf(timer).textContent).toBe('2m 08s');
      expect(warn).toHaveBeenCalledTimes(1);
    } finally {
      warn.mockRestore();
      globalThis.tctDevMode = undefined;
      resetDevWarnings();
    }
  });
});

describe('timer.format: pure maths', () => {
  it('reads the parts of each format', () => {
    expect(readDuration(0, 'elapsed').parts).toEqual([{unit: 'second', value: 0, padded: false}]);
    expect(readDuration(3_720_000, 'elapsed').dateTime).toBe('PT3720S');
    expect(readDuration(-5000, 'clock').dateTime).toBe('PT0S');
    expect(readDuration(59_999, 'elapsed').dateTime).toBe('PT59S');
  });

  it('wakes at the next visible change', () => {
    expect(millisecondsUntilNextChange(1000, 0, 1000, 'clock')).toBe(1000);
    expect(millisecondsUntilNextChange(1250, 0, 1250, 'elapsed')).toBe(750);
    expect(millisecondsUntilNextChange(3_600_000, 0, 3_600_000, 'elapsed')).toBe(60_000);
    expect(millisecondsUntilNextChange(3_600_000, 0, 3_600_000, 'clock')).toBe(1000);
    expect(millisecondsUntilNextChange(0, 5000, 0, 'elapsed')).toBe(6000);
  });
});
