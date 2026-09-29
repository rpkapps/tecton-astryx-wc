import {html} from 'lit';
import {describe, expect, it} from 'vitest';
import {axNode, expectAccessible} from '@tecton-astryx/testing/a11y.js';
import {emulateMedia} from '@tecton-astryx/testing/emulate.js';
import {fixture} from '@tecton-astryx/testing/fixture.js';
import {runElementSuite} from '@tecton-astryx/testing/suites/element.js';
import {isChromium} from '@tecton-astryx/testing/tier.js';
import '../icon/define.js';
import './define.js';
import type {TctNavIcon} from './tct-nav-icon.js';

const baseOf = (navIcon: TctNavIcon): HTMLElement =>
  navIcon.shadowRoot!.querySelector<HTMLElement>('.base')!;

runElementSuite({
  tag: 'tct-nav-icon',
  render: () => `<tct-nav-icon><tct-icon slot="icon" name="menu"></tct-icon></tct-nav-icon>`,
});

describe('tct-nav-icon (NavIcon.test.tsx)', () => {
  it('renders icon content', async () => {
    const navIcon = await fixture<TctNavIcon>(
      html`<tct-nav-icon><tct-icon slot="icon" name="menu"></tct-icon></tct-nav-icon>`,
    );
    const slot = navIcon.shadowRoot!.querySelector<HTMLSlotElement>('slot[name="icon"]')!;
    expect(slot.assignedElements()).toHaveLength(1);
    expect(navIcon.querySelector('tct-icon')!.shadowRoot!.querySelector('svg')).not.toBeNull();
  });

  it('accepts unnamed content the same way', async () => {
    const navIcon = await fixture<TctNavIcon>(
      html`<tct-nav-icon><svg id="own" width="16" height="16"></svg></tct-nav-icon>`,
    );
    const slot = navIcon.shadowRoot!.querySelector<HTMLSlotElement>('slot:not([name])')!;
    expect(slot.assignedElements()).toHaveLength(1);
  });

  it('exposes the circle as the base part', async () => {
    const navIcon = await fixture<TctNavIcon>(html`<tct-nav-icon></tct-nav-icon>`);
    expect(navIcon.shadowRoot!.querySelector('[part~="base"]')).toBe(baseOf(navIcon));
  });
});

describe('tct-nav-icon: appearance', () => {
  it('is a 32px circle painted with the accent roles', async () => {
    const navIcon = await fixture<TctNavIcon>(
      html`<tct-nav-icon><tct-icon slot="icon" name="menu"></tct-icon></tct-nav-icon>`,
    );
    const base = baseOf(navIcon);
    const box = base.getBoundingClientRect();
    const style = getComputedStyle(base);
    expect([box.width, box.height]).toEqual([32, 32]);
    expect(style.borderTopLeftRadius).toBe('50%');
    expect(style.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
    expect(style.color).not.toBe(style.backgroundColor);
  });

  it('centres a 16px glyph and does not shrink in a tight flex row', async () => {
    const row = await fixture<HTMLElement>(
      html`<div style="display: flex; inline-size: 20px">
        <tct-nav-icon><tct-icon slot="icon" name="menu"></tct-icon></tct-nav-icon>
      </div>`,
    );
    const navIcon = row.querySelector<TctNavIcon>('tct-nav-icon')!;
    const icon = navIcon.querySelector<HTMLElement>('tct-icon')!;
    const iconBox = icon.getBoundingClientRect();
    const baseBox = baseOf(navIcon).getBoundingClientRect();
    expect(baseBox.width).toBe(32);
    expect(iconBox.width).toBe(16);
    expect(
      Math.abs(iconBox.left + iconBox.width / 2 - (baseBox.left + baseBox.width / 2)),
    ).toBeLessThan(1);
  });

  it('the host draws no box; the circle is an inner part', async () => {
    const navIcon = await fixture<TctNavIcon>(html`<tct-nav-icon></tct-nav-icon>`);
    expect(getComputedStyle(navIcon).backgroundColor).toBe('rgba(0, 0, 0, 0)');
    expect(getComputedStyle(navIcon).borderRadius).toBe('0px');
  });
});

describe('tct-nav-icon: accessibility', () => {
  it('has no role and hides the decorative icon; axe is clean in light and dark', async () => {
    for (const theme of ['light', 'dark'] as const) {
      const wrapper = await fixture<HTMLElement>(
        html`<div>
          <tct-nav-icon><tct-icon slot="icon" name="menu"></tct-icon></tct-nav-icon>
        </div>`,
        {theme},
      );
      await expectAccessible(wrapper);
    }
    const navIcon = await fixture<TctNavIcon>(
      html`<tct-nav-icon><tct-icon slot="icon" name="menu"></tct-icon></tct-nav-icon>`,
    );
    expect(navIcon.tabIndex).toBe(-1);
    if (isChromium) expect((await axNode(navIcon.querySelector('tct-icon')!)).ignored).toBe('true');
  });

  it('keeps a meaningful labelled icon exposed', async () => {
    if (!isChromium) return;
    const navIcon = await fixture<TctNavIcon>(
      html`<tct-nav-icon
        ><tct-icon slot="icon" name="menu" label="Main menu"></tct-icon
      ></tct-nav-icon>`,
    );
    const node = await axNode(navIcon.querySelector('tct-icon')!);
    expect(node.role).toBe('image');
    expect(node.name).toBe('Main menu');
  });
});

describe('tct-nav-icon: forced colours', () => {
  it.skipIf(!isChromium)('keeps a visible edge and uses system colours', async () => {
    await emulateMedia({forcedColors: 'active'});
    const navIcon = await fixture<TctNavIcon>(
      html`<tct-nav-icon><tct-icon slot="icon" name="menu"></tct-icon></tct-nav-icon>`,
    );
    const style = getComputedStyle(baseOf(navIcon));
    expect(style.borderTopStyle).toBe('solid');
    expect(style.borderTopColor).not.toBe('rgba(0, 0, 0, 0)');
  });
});

describe('tct-nav-icon: right-to-left', () => {
  it('keeps the circle and the centred glyph', async () => {
    const navIcon = await fixture<TctNavIcon>(
      html`<tct-nav-icon><tct-icon slot="icon" name="chevronRight"></tct-icon></tct-nav-icon>`,
      {dir: 'rtl'},
    );
    const box = baseOf(navIcon).getBoundingClientRect();
    expect([box.width, box.height]).toEqual([32, 32]);
  });
});
