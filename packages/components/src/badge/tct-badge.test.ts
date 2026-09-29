import {html} from 'lit';
import {describe, expect, it} from 'vitest';
import {axNode, expectAccessible} from '@tecton-astryx/testing/a11y.js';
import {emulateMedia} from '@tecton-astryx/testing/emulate.js';
import {fixture} from '@tecton-astryx/testing/fixture.js';
import {isChromium} from '@tecton-astryx/testing/tier.js';
import {runElementSuite} from '@tecton-astryx/testing/suites/element.js';
import {BADGE_VARIANTS} from './badge.types.js';
import '../icon/define.js';
import './define.js';
import type {TctBadge} from './tct-badge.js';

runElementSuite({
  tag: 'tct-badge',
  render: () => `<tct-badge>Active</tct-badge>`,
  properties: {variant: 'success', label: 'Ready'},
  attributes: {variant: 'variant'},
});

describe('tct-badge', () => {
  it('renders with the default neutral variant', async () => {
    const badge = await fixture<TctBadge>(html`<tct-badge>Default</tct-badge>`);
    expect(badge.variant).toBe('neutral');
    expect(badge.textContent).toBe('Default');
    expect(badge.shadowRoot!.querySelector('.label slot')).not.toBeNull();
  });

  it('renders every variant with its own fill', async () => {
    const fills = new Set<string>();
    for (const variant of BADGE_VARIANTS) {
      const badge = await fixture<TctBadge>(
        html`<tct-badge variant=${variant}>${variant}</tct-badge>`,
      );
      expect(badge.getAttribute('variant')).toBe(variant);
      const base = badge.shadowRoot!.querySelector<HTMLElement>('.base')!;
      const style = getComputedStyle(base);
      expect(style.backgroundColor, variant).not.toBe('rgba(0, 0, 0, 0)');
      fills.add(`${style.backgroundColor}|${style.color}`);
    }
    // Tokens resolve per variant; the pairs are not all the same colour.
    expect(fills.size).toBeGreaterThan(8);
  });

  it('reflects the variant attribute to the property and back', async () => {
    const badge = await fixture<TctBadge>(html`<tct-badge variant="error">x</tct-badge>`);
    expect(badge.variant).toBe('error');
    badge.variant = 'purple';
    await badge.updateComplete;
    expect(badge.getAttribute('variant')).toBe('purple');
  });

  it('renders the label attribute instead of the slot', async () => {
    const badge = await fixture<TctBadge>(
      html`<tct-badge label="From attribute">ignored</tct-badge>`,
    );
    const label = badge.shadowRoot!.querySelector('.label')!;
    expect(label.textContent.trim()).toBe('From attribute');
    expect(label.querySelector('slot')).toBeNull();
  });

  it('renders the icon slot only when an icon is provided', async () => {
    const plain = await fixture<TctBadge>(html`<tct-badge>No icon</tct-badge>`);
    expect(plain.shadowRoot!.querySelector('[part~="icon"]')).toBeNull();
    const withIcon = await fixture<TctBadge>(
      html`<tct-badge><svg slot="icon" width="16" height="16"></svg>With icon</tct-badge>`,
    );
    const wrapper = withIcon.shadowRoot!.querySelector('[part~="icon"]')!;
    expect(wrapper).not.toBeNull();
    expect(wrapper.querySelector('slot')!.assignedElements()).toHaveLength(1);
  });

  it('sizes a slotted tct-icon to the badge (16px) and keeps it decorative', async () => {
    const badge = await fixture<TctBadge>(
      html`<tct-badge variant="success"
        ><tct-icon slot="icon" name="check"></tct-icon>Verified</tct-badge
      >`,
    );
    const icon = badge.querySelector<HTMLElement>('tct-icon')!;
    expect(icon.getBoundingClientRect().width).toBe(16);
    await expectAccessible(badge);
    if (isChromium) expect((await axNode(icon)).ignored).toBe('true');
  });

  it('adds an icon when one is slotted later', async () => {
    const badge = await fixture<TctBadge>(html`<tct-badge>Later</tct-badge>`);
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('slot', 'icon');
    badge.append(icon);
    await new Promise((resolve) => setTimeout(resolve, 0));
    await badge.updateComplete;
    expect(badge.shadowRoot!.querySelector('[part~="icon"]')).not.toBeNull();
  });

  describe('full-label fallback (upstream: carries the full text in title)', () => {
    const titleOf = (badge: TctBadge) =>
      badge.shadowRoot!.querySelector<HTMLElement>('.label')!.getAttribute('title');

    it('carries the full text in title for a plain-text slot label', async () => {
      const badge = await fixture<TctBadge>(html`<tct-badge>Awaiting security review</tct-badge>`);
      expect(titleOf(badge)).toBe('Awaiting security review');
    });

    it('carries the label attribute in title, numbers included', async () => {
      const badge = await fixture<TctBadge>(html`<tct-badge label="42"></tct-badge>`);
      expect(titleOf(badge)).toBe('42');
    });

    it('sets no title for a rich label', async () => {
      const badge = await fixture<TctBadge>(html`<tct-badge><strong>Rich</strong></tct-badge>`);
      expect(titleOf(badge)).toBeNull();
    });

    it('sets no title for an empty label', async () => {
      const badge = await fixture<TctBadge>(html`<tct-badge label=""></tct-badge>`);
      expect(titleOf(badge)).toBeNull();
    });

    it('follows edits of the slotted text', async () => {
      const badge = await fixture<TctBadge>(html`<tct-badge>Before</tct-badge>`);
      badge.textContent = 'After';
      await new Promise((resolve) => setTimeout(resolve, 0));
      await badge.updateComplete;
      expect(titleOf(badge)).toBe('After');
    });
  });

  it('clips a label wider than its container instead of overflowing it', async () => {
    const wrapper = await fixture<HTMLElement>(
      html`<div style="inline-size: 80px; display: flex">
        <tct-badge>A label that is far too long to fit in eighty pixels</tct-badge>
      </div>`,
    );
    const badge = wrapper.querySelector<TctBadge>('tct-badge')!;
    const base = badge.shadowRoot!.querySelector<HTMLElement>('.base')!;
    const label = badge.shadowRoot!.querySelector<HTMLElement>('.label')!;
    expect(badge.getBoundingClientRect().width).toBeLessThanOrEqual(80);
    expect(base.getBoundingClientRect().width).toBeLessThanOrEqual(80);
    expect(getComputedStyle(label).textOverflow).toBe('ellipsis');
    expect(label.scrollWidth).toBeGreaterThan(label.clientWidth);
  });

  it('is a pill: fixed height and a full radius', async () => {
    const badge = await fixture<TctBadge>(html`<tct-badge>7</tct-badge>`);
    const base = badge.shadowRoot!.querySelector<HTMLElement>('.base')!;
    expect(base.getBoundingClientRect().height).toBe(20);
    expect(parseFloat(getComputedStyle(base).borderTopLeftRadius)).toBeGreaterThan(100);
  });

  describe('accessibility', () => {
    it('has no role: it is text in the reading order', async () => {
      const badge = await fixture<TctBadge>(html`<tct-badge variant="success">Active</tct-badge>`);
      if (isChromium) {
        const node = await axNode(badge);
        expect(node.role).not.toBe('button');
        expect(node.role).not.toBe('img');
      }
      await expectAccessible(badge);
    });

    it.each(BADGE_VARIANTS)('the %s variant passes axe (contrast included)', async (variant) => {
      const wrapper = await fixture<HTMLElement>(
        html`<div><tct-badge variant=${variant}>${variant}</tct-badge></div>`,
      );
      await expectAccessible(wrapper);
    });

    it('passes axe in the dark theme', async () => {
      const wrapper = await fixture<HTMLElement>(
        html`<div>
          ${BADGE_VARIANTS.map((variant) => html`<tct-badge variant=${variant}>${variant}</tct-badge>`)}
        </div>`,
        {theme: 'dark'},
      );
      await expectAccessible(wrapper);
    });
  });

  describe('right-to-left', () => {
    it('places the icon at the inline start and mirrors the layout', async () => {
      const badge = await fixture<TctBadge>(
        html`<tct-badge><svg slot="icon" width="16" height="16"></svg>مرحبا</tct-badge>`,
        {dir: 'rtl'},
      );
      const icon = badge.shadowRoot!.querySelector<HTMLElement>('[part~="icon"]')!;
      const label = badge.shadowRoot!.querySelector<HTMLElement>('.label')!;
      expect(icon.getBoundingClientRect().left).toBeGreaterThan(label.getBoundingClientRect().left);
    });
  });

  describe('forced colours', () => {
    it.skipIf(!isChromium)('keeps a visible edge and uses system colours', async () => {
      await emulateMedia({forcedColors: 'active'});
      const badge = await fixture<TctBadge>(html`<tct-badge variant="error">Failed</tct-badge>`);
      const base = badge.shadowRoot!.querySelector<HTMLElement>('.base')!;
      const style = getComputedStyle(base);
      expect(style.borderTopStyle).toBe('solid');
      expect(style.borderTopWidth).toBe('1px');
      expect(style.borderTopColor).not.toBe('rgba(0, 0, 0, 0)');
    });
  });
});
