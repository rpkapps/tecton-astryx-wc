/**
 * tct-dropdown-menu: element contract, overlay contract, the menu button pattern (roles, roving focus,
 * typeahead, activation), compound and data modes, open focus by modality, adaptive presentation, a11y,
 * RTL and i18n. Upstream test names are kept where the behaviour applies.
 */
import {describe, expect, it} from 'vitest';
import {userEvent} from 'vitest/browser';
import {
  animationsFinished,
  axNode,
  expectAccessible,
  fixture,
  pressKeys,
  recordEvents,
  runElementSuite,
  runOverlaySuite,
  waitUntil,
} from '@tecton-wc/testing/index.js';
import {deepActiveElement} from '@tecton-wc/core/utils/focus.js';
import './define.js';
import type {TctDropdownMenu} from './tct-dropdown-menu.js';
import type {TctDropdownMenuItem} from './tct-dropdown-menu-item.js';

const compound = (attributes = '', rows?: string): string =>
  `<tct-dropdown-menu label="Actions" ${attributes}>${
    rows ??
    `<tct-dropdown-menu-item label="Edit"></tct-dropdown-menu-item>
     <tct-dropdown-menu-item label="Duplicate"></tct-dropdown-menu-item>
     <tct-dropdown-menu-item label="Delete"></tct-dropdown-menu-item>`
  }</tct-dropdown-menu>`;

async function mount(attributes = '', rows?: string): Promise<TctDropdownMenu> {
  const root = await fixture<HTMLElement>(
    `<div style="padding:60px 40px">${compound(attributes, rows)}<p id="outside">outside</p></div>`,
  );
  const element = root.querySelector<TctDropdownMenu>('tct-dropdown-menu')!;
  await element.updateComplete;
  return element;
}

const layerOf = (el: TctDropdownMenu): HTMLElement =>
  el.shadowRoot!.querySelector<HTMLElement>('.layer')!;
const surfaceOf = (el: TctDropdownMenu): HTMLElement =>
  el.shadowRoot!.querySelector<HTMLElement>('.surface')!;
const triggerOf = (el: TctDropdownMenu): HTMLElement =>
  el.shadowRoot!.querySelector<HTMLElement>('.trigger')!;
/** The native button inside the built-in `tct-button` trigger: the element that carries the ARIA state. */
const nativeTrigger = (el: TctDropdownMenu): HTMLButtonElement =>
  triggerOf(el).shadowRoot!.querySelector<HTMLButtonElement>('button')!;
const isShown = (el: TctDropdownMenu): boolean => layerOf(el).matches(':popover-open');
const rowsOf = (el: TctDropdownMenu): HTMLElement[] => [
  ...el.querySelectorAll<HTMLElement>('tct-dropdown-menu-item'),
];
const active = (): string =>
  (deepActiveElement() as HTMLElement | null)?.getAttribute('label') ??
  (deepActiveElement() as HTMLElement | null)?.className ??
  '';

async function openByClick(el: TctDropdownMenu): Promise<void> {
  await userEvent.click(triggerOf(el));
  await waitUntil(() => el.open && isShown(el), 'opened');
  await animationsFinished(layerOf(el));
}

async function openByKeyboard(el: TctDropdownMenu): Promise<void> {
  triggerOf(el).focus();
  await pressKeys('Enter');
  await waitUntil(() => el.open && isShown(el), 'opened');
  await animationsFinished(layerOf(el));
}

runElementSuite({
  tag: 'tct-dropdown-menu',
  render: () => compound(),
  properties: {
    label: 'Other',
    variant: 'primary',
    icon: 'search',
    iconOnly: true,
    tooltip: 'Tip',
    disabled: true,
    noChevron: true,
    placement: 'above',
    alignment: 'end',
    menuWidth: '240',
    presentation: 'bottom-sheet',
    backLabel: 'Up',
  },
  attributes: {
    label: 'label',
    placement: 'placement',
    alignment: 'alignment',
    menuWidth: 'menu-width',
    presentation: 'presentation',
  },
  events: ['tct-open-change', 'tct-after-open-change'],
});

runOverlaySuite({
  tag: 'tct-dropdown-menu',
  render: ({attributes = '', children = ''}) =>
    `<tct-dropdown-menu label="Test" ${attributes}><tct-dropdown-menu-item label="One" no-close-on-select></tct-dropdown-menu-item>${children}</tct-dropdown-menu>`,
  trigger: (element) => nativeTrigger(element as TctDropdownMenu),
  surface: (element) => element.shadowRoot!.querySelector<HTMLElement>('.layer'),
});

describe('DropdownMenu', () => {
  it('renders trigger button with label', async () => {
    const el = await mount();
    expect(triggerOf(el).getAttribute('label')).toBe('Actions');
    expect((await axNode(nativeTrigger(el))).role).toBe('button');
    expect((await axNode(nativeTrigger(el))).name).toBe('Actions');
  });

  it('renders menu with role="menu", named from the trigger label (menus-13)', async () => {
    const el = await mount();
    await openByClick(el);
    const menu = await axNode(surfaceOf(el));
    expect(menu.role).toBe('menu');
    expect(menu.name).toBe('Actions');
  });

  it('has aria-haspopup and aria-expanded on the trigger', async () => {
    const el = await mount();
    expect((await axNode(nativeTrigger(el))).hasPopup).toBe('menu');
    expect((await axNode(nativeTrigger(el))).expanded).toBe('false');
    await openByClick(el);
    expect((await axNode(nativeTrigger(el))).expanded).toBe('true');
  });

  it('opens menu when button is clicked and passes axe', async () => {
    const el = await mount();
    const events = recordEvents(el, ['tct-open-change', 'tct-after-open-change']);
    await openByClick(el);
    await waitUntil(() => events.named('tct-after-open-change').length === 1, 'after-open-change');
    expect(events.counts()).toEqual({'tct-open-change': 1, 'tct-after-open-change': 1});
    expect(events.named('tct-open-change')[0]!.open).toBe(true);
    expect(events.named('tct-open-change')[0]!.reason).toBe('trigger');
    await expectAccessible(el);
  });

  it('exposes menuitem rows in the accessibility tree', async () => {
    const el = await mount();
    await openByClick(el);
    const rows = rowsOf(el);
    expect(rows).toHaveLength(3);
    for (const row of rows) expect((await axNode(row)).role).toBe('menuitem');
    expect((await axNode(rows[0]!)).name).toBe('Edit');
  });
});

describe('DropdownMenu open focus follows input modality (#4477)', () => {
  it('pointer open focuses the menu container, not the first item', async () => {
    const el = await mount();
    await openByClick(el);
    expect(deepActiveElement()).toBe(surfaceOf(el));
  });

  it('first ArrowDown after a pointer open moves focus to the first enabled item', async () => {
    const el = await mount(
      '',
      `<tct-dropdown-menu-item label="Off" disabled></tct-dropdown-menu-item>
       <tct-dropdown-menu-item label="Edit"></tct-dropdown-menu-item>`,
    );
    await openByClick(el);
    await pressKeys('ArrowDown');
    expect(active()).toBe('Edit');
  });

  it('keyboard open via Enter focuses the first enabled item', async () => {
    const el = await mount();
    await openByKeyboard(el);
    expect(active()).toBe('Edit');
  });

  it('keyboard open via ArrowDown skips a disabled leading item', async () => {
    const el = await mount(
      '',
      `<tct-dropdown-menu-item label="Off" disabled></tct-dropdown-menu-item>
       <tct-dropdown-menu-item label="Edit"></tct-dropdown-menu-item>`,
    );
    triggerOf(el).focus();
    await pressKeys('ArrowDown');
    await waitUntil(() => isShown(el), 'opened');
    expect(active()).toBe('Edit');
  });
});

describe('DropdownMenu keyboard', () => {
  it('ArrowDown and ArrowUp move between items without wrapping; Home and End jump', async () => {
    const el = await mount();
    await openByKeyboard(el);
    await pressKeys('ArrowDown');
    expect(active()).toBe('Duplicate');
    await pressKeys('ArrowDown', 'ArrowDown');
    expect(active()).toBe('Delete');
    await pressKeys('Home');
    expect(active()).toBe('Edit');
    await pressKeys('ArrowUp');
    expect(active()).toBe('Edit');
    await pressKeys('End');
    expect(active()).toBe('Delete');
  });

  it('disabled items stay focusable so they can be discovered (APG)', async () => {
    const el = await mount(
      '',
      `<tct-dropdown-menu-item label="One"></tct-dropdown-menu-item>
       <tct-dropdown-menu-item label="Two" disabled></tct-dropdown-menu-item>
       <tct-dropdown-menu-item label="Three"></tct-dropdown-menu-item>`,
    );
    await openByKeyboard(el);
    await pressKeys('ArrowDown');
    expect(active()).toBe('Two');
    expect((await axNode(deepActiveElement()!)).disabled).toBe('true');
    await pressKeys('ArrowDown');
    expect(active()).toBe('Three');
  });

  it('typeahead focuses the item matching the typed character (menus-11)', async () => {
    const el = await mount();
    await openByKeyboard(el);
    await pressKeys('d');
    expect(active()).toBe('Duplicate');
    await pressKeys('d');
    expect(active()).toBe('Delete');
  });

  it('typeahead skips a disabled item', async () => {
    const el = await mount(
      '',
      `<tct-dropdown-menu-item label="Alpha"></tct-dropdown-menu-item>
       <tct-dropdown-menu-item label="Beta" disabled></tct-dropdown-menu-item>
       <tct-dropdown-menu-item label="Bravo"></tct-dropdown-menu-item>`,
    );
    await openByKeyboard(el);
    await pressKeys('b');
    expect(active()).toBe('Bravo');
  });

  it('closes the menu when Tab is pressed inside it (APG menu-button)', async () => {
    const el = await mount();
    await openByKeyboard(el);
    await pressKeys('Tab');
    await waitUntil(() => !el.open, 'closed');
    expect(el.open).toBe(false);
  });

  it('Escape closes the menu and returns focus to the trigger', async () => {
    const el = await mount();
    await openByKeyboard(el);
    await pressKeys('Escape');
    await waitUntil(() => !el.open && !isShown(el), 'closed');
    await waitUntil(
      () => deepActiveElement() === nativeTrigger(el),
      'focus returned to the trigger',
    );
  });
});

describe('DropdownMenu items', () => {
  it('fires click once for pointer, Enter and Space, and closes the menu', async () => {
    for (const activate of ['click', 'Enter', ' '] as const) {
      const el = await mount();
      const clicks = recordEvents(el, 'click');
      const rows = [...el.querySelectorAll<TctDropdownMenuItem>('tct-dropdown-menu-item')];
      const target = rows[1]!;
      const rowClicks = recordEvents(target, 'click');
      await openByKeyboard(el);
      clicks.events.length = 0;
      if (activate === 'click') {
        await userEvent.click(target);
      } else {
        await pressKeys('ArrowDown');
        await pressKeys(activate);
      }
      expect(rowClicks.events).toHaveLength(1);
      await waitUntil(() => !el.open, 'closed after selection');
    }
  });

  it('does not fire click for a disabled item and keeps the menu open', async () => {
    const el = await mount(
      '',
      `<tct-dropdown-menu-item label="Off" disabled></tct-dropdown-menu-item>`,
    );
    const row = el.querySelector<HTMLElement>('tct-dropdown-menu-item')!;
    const rowClicks = recordEvents(row, 'click');
    await openByClick(el);
    await userEvent.click(row);
    await pressKeys('ArrowDown', 'Enter');
    expect(rowClicks.events).toHaveLength(0);
    expect(el.open).toBe(true);
  });

  it('keeps the menu open when the item opts out of closing', async () => {
    const el = await mount(
      '',
      `<tct-dropdown-menu-item label="Copy" no-close-on-select></tct-dropdown-menu-item>`,
    );
    await openByClick(el);
    await userEvent.click(el.querySelector('tct-dropdown-menu-item')!);
    expect(el.open).toBe(true);
  });
});
