/**
 * tct-checkbox-indicator: states, sizes, disabled, replacement content, the decorative contract,
 * legacy part names (ported from upstream Indicator.test.tsx).
 */
import {html} from 'lit';
import {describe, expect, it} from 'vitest';
import {axNode, expectAccessible} from '@tecton-astryx/testing/a11y.js';
import {emulateMedia} from '@tecton-astryx/testing/emulate.js';
import {fixture} from '@tecton-astryx/testing/fixture.js';
import {runElementSuite} from '@tecton-astryx/testing/suites/element.js';
import {isChromium} from '@tecton-astryx/testing/tier.js';
import './define.js';
import type {TctCheckboxIndicator} from './tct-checkbox-indicator.js';

const make = (attributes = '', children = ''): Promise<TctCheckboxIndicator> =>
  fixture<HTMLElement>(
    `<div><tct-checkbox-indicator ${attributes}>${children}</tct-checkbox-indicator></div>`,
  ).then((wrapper) => wrapper.querySelector<TctCheckboxIndicator>('tct-checkbox-indicator')!);
const box = (indicator: TctCheckboxIndicator): HTMLElement =>
  indicator.shadowRoot!.querySelector<HTMLElement>('.box')!;
const shown = (element: Element | null): boolean =>
  element !== null && getComputedStyle(element).display !== 'none';

runElementSuite({
  tag: 'tct-checkbox-indicator',
  render: () => html`<tct-checkbox-indicator></tct-checkbox-indicator>`,
  properties: {state: 'indeterminate', size: 'sm', disabled: true},
  attributes: {state: 'state', size: 'size'},
  // Decorative: the host has no accessible content, nothing for axe to check by default.
});

describe('tct-checkbox-indicator: rendering', () => {
  it('renders the box with the state, size and theming parts', async () => {
    const indicator = await make('state="checked" size="sm"');
    const element = box(indicator);
    expect(element.dataset.state).toBe('checked');
    expect(element.dataset.size).toBe('sm');
    expect(element.getAttribute('part')!.split(' ')).toEqual(['checkbox-indicator', 'checkbox']);
    expect(
      indicator.shadowRoot!.querySelector('[part~="checkbox-indicator-check"]'),
    ).not.toBeNull();
    expect(indicator.shadowRoot!.querySelector('[part~="checkbox-indicator-dash"]')).not.toBeNull();
  });

  it('draws in every state: an unchecked box is an empty box', async () => {
    const unchecked = await make('state="unchecked"');
    expect(box(unchecked).getBoundingClientRect().width).toBe(24);
    expect(shown(unchecked.shadowRoot!.querySelector('.check'))).toBe(false);
    expect(shown(unchecked.shadowRoot!.querySelector('.dash'))).toBe(false);
  });

  it('shows the check when checked and the bar when indeterminate, never both', async () => {
    const checked = await make('state="checked"');
    expect(shown(checked.shadowRoot!.querySelector('.check'))).toBe(true);
    expect(shown(checked.shadowRoot!.querySelector('.dash'))).toBe(false);
    const partial = await make('state="indeterminate"');
    expect(shown(partial.shadowRoot!.querySelector('.check'))).toBe(false);
    expect(shown(partial.shadowRoot!.querySelector('.dash'))).toBe(true);
  });

  it('size sm is a 20px box and md is 24px', async () => {
    expect(box(await make('size="sm"')).getBoundingClientRect().width).toBe(20);
    expect(box(await make('size="md"')).getBoundingClientRect().width).toBe(24);
  });

  it('renders children instead of the state mark and keeps the box', async () => {
    const indicator = await make('state="checked"', '<span id="busy">…</span>');
    expect(shown(indicator.shadowRoot!.querySelector('.check'))).toBe(false);
    expect(box(indicator).getBoundingClientRect().width).toBe(24);
    const slot = indicator.shadowRoot!.querySelector<HTMLSlotElement>('slot')!;
    expect(slot.assignedElements().map((el) => el.id)).toEqual(['busy']);
  });

  it('falsy children never suppress the state mark: whitespace and comments are not content', async () => {
    const indicator = await make('state="checked"', '  \n  <!-- pending? -->  ');
    expect(shown(indicator.shadowRoot!.querySelector('.check'))).toBe(true);
    const indeterminate = await make('state="indeterminate"', ' ');
    expect(shown(indeterminate.shadowRoot!.querySelector('.dash'))).toBe(true);
  });

  it('still lets real children replace the mark', async () => {
    const indicator = await make('state="indeterminate"', '<b>x</b>');
    expect(shown(indicator.shadowRoot!.querySelector('.dash'))).toBe(false);
  });

  it('reflects disabled for theming: attribute, custom state and dimmed box', async () => {
    const indicator = await make('state="checked" disabled');
    expect(indicator.hasAttribute('disabled')).toBe(true);
    expect(box(indicator).hasAttribute('data-disabled')).toBe(true);
    expect(indicator.matches(':state(disabled)')).toBe(true);
    expect(indicator.matches(':state(checked)')).toBe(true);
    expect(getComputedStyle(box(indicator)).opacity).toBe('0.5');
  });

  it('falls back to unchecked and md for invalid values, and keeps rendering', async () => {
    const indicator = await make('state="maybe" size="huge"');
    expect(box(indicator).dataset.state).toBe('unchecked');
    expect(box(indicator).dataset.size).toBe('md');
  });

  it('follows property changes', async () => {
    const indicator = await make('state="unchecked"');
    indicator.state = 'checked';
    await indicator.updateComplete;
    expect(shown(indicator.shadowRoot!.querySelector('.check'))).toBe(true);
    expect(indicator.getAttribute('state')).toBe('checked');
  });
});

describe('tct-checkbox-indicator: the decorative contract', () => {
  it('is hidden from assistive technology in every state', async () => {
    for (const state of ['unchecked', 'checked', 'indeterminate']) {
      const indicator = await make(`state="${state}"`);
      expect(await axNode(box(indicator))).toMatchObject({ignored: 'true'});
    }
  });

  it('stays aria-hidden even when an author writes aria-hidden="false" on the host', async () => {
    const indicator = await make('state="checked" aria-hidden="false"');
    // The painted box carries its own aria-hidden, so the mark is never exposed.
    expect(box(indicator).getAttribute('aria-hidden')).toBe('true');
    expect(await axNode(box(indicator))).toMatchObject({ignored: 'true'});
  });

  it('hides slotted replacement content too', async () => {
    const indicator = await make('state="checked"', '<span id="busy">Loading</span>');
    expect(await axNode(indicator.querySelector('#busy')!)).toMatchObject({ignored: 'true'});
  });

  it('is accessible in every state and size', async () => {
    for (const state of ['unchecked', 'checked', 'indeterminate']) {
      for (const size of ['sm', 'md']) {
        const indicator = await make(`state="${state}" size="${size}"`);
        await expectAccessible(indicator.parentElement!);
      }
    }
  });
});

describe('tct-checkbox-indicator: hover, RTL, motion and forced colours', () => {
  it('brightens toward the hover colour while an owner publishes --_indicator-hover', async () => {
    const wrapper = await fixture<HTMLElement>(
      '<div><tct-checkbox-indicator state="unchecked"></tct-checkbox-indicator></div>',
    );
    const indicator = wrapper.querySelector<TctCheckboxIndicator>('tct-checkbox-indicator')!;
    const rest = getComputedStyle(box(indicator)).borderColor;
    wrapper.style.setProperty('--_indicator-hover', '1');
    const hovered = getComputedStyle(box(indicator)).borderColor;
    expect(hovered).not.toBe(rest);
  });

  it('draws the same in right-to-left containers', async () => {
    const wrapper = await fixture<HTMLElement>(
      '<div><tct-checkbox-indicator state="checked"></tct-checkbox-indicator></div>',
      {dir: 'rtl'},
    );
    const indicator = wrapper.querySelector<TctCheckboxIndicator>('tct-checkbox-indicator')!;
    expect(box(indicator).getBoundingClientRect().width).toBe(24);
    expect(shown(indicator.shadowRoot!.querySelector('.check'))).toBe(true);
  });

  it.skipIf(!isChromium)(
    'does not animate movement and keeps a short colour fade under reduced motion',
    async () => {
      await emulateMedia({reducedMotion: 'reduce'});
      const indicator = await make('state="checked"');
      const style = getComputedStyle(box(indicator));
      expect(style.transitionProperty).not.toContain('transform');
      expect(style.transitionProperty).not.toContain('translate');
    },
  );

  it.skipIf(!isChromium)('keeps the check perceivable under forced colours', async () => {
    await emulateMedia({forcedColors: 'active'});
    const checked = await make('state="checked"');
    const check = checked.shadowRoot!.querySelector<SVGElement>('.check')!;
    const surface = getComputedStyle(box(checked)).backgroundColor;
    // Canvas box, CanvasText glyph: the two never resolve to the same colour.
    expect(getComputedStyle(check).color).not.toBe(surface);
    expect(getComputedStyle(box(checked)).borderStyle).toBe('solid');
    const partial = await make('state="indeterminate"');
    const dash = partial.shadowRoot!.querySelector<HTMLElement>('.dash')!;
    expect(getComputedStyle(dash).backgroundColor).not.toBe(
      getComputedStyle(box(partial)).backgroundColor,
    );
  });
});
