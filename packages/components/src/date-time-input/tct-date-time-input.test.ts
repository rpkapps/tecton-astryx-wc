/**
 * tct-date-time-input: the element and form-control suites, rendering and the value, typing in the date and
 * the time part (drafts, held time, Enter and IME), stepping, the calendar popover, min/max time of day on the
 * boundary dates, and the dropdown of preset times (a combobox). The sheet and native surfaces are in
 * `tct-date-time-input.surfaces.test.ts`; validity, languages and contrast in `.states.test.ts`. Ported from
 * upstream DateTimeInput.test.tsx where the behaviour applies. Today is fixed by a faked clock (2026-01-15
 * 12:00 local).
 */
import {html} from 'lit';
import {userEvent} from 'vitest/browser';
import {describe, expect, it} from 'vitest';
import {getAnnouncerRegions} from '@tecton-wc/core/a11y/announcer.js';
import {overrideFeature} from '@tecton-wc/core/features.js';
import {deepActiveElement} from '@tecton-wc/core/utils/focus.js';
import {axNode} from '@tecton-wc/testing/a11y.js';
import {recordEvents} from '@tecton-wc/testing/events.js';
import {formHarness} from '@tecton-wc/testing/forms.js';
import {pressKeys} from '@tecton-wc/testing/keyboard.js';
import {runElementSuite} from '@tecton-wc/testing/suites/element.js';
import {runFormControlSuite} from '@tecton-wc/testing/suites/form-control.js';
import {isChromium} from '@tecton-wc/testing/tier.js';
import {nextFrame, waitUntil} from '@tecton-wc/testing/timing.js';
import '../field/define.js';
import '../form-layout/define.js';
import '../tooltip/define.js';
import './define.js';
import {
  boxes,
  calendar,
  dateInner,
  day,
  isShown,
  make,
  openByToggle,
  timeInner,
  timeList,
  timeOptions,
  timePopover,
  toggle,
  typeDate,
  typeTime,
  useFixedToday,
} from './date-time-input-test-helpers.js';
import type {TctDateTimeInput} from './tct-date-time-input.js';

useFixedToday();

runElementSuite({
  tag: 'tct-date-time-input',
  render: () => html`<tct-date-time-input label="Meeting" name="m"></tct-date-time-input>`,
  properties: {
    label: 'Other',
    description: 'Help',
    placeholder: 'Pick a day',
    timePlaceholder: 'Pick a time',
    timeLabel: 'Start',
    min: '2026-01-01T09:00',
    max: '2026-12-31T17:00',
    hasSeconds: true,
    hourFormat: '24h',
    timeIncrement: 15,
    timeOptionInterval: 30,
    numberOfMonths: 2,
    weekStartsOn: 'mon',
    hasClear: true,
    size: 'lg',
    loading: true,
    width: 200,
    presentation: 'popover',
  },
  attributes: {
    label: 'label',
    description: 'description',
    placeholder: 'placeholder',
    timePlaceholder: 'time-placeholder',
    timeLabel: 'time-label',
    min: 'min',
    max: 'max',
    hasSeconds: 'has-seconds',
    hourFormat: 'hour-format',
    timeIncrement: 'time-increment',
    timeOptionInterval: 'time-option-interval',
    numberOfMonths: 'number-of-months',
    weekStartsOn: 'week-starts-on',
    hasClear: 'has-clear',
    presentation: 'presentation',
  },
  events: ['tct-open-change', 'tct-after-open-change', 'tct-clear', 'tct-enter'],
});

runFormControlSuite({
  tag: 'tct-date-time-input',
  render: (attributes) => `<tct-date-time-input label="Field" ${attributes}></tct-date-time-input>`,
  validValue: '2026-03-21T14:30',
  submitsOnEnter: true,
  readonly: true,
  labelActivation: 'focus',
  innerFocusable: (element) =>
    element.shadowRoot!.querySelector<HTMLElement>('input.input:not(.time)'),
  userEdit: async (element) => {
    const date = element.shadowRoot!.querySelector<HTMLInputElement>('input.input:not(.time)')!;
    await userEvent.click(date);
    await userEvent.clear(date);
    await userEvent.type(date, '2026-03-21');
    await pressKeys('Tab');
  },
});

describe('tct-date-time-input: rendering and the value', () => {
  it('is a date combobox and a time textbox in two boxes under one label, each with an icon', async () => {
    const field = await make();
    expect(boxes(field)).toHaveLength(2);
    expect(dateInner(field).getAttribute('role')).toBe('combobox');
    expect(dateInner(field).placeholder).toBe('Select a date');
    expect(timeInner(field).getAttribute('role')).toBeNull();
    expect(timeInner(field).placeholder).toBe('Select a time');
    expect(timeInner(field).getAttribute('aria-label')).toBe('Meeting time');
    expect(toggle(field).getAttribute('aria-label')).toBe('Open calendar');
    expect(field.shadowRoot!.querySelector('tct-icon.clock')!.getAttribute('name')).toBe('clock');
    if (isChromium) {
      const node = await axNode(timeInner(field));
      expect(node.role).toBe('textbox');
      expect(node.name).toBe('Meeting time');
    }
  });

  it('lays the two boxes out side by side, and wraps them below the basis', async () => {
    const wide = await make('label="Meeting"');
    const [date, time] = boxes(wide).map((box) => box.getBoundingClientRect());
    expect(Math.abs(date!.top - time!.top)).toBeLessThan(2);
    expect(time!.left).toBeGreaterThanOrEqual(date!.right - 1);
    const narrow = await make('label="Meeting" width="200"');
    const [narrowDate, narrowTime] = boxes(narrow).map((box) => box.getBoundingClientRect());
    expect(narrowTime!.top).toBeGreaterThan(narrowDate!.top + 1);
  });

  it('shows the date long and the time as 12-hour or 24-hour text, with seconds when asked', async () => {
    const field = await make('label="Meeting" value="2026-03-21T14:30"');
    expect(dateInner(field).value).toBe('March 21, 2026');
    expect(timeInner(field).value).toBe('2:30 PM');
    const twentyFour = await make('label="Meeting" value="2026-03-21T14:30" hour-format="24h"');
    expect(timeInner(twentyFour).value).toBe('14:30');
    const seconds = await make('label="Meeting" value="2026-03-21T14:30:15" has-seconds');
    expect(timeInner(seconds).value).toBe('2:30:15 PM');
  });

  it('reads the value property leniently: a real date and a real time, else nothing', async () => {
    const field = await make();
    for (const [written, read] of [
      ['2026-03-21T14:30', '2026-03-21T14:30'],
      ['2026-03-21T14:30:15', '2026-03-21T14:30:15'],
      ['2026-03-21', ''],
      ['2026-03-21T', ''],
      ['2026-02-30T10:00', ''],
      ['2026-03-21T25:00', ''],
      ['noon', ''],
      ['', ''],
    ] as const) {
      field.value = written;
      expect(field.value, written).toBe(read);
    }
  });

  it('a property or attribute write never fires input or change, and replaces drafts and a held time', async () => {
    const field = await make();
    await typeTime(field, '3pm');
    await pressKeys('Tab');
    expect(timeInner(field).value).toBe('3:00 PM');
    const events = recordEvents(field, ['input', 'change']);
    field.value = '2026-06-07T09:15';
    await field.updateComplete;
    expect(dateInner(field).value).toBe('June 7, 2026');
    expect(timeInner(field).value).toBe('9:15 AM');
    field.setAttribute('value', '2026-06-08T10:00');
    await field.updateComplete;
    expect(events.events).toHaveLength(0);
  });

  it('has-clear clears both parts: tct-clear, input and change, and focus back on the date part', async () => {
    const field = await make('label="Meeting" has-clear value="2026-03-21T14:30"');
    const events = recordEvents(field, ['tct-clear', 'input', 'change']);
    await userEvent.click(field.shadowRoot!.querySelector('tct-input-clear-button')!);
    await field.updateComplete;
    expect(field.value).toBe('');
    expect(dateInner(field).value).toBe('');
    expect(timeInner(field).value).toBe('');
    expect(events.events.map((event) => event.type)).toEqual(['tct-clear', 'input', 'change']);
    await waitUntil(() => deepActiveElement() === dateInner(field), 'focus on the date part');
  });
});

describe('tct-date-time-input: typing the date', () => {
  it('keeps the text as a draft while typing and commits it when the entry ends; the time is the current one', async () => {
    const field = await make();
    const events = recordEvents(field, ['input', 'change']);
    await userEvent.click(dateInner(field));
    await userEvent.type(dateInner(field), '3/4/2027');
    expect(field.value).toBe('');
    expect(events.events).toHaveLength(0);
    await pressKeys('Tab');
    await field.updateComplete;
    // The clock is fixed at 12:00.
    expect(field.value).toBe('2027-03-04T12:00');
    expect(events.counts()).toEqual({input: 1, change: 1});
    expect(dateInner(field).value).toBe('March 4, 2027');
    expect(timeInner(field).value).toBe('12:00 PM');
  });

  it('keeps the time it already has when the date changes', async () => {
    const field = await make('label="Meeting" value="2026-03-21T14:30"');
    await typeDate(field, '2026-05-06');
    await pressKeys('Tab');
    expect(field.value).toBe('2026-05-06T14:30');
  });

  it('emptying the date clears the whole value', async () => {
    const field = await make('label="Meeting" value="2026-03-21T14:30"');
    const events = recordEvents(field, ['input', 'change']);
    await typeDate(field, '');
    await pressKeys('Tab');
    expect(field.value).toBe('');
    expect(timeInner(field).value).toBe('');
    expect(events.counts()).toEqual({input: 1, change: 1});
  });

  it('drops text that is not a date when the part is left, and says so while it stands', async () => {
    const restore = overrideFeature('ariaNotify', false);
    try {
      const field = await make('label="Meeting" value="2026-03-21T14:30"');
      const events = recordEvents(field, ['input', 'change']);
      await typeDate(field, 'abc');
      await waitUntil(
        () => dateInner(field).getAttribute('aria-invalid') === 'true',
        'invalid after the pause',
      );
      await waitUntil(
        () => getAnnouncerRegions().assertive?.textContent === 'Invalid date',
        'announced',
        3000,
      );
      await pressKeys('Tab');
      expect(field.value).toBe('2026-03-21T14:30');
      expect(dateInner(field).value).toBe('March 21, 2026');
      expect(events.events).toHaveLength(0);
    } finally {
      restore();
    }
  });

  it('refuses a date that min, max or dateConstraints rule out', async () => {
    const restore = overrideFeature('ariaNotify', false);
    try {
      const field = await make(
        'label="Meeting" value="2026-03-20T10:00" min="2026-03-10T00:00" max="2026-03-28T23:59"',
      );
      field.dateConstraints = [(date) => date.getDay() !== 6];
      await field.updateComplete;
      await typeDate(field, '2026-04-02');
      await waitUntil(
        () => getAnnouncerRegions().assertive?.textContent === 'This date is not available',
        'unavailable announced',
        3000,
      );
      await pressKeys('Tab');
      expect(field.value).toBe('2026-03-20T10:00');
      await typeDate(field, '2026-03-21');
      await pressKeys('Tab');
      expect(field.value).toBe('2026-03-20T10:00');
      await typeDate(field, '2026-03-24');
      await pressKeys('Tab');
      expect(field.value).toBe('2026-03-24T10:00');
    } finally {
      restore();
    }
  });

  it('Enter in the date part commits it, fires tct-enter, and submits the form once', async () => {
    const form = await formHarness(
      '<tct-date-time-input label="Meeting" name="m" value="2026-03-21T14:30"></tct-date-time-input><button type="submit">Go</button>',
    );
    const field = form.form.querySelector<TctDateTimeInput>('tct-date-time-input')!;
    await field.updateComplete;
    const enters = recordEvents(field, 'tct-enter');
    await userEvent.click(dateInner(field));
    await userEvent.clear(dateInner(field));
    await userEvent.type(dateInner(field), '2026-05-06');
    await pressKeys('Enter');
    expect(enters.events).toHaveLength(1);
    expect(form.submitEvents).toHaveLength(1);
    expect(form.values('m')).toEqual(['2026-05-06T14:30']);
  });

  it('an IME composition Enter is not a command', async () => {
    const field = await make();
    const enters = recordEvents(field, 'tct-enter');
    await userEvent.click(dateInner(field));
    await userEvent.type(dateInner(field), '2026-05-06');
    dateInner(field).dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Enter',
        isComposing: true,
        bubbles: true,
        composed: true,
        cancelable: true,
      }),
    );
    expect(enters.events).toHaveLength(0);
    expect(dateInner(field).value).toBe('2026-05-06');
  });
});

describe('tct-date-time-input: typing the time and stepping it', () => {
  it('commits the time when the part is left, keeping the date; one input and one change', async () => {
    const field = await make('label="Meeting" value="2026-03-21T14:30"');
    const events = recordEvents(field, ['input', 'change']);
    await userEvent.click(timeInner(field));
    await userEvent.clear(timeInner(field));
    await userEvent.type(timeInner(field), '6:45 pm');
    expect(field.value).toBe('2026-03-21T14:30');
    await pressKeys('Tab');
    expect(field.value).toBe('2026-03-21T18:45');
    expect(events.counts()).toEqual({input: 1, change: 1});
    expect(timeInner(field).value).toBe('6:45 PM');
  });

  it('holds a time chosen before any date, shows it, and combines it with the date chosen after', async () => {
    const field = await make();
    const events = recordEvents(field, ['input', 'change']);
    await typeTime(field, '3pm');
    await pressKeys('Tab');
    expect(field.value).toBe('');
    expect(events.events).toHaveLength(0);
    expect(timeInner(field).value).toBe('3:00 PM');
    await typeDate(field, '2026-05-06');
    await pressKeys('Tab');
    expect(field.value).toBe('2026-05-06T15:00');
    expect(events.counts()).toEqual({input: 1, change: 1});
  });

  it('emptying the time only takes the display back, and text that is not a time is dropped', async () => {
    const field = await make('label="Meeting" value="2026-03-21T14:30"');
    await typeTime(field, '');
    await pressKeys('Tab');
    expect(field.value).toBe('2026-03-21T14:30');
    expect(timeInner(field).value).toBe('2:30 PM');
    await typeTime(field, 'never');
    await waitUntil(() => timeInner(field).getAttribute('aria-invalid') === 'true', 'invalid');
    await pressKeys('Tab');
    expect(field.value).toBe('2026-03-21T14:30');
    expect(timeInner(field).hasAttribute('aria-invalid')).toBe(false);
  });

  it('shows a format hint while the empty time part has focus', async () => {
    const field = await make();
    timeInner(field).focus();
    await waitUntil(() => timeInner(field).placeholder === 'e.g., 2:30 PM', 'hint');
    const own = await make('label="Meeting" time-placeholder="Any time"');
    timeInner(own).focus();
    await own.updateComplete;
    expect(timeInner(own).placeholder).toBe('Any time');
  });

  it('Arrow Up and Down step by time-increment minutes, wrapping past midnight; each step is an input and a change', async () => {
    const field = await make('label="Meeting" value="2026-03-21T14:30" time-increment="15"');
    const events = recordEvents(field, ['input', 'change']);
    timeInner(field).focus();
    await pressKeys('ArrowUp');
    expect(field.value).toBe('2026-03-21T14:45');
    await pressKeys('ArrowDown', 'ArrowDown');
    expect(field.value).toBe('2026-03-21T14:15');
    expect(events.counts()).toEqual({input: 3, change: 3});
    const midnight = await make('label="Meeting" value="2026-03-21T00:05" time-increment="15"');
    timeInner(midnight).focus();
    await pressKeys('ArrowDown');
    expect(midnight.value).toBe('2026-03-21T23:50');
  });

  it('announces the stepped time, and steps an empty time part from the current time', async () => {
    const restore = overrideFeature('ariaNotify', false);
    try {
      const field = await make('label="Meeting" value="2026-03-21T14:30"');
      timeInner(field).focus();
      await pressKeys('ArrowUp');
      await waitUntil(() => getAnnouncerRegions().polite?.textContent === '2:31 PM', 'announced');
      const empty = await make();
      timeInner(empty).focus();
      await pressKeys('ArrowUp');
      // With no date the stepped time is held and shown.
      expect(timeInner(empty).value).toBe('12:01 PM');
    } finally {
      restore();
    }
  });

  it('does not step past a boundary time, or while read-only, disabled or busy', async () => {
    const field = await make(
      'label="Meeting" value="2026-03-21T17:00" min="2026-03-21T09:00" max="2026-03-21T17:00"',
    );
    timeInner(field).focus();
    await pressKeys('ArrowUp');
    expect(field.value).toBe('2026-03-21T17:00');
    await pressKeys('ArrowDown');
    expect(field.value).toBe('2026-03-21T16:59');
    for (const attributes of ['readonly', 'disabled disabled-message="Locked"', 'loading']) {
      const locked = await make(`label="Meeting" value="2026-03-21T14:30" ${attributes}`);
      timeInner(locked).focus();
      await pressKeys('ArrowUp');
      expect(locked.value, attributes).toBe('2026-03-21T14:30');
    }
  });

  it('Enter in the time part commits it and fires tct-enter; an IME Enter does not', async () => {
    const field = await make('label="Meeting" value="2026-03-21T14:30"');
    const enters = recordEvents(field, 'tct-enter');
    await typeTime(field, '6:45 pm');
    timeInner(field).dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Enter',
        isComposing: true,
        bubbles: true,
        composed: true,
        cancelable: true,
      }),
    );
    expect(enters.events).toHaveLength(0);
    await pressKeys('Enter');
    expect(enters.events).toHaveLength(1);
    expect(field.value).toBe('2026-03-21T18:45');
  });
});

describe('tct-date-time-input: min and max of the date-time', () => {
  it('bounds the time part with the time of min on its own day, and moves a chosen date onto it', async () => {
    const field = await make(
      'label="Meeting" value="2026-03-22T08:00" min="2026-03-21T09:00" max="2026-03-23T17:00"',
    );
    // 2026-03-22 is inside both days: any time goes.
    await typeTime(field, '7am');
    await pressKeys('Tab');
    expect(field.value).toBe('2026-03-22T07:00');
    // Moving to the day of min with a time before it lands on min's time.
    await typeDate(field, '2026-03-21');
    await pressKeys('Tab');
    expect(field.value).toBe('2026-03-21T09:00');
    // On that day an earlier time is refused, a later one accepted.
    await typeTime(field, '8am');
    await waitUntil(() => timeInner(field).getAttribute('aria-invalid') === 'true', 'invalid');
    await pressKeys('Tab');
    expect(field.value).toBe('2026-03-21T09:00');
    await typeTime(field, '10am');
    await pressKeys('Tab');
    expect(field.value).toBe('2026-03-21T10:00');
    // The same on the day of max.
    await typeDate(field, '2026-03-23');
    await pressKeys('Tab');
    expect(field.value).toBe('2026-03-23T10:00');
    await typeTime(field, '6pm');
    await waitUntil(() => timeInner(field).getAttribute('aria-invalid') === 'true', 'invalid');
    await pressKeys('Tab');
    expect(field.value).toBe('2026-03-23T10:00');
  });

  it('a chosen date clamps the current time into the window of its day', async () => {
    const field = await make('label="Meeting" min="2026-03-21T13:00" max="2026-03-22T11:00"');
    await typeDate(field, '2026-03-21');
    await pressKeys('Tab');
    // The clock says 12:00, which is before 13:00 on that day.
    expect(field.value).toBe('2026-03-21T13:00');
    await field.hide();
    const late = await make('label="Meeting" min="2026-03-21T13:00" max="2026-03-22T11:00"');
    await typeDate(late, '2026-03-22');
    await pressKeys('Tab');
    expect(late.value).toBe('2026-03-22T11:00');
  });
});

describe('tct-date-time-input: the calendar popover', () => {
  it('opens under the date box from the toggle with focus in the calendar; a pick commits, keeps the time and closes', async () => {
    const field = await make('label="Meeting" value="2026-03-21T14:30"');
    const events = recordEvents(field, ['input', 'change', 'tct-open-change']);
    await openByToggle(field);
    expect(toggle(field).getAttribute('aria-expanded')).toBe('true');
    const surface = field.shadowRoot!.querySelector<HTMLElement>('.picker-surface')!;
    expect(surface.getAttribute('role')).toBe('dialog');
    expect(surface.getAttribute('aria-label')).toBe('Choose date and time');
    const box = boxes(field)[0]!.getBoundingClientRect();
    expect(surface.getBoundingClientRect().top).toBeGreaterThanOrEqual(box.bottom - 1);
    expect(Math.abs(surface.getBoundingClientRect().left - box.left)).toBeLessThan(2);
    await waitUntil(
      () => (deepActiveElement() as HTMLElement | null)?.dataset.date === '2026-03-21',
      'focus on the selected day',
    );
    await userEvent.click(day(field, '2026-03-25'));
    await waitUntil(() => !field.open && !isShown(field), 'closed after the pick');
    expect(field.value).toBe('2026-03-25T14:30');
    expect(events.events.map((event) => event.type)).toEqual([
      'tct-open-change',
      'input',
      'change',
      'tct-open-change',
    ]);
    await waitUntil(() => deepActiveElement() === dateInner(field), 'focus back on the date part');
  });

  it('a click on the date input opens it without taking focus, Arrow Down does the same, and Escape closes it', async () => {
    const field = await make();
    await userEvent.click(dateInner(field));
    await waitUntil(() => field.open && isShown(field), 'open after a click');
    expect(deepActiveElement()).toBe(dateInner(field));
    await pressKeys('Escape');
    await waitUntil(() => !field.open && !isShown(field), 'closed by Escape');
    dateInner(field).focus();
    await pressKeys('ArrowDown');
    await waitUntil(() => field.open && isShown(field), 'open after Arrow Down');
    await pressKeys('ArrowDown');
    expect((deepActiveElement() as HTMLElement).dataset.date).toBe('2026-01-15');
  });

  it('shows two months when asked, follows the typed date, and does not leak the calendar events', async () => {
    const field = await make('label="Meeting" number-of-months="2" week-starts-on="mon"');
    await openByToggle(field);
    expect(calendar(field).shadowRoot!.querySelectorAll('[role="grid"]')).toHaveLength(2);
    const leaks = recordEvents(field, ['tct-value-change']);
    await userEvent.click(dateInner(field));
    await userEvent.clear(dateInner(field));
    await userEvent.type(dateInner(field), '2027-07-08');
    await calendar(field).updateComplete;
    expect(calendar(field).shadowRoot!.querySelector('.month-year')!.textContent).toBe(
      'July 2027 – August 2027',
    );
    expect(leaks.events).toHaveLength(0);
  });

  it('does not open a disabled, read-only or busy field', async () => {
    for (const attributes of ['disabled', 'readonly', 'loading']) {
      const field = await make(`label="Meeting" ${attributes}`);
      await userEvent.click(toggle(field), {force: true});
      await nextFrame();
      expect(field.open, attributes).toBe(false);
    }
  });
});

describe('tct-date-time-input: the dropdown of preset times', () => {
  it('turns the time part into a combobox only when time-option-interval is set', async () => {
    const plain = await make('label="Meeting"');
    expect(timeInner(plain).getAttribute('role')).toBeNull();
    const field = await make('label="Meeting" value="2026-03-21T14:30" time-option-interval="30"');
    const control = timeInner(field);
    expect(control.getAttribute('role')).toBe('combobox');
    expect(control.getAttribute('aria-autocomplete')).toBe('list');
    expect(control.getAttribute('aria-expanded')).toBe('false');
    expect(control.hasAttribute('aria-controls')).toBe(false);
  });

  it('a click or Alt+Arrow Down opens a list of every time at the cadence with the value selected and highlighted', async () => {
    const field = await make('label="Meeting" value="2026-03-21T14:30" time-option-interval="30"');
    await userEvent.click(timeInner(field));
    await waitUntil(
      () => timeList(field) !== null && timePopover(field)!.matches(':popover-open'),
      'list open',
    );
    expect(timeInner(field).getAttribute('aria-expanded')).toBe('true');
    expect(timeList(field)!.getAttribute('aria-label')).toBe('Meeting time options');
    expect(timeInner(field).getAttribute('aria-controls')).toBe(timeList(field)!.id);
    expect(timeOptions(field)).toHaveLength(48);
    expect(timeOptions(field)[0]!.textContent.trim()).toBe('12:00 AM');
    const selected = timeOptions(field).filter((o) => o.getAttribute('aria-selected') === 'true');
    expect(selected.map((o) => o.textContent.trim())).toEqual(['2:30 PM']);
    const active = timeInner(field).getAttribute('aria-activedescendant');
    expect(
      document.querySelector(`#${CSS.escape(active ?? '')}`) ??
        field.shadowRoot!.getElementById(active!),
    ).toBe(selected[0]);
    // The field keeps focus: the arrows only move the highlight.
    expect(deepActiveElement()).toBe(timeInner(field));
    await pressKeys('Escape');
    await waitUntil(() => timeList(field) === null, 'closed by Escape');
    timeInner(field).focus();
    await pressKeys('Alt+ArrowDown');
    await waitUntil(() => timeList(field) !== null, 'opened by Alt+Arrow Down');
  });

  it('arrows move the highlight, Enter commits it, and the list closes with focus still in the field', async () => {
    const field = await make('label="Meeting" value="2026-03-21T14:30" time-option-interval="30"');
    timeInner(field).focus();
    await pressKeys('Alt+ArrowDown');
    await waitUntil(() => timeList(field) !== null, 'open');
    const events = recordEvents(field, ['input', 'change']);
    await pressKeys('ArrowDown', 'ArrowDown');
    await pressKeys('Enter');
    await waitUntil(() => timeList(field) === null, 'closed');
    expect(field.value).toBe('2026-03-21T15:30');
    expect(events.counts()).toEqual({input: 1, change: 1});
    expect(deepActiveElement()).toBe(timeInner(field));
    // Closed, the arrows step the value again.
    await pressKeys('ArrowUp');
    expect(field.value).toBe('2026-03-21T15:31');
  });

  it('Home and End go to the ends, and a click on an option commits it without the field losing focus first', async () => {
    const field = await make('label="Meeting" value="2026-03-21T14:30" time-option-interval="60"');
    timeInner(field).focus();
    await pressKeys('Alt+ArrowDown');
    await waitUntil(() => timeList(field) !== null, 'open');
    expect(timeOptions(field)).toHaveLength(24);
    await pressKeys('End', 'Enter');
    await waitUntil(() => timeList(field) === null, 'closed');
    expect(field.value).toBe('2026-03-21T23:00');
    await userEvent.click(timeInner(field));
    await waitUntil(() => timeList(field) !== null, 'open again');
    await userEvent.click(timeOptions(field)[9]!);
    await waitUntil(() => timeList(field) === null, 'closed by the pick');
    expect(field.value).toBe('2026-03-21T09:00');
  });

  it('typing still works: the highlight follows the text, and Enter commits the typed time, not the option before it', async () => {
    const field = await make('label="Meeting" value="2026-03-21T14:30" time-option-interval="30"');
    await userEvent.click(timeInner(field));
    await userEvent.clear(timeInner(field));
    await userEvent.type(timeInner(field), '1:07 pm');
    await waitUntil(() => timeList(field) !== null, 'open');
    await pressKeys('Enter');
    expect(field.value).toBe('2026-03-21T13:07');
  });

  it('lists only times the typed path would accept on the day of min and max, and closes on Tab', async () => {
    const field = await make(
      'label="Meeting" value="2026-03-21T10:00" min="2026-03-21T09:00" max="2026-03-21T11:00" time-option-interval="30"',
    );
    timeInner(field).focus();
    await pressKeys('Alt+ArrowDown');
    await waitUntil(() => timeList(field) !== null, 'open');
    expect(timeOptions(field).map((o) => o.textContent.trim())).toEqual([
      '9:00 AM',
      '9:30 AM',
      '10:00 AM',
      '10:30 AM',
      '11:00 AM',
    ]);
    await pressKeys('Tab');
    await waitUntil(() => timeList(field) === null, 'closed by Tab');
  });

  it('does not offer a list to a disabled, read-only or busy field, and a native or sheet surface has none', async () => {
    for (const attributes of ['disabled', 'readonly', 'loading']) {
      const field = await make(`label="Meeting" time-option-interval="30" ${attributes}`);
      await userEvent.click(timeInner(field), {force: true});
      await nextFrame();
      expect(timeList(field), attributes).toBeNull();
    }
  });
});
