/**
 * The row tags of the menu family: item, checkbox item, radio group and item, divider. Element contract,
 * roles and checked states, the intent event, single activation, disabled rows, RTL and i18n.
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
  waitUntil,
} from '@tecton-astryx/testing/index.js';
import {deepActiveElement} from '@tecton-astryx/core/utils/focus.js';
import './define.js';
import type {TctDropdownMenu} from './tct-dropdown-menu.js';
import type {TctDropdownMenuCheckboxItem} from './tct-dropdown-menu-checkbox-item.js';
import type {TctDropdownMenuRadioGroup} from './tct-dropdown-menu-radio-group.js';
import type {TctDropdownMenuRadioItem} from './tct-dropdown-menu-radio-item.js';

runElementSuite({
  tag: 'tct-dropdown-menu-item',
  render: () => '<tct-dropdown-menu-item label="Edit"></tct-dropdown-menu-item>',
  properties: {
    label: 'Other',
    description: 'Hint',
    icon: 'search',
    disabled: true,
    variant: 'destructive',
    noCloseOnSelect: true,
  },
  attributes: {label: 'label', description: 'description', icon: 'icon', variant: 'variant'},
});

runElementSuite({
  tag: 'tct-dropdown-menu-checkbox-item',
  render: () => '<tct-dropdown-menu-checkbox-item label="Bold"></tct-dropdown-menu-checkbox-item>',
  properties: {
    label: 'Other',
    description: 'Hint',
    icon: 'search',
    checked: true,
    disabled: true,
    closeOnSelect: true,
  },
  attributes: {label: 'label', description: 'description', icon: 'icon'},
  events: ['tct-value-change'],
});

runElementSuite({
  tag: 'tct-dropdown-menu-radio-group',
  render: () =>
    `<tct-dropdown-menu-radio-group label="Sort by" value="a">
       <tct-dropdown-menu-radio-item value="a" label="A"></tct-dropdown-menu-radio-item>
     </tct-dropdown-menu-radio-group>`,
  properties: {label: 'Other', value: 'b', noCloseOnSelect: true},
  attributes: {label: 'label', value: 'value'},
  events: ['tct-value-change'],
});

runElementSuite({
  tag: 'tct-dropdown-menu-radio-item',
  render: () =>
    `<tct-dropdown-menu-radio-group label="Sort by"><tct-dropdown-menu-radio-item value="a" label="A"></tct-dropdown-menu-radio-item></tct-dropdown-menu-radio-group>`,
  properties: {value: 'b', label: 'Other', description: 'Hint', icon: 'search', disabled: true},
  attributes: {value: 'value', label: 'label', description: 'description', icon: 'icon'},
  skip: ['a11y'],
});

runElementSuite({
  tag: 'tct-dropdown-menu-divider',
  render: () => '<tct-dropdown-menu-divider></tct-dropdown-menu-divider>',
  properties: {},
  skip: ['a11y'],
});

const SELECTABLE = `
  <tct-dropdown-menu label="View">
    <tct-dropdown-menu-checkbox-item id="bold" label="Bold" checked></tct-dropdown-menu-checkbox-item>
    <tct-dropdown-menu-checkbox-item id="italic" label="Italic"></tct-dropdown-menu-checkbox-item>
    <tct-dropdown-menu-divider></tct-dropdown-menu-divider>
    <tct-dropdown-menu-radio-group id="align" label="Align" value="left">
      <tct-dropdown-menu-radio-item value="left" label="Left"></tct-dropdown-menu-radio-item>
      <tct-dropdown-menu-radio-item value="center" label="Center" disabled></tct-dropdown-menu-radio-item>
      <tct-dropdown-menu-radio-item value="right" label="Right"></tct-dropdown-menu-radio-item>
    </tct-dropdown-menu-radio-group>
  </tct-dropdown-menu>`;

async function mount(
  markup = SELECTABLE,
  options: {dir?: 'rtl'; lang?: string} = {},
): Promise<TctDropdownMenu> {
  const root = await fixture<HTMLElement>(
    `<div style="padding:60px 40px">${markup}</div>`,
    options,
  );
  const el = root.querySelector<TctDropdownMenu>('tct-dropdown-menu')!;
  await el.updateComplete;
  return el;
}

const layerOf = (el: TctDropdownMenu): HTMLElement =>
  el.shadowRoot!.querySelector<HTMLElement>('.layer')!;
const surfaceOf = (el: TctDropdownMenu): HTMLElement =>
  el.shadowRoot!.querySelector<HTMLElement>('.surface')!;
const nativeTrigger = (el: TctDropdownMenu): HTMLElement =>
  el.shadowRoot!.querySelector('.trigger')!.shadowRoot!.querySelector<HTMLElement>('button')!;
const active = (): string =>
  (deepActiveElement() as HTMLElement | null)?.getAttribute('label') ?? '';

async function openByKeyboard(el: TctDropdownMenu): Promise<void> {
  nativeTrigger(el).focus();
  await pressKeys('Enter');
  await waitUntil(() => el.open && layerOf(el).matches(':popover-open'), 'opened');
  await animationsFinished(layerOf(el));
}

describe('DropdownMenuCheckboxItem', () => {
  it('exposes menuitemcheckbox with checked state, and the box is decorative', async () => {
    const el = await mount();
    await openByKeyboard(el);
    const bold = el.querySelector<TctDropdownMenuCheckboxItem>('#bold')!;
    const italic = el.querySelector<TctDropdownMenuCheckboxItem>('#italic')!;
    expect(await axNode(bold)).toMatchObject({
      role: 'menuitemcheckbox',
      checked: 'true',
      name: 'Bold',
    });
    expect(await axNode(italic)).toMatchObject({role: 'menuitemcheckbox', checked: 'false'});
    const indicator = bold.shadowRoot!.querySelector('tct-checkbox-indicator')!;
    expect((await axNode(indicator)).ignored).toBe('true');
    await expectAccessible(el);
  });

  it('asks before toggling with the cancelable tct-value-change, then flips checked', async () => {
    const el = await mount();
    const italic = el.querySelector<TctDropdownMenuCheckboxItem>('#italic')!;
    const changes = recordEvents(italic, 'tct-value-change');
    await openByKeyboard(el);
    await userEvent.click(italic);
    expect(changes.events).toHaveLength(1);
    expect(changes.events[0]!.value).toBe(true);
    expect(changes.events[0]!.cancelable).toBe(true);
    expect(italic.checked).toBe(true);
    expect((await axNode(italic)).checked).toBe('true');
  });

  it('keeps the menu open by default so several can be toggled', async () => {
    const el = await mount();
    await openByKeyboard(el);
    await userEvent.click(el.querySelector('#italic')!);
    await userEvent.click(el.querySelector('#bold')!);
    expect(el.open).toBe(true);
  });

  it('close-on-select closes the menu after toggling', async () => {
    const el = await mount(SELECTABLE.replace('id="italic"', 'id="italic" close-on-select'));
    await openByKeyboard(el);
    await userEvent.click(el.querySelector('#italic')!);
    await waitUntil(() => !el.open, 'closed');
  });

  it('a prevented tct-value-change keeps the state (controlled use)', async () => {
    const el = await mount();
    const italic = el.querySelector<TctDropdownMenuCheckboxItem>('#italic')!;
    italic.addEventListener('tct-value-change', (event) => event.preventDefault());
    await openByKeyboard(el);
    await userEvent.click(italic);
    expect(italic.checked).toBe(false);
  });

  it('toggles with Enter and with Space, once each', async () => {
    const el = await mount();
    const italic = el.querySelector<TctDropdownMenuCheckboxItem>('#italic')!;
    const changes = recordEvents(italic, 'tct-value-change');
    await openByKeyboard(el);
    await pressKeys('ArrowDown', 'Enter');
    expect(active()).toBe('Italic');
    expect(italic.checked).toBe(true);
    await pressKeys(' ');
    expect(italic.checked).toBe(false);
    expect(changes.events).toHaveLength(2);
  });

  it('a disabled row does not toggle', async () => {
    const el = await mount(SELECTABLE.replace('id="italic"', 'id="italic" disabled'));
    const italic = el.querySelector<TctDropdownMenuCheckboxItem>('#italic')!;
    const changes = recordEvents(italic, 'tct-value-change');
    await openByKeyboard(el);
    await userEvent.click(italic);
    expect(changes.events).toHaveLength(0);
    expect(italic.checked).toBe(false);
  });

  it('property writes never emit events', async () => {
    const el = await mount();
    const italic = el.querySelector<TctDropdownMenuCheckboxItem>('#italic')!;
    const changes = recordEvents(italic, 'tct-value-change');
    italic.checked = true;
    await italic.updateComplete;
    expect(changes.events).toHaveLength(0);
  });

  it('typeahead reaches a checkbox row', async () => {
    const el = await mount();
    await openByKeyboard(el);
    await pressKeys('i');
    expect(active()).toBe('Italic');
  });
});

describe('DropdownMenuRadioGroup / RadioItem', () => {
  it('exposes a named group of menuitemradio rows with checked state', async () => {
    const el = await mount();
    await openByKeyboard(el);
    const group = el.querySelector('#align')!;
    expect(await axNode(group)).toMatchObject({role: 'group', name: 'Align'});
    const rows = [...group.querySelectorAll('tct-dropdown-menu-radio-item')];
    const nodes = await Promise.all(rows.map((row) => axNode(row)));
    expect(nodes.map((node) => [node.role, node.checked])).toEqual([
      ['menuitemradio', 'true'],
      ['menuitemradio', 'false'],
      ['menuitemradio', 'false'],
    ]);
    expect((await axNode(rows[1]!)).disabled).toBe('true');
    await expectAccessible(el);
  });

  it('asks with tct-value-change, changes the group value and closes the menu (single-choice commit)', async () => {
    const el = await mount();
    const group = el.querySelector<TctDropdownMenuRadioGroup>('#align')!;
    const changes = recordEvents(group, 'tct-value-change');
    await openByKeyboard(el);
    await userEvent.click(group.querySelector('[value="right"]')!);
    expect(changes.events).toHaveLength(1);
    expect(changes.events[0]!.value).toBe('right');
    expect((changes.events[0] as unknown as {oldValue: string}).oldValue).toBe('left');
    expect(group.value).toBe('right');
    await waitUntil(() => !el.open, 'closed');
    expect(group.querySelector<TctDropdownMenuRadioItem>('[value="right"]')!.checked).toBe(true);
  });

  it('no-close-on-select keeps the menu open', async () => {
    const el = await mount(
      SELECTABLE.replace('id="align" label="Align"', 'id="align" label="Align" no-close-on-select'),
    );
    await openByKeyboard(el);
    await userEvent.click(el.querySelector('#align [value="right"]')!);
    expect(el.open).toBe(true);
  });

  it('choosing the current value changes nothing and fires no event', async () => {
    const el = await mount();
    const group = el.querySelector<TctDropdownMenuRadioGroup>('#align')!;
    const changes = recordEvents(group, 'tct-value-change');
    await openByKeyboard(el);
    await userEvent.click(group.querySelector('[value="left"]')!);
    expect(changes.events).toHaveLength(0);
  });

  it('a prevented change keeps the value (controlled use)', async () => {
    const el = await mount();
    const group = el.querySelector<TctDropdownMenuRadioGroup>('#align')!;
    group.addEventListener('tct-value-change', (event) => event.preventDefault());
    await openByKeyboard(el);
    await userEvent.click(group.querySelector('[value="right"]')!);
    expect(group.value).toBe('left');
  });

  it('a disabled radio cannot be chosen but can be focused with the arrow keys', async () => {
    const el = await mount();
    const group = el.querySelector<TctDropdownMenuRadioGroup>('#align')!;
    await openByKeyboard(el);
    await pressKeys('End');
    expect(active()).toBe('Right');
    await pressKeys('ArrowUp');
    expect(active()).toBe('Center');
    await pressKeys('Enter');
    expect(group.value).toBe('left');
    expect(el.open).toBe(true);
  });

  it('roves across the group boundary like ungrouped rows', async () => {
    const el = await mount();
    await openByKeyboard(el);
    await pressKeys('ArrowDown', 'ArrowDown');
    expect(active()).toBe('Left');
    await pressKeys('ArrowDown');
    expect(active()).toBe('Center');
  });

  it('typeahead matches a radio label', async () => {
    const el = await mount();
    await openByKeyboard(el);
    await pressKeys('r');
    expect(active()).toBe('Right');
  });

  it('warns for a radio item outside a group and cannot be chosen', async () => {
    const root = await fixture<HTMLElement>(
      `<tct-dropdown-menu-radio-item value="a" label="Alone"></tct-dropdown-menu-radio-item>`,
    );
    await (root as unknown as {updateComplete: Promise<unknown>}).updateComplete;
    await userEvent.click(root);
    expect((await axNode(root)).checked).toBe('false');
  });
});

describe('DropdownMenuItem', () => {
  const MENU = `
    <tct-dropdown-menu label="Actions">
      <tct-dropdown-menu-item id="plain" label="Edit" description="Modify" icon="search"></tct-dropdown-menu-item>
      <tct-dropdown-menu-item id="danger" label="Delete" variant="destructive"></tct-dropdown-menu-item>
      <tct-dropdown-menu-item id="rich"><span slot="label">Rich <b>label</b></span><span slot="end">⌘R</span></tct-dropdown-menu-item>
    </tct-dropdown-menu>`;

  it('shows the label, description, icon and end content; the name comes from the content', async () => {
    const el = await mount(MENU);
    await openByKeyboard(el);
    const plain = el.querySelector('#plain')!;
    expect(await axNode(plain)).toMatchObject({role: 'menuitem'});
    expect((await axNode(plain)).name).toContain('Edit');
    expect(plain.shadowRoot!.querySelector('tct-icon')!.getAttribute('name')).toBe('search');
    const rich = el.querySelector('#rich')!;
    expect((await axNode(rich)).name).toContain('Rich label');
  });

  it('marks a destructive row', async () => {
    const el = await mount(MENU);
    await openByKeyboard(el);
    const danger = el.querySelector('#danger')!;
    expect(danger.shadowRoot!.querySelector('.row')!.hasAttribute('data-destructive')).toBe(true);
    await expectAccessible(el);
  });

  it('a row outside any menu is inert: no close, no throw', async () => {
    const root = await fixture<HTMLElement>(
      `<tct-dropdown-menu-item label="Alone"></tct-dropdown-menu-item>`,
    );
    const clicks = recordEvents(root, 'click');
    await userEvent.click(root);
    expect(clicks.events).toHaveLength(1);
  });
});

describe('menu RTL and i18n', () => {
  it('lays a checkbox row out on the inline start in RTL', async () => {
    const el = await mount(SELECTABLE, {dir: 'rtl'});
    await openByKeyboard(el);
    const bold = el.querySelector('#bold')!;
    const marker = bold
      .shadowRoot!.querySelector('tct-checkbox-indicator')!
      .getBoundingClientRect();
    const row = bold.getBoundingClientRect();
    expect(row.right - marker.right).toBeLessThan(marker.left - row.left);
    await expectAccessible(el);
  });

  it('the trigger label defaults to the localized "Menu" in German and Arabic', async () => {
    for (const [lang, expected] of [
      ['de-DE', 'Menü'],
      ['ar-SA', 'القائمة'],
    ] as const) {
      const root = await fixture<HTMLElement>(
        `<div lang="${lang}"><tct-dropdown-menu><tct-dropdown-menu-item label="x"></tct-dropdown-menu-item></tct-dropdown-menu></div>`,
        {lang},
      );
      const el = root.querySelector<TctDropdownMenu>('tct-dropdown-menu')!;
      await el.updateComplete;
      await waitUntil(
        () => el.shadowRoot!.querySelector('.trigger')!.getAttribute('label') !== 'Menu',
        'localized',
      );
      expect(surfaceOf(el).getAttribute('aria-label')).toBe(
        el.shadowRoot!.querySelector('.trigger')!.getAttribute('label'),
      );
      expect(el.shadowRoot!.querySelector('.trigger')!.getAttribute('label')).toBe(expected);
    }
  });
});
