/**
 * tct-calendar: the element suite, then the grid structure, selection (single and range), constraints,
 * navigation and the APG keyboard model (arrows, Home/End, PageUp/PageDown with Shift, RTL), announcements,
 * locales (he-IL, ar-SA, a day-first locale), and contrast in every state. Ported from upstream
 * Calendar.test.tsx where the behaviour applies. Dates are fixed: today comes from a faked clock.
 */
import {html} from 'lit';
import {userEvent} from 'vitest/browser';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {getAnnouncerRegions} from '@tecton-wc/core/a11y/announcer.js';
import {overrideFeature} from '@tecton-wc/core/features.js';
import {deepActiveElement} from '@tecton-wc/core/utils/focus.js';
import {expectAccessible} from '@tecton-wc/testing/a11y.js';
import {emulateMedia} from '@tecton-wc/testing/emulate.js';
import {recordEvents} from '@tecton-wc/testing/events.js';
import {fixture} from '@tecton-wc/testing/fixture.js';
import {pressKeys} from '@tecton-wc/testing/keyboard.js';
import {runElementSuite} from '@tecton-wc/testing/suites/element.js';
import {animationsFinished, nextFrame, waitUntil} from '@tecton-wc/testing/timing.js';
import {getCalendarDays} from './calendar-days.js';
import {createCalendarConstraints} from './calendar-constraints.js';
import {getInitialFocusDate} from './get-initial-focus-date.js';
import {
  computeDayNeighborContinuity,
  computeDayCellState,
  computePreviewRounding,
  computeRangeRounding,
} from './day-cell-utils.js';
import './define.js';
import type {TctCalendar} from './tct-calendar.js';

// A fixed "now": the calendar reads today once per mount. Only Date is faked; frames and timers stay real.
const NOW = new Date(2026, 0, 15, 12, 0, 0);
beforeEach(() => {
  vi.useFakeTimers({toFake: ['Date']});
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
});

const root = (calendar: TctCalendar): ShadowRoot => calendar.shadowRoot!;
const day = (calendar: TctCalendar, iso: string): HTMLButtonElement =>
  root(calendar).querySelector<HTMLButtonElement>(`.day[data-date="${iso}"]:not([data-outside])`)!;
const grids = (calendar: TctCalendar): HTMLElement[] => [
  ...root(calendar).querySelectorAll<HTMLElement>('[role="grid"]'),
];
const activeDate = (): string | undefined =>
  (deepActiveElement() as HTMLElement | null)?.dataset.date;

async function make(attributes = '', options: {dir?: 'rtl'; lang?: string} = {}): Promise<TctCalendar> {
  const calendar = await fixture<TctCalendar>(
    `<tct-calendar focus-date="2026-01-01" ${attributes}></tct-calendar>`,
    options,
  );
  await calendar.updateComplete;
  await nextFrame();
  return calendar;
}

runElementSuite({
  tag: 'tct-calendar',
  render: () => html`<tct-calendar focus-date="2026-01-01"></tct-calendar>`,
  properties: {
    mode: 'range',
    value: {start: '2026-01-05', end: '2026-01-09'},
    numberOfMonths: 2,
    min: '2026-01-01',
    max: '2026-12-31',
    maxRangeSpan: 7,
    minRangeSpan: 2,
    focusDate: '2026-02-01',
    noOutsideDays: true,
    hasWeekNumbers: true,
    hasVariableRowCount: true,
    weekStartsOn: 'mon',
  },
  attributes: {
    mode: 'mode',
    numberOfMonths: 'number-of-months',
    min: 'min',
    max: 'max',
    maxRangeSpan: 'max-range-span',
    minRangeSpan: 'min-range-span',
    focusDate: 'focus-date',
    weekStartsOn: 'week-starts-on',
  },
  events: ['tct-value-change', 'tct-focus-date-change'],
});

describe('tct-calendar: pure helpers (ported)', () => {
  it('builds a fixed six-row grid, or as many rows as the month needs', () => {
    expect(getCalendarDays({year: 2026, month: 1}).days).toHaveLength(42);
    expect(getCalendarDays({year: 2026, month: 2, hasVariableRowCount: true}).days).toHaveLength(28);
    expect(getCalendarDays({year: 2026, month: 1, hasVariableRowCount: true}).weeks).toHaveLength(5);
  });

  it('fills the first week with the previous month and marks outside days', () => {
    const {days} = getCalendarDays({year: 2026, month: 1});
    // 2026-01-01 is a Thursday: Sun-Wed of the first week are December.
    expect(days.slice(0, 4).map((entry) => entry.iso)).toEqual([
      '2025-12-28',
      '2025-12-29',
      '2025-12-30',
      '2025-12-31',
    ]);
    expect(days.slice(0, 4).every((entry) => entry.isOutside)).toBe(true);
    expect(days[4]).toMatchObject({iso: '2026-01-01', isOutside: false, dayNumber: 1});
    expect(getCalendarDays({year: 2026, month: 1, weekStartsOn: 1}).days[0]!.iso).toBe('2025-12-29');
  });

  it('rotates weekday headers to the week start, per locale', () => {
    expect(getCalendarDays({year: 2026, month: 1, weekStartsOn: 1}).dayNames[0]).toBe('Mo');
    expect(getCalendarDays({year: 2026, month: 1, locale: 'fr'}).dayNames[0]).toBe('di');
    expect(getCalendarDays({year: 2026, month: 1, locale: 'he-IL'}).dayNames[0]).toBe('א׳');
  });

  it('disables dates by min, max and predicates, and spans measured from the anchor', () => {
    const constraints = createCalendarConstraints({
      min: '2026-01-05',
      max: '2026-01-25',
      dateConstraints: [(date) => date.getDay() !== 0],
    });
    const d = (day: number) => ({year: 2026, month: 1, day});
    expect(constraints.isDateDisabled(d(4))).toBe(true);
    expect(constraints.isDateDisabled(d(26))).toBe(true);
    expect(constraints.isDateDisabled(d(11))).toBe(true); // a Sunday
    expect(constraints.isDateDisabled(d(12))).toBe(false);

    const span = createCalendarConstraints({
      maxRangeSpan: 7,
      minRangeSpan: 3,
      rangeAnchor: d(10),
    });
    expect(span.isDateDisabled(d(16))).toBe(false); // 7 days counting both ends
    expect(span.isDateDisabled(d(17))).toBe(true);
    expect(span.isDateDisabled(d(4))).toBe(false);
    expect(span.isDateDisabled(d(3))).toBe(true);
    expect(span.isDateDisabled(d(11))).toBe(true); // nearer than the minimum span
    expect(span.isDateDisabled(d(10))).toBe(false); // the start is never disabled
    // Span limits do nothing before a start is picked.
    expect(createCalendarConstraints({maxRangeSpan: 2}).isDateDisabled(d(20))).toBe(false);
  });

  it('opens on today clamped into the min/max window; focus date and value win', () => {
    const today = {year: 2026, month: 1, day: 15};
    const open = (options: Partial<Parameters<typeof getInitialFocusDate>[0]>) =>
      getInitialFocusDate({today, numberOfMonths: 1, ...options});
    expect(open({})).toEqual(today);
    expect(open({min: '2026-06-10'})).toEqual({year: 2026, month: 6, day: 10});
    expect(open({max: '2019-03-20'})).toEqual({year: 2019, month: 3, day: 1});
    expect(open({max: '2019-03-20', numberOfMonths: 2})).toEqual({year: 2019, month: 2, day: 1});
    expect(open({max: '2019-03-20', min: '2019-03-01', numberOfMonths: 2})).toEqual({
      year: 2019,
      month: 3,
      day: 1,
    });
    expect(open({max: '2019-03-20', focusDate: '2030-05-05'})).toEqual({year: 2030, month: 5, day: 5});
    expect(open({max: '2019-03-20', value: '2031-07-07'})).toEqual({year: 2031, month: 7, day: 7});
    expect(open({focusDate: 'not a date'})).toEqual(today);
  });

  it('derives the cell state, the band caps and the run continuity', () => {
    const d = (day: number) => ({year: 2026, month: 1, day});
    const state = computeDayCellState({
      date: d(10),
      dayIndex: 0,
      mode: 'range',
      selectedDate: null,
      rangeStart: d(10),
      rangeEnd: d(12),
      previewStart: null,
      previewEnd: null,
      today: d(11),
      isDisabled: false,
      isOutside: false,
    });
    expect(state).toMatchObject({isRangeStart: true, isRangeEnd: false, isInRange: true, isToday: false});
    expect(computeRangeRounding(state, {prevInRange: false, nextInRange: true})).toEqual({
      roundStart: true,
      roundEnd: false,
    });
    // The first column always rounds its start, so a band never runs into the next row.
    expect(computePreviewRounding(state)).toEqual({roundStart: true, roundEnd: false});
    // An outside day never carries selection: the same date renders in both panes of a two-month view.
    expect(
      computeDayCellState({
        date: d(10),
        dayIndex: 1,
        mode: 'single',
        selectedDate: d(10),
        rangeStart: null,
        rangeEnd: null,
        previewStart: null,
        previewEnd: null,
        today: d(10),
        isDisabled: false,
        isOutside: true,
      }),
    ).toMatchObject({isSelected: false, isToday: false, effectivelyDisabled: true});
    const week = [1, 2, 3].map((n) => ({date: d(n), isOutside: false}));
    expect(
      computeDayNeighborContinuity({
        week,
        dayIndex: 1,
        mode: 'range',
        rangeStart: d(1),
        rangeEnd: d(3),
        previewStart: null,
        previewEnd: null,
        isDisabled: (date) => date.day === 3,
      }),
    ).toMatchObject({prevInRange: true, nextInRange: false});
  });
});

describe('tct-calendar: structure and semantics', () => {
  it('renders the current month as an APG grid: a header row of columnheaders, then week rows of gridcells', async () => {
    const calendar = await make();
    const [grid] = grids(calendar);
    expect(grid!.getAttribute('aria-label')).toBe('January 2026');
    expect(root(calendar).querySelector('.month-year')!.textContent).toBe('January 2026');
    const rows = grid!.querySelectorAll(':scope > [role="row"]');
    expect(rows).toHaveLength(7);
    const headerCells = rows[0]!.querySelectorAll('[role="columnheader"]');
    expect([...headerCells].map((cell) => cell.textContent.trim())).toEqual([
      'Su',
      'Mo',
      'Tu',
      'We',
      'Th',
      'Fr',
      'Sa',
    ]);
    expect(headerCells[0]!.getAttribute('aria-label')).toBe('Sunday');
    for (const row of [...rows].slice(1)) {
      expect(row.querySelectorAll(':scope > [role="gridcell"]')).toHaveLength(7);
    }
    expect(grid!.querySelectorAll('.day[data-date]')).toHaveLength(42);
    expect(day(calendar, '2026-01-15').getAttribute('aria-label')).toBe('Thursday, January 15, 2026');
  });

  it("marks today's cell with aria-current='date'", async () => {
    const calendar = await make();
    expect(day(calendar, '2026-01-15').getAttribute('aria-current')).toBe('date');
    expect(root(calendar).querySelectorAll('[aria-current="date"]')).toHaveLength(1);
  });

  it('shows week numbers as rowheaders when asked', async () => {
    const calendar = await make('has-week-numbers');
    const headers = root(calendar).querySelectorAll('[role="rowheader"]');
    expect(headers).toHaveLength(6);
    // A row is numbered by its first day of the month; Sunday 2026-01-04 still belongs to ISO week 1.
    expect([...headers].map((header) => header.textContent.trim())).toEqual(['1', '1', '2', '3', '4', '5']);
  });

  it('renders two months side by side with their own grid names, and clamps other counts to one', async () => {
    const calendar = await make('number-of-months="2"');
    expect(grids(calendar).map((grid) => grid.getAttribute('aria-label'))).toEqual([
      'January 2026',
      'February 2026',
    ]);
    expect(root(calendar).querySelector('.month-year')!.textContent).toBe(
      'January 2026 – February 2026',
    );
    calendar.numberOfMonths = 1;
    await calendar.updateComplete;
    expect(grids(calendar)).toHaveLength(1);
    calendar.numberOfMonths = 5 as never;
    await calendar.updateComplete;
    expect(grids(calendar)).toHaveLength(1);
  });

  it('rotates the week to weekStartsOn, as a number or a day name in any case', async () => {
    const calendar = await make('week-starts-on="1"');
    expect(root(calendar).querySelector('[role="columnheader"]')!.textContent.trim()).toBe('Mo');
    calendar.weekStartsOn = 'SAT';
    await calendar.updateComplete;
    expect(root(calendar).querySelector('[role="columnheader"]')!.textContent.trim()).toBe('Sa');
  });

  it('shows outside days as inert days, or empty cells with no-outside-days', async () => {
    const calendar = await make();
    const outside = root(calendar).querySelector<HTMLButtonElement>('.day[data-outside]')!;
    expect(outside.getAttribute('aria-disabled')).toBe('true');
    expect(outside.tabIndex).toBe(-1);
    calendar.noOutsideDays = true;
    await calendar.updateComplete;
    expect(root(calendar).querySelector('.day[data-outside]')).toBeNull();
    const cells = grids(calendar)[0]!.querySelectorAll('[role="gridcell"]');
    expect(cells).toHaveLength(42);
  });

  it('gives every day button its machine-readable date', async () => {
    const calendar = await make();
    expect(day(calendar, '2026-01-15').dataset.date).toBe('2026-01-15');
  });

  it('is one tab stop: the selected day, else today, else the first available', async () => {
    const calendar = await make('value="2026-01-20"');
    const stops = () =>
      [...root(calendar).querySelectorAll<HTMLElement>('.day')].filter((d) => d.tabIndex === 0);
    expect(stops().map((d) => d.dataset.date)).toEqual(['2026-01-20']);
    calendar.value = undefined;
    await calendar.updateComplete;
    // The stop stays where the user last had it until a new render needs a seed.
    expect(stops()).toHaveLength(1);
    const fresh = await make('min="2026-01-20" max="2026-01-31"');
    expect(
      [...root(fresh).querySelectorAll<HTMLElement>('.day')]
        .filter((d) => d.tabIndex === 0)
        .map((d) => d.dataset.date),
    ).toEqual(['2026-01-20']);
    const withToday = await make();
    expect(
      [...root(withToday).querySelectorAll<HTMLElement>('.day')]
        .filter((d) => d.tabIndex === 0)
        .map((d) => d.dataset.date),
    ).toEqual(['2026-01-15']);
  });

  it('exposes the nav buttons with names and disables them at the min and max month', async () => {
    const calendar = await make('min="2026-01-10" max="2026-01-20"');
    const [previous, next] = [...root(calendar).querySelectorAll<HTMLElement>('.nav')];
    expect(previous!.getAttribute('label')).toBe('Previous month');
    expect(next!.getAttribute('label')).toBe('Next month');
    expect(previous!.hasAttribute('disabled')).toBe(true);
    expect(next!.hasAttribute('disabled')).toBe(true);
  });

  it('draws the selection, today and the range as states of the day parts', async () => {
    const calendar = await make('mode="range" value="2026-01-19/2026-01-22"');
    const state = (iso: string) => {
      const button = day(calendar, iso);
      return ['selected', 'today', 'in-range', 'unavailable'].filter((name) =>
        button.hasAttribute(`data-${name}`),
      );
    };
    expect(state('2026-01-19')).toEqual(['selected', 'in-range']);
    expect(state('2026-01-20')).toEqual(['in-range']);
    expect(state('2026-01-22')).toEqual(['selected', 'in-range']);
    expect(state('2026-01-15')).toEqual(['today']);
    expect(root(calendar).querySelectorAll('.range-bg')).toHaveLength(4);
  });
});

describe('tct-calendar: single selection', () => {
  it('selects a date by click: tct-value-change, then input and change, and the value follows', async () => {
    const calendar = await make();
    const events = recordEvents(calendar, ['tct-value-change', 'input', 'change']);
    await userEvent.click(day(calendar, '2026-01-20'));
    await calendar.updateComplete;
    expect(events.events.map((event) => event.type)).toEqual(['tct-value-change', 'input', 'change']);
    expect(events.events[0]).toMatchObject({value: '2026-01-20', oldValue: undefined, reason: 'selection'});
    expect(events.events.map((event) => [event.bubbles, event.composed])).toEqual([
      [true, true],
      [true, true],
      [true, true],
    ]);
    expect(calendar.value).toBe('2026-01-20');
    expect(day(calendar, '2026-01-20').getAttribute('aria-label')).toBe(
      'Tuesday, January 20, 2026, selected',
    );
    expect(day(calendar, '2026-01-20').hasAttribute('data-selected')).toBe(true);
  });

  it('selects with Enter and Space on the focused day', async () => {
    const calendar = await make();
    day(calendar, '2026-01-14').focus();
    await pressKeys('Enter');
    expect(calendar.value).toBe('2026-01-14');
    await pressKeys('ArrowRight', ' ');
    expect(calendar.value).toBe('2026-01-15');
  });

  it('keeps the value when the intent event is cancelled', async () => {
    const calendar = await make('value="2026-01-10"');
    calendar.addEventListener('tct-value-change', (event) => event.preventDefault());
    const events = recordEvents(calendar, ['input', 'change']);
    await userEvent.click(day(calendar, '2026-01-20'));
    expect(calendar.value).toBe('2026-01-10');
    expect(events.events).toHaveLength(0);
  });

  it('never fires an event for a property or attribute write', async () => {
    const calendar = await make();
    const events = recordEvents(calendar, ['tct-value-change', 'input', 'change', 'tct-focus-date-change']);
    calendar.value = '2026-01-03';
    calendar.setAttribute('focus-date', '2026-03-01');
    calendar.navigateTo('2026-05-05');
    await calendar.updateComplete;
    expect(events.events).toHaveLength(0);
    expect(root(calendar).querySelector('.month-year')!.textContent).toBe('May 2026');
  });

  it('ignores clicks on outside and unavailable days', async () => {
    const calendar = await make('min="2026-01-10"');
    const events = recordEvents(calendar, ['tct-value-change']);
    await userEvent.click(root(calendar).querySelector<HTMLElement>('.day[data-outside]')!, {force: true});
    await userEvent.click(day(calendar, '2026-01-05'), {force: true});
    expect(events.events).toHaveLength(0);
    expect(calendar.value).toBeUndefined();
  });

  it('keeps a value outside the min/max window (a value is never rewritten)', async () => {
    const calendar = await make('value="2026-01-02" min="2026-01-10"');
    expect(calendar.value).toBe('2026-01-02');
    expect(day(calendar, '2026-01-02').hasAttribute('data-unavailable')).toBe(true);
  });

  it('marks unavailable days by min, max and dateConstraints: not focusable, not selectable', async () => {
    const calendar = await make('min="2026-01-05" max="2026-01-25"');
    calendar.dateConstraints = [(date) => date.getDay() !== 3];
    await calendar.updateComplete;
    for (const iso of ['2026-01-04', '2026-01-26', '2026-01-07']) {
      const button = day(calendar, iso);
      expect(button.disabled, iso).toBe(true);
      expect(button.getAttribute('aria-disabled'), iso).toBe('true');
      expect(button.hasAttribute('data-unavailable'), iso).toBe(true);
    }
    expect(day(calendar, '2026-01-08').disabled).toBe(false);
  });
});

describe('tct-calendar: range selection', () => {
  it('picks a start, previews the range on hover, and completes on the second pick', async () => {
    const calendar = await make('mode="range"');
    const events = recordEvents(calendar, ['tct-value-change', 'change']);
    await userEvent.click(day(calendar, '2026-01-10'));
    await calendar.updateComplete;
    expect(events.events).toHaveLength(0);
    expect(day(calendar, '2026-01-10').getAttribute('aria-label')).toBe(
      'Saturday, January 10, 2026, range start',
    );
    await userEvent.hover(day(calendar, '2026-01-14'));
    await calendar.updateComplete;
    expect(root(calendar).querySelectorAll('.preview-bg').length).toBeGreaterThan(0);
    await userEvent.click(day(calendar, '2026-01-14'));
    await calendar.updateComplete;
    expect(calendar.value).toEqual({start: '2026-01-10', end: '2026-01-14'});
    expect(events.events.map((event) => event.type)).toEqual(['tct-value-change', 'change']);
    expect(events.events[0]).toMatchObject({value: {start: '2026-01-10', end: '2026-01-14'}});
    expect(day(calendar, '2026-01-14').getAttribute('aria-label')).toContain('range end');
    expect(day(calendar, '2026-01-12').getAttribute('aria-label')).toContain('in range');
  });

  it('orders a reverse pick chronologically', async () => {
    const calendar = await make('mode="range"');
    await userEvent.click(day(calendar, '2026-01-20'));
    await userEvent.click(day(calendar, '2026-01-12'));
    expect(calendar.value).toEqual({start: '2026-01-12', end: '2026-01-20'});
  });

  it('marks the grid multiselectable in range mode only', async () => {
    const calendar = await make('mode="range" number-of-months="2"');
    expect(grids(calendar).every((grid) => grid.getAttribute('aria-multiselectable') === 'true')).toBe(true);
    calendar.mode = 'single';
    await calendar.updateComplete;
    expect(grids(calendar).some((grid) => grid.hasAttribute('aria-multiselectable'))).toBe(false);
  });

  it('a one-day range is both start and end in its name', async () => {
    const calendar = await make('mode="range" value="2026-01-10/2026-01-10"');
    expect(day(calendar, '2026-01-10').getAttribute('aria-label')).toContain(
      'range start and range end',
    );
  });

  it('accepts a range property and the interval attribute, in either order', async () => {
    const calendar = await make('mode="range"');
    calendar.value = {start: '2026-01-20', end: '2026-01-18'};
    await calendar.updateComplete;
    expect(day(calendar, '2026-01-18').hasAttribute('data-selected')).toBe(true);
    expect(day(calendar, '2026-01-20').hasAttribute('data-selected')).toBe(true);
    expect(day(calendar, '2026-01-19').hasAttribute('data-in-range')).toBe(true);
    const attribute = await make('mode="range" value="2026-01-03/2026-01-06"');
    expect(attribute.value).toEqual({start: '2026-01-03', end: '2026-01-06'});
  });

  it('caps the end to maxRangeSpan once a start is picked', async () => {
    const calendar = await make('mode="range" max-range-span="3"');
    expect(day(calendar, '2026-01-20').disabled).toBe(false);
    await userEvent.click(day(calendar, '2026-01-10'));
    await calendar.updateComplete;
    expect(day(calendar, '2026-01-12').disabled).toBe(false);
    expect(day(calendar, '2026-01-13').disabled).toBe(true);
    expect(day(calendar, '2026-01-07').disabled).toBe(true);
    expect(day(calendar, '2026-01-08').disabled).toBe(false);
  });

  it('enforces minRangeSpan, and a second click on the start clears the pick', async () => {
    const calendar = await make('mode="range" min-range-span="3"');
    const events = recordEvents(calendar, ['tct-value-change']);
    await userEvent.click(day(calendar, '2026-01-10'));
    await calendar.updateComplete;
    expect(day(calendar, '2026-01-11').disabled).toBe(true);
    expect(day(calendar, '2026-01-12').disabled).toBe(false);
    expect(day(calendar, '2026-01-10').disabled).toBe(false);
    await userEvent.click(day(calendar, '2026-01-10'));
    await calendar.updateComplete;
    expect(events.events).toHaveLength(0);
    expect(day(calendar, '2026-01-11').disabled).toBe(false);
  });

  it('commits a same-day range with the default minimum', async () => {
    const calendar = await make('mode="range"');
    await userEvent.click(day(calendar, '2026-01-10'));
    await userEvent.click(day(calendar, '2026-01-10'));
    expect(calendar.value).toEqual({start: '2026-01-10', end: '2026-01-10'});
  });

  it('does not apply span limits in single mode', async () => {
    const calendar = await make('max-range-span="2" min-range-span="5"');
    await userEvent.click(day(calendar, '2026-01-10'));
    expect(calendar.value).toBe('2026-01-10');
    expect(day(calendar, '2026-01-12').disabled).toBe(false);
  });

  it('Escape cancels a pick in progress and stops there', async () => {
    const calendar = await make('mode="range"');
    const outer = vi.fn();
    document.addEventListener('keydown', outer);
    try {
      await userEvent.click(day(calendar, '2026-01-10'));
      await calendar.updateComplete;
      expect(day(calendar, '2026-01-10').getAttribute('aria-label')).toContain('range start');
      await pressKeys('Escape');
      await calendar.updateComplete;
      expect(day(calendar, '2026-01-10').getAttribute('aria-label')).not.toContain('range start');
      const cancelled = outer.mock.calls.filter(([event]) => (event as KeyboardEvent).key === 'Escape');
      expect(cancelled).toHaveLength(0);
      // With nothing in progress, Escape passes through (a popover around the calendar closes on it).
      await pressKeys('Escape');
      expect(outer.mock.calls.filter(([event]) => (event as KeyboardEvent).key === 'Escape')).toHaveLength(1);
    } finally {
      document.removeEventListener('keydown', outer);
    }
  });

  it('announces the start, the cleared start and the completed range in order', async () => {
    const restore = overrideFeature('ariaNotify', false);
    try {
      const calendar = await make('mode="range"');
      await userEvent.click(day(calendar, '2026-01-20'));
      await waitUntil(
        () => getAnnouncerRegions().polite?.textContent === 'Start date Tuesday, January 20, 2026. Select an end date.',
        'start announced',
        3000,
      );
      await userEvent.click(day(calendar, '2026-01-12'));
      await waitUntil(
        () =>
          getAnnouncerRegions().polite?.textContent ===
          'Selected range: Monday, January 12, 2026 to Tuesday, January 20, 2026.',
        'range announced chronologically',
        3000,
      );
    } finally {
      restore();
    }
  });
});

describe('tct-calendar: month navigation', () => {
  it('turns the page with the buttons: a cancelable tct-focus-date-change, then the new month', async () => {
    const calendar = await make();
    const events = recordEvents(calendar, ['tct-focus-date-change']);
    await userEvent.click(root(calendar).querySelector<HTMLElement>('[data-nav="next"]')!);
    await calendar.updateComplete;
    expect(root(calendar).querySelector('.month-year')!.textContent).toBe('February 2026');
    expect(events.events[0]).toMatchObject({focusDate: '2026-02-01'});
    expect(events.events[0]!.cancelable).toBe(true);
    expect(calendar.focusDate).toBe('2026-02-01');
    await userEvent.click(root(calendar).querySelector<HTMLElement>('[data-nav="prev"]')!);
    await userEvent.click(root(calendar).querySelector<HTMLElement>('[data-nav="prev"]')!);
    await calendar.updateComplete;
    expect(root(calendar).querySelector('.month-year')!.textContent).toBe('December 2025');
  });

  it('keeps the month when the intent event is cancelled (a host that drives focus-date)', async () => {
    const calendar = await make();
    calendar.addEventListener('tct-focus-date-change', (event) => event.preventDefault());
    await userEvent.click(root(calendar).querySelector<HTMLElement>('[data-nav="next"]')!);
    await calendar.updateComplete;
    expect(root(calendar).querySelector('.month-year')!.textContent).toBe('January 2026');
  });

  it('advances both months together in a two-month view', async () => {
    const calendar = await make('number-of-months="2"');
    await userEvent.click(root(calendar).querySelector<HTMLElement>('[data-nav="next"]')!);
    await calendar.updateComplete;
    expect(grids(calendar).map((grid) => grid.getAttribute('aria-label'))).toEqual([
      'February 2026',
      'March 2026',
    ]);
  });

  it('opens on the selected value, then on today clamped into the min/max window', async () => {
    const selected = await fixture<TctCalendar>('<tct-calendar value="2026-07-04"></tct-calendar>');
    await selected.updateComplete;
    expect(root(selected).querySelector('.month-year')!.textContent).toBe('July 2026');
    const open = await fixture<TctCalendar>('<tct-calendar></tct-calendar>');
    await open.updateComplete;
    expect(root(open).querySelector('.month-year')!.textContent).toBe('January 2026');
    const future = await fixture<TctCalendar>('<tct-calendar min="2026-06-10"></tct-calendar>');
    await future.updateComplete;
    expect(root(future).querySelector('.month-year')!.textContent).toBe('June 2026');
    const past = await fixture<TctCalendar>('<tct-calendar max="2019-03-20"></tct-calendar>');
    await past.updateComplete;
    expect(root(past).querySelector('.month-year')!.textContent).toBe('March 2019');
  });

  it('announces the new month, but not on the first render and not when a pick leaves the month', async () => {
    const restore = overrideFeature('ariaNotify', false);
    try {
      const calendar = await make();
      await nextFrame();
      expect(getAnnouncerRegions().polite?.textContent ?? '').toBe('');
      await userEvent.click(day(calendar, '2026-01-20'));
      await nextFrame();
      expect(getAnnouncerRegions().polite?.textContent ?? '').toBe('');
      await userEvent.click(root(calendar).querySelector<HTMLElement>('[data-nav="next"]')!);
      await waitUntil(() => getAnnouncerRegions().polite?.textContent === 'February 2026', 'February announced', 3000);
      calendar.navigateTo('2026-04-01');
      await waitUntil(() => getAnnouncerRegions().polite?.textContent === 'April 2026', 'April announced', 3000);
    } finally {
      restore();
    }
  });
});

describe('tct-calendar: keyboard (APG date grid)', () => {
  it('arrow keys move by a day and by a week, in the same weekday column', async () => {
    const calendar = await make();
    day(calendar, '2026-01-14').focus();
    await pressKeys('ArrowRight');
    expect(activeDate()).toBe('2026-01-15');
    await pressKeys('ArrowLeft', 'ArrowLeft');
    expect(activeDate()).toBe('2026-01-13');
    await pressKeys('ArrowDown');
    expect(activeDate()).toBe('2026-01-20');
    await pressKeys('ArrowUp', 'ArrowUp');
    expect(activeDate()).toBe('2026-01-06');
  });

  it('Home and End go to the start and end of the week; Ctrl+Home and Ctrl+End to the grid edges', async () => {
    const calendar = await make();
    day(calendar, '2026-01-14').focus();
    await pressKeys('Home');
    expect(activeDate()).toBe('2026-01-11');
    await pressKeys('End');
    expect(activeDate()).toBe('2026-01-17');
    await pressKeys('Control+Home');
    expect(activeDate()).toBe('2026-01-01');
    await pressKeys('Control+End');
    expect(activeDate()).toBe('2026-01-31');
  });

  it('follows the week start: Home is Monday with week-starts-on="mon"', async () => {
    const calendar = await make('week-starts-on="mon"');
    day(calendar, '2026-01-14').focus();
    await pressKeys('Home');
    expect(activeDate()).toBe('2026-01-12');
    await pressKeys('End');
    expect(activeDate()).toBe('2026-01-18');
  });

  it('ArrowDown lands on the same weekday +7 days even when earlier days are unavailable', async () => {
    const calendar = await make('min="2026-01-05"');
    expect(day(calendar, '2026-01-01').disabled).toBe(true);
    day(calendar, '2026-01-08').focus();
    await pressKeys('ArrowDown');
    expect(activeDate()).toBe('2026-01-15');
    await pressKeys('ArrowDown');
    expect(activeDate()).toBe('2026-01-22');
  });

  it('ArrowUp skips an unavailable cell in the same column to the next available row', async () => {
    const calendar = await make();
    calendar.dateConstraints = [(date) => !(date.getMonth() === 0 && date.getDate() === 8)];
    await calendar.updateComplete;
    expect(day(calendar, '2026-01-08').disabled).toBe(true);
    day(calendar, '2026-01-15').focus();
    await pressKeys('ArrowUp');
    expect(activeDate()).toBe('2026-01-01');
  });

  it('an arrow key past the last day turns the page and lands on the neighbouring day', async () => {
    const calendar = await make();
    const events = recordEvents(calendar, ['tct-focus-date-change']);
    day(calendar, '2026-01-31').focus();
    await pressKeys('ArrowRight');
    await waitUntil(() => activeDate() === '2026-02-01', 'February 1 focused');
    expect(root(calendar).querySelector('.month-year')!.textContent).toBe('February 2026');
    expect(events.events[0]).toMatchObject({reason: 'keyboard'});
    await pressKeys('ArrowLeft');
    await waitUntil(() => activeDate() === '2026-01-31', 'January 31 focused');
    expect(root(calendar).querySelector('.month-year')!.textContent).toBe('January 2026');
  });

  it('ArrowDown from the last week lands +7 days in the next month, not the same date', async () => {
    const calendar = await make();
    day(calendar, '2026-01-28').focus();
    await pressKeys('ArrowDown');
    await waitUntil(() => activeDate() === '2026-02-04', 'February 4 focused');
    await pressKeys('ArrowUp');
    await waitUntil(() => activeDate() === '2026-01-28', 'January 28 focused');
  });

  it('PageDown and PageUp move a month, keeping the day of the month and clamping to the shorter month', async () => {
    const calendar = await make();
    day(calendar, '2026-01-31').focus();
    await pressKeys('PageDown');
    await waitUntil(() => activeDate() === '2026-02-28', 'February 28 focused');
    expect(root(calendar).querySelector('.month-year')!.textContent).toBe('February 2026');
    await pressKeys('PageDown');
    await waitUntil(() => activeDate() === '2026-03-28', 'March 28 focused');
    await pressKeys('PageUp', 'PageUp');
    await waitUntil(() => activeDate() === '2026-01-28', 'January 28 focused');
  });

  it('Shift+PageDown and Shift+PageUp move a year', async () => {
    const calendar = await fixture<TctCalendar>(
      '<tct-calendar value="2028-02-29" focus-date="2028-02-01"></tct-calendar>',
    );
    await calendar.updateComplete;
    day(calendar, '2028-02-29').focus();
    await pressKeys('Shift+PageDown');
    await waitUntil(() => activeDate() === '2029-02-28', 'next year, clamped');
    expect(root(calendar).querySelector('.month-year')!.textContent).toBe('February 2029');
    await pressKeys('Shift+PageUp', 'Shift+PageUp');
    await waitUntil(() => activeDate() === '2027-02-28', 'two years back');
    expect(root(calendar).querySelector('.month-year')!.textContent).toBe('February 2027');
  });

  it('PageDown stays inside min and max: it clamps to the bound and never leaves the window', async () => {
    const calendar = await make('min="2026-01-05" max="2026-02-10"');
    day(calendar, '2026-01-25').focus();
    await pressKeys('PageDown');
    await waitUntil(() => activeDate() === '2026-02-10', 'clamped to max');
    await pressKeys('PageDown');
    expect(activeDate()).toBe('2026-02-10');
    expect(root(calendar).querySelector('.month-year')!.textContent).toBe('February 2026');
  });

  it('moves to the nearest available day when the target is unavailable', async () => {
    const calendar = await make();
    calendar.dateConstraints = [(date) => !(date.getMonth() === 1 && date.getDate() === 11)];
    await calendar.updateComplete;
    day(calendar, '2026-01-11').focus();
    await pressKeys('PageDown');
    await waitUntil(() => activeDate() === '2026-02-12', 'skipped February 11');
  });

  it('moves between two visible months without turning the page', async () => {
    const calendar = await make('number-of-months="2"');
    const events = recordEvents(calendar, ['tct-focus-date-change']);
    day(calendar, '2026-01-31').focus();
    await pressKeys('ArrowRight');
    await waitUntil(() => activeDate() === '2026-02-01', 'February 1 focused');
    expect(events.events).toHaveLength(0);
    expect(grids(calendar).map((grid) => grid.getAttribute('aria-label'))).toEqual([
      'January 2026',
      'February 2026',
    ]);
  });

  it('leaves Alt+arrows to the browser and ignores other keys', async () => {
    const calendar = await make();
    day(calendar, '2026-01-14').focus();
    await pressKeys('Alt+ArrowRight');
    expect(activeDate()).toBe('2026-01-14');
    await pressKeys('a');
    expect(activeDate()).toBe('2026-01-14');
  });

  it('is a single tab stop for the grid: Tab leaves it', async () => {
    const outer = await fixture<HTMLElement>(
      '<div><button id="before">before</button><tct-calendar focus-date="2026-01-01"></tct-calendar><button id="after">after</button></div>',
    );
    const calendar = outer.querySelector<TctCalendar>('tct-calendar')!;
    await calendar.updateComplete;
    day(calendar, '2026-01-15').focus();
    await pressKeys('Tab');
    expect(deepActiveElement()?.id).toBe('after');
    await pressKeys('Shift+Tab');
    expect(activeDate()).toBe('2026-01-15');
  });

  it('focus() focuses the tab stop', async () => {
    const calendar = await make('value="2026-01-20"');
    calendar.focus();
    expect(activeDate()).toBe('2026-01-20');
  });
});

describe('tct-calendar: right-to-left', () => {
  it('mirrors the horizontal arrows, and the chevrons of the nav buttons', async () => {
    const calendar = await make('', {dir: 'rtl', lang: 'ar-SA'});
    day(calendar, '2026-01-14').focus();
    await pressKeys('ArrowRight');
    expect(activeDate()).toBe('2026-01-13');
    await pressKeys('ArrowLeft', 'ArrowLeft');
    expect(activeDate()).toBe('2026-01-15');
    // Vertical arrows and Home/End follow the row, whatever the direction.
    await pressKeys('ArrowDown');
    expect(activeDate()).toBe('2026-01-22');
    const chevron = root(calendar).querySelector<HTMLElement>('[data-nav="prev"]')!;
    const glyph = chevron.shadowRoot!.querySelector('tct-icon')!.shadowRoot!.querySelector('svg')!;
    expect(glyph.hasAttribute('data-mirror')).toBe(true);
  });

  it('places the previous month button at the inline start and the first weekday at the right', async () => {
    const calendar = await make('', {dir: 'rtl', lang: 'he-IL'});
    const prev = root(calendar).querySelector('[data-nav="prev"]')!.getBoundingClientRect();
    const next = root(calendar).querySelector('[data-nav="next"]')!.getBoundingClientRect();
    expect(prev.left).toBeGreaterThan(next.left);
    const [first, last] = [...root(calendar).querySelectorAll('[role="columnheader"]')].map((cell) =>
      cell.getBoundingClientRect(),
    ) as [DOMRect, DOMRect];
    expect(first.left).toBeGreaterThan(last.left);
  });
});

describe('tct-calendar: locales', () => {
  it('renders he-IL with Hebrew month and weekday names', async () => {
    const calendar = await make('', {dir: 'rtl', lang: 'he-IL'});
    expect(root(calendar).querySelector('.month-year')!.textContent).toBe('ינואר 2026');
    expect(root(calendar).querySelector('[role="columnheader"]')!.textContent.trim()).toBe('א׳');
    expect(day(calendar, '2026-01-15').getAttribute('aria-label')).toContain('2026');
    expect(day(calendar, '2026-01-15').getAttribute('aria-label')).toMatch(/[֐-׿]/u);
  });

  it('renders ar-SA with Arabic-Indic digits and Arabic month names, on the Gregorian grid', async () => {
    const calendar = await make('', {dir: 'rtl', lang: 'ar-SA'});
    expect(root(calendar).querySelector('.month-year')!.textContent).toMatch(/يناير\s+[٠-٩]{4}/u);
    expect(root(calendar).querySelector('[role="columnheader"]')!.textContent.trim()).toBe('أحد');
    // The date is still the ISO one; only its display is localized.
    expect(day(calendar, '2026-01-15').dataset.date).toBe('2026-01-15');
    expect(day(calendar, '2026-01-15').getAttribute('aria-label')).toMatch(/[٠-٩]/u);
  });

  it('renders a day-first locale (en-GB) with English names and the same dates', async () => {
    const calendar = await make('', {lang: 'en-GB'});
    expect(root(calendar).querySelector('.month-year')!.textContent).toBe('January 2026');
    expect(day(calendar, '2026-01-15').getAttribute('aria-label')).toBe('Thursday 15 January 2026');
  });

  it('translates the navigation and the selection state (de-DE)', async () => {
    const calendar = await make('value="2026-01-20"', {lang: 'de-DE'});
    await vi.waitFor(() => {
      expect(root(calendar).querySelector('[data-nav="prev"]')!.getAttribute('label')).toBe('Vorheriger Monat');
    });
    expect(root(calendar).querySelector('.month-year')!.textContent).toBe('Januar 2026');
    expect(day(calendar, '2026-01-20').getAttribute('aria-label')).toContain('ausgewählt');
  });
});

describe('tct-calendar: accessibility and contrast in every state', () => {
  /** Waits for the state transitions to finish: measuring the first frame is what hid contrast defects. */
  async function settleStyles(calendar: TctCalendar): Promise<void> {
    await calendar.updateComplete;
    await animationsFinished(calendar.shadowRoot!.querySelector('.calendar')!);
  }

  const SCHEMES = ['light', 'dark'] as const;

  for (const scheme of SCHEMES) {
    it(`passes axe at rest, selected, ranged and unavailable (${scheme})`, async () => {
      await emulateMedia({colorScheme: scheme});
      const wrapper = await fixture<HTMLElement>(
        '<div style="padding:8px;background:var(--color-background-surface)"><tct-calendar mode="range" focus-date="2026-01-01" value="2026-01-19/2026-01-22" min="2026-01-03" max="2026-01-30"></tct-calendar></div>',
        {theme: scheme},
      );
      const calendar = wrapper.querySelector<TctCalendar>('tct-calendar')!;
      await settleStyles(calendar);
      await expectAccessible(wrapper);
    });

    it(`passes axe with the pointer over a day, a day in keyboard focus, and the selected day hovered and focused (${scheme})`, async () => {
      await emulateMedia({colorScheme: scheme});
      const wrapper = await fixture<HTMLElement>(
        '<div style="padding:8px;background:var(--color-background-surface)"><tct-calendar focus-date="2026-01-01" value="2026-01-19"></tct-calendar></div>',
        {theme: scheme},
      );
      const calendar = wrapper.querySelector<TctCalendar>('tct-calendar')!;
      await settleStyles(calendar);

      await userEvent.hover(day(calendar, '2026-01-10'));
      await settleStyles(calendar);
      await expectAccessible(wrapper);

      await userEvent.hover(day(calendar, '2026-01-19'));
      await settleStyles(calendar);
      await expectAccessible(wrapper);

      // Keyboard focus: arrows come from the keyboard, so :focus-visible matches.
      await userEvent.unhover(day(calendar, '2026-01-19'));
      day(calendar, '2026-01-15').focus();
      await pressKeys('ArrowLeft');
      await settleStyles(calendar);
      expect(activeDate()).toBe('2026-01-14');
      await expectAccessible(wrapper);

      await pressKeys('ArrowDown', 'ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowRight');
      await settleStyles(calendar);
      expect(activeDate()).toBe('2026-01-25');
      day(calendar, '2026-01-19').focus();
      await pressKeys('ArrowRight', 'ArrowLeft');
      await settleStyles(calendar);
      expect(activeDate()).toBe('2026-01-19');
      await expectAccessible(wrapper);
    });
  }

  it('meets 4.5:1 for the text of a day in each state and 3:1 for the today ring, in both schemes', async () => {
    for (const scheme of SCHEMES) {
      await emulateMedia({colorScheme: scheme});
      const wrapper = await fixture<HTMLElement>(
        '<div style="padding:8px;background:var(--color-background-surface)"><tct-calendar mode="range" focus-date="2026-01-01" value="2026-01-19/2026-01-22" min="2026-01-03"></tct-calendar></div>',
        {theme: scheme},
      );
      const calendar = wrapper.querySelector<TctCalendar>('tct-calendar')!;
      await settleStyles(calendar);
      const surface = backgroundOf(wrapper);
      const check = (label: string, iso: string, minimum = 4.5): void => {
        const button = day(calendar, iso);
        const foreground = parseColor(getComputedStyle(button).color);
        const fill = over(parseColor(getComputedStyle(button).backgroundColor), surface);
        expect(contrast(foreground, fill), `${scheme} ${label}`).toBeGreaterThanOrEqual(minimum);
      };
      check('resting', '2026-01-10');
      check('today', '2026-01-15');
      check('selected endpoint', '2026-01-19');
      // The range band paints under a transparent day: text on the muted accent wash.
      const band = calendar.shadowRoot!.querySelector('.range-bg')!;
      const wash = over(parseColor(getComputedStyle(band).backgroundColor), surface);
      const bandText = parseColor(getComputedStyle(day(calendar, '2026-01-20')).color);
      expect(contrast(bandText, wash), `${scheme} in range`).toBeGreaterThanOrEqual(4.5);
      const outside = calendar.shadowRoot!.querySelector<HTMLElement>('.day[data-outside]')!;
      expect(
        contrast(parseColor(getComputedStyle(outside).color), surface),
        `${scheme} outside day`,
      ).toBeGreaterThanOrEqual(4.5);
      // The today ring is the day's only visual marker beside its name: 3:1 against the surface.
      const ring = /rgba?\([^)]*\)/.exec(getComputedStyle(day(calendar, '2026-01-15')).boxShadow)![0];
      expect(contrast(parseColor(ring), surface), `${scheme} today ring`).toBeGreaterThanOrEqual(3);
      // An unavailable day keeps the disabled role colour, not a second layer of opacity.
      const unavailable = getComputedStyle(day(calendar, '2026-01-02'));
      expect(unavailable.opacity).toBe('1');
      expect(contrast(parseColor(unavailable.color), surface)).toBeGreaterThan(1.5);
    }
  });

  it('draws the selected day in Highlight colours in forced colours, and keeps a ring on focus', async () => {
    const calendar = await make('value="2026-01-20"');
    await emulateMedia({forcedColors: 'active'});
    await nextFrame();
    const selected = getComputedStyle(day(calendar, '2026-01-20'));
    expect(selected.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
    expect(selected.forcedColorAdjust).toBe('none');
    day(calendar, '2026-01-14').focus();
    await pressKeys('ArrowRight');
    expect(getComputedStyle(day(calendar, '2026-01-15')).outlineStyle).not.toBe('none');
  });

  it('draws no transform animation under reduced motion', async () => {
    const calendar = await make();
    await emulateMedia({reducedMotion: 'reduce'});
    await nextFrame();
    const style = getComputedStyle(day(calendar, '2026-01-10'));
    expect(style.transitionProperty).toBe('all');
    expect(parseFloat(style.transitionDuration)).toBe(0);
  });
});

// ------------------------------------------------------------------------ contrast arithmetic

interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

function parseColor(text: string): Rgba {
  const match = /rgba?\(([^)]+)\)/.exec(text) ?? /color\(srgb ([^)]+)\)/.exec(text);
  if (!match) throw new Error(`unreadable colour: ${text}`);
  const parts = match[1]!.split(/[\s,/]+/).filter(Boolean).map(Number);
  const scale = text.startsWith('color(') ? 255 : 1;
  return {r: parts[0]! * scale, g: parts[1]! * scale, b: parts[2]! * scale, a: parts[3] ?? 1};
}

function over(top: Rgba, bottom: Rgba): Rgba {
  const a = top.a + bottom.a * (1 - top.a);
  const mix = (t: number, b: number) => (t * top.a + b * bottom.a * (1 - top.a)) / (a || 1);
  return {r: mix(top.r, bottom.r), g: mix(top.g, bottom.g), b: mix(top.b, bottom.b), a};
}

function backgroundOf(element: HTMLElement): Rgba {
  return over(parseColor(getComputedStyle(element).backgroundColor), {r: 255, g: 255, b: 255, a: 1});
}

function luminance({r, g, b}: Rgba): number {
  const channel = (value: number): number => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(foreground: Rgba, background: Rgba): number {
  const composed = over(foreground, background);
  const [light, dark] = [luminance(composed), luminance(background)].sort((x, y) => y - x) as [number, number];
  return (light + 0.05) / (dark + 0.05);
}
