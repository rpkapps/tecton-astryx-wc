/**
 * tct-radio-indicator: states, sizes, disabled, replacement content, the decorative contract, legacy
 * part names (ported from upstream Indicator.test.tsx).
 */
import {html} from 'lit';
import {describe, expect, it} from 'vitest';
import {axNode, expectAccessible} from '@tecton-wc/testing/a11y.js';
import {emulateMedia} from '@tecton-wc/testing/emulate.js';
import {fixture} from '@tecton-wc/testing/fixture.js';
import {runElementSuite} from '@tecton-wc/testing/suites/element.js';
import {isChromium} from '@tecton-wc/testing/tier.js';
import './define.js';
import type {TctRadioIndicator} from './tct-radio-indicator.js';

const make = (attributes = '', children = ''): Promise<TctRadioIndicator> =>
  fixture<HTMLElement>(
    `<div><tct-radio-indicator ${attributes}>${children}</tct-radio-indicator></div>`,
  ).then((wrapper) => wrapper.querySelector<TctRadioIndicator>('tct-radio-indicator')!);
const circle = (indicator: TctRadioIndicator): HTMLElement =>
  indicator.shadowRoot!.querySelector<HTMLElement>('.circle')!;
const dot = (indicator: TctRadioIndicator): HTMLElement =>
  indicator.shadowRoot!.querySelector<HTMLElement>('.dot')!;
const shown = (element: Element | null): boolean =>
  element !== null && getComputedStyle(element).display !== 'none';

runElementSuite({
  tag: 'tct-radio-indicator',
  render: () => html`<tct-radio-indicator></tct-radio-indicator>`,
  properties: {state: 'checked', size: 'sm', disabled: true},
  attributes: {state: 'state', size: 'size'},
});

describe('tct-radio-indicator: rendering', () => {
  it('renders the circle with the state, size and theming parts (both current and legacy names)', async () => {
    const indicator = await make('state="checked" size="sm"');
    expect(circle(indicator).dataset.state).toBe('checked');
    expect(circle(indicator).dataset.size).toBe('sm');
    expect(circle(indicator).getAttribute('part')!.split(' ')).toEqual([
      'radio-indicator',
      'radio',
    ]);
    expect(dot(indicator).getAttribute('part')!.split(' ')).toEqual([
      'radio-indicator-dot',
      'radio-dot',
    ]);
  });

  it('draws the circle in both states and the dot only when checked', async () => {
    const unchecked = await make('state="unchecked"');
    expect(circle(unchecked).getBoundingClientRect().width).toBe(24);
    expect(shown(dot(unchecked))).toBe(false);
    const checked = await make('state="checked"');
    expect(circle(checked).getBoundingClientRect().width).toBe(24);
    expect(shown(dot(checked))).toBe(true);
  });

  it('a radio has no partial state: anything but unchecked reads as selected', async () => {
    const indicator = await make('state="indeterminate"');
    expect(circle(indicator).dataset.state).toBe('checked');
    expect(shown(dot(indicator))).toBe(true);
  });

  it('size sm is a 20px circle with an 8px dot; md is 24px with a 10px dot', async () => {
    const sm = await make('state="checked" size="sm"');
    expect(circle(sm).getBoundingClientRect().width).toBe(20);
    expect(dot(sm).getBoundingClientRect().width).toBe(8);
    const md = await make('state="checked" size="md"');
    expect(circle(md).getBoundingClientRect().width).toBe(24);
    expect(dot(md).getBoundingClientRect().width).toBe(10);
  });

  it('is fully round', async () => {
    const indicator = await make('state="checked"');
    expect(
      parseFloat(getComputedStyle(circle(indicator)).borderTopLeftRadius),
    ).toBeGreaterThanOrEqual(12);
  });

  it('renders children instead of the dot and keeps the circle', async () => {
    const indicator = await make('state="checked"', '<span id="busy">…</span>');
    expect(shown(dot(indicator))).toBe(false);
    expect(circle(indicator).getBoundingClientRect().width).toBe(24);
    expect(
      indicator
        .shadowRoot!.querySelector<HTMLSlotElement>('slot')!
        .assignedElements()
        .map((el) => el.id),
    ).toEqual(['busy']);
  });

  it('whitespace children do not suppress the dot', async () => {
    const indicator = await make('state="checked"', '   ');
    expect(shown(dot(indicator))).toBe(true);
  });

  it('reflects disabled for theming', async () => {
    const indicator = await make('state="checked" disabled');
    expect(circle(indicator).hasAttribute('data-disabled')).toBe(true);
    expect(indicator.matches(':state(disabled)')).toBe(true);
    expect(getComputedStyle(circle(indicator)).opacity).toBe('0.5');
  });

  it('follows property changes', async () => {
    const indicator = await make('state="unchecked"');
    indicator.state = 'checked';
    await indicator.updateComplete;
    expect(shown(dot(indicator))).toBe(true);
  });
});

describe('tct-radio-indicator: the decorative contract', () => {
  it('is hidden from assistive technology and stays hidden with aria-hidden="false"', async () => {
    const indicator = await make('state="checked" aria-hidden="false"');
    expect(await axNode(circle(indicator))).toMatchObject({ignored: 'true'});
  });

  it('is accessible in both states and sizes', async () => {
    for (const state of ['unchecked', 'checked']) {
      for (const size of ['sm', 'md']) {
        const indicator = await make(`state="${state}" size="${size}"`);
        await expectAccessible(indicator.parentElement!);
      }
    }
  });
});

describe('tct-radio-indicator: RTL and forced colours', () => {
  it('draws the same in right-to-left containers', async () => {
    const wrapper = await fixture<HTMLElement>(
      '<div><tct-radio-indicator state="checked"></tct-radio-indicator></div>',
      {dir: 'rtl'},
    );
    const indicator = wrapper.querySelector<TctRadioIndicator>('tct-radio-indicator')!;
    expect(circle(indicator).getBoundingClientRect().width).toBe(24);
    expect(shown(dot(indicator))).toBe(true);
  });

  it.skipIf(!isChromium)('keeps the selected dot perceivable under forced colours', async () => {
    await emulateMedia({forcedColors: 'active'});
    const indicator = await make('state="checked"');
    expect(getComputedStyle(dot(indicator)).backgroundColor).not.toBe(
      getComputedStyle(circle(indicator)).backgroundColor,
    );
    expect(getComputedStyle(circle(indicator)).borderStyle).toBe('solid');
  });
});
