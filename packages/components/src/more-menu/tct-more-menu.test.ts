/**
 * tct-more-menu: an icon-only overflow trigger over the dropdown menu. Upstream test names are kept where
 * the behaviour applies.
 */
import {afterEach, describe, expect, it} from 'vitest';
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
import type {DropdownMenuOption} from '../dropdown-menu/dropdown-menu.types.js';
import {stubCompactTouch} from '../dropdown-menu/menu-test-helpers.js';
import './define.js';
import type {TctMoreMenu} from './tct-more-menu.js';

const ITEMS: DropdownMenuOption[] = [
  {label: 'Edit'},
  {label: 'Duplicate'},
  {type: 'divider'},
  {type: 'section', title: 'Danger', items: [{label: 'Delete', variant: 'destructive'}]},
];

async function mount(attributes = '', items: DropdownMenuOption[] = ITEMS): Promise<TctMoreMenu> {
  const root = await fixture<HTMLElement>(
    `<div style="padding:60px 40px"><tct-more-menu ${attributes}></tct-more-menu><p id="outside">outside</p></div>`,
  );
  const element = root.querySelector<TctMoreMenu>('tct-more-menu')!;
  element.items = items;
  await element.updateComplete;
  return element;
}

const triggerOf = (el: TctMoreMenu): HTMLElement =>
  el.shadowRoot!.querySelector<HTMLElement>('.trigger')!;
const nativeTrigger = (el: TctMoreMenu): HTMLButtonElement =>
  triggerOf(el).shadowRoot!.querySelector<HTMLButtonElement>('button')!;
const layerOf = (el: TctMoreMenu): HTMLElement =>
  el.shadowRoot!.querySelector<HTMLElement>('.layer')!;
const surfaceOf = (el: TctMoreMenu): HTMLElement =>
  el.shadowRoot!.querySelector<HTMLElement>('.surface')!;
const isShown = (el: TctMoreMenu): boolean => layerOf(el).matches(':popover-open');

async function openByClick(el: TctMoreMenu): Promise<void> {
  await userEvent.click(triggerOf(el));
  await waitUntil(() => el.open && isShown(el), 'opened');
  await animationsFinished(layerOf(el));
}

runElementSuite({
  tag: 'tct-more-menu',
  render: () => '<tct-more-menu></tct-more-menu>',
  properties: {
    label: 'Row actions',
    variant: 'secondary',
    size: 'sm',
    icon: 'search',
    disabled: true,
    placement: 'above',
    alignment: 'end',
    presentation: 'adaptive',
    tooltip: 'Tip',
  },
  attributes: {
    label: 'label',
    placement: 'placement',
    alignment: 'alignment',
    presentation: 'presentation',
  },
  events: ['tct-open-change', 'tct-after-open-change'],
});

describe('MoreMenu', () => {
  it('renders an icon-only trigger with the default aria-label "More options"', async () => {
    const el = await mount();
    const node = await axNode(nativeTrigger(el));
    expect(node.role).toBe('button');
    expect(node.name).toBe('More options');
    expect(triggerOf(el).hasAttribute('icon-only')).toBe(true);
    expect(triggerOf(el).getAttribute('icon')).toBe('moreHorizontal');
  });

  it('defaults to the ghost variant, and the label is also the tooltip', async () => {
    const el = await mount();
    expect(triggerOf(el).getAttribute('variant')).toBe('ghost');
    expect(triggerOf(el).getAttribute('tooltip')).toBe('More options');
  });

  it('supports a custom label, variant, size and icon', async () => {
    const el = await mount('label="Row actions" variant="secondary" size="sm" icon="search"');
    expect((await axNode(nativeTrigger(el))).name).toBe('Row actions');
    expect(triggerOf(el).getAttribute('variant')).toBe('secondary');
    expect(triggerOf(el).getAttribute('size')).toBe('sm');
    expect(triggerOf(el).getAttribute('icon')).toBe('search');
  });

  it('supports a slotted custom icon', async () => {
    const root = await fixture<HTMLElement>(
      `<tct-more-menu><tct-icon slot="icon" name="search"></tct-icon></tct-more-menu>`,
    );
    const el = root as unknown as TctMoreMenu;
    await el.updateComplete;
    expect(triggerOf(el).querySelector('slot[name="icon"]')).not.toBeNull();
  });

  it('has aria-haspopup and aria-expanded on the trigger', async () => {
    const el = await mount();
    expect((await axNode(nativeTrigger(el))).hasPopup).toBe('menu');
    expect((await axNode(nativeTrigger(el))).expanded).toBe('false');
    await openByClick(el);
    expect((await axNode(nativeTrigger(el))).expanded).toBe('true');
  });

  it('renders the menu with role="menu", items, dividers and sections with group role', async () => {
    const el = await mount();
    await openByClick(el);
    expect((await axNode(surfaceOf(el))).role).toBe('menu');
    const items = [...surfaceOf(el).querySelectorAll('tct-dropdown-menu-item')];
    expect(items.map((item) => item.getAttribute('label'))).toEqual([
      'Edit',
      'Duplicate',
      'Delete',
    ]);
    expect(surfaceOf(el).querySelectorAll('tct-dropdown-menu-divider')).toHaveLength(1);
    const group = surfaceOf(el).querySelector('[role="group"]')!;
    expect((await axNode(group)).name).toBe('Danger');
    await expectAccessible(el);
  });

  it('opens the menu when clicked, and names it from the label', async () => {
    const el = await mount();
    await openByClick(el);
    expect((await axNode(surfaceOf(el))).name).toBe('More options');
  });

  it('calls click on the item, once', async () => {
    let clicks = 0;
    const el = await mount('', [{label: 'Edit', onClick: () => clicks++}]);
    await openByClick(el);
    await userEvent.click(surfaceOf(el).querySelector('tct-dropdown-menu-item')!);
    expect(clicks).toBe(1);
    await waitUntil(() => !el.open, 'closed');
  });

  it('does not call onClick for disabled items', async () => {
    let clicks = 0;
    const el = await mount('', [{label: 'Edit', disabled: true, onClick: () => clicks++}]);
    await openByClick(el);
    await userEvent.click(surfaceOf(el).querySelector('tct-dropdown-menu-item')!);
    expect(clicks).toBe(0);
    expect(el.open).toBe(true);
  });

  it('does not open when disabled', async () => {
    const el = await mount('disabled');
    await userEvent.click(triggerOf(el), {force: true});
    expect(el.open).toBe(false);
  });

  it('pointer open focuses the menu container, not the first item (#4477)', async () => {
    const el = await mount();
    await openByClick(el);
    expect(deepActiveElement()).toBe(surfaceOf(el));
  });

  it('first ArrowDown after a pointer open moves focus to the first item (#4477)', async () => {
    const el = await mount();
    await openByClick(el);
    await pressKeys('ArrowDown');
    expect((deepActiveElement() as HTMLElement).getAttribute('label')).toBe('Edit');
  });

  it('keeps the open/close events of the dropdown menu', async () => {
    const el = await mount();
    const events = recordEvents(el, ['tct-open-change', 'tct-after-open-change']);
    await openByClick(el);
    await waitUntil(() => events.named('tct-after-open-change').length === 1, 'settled');
    expect(events.counts()).toEqual({'tct-open-change': 1, 'tct-after-open-change': 1});
    await pressKeys('Escape');
    await waitUntil(() => !el.open, 'closed');
    expect(events.named('tct-open-change').at(-1)!.reason).toBe('escape');
  });

  it('exposes the menu part on the painted surface', async () => {
    const el = await mount();
    expect(surfaceOf(el).getAttribute('part')).toBe('menu');
    expect(triggerOf(el).getAttribute('part')).toBe('trigger');
  });

  describe('bottom sheet', () => {
    let stub: ReturnType<typeof stubCompactTouch> | undefined;
    afterEach(() => {
      stub?.restore();
      stub = undefined;
    });

    it('forwards BottomSheet presentation to the dropdown menu', async () => {
      const el = await mount('presentation="bottom-sheet"');
      await userEvent.click(triggerOf(el));
      const sheet = el.shadowRoot!.querySelector('tct-bottom-sheet')!;
      await waitUntil(() => sheet.open, 'sheet open');
      expect(isShown(el)).toBe(false);
      expect(sheet.querySelectorAll('tct-list-item')).toHaveLength(3);
      // The modal sheet inerts the page (the trigger leaves the accessibility tree), so read the attribute.
      expect(nativeTrigger(el).getAttribute('aria-haspopup')).toBe('dialog');
      expect(nativeTrigger(el).getAttribute('aria-expanded')).toBe('true');
    });

    it('adaptive presentation follows the compact-touch policy', async () => {
      stub = stubCompactTouch(true);
      const el = await mount('presentation="adaptive"');
      await userEvent.click(triggerOf(el));
      await waitUntil(
        () => el.shadowRoot!.querySelector('tct-bottom-sheet')?.open === true,
        'sheet open',
      );
    });
  });

  describe('placement and alignment', () => {
    it('resolves the same default position as the dropdown menu (below, start)', async () => {
      const el = await mount();
      await openByClick(el);
      const trigger = triggerOf(el).getBoundingClientRect();
      const surface = surfaceOf(el).getBoundingClientRect();
      expect(surface.top).toBeGreaterThanOrEqual(trigger.bottom);
      expect(Math.abs(surface.left - trigger.left)).toBeLessThan(2);
    });

    it('forwards placement and alignment', async () => {
      const el = await mount('placement="end" alignment="start"');
      await openByClick(el);
      expect(layerOf(el).getAttribute('data-placement')).toBe('end');
      const trigger = triggerOf(el).getBoundingClientRect();
      expect(surfaceOf(el).getBoundingClientRect().left).toBeGreaterThanOrEqual(trigger.right - 1);
    });
  });
});
