/**
 * The date and time fields inside a tct-input-group: the group owns the label, description and status, the
 * field keeps only its box (joined to the group's single focus ring) and is named by its own hidden label,
 * and the picker still opens under it. Ported from upstream InputGroup usage of DateInput and TimeInput.
 */
import {userEvent} from 'vitest/browser';
import {describe, expect, it} from 'vitest';
import {axNode, expectAccessible} from '@tecton-wc/testing/a11y.js';
import {fixture} from '@tecton-wc/testing/fixture.js';
import {isChromium} from '@tecton-wc/testing/tier.js';
import {nextFrame, waitUntil} from '@tecton-wc/testing/timing.js';
import '../input-group/define.js';
import '../tooltip/define.js';
import './define.js';
import '../time-input/define.js';
import {settleAnimations} from './picker-test-helpers.js';
import type {TctDateInput} from './tct-date-input.js';
import type {TctTimeInput} from '../time-input/tct-time-input.js';
import {useFixedToday} from './date-input-test-helpers.js';

useFixedToday();

async function makeGroup(body: string): Promise<HTMLElement> {
  const wrapper = await fixture<HTMLElement>(
    `<div style="padding:40px;inline-size:520px"><tct-input-group label="Reservation" description="Pick a day and a time.">${body}</tct-input-group></div>`,
  );
  const group = wrapper.querySelector<HTMLElement>('tct-input-group')!;
  await nextFrame();
  return group;
}

describe('tct-date-input inside a tct-input-group', () => {
  it('drops its own label chrome, joins the group and keeps a name of its own', async () => {
    const group = await makeGroup(
      '<tct-input-group-text>Day</tct-input-group-text><tct-date-input label="Reservation day" label-hidden value="2026-03-21"></tct-date-input>',
    );
    const field = group.querySelector<TctDateInput>('tct-date-input')!;
    await field.updateComplete;
    const root = field.shadowRoot!;
    expect(root.querySelector('.field')).toBeNull();
    const box = root.querySelector<HTMLElement>('.input-wrapper')!;
    expect(box.hasAttribute('data-in-group')).toBe(true);
    const input = root.querySelector<HTMLInputElement>('input.input')!;
    expect(input.value).toBe('March 21, 2026');
    expect(input.hasAttribute('aria-labelledby')).toBe(true);
    if (isChromium) {
      const node = await axNode(input);
      expect(node.name).toBe('Reservation day');
    }
  });

  it('opens its calendar under the box, and a pick commits', async () => {
    const group = await makeGroup(
      '<tct-input-group-text>Day</tct-input-group-text><tct-date-input label="Reservation day" label-hidden value="2026-03-21"></tct-date-input>',
    );
    const field = group.querySelector<TctDateInput>('tct-date-input')!;
    await field.updateComplete;
    const toggle = field.shadowRoot!.querySelector<HTMLElement>('.toggle')!;
    await userEvent.click(toggle);
    await waitUntil(() => field.open, 'open');
    const calendar = field.shadowRoot!.querySelector('tct-calendar')!;
    await waitUntil(
      () => calendar.shadowRoot!.querySelector('.day[data-date="2026-03-25"]') !== null,
      'calendar painted',
    );
    await settleAnimations();
    const surface = field.shadowRoot!.querySelector('.picker-surface')!.getBoundingClientRect();
    const box = field.shadowRoot!.querySelector('.input-wrapper')!.getBoundingClientRect();
    expect(surface.top).toBeGreaterThanOrEqual(box.bottom - 1);
    await userEvent.click(
      calendar.shadowRoot!.querySelector('.day[data-date="2026-03-25"]:not([data-outside])')!,
    );
    await waitUntil(() => !field.open, 'closed');
    expect(field.value).toBe('2026-03-25');
  });

  it('passes axe with a date and a time in one group', async () => {
    const group = await makeGroup(
      '<tct-date-input label="Reservation day" label-hidden value="2026-03-21"></tct-date-input><tct-time-input label="Reservation time" label-hidden value="14:30"></tct-time-input>',
    );
    for (const element of group.children)
      await (element as TctDateInput | TctTimeInput).updateComplete;
    await settleAnimations();
    await expectAccessible(group.parentElement!);
  });
});

describe('tct-time-input inside a tct-input-group', () => {
  it('drops its own label chrome, joins the group and keeps a name of its own', async () => {
    const group = await makeGroup(
      '<tct-input-group-text>At</tct-input-group-text><tct-time-input label="Reservation time" label-hidden value="14:30"></tct-time-input>',
    );
    const field = group.querySelector<TctTimeInput>('tct-time-input')!;
    await field.updateComplete;
    const root = field.shadowRoot!;
    expect(root.querySelector('.field')).toBeNull();
    expect(root.querySelector('.input-wrapper')!.hasAttribute('data-in-group')).toBe(true);
    const input = root.querySelector<HTMLInputElement>('input.input')!;
    expect(input.value).toBe('2:30 PM');
    if (isChromium) expect((await axNode(input)).name).toBe('Reservation time');
  });

  it('steps with the arrow keys inside the group', async () => {
    const group = await makeGroup(
      '<tct-input-group-text>At</tct-input-group-text><tct-time-input label="Reservation time" label-hidden value="14:30"></tct-time-input>',
    );
    const field = group.querySelector<TctTimeInput>('tct-time-input')!;
    await field.updateComplete;
    field.focus();
    await userEvent.keyboard('{ArrowUp}');
    expect(field.value).toBe('14:31');
  });
});
