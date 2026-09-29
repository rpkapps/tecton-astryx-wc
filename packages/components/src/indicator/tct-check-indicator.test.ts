/**
 * tct-check-indicator: the mark when chosen, nothing when not, replacement content in either state,
 * the decorative contract (ported from upstream Indicator.test.tsx `CheckIndicator`).
 */
import {html} from 'lit';
import {describe, expect, it} from 'vitest';
import {axNode, expectAccessible} from '@tecton-wc/testing/a11y.js';
import {emulateMedia} from '@tecton-wc/testing/emulate.js';
import {fixture} from '@tecton-wc/testing/fixture.js';
import {runElementSuite} from '@tecton-wc/testing/suites/element.js';
import {isChromium} from '@tecton-wc/testing/tier.js';
import {waitUntil} from '@tecton-wc/testing/timing.js';
import './define.js';
import type {TctCheckIndicator} from './tct-check-indicator.js';

const make = (attributes = '', children = ''): Promise<TctCheckIndicator> =>
  fixture<HTMLElement>(
    `<div><tct-check-indicator ${attributes}>${children}</tct-check-indicator></div>`,
  ).then((wrapper) => wrapper.querySelector<TctCheckIndicator>('tct-check-indicator')!);
const icon = (indicator: TctCheckIndicator): HTMLElement | null =>
  indicator.shadowRoot!.querySelector<HTMLElement>('tct-icon');
const wrapper = (indicator: TctCheckIndicator): HTMLElement | null =>
  indicator.shadowRoot!.querySelector<HTMLElement>('.slot');

runElementSuite({
  tag: 'tct-check-indicator',
  render: () => html`<tct-check-indicator></tct-check-indicator>`,
  properties: {state: 'checked', size: 'sm', disabled: true},
  attributes: {state: 'state', size: 'size'},
});

describe('tct-check-indicator: rendering', () => {
  it('draws the mark when checked and nothing when not', async () => {
    const checked = await make('state="checked"');
    expect(icon(checked)).not.toBeNull();
    await waitUntil(() => icon(checked)!.shadowRoot?.querySelector('svg') != null, 'check glyph');
    const unchecked = await make('state="unchecked"');
    expect(icon(unchecked)).toBeNull();
    expect(wrapper(unchecked)).toBeNull();
    // No box to reserve: an unmarked row keeps the layout it would have without the indicator.
    expect(unchecked.getBoundingClientRect().width).toBe(0);
  });

  it('draws a 16px check for both sizes, in the accent ink, or the disabled ink when disabled', async () => {
    for (const size of ['sm', 'md']) {
      const indicator = await make(`state="checked" size="${size}"`);
      expect(icon(indicator)!.getAttribute('name')).toBe('check');
      expect(icon(indicator)!.getBoundingClientRect().width).toBe(16);
      expect(icon(indicator)!.getAttribute('color')).toBe('accent');
    }
    const disabled = await make('state="checked" disabled');
    expect(icon(disabled)!.getAttribute('color')).toBe('disabled');
  });

  it('renders children instead of the mark, in both states', async () => {
    for (const state of ['checked', 'unchecked']) {
      const indicator = await make(`state="${state}"`, '<span id="busy">…</span>');
      expect(icon(indicator)).toBeNull();
      const slot = wrapper(indicator)!;
      expect(slot).not.toBeNull();
      expect(slot.getBoundingClientRect().width).toBe(16);
      expect(
        slot
          .querySelector<HTMLSlotElement>('slot')!
          .assignedElements()
          .map((el) => el.id),
      ).toEqual(['busy']);
    }
  });

  it('falsy children never suppress the mark: whitespace and comments are not content', async () => {
    const indicator = await make('state="checked"', '  <!-- --> ');
    expect(icon(indicator)).not.toBeNull();
    expect(wrapper(indicator)).toBeNull();
  });

  it('follows property changes', async () => {
    const indicator = await make('state="unchecked"');
    indicator.state = 'checked';
    await indicator.updateComplete;
    expect(icon(indicator)).not.toBeNull();
    indicator.state = 'unchecked';
    await indicator.updateComplete;
    expect(icon(indicator)).toBeNull();
  });

  it('exposes the checked and disabled custom states', async () => {
    const indicator = await make('state="checked" disabled');
    expect(indicator.matches(':state(checked)')).toBe(true);
    expect(indicator.matches(':state(disabled)')).toBe(true);
  });
});

describe('tct-check-indicator: the decorative contract', () => {
  it('is hidden from assistive technology in both states, and with an author aria-hidden="false"', async () => {
    const checked = await make('state="checked" aria-hidden="false"');
    expect(await axNode(icon(checked)!)).toMatchObject({ignored: 'true'});
    const busy = await make('state="checked"', '<span id="busy">Loading</span>');
    expect(await axNode(busy.querySelector('#busy')!)).toMatchObject({ignored: 'true'});
  });

  it('is accessible in every state', async () => {
    for (const [attributes, children] of [
      ['state="checked"', ''],
      ['state="unchecked"', ''],
      ['state="checked" disabled', ''],
      ['state="unchecked"', '<span>busy</span>'],
    ] as const) {
      const indicator = await make(attributes, children);
      await expectAccessible(indicator.parentElement!);
    }
  });
});

describe('tct-check-indicator: RTL and forced colours', () => {
  it('draws the same in right-to-left containers (a check does not mirror)', async () => {
    const container = await fixture<HTMLElement>(
      '<div><tct-check-indicator state="checked"></tct-check-indicator></div>',
      {dir: 'rtl'},
    );
    const indicator = container.querySelector<TctCheckIndicator>('tct-check-indicator')!;
    expect(icon(indicator)!.getBoundingClientRect().width).toBe(16);
  });

  it.skipIf(!isChromium)(
    'keeps a slotted spinner in a system colour under forced colours',
    async () => {
      await emulateMedia({forcedColors: 'active'});
      const indicator = await make('state="checked"', '<span>…</span>');
      expect(getComputedStyle(wrapper(indicator)!).color).not.toBe('rgba(0, 0, 0, 0)');
    },
  );
});
