/**
 * tct-dropdown-menu-sub-menu: opens with the arrow keys (mirrored in RTL), Escape closes only the
 * flyout and returns to its row, choosing a nested row closes the whole menu, hover intent, async
 * (spinner) submenus and nested levels. Upstream test names are kept where the behaviour applies.
 */
import {describe, expect, it} from 'vitest';
import {userEvent} from 'vitest/browser';
import {
  aTimeout,
  animationsFinished,
  axNode,
  expectAccessible,
  fixture,
  layerStack,
  pressKeys,
  recordEvents,
  runElementSuite,
  waitUntil,
} from '@tecton-astryx/testing/index.js';
import {deepActiveElement} from '@tecton-astryx/core/utils/focus.js';
import './define.js';
import type {TctDropdownMenu} from './tct-dropdown-menu.js';
import type {TctDropdownMenuSubMenu} from './tct-dropdown-menu-sub-menu.js';

const MENU = `
  <tct-dropdown-menu label="Actions">
    <tct-dropdown-menu-item label="Rename"></tct-dropdown-menu-item>
    <tct-dropdown-menu-sub-menu id="move" label="Move to">
      <tct-dropdown-menu-item id="a" label="Folder A"></tct-dropdown-menu-item>
      <tct-dropdown-menu-item id="b" label="Folder B"></tct-dropdown-menu-item>
    </tct-dropdown-menu-sub-menu>
    <tct-dropdown-menu-item label="Delete"></tct-dropdown-menu-item>
  </tct-dropdown-menu>`;

async function mount(
  markup = MENU,
  options: {dir?: 'rtl'} = {},
): Promise<{menu: TctDropdownMenu; sub: TctDropdownMenuSubMenu}> {
  const root = await fixture<HTMLElement>(
    `<div style="padding:60px 40px">${markup}<p id="outside">outside</p></div>`,
    options,
  );
  const menu = root.querySelector<TctDropdownMenu>('tct-dropdown-menu')!;
  const sub = root.querySelector<TctDropdownMenuSubMenu>('tct-dropdown-menu-sub-menu')!;
  await menu.updateComplete;
  return {menu, sub};
}

const trigger = (menu: TctDropdownMenu): HTMLElement =>
  menu.shadowRoot!.querySelector<HTMLElement>('.trigger')!;
const nativeTrigger = (menu: TctDropdownMenu): HTMLElement =>
  trigger(menu).shadowRoot!.querySelector<HTMLElement>('button')!;
const flyout = (sub: TctDropdownMenuSubMenu): HTMLElement =>
  sub.shadowRoot!.querySelector<HTMLElement>('.layer')!;
const flyoutSurface = (sub: TctDropdownMenuSubMenu): HTMLElement =>
  sub.shadowRoot!.querySelector<HTMLElement>('.surface')!;
const isOpen = (sub: TctDropdownMenuSubMenu): boolean => flyout(sub).matches(':popover-open');
const active = (): string =>
  (deepActiveElement() as HTMLElement | null)?.getAttribute('label') ?? '';

async function openMenu(menu: TctDropdownMenu): Promise<void> {
  trigger(menu).shadowRoot!.querySelector('button')!.focus();
  await pressKeys('Enter');
  await waitUntil(
    () => menu.open && menu.shadowRoot!.querySelector('.layer')!.matches(':popover-open'),
    'open',
  );
  await animationsFinished(menu.shadowRoot!.querySelector('.layer')!);
}

/** Focuses the submenu row with the keyboard: ArrowDown from the first row. */
async function focusSubRow(menu: TctDropdownMenu, sub: TctDropdownMenuSubMenu): Promise<void> {
  await openMenu(menu);
  await pressKeys('ArrowDown');
  expect(deepActiveElement()).toBe(sub);
}

runElementSuite({
  tag: 'tct-dropdown-menu-sub-menu',
  render: () => MENU,
  properties: {
    label: 'Other',
    description: 'Hint',
    icon: 'search',
    disabled: true,
    hasSpinner: true,
    menuWidth: '240',
  },
  attributes: {label: 'label', description: 'description', icon: 'icon', menuWidth: 'menu-width'},
  events: ['tct-open-change', 'tct-after-open-change'],
  skip: ['a11y'],
});

describe('DropdownMenuSubMenu', () => {
  it('renders the trigger row with aria-haspopup and collapsed aria-expanded', async () => {
    const {menu, sub} = await mount();
    await openMenu(menu);
    const node = await axNode(sub);
    expect(node.role).toBe('menuitem');
    expect(node.hasPopup).toBe('menu');
    expect(node.expanded).toBe('false');
    expect(node.name).toBe('Move to');
  });

  it('opens on click and exposes its items; the flyout is a menu named from the row', async () => {
    const {menu, sub} = await mount();
    await openMenu(menu);
    // A programmatic click: a real mouse click after a hover longer than the click guard would toggle it shut.
    sub.click();
    await waitUntil(() => sub.open && isOpen(sub), 'flyout open');
    await animationsFinished(flyout(sub));
    expect((await axNode(sub)).expanded).toBe('true');
    const menuNode = await axNode(flyoutSurface(sub));
    expect(menuNode.role).toBe('menu');
    expect(menuNode.name).toBe('Move to');
    await expectAccessible(menu);
  });

  it('opens on ArrowRight and focuses the first flyout item; ArrowLeft returns to the row', async () => {
    const {menu, sub} = await mount();
    await focusSubRow(menu, sub);
    await pressKeys('ArrowRight');
    await waitUntil(() => isOpen(sub), 'flyout open');
    expect(active()).toBe('Folder A');
    await pressKeys('ArrowLeft');
    await waitUntil(() => !sub.open, 'closed');
    await waitUntil(() => deepActiveElement() === sub, 'focus back on the row');
    expect(menu.open).toBe(true);
  });

  it('Enter and Space on the row open the flyout without activating a second time', async () => {
    for (const key of ['Enter', ' ']) {
      const {menu, sub} = await mount();
      const clicks = recordEvents(sub, 'click');
      await focusSubRow(menu, sub);
      await pressKeys(key);
      await waitUntil(() => isOpen(sub), 'flyout open');
      expect(clicks.events).toHaveLength(0);
      expect(active()).toBe('Folder A');
    }
  });

  it('closes only the submenu on Escape and restores focus to its row; a second Escape closes the menu and returns to the trigger', async () => {
    const {menu, sub} = await mount();
    const changes = recordEvents(menu, 'tct-open-change');
    await focusSubRow(menu, sub);
    await pressKeys('ArrowRight');
    await waitUntil(() => isOpen(sub), 'flyout open');
    expect(layerStack()).toHaveLength(2);

    await pressKeys('Escape');
    await waitUntil(() => !sub.open && !isOpen(sub), 'submenu closed');
    await waitUntil(() => deepActiveElement() === sub, 'focus back on the row');
    expect(menu.open).toBe(true);
    expect(layerStack()).toHaveLength(1);

    await pressKeys('Escape');
    await waitUntil(() => !menu.open, 'menu closed');
    await waitUntil(() => deepActiveElement() === nativeTrigger(menu), 'focus on the trigger');
    // The menu's own intent event fired for the second Escape only.
    expect(changes.events.filter((e) => e.target === menu).map((e) => [e.open, e.reason])).toEqual([
      [true, 'trigger'],
      [false, 'escape'],
    ]);
  });

  it('invokes the nested item and closes the whole menu after selecting it', async () => {
    const {menu, sub} = await mount();
    const clicks = recordEvents(sub.querySelector('#a')!, 'click');
    await openMenu(menu);
    // A programmatic click: a real mouse click after a hover longer than the click guard would toggle it shut.
    sub.click();
    await waitUntil(() => isOpen(sub), 'flyout open');
    await userEvent.click(sub.querySelector('#a')!);
    expect(clicks.events).toHaveLength(1);
    await waitUntil(() => !menu.open, 'menu closed');
    await waitUntil(() => !sub.open && !isOpen(sub), 'flyout closed with it');
    expect(layerStack()).toHaveLength(0);
  });

  it('activates a nested item with the Enter key and closes the menu', async () => {
    const {menu, sub} = await mount();
    const clicks = recordEvents(sub.querySelector('#b')!, 'click');
    await focusSubRow(menu, sub);
    await pressKeys('ArrowRight', 'ArrowDown', 'Enter');
    expect(clicks.events).toHaveLength(1);
    await waitUntil(() => !menu.open, 'menu closed');
    await waitUntil(() => !isOpen(sub), 'flyout closed');
  });

  it('does not open a disabled submenu', async () => {
    const {menu, sub} = await mount(MENU.replace('id="move"', 'id="move" disabled'));
    await focusSubRow(menu, sub);
    await pressKeys('ArrowRight');
    // A programmatic click: a real mouse click after a hover longer than the click guard would toggle it shut.
    sub.click();
    await aTimeout(80);
    expect(sub.open).toBe(false);
    expect((await axNode(sub)).disabled).toBe('true');
  });

  it('steps through every flyout item with ArrowDown without skipping', async () => {
    const {menu, sub} = await mount();
    await focusSubRow(menu, sub);
    await pressKeys('ArrowRight');
    await waitUntil(() => isOpen(sub), 'flyout open');
    expect(active()).toBe('Folder A');
    await pressKeys('ArrowDown');
    expect(active()).toBe('Folder B');
    await pressKeys('ArrowDown');
    expect(active()).toBe('Folder B');
  });

  it('supports first-character type-ahead within the flyout, not in the parent', async () => {
    const {menu, sub} = await mount();
    await focusSubRow(menu, sub);
    await pressKeys('ArrowRight');
    await waitUntil(() => isOpen(sub), 'flyout open');
    await pressKeys('f');
    expect(active()).toBe('Folder B');
  });

  it('moves focus to the submenu row on hover, keeping a single highlight', async () => {
    const {menu, sub} = await mount();
    await openMenu(menu);
    await userEvent.hover(sub);
    await waitUntil(() => deepActiveElement() === sub, 'row focused');
  });

  it('opens on hover after a delay without taking focus, and closes when the pointer leaves', async () => {
    const {menu, sub} = await mount();
    await openMenu(menu);
    await userEvent.hover(sub);
    await waitUntil(() => isOpen(sub), 'hover-opened');
    expect(deepActiveElement()).toBe(sub);
    await userEvent.hover(menu.shadowRoot!.querySelector('.trigger')!);
    await waitUntil(() => !sub.open, 'closed after leaving');
  });

  it('keeps the flyout open while the pointer is over it', async () => {
    const {menu, sub} = await mount();
    await openMenu(menu);
    await userEvent.hover(sub);
    await waitUntil(() => isOpen(sub), 'hover-opened');
    await userEvent.hover(sub.querySelector('#a')!);
    await aTimeout(400);
    expect(sub.open).toBe(true);
  });

  it('keeps the flyout open when a hover-open is immediately clicked', async () => {
    const {menu, sub} = await mount();
    await openMenu(menu);
    await userEvent.hover(sub);
    await waitUntil(() => isOpen(sub), 'hover-opened');
    // A programmatic click right after the hover-open: within the guard however slow the machine is.
    sub.click();
    await aTimeout(50);
    expect(sub.open).toBe(true);
  });

  it('closes on a click that lands well after the hover-open', async () => {
    const {menu, sub} = await mount();
    await openMenu(menu);
    await userEvent.hover(sub);
    await waitUntil(() => isOpen(sub), 'hover-opened');
    await aTimeout(650);
    sub.click();
    await waitUntil(() => !sub.open, 'closed by the click');
  });

  it('mirrors its keyboard directions under RTL', async () => {
    const {menu, sub} = await mount(MENU, {dir: 'rtl'});
    await focusSubRow(menu, sub);
    await pressKeys('ArrowRight');
    await aTimeout(80);
    expect(sub.open).toBe(false);
    await pressKeys('ArrowLeft');
    await waitUntil(() => isOpen(sub), 'flyout open');
    expect(active()).toBe('Folder A');
    await pressKeys('ArrowLeft');
    await aTimeout(60);
    expect(sub.open).toBe(true);
    await pressKeys('ArrowRight');
    await waitUntil(() => !sub.open, 'closed');
    await waitUntil(() => deepActiveElement() === sub, 'focus back on the row');
    // The flyout opens on the inline end: to the left of the row.
    await pressKeys('ArrowLeft');
    await waitUntil(() => isOpen(sub), 'flyout open again');
    await animationsFinished(flyout(sub));
    expect(flyoutSurface(sub).getBoundingClientRect().right).toBeLessThanOrEqual(
      sub.getBoundingClientRect().left + 1,
    );
  });

  it('places the flyout beside the row on the inline end', async () => {
    const {menu, sub} = await mount();
    await focusSubRow(menu, sub);
    await pressKeys('ArrowRight');
    await waitUntil(() => isOpen(sub), 'flyout open');
    await animationsFinished(flyout(sub));
    const row = sub.getBoundingClientRect();
    const surface = flyoutSurface(sub).getBoundingClientRect();
    expect(surface.left).toBeGreaterThanOrEqual(row.right - 1);
    expect(Math.abs(surface.top - row.top)).toBeLessThan(12);
  });
});

describe('DropdownMenuSubMenu async items (spinner)', () => {
  const LAZY = MENU.replace('label="Move to"', 'label="Move to" has-spinner').replace(
    /<tct-dropdown-menu-item id="a"[\s\S]*?<\/tct-dropdown-menu-item>\s*<tct-dropdown-menu-item id="b"[\s\S]*?<\/tct-dropdown-menu-item>/,
    '',
  );

  it('shows a spinner in place of the caret', async () => {
    const {menu, sub} = await mount(LAZY);
    await openMenu(menu);
    expect(sub.shadowRoot!.querySelector('tct-spinner')).not.toBeNull();
    expect(sub.shadowRoot!.querySelector('[part="indicator-icon"]')).toBeNull();
  });

  it('moves focus into a loading (item-less) flyout so keyboard ownership transfers', async () => {
    const {menu, sub} = await mount(LAZY);
    await focusSubRow(menu, sub);
    await pressKeys('ArrowRight');
    await waitUntil(() => isOpen(sub), 'flyout open');
    expect(deepActiveElement()).toBe(flyoutSurface(sub));
    // Escape still closes only the flyout.
    await pressKeys('Escape');
    await waitUntil(() => !sub.open, 'closed');
    expect(menu.open).toBe(true);
  });

  it('roves to the first item once a loading flyout resolves', async () => {
    const {menu, sub} = await mount(LAZY);
    await focusSubRow(menu, sub);
    await pressKeys('ArrowRight');
    await waitUntil(() => isOpen(sub), 'flyout open');
    sub.removeAttribute('has-spinner');
    sub.insertAdjacentHTML(
      'beforeend',
      '<tct-dropdown-menu-item label="Loaded"></tct-dropdown-menu-item>',
    );
    await sub.updateComplete;
    await pressKeys('ArrowDown');
    expect(active()).toBe('Loaded');
  });
});

describe('DropdownMenuSubMenu nesting', () => {
  const NESTED = `
    <tct-dropdown-menu label="Actions">
      <tct-dropdown-menu-sub-menu id="outer" label="Outer">
        <tct-dropdown-menu-item label="Plain"></tct-dropdown-menu-item>
        <tct-dropdown-menu-sub-menu id="inner" label="Inner">
          <tct-dropdown-menu-item id="leaf" label="Leaf"></tct-dropdown-menu-item>
        </tct-dropdown-menu-sub-menu>
      </tct-dropdown-menu-sub-menu>
    </tct-dropdown-menu>`;

  it('navigates a two-level nested submenu, closing one level per Escape', async () => {
    const {menu, sub: outer} = await mount(NESTED);
    const inner = menu.querySelector<TctDropdownMenuSubMenu>('#inner')!;
    await openMenu(menu);
    await pressKeys('ArrowDown', 'ArrowRight');
    await waitUntil(() => isOpen(outer), 'outer open');
    await pressKeys('ArrowDown', 'ArrowRight');
    await waitUntil(() => isOpen(inner), 'inner open');
    expect(active()).toBe('Leaf');
    expect(layerStack()).toHaveLength(3);
    await pressKeys('Escape');
    await waitUntil(() => !inner.open, 'inner closed');
    await waitUntil(() => deepActiveElement() === inner, 'focus back on the inner row');
    expect(outer.open).toBe(true);
    await pressKeys('Escape');
    await waitUntil(() => !outer.open, 'outer closed');
    await waitUntil(() => deepActiveElement() === outer, 'focus back on the outer row');
    expect(menu.open).toBe(true);
  });

  it('a deep leaf closes the whole tree', async () => {
    const {menu, sub: outer} = await mount(NESTED);
    const inner = menu.querySelector<TctDropdownMenuSubMenu>('#inner')!;
    const leaf = menu.querySelector('#leaf')!;
    const clicks = recordEvents(leaf, 'click');
    await openMenu(menu);
    await pressKeys('ArrowDown', 'ArrowRight');
    await waitUntil(() => isOpen(outer), 'outer open');
    await pressKeys('ArrowDown', 'ArrowRight');
    await waitUntil(() => isOpen(inner), 'inner open');
    await pressKeys('Enter');
    expect(clicks.events).toHaveLength(1);
    await waitUntil(() => !menu.open && !outer.open && !inner.open, 'everything closed');
    await waitUntil(() => layerStack().length === 0, 'no layers left');
    await waitUntil(() => deepActiveElement() === nativeTrigger(menu), 'focus on the trigger');
  });

  it('closing the outer flyout closes the inner one with it', async () => {
    const {menu, sub: outer} = await mount(NESTED);
    const inner = menu.querySelector<TctDropdownMenuSubMenu>('#inner')!;
    await openMenu(menu);
    await pressKeys('ArrowDown', 'ArrowRight');
    await waitUntil(() => isOpen(outer), 'outer open');
    await pressKeys('ArrowDown', 'ArrowRight');
    await waitUntil(() => isOpen(inner), 'inner open');
    await outer.hide();
    await waitUntil(() => !inner.open && !isOpen(inner), 'inner closed with its parent');
  });
});
