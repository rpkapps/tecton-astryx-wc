/**
 * tct-top-nav-mega-menu: the wide panel anchored to the bar (not the button), positioned per region in
 * LTR and RTL, the featured area, disclosure semantics for a grid of links (a labelled group, not an ARIA
 * menu), and the shared keyboard and pointer contract (see tct-top-nav-menu.test.ts for the full set).
 * Ported from the upstream TopNavMegaMenu tests.
 */
import {html} from 'lit';
import {afterEach, describe, expect, it} from 'vitest';
import {page, userEvent} from 'vitest/browser';
import {containsFlat, deepActiveElement} from '@tecton-wc/core/utils/focus.js';
import {axNode, expectAccessible} from '@tecton-wc/testing/a11y.js';
import {fixture} from '@tecton-wc/testing/fixture.js';
import {pressKeys} from '@tecton-wc/testing/keyboard.js';
import {runElementSuite} from '@tecton-wc/testing/suites/element.js';
import {animationsFinished, waitUntil} from '@tecton-wc/testing/timing.js';
import {isOpen, layerOf, linkOf, menuBar, MENU_ITEMS, panelOf, triggerOf} from './top-nav-test-helpers.js';

afterEach(async () => {
  await userEvent.hover(document.body, {position: {x: 0, y: 0}}).catch(() => undefined);
});

runElementSuite({
  tag: 'tct-top-nav-mega-menu',
  render: () =>
    html`<tct-top-nav-mega-menu label="Products"><tct-top-nav-mega-menu-item heading="Analytics" href="#a"></tct-top-nav-mega-menu-item></tct-top-nav-mega-menu>`,
  properties: {label: 'Products', delay: 300, hideDelay: 400, open: true},
  attributes: {label: 'label', delay: 'delay', hideDelay: 'hide-delay', open: 'open'},
  events: ['tct-open-change', 'tct-after-open-change'],
});

const TAG = 'tct-top-nav-mega-menu' as const;

const FEATURED = `<tct-top-nav-mega-menu-featured-card slot="featured" id="card" heading="What is new" description="AI features" link-label="Read more" link-href="#news"></tct-top-nav-mega-menu-featured-card>`;

describe('tct-top-nav-mega-menu: semantics', () => {
  it('is a disclosure button with aria-expanded and aria-controls; the panel is a labelled group, not a menu', async () => {
    const {first} = await menuBar(TAG);
    const button = triggerOf(first);
    expect(await axNode(button)).toMatchObject({role: 'button', name: 'Products', expanded: 'false'});
    expect(button.hasAttribute('aria-haspopup')).toBe(false);
    expect(button.getAttribute('aria-controls')).toBe(panelOf(first).id);
    await first.show();
    await animationsFinished(layerOf(first));
    expect(await axNode(panelOf(first))).toMatchObject({role: 'group', name: 'Products'});
    expect(first.shadowRoot!.querySelector('[role="menu"], [role="dialog"], [role="menuitem"]')).toBeNull();
    const names = await Promise.all(
      [...first.querySelectorAll('tct-top-nav-mega-menu-item')].map(async (item) => (await axNode(linkOf(item))).name),
    );
    expect(names).toEqual(['Analytics', 'Messaging', 'Reports']);
  });

  it('Enter opens it and enters the panel; Escape closes it and returns focus to the button', async () => {
    const {first} = await menuBar(TAG);
    const button = triggerOf(first);
    button.focus();
    await pressKeys('Enter');
    await waitUntil(() => isOpen(first), 'the panel opens');
    await waitUntil(
      () => containsFlat(first.querySelector('tct-top-nav-mega-menu-item'), deepActiveElement()),
      'focus enters the panel',
    );
    await pressKeys('Escape');
    await waitUntil(() => !isOpen(first), 'Escape closes it');
    await waitUntil(() => deepActiveElement() === button, 'focus returns to the button');
  });

  it('opens on hover with the default 250 ms hide delay, and a click within the guard pins it', async () => {
    const {first} = await menuBar(TAG);
    expect(first.hideDelay).toBe(250);
    await userEvent.hover(triggerOf(first));
    await waitUntil(() => isOpen(first), 'hover opens it');
    await userEvent.click(triggerOf(first));
    await userEvent.hover(document.body, {position: {x: 900, y: 650}});
    await new Promise((resolve) => setTimeout(resolve, 350));
    expect(isOpen(first)).toBe(true);
  });

  it('opening a menu closes an open mega menu: one panel at a time across kinds', async () => {
    await page.viewport(1000, 700);
    const bar = await fixture<HTMLElement>(
      `<tct-top-nav>
        <tct-top-nav-mega-menu id="mega" label="Mega">${MENU_ITEMS}</tct-top-nav-mega-menu>
        <tct-top-nav-menu id="menu" label="Menu">${MENU_ITEMS}</tct-top-nav-menu>
      </tct-top-nav>`,
    );
    const mega = bar.querySelector('#mega')!;
    const menu = bar.querySelector('#menu')!;
    await userEvent.click(triggerOf(mega));
    await waitUntil(() => isOpen(mega), 'the mega menu opens');
    await userEvent.click(triggerOf(menu));
    await waitUntil(() => isOpen(menu), 'the menu opens');
    await waitUntil(() => !isOpen(mega), 'the mega menu closed');
  });

  it('is accessible closed and open, with and without the featured area', async () => {
    await page.viewport(1000, 700);
    const bar = await fixture<HTMLElement>(
      `<tct-top-nav><tct-top-nav-mega-menu id="m" label="Products">${MENU_ITEMS}${FEATURED}</tct-top-nav-mega-menu></tct-top-nav>`,
    );
    const menu = bar.querySelector<HTMLElement & {show(): Promise<void>}>('#m')!;
    await expectAccessible(bar);
    await menu.show();
    await animationsFinished(layerOf(menu));
    await expectAccessible(bar);
  });
});

describe('tct-top-nav-mega-menu: the panel hangs below the whole bar', () => {
  const rectOf = (element: Element) => element.getBoundingClientRect();
  /** Tolerance: the CSS path aligns exactly, the JS fallback keeps an 8px gutter to the viewport edge. */
  const GUTTER = 10;

  for (const dir of [undefined, 'rtl'] as const) {
    const name = dir === 'rtl' ? 'RTL' : 'LTR';

    it(`aligns to the start edge of the bar, whichever start-region item opens it (${name})`, async () => {
      const {bar, second} = await menuBar(TAG, {dir});
      await second.show();
      await animationsFinished(layerOf(second));
      const nav = rectOf(bar.anchorElement!);
      const panel = rectOf(layerOf(second));
      const button = rectOf(triggerOf(second));
      expect(panel.top).toBeGreaterThanOrEqual(nav.bottom - 1);
      expect(panel.top - nav.bottom).toBeLessThan(12);
      // The JS fallback keeps an 8px gutter to the viewport edge, which the bar touches.
      if (dir === 'rtl') expect(Math.abs(panel.right - nav.right)).toBeLessThan(GUTTER);
      else expect(Math.abs(panel.left - nav.left)).toBeLessThan(GUTTER);
      expect(panel.left + panel.width / 2 < nav.left + nav.width / 2).toBe(dir !== 'rtl');
      // Not anchored to the button: a later item's button is far from the panel's edge.
      const buttonEdge = dir === 'rtl' ? button.right : button.left;
      const panelEdge = dir === 'rtl' ? panel.right : panel.left;
      expect(Math.abs(buttonEdge - panelEdge)).toBeGreaterThan(40);
    });

    it(`aligns to the end edge of the bar for an end-region item (${name})`, async () => {
      const {bar, first} = await menuBar(TAG, {dir, region: 'end'});
      await first.show();
      await animationsFinished(layerOf(first));
      const nav = rectOf(bar.anchorElement!);
      const panel = rectOf(layerOf(first));
      if (dir === 'rtl') expect(Math.abs(panel.left - nav.left)).toBeLessThan(GUTTER);
      else expect(Math.abs(panel.right - nav.right)).toBeLessThan(GUTTER);
      expect(panel.left + panel.width / 2 > nav.left + nav.width / 2).toBe(dir !== 'rtl');
    });

    it(`centres under the bar for a centre-region item (${name})`, async () => {
      const {bar, first} = await menuBar(TAG, {dir, region: 'center'});
      await first.show();
      await animationsFinished(layerOf(first));
      const nav = rectOf(bar.anchorElement!);
      const panel = rectOf(layerOf(first));
      expect(Math.abs(panel.left + panel.width / 2 - (nav.left + nav.width / 2))).toBeLessThan(2);
    });
  }

  it('is at most 960px wide, and never wider than the screen minus a gutter', async () => {
    await page.viewport(1400, 700);
    await page.viewport(1400, 700);
    const wide = await menuBar(TAG, {width: 1400});
    await wide.first.show();
    await animationsFinished(layerOf(wide.first));
    expect(layerOf(wide.first).getBoundingClientRect().width).toBeLessThanOrEqual(960);
    await wide.first.hide();
    const narrow = await menuBar(TAG, {width: 400});
    await narrow.first.show();
    await animationsFinished(layerOf(narrow.first));
    expect(layerOf(narrow.first).getBoundingClientRect().width).toBeLessThanOrEqual(400 - 16 + 1);
  });

  it('shows the items in two columns beside the featured area, and the featured card is a titled link card', async () => {
    await page.viewport(1000, 700);
    const bar = await fixture<HTMLElement>(
      `<tct-top-nav><tct-top-nav-mega-menu id="m" label="Products">${MENU_ITEMS}${FEATURED}</tct-top-nav-mega-menu></tct-top-nav>`,
    );
    const menu = bar.querySelector<HTMLElement & {show(): Promise<void>}>('#m')!;
    await menu.show();
    await animationsFinished(layerOf(menu));
    const items = [...menu.querySelectorAll('tct-top-nav-mega-menu-item')].map((item) => item.getBoundingClientRect());
    expect(items[0]!.top).toBe(items[1]!.top);
    expect(items[1]!.left).toBeGreaterThan(items[0]!.left);
    expect(items[2]!.top).toBeGreaterThan(items[0]!.top);
    const card = menu.querySelector('#card')!.getBoundingClientRect();
    expect(card.width).toBeGreaterThan(0);
    const link = menu.querySelector('#card')!.shadowRoot!.querySelector<HTMLElement>('.link')!;
    expect(await axNode(link)).toMatchObject({role: 'link', name: 'Read more →'.replace(' →', '')});
  });

  it('scrolls inside when the space below the bar is short', async () => {
    const {first} = await menuBar(TAG, {});
    await page.viewport(1000, 180);
    await first.show();
    await animationsFinished(layerOf(first));
    const panel = panelOf(first);
    expect(layerOf(first).getBoundingClientRect().bottom).toBeLessThanOrEqual(window.innerHeight + 8);
    expect(panel.scrollHeight).toBeGreaterThan(panel.clientHeight);
  });
});

describe('tct-top-nav-mega-menu: text contrast, light and dark', () => {
  const contrastOnly = {runOnly: {type: 'rule' as const, values: ['color-contrast']}};

  for (const theme of ['light', 'dark'] as const) {
    it(`the open panel, a hovered link and the featured card pass axe colour contrast (${theme})`, async () => {
      await page.viewport(1000, 700);
      const bar = await fixture<HTMLElement>(
        `<tct-top-nav><tct-top-nav-mega-menu id="m" label="Products">${MENU_ITEMS}${FEATURED}</tct-top-nav-mega-menu></tct-top-nav>`,
        {theme},
      );
      const menu = bar.querySelector<HTMLElement & {show(): Promise<void>}>('#m')!;
      await menu.show();
      await animationsFinished(layerOf(menu));
      await expectAccessible(bar, contrastOnly);
      const link = linkOf(menu.querySelector('tct-top-nav-mega-menu-item')!);
      await userEvent.hover(link);
      await animationsFinished(link);
      await expectAccessible(bar, contrastOnly);
    });
  }
});
