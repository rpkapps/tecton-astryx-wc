import {html} from 'lit';
import {describe, expect, it} from 'vitest';
import {axNode, expectAccessible} from '@tecton-astryx/testing/a11y.js';
import {emulateMedia} from '@tecton-astryx/testing/emulate.js';
import {fixture} from '@tecton-astryx/testing/fixture.js';
import {runElementSuite} from '@tecton-astryx/testing/suites/element.js';
import {isChromium} from '@tecton-astryx/testing/tier.js';
import {STATUS_DOT_VARIANTS} from './status-dot.types.js';
import './define.js';
import type {TctStatusDot} from './tct-status-dot.js';

const dotOf = (element: TctStatusDot): HTMLElement =>
  element.shadowRoot!.querySelector<HTMLElement>('.dot')!;

runElementSuite({
  tag: 'tct-status-dot',
  render: () => `<tct-status-dot variant="success" label="Online"></tct-status-dot>`,
  properties: {variant: 'error', label: 'Offline', pulsing: true},
  attributes: {variant: 'variant', label: 'label', pulsing: 'pulsing'},
});

describe('tct-status-dot (StatusDot.test.tsx)', () => {
  it('renders with role="img" and aria-label', async () => {
    const element = await fixture<TctStatusDot>(
      html`<tct-status-dot variant="success" label="Online"></tct-status-dot>`,
    );
    const dot = dotOf(element);
    expect(dot.getAttribute('role')).toBe('img');
    expect(dot.getAttribute('aria-label')).toBe('Online');
    if (isChromium) {
      const node = await axNode(dot);
      expect([node.role, node.name]).toEqual(['image', 'Online']);
    }
  });

  it('renders as an inline-flex host with a span dot', async () => {
    const element = await fixture<TctStatusDot>(
      html`<tct-status-dot variant="success" label="Online"></tct-status-dot>`,
    );
    expect(getComputedStyle(element).display).toBe('inline-flex');
    expect(dotOf(element).localName).toBe('span');
  });

  it('renders with all variant types', async () => {
    for (const variant of STATUS_DOT_VARIANTS) {
      const element = await fixture<TctStatusDot>(
        html`<tct-status-dot variant=${variant} label=${variant}></tct-status-dot>`,
      );
      expect(element.variant).toBe(variant);
      expect(getComputedStyle(dotOf(element)).backgroundColor, variant).not.toBe(
        'rgba(0, 0, 0, 0)',
      );
    }
  });

  it('paints each variant from a different role', async () => {
    const fills = new Set<string>();
    for (const variant of STATUS_DOT_VARIANTS) {
      const element = await fixture<TctStatusDot>(
        html`<tct-status-dot variant=${variant} label=${variant}></tct-status-dot>`,
      );
      fills.add(getComputedStyle(dotOf(element)).backgroundColor);
    }
    expect(fills.size).toBe(STATUS_DOT_VARIANTS.length);
  });

  it('renders at fixed 8px size', async () => {
    const element = await fixture<TctStatusDot>(
      html`<tct-status-dot variant="success" label="Online"></tct-status-dot>`,
    );
    const box = dotOf(element).getBoundingClientRect();
    expect([box.width, box.height]).toEqual([8, 8]);
    expect(getComputedStyle(dotOf(element)).borderTopLeftRadius).not.toBe('0px');
  });

  it('supports data-* attributes on the host', async () => {
    const element = await fixture<TctStatusDot>(
      html`<tct-status-dot variant="success" label="Online" data-testid="dot"></tct-status-dot>`,
    );
    expect(element.dataset['testid']).toBe('dot');
  });

  it('is not focusable', async () => {
    const element = await fixture<TctStatusDot>(
      html`<tct-status-dot variant="success" label="Online"></tct-status-dot>`,
    );
    expect(element.hasAttribute('tabindex')).toBe(false);
    expect(dotOf(element).hasAttribute('tabindex')).toBe(false);
    element.focus();
    expect(document.activeElement).not.toBe(element);
  });

  it('renders with pulsing', async () => {
    const element = await fixture<TctStatusDot>(
      html`<tct-status-dot variant="success" label="Live" pulsing></tct-status-dot>`,
    );
    const style = getComputedStyle(dotOf(element));
    expect(style.animationName).toBe('tct-pulse');
    expect(style.animationDuration).toBe('2s');
    expect(style.animationIterationCount).toBe('infinite');
  });

  it('renders without pulsing by default', async () => {
    const element = await fixture<TctStatusDot>(
      html`<tct-status-dot variant="success" label="Online"></tct-status-dot>`,
    );
    expect(element.pulsing).toBe(false);
    expect(getComputedStyle(dotOf(element)).animationName).toBe('none');
  });

  it.skipIf(!isChromium)('stops pulsing under prefers-reduced-motion', async () => {
    await emulateMedia({reducedMotion: 'reduce'});
    const element = await fixture<TctStatusDot>(
      html`<tct-status-dot variant="success" label="Live" pulsing></tct-status-dot>`,
    );
    expect(getComputedStyle(dotOf(element)).animationName).toBe('none');
  });

  it('renders every variant as a plain childless dot by default (design review #4373)', async () => {
    for (const variant of STATUS_DOT_VARIANTS) {
      const element = await fixture<TctStatusDot>(
        html`<tct-status-dot variant=${variant} label=${`plain-${variant}`}></tct-status-dot>`,
      );
      expect(dotOf(element).childElementCount, variant).toBe(0);
    }
  });

  describe('custom icon (parity with AvatarStatusDot)', () => {
    const withIcon = () =>
      fixture<TctStatusDot>(
        html`<tct-status-dot variant="success" label="Verified"
          ><svg slot="icon" data-testid="custom-icon" viewBox="0 0 8 8"></svg
        ></tct-status-dot>`,
      );

    it('renders a provided icon inside the dot', async () => {
      const element = await withIcon();
      await element.updateComplete;
      const slot = dotOf(element).querySelector<HTMLSlotElement>('slot[name="icon"]')!;
      expect(slot.assignedElements()).toHaveLength(1);
      const box = element.querySelector('svg')!.getBoundingClientRect();
      expect([box.width, box.height]).toEqual([8, 8]);
    });

    it('hides the icon wrapper from assistive tech (the label carries the status)', async () => {
      const element = await withIcon();
      await element.updateComplete;
      const wrapper = dotOf(element).querySelector('.icon-slot')!;
      expect(wrapper.getAttribute('aria-hidden')).toBe('true');
    });

    it('draws no icon wrapper when nothing is slotted (safe for conditional icons)', async () => {
      const element = await fixture<TctStatusDot>(
        html`<tct-status-dot variant="error" label="Offline"></tct-status-dot>`,
      );
      expect(dotOf(element).querySelector('.icon-slot')).toBeNull();
      expect(dotOf(element).childElementCount).toBe(0);
    });

    it('keeps the accessible name on the dot when an icon renders', async () => {
      const element = await withIcon();
      await element.updateComplete;
      const dot = dotOf(element);
      expect(dot.getAttribute('role')).toBe('img');
      expect(dot.getAttribute('aria-label')).toBe('Verified');
      if (isChromium) expect((await axNode(dot)).name).toBe('Verified');
    });
  });

  describe('variant ink (a passed icon paints from currentColor)', () => {
    it('pairs the warning plate with the dedicated dark on-warning ink', async () => {
      const wrapper = await fixture<HTMLElement>(
        html`<div>
          <tct-status-dot variant="warning" label="Degraded"></tct-status-dot>
          <span id="probe" style="color: var(--color-on-warning)"></span>
        </div>`,
      );
      const dot = dotOf(wrapper.querySelector<TctStatusDot>('tct-status-dot')!);
      const probe = getComputedStyle(wrapper.querySelector('#probe')!).color;
      expect(getComputedStyle(dot).color).toBe(probe);
    });

    it('pairs every variant with an ink that differs from its plate', async () => {
      for (const variant of STATUS_DOT_VARIANTS) {
        const element = await fixture<TctStatusDot>(
          html`<tct-status-dot variant=${variant} label=${variant}></tct-status-dot>`,
        );
        const style = getComputedStyle(dotOf(element));
        expect(style.color, variant).not.toBe(style.backgroundColor);
      }
    });
  });

  describe('accessible name (label reaches AT without hover)', () => {
    it('exposes the status label as the accessible name for every variant, without a tooltip', async () => {
      for (const variant of STATUS_DOT_VARIANTS) {
        const element = await fixture<TctStatusDot>(
          html`<tct-status-dot variant=${variant} label=${`Status: ${variant}`}></tct-status-dot>`,
        );
        const dot = dotOf(element);
        expect(dot.getAttribute('aria-label')).toBe(`Status: ${variant}`);
        // The name must not depend on hover or focus.
        expect(dot.getAttribute('tabindex')).toBeNull();
        if (isChromium) expect((await axNode(dot)).name).toBe(`Status: ${variant}`);
      }
    });

    it('updates the name when the label changes', async () => {
      const element = await fixture<TctStatusDot>(
        html`<tct-status-dot variant="success" label="Online"></tct-status-dot>`,
      );
      element.label = 'Away';
      await element.updateComplete;
      expect(dotOf(element).getAttribute('aria-label')).toBe('Away');
    });

    it('passes axe for every variant in a labelled context', async () => {
      const wrapper = await fixture<HTMLElement>(
        html`<div>
          ${STATUS_DOT_VARIANTS.map(
            (variant) =>
              html`<div>
                <tct-status-dot variant=${variant} label=${variant}></tct-status-dot> ${variant}
              </div>`,
          )}
        </div>`,
      );
      await expectAccessible(wrapper);
    });
  });
});

describe('tct-status-dot: unknown variant', () => {
  it('falls back to the success colours for an unknown variant', async () => {
    const wrapper = await fixture<HTMLElement>(
      html`<div>
        <tct-status-dot variant="success" label="a"></tct-status-dot>
        <tct-status-dot variant="bogus" label="b"></tct-status-dot>
      </div>`,
    );
    const [known, unknown] = [...wrapper.querySelectorAll<TctStatusDot>('tct-status-dot')].map(
      (element) => getComputedStyle(dotOf(element)).backgroundColor,
    );
    expect(unknown).toBe(known);
  });
});

describe('tct-status-dot: forced colours and direction', () => {
  it.skipIf(!isChromium)('stays visible in forced colours', async () => {
    await emulateMedia({forcedColors: 'active'});
    const element = await fixture<TctStatusDot>(
      html`<tct-status-dot variant="error" label="Offline"></tct-status-dot>`,
    );
    const style = getComputedStyle(dotOf(element));
    expect(style.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
    expect(style.backgroundColor).not.toBe(style.color);
  });

  it('keeps its size in a right-to-left context', async () => {
    const wrapper = await fixture<HTMLElement>(
      html`<div dir="rtl"><tct-status-dot variant="success" label="Online"></tct-status-dot></div>`,
    );
    const box = dotOf(
      wrapper.querySelector<TctStatusDot>('tct-status-dot')!,
    ).getBoundingClientRect();
    expect([box.width, box.height]).toEqual([8, 8]);
  });
});
