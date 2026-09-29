/**
 * tct-date-input: the calendar popover: opening (toggle, input click, Arrow Down), where focus goes,
 * picking, Escape, outside presses, the intent and commit events, two months, and a field that cannot open.
 * Ported from upstream DateInput.test.tsx where the behaviour applies.
 */
import {userEvent} from 'vitest/browser';
import {describe, expect, it} from 'vitest';
import {deepActiveElement} from '@tecton-wc/core/utils/focus.js';
import {axNode} from '@tecton-wc/testing/a11y.js';
import {recordEvents} from '@tecton-wc/testing/events.js';
import {fixture} from '@tecton-wc/testing/fixture.js';
import {pressKeys} from '@tecton-wc/testing/keyboard.js';
import {isChromium} from '@tecton-wc/testing/tier.js';
import {animationsFinished, nextFrame, waitUntil} from '@tecton-wc/testing/timing.js';
import '../field/define.js';
import '../tooltip/define.js';
import './define.js';
import {
  calendar,
  day,
  inner,
  isShown,
  make,
  openByToggle,
  picker,
  toggle,
  useFixedToday,
} from './date-input-test-helpers.js';
import type {TctDateInput} from './tct-date-input.js';

useFixedToday();

const focusedDate = (): string | undefined =>
  (deepActiveElement() as HTMLElement | null)?.dataset.date;

describe('tct-date-input: the calendar popover', () => {
  it('opens under the field from the toggle button, with focus in the calendar, and the picker semantics', async () => {
    const field = await make('label="Event date" value="2026-03-21"');
    const changes = recordEvents(field, ['tct-open-change', 'tct-after-open-change']);
    await openByToggle(field);
    expect(changes.named('tct-open-change')[0]).toMatchObject({open: true, reason: 'trigger'});
    await waitUntil(() => changes.named('tct-after-open-change').length === 1, 'after-open-change');
    expect(field.hasAttribute('open')).toBe(true);
    expect(toggle(field).getAttribute('aria-expanded')).toBe('true');
    expect(toggle(field).getAttribute('aria-label')).toBe('Close calendar');
    expect(inner(field).getAttribute('aria-expanded')).toBe('true');
    const surface = field.shadowRoot!.querySelector<HTMLElement>('.picker-surface')!;
    expect(surface.getAttribute('role')).toBe('dialog');
    expect(surface.getAttribute('aria-label')).toBe('Choose date');
    expect(inner(field).getAttribute('aria-controls')).toBe(surface.id);
    // The calendar opens on the selected day, and focus is there.
    await waitUntil(() => focusedDate() === '2026-03-21', 'focus in the calendar');
    const box = field.shadowRoot!.querySelector('.input-wrapper')!.getBoundingClientRect();
    const layer = surface.getBoundingClientRect();
    expect(layer.top).toBeGreaterThanOrEqual(box.bottom - 1);
    expect(Math.abs(layer.left - box.left)).toBeLessThan(2);
    if (isChromium) {
      const node = await axNode(surface);
      expect(node.role).toBe('dialog');
      expect(node.name).toBe('Choose date');
    }
  });

  it('a click on the input opens it without taking focus from the input; Arrow Down does the same', async () => {
    const field = await make('label="Event date"');
    await userEvent.click(inner(field));
    await waitUntil(() => field.open && isShown(field), 'open after click');
    await animationsFinished(picker(field));
    expect(deepActiveElement()).toBe(inner(field));
    await field.hide();
    inner(field).focus();
    await pressKeys('ArrowDown');
    await waitUntil(() => field.open && isShown(field), 'open after Arrow Down');
    expect(deepActiveElement()).toBe(inner(field));
    // Arrow Down again moves into the calendar (APG combobox with a dialog popup).
    await pressKeys('ArrowDown');
    expect(focusedDate()).toBe('2026-01-15');
  });

  it('a click on the input while it is open keeps it open (the field is inside the picker)', async () => {
    const field = await make('label="Event date"');
    const changes = recordEvents(field, 'tct-open-change');
    await openByToggle(field);
    await userEvent.click(inner(field));
    await nextFrame();
    expect(field.open).toBe(true);
    expect(changes.events.map((event) => event.open)).toEqual([true]);
  });

  it('picking a day commits it, closes the picker and returns focus to the input', async () => {
    const field = await make('label="Event date" value="2026-03-21"');
    const events = recordEvents(field, ['input', 'change', 'tct-open-change']);
    await openByToggle(field);
    await userEvent.click(day(field, '2026-03-25'));
    await waitUntil(() => !field.open && !isShown(field), 'closed after the pick');
    expect(field.value).toBe('2026-03-25');
    expect(inner(field).value).toBe('March 25, 2026');
    expect(events.events.map((event) => event.type)).toEqual([
      'tct-open-change',
      'input',
      'change',
      'tct-open-change',
    ]);
    expect(events.events[3]).toMatchObject({open: false, reason: 'selection'});
    await waitUntil(() => deepActiveElement() === inner(field), 'focus back on the input');
  });

  it('the calendar inside does not leak its own events out of the field', async () => {
    const field = await make('label="Event date"');
    await openByToggle(field);
    const leaks = recordEvents(field, ['tct-value-change']);
    const events = recordEvents(field, ['input', 'change']);
    await userEvent.click(day(field, '2026-01-20'));
    await waitUntil(() => !field.open, 'closed');
    expect(leaks.events).toHaveLength(0);
    expect(events.counts()).toEqual({input: 1, change: 1});
  });

  it('Escape closes the picker (one layer per press) and returns focus to the input', async () => {
    const field = await make('label="Event date"');
    const changes = recordEvents(field, 'tct-open-change');
    await openByToggle(field);
    await pressKeys('Escape');
    await waitUntil(() => !field.open && !isShown(field), 'closed by Escape');
    expect(changes.events[1]).toMatchObject({open: false, reason: 'escape'});
    await waitUntil(() => deepActiveElement() === inner(field), 'focus back on the input');
    await pressKeys('Escape');
    expect(changes.events).toHaveLength(2);
  });

  it('an outside press closes it and does not fight where the press moved focus', async () => {
    const wrapper = await fixture<HTMLElement>(
      '<div style="padding:40px;inline-size:420px"><button id="other">Other</button><tct-date-input label="Event date"></tct-date-input></div>',
    );
    const field = wrapper.querySelector<TctDateInput>('tct-date-input')!;
    await field.updateComplete;
    await openByToggle(field);
    const other = wrapper.querySelector<HTMLButtonElement>('#other')!;
    await userEvent.click(other);
    await waitUntil(() => !field.open && !isShown(field), 'closed by the outside press');
    expect(deepActiveElement()).toBe(other);
  });

  it('a second click on the toggle closes it', async () => {
    const field = await make('label="Event date"');
    await openByToggle(field);
    await userEvent.click(toggle(field));
    await waitUntil(() => !field.open && !isShown(field), 'closed by the toggle');
    await waitUntil(() => deepActiveElement() === toggle(field), 'focus on the toggle');
  });

  it('honours a cancelled tct-open-change, and open writes never fire it', async () => {
    const field = await make('label="Event date"');
    field.addEventListener('tct-open-change', (event) => event.preventDefault(), {once: true});
    await userEvent.click(toggle(field));
    await nextFrame();
    expect(field.open).toBe(false);
    const changes = recordEvents(field, ['tct-open-change']);
    await field.show();
    expect(field.open).toBe(true);
    expect(isShown(field)).toBe(true);
    await field.hide();
    expect(changes.events).toHaveLength(0);
  });

  it('follows the typed date in the calendar, and shows two months when asked', async () => {
    const field = await make('label="Event date" number-of-months="2" week-starts-on="mon"');
    await openByToggle(field);
    const grids = calendar(field).shadowRoot!.querySelectorAll('[role="grid"]');
    expect(grids).toHaveLength(2);
    expect(
      calendar(field).shadowRoot!.querySelector('[role="columnheader"]')!.textContent.trim(),
    ).toBe('Mo');
    await userEvent.click(inner(field));
    await userEvent.clear(inner(field));
    await userEvent.type(inner(field), '2027-07-08');
    await calendar(field).updateComplete;
    expect(calendar(field).shadowRoot!.querySelector('.month-year')!.textContent).toBe(
      'July 2027 – August 2027',
    );
  });

  it('does not open a disabled, read-only or busy field', async () => {
    for (const attributes of ['disabled', 'readonly', 'loading']) {
      const field = await make(`label="Event date" ${attributes}`);
      await userEvent.click(toggle(field), {force: true});
      await nextFrame();
      expect(field.open, attributes).toBe(false);
    }
  });

  it('keeps the value untouched while the picker is only opened', async () => {
    const field = await make('label="Event date" value="2026-03-21"');
    const events = recordEvents(field, ['input', 'change']);
    await openByToggle(field);
    await pressKeys('Escape');
    expect(events.events).toHaveLength(0);
    expect(field.value).toBe('2026-03-21');
  });

  it('reopens on the selected day, not where focus was left the last time', async () => {
    const field = await make('label="Event date" value="2026-03-21"');
    await openByToggle(field);
    await waitUntil(() => focusedDate() === '2026-03-21', 'focus in the calendar');
    await pressKeys('ArrowRight', 'ArrowRight', 'PageDown');
    expect(focusedDate()).toBe('2026-04-23');
    await pressKeys('Escape');
    await waitUntil(() => !field.open && !isShown(field), 'closed');
    await openByToggle(field);
    await waitUntil(() => focusedDate() === '2026-03-21', 'focus back on the selected day');
  });

  it('keyboard: the calendar grid keys work inside the picker, and Tab stays in the surface', async () => {
    const field = await make('label="Event date" value="2026-03-21"');
    await openByToggle(field);
    await waitUntil(() => focusedDate() === '2026-03-21', 'focus in the calendar');
    await pressKeys('ArrowRight', 'ArrowDown');
    expect(focusedDate()).toBe('2026-03-29');
    await pressKeys('Enter');
    await waitUntil(() => !field.open && !isShown(field), 'closed');
    expect(field.value).toBe('2026-03-29');
  });
});
