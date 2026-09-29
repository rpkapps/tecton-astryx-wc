/**
 * tct-dropdown-menu data mode (`items`), the adaptive bottom-sheet presentation, controlled use,
 * placement, width, the custom trigger, RTL, forced colours and the Tier-2 positioning fallback.
 */
import {afterEach, describe, expect, it} from 'vitest';
import {userEvent} from 'vitest/browser';
import {isFloatingLoaded} from '@tecton-astryx/core/layer/floating.js';
import {deepActiveElement} from '@tecton-astryx/core/utils/focus.js';
import {
  aTimeout,
  animationsFinished,
  axNode,
  emulateMedia,
  expectAccessible,
  fixture,
  layerStack,
  nextFrame,
  pressKeys,
  recordEvents,
  waitUntil,
  withFeature,
} from '@tecton-astryx/testing/index.js';
import {stubCompactTouch} from './menu-test-helpers.js';
import './define.js';
import type {DropdownMenuOption} from './dropdown-menu.types.js';
import type {TctDropdownMenu} from './tct-dropdown-menu.js';

const ITEMS: DropdownMenuOption[] = [
  {label: 'Edit', icon: 'search'},
  {label: 'Duplicate', description: 'Make a copy', endContent: '⌘D'},
  {type: 'divider'},
  {type: 'section', title: 'Danger zone', items: [{label: 'Delete', variant: 'destructive'}]},
  {label: 'Move to', items: [{label: 'Folder A'}, {label: 'Folder B'}]},
];

async function mount(attributes = '', items: DropdownMenuOption[] | undefined = ITEMS, options: {dir?: 'rtl'} = {}): Promise<TctDropdownMenu> {
  const root = await fixture<HTMLElement>(
    `<div style="padding:60px 40px"><tct-dropdown-menu label="Actions" ${attributes}></tct-dropdown-menu><p id="outside">outside</p></div>`,
    options,
  );
  const el = root.querySelector<TctDropdownMenu>('tct-dropdown-menu')!;
  el.items = items;
  await el.updateComplete;
  return el;
}

const layerOf = (el: TctDropdownMenu): HTMLElement => el.shadowRoot!.querySelector<HTMLElement>('.layer')!;
const surfaceOf = (el: TctDropdownMenu): HTMLElement => el.shadowRoot!.querySelector<HTMLElement>('.surface')!;
const triggerOf = (el: TctDropdownMenu): HTMLElement => el.shadowRoot!.querySelector<HTMLElement>('.trigger')!;
const nativeTrigger = (el: TctDropdownMenu): HTMLElement =>
  triggerOf(el).shadowRoot!.querySelector<HTMLElement>('button')!;
const isShown = (el: TctDropdownMenu): boolean => layerOf(el).matches(':popover-open');
const active = (): string => (deepActiveElement() as HTMLElement | null)?.getAttribute('label') ?? '';
const sheetOf = (el: TctDropdownMenu) => el.shadowRoot!.querySelector('tct-bottom-sheet');

async function openByClick(el: TctDropdownMenu): Promise<void> {
  await userEvent.click(triggerOf(el));
  await waitUntil(() => el.open && isShown(el), 'opened');
  await animationsFinished(layerOf(el));
}

describe('DropdownMenu data mode', () => {
  it('renders items, a divider and a titled section with group role', async () => {
    const el = await mount();
    await openByClick(el);
    const labels = [...surfaceOf(el).querySelectorAll('tct-dropdown-menu-item')].map((row) => row.getAttribute('label'));
    // The submenu's rows are children of its row, in the same tree.
    expect(labels).toEqual(['Edit', 'Duplicate', 'Delete', 'Folder A', 'Folder B']);
    expect(surfaceOf(el).querySelectorAll('tct-dropdown-menu-divider')).toHaveLength(1);
    const group = surfaceOf(el).querySelector('[role="group"]')!;
    expect(await axNode(group)).toMatchObject({role: 'group', name: 'Danger zone'});
    expect(group.querySelector('[part="section-heading"]')!.textContent.trim()).toBe('Danger zone');
    await expectAccessible(el);
  });

  it('carries description, icon and end content through the data API', async () => {
    const el = await mount();
    await openByClick(el);
    const row = surfaceOf(el).querySelectorAll('tct-dropdown-menu-item')[1]!;
    expect(row.getAttribute('description')).toBe('Make a copy');
    expect(row.querySelector('[slot="end"]')!.textContent).toBe('⌘D');
    const first = surfaceOf(el).querySelectorAll('tct-dropdown-menu-item')[0]!;
    expect(first.shadowRoot!.querySelector('tct-icon')!.getAttribute('name')).toBe('search');
  });

  it('takes a template label through the data API', async () => {
    const {html} = await import('lit');
    const el = await mount('', [{label: html`<em>Fancy</em> label`}]);
    await openByClick(el);
    const row = surfaceOf(el).querySelector('tct-dropdown-menu-item')!;
    expect(row.querySelector('[slot="label"]')!.textContent).toBe('Fancy label');
    expect((await axNode(row)).name).toContain('Fancy label');
  });

  it('calls onClick when a row is activated, and closes the menu', async () => {
    const calls: string[] = [];
    const el = await mount('', [{label: 'Edit', onClick: () => calls.push('edit')}]);
    await openByClick(el);
    await userEvent.click(surfaceOf(el).querySelector('tct-dropdown-menu-item')!);
    expect(calls).toEqual(['edit']);
    await waitUntil(() => !el.open, 'closed');
  });

  it('keeps the menu open when the row opts out of closing (closeOnSelect: false), for pointer and keyboard', async () => {
    const calls: string[] = [];
    const el = await mount('', [{label: 'Copy', closeOnSelect: false, onClick: () => calls.push('copy')}]);
    await openByClick(el);
    await userEvent.click(surfaceOf(el).querySelector('tct-dropdown-menu-item')!);
    await pressKeys('ArrowDown', 'Enter');
    expect(calls).toEqual(['copy', 'copy']);
    expect(el.open).toBe(true);
  });

  it('closes on activation even when the row carries no handler', async () => {
    const el = await mount('', [{label: 'Nothing'}]);
    await openByClick(el);
    await userEvent.click(surfaceOf(el).querySelector('tct-dropdown-menu-item')!);
    await waitUntil(() => !el.open, 'closed');
  });

  it('does not call onClick when disabled, and exposes aria-disabled', async () => {
    let clicks = 0;
    const el = await mount('', [{label: 'Off', disabled: true, onClick: () => clicks++}]);
    await openByClick(el);
    const row = surfaceOf(el).querySelector('tct-dropdown-menu-item')!;
    await userEvent.click(row);
    expect(clicks).toBe(0);
    expect((await axNode(row)).disabled).toBe('true');
  });

  it('renders a submenu from a nested items array and keyboard-reaches the row after it', async () => {
    const el = await mount();
    await openByClick(el);
    await pressKeys('ArrowDown');
    // Edit, Duplicate, Delete, Move to
    await pressKeys('ArrowDown', 'ArrowDown', 'ArrowDown');
    expect(active()).toBe('Move to');
    await pressKeys('ArrowRight');
    await waitUntil(() => active() === 'Folder A', 'flyout focused');
    await pressKeys('Escape');
    await waitUntil(() => active() === 'Move to', 'back on the submenu row');
    expect(el.open).toBe(true);
  });

  it('keeps a row mounted when its label changes, so focus survives (data mode keys by position)', async () => {
    const el = await mount('', [{label: 'One'}, {label: 'Two'}]);
    await openByClick(el);
    await pressKeys('ArrowDown');
    const row = deepActiveElement() as HTMLElement;
    el.items = [{label: 'One!'}, {label: 'Two'}];
    await el.updateComplete;
    await nextFrame();
    expect(deepActiveElement()).toBe(row);
    expect(row.getAttribute('label')).toBe('One!');
  });

  it('follows the item, not the slot, when ids are supplied and the list changes', async () => {
    const el = await mount('', [
      {id: 'a', label: 'A'},
      {id: 'b', label: 'B'},
    ]);
    await openByClick(el);
    await pressKeys('ArrowDown', 'ArrowDown');
    const focused = deepActiveElement() as HTMLElement;
    expect(focused.getAttribute('label')).toBe('B');
    el.items = [
      {id: 'b', label: 'B'},
      {id: 'a', label: 'A'},
    ];
    await el.updateComplete;
    await nextFrame();
    expect(deepActiveElement()).toBe(focused);
  });

  it('does not put the id on the rendered row', async () => {
    const el = await mount('', [{id: 'secret', label: 'A'}]);
    await openByClick(el);
    expect(surfaceOf(el).querySelector('[id="secret"]')).toBeNull();
  });
});

describe('DropdownMenu controlled use and mounting', () => {
  it('respects the open attribute and does not move focus into a menu that mounts already open (#5976)', async () => {
    const root = await fixture<HTMLElement>(
      `<div><button id="before">before</button><tct-dropdown-menu label="Actions" open><tct-dropdown-menu-item label="Edit"></tct-dropdown-menu-item></tct-dropdown-menu></div>`,
    );
    root.querySelector<HTMLElement>('#before')!.focus();
    const el = root.querySelector<TctDropdownMenu>('tct-dropdown-menu')!;
    await waitUntil(() => isShown(el), 'shown');
    await aTimeout(60);
    expect(deepActiveElement()).toBe(root.querySelector('#before'));
    // ArrowDown from the focused trigger walks in.
    nativeTrigger(el).focus();
    await pressKeys('ArrowDown');
    expect(active()).toBe('Edit');
  });

  it('a later open focuses the first item again', async () => {
    const el = await mount('', [{label: 'Edit'}]);
    el.open = true;
    await waitUntil(() => isShown(el), 'shown');
    await waitUntil(() => active() === 'Edit', 'first item focused');
    el.open = false;
    await waitUntil(() => !isShown(el), 'hidden');
  });

  it('a prevented tct-open-change keeps the menu shut', async () => {
    const el = await mount();
    el.addEventListener('tct-open-change', (event) => event.preventDefault());
    await userEvent.click(triggerOf(el));
    await aTimeout(80);
    expect(el.open).toBe(false);
    expect(isShown(el)).toBe(false);
  });

  it('property and attribute writes never emit events; show, hide and toggle emit only the commit event', async () => {
    const el = await mount();
    const events = recordEvents(el, ['tct-open-change', 'tct-after-open-change']);
    el.open = true;
    await waitUntil(() => events.named('tct-after-open-change').length === 1, 'opened');
    el.removeAttribute('open');
    await waitUntil(() => events.named('tct-after-open-change').length === 2, 'closed');
    await el.toggle();
    await el.hide();
    expect(events.named('tct-open-change')).toHaveLength(0);
    expect(events.named('tct-after-open-change').map((event) => event.open)).toEqual([true, false, true, false]);
  });

  it('requestClose asks as the user would, and honours a cancel', async () => {
    const el = await mount();
    await el.show();
    el.addEventListener('tct-open-change', (event) => event.preventDefault(), {once: true});
    el.requestClose();
    await aTimeout(50);
    expect(el.open).toBe(true);
    el.requestClose();
    await waitUntil(() => !el.open, 'closed');
  });

  it('does not open when disabled', async () => {
    const el = await mount('disabled');
    nativeTrigger(el).focus();
    await pressKeys('ArrowDown');
    await aTimeout(60);
    expect(el.open).toBe(false);
  });
});

describe('DropdownMenu trigger', () => {
  it('uses a slotted custom trigger button and keeps the ARIA pattern on it', async () => {
    const root = await fixture<HTMLElement>(
      `<div style="padding:60px"><tct-dropdown-menu label="Actions"><button slot="trigger" id="mine">Mine</button><tct-dropdown-menu-item label="Edit"></tct-dropdown-menu-item></tct-dropdown-menu></div>`,
    );
    const el = root.querySelector<TctDropdownMenu>('tct-dropdown-menu')!;
    const mine = root.querySelector<HTMLElement>('#mine')!;
    await el.updateComplete;
    expect(mine.getAttribute('aria-haspopup')).toBe('menu');
    expect(mine.getAttribute('aria-expanded')).toBe('false');
    await userEvent.click(mine);
    await waitUntil(() => el.open && isShown(el), 'opened');
    expect(mine.getAttribute('aria-expanded')).toBe('true');
    await pressKeys('Escape');
    await waitUntil(() => !el.open, 'closed');
    await waitUntil(() => deepActiveElement() === mine, 'focus back on the custom trigger');
  });

  it('opens with ArrowDown and Space, and toggles closed on a second click', async () => {
    const el = await mount();
    nativeTrigger(el).focus();
    await pressKeys(' ');
    await waitUntil(() => el.open, 'opened by Space');
    await pressKeys('Escape');
    await waitUntil(() => !el.open, 'closed');
    nativeTrigger(el).focus();
    await pressKeys('ArrowDown');
    await waitUntil(() => el.open, 'opened by ArrowDown');
    await userEvent.click(triggerOf(el));
    await waitUntil(() => !el.open, 'closed by the trigger');
  });

  it('a click from assistive technology (detail 0) focuses the first item', async () => {
    const el = await mount();
    nativeTrigger(el).click();
    await waitUntil(() => el.open && isShown(el), 'opened');
    await waitUntil(() => active() === 'Edit', 'first item focused');
  });

  it('shows a chevron by default and hides it with no-chevron; the tooltip is dropped while open', async () => {
    const el = await mount('tooltip="Open the menu"');
    expect(triggerOf(el).querySelector('tct-icon')!.getAttribute('name')).toBe('chevronDown');
    expect(triggerOf(el).getAttribute('tooltip')).toBe('Open the menu');
    el.open = true;
    await el.updateComplete;
    expect(triggerOf(el).getAttribute('tooltip')).toBe('');
    const bare = await mount('no-chevron');
    expect(triggerOf(bare).querySelector('tct-icon')).toBeNull();
  });

  it('sizes the rows from the trigger size', async () => {
    const el = await mount('size="sm"');
    await openByClick(el);
    const row = surfaceOf(el).querySelector('tct-dropdown-menu-item')!;
    expect(row.shadowRoot!.querySelector('.row')!.getAttribute('data-size')).toBe('sm');
    expect(row.shadowRoot!.querySelector('.row')!.getAttribute('density')).toBe('compact');
  });
});

describe('DropdownMenu placement and width', () => {
  it('defaults to below, aligned to the trigger start, at least as wide as the trigger', async () => {
    const el = await mount();
    await openByClick(el);
    const trigger = triggerOf(el).getBoundingClientRect();
    const surface = surfaceOf(el).getBoundingClientRect();
    expect(layerOf(el).getAttribute('data-placement')).toBe('below');
    expect(surface.top).toBeGreaterThanOrEqual(trigger.bottom);
    expect(Math.abs(surface.left - trigger.left)).toBeLessThan(2);
    expect(surface.width).toBeGreaterThanOrEqual(trigger.width - 1);
  });

  it('supports explicit placement and alignment', async () => {
    const el = await mount('placement="above" alignment="end"');
    el.parentElement!.style.paddingBlockStart = '400px';
    await openByClick(el);
    const trigger = triggerOf(el).getBoundingClientRect();
    const surface = surfaceOf(el).getBoundingClientRect();
    expect(surface.bottom).toBeLessThanOrEqual(trigger.top + 1);
    expect(Math.abs(surface.right - trigger.right)).toBeLessThan(2);
  });

  it('emits the direction-independent logical mapping under an RTL ancestor (#3389)', async () => {
    const el = await mount('placement="end"', ITEMS, {dir: 'rtl'});
    await openByClick(el);
    const trigger = triggerOf(el).getBoundingClientRect();
    const surface = surfaceOf(el).getBoundingClientRect();
    // `end` is the left side in right-to-left text.
    expect(surface.right).toBeLessThanOrEqual(trigger.left + 1);
  });

  it('menu-width sets a minimum width', async () => {
    const el = await mount('menu-width="300"');
    await openByClick(el);
    expect(surfaceOf(el).getBoundingClientRect().width).toBeGreaterThanOrEqual(299);
  });

  it('menu-width is capped to the viewport', async () => {
    const el = await mount('menu-width="5000"');
    await openByClick(el);
    expect(surfaceOf(el).getBoundingClientRect().width).toBeLessThanOrEqual(window.innerWidth);
  });

  it('an intrinsic keyword in menu-width sets the preferred width', async () => {
    const el = await mount('menu-width="max-content"');
    await openByClick(el);
    expect(surfaceOf(el).style.getPropertyValue('--_menu-inline-size')).toBe('max-content');
  });

  it('caps the height and scrolls only when the rows overflow', async () => {
    const many = await mount('', Array.from({length: 30}, (_, index) => ({label: `Row ${index}`})));
    await openByClick(many);
    const surface = surfaceOf(many);
    expect(surface.getBoundingClientRect().height).toBeLessThanOrEqual(300);
    expect(surface.scrollHeight).toBeGreaterThan(surface.clientHeight);
    await expectAccessible(many);
    await pressKeys('End');
    await nextFrame();
    expect(surface.scrollTop).toBeGreaterThan(0);
  });

  it('does not scroll when the rows fit', async () => {
    const short = await mount('', [{label: 'One'}]);
    await openByClick(short);
    expect(surfaceOf(short).scrollHeight).toBeLessThanOrEqual(surfaceOf(short).clientHeight + 1);
  });

  it('flips above when there is no room below', async () => {
    const root = await fixture<HTMLElement>(
      `<div style="position:relative;block-size:${window.innerHeight - 24}px"><tct-dropdown-menu label="Actions" style="position:absolute;inset-block-end:0"></tct-dropdown-menu></div>`,
    );
    const el = root.querySelector<TctDropdownMenu>('tct-dropdown-menu')!;
    el.items = ITEMS;
    await el.updateComplete;
    await openByClick(el);
    await nextFrame();
    const trigger = triggerOf(el).getBoundingClientRect();
    expect(surfaceOf(el).getBoundingClientRect().bottom).toBeLessThanOrEqual(trigger.top + 1);
    expect(layerOf(el).getAttribute('data-placement')).toBe('above');
  });
});

describe('DropdownMenu bottom sheet presentation', () => {
  let stub: ReturnType<typeof stubCompactTouch> | undefined;
  afterEach(() => {
    stub?.restore();
    stub = undefined;
  });

  it('renders data-driven actions in a bottom sheet when requested', async () => {
    const el = await mount('presentation="bottom-sheet"');
    await userEvent.click(triggerOf(el));
    const sheet = sheetOf(el)!;
    await waitUntil(() => sheet.open, 'sheet open');
    expect(isShown(el)).toBe(false);
    expect(sheet.getAttribute('label')).toBe('Actions');
    expect(sheet.getAttribute('height')).toBe('hug');
    const rows = sheet.querySelectorAll('tct-list-item');
    expect(rows).toHaveLength(4);
    expect(sheet.querySelector('tct-heading')!.textContent).toBe('Actions');
    expect(sheet.querySelector('[role="group"]')!.getAttribute('aria-label')).toBe('Danger zone');
    expect(nativeTrigger(el).getAttribute('aria-haspopup')).toBe('dialog');
  });

  it('drills into nested data items in the sheet and back', async () => {
    const el = await mount('presentation="bottom-sheet"');
    await userEvent.click(triggerOf(el));
    const sheet = sheetOf(el)!;
    await waitUntil(() => sheet.open, 'sheet open');
    await animationsFinished(sheet);
    sheet.querySelectorAll<HTMLElement>('tct-list-item')[3]!.click();
    await waitUntil(() => sheet.querySelectorAll('tct-list-item').length === 2, 'drilled in');
    expect(sheet.querySelector('tct-heading')!.textContent).toBe('Move to');
    expect(sheet.getAttribute('label')).toBe('Move to');
    await waitUntil(() => (deepActiveElement() as HTMLElement | null)?.localName === 'tct-heading', 'heading focused');
    sheet.querySelector<HTMLElement>('.sheet-back')!.click();
    await waitUntil(() => sheet.querySelectorAll('tct-list-item').length === 4, 'back at the root');
  });

  it('returns to the root after the sheet closes and reopens', async () => {
    const el = await mount('presentation="bottom-sheet"');
    await userEvent.click(triggerOf(el));
    const sheet = sheetOf(el)!;
    await waitUntil(() => sheet.open, 'sheet open');
    sheet.querySelectorAll<HTMLElement>('tct-list-item')[3]!.click();
    await waitUntil(() => sheet.querySelectorAll('tct-list-item').length === 2, 'drilled in');
    el.open = false;
    await waitUntil(() => !sheet.open, 'closed');
    el.open = true;
    await waitUntil(() => sheet.open, 'reopened');
    await waitUntil(() => sheet.querySelectorAll('tct-list-item').length === 4, 'at the root');
  });

  it('calls onClick, closes, and returns focus to the trigger without a stuck layer', async () => {
    const calls: string[] = [];
    const el = await mount('presentation="bottom-sheet"', [{label: 'Edit', onClick: () => calls.push('edit')}]);
    await userEvent.click(triggerOf(el));
    const sheet = sheetOf(el)!;
    await waitUntil(() => sheet.open, 'sheet open');
    await animationsFinished(sheet);
    sheet.querySelector<HTMLElement>('tct-list-item')!.click();
    expect(calls).toEqual(['edit']);
    await waitUntil(() => !el.open && !sheet.open, 'closed');
    await waitUntil(() => layerStack().length === 0, 'no layers left');
  });

  it('mirrors the drill-in affordance under RTL', async () => {
    const el = await mount('presentation="bottom-sheet"', ITEMS, {dir: 'rtl'});
    await userEvent.click(triggerOf(el));
    const sheet = sheetOf(el)!;
    await waitUntil(() => sheet.open, 'sheet open');
    const caret = sheet.querySelector('tct-list-item tct-icon[name="chevronRight"]')!;
    expect(caret.shadowRoot!.querySelector('svg')!.hasAttribute('data-mirror')).toBe(true);
  });

  it('uses the sheet for adaptive presentation on compact touch and a popover otherwise; open state survives the switch', async () => {
    stub = stubCompactTouch(true);
    const el = await mount('presentation="adaptive"');
    await userEvent.click(triggerOf(el));
    await waitUntil(() => sheetOf(el)?.open === true, 'sheet open');
    stub.set(false);
    await waitUntil(() => isShown(el), 'popover shown after the switch');
    expect(el.open).toBe(true);
    expect(sheetOf(el)).toBeNull();
    stub.set(true);
    await waitUntil(() => sheetOf(el)?.open === true && !isShown(el), 'sheet again');
  });

  it('keeps adaptive anchored without compact touch', async () => {
    stub = stubCompactTouch(false);
    const el = await mount('presentation="adaptive"');
    await openByClick(el);
    expect(sheetOf(el)).toBeNull();
  });

  it('compound children support the popover only', async () => {
    const root = await fixture<HTMLElement>(
      `<tct-dropdown-menu label="A" presentation="bottom-sheet"><tct-dropdown-menu-item label="One"></tct-dropdown-menu-item></tct-dropdown-menu>`,
    );
    const el = root as unknown as TctDropdownMenu;
    await el.updateComplete;
    await userEvent.click(triggerOf(el));
    await waitUntil(() => isShown(el), 'popover shown');
    expect(sheetOf(el)).toBeNull();
  });

  it('a keyboard open focuses the first action; Escape closes through the intent event', async () => {
    const el = await mount('presentation="bottom-sheet"');
    const changes = recordEvents(el, 'tct-open-change');
    nativeTrigger(el).focus();
    await pressKeys('Enter');
    const sheet = sheetOf(el)!;
    await waitUntil(() => sheet.open, 'sheet open');
    await waitUntil(() => (deepActiveElement() as HTMLElement | null)?.closest?.('.action') !== undefined && !!deepActiveElement()?.classList.contains('action'), 'first action focused');
    await animationsFinished(sheet);
    await pressKeys('Escape');
    await waitUntil(() => !el.open, 'closed');
    expect(changes.events.map((event) => [event.open, event.reason])).toEqual([
      [true, 'trigger'],
      [false, 'escape'],
    ]);
  });
});

describe('DropdownMenu environment', () => {
  it('draws readable surfaces in forced colours', async () => {
    const el = await mount();
    await openByClick(el);
    const restore = await emulateMedia({forcedColors: 'active'});
    await nextFrame();
    const style = getComputedStyle(surfaceOf(el));
    expect(style.borderTopColor).not.toBe('rgba(0, 0, 0, 0)');
    await restore();
  });

  it('positions through the Floating UI fallback when implicit anchors are unavailable (Tier 2)', async () => {
    await withFeature('implicitAnchor', false, async () => {
      const el = await mount();
      await userEvent.click(triggerOf(el));
      await waitUntil(() => el.open && isShown(el), 'opened');
      await waitUntil(() => isFloatingLoaded(), 'fallback loaded');
      await aTimeout(120);
      const trigger = triggerOf(el).getBoundingClientRect();
      const surface = surfaceOf(el).getBoundingClientRect();
      expect(surface.top).toBeGreaterThanOrEqual(trigger.bottom - 1);
      expect(Math.abs(surface.left - trigger.left)).toBeLessThan(3);
    });
  });
});
