/**
 * tct-date-range-input: the element and form-control suites, rendering, opening, picking a range (mouse and
 * keyboard), presets, spans and constraints, clearing, and the surfaces (popover, bottom sheet). Validity,
 * languages and contrast live in `tct-date-range-input.states.test.ts`. Ported from upstream
 * DateRangeInput.test.tsx where the behaviour applies. Today is fixed by a faked clock.
 */
import {html} from 'lit';
import {userEvent} from 'vitest/browser';
import {afterEach, describe, expect, it} from 'vitest';
import {deepActiveElement} from '@tecton-wc/core/utils/focus.js';
import {axNode} from '@tecton-wc/testing/a11y.js';
import {recordEvents} from '@tecton-wc/testing/events.js';
import {pressKeys} from '@tecton-wc/testing/keyboard.js';
import {runElementSuite} from '@tecton-wc/testing/suites/element.js';
import {runFormControlSuite} from '@tecton-wc/testing/suites/form-control.js';
import {isChromium} from '@tecton-wc/testing/tier.js';
import {nextFrame, waitUntil} from '@tecton-wc/testing/timing.js';
import '../field/define.js';
import '../form-layout/define.js';
import '../tooltip/define.js';
import './define.js';
import {stubDeviceQueries} from '../date-input/picker-test-helpers.js';
import {
  calendar,
  clearButton,
  day,
  isShown,
  make,
  openByTrigger,
  pick,
  picker,
  presets,
  sheet,
  trigger,
  useFixedToday,
} from './date-range-input-test-helpers.js';
import type {DateRangePreset} from './date-range-input.types.js';
import type {TctDateRangeInput} from './tct-date-range-input.js';

useFixedToday();

let stub: ReturnType<typeof stubDeviceQueries> | undefined;
afterEach(() => {
  stub?.restore();
  stub = undefined;
});

const focusedDate = (): string | undefined =>
  (deepActiveElement() as HTMLElement | null)?.dataset.date;

runElementSuite({
  tag: 'tct-date-range-input',
  render: () => html`<tct-date-range-input label="Period" name="p"></tct-date-range-input>`,
  properties: {
    label: 'Other',
    description: 'Help',
    placeholder: 'Pick',
    min: '2026-01-01',
    max: '2026-12-31',
    maxRangeSpan: 14,
    minRangeSpan: 2,
    numberOfMonths: 1,
    weekStartsOn: 'mon',
    noClear: true,
    size: 'lg',
    loading: true,
    width: 200,
    presentation: 'popover',
  },
  attributes: {
    label: 'label',
    description: 'description',
    placeholder: 'placeholder',
    min: 'min',
    max: 'max',
    maxRangeSpan: 'max-range-span',
    minRangeSpan: 'min-range-span',
    numberOfMonths: 'number-of-months',
    weekStartsOn: 'week-starts-on',
    noClear: 'no-clear',
    presentation: 'presentation',
  },
  events: ['tct-open-change', 'tct-after-open-change', 'tct-clear'],
});

runFormControlSuite({
  tag: 'tct-date-range-input',
  render: (attributes) =>
    `<tct-date-range-input label="Field" ${attributes}></tct-date-range-input>`,
  validValue: '2026-03-01/2026-03-07',
  submitsOnEnter: false,
  readonly: true,
  labelActivation: 'focus',
  innerFocusable: (element) => element.shadowRoot!.querySelector<HTMLElement>('button.trigger'),
  userEdit: async (element) => {
    const button = element.shadowRoot!.querySelector<HTMLButtonElement>('button.trigger')!;
    await userEvent.click(button);
    const grid = element.shadowRoot!.querySelector('tct-calendar')!;
    await waitUntil(
      () => grid.shadowRoot!.querySelector('.day[data-date="2026-01-20"]') !== null,
      'calendar',
    );
    await userEvent.click(
      grid.shadowRoot!.querySelector('.day[data-date="2026-01-20"]:not([data-outside])')!,
    );
    await userEvent.click(
      grid.shadowRoot!.querySelector('.day[data-date="2026-01-23"]:not([data-outside])')!,
    );
  },
});

describe('tct-date-range-input: rendering and the value', () => {
  it('is a button trigger named by the label and the range, with a calendar icon and a placeholder', async () => {
    const field = await make('label="Reporting period"');
    expect(trigger(field).tagName).toBe('BUTTON');
    expect(trigger(field).textContent.trim()).toBe('Select date range');
    expect(trigger(field).getAttribute('aria-label')).toBe('Reporting period: Select date range');
    expect(trigger(field).getAttribute('aria-haspopup')).toBe('dialog');
    expect(trigger(field).getAttribute('aria-expanded')).toBe('false');
    expect(field.shadowRoot!.querySelector('tct-icon.toggle-icon')!.getAttribute('name')).toBe(
      'calendar',
    );
    expect(field.value).toBe('');
    expect(field.range).toBeNull();
    if (isChromium) {
      const node = await axNode(trigger(field));
      expect(node.role).toBe('button');
      expect(node.name).toBe('Reporting period: Select date range');
    }
  });

  it('shows the range short inside the current year and with the year outside it', async () => {
    const inside = await make('label="Period" value="2026-01-05/2026-01-09"');
    expect(trigger(inside).textContent.trim()).toBe('Jan 5 – Jan 9');
    expect(trigger(inside).getAttribute('aria-label')).toBe('Period: Jan 5 – Jan 9');
    const across = await make('label="Period" value="2025-12-28/2026-01-03"');
    expect(trigger(across).textContent.trim()).toBe('Dec 28, 2025 – Jan 3, 2026');
    const other = await make('label="Period" value="2027-02-01/2027-02-03"');
    expect(trigger(other).textContent.trim()).toBe('Feb 1, 2027 – Feb 3, 2027');
    expect(trigger(other).hasAttribute('data-placeholder')).toBe(false);
  });

  it('reads the value leniently: two real dates in an ISO interval, the earlier first, else nothing', async () => {
    const field = await make('label="Period"');
    field.value = '2026-03-07/2026-03-01';
    expect(field.value).toBe('2026-03-01/2026-03-07');
    expect(field.range).toEqual({start: '2026-03-01', end: '2026-03-07'});
    for (const junk of [
      '2026-03-01',
      '2026-03-01/',
      'soon/never',
      '2026-02-30/2026-03-01',
      '1/2/3',
    ]) {
      field.value = junk;
      expect(field.value, junk).toBe('');
    }
    field.range = {start: '2026-05-01', end: '2026-05-10'};
    expect(field.value).toBe('2026-05-01/2026-05-10');
    field.range = null;
    expect(field.value).toBe('');
  });

  it('a property or attribute write never fires input or change, and the display follows', async () => {
    const field = await make('label="Period"');
    const events = recordEvents(field, ['input', 'change', 'tct-open-change']);
    field.range = {start: '2026-01-05', end: '2026-01-09'};
    await field.updateComplete;
    expect(trigger(field).textContent.trim()).toBe('Jan 5 – Jan 9');
    field.setAttribute('value', '2026-01-06/2026-01-10');
    await field.updateComplete;
    expect(events.events).toHaveLength(0);
  });

  it('uses a placeholder of its own when given', async () => {
    const field = await make('label="Period" placeholder="Any time"');
    expect(trigger(field).textContent.trim()).toBe('Any time');
    expect(trigger(field).getAttribute('aria-label')).toBe('Period: Any time');
  });
});

describe('tct-date-range-input: the picker', () => {
  it('opens under the field from the trigger with two months and focus on the start of the range', async () => {
    const field = await make('label="Period" value="2026-01-19/2026-01-22"');
    const changes = recordEvents(field, ['tct-open-change', 'tct-after-open-change']);
    await openByTrigger(field);
    expect(changes.named('tct-open-change')[0]).toMatchObject({open: true, reason: 'trigger'});
    await waitUntil(() => changes.named('tct-after-open-change').length === 1, 'after-open-change');
    expect(field.hasAttribute('open')).toBe(true);
    expect(trigger(field).getAttribute('aria-expanded')).toBe('true');
    const surface = field.shadowRoot!.querySelector<HTMLElement>('.picker-surface')!;
    expect(surface.getAttribute('role')).toBe('dialog');
    expect(surface.getAttribute('aria-label')).toBe('Choose date range');
    expect(trigger(field).getAttribute('aria-controls')).toBe(surface.id);
    expect(calendar(field).shadowRoot!.querySelectorAll('[role="grid"]')).toHaveLength(2);
    await waitUntil(() => focusedDate() === '2026-01-19', 'focus on the start');
    const box = field.shadowRoot!.querySelector('.input-wrapper')!.getBoundingClientRect();
    const layer = surface.getBoundingClientRect();
    expect(layer.top).toBeGreaterThanOrEqual(box.bottom - 1);
    expect(Math.abs(layer.left - box.left)).toBeLessThan(2);
  });

  it('opens on today when there is no range, and shows one month when asked', async () => {
    const field = await make('label="Period" number-of-months="1"');
    await openByTrigger(field);
    expect(calendar(field).shadowRoot!.querySelectorAll('[role="grid"]')).toHaveLength(1);
    expect(calendar(field).shadowRoot!.querySelector('.month-year')!.textContent).toBe(
      'January 2026',
    );
    await waitUntil(() => focusedDate() === '2026-01-15', 'focus on today');
  });

  it('the first click picks the start, the second the end: input, change, close, focus back on the trigger', async () => {
    const field = await make('label="Period"');
    await openByTrigger(field);
    const events = recordEvents(field, ['input', 'change', 'tct-open-change']);
    await userEvent.click(day(field, '2026-01-20'));
    await nextFrame();
    expect(field.open).toBe(true);
    expect(field.value).toBe('');
    expect(events.events).toHaveLength(0);
    await userEvent.click(day(field, '2026-01-23'));
    await waitUntil(() => !field.open && !isShown(field), 'closed after the second pick');
    expect(field.value).toBe('2026-01-20/2026-01-23');
    expect(events.events.map((event) => event.type)).toEqual([
      'input',
      'change',
      'tct-open-change',
    ]);
    expect(events.events[2]).toMatchObject({open: false, reason: 'selection'});
    expect(trigger(field).textContent.trim()).toBe('Jan 20 – Jan 23');
    await waitUntil(() => deepActiveElement() === trigger(field), 'focus back on the trigger');
  });

  it('picking the end before the start puts the range in order', async () => {
    const field = await make('label="Period"');
    await openByTrigger(field);
    await pick(field, '2026-01-23', '2026-01-20');
    await waitUntil(() => !field.open, 'closed');
    expect(field.value).toBe('2026-01-20/2026-01-23');
  });

  it('picks with the keyboard: Enter on two days, and the Escape that cancels a pick comes before the one that closes', async () => {
    const field = await make('label="Period" value="2026-01-19/2026-01-22"');
    await openByTrigger(field);
    await waitUntil(() => focusedDate() === '2026-01-19', 'focus in the calendar');
    await pressKeys('ArrowDown', 'Enter');
    expect(focusedDate()).toBe('2026-01-26');
    // A pick is in progress: Escape drops it and keeps the picker open.
    await pressKeys('Escape');
    await nextFrame();
    expect(field.open).toBe(true);
    await pressKeys('Escape');
    await waitUntil(() => !field.open && !isShown(field), 'closed by the second Escape');
    expect(field.value).toBe('2026-01-19/2026-01-22');
    await openByTrigger(field);
    await waitUntil(
      () => focusedDate() === '2026-01-19',
      `focus on the start again (${focusedDate()} ${(deepActiveElement() as HTMLElement | null)?.className})`,
    );
    await pressKeys('ArrowRight', 'Enter', 'ArrowRight', 'ArrowRight', 'Enter');
    await waitUntil(() => !field.open, 'closed after the keyboard range');
    expect(field.value).toBe('2026-01-20/2026-01-22');
  });

  it('a second click on the trigger closes it, and an outside press closes it', async () => {
    const field = await make('label="Period"');
    await openByTrigger(field);
    await userEvent.click(trigger(field));
    await waitUntil(() => !field.open && !isShown(field), 'closed by the trigger');
    await openByTrigger(field);
    await userEvent.click(document.body, {position: {x: 2, y: 2}});
    await waitUntil(() => !field.open && !isShown(field), 'closed by the outside press');
  });

  it('honours a cancelled tct-open-change, and open writes never fire it', async () => {
    const field = await make('label="Period"');
    field.addEventListener('tct-open-change', (event) => event.preventDefault(), {once: true});
    await userEvent.click(trigger(field));
    await nextFrame();
    expect(field.open).toBe(false);
    const changes = recordEvents(field, 'tct-open-change');
    await field.show();
    expect(field.open).toBe(true);
    await field.hide();
    expect(changes.events).toHaveLength(0);
  });

  it('the calendar inside does not leak its own events out of the field', async () => {
    const field = await make('label="Period"');
    await openByTrigger(field);
    const leaks = recordEvents(field, ['tct-value-change']);
    const events = recordEvents(field, ['input', 'change']);
    await pick(field, '2026-01-20', '2026-01-21');
    await waitUntil(() => !field.open, 'closed');
    expect(leaks.events).toHaveLength(0);
    expect(events.counts()).toEqual({input: 1, change: 1});
  });

  it('does not open a disabled, read-only or busy field', async () => {
    for (const attributes of ['disabled', 'readonly', 'loading']) {
      const field = await make(`label="Period" ${attributes}`);
      await userEvent.click(trigger(field), {force: true});
      await nextFrame();
      expect(field.open, attributes).toBe(false);
    }
  });

  it('a disabled field with a disabled-message stays focusable and explains itself', async () => {
    const field = await make('label="Period" disabled disabled-message="Locked by admin"');
    expect(trigger(field).disabled).toBe(false);
    expect(trigger(field).getAttribute('aria-disabled')).toBe('true');
    trigger(field).focus();
    expect(deepActiveElement()).toBe(trigger(field));
    await pressKeys('Enter');
    await nextFrame();
    expect(field.open).toBe(false);
  });
});

describe('tct-date-range-input: presets', () => {
  const PRESETS: DateRangePreset[] = [
    {label: 'This week', getRange: () => ({start: '2026-01-11', end: '2026-01-17'})},
    {label: 'Last 3 days', getRange: () => ({start: '2026-01-13', end: '2026-01-15'})},
    {label: 'Next month', getRange: () => ({start: '2026-02-01', end: '2026-02-28'})},
  ];

  async function withPresets(attributes = 'label="Period"'): Promise<TctDateRangeInput> {
    const field = await make(attributes);
    field.presets = PRESETS;
    await field.updateComplete;
    return field;
  }

  it('renders a labelled group of buttons beside the calendar, in order', async () => {
    const field = await withPresets();
    await openByTrigger(field);
    const group = field.shadowRoot!.querySelector('[role="group"]')!;
    expect(group.getAttribute('aria-label')).toBe('Preset date ranges');
    expect(presets(field).map((button) => button.textContent.trim())).toEqual([
      'This week',
      'Last 3 days',
      'Next month',
    ]);
    const box = group.getBoundingClientRect();
    const grid = calendar(field).getBoundingClientRect();
    expect(box.right).toBeLessThanOrEqual(grid.left + 1);
  });

  it('a preset applies its range, closes the picker and fires input and change once', async () => {
    const field = await withPresets();
    await openByTrigger(field);
    const events = recordEvents(field, ['input', 'change', 'tct-open-change']);
    await userEvent.click(presets(field)[1]!);
    await waitUntil(() => !field.open && !isShown(field), 'closed');
    expect(field.value).toBe('2026-01-13/2026-01-15');
    expect(events.events.map((event) => event.type)).toEqual([
      'input',
      'change',
      'tct-open-change',
    ]);
    expect(trigger(field).textContent.trim()).toBe('Jan 13 – Jan 15');
  });

  it('marks the preset that matches the value with aria-current, and only that one', async () => {
    const field = await withPresets('label="Period" value="2026-01-11/2026-01-17"');
    await openByTrigger(field);
    expect(presets(field).map((button) => button.getAttribute('aria-current'))).toEqual([
      'true',
      null,
      null,
    ]);
    // A preset is a button, not an option: it carries no selected state.
    expect(presets(field).every((button) => !button.hasAttribute('aria-selected'))).toBe(true);
  });

  it('disables a preset outside min, max or dateConstraints, or breaking a span, and keeps it visible', async () => {
    const field = await withPresets('label="Period" min="2026-01-12" max="2026-01-31"');
    await openByTrigger(field);
    // "This week" starts before min, "Next month" ends after max; "Last 3 days" fits.
    expect(presets(field).map((button) => button.disabled)).toEqual([true, false, true]);
    await field.hide();
    field.min = undefined;
    field.max = undefined;
    field.maxRangeSpan = 5;
    await field.updateComplete;
    await openByTrigger(field);
    expect(presets(field).map((button) => button.disabled)).toEqual([true, false, true]);
    await field.hide();
    field.maxRangeSpan = undefined;
    field.minRangeSpan = 4;
    await field.updateComplete;
    await openByTrigger(field);
    expect(presets(field).map((button) => button.disabled)).toEqual([false, true, false]);
    await field.hide();
    field.minRangeSpan = undefined;
    field.dateConstraints = [(date) => date.getDay() !== 0];
    await field.updateComplete;
    await openByTrigger(field);
    // 2026-01-11 and 2026-02-01 are Sundays.
    expect(presets(field).map((button) => button.disabled)).toEqual([true, false, true]);
    await userEvent.click(presets(field)[0]!, {force: true});
    await nextFrame();
    expect(field.value).toBe('');
    expect(field.open).toBe(true);
  });

  it('the presets are tab stops of the picker, in order', async () => {
    const field = await withPresets();
    await openByTrigger(field);
    presets(field)[0]!.focus();
    await pressKeys('Tab');
    expect(deepActiveElement()).toBe(presets(field)[1]);
    await pressKeys('Tab');
    expect(deepActiveElement()).toBe(presets(field)[2]);
  });
});

describe('tct-date-range-input: spans and constraints in the calendar', () => {
  it('max-range-span disables the days that would stretch the range past it, once the start is picked', async () => {
    const field = await make('label="Period" max-range-span="7"');
    await openByTrigger(field);
    await userEvent.click(day(field, '2026-01-10'));
    // 10..16 is 7 days: the 17th is too far, the 16th is fine.
    expect(day(field, '2026-01-16').getAttribute('aria-disabled')).not.toBe('true');
    expect(day(field, '2026-01-17').getAttribute('aria-disabled')).toBe('true');
    await userEvent.click(day(field, '2026-01-17'), {force: true});
    await nextFrame();
    expect(field.open).toBe(true);
    expect(field.value).toBe('');
  });

  it('min-range-span forbids a one-day range but keeps the start selectable', async () => {
    const field = await make('label="Period" min-range-span="3"');
    await openByTrigger(field);
    await userEvent.click(day(field, '2026-01-10'));
    expect(day(field, '2026-01-11').getAttribute('aria-disabled')).toBe('true');
    // 10..12 is three days, both endpoints counted.
    expect(day(field, '2026-01-12').getAttribute('aria-disabled')).not.toBe('true');
    expect(day(field, '2026-01-10').getAttribute('aria-disabled')).not.toBe('true');
  });

  it('never rewrites a value that is already outside the span', async () => {
    const field = await make('label="Period" max-range-span="3" value="2026-01-01/2026-01-20"');
    expect(field.value).toBe('2026-01-01/2026-01-20');
    expect(field.validity.valid).toBe(true);
  });

  it('min, max and dateConstraints make days unavailable', async () => {
    const field = await make('label="Period" min="2026-01-10" max="2026-01-25"');
    field.dateConstraints = [(date) => date.getDay() !== 6];
    await field.updateComplete;
    await openByTrigger(field);
    expect(day(field, '2026-01-09').getAttribute('aria-disabled')).toBe('true');
    expect(day(field, '2026-01-26').getAttribute('aria-disabled')).toBe('true');
    expect(day(field, '2026-01-17').getAttribute('aria-disabled')).toBe('true');
    expect(day(field, '2026-01-16').getAttribute('aria-disabled')).not.toBe('true');
  });
});

describe('tct-date-range-input: clearing, the change action and busy', () => {
  it('shows the clear button while there is a range; clearing fires tct-clear, input and change and focuses the trigger', async () => {
    const field = await make('label="Period" value="2026-01-05/2026-01-09"');
    expect(clearButton(field)).not.toBeNull();
    expect(clearButton(field)!.getAttribute('label')).toBe('Clear Period');
    const events = recordEvents(field, ['input', 'change', 'tct-clear']);
    await userEvent.click(clearButton(field)!);
    await field.updateComplete;
    expect(field.value).toBe('');
    expect(events.events.map((event) => event.type)).toEqual(['tct-clear', 'input', 'change']);
    expect(clearButton(field)).toBeNull();
    expect(field.open).toBe(false);
    await waitUntil(() => deepActiveElement() === trigger(field), 'focus on the trigger');
  });

  it('keeps the range when tct-clear is prevented, and no-clear removes the button', async () => {
    const field = await make('label="Period" value="2026-01-05/2026-01-09"');
    field.addEventListener('tct-clear', (event) => event.preventDefault());
    await userEvent.click(clearButton(field)!);
    expect(field.value).toBe('2026-01-05/2026-01-09');
    const plain = await make('label="Period" value="2026-01-05/2026-01-09" no-clear');
    expect(clearButton(plain)).toBeNull();
  });

  it('runs changeAction after a pick; busy until it settles, refusing the picker meanwhile', async () => {
    const field = await make('label="Period"');
    let release!: () => void;
    const calls: string[] = [];
    field.changeAction = (value) => {
      calls.push(value);
      return new Promise<void>((resolve) => {
        release = resolve;
      });
    };
    await openByTrigger(field);
    await pick(field, '2026-01-20', '2026-01-21');
    await waitUntil(() => !field.open, 'closed');
    expect(calls).toEqual(['2026-01-20/2026-01-21']);
    expect(field.matches(':state(busy)')).toBe(true);
    expect(trigger(field).getAttribute('aria-busy')).toBe('true');
    await userEvent.click(trigger(field), {force: true});
    await nextFrame();
    expect(field.open).toBe(false);
    release();
    await waitUntil(() => !field.matches(':state(busy)'), 'idle again');
    expect(trigger(field).hasAttribute('aria-busy')).toBe(false);
  });
});

describe('tct-date-range-input: the surfaces', () => {
  it('is a bottom sheet with one month on a compact touch device, and the popover elsewhere', async () => {
    stub = stubDeviceQueries({compactTouch: true});
    const field = await make('label="Period" value="2026-01-19/2026-01-22"');
    await waitUntil(() => sheet(field) !== null, 'sheet rendered');
    expect(picker(field)).toBeNull();
    await userEvent.click(trigger(field));
    await waitUntil(() => field.open, 'open');
    await waitUntil(() => day(field, '2026-01-20').offsetParent !== null, 'calendar painted');
    expect(calendar(field).shadowRoot!.querySelectorAll('[role="grid"]')).toHaveLength(1);
    expect(calendar(field).closest('tct-bottom-sheet')).toBe(sheet(field));
    const events = recordEvents(field, ['input', 'change', 'tct-open-change']);
    await pick(field, '2026-01-26', '2026-01-28');
    await waitUntil(() => !field.open, 'closed by the pick');
    expect(field.value).toBe('2026-01-26/2026-01-28');
    expect(events.events.map((event) => event.type)).toEqual([
      'input',
      'change',
      'tct-open-change',
    ]);
  });

  it('presentation="popover" keeps the popover on a touch device; native is not a range surface and falls back', async () => {
    stub = stubDeviceQueries({compactTouch: true, coarsePointer: true});
    const fixed = await make('label="Period" presentation="popover"');
    expect(picker(fixed)).not.toBeNull();
    expect(sheet(fixed)).toBeNull();
    const native = await make('label="Period" presentation="native"');
    await waitUntil(() => sheet(native) !== null, 'sheet rendered');
    expect(native.shadowRoot!.querySelector('input')).toBeNull();
    const fixedSheet = await make('label="Period" presentation="bottom-sheet"');
    stub.set({compactTouch: false, coarsePointer: false});
    await waitUntil(() => sheet(fixedSheet) !== null, 'sheet rendered');
  });
});
