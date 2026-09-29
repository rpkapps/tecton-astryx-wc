/**
 * tct-top-nav-menu (and the disclosure behaviour it shares with the mega menu): disclosure navigation,
 * not an ARIA menu. The button reports aria-expanded and owns aria-controls, the panel is a labelled group
 * of ordinary links; the keyboard contract (Enter and Space toggle, a keyboard open enters the panel, Tab
 * moves through the links and out of the panel, the Arrow keys, Home and End as an enhancement, Escape
 * closes and returns focus), the pointer contract (hover opens and closes a transient panel, a click within
 * the guard pins it, an outside press closes it), one open panel at a time, and the placement per region in
 * LTR and RTL (ported from the upstream TopNavMenu tests, with the ARIA menu contract replaced).
 */
import {html} from 'lit';
import {afterEach, describe, expect, it} from 'vitest';
import {page, userEvent} from 'vitest/browser';
import {containsFlat, deepActiveElement} from '@tecton-wc/core/utils/focus.js';
import {axNode, expectAccessible} from '@tecton-wc/testing/a11y.js';
import {recordEvents} from '@tecton-wc/testing/events.js';
import {fixture} from '@tecton-wc/testing/fixture.js';
import {pressKeys} from '@tecton-wc/testing/keyboard.js';
import {runElementSuite} from '@tecton-wc/testing/suites/element.js';
import {isTier2} from '@tecton-wc/testing/tier.js';
import {animationsFinished, nextFrame, waitUntil} from '@tecton-wc/testing/timing.js';
import {
  isOpen,
  layerOf,
  linkOf,
  menuBar,
  MENU_ITEMS,
  panelOf,
  triggerOf,
} from './top-nav-test-helpers.js';

afterEach(async () => {
  await userEvent.hover(document.body, {position: {x: 0, y: 0}}).catch(() => undefined);
});

runElementSuite({
  tag: 'tct-top-nav-menu',
  render: () =>
    html`<tct-top-nav-menu label="Products"
      ><tct-top-nav-mega-menu-item heading="Analytics" href="#a"></tct-top-nav-mega-menu-item
    ></tct-top-nav-menu>`,
  properties: {label: 'Products', delay: 300, hideDelay: 400, open: true},
  attributes: {label: 'label', delay: 'delay', hideDelay: 'hide-delay', open: 'open'},
  events: ['tct-open-change', 'tct-after-open-change'],
  // An open panel sits in the top layer; the default render is closed.
});

const TAG = 'tct-top-nav-menu' as const;

describe('tct-top-nav-menu: disclosure semantics', () => {
  it('is a button that reports aria-expanded and aria-controls, with no ARIA menu, popup or dialog semantics', async () => {
    const {first} = await menuBar(TAG);
    const button = triggerOf(first);
    const state = await axNode(button);
    expect(state).toMatchObject({role: 'button', name: 'Products', expanded: 'false'});
    expect(state.haspopup ?? 'false').toBe('false');
    expect(button.hasAttribute('aria-haspopup')).toBe(false);
    // The panel is in the same tree, so the relationship resolves.
    const panel = panelOf(first);
    expect(button.getAttribute('aria-controls')).toBe(panel.id);
    expect(first.shadowRoot!.getElementById(panel.id)).toBe(panel);
    expect(
      first.shadowRoot!.querySelector('[role="menu"], [role="menuitem"], [role="dialog"]'),
    ).toBeNull();
  });

  it('the panel is a group named by the label, holding ordinary links with their titles as names', async () => {
    const {first} = await menuBar(TAG);
    await first.show();
    await animationsFinished(layerOf(first));
    const panel = panelOf(first);
    expect(await axNode(panel)).toMatchObject({role: 'group', name: 'Products'});
    const links = [...first.querySelectorAll('tct-top-nav-mega-menu-item')].map(linkOf);
    expect(links.map((link) => link.localName)).toEqual(['a', 'a', 'a']);
    const names = await Promise.all(links.map(async (link) => axNode(link)));
    expect(names.map((node) => node.name)).toEqual(['Analytics', 'Messaging', 'Reports']);
    // The description describes the link, it does not lengthen its name.
    expect(names[0]!.description).toBe('Track behaviour');
    expect(names.every((node) => node.role === 'link')).toBe(true);
  });

  it('reports the state with aria-expanded when it opens and closes', async () => {
    const {first} = await menuBar(TAG);
    await first.show();
    expect((await axNode(triggerOf(first))).expanded).toBe('true');
    if (!isTier2) expect(first.matches(':state(open)')).toBe(true);
    await first.hide();
    expect((await axNode(triggerOf(first))).expanded).toBe('false');
  });

  it('is accessible closed and open', async () => {
    const {bar, first} = await menuBar(TAG);
    await expectAccessible(bar);
    await first.show();
    await animationsFinished(layerOf(first));
    await expectAccessible(bar);
  });

  it('renders destinations given as data: links, buttons with onClick, title, description and icon', async () => {
    await page.viewport(1000, 700);
    const bar = await fixture<HTMLElement>(
      `<tct-top-nav><tct-top-nav-menu id="m" label="Data"></tct-top-nav-menu></tct-top-nav>`,
    );
    const menu = bar.querySelector<HTMLElement & {items: unknown; show(): Promise<void>}>('#m')!;
    const calls: string[] = [];
    menu.items = [
      {title: 'Analytics', description: 'Track', icon: 'funnel', href: '#a'},
      {
        title: 'Export',
        onClick: () => {
          calls.push('export');
        },
      },
    ];
    await menu.show();
    await animationsFinished(layerOf(menu));
    const entries = [...menu.shadowRoot!.querySelectorAll('tct-top-nav-mega-menu-item')];
    expect(entries.map((entry) => linkOf(entry).localName)).toEqual(['a', 'button']);
    expect(entries[0]!.shadowRoot!.querySelector('.description')!.textContent).toBe('Track');
    expect(entries[0]!.shadowRoot!.querySelector('tct-icon')!.getAttribute('name')).toBe('funnel');
    await userEvent.click(linkOf(entries[1]!));
    expect(calls).toEqual(['export']);
    await waitUntil(() => !isOpen(menu), 'choosing closes the panel');
  });
});

describe('tct-top-nav-menu: keyboard', () => {
  it('Enter opens it and moves focus to the first link; Escape closes it and returns focus to the button', async () => {
    const {first} = await menuBar(TAG);
    const button = triggerOf(first);
    button.focus();
    await pressKeys('Enter');
    await waitUntil(() => isOpen(first), 'the panel opens');
    const links = [...first.querySelectorAll('tct-top-nav-mega-menu-item')];
    await waitUntil(
      () => containsFlat(links[0], deepActiveElement()),
      'focus is on the first link',
    );
    await pressKeys('Escape');
    await waitUntil(() => !isOpen(first), 'Escape closes it');
    await waitUntil(() => deepActiveElement() === button, 'focus returns to the button');
    expect((await axNode(button)).expanded).toBe('false');
  });

  it('Space opens it too', async () => {
    const {first} = await menuBar(TAG);
    triggerOf(first).focus();
    await pressKeys('Space');
    await waitUntil(() => isOpen(first), 'Space opens it');
  });

  it('Enter on the button while focus is back on it closes the open panel', async () => {
    const {first} = await menuBar(TAG);
    const button = triggerOf(first);
    button.focus();
    await pressKeys('Enter');
    await waitUntil(() => isOpen(first), 'the panel opens');
    await pressKeys('Shift+Tab');
    await waitUntil(() => deepActiveElement() === button, 'focus is back on the button');
    await pressKeys('Enter');
    await waitUntil(() => !isOpen(first), 'Enter toggles it closed');
  });

  it('Tab moves through the links in order and out of the last one, which closes the panel', async () => {
    const {first} = await menuBar(TAG);
    const button = triggerOf(first);
    button.focus();
    await pressKeys('Enter');
    await waitUntil(() => isOpen(first), 'the panel opens');
    const links = [...first.querySelectorAll('tct-top-nav-mega-menu-item')];
    await waitUntil(() => containsFlat(links[0], deepActiveElement()), 'first link');
    await pressKeys('Tab');
    expect(containsFlat(links[1], deepActiveElement())).toBe(true);
    await pressKeys('Tab');
    expect(containsFlat(links[2], deepActiveElement())).toBe(true);
    await pressKeys('Tab');
    // Past the last link the focus is on the next control of the bar, and the panel has closed.
    await waitUntil(() => !isOpen(first), 'leaving the panel closes it');
    expect(containsFlat(first, deepActiveElement())).toBe(false);
  });

  it('Shift+Tab from the first link returns to the button without closing the panel', async () => {
    const {first} = await menuBar(TAG);
    const button = triggerOf(first);
    button.focus();
    await pressKeys('Enter');
    await waitUntil(() => isOpen(first), 'the panel opens');
    await waitUntil(
      () => containsFlat(first.querySelector('tct-top-nav-mega-menu-item'), deepActiveElement()),
      'first link',
    );
    await pressKeys('Shift+Tab');
    expect(deepActiveElement()).toBe(button);
    expect(isOpen(first)).toBe(true);
  });

  it('the Arrow keys, Home and End move between the links (an enhancement)', async () => {
    const {first} = await menuBar(TAG);
    const button = triggerOf(first);
    button.focus();
    await pressKeys('ArrowDown');
    await waitUntil(() => isOpen(first), 'ArrowDown opens it');
    const links = [...first.querySelectorAll('tct-top-nav-mega-menu-item')];
    await waitUntil(
      () => containsFlat(links[0], deepActiveElement()),
      'ArrowDown enters the panel',
    );
    await pressKeys('ArrowDown');
    expect(containsFlat(links[1], deepActiveElement())).toBe(true);
    await pressKeys('End');
    expect(containsFlat(links[2], deepActiveElement())).toBe(true);
    await pressKeys('ArrowUp');
    expect(containsFlat(links[1], deepActiveElement())).toBe(true);
    await pressKeys('Home');
    expect(containsFlat(links[0], deepActiveElement())).toBe(true);
    // The ends do not wrap.
    await pressKeys('ArrowUp');
    expect(containsFlat(links[0], deepActiveElement())).toBe(true);
  });

  it('Escape closes one layer: an open menu inside a dialog leaves the dialog alone', async () => {
    const {first} = await menuBar(TAG);
    await first.show();
    await pressKeys('Escape');
    await waitUntil(() => !isOpen(first), 'Escape closes the panel');
  });

  it('reaches the button of each menu and the plain item with Tab, in document order', async () => {
    const {bar, first, second} = await menuBar(TAG);
    const plain = bar.querySelector<HTMLElement>('#plain')!;
    triggerOf(first).focus();
    await pressKeys('Tab');
    expect(containsFlat(plain, deepActiveElement())).toBe(true);
    await pressKeys('Tab');
    expect(deepActiveElement()).toBe(triggerOf(second));
  });
});

describe('tct-top-nav-menu: pointer', () => {
  it('a click opens it and leaves focus on the button; a second click closes it', async () => {
    const {first} = await menuBar(TAG);
    const button = triggerOf(first);
    await userEvent.click(button);
    await waitUntil(() => isOpen(first), 'a click opens it');
    expect(deepActiveElement()).toBe(button);
    await userEvent.click(button);
    await waitUntil(() => !isOpen(first), 'a second click closes it');
  });

  it('an outside press closes it', async () => {
    const {first} = await menuBar(TAG);
    await first.show();
    await userEvent.click(document.body, {position: {x: 900, y: 650}});
    await waitUntil(() => !isOpen(first), 'an outside press closes it');
  });

  it('hover opens it after the delay, without moving focus, and leaving closes it', async () => {
    const {first} = await menuBar(TAG);
    const before = deepActiveElement();
    await userEvent.hover(triggerOf(first));
    await waitUntil(() => isOpen(first), 'hover opens it');
    expect(deepActiveElement()).toBe(before);
    await userEvent.hover(document.body, {position: {x: 900, y: 650}});
    await waitUntil(() => !isOpen(first), 'leaving closes a hover-open');
  });

  it('the pointer can travel onto the panel: the panel stays open while it is hovered', async () => {
    const {first} = await menuBar(TAG);
    await userEvent.hover(triggerOf(first));
    await waitUntil(() => isOpen(first), 'hover opens it');
    await animationsFinished(layerOf(first));
    await userEvent.hover(linkOf(first.querySelector('tct-top-nav-mega-menu-item')!));
    await new Promise((resolve) => setTimeout(resolve, first.hideDelay + 100));
    expect(isOpen(first)).toBe(true);
  });

  it('a click right after a hover-open confirms it (pins it), and leaving no longer closes it', async () => {
    const {first} = await menuBar(TAG);
    await userEvent.hover(triggerOf(first));
    await waitUntil(() => isOpen(first), 'hover opens it');
    await userEvent.click(triggerOf(first));
    await nextFrame();
    expect(isOpen(first)).toBe(true);
    await userEvent.hover(document.body, {position: {x: 900, y: 650}});
    await new Promise((resolve) => setTimeout(resolve, first.hideDelay + 100));
    expect(isOpen(first)).toBe(true);
    await userEvent.click(triggerOf(first));
    await waitUntil(() => !isOpen(first), 'the next click closes it');
  });

  it('a click well after a hover-open closes it', async () => {
    const {first} = await menuBar(TAG);
    await userEvent.hover(triggerOf(first));
    await waitUntil(() => isOpen(first), 'hover opens it');
    await new Promise((resolve) => setTimeout(resolve, 650));
    await userEvent.click(triggerOf(first));
    await waitUntil(() => !isOpen(first), 'a late click closes it');
  });

  it('opening a sibling closes the first: one panel at a time', async () => {
    const {first, second} = await menuBar(TAG);
    await userEvent.click(triggerOf(first));
    await waitUntil(() => isOpen(first), 'the first opens');
    await userEvent.click(triggerOf(second));
    await waitUntil(() => isOpen(second), 'the second opens');
    await waitUntil(() => !isOpen(first), 'the first closed');
  });

  it('choosing a link closes it', async () => {
    const {first} = await menuBar(TAG);
    await userEvent.click(triggerOf(first));
    await waitUntil(() => isOpen(first), 'the panel opens');
    const link = linkOf(first.querySelector('tct-top-nav-mega-menu-item')!);
    link.addEventListener('click', (event) => {
      event.preventDefault();
    });
    await userEvent.click(link);
    await waitUntil(() => !isOpen(first), 'choosing closes it');
  });
});

describe('tct-top-nav-menu: state and events', () => {
  it('the user asks with a cancelable tct-open-change; property writes and methods never raise it', async () => {
    const {first} = await menuBar(TAG);
    const events = recordEvents(first, ['tct-open-change', 'tct-after-open-change']);
    await userEvent.click(triggerOf(first));
    await waitUntil(() => isOpen(first), 'a click opens it');
    expect(events.named('tct-open-change')[0]).toMatchObject({open: true, reason: 'trigger'});
    expect(events.named('tct-open-change')[0]!.cancelable).toBe(true);
    await waitUntil(() => events.named('tct-after-open-change').length === 1, 'the commit event');
    await pressKeys('Escape');
    await waitUntil(() => !isOpen(first), 'Escape closes it');
    expect(events.named('tct-open-change').at(-1)).toMatchObject({open: false, reason: 'escape'});
    const count = events.named('tct-open-change').length;
    await first.show();
    await first.hide();
    first.open = true;
    await first.updateComplete;
    expect(events.named('tct-open-change').length).toBe(count);
  });

  it('a prevented tct-open-change keeps the panel as it is', async () => {
    const {first} = await menuBar(TAG);
    first.addEventListener('tct-open-change', (event) => {
      event.preventDefault();
    });
    await userEvent.click(triggerOf(first));
    await nextFrame();
    expect(first.open).toBe(false);
    expect(isOpen(first)).toBe(false);
  });

  it('requestClose() asks as the user would', async () => {
    const {first} = await menuBar(TAG);
    await first.show();
    const events = recordEvents(first, ['tct-open-change']);
    first.requestClose();
    await waitUntil(() => !isOpen(first), 'requestClose closes it');
    expect(events.named('tct-open-change')[0]).toMatchObject({open: false, reason: 'request'});
  });

  it('starts open with the attribute', async () => {
    await page.viewport(1000, 700);
    const bar = await fixture<HTMLElement>(
      `<tct-top-nav><tct-top-nav-menu id="m" label="Products" open>${MENU_ITEMS}</tct-top-nav-menu></tct-top-nav>`,
    );
    const menu = bar.querySelector('#m')!;
    await waitUntil(() => isOpen(menu), 'the panel is open');
  });
});

describe('tct-top-nav-menu: placement', () => {
  for (const dir of [undefined, 'rtl'] as const) {
    const name = dir === 'rtl' ? 'RTL' : 'LTR';

    it(`opens below the button, at the start edge of a start-region item (${name})`, async () => {
      const {first} = await menuBar(TAG, {dir});
      await first.show();
      await animationsFinished(layerOf(first));
      const button = triggerOf(first).getBoundingClientRect();
      const panel = layerOf(first).getBoundingClientRect();
      expect(panel.top).toBeGreaterThanOrEqual(button.bottom);
      if (dir === 'rtl') expect(Math.abs(panel.right - button.right)).toBeLessThan(2);
      else expect(Math.abs(panel.left - button.left)).toBeLessThan(2);
    });

    it(`aligns to the end edge of an end-region item (${name})`, async () => {
      const {first} = await menuBar(TAG, {dir, region: 'end'});
      await first.show();
      await animationsFinished(layerOf(first));
      const button = triggerOf(first).getBoundingClientRect();
      const panel = layerOf(first).getBoundingClientRect();
      if (dir === 'rtl') expect(Math.abs(panel.left - button.left)).toBeLessThan(2);
      else expect(Math.abs(panel.right - button.right)).toBeLessThan(2);
    });

    it(`centres under a centre-region item (${name})`, async () => {
      const {first} = await menuBar(TAG, {dir, region: 'center'});
      await first.show();
      await animationsFinished(layerOf(first));
      const button = triggerOf(first).getBoundingClientRect();
      const panel = layerOf(first).getBoundingClientRect();
      expect(
        Math.abs(panel.left + panel.width / 2 - (button.left + button.width / 2)),
      ).toBeLessThan(2);
    });
  }

  it('never grows past the viewport: a short screen scrolls the panel inside', async () => {
    const {first} = await menuBar(TAG, {});
    await page.viewport(1000, 160);
    await first.show();
    await animationsFinished(layerOf(first));
    const panel = panelOf(first);
    expect(layerOf(first).getBoundingClientRect().bottom).toBeLessThanOrEqual(
      window.innerHeight + 8,
    );
    expect(panel.scrollHeight).toBeGreaterThan(panel.clientHeight);
  });
});

describe('tct-top-nav-menu: the drawer form and the mobile bar', () => {
  it('renders nothing of its own in the mobile bar', async () => {
    await page.viewport(1000, 700);
    const bar = await fixture<HTMLElement>(
      `<tct-top-nav><tct-top-nav-menu id="m" label="Products">${MENU_ITEMS}</tct-top-nav-menu></tct-top-nav>`,
    );
    const menu = bar.querySelector('#m')!;
    expect(menu.shadowRoot!.querySelector('.trigger')).not.toBeNull();
  });
});
