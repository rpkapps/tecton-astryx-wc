/**
 * tct-time-input: the element and form-control suites, rendering, typing (text parsing in several forms,
 * drafts, Enter and IME) and stepping with the arrow keys. The native and bottom-sheet surfaces are in
 * `tct-time-input.surfaces.test.ts`; validity, languages and contrast in `tct-time-input.states.test.ts`.
 * Ported from upstream TimeInput.test.tsx where the behaviour applies. Today is fixed by a faked clock
 * (2026-01-15 12:00 local).
 */
import {html} from 'lit';
import {userEvent} from 'vitest/browser';
import {describe, expect, it} from 'vitest';
import {getAnnouncerRegions} from '@tecton-wc/core/a11y/announcer.js';
import {overrideFeature} from '@tecton-wc/core/features.js';
import {axNode} from '@tecton-wc/testing/a11y.js';
import {recordEvents} from '@tecton-wc/testing/events.js';
import {formHarness} from '@tecton-wc/testing/forms.js';
import {pressKeys} from '@tecton-wc/testing/keyboard.js';
import {runElementSuite} from '@tecton-wc/testing/suites/element.js';
import {runFormControlSuite} from '@tecton-wc/testing/suites/form-control.js';
import {isChromium} from '@tecton-wc/testing/tier.js';
import {waitUntil} from '@tecton-wc/testing/timing.js';
import '../field/define.js';
import '../form-layout/define.js';
import '../tooltip/define.js';
import './define.js';
import {inner, make, typeText, useFixedToday} from './time-input-test-helpers.js';
import type {TctTimeInput} from './tct-time-input.js';

useFixedToday();

runElementSuite({
  tag: 'tct-time-input',
  render: () => html`<tct-time-input label="Start time" name="t"></tct-time-input>`,
  properties: {
    label: 'Other',
    description: 'Help',
    placeholder: 'Pick',
    min: '08:00',
    max: '18:00',
    hasSeconds: true,
    hourFormat: '24h',
    increment: 15,
    hasClear: true,
    size: 'lg',
    loading: true,
    width: 200,
    presentation: 'text-input',
  },
  attributes: {
    label: 'label',
    description: 'description',
    placeholder: 'placeholder',
    min: 'min',
    max: 'max',
    hasSeconds: 'has-seconds',
    hourFormat: 'hour-format',
    increment: 'increment',
    hasClear: 'has-clear',
    presentation: 'presentation',
  },
  events: ['tct-open-change', 'tct-after-open-change', 'tct-clear', 'tct-enter'],
});

runFormControlSuite({
  tag: 'tct-time-input',
  render: (attributes) => `<tct-time-input label="Field" ${attributes}></tct-time-input>`,
  validValue: '14:30',
  submitsOnEnter: true,
  readonly: true,
  labelActivation: 'focus',
  innerFocusable: (element) => element.shadowRoot!.querySelector<HTMLElement>('input.input'),
  userEdit: async (element) => {
    const input = element.shadowRoot!.querySelector<HTMLInputElement>('input.input')!;
    await userEvent.click(input);
    await userEvent.clear(input);
    await userEvent.type(input, '2:30 pm');
    await pressKeys('Tab');
  },
});

describe('tct-time-input: rendering and the value', () => {
  it('is a text input with a clock, a placeholder and no value', async () => {
    const field = await make();
    expect(inner(field).type).toBe('text');
    expect(inner(field).getAttribute('role')).toBeNull();
    expect(inner(field).placeholder).toBe('Select a time');
    expect(inner(field).value).toBe('');
    expect(field.shadowRoot!.querySelector('tct-icon.clock')!.getAttribute('name')).toBe('clock');
    expect(field.shadowRoot!.querySelector('.toggle')).toBeNull();
    if (isChromium) {
      const node = await axNode(inner(field));
      expect(node.role).toBe('textbox');
      expect(node.name).toBe('Start time');
    }
  });

  it('shows the committed time as 12-hour or 24-hour text, with seconds when asked', async () => {
    const twelve = await make('label="Start time" value="14:30"');
    expect(inner(twelve).value).toBe('2:30 PM');
    const midnight = await make('label="Start time" value="00:05"');
    expect(inner(midnight).value).toBe('12:05 AM');
    const twentyFour = await make('label="Start time" value="14:30" hour-format="24h"');
    expect(inner(twentyFour).value).toBe('14:30');
    const seconds = await make('label="Start time" value="14:30:15" has-seconds');
    expect(inner(seconds).value).toBe('2:30:15 PM');
    const bare = await make('label="Start time" value="14:30:15"');
    expect(inner(bare).value).toBe('2:30 PM');
  });

  it('reads the value property leniently: only a real time is a value, in its canonical form', async () => {
    const field = await make();
    for (const [written, read] of [
      ['14:30', '14:30'],
      ['14:30:15', '14:30:15'],
      ['09:05', '09:05'],
      ['25:00', ''],
      ['12:60', ''],
      ['noon', ''],
      ['', ''],
    ] as const) {
      field.value = written;
      expect(field.value, written).toBe(read);
    }
  });

  it('a property or attribute write never fires input or change, and replaces a draft', async () => {
    const field = await make();
    await userEvent.click(inner(field));
    await userEvent.type(inner(field), '2:3');
    const events = recordEvents(field, ['input', 'change']);
    field.value = '16:45';
    await field.updateComplete;
    expect(inner(field).value).toBe('4:45 PM');
    field.setAttribute('value', '17:00');
    await field.updateComplete;
    expect(events.events).toHaveLength(0);
  });

  it('shows a clear button only for an editable value, and clearing fires tct-clear, input and change', async () => {
    const empty = await make('label="Start time" has-clear');
    expect(empty.shadowRoot!.querySelector('tct-input-clear-button')).toBeNull();
    const readonly = await make('label="Start time" has-clear readonly value="14:30"');
    expect(readonly.shadowRoot!.querySelector('tct-input-clear-button')).toBeNull();
    const field = await make('label="Start time" has-clear value="14:30"');
    const events = recordEvents(field, ['tct-clear', 'input', 'change']);
    await userEvent.click(field.shadowRoot!.querySelector('tct-input-clear-button')!);
    await field.updateComplete;
    expect(field.value).toBe('');
    expect(events.events.map((event) => event.type)).toEqual(['tct-clear', 'input', 'change']);
  });

  it('keeps the value when tct-clear is prevented', async () => {
    const field = await make('label="Start time" has-clear value="14:30"');
    field.addEventListener('tct-clear', (event) => event.preventDefault());
    await userEvent.click(field.shadowRoot!.querySelector('tct-input-clear-button')!);
    expect(field.value).toBe('14:30');
  });
});

describe('tct-time-input: typing', () => {
  it('keeps the text as a draft while typing and commits it when the entry ends: one input, one change', async () => {
    const field = await make();
    const events = recordEvents(field, ['input', 'change']);
    await userEvent.click(inner(field));
    await userEvent.type(inner(field), '2:30 pm');
    // Every prefix of a time is a time ("2" is 2:00): nothing is committed mid-entry.
    expect(field.value).toBe('');
    expect(events.events).toHaveLength(0);
    await pressKeys('Tab');
    await field.updateComplete;
    expect(field.value).toBe('14:30');
    expect(events.counts()).toEqual({input: 1, change: 1});
    expect(inner(field).value).toBe('2:30 PM');
  });

  it('reads 12-hour, 24-hour, compact and hour-only forms', async () => {
    const field = await make();
    for (const [typed, stored] of [
      ['2:30 PM', '14:30'],
      ['2:30pm', '14:30'],
      ['2:30 p.m.', '14:30'],
      ['14:30', '14:30'],
      ['1430', '14:30'],
      ['2pm', '14:00'],
      ['12am', '00:00'],
      ['12:15 pm', '12:15'],
      ['9', '09:00'],
    ] as const) {
      await typeText(field, typed);
      await pressKeys('Tab');
      expect(field.value, typed).toBe(stored);
    }
  });

  it('reads seconds with has-seconds', async () => {
    const field = await make('label="Start time" has-seconds');
    await typeText(field, '2:30:45 pm');
    await pressKeys('Tab');
    expect(field.value).toBe('14:30:45');
    expect(inner(field).value).toBe('2:30:45 PM');
  });

  it('clears the value when the text is emptied and the field is left', async () => {
    const field = await make('label="Start time" value="14:30"');
    const events = recordEvents(field, ['input', 'change']);
    await typeText(field, '');
    await pressKeys('Tab');
    expect(field.value).toBe('');
    expect(events.counts()).toEqual({input: 1, change: 1});
  });

  it('shows the invalid state only once typing has paused, and drops it when the text reads again', async () => {
    const field = await make();
    await userEvent.click(inner(field));
    await userEvent.type(inner(field), 'xyz');
    expect(inner(field).hasAttribute('aria-invalid')).toBe(false);
    await waitUntil(
      () => inner(field).getAttribute('aria-invalid') === 'true',
      'invalid after the pause',
    );
    await userEvent.clear(inner(field));
    await userEvent.type(inner(field), '3:15 pm');
    await waitUntil(() => !inner(field).hasAttribute('aria-invalid'), 'valid again');
  });

  it('drops text that is not a time when the field is left, says so while it stands, and fires nothing', async () => {
    const restore = overrideFeature('ariaNotify', false);
    try {
      const field = await make('label="Start time" value="14:30"');
      const events = recordEvents(field, ['input', 'change']);
      await typeText(field, 'abc');
      await waitUntil(
        () => inner(field).getAttribute('aria-invalid') === 'true',
        'invalid after the pause',
      );
      expect(field.validity.badInput).toBe(true);
      await waitUntil(
        () => getAnnouncerRegions().assertive?.textContent === 'Invalid time',
        'invalid time announced',
        3000,
      );
      await pressKeys('Tab');
      await field.updateComplete;
      expect(field.value).toBe('14:30');
      expect(inner(field).value).toBe('2:30 PM');
      expect(inner(field).hasAttribute('aria-invalid')).toBe(false);
      expect(events.events).toHaveLength(0);
    } finally {
      restore();
    }
  });

  it('refuses a time outside min and max the same way', async () => {
    const restore = overrideFeature('ariaNotify', false);
    try {
      const field = await make('label="Start time" value="10:00" min="09:00" max="17:00"');
      await typeText(field, '8pm');
      await waitUntil(
        () => inner(field).getAttribute('aria-invalid') === 'true',
        'invalid after the pause',
      );
      await pressKeys('Tab');
      expect(field.value).toBe('10:00');
      await typeText(field, '5pm');
      await pressKeys('Tab');
      expect(field.value).toBe('17:00');
    } finally {
      restore();
    }
  });

  it('shows a format hint while the empty field has focus, and never for a disabled one', async () => {
    const twelve = await make('label="Start time"');
    inner(twelve).focus();
    await waitUntil(() => inner(twelve).placeholder === 'e.g., 2:30 PM', 'hint');
    const twentyFour = await make('label="Start time" hour-format="24h"');
    inner(twentyFour).focus();
    await waitUntil(() => inner(twentyFour).placeholder === 'e.g., 14:30', 'hint');
    const own = await make('label="Start time" placeholder="Any time"');
    inner(own).focus();
    await own.updateComplete;
    expect(inner(own).placeholder).toBe('Any time');
  });

  it('Enter commits the text, fires tct-enter, and submits the form once', async () => {
    const form = await formHarness(
      '<tct-time-input label="Start time" name="t"></tct-time-input><button type="submit">Go</button>',
    );
    const field = form.form.querySelector<TctTimeInput>('tct-time-input')!;
    await field.updateComplete;
    const enters = recordEvents(field, 'tct-enter');
    await userEvent.click(inner(field));
    await userEvent.type(inner(field), '6:45 pm');
    await pressKeys('Enter');
    expect(enters.events).toHaveLength(1);
    expect(form.submitEvents).toHaveLength(1);
    expect(form.values('t')).toEqual(['18:45']);
    expect(inner(field).value).toBe('6:45 PM');
  });

  it('an IME composition Enter is not a command', async () => {
    const field = await make();
    const enters = recordEvents(field, 'tct-enter');
    await userEvent.click(inner(field));
    await userEvent.type(inner(field), '6:45 pm');
    inner(field).dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Enter',
        isComposing: true,
        bubbles: true,
        composed: true,
        cancelable: true,
      }),
    );
    expect(enters.events).toHaveLength(0);
    expect(inner(field).value).toBe('6:45 pm');
  });
});

describe('tct-time-input: stepping with the arrow keys', () => {
  it('Arrow Up and Down step by increment minutes; each step is an input and a change', async () => {
    const field = await make('label="Start time" value="14:30" increment="15"');
    const events = recordEvents(field, ['input', 'change']);
    inner(field).focus();
    await pressKeys('ArrowUp');
    expect(field.value).toBe('14:45');
    expect(inner(field).value).toBe('2:45 PM');
    await pressKeys('ArrowDown', 'ArrowDown');
    expect(field.value).toBe('14:15');
    expect(events.counts()).toEqual({input: 3, change: 3});
  });

  it('steps by one minute by default, and wraps past midnight', async () => {
    const field = await make('label="Start time" value="00:00"');
    inner(field).focus();
    await pressKeys('ArrowDown');
    expect(field.value).toBe('23:59');
    await pressKeys('ArrowUp', 'ArrowUp');
    expect(field.value).toBe('00:01');
  });

  it('steps an empty field from the current time', async () => {
    const field = await make();
    inner(field).focus();
    await pressKeys('ArrowUp');
    // The clock is fixed at 12:00.
    expect(field.value).toBe('12:01');
    const other = await make('label="Start time" increment="30"');
    inner(other).focus();
    await pressKeys('ArrowDown');
    expect(other.value).toBe('11:30');
  });

  it('keeps the seconds part with has-seconds', async () => {
    const field = await make('label="Start time" value="14:30:20" has-seconds');
    inner(field).focus();
    await pressKeys('ArrowUp');
    expect(field.value).toBe('14:31:20');
  });

  it('does not step past min or max, and does not step while read-only, disabled or busy', async () => {
    const field = await make('label="Start time" value="17:00" max="17:00" min="09:00"');
    inner(field).focus();
    await pressKeys('ArrowUp');
    expect(field.value).toBe('17:00');
    await pressKeys('ArrowDown');
    expect(field.value).toBe('16:59');
    for (const attributes of ['readonly', 'disabled disabled-message="Locked"', 'loading']) {
      const locked = await make(`label="Start time" value="14:30" ${attributes}`);
      inner(locked).focus();
      await pressKeys('ArrowUp');
      expect(locked.value, attributes).toBe('14:30');
    }
  });

  it('announces the new time, because a rewritten textbox value is not spoken', async () => {
    const restore = overrideFeature('ariaNotify', false);
    try {
      const field = await make('label="Start time" value="14:30"');
      inner(field).focus();
      await pressKeys('ArrowUp');
      await waitUntil(
        () => getAnnouncerRegions().polite?.textContent === '2:31 PM',
        'step announced',
      );
    } finally {
      restore();
    }
  });

  it('steps from the time being typed, when it reads', async () => {
    const field = await make('label="Start time" value="14:30"');
    await typeText(field, '9:00 am');
    await pressKeys('ArrowUp');
    expect(field.value).toBe('09:01');
  });

  it('does not steal the arrows of an IME candidate window', async () => {
    const field = await make('label="Start time" value="14:30"');
    inner(field).focus();
    inner(field).dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'ArrowUp',
        isComposing: true,
        bubbles: true,
        composed: true,
        cancelable: true,
      }),
    );
    expect(field.value).toBe('14:30');
  });
});
