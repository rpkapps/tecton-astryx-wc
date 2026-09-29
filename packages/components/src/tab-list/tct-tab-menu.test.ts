/**
 * `tct-tab-menu`: the extra-options tab of a tab list. A menu button over the shared dropdown menu:
 * radio rows for the options, the trigger reads as a tab and shows the selected option. Test names follow
 * upstream `TabList.test.tsx` "TabMenu".
 */
import {userEvent} from 'vitest/browser';
import {describe, expect, it} from 'vitest';
import {axNode, expectAccessible} from '@tecton-wc/testing/a11y.js';
import {emulateMedia} from '@tecton-wc/testing/emulate.js';
import {recordEvents} from '@tecton-wc/testing/events.js';
import {fixture} from '@tecton-wc/testing/fixture.js';
import {deepActiveElement, pressKeys} from '@tecton-wc/testing/keyboard.js';
import {runElementSuite} from '@tecton-wc/testing/suites/element.js';
import {animationsFinished, nextFrame, waitUntil} from '@tecton-wc/testing/timing.js';
import './define.js';
import type {TctTab} from './tct-tab.js';
import type {TctTabList} from './tct-tab-list.js';
import type {TctTabMenu} from './tct-tab-menu.js';

const OPTIONS = [
  {value: 'analytics', label: 'Analytics'},
  {value: 'reports', label: 'Reports'},
  {value: 'exports', label: 'Exports'},
];

async function menuList(value = 'overview'): Promise<{list: TctTabList; menu: TctTabMenu}> {
  const wrapper = await fixture<HTMLDivElement>(
    `<div style="width: 520px; padding-block-end: 220px"><button id="before">before</button>` +
      `<tct-tab-list value="${value}"><tct-tab value="overview" label="Overview"></tct-tab>` +
      `<tct-tab value="activity" label="Activity"></tct-tab><tct-tab-menu label="More"></tct-tab-menu></tct-tab-list>` +
      `<button id="after">after</button></div>`,
  );
  const list = wrapper.querySelector('tct-tab-list')!;
  const menu = wrapper.querySelector('tct-tab-menu')!;
  menu.options = OPTIONS;
  await menu.updateComplete;
  await Promise.all([...list.children].map((child) => (child as TctTab).updateComplete));
  await nextFrame();
  await nextFrame();
  return {list, menu};
}

const trigger = (menu: TctTabMenu): HTMLButtonElement => menu.control!;
const dropdown = (menu: TctTabMenu): HTMLElement =>
  menu.shadowRoot!.querySelector('tct-dropdown-menu')!;
const surface = (menu: TctTabMenu): HTMLElement =>
  dropdown(menu).shadowRoot!.querySelector<HTMLElement>('[role="menu"]')!;
const layer = (menu: TctTabMenu): HTMLElement =>
  dropdown(menu).shadowRoot!.querySelector<HTMLElement>('.layer')!;
const rows = (menu: TctTabMenu): HTMLElement[] => [
  ...menu.shadowRoot!.querySelectorAll<HTMLElement>('tct-dropdown-menu-radio-item'),
];
const isOpen = (menu: TctTabMenu): boolean => layer(menu).matches(':popover-open');

async function open(menu: TctTabMenu): Promise<void> {
  await userEvent.click(trigger(menu));
  await waitUntil(() => isOpen(menu), 'menu opened');
  await animationsFinished(layer(menu));
}

runElementSuite({
  tag: 'tct-tab-menu',
  render: () =>
    `<tct-tab-list value="a"><tct-tab value="a" label="A"></tct-tab><tct-tab-menu id="under-test" label="More"></tct-tab-menu></tct-tab-list>`,
  properties: {label: 'Other', options: OPTIONS},
  attributes: {label: 'label'},
  skip: ['a11y', 'hostBox'],
});

describe('tct-tab-menu: trigger', () => {
  it('renders a trigger button with aria-haspopup="menu" and aria-expanded', async () => {
    const {menu} = await menuList();
    const inner = trigger(menu);
    expect(inner.localName).toBe('button');
    expect(inner.getAttribute('aria-haspopup')).toBe('menu');
    expect(inner.getAttribute('aria-expanded')).toBe('false');
    expect(await axNode(inner)).toMatchObject({role: 'button', name: 'More', hasPopup: 'menu'});
  });

  it('shows the label prop as trigger text when no option is selected', async () => {
    const {menu} = await menuList();
    expect(inner(menu)).toBe('More');
    expect(menu.matches(':state(selected)')).toBe(false);
    expect(menu.shadowRoot!.querySelector('.tab')!.hasAttribute('data-selected')).toBe(false);
  });

  it('shows the selected option label as trigger text and marks the trigger selected', async () => {
    const {menu} = await menuList('reports');
    expect(inner(menu)).toBe('Reports');
    expect(menu.matches(':state(selected)')).toBe(true);
    expect(menu.shadowRoot!.querySelector('.tab')!.hasAttribute('data-selected')).toBe(true);
    expect(menu.selectedOption).toEqual(OPTIONS[1]);
  });

  it('is a roving stop of the strip: the selected option makes the menu the tab stop', async () => {
    const {list, menu} = await menuList('reports');
    const stops = [...list.querySelectorAll('tct-tab')].map((tab) =>
      tab.control!.getAttribute('tabindex'),
    );
    expect(stops).toEqual(['-1', '-1']);
    expect(trigger(menu).getAttribute('tabindex')).toBe('0');
  });

  it('arrow keys move between the tabs and the menu trigger', async () => {
    const {list, menu} = await menuList();
    list.querySelector('tct-tab')!.control!.focus();
    await pressKeys('End');
    expect(deepActiveElement()).toBe(trigger(menu));
    await pressKeys('ArrowLeft');
    expect(deepActiveElement()).toBe(list.querySelectorAll('tct-tab')[1]!.control);
  });
});

describe('tct-tab-menu: menu', () => {
  it('opens on click, names the menu by label and exposes options as menuitemradio', async () => {
    const {menu} = await menuList('reports');
    await open(menu);
    expect(trigger(menu).getAttribute('aria-expanded')).toBe('true');
    expect(await axNode(surface(menu))).toMatchObject({role: 'menu', name: 'More'});
    const nodes = await Promise.all(rows(menu).map((row) => axNode(row)));
    expect(nodes.map((node) => node.role)).toEqual([
      'menuitemradio',
      'menuitemradio',
      'menuitemradio',
    ]);
    expect(nodes.map((node) => node.checked)).toEqual(['false', 'true', 'false']);
    expect(menu.shadowRoot!.querySelector('.menu-heading')!.textContent).toBe('More');
  });

  it('selects an option: one cancelable tct-value-change, the menu closes, focus returns to the trigger', async () => {
    const {list, menu} = await menuList();
    const events = recordEvents(list, 'tct-value-change');
    await open(menu);
    await userEvent.click(rows(menu)[2]!);
    await waitUntil(() => !isOpen(menu), 'menu closed');
    expect(events.named('tct-value-change')).toHaveLength(1);
    expect(events.named('tct-value-change')[0]).toMatchObject({
      value: 'exports',
      oldValue: 'overview',
    });
    expect(list.value).toBe('exports');
    expect(inner(menu)).toBe('Exports');
    await waitUntil(() => deepActiveElement() === trigger(menu), 'focus back on the trigger');
  });

  it('keeps the value when the requested change is prevented', async () => {
    const {list, menu} = await menuList();
    list.addEventListener('tct-value-change', (event) => event.preventDefault());
    await open(menu);
    await userEvent.click(rows(menu)[0]!);
    expect(list.value).toBe('overview');
    expect(inner(menu)).toBe('More');
  });

  it('Enter, Space or ArrowDown on the trigger open it and focus the first option', async () => {
    const {menu} = await menuList();
    trigger(menu).focus();
    await pressKeys('ArrowDown');
    await waitUntil(() => isOpen(menu), 'opened by ArrowDown');
    await waitUntil(() => deepActiveElement() === rows(menu)[0], 'first row focused');
  });

  it('moves between options with ArrowDown and ArrowUp, Home and End', async () => {
    const {menu} = await menuList();
    trigger(menu).focus();
    await pressKeys('Enter');
    await waitUntil(() => deepActiveElement() === rows(menu)[0], 'first row focused');
    await pressKeys('ArrowDown');
    expect(deepActiveElement()).toBe(rows(menu)[1]);
    await pressKeys('End');
    expect(deepActiveElement()).toBe(rows(menu)[2]);
    await pressKeys('ArrowUp');
    expect(deepActiveElement()).toBe(rows(menu)[1]);
    await pressKeys('Home');
    expect(deepActiveElement()).toBe(rows(menu)[0]);
  });

  it('selects the focused option with Enter', async () => {
    const {list, menu} = await menuList();
    trigger(menu).focus();
    await pressKeys('Enter');
    await waitUntil(() => deepActiveElement() === rows(menu)[0], 'first row focused');
    await pressKeys('ArrowDown', 'Enter');
    expect(list.value).toBe('reports');
  });

  it('closes when Tab is pressed inside it (APG menu button)', async () => {
    const {menu} = await menuList();
    trigger(menu).focus();
    await pressKeys('Enter');
    await waitUntil(() => deepActiveElement() === rows(menu)[0], 'first row focused');
    await pressKeys('Tab');
    await waitUntil(() => !isOpen(menu), 'closed');
  });

  it('closes when Escape is pressed and returns focus to the trigger', async () => {
    const {menu} = await menuList();
    trigger(menu).focus();
    await pressKeys('Enter');
    await waitUntil(() => isOpen(menu), 'opened');
    await pressKeys('Escape');
    await waitUntil(() => !isOpen(menu), 'closed');
    await waitUntil(() => deepActiveElement() === trigger(menu), 'focus back on the trigger');
  });

  it('keys pressed inside the open menu do not move the strip focus', async () => {
    const {list, menu} = await menuList();
    trigger(menu).focus();
    await pressKeys('Enter');
    await waitUntil(() => deepActiveElement() === rows(menu)[0], 'first row focused');
    const before = list.querySelector('tct-tab')!.control!.getAttribute('tabindex');
    await pressKeys('ArrowLeft', 'ArrowRight');
    expect(rows(menu).includes(deepActiveElement() as HTMLElement)).toBe(true);
    expect(list.querySelector('tct-tab')!.control!.getAttribute('tabindex')).toBe(before);
  });

  it('has no axe violations closed and open', async () => {
    const {list, menu} = await menuList('reports');
    await expectAccessible(list.parentElement!);
    await open(menu);
    await expectAccessible(list.parentElement!);
  });
});

/** The visible trigger text. */
function inner(menu: TctTabMenu): string {
  return menu.shadowRoot!.querySelector('.tab .label')!.textContent ?? '';
}

describe('tct-tab-menu: forced colours and right-to-left', () => {
  it('keeps the keyboard focus ring on the trigger in forced colours', async () => {
    await emulateMedia({forcedColors: 'active'});
    const {menu} = await menuList();
    menu.parentElement!.parentElement!.querySelector('button')!.focus();
    await pressKeys('Tab', 'ArrowRight', 'ArrowRight');
    await waitUntil(() => deepActiveElement() === trigger(menu), 'trigger focused');
    expect(getComputedStyle(trigger(menu)).outlineStyle).not.toBe('none');
  });

  it('places the trigger after the last tab, on the left in right-to-left', async () => {
    const wrapper = await fixture<HTMLDivElement>(
      `<div dir="rtl" style="width: 520px"><tct-tab-list value="overview"><tct-tab value="overview" label="Overview"></tct-tab>` +
        `<tct-tab-menu label="More"></tct-tab-menu></tct-tab-list></div>`,
    );
    const menu = wrapper.querySelector('tct-tab-menu')!;
    menu.options = OPTIONS;
    await menu.updateComplete;
    await nextFrame();
    const tab = wrapper.querySelector('tct-tab')!.getBoundingClientRect();
    expect(trigger(menu).getBoundingClientRect().right).toBeLessThanOrEqual(tab.left + 1);
  });
});
