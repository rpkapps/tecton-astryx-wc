/**
 * tct-context-menu: opens at the pointer on right-click, at the focused element on ContextMenu and
 * Shift+F10, and on a touch long press; the menu contract of tct-dropdown-menu (roles, roving, typeahead,
 * Escape, Tab, focus return); data and compound modes; the bottom-sheet presentation. On the CSS path the
 * Floating UI module is never loaded. Upstream test names are kept where the behaviour applies.
 */
import {afterEach, describe, expect, it} from 'vitest';
import {userEvent} from 'vitest/browser';
import {isFloatingLoaded} from '@tecton-wc/core/layer/floating.js';
import {deepActiveElement} from '@tecton-wc/core/utils/focus.js';
import {
  aTimeout,
  animationsFinished,
  axNode,
  expectAccessible,
  fixture,
  layerStack,
  nextFrame,
  pressKeys,
  recordEvents,
  runElementSuite,
  runOverlaySuite,
  waitUntil,
} from '@tecton-wc/testing/index.js';
import {stubCompactTouch} from '../dropdown-menu/menu-test-helpers.js';
import './define.js';
import '../dropdown-menu/define.js';
import type {TctContextMenu} from './tct-context-menu.js';

const ROWS = `
  <tct-dropdown-menu-item slot="menu" label="Cut"></tct-dropdown-menu-item>
  <tct-dropdown-menu-item slot="menu" label="Copy"></tct-dropdown-menu-item>
  <tct-dropdown-menu-item slot="menu" label="Paste"></tct-dropdown-menu-item>`;

const markup = (attributes = '', rows = ROWS): string =>
  `<tct-context-menu ${attributes}>
     <div id="area" tabindex="0" style="inline-size:300px;block-size:120px">Right-click this area</div>
     ${rows}
   </tct-context-menu>`;

async function mount(attributes = '', rows?: string): Promise<TctContextMenu> {
  const root = await fixture<HTMLElement>(
    `<div style="padding:40px">${markup(attributes, rows)}<button id="outside">outside</button></div>`,
  );
  const element = root.querySelector<TctContextMenu>('tct-context-menu')!;
  await element.updateComplete;
  return element;
}

const layerOf = (el: TctContextMenu): HTMLElement =>
  el.shadowRoot!.querySelector<HTMLElement>('.layer')!;
const surfaceOf = (el: TctContextMenu): HTMLElement =>
  el.shadowRoot!.querySelector<HTMLElement>('.surface')!;
const areaOf = (el: TctContextMenu): HTMLElement => el.querySelector<HTMLElement>('#area')!;
const isShown = (el: TctContextMenu): boolean => layerOf(el).matches(':popover-open');
const active = (): string =>
  (deepActiveElement() as HTMLElement | null)?.getAttribute('label') ?? '';

async function opened(el: TctContextMenu): Promise<void> {
  await waitUntil(() => el.open && isShown(el), 'opened');
  await animationsFinished(layerOf(el));
}

/** A real right-click at a point inside the area (coordinates relative to the area). */
async function rightClick(el: TctContextMenu, x = 60, y = 40): Promise<{x: number; y: number}> {
  const rect = areaOf(el).getBoundingClientRect();
  await userEvent.click(areaOf(el), {button: 'right', position: {x, y}});
  return {x: rect.left + x, y: rect.top + y};
}

/** A touch pointer event on the area, as the long-press controller sees it. */
function touch(
  el: HTMLElement,
  type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel',
  x: number,
  y: number,
  pointerId = 1,
): void {
  el.dispatchEvent(
    new PointerEvent(type, {
      pointerType: 'touch',
      pointerId,
      isPrimary: pointerId === 1,
      clientX: x,
      clientY: y,
      bubbles: true,
      composed: true,
    }),
  );
}

runElementSuite({
  tag: 'tct-context-menu',
  render: () => markup(),
  properties: {
    label: 'Other',
    size: 'sm',
    disabled: true,
    menuWidth: '240',
    presentation: 'bottom-sheet',
    backLabel: 'Up',
  },
  attributes: {
    label: 'label',
    disabled: 'disabled',
    menuWidth: 'menu-width',
    presentation: 'presentation',
  },
  events: ['tct-open-change', 'tct-after-open-change'],
});

runOverlaySuite({
  tag: 'tct-context-menu',
  render: ({attributes = '', children = ''}) =>
    `<tct-context-menu ${attributes}><div tabindex="0" id="area">Area</div><tct-dropdown-menu-item slot="menu" label="One" no-close-on-select></tct-dropdown-menu-item>${children}</tct-context-menu>`,
  trigger: (element) => element.querySelector<HTMLElement>('#area'),
  surface: (element) => element.shadowRoot!.querySelector<HTMLElement>('.layer'),
});

describe('ContextMenu', () => {
  it('renders trigger children', async () => {
    const el = await mount();
    expect(areaOf(el).textContent).toContain('Right-click this area');
  });

  it('renders the menu with role="menu" named "Context menu" (menus-13)', async () => {
    const el = await mount();
    await el.show();
    const node = await axNode(surfaceOf(el));
    expect(node.role).toBe('menu');
    expect(node.name).toBe('Context menu');
  });

  it('uses a custom label', async () => {
    const el = await mount('label="File actions"');
    await el.show();
    expect((await axNode(surfaceOf(el))).name).toBe('File actions');
  });

  it('does not put aria-haspopup on the role-less trigger wrapper (menus-15)', async () => {
    const el = await mount();
    const wrapper = el.shadowRoot!.querySelector('.trigger')!;
    expect(wrapper.hasAttribute('aria-haspopup')).toBe(false);
    expect(areaOf(el).hasAttribute('aria-haspopup')).toBe(false);
  });

  it('opens the menu on right-click at the pointer', async () => {
    const el = await mount();
    const events = recordEvents(el, ['tct-open-change', 'tct-after-open-change']);
    const point = await rightClick(el);
    await opened(el);
    const box = surfaceOf(el).getBoundingClientRect();
    // The top-start corner of the menu sits on the pointer.
    expect(Math.abs(box.left - point.x)).toBeLessThan(2);
    expect(Math.abs(box.top - point.y)).toBeLessThan(2);
    await waitUntil(() => events.named('tct-after-open-change').length === 1, 'after-open-change');
    expect(events.named('tct-open-change')).toHaveLength(1);
    expect(events.named('tct-open-change')[0]!.reason).toBe('pointer');
  });

  it('prevents the default browser menu on right-click and on the opened menu', async () => {
    const el = await mount();
    const seen: boolean[] = [];
    document.addEventListener('contextmenu', (event) => seen.push(event.defaultPrevented));
    await rightClick(el);
    await opened(el);
    expect(seen.at(-1)).toBe(true);
    await userEvent.click(el.querySelector('tct-dropdown-menu-item')!, {button: 'right'});
    expect(seen.at(-1)).toBe(true);
    expect(el.open).toBe(true);
  });

  it('does not open and leaves the native menu when disabled', async () => {
    const el = await mount('disabled');
    let prevented = true;
    areaOf(el).addEventListener('contextmenu', (event) => {
      queueMicrotask(() => {
        prevented = event.defaultPrevented;
      });
    });
    await rightClick(el);
    await aTimeout(60);
    expect(el.open).toBe(false);
    expect(prevented).toBe(false);
  });

  it('never imports the Floating UI module when it opens at the pointer on the CSS path', async () => {
    const el = await mount();
    await rightClick(el);
    await opened(el);
    expect(isFloatingLoaded()).toBe(false);
    const names = performance
      .getEntriesByType('resource')
      .map((entry) => entry.name)
      .filter((name) => /floating-ui/i.test(name));
    expect(names).toEqual([]);
  });

  it('flips at the viewport edge instead of overflowing', async () => {
    const el = await mount();
    const rect = areaOf(el).getBoundingClientRect();
    void rect;
    await el.showAt(window.innerWidth - 4, window.innerHeight - 4);
    await opened(el);
    await nextFrame();
    const box = surfaceOf(el).getBoundingClientRect();
    expect(box.right).toBeLessThanOrEqual(window.innerWidth + 1);
    expect(box.bottom).toBeLessThanOrEqual(window.innerHeight + 1);
  });

  it('opens from the ContextMenu key at the focused element', async () => {
    const el = await mount();
    areaOf(el).focus();
    const events = recordEvents(el, 'tct-open-change');
    await pressKeys('ContextMenu');
    await opened(el);
    expect(events.named('tct-open-change')).toHaveLength(1);
    expect(events.named('tct-open-change')[0]!.reason).toBe('keyboard');
    const anchor = areaOf(el).getBoundingClientRect();
    const box = surfaceOf(el).getBoundingClientRect();
    // Anchored to the bottom-start of the focused element.
    expect(Math.abs(box.left - anchor.left)).toBeLessThan(2);
    expect(Math.abs(box.top - anchor.bottom)).toBeLessThan(2);
    expect(active()).toBe('Cut');
  });

  it('opens from Shift+F10 at the focused element', async () => {
    const el = await mount();
    areaOf(el).focus();
    await pressKeys('Shift+F10');
    await opened(el);
    expect(el.open).toBe(true);
    expect(active()).toBe('Cut');
    const anchor = areaOf(el).getBoundingClientRect();
    const box = surfaceOf(el).getBoundingClientRect();
    expect(Math.abs(box.top - anchor.bottom)).toBeLessThan(2);
  });

  it('opens from a keyboard-invoked contextmenu event (coordinates 0,0)', async () => {
    const el = await mount();
    areaOf(el).focus();
    areaOf(el).dispatchEvent(
      new MouseEvent('contextmenu', {
        bubbles: true,
        composed: true,
        cancelable: true,
        clientX: 0,
        clientY: 0,
      }),
    );
    await opened(el);
    const anchor = areaOf(el).getBoundingClientRect();
    expect(Math.abs(surfaceOf(el).getBoundingClientRect().top - anchor.bottom)).toBeLessThan(2);
  });

  it('opens on touch long-press at the finger, and focuses the first row', async () => {
    const el = await mount();
    const rect = areaOf(el).getBoundingClientRect();
    const [x, y] = [rect.left + 50, rect.top + 30];
    touch(areaOf(el), 'pointerdown', x, y);
    // Not before the delay elapsed (the exact timing is covered by the controller's own test).
    expect(el.open).toBe(false);
    await opened(el);
    const box = surfaceOf(el).getBoundingClientRect();
    expect(Math.abs(box.left - x)).toBeLessThan(2);
    expect(Math.abs(box.top - y)).toBeLessThan(2);
    expect(active()).toBe('Cut');
    touch(areaOf(el), 'pointerup', x, y);
  });

  it('cancels the long-press when the finger moves past the threshold', async () => {
    const el = await mount();
    const rect = areaOf(el).getBoundingClientRect();
    touch(areaOf(el), 'pointerdown', rect.left + 50, rect.top + 30);
    touch(areaOf(el), 'pointermove', rect.left + 50, rect.top + 60);
    await aTimeout(650);
    expect(el.open).toBe(false);
  });

  it('cancels the long-press on release, and ignores a mouse', async () => {
    const el = await mount();
    const rect = areaOf(el).getBoundingClientRect();
    touch(areaOf(el), 'pointerdown', rect.left + 50, rect.top + 30);
    touch(areaOf(el), 'pointerup', rect.left + 50, rect.top + 30);
    await aTimeout(650);
    expect(el.open).toBe(false);
    areaOf(el).dispatchEvent(
      new PointerEvent('pointerdown', {pointerType: 'mouse', bubbles: true, composed: true}),
    );
    await aTimeout(650);
    expect(el.open).toBe(false);
  });

  it('does not long-press when disabled', async () => {
    const el = await mount('disabled');
    const rect = areaOf(el).getBoundingClientRect();
    touch(areaOf(el), 'pointerdown', rect.left + 50, rect.top + 30);
    await aTimeout(600);
    expect(el.open).toBe(false);
  });

  it('suppresses native text selection on the long-press trigger', async () => {
    const el = await mount();
    const wrapper = el.shadowRoot!.querySelector('.trigger')!;
    expect(getComputedStyle(wrapper).userSelect).toBe('none');
  });
});

describe('ContextMenu keyboard', () => {
  it('typeahead focuses the matching menu item (menus-11)', async () => {
    const el = await mount();
    await rightClick(el);
    await opened(el);
    await pressKeys('p');
    expect(active()).toBe('Paste');
  });

  it('arrow keys rove without wrapping; Home and End jump', async () => {
    const el = await mount();
    await rightClick(el);
    await opened(el);
    expect(active()).toBe('Cut');
    await pressKeys('ArrowDown', 'ArrowDown', 'ArrowDown');
    expect(active()).toBe('Paste');
    await pressKeys('Home');
    expect(active()).toBe('Cut');
    await pressKeys('End');
    expect(active()).toBe('Paste');
  });

  it('closes on Escape even when opened without auto-focus', async () => {
    const el = await mount();
    await el.show();
    (document.activeElement as HTMLElement | null)?.blur();
    await pressKeys('Escape');
    await waitUntil(() => !el.open, 'closed');
  });

  it('closes the menu when Tab is pressed inside it (APG menu pattern)', async () => {
    const el = await mount();
    await rightClick(el);
    await opened(el);
    await pressKeys('Tab');
    await waitUntil(() => !el.open, 'closed');
  });

  it('restores focus to the element that had it before the menu opened', async () => {
    const el = await mount();
    areaOf(el).focus();
    await pressKeys('ContextMenu');
    await opened(el);
    await pressKeys('Escape');
    await waitUntil(() => !el.open && !isShown(el), 'closed');
    await waitUntil(() => deepActiveElement() === areaOf(el), 'focus restored');
  });

  it('a press outside closes it; a right-click elsewhere reopens at the new point', async () => {
    const el = await mount();
    await rightClick(el, 40, 30);
    await opened(el);
    await userEvent.click(document.querySelector('#outside')!);
    await waitUntil(() => !el.open, 'closed');
    await rightClick(el, 120, 60);
    await opened(el);
  });

  it('ignores Escape during IME composition', async () => {
    const el = await mount();
    await rightClick(el);
    await opened(el);
    document.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Escape',
        isComposing: true,
        bubbles: true,
        cancelable: true,
      }),
    );
    await aTimeout(60);
    expect(el.open).toBe(true);
  });
});

describe('ContextMenu items', () => {
  it('fires click once per activation and closes the menu', async () => {
    const el = await mount();
    const row = el.querySelector('tct-dropdown-menu-item')!;
    const clicks = recordEvents(row, 'click');
    await rightClick(el);
    await opened(el);
    await userEvent.click(row);
    expect(clicks.events).toHaveLength(1);
    await waitUntil(() => !el.open, 'closed');
  });

  it('does not activate a disabled row', async () => {
    const el = await mount(
      '',
      `<tct-dropdown-menu-item slot="menu" label="Off" disabled></tct-dropdown-menu-item>`,
    );
    const row = el.querySelector('tct-dropdown-menu-item')!;
    const clicks = recordEvents(row, 'click');
    await rightClick(el);
    await opened(el);
    await userEvent.click(row);
    await pressKeys('Enter');
    expect(clicks.events).toHaveLength(0);
    expect(el.open).toBe(true);
    expect((await axNode(row)).disabled).toBe('true');
  });

  it('renders data items, dividers, sections and a submenu with keyboard reach past it', async () => {
    const clicked: string[] = [];
    const el = await mount('', '');
    el.items = [
      {label: 'Edit', onClick: () => clicked.push('edit')},
      {type: 'divider'},
      {type: 'section', title: 'Danger', items: [{label: 'Delete', variant: 'destructive'}]},
      {label: 'Move to', items: [{label: 'Folder A', onClick: () => clicked.push('a')}]},
      {label: 'Rename'},
    ];
    await el.updateComplete;
    await rightClick(el);
    await opened(el);
    const roles = await Promise.all(
      [...surfaceOf(el).querySelectorAll('[role="group"]')].map(
        async (node) => (await axNode(node)).name,
      ),
    );
    expect(roles).toEqual(['Danger']);
    await pressKeys('ArrowDown', 'ArrowDown', 'ArrowDown');
    expect(active()).toBe('Rename');
    await pressKeys('ArrowUp');
    expect(active()).toBe('Move to');
    await pressKeys('ArrowRight');
    await waitUntil(() => active() === 'Folder A', 'flyout focused');
    await pressKeys('Enter');
    await waitUntil(() => !el.open, 'closed');
    expect(clicked).toEqual(['a']);
  });

  it('renders checkbox and radio items with the right roles and states', async () => {
    const el = await mount(
      '',
      `<tct-dropdown-menu-checkbox-item slot="menu" label="Bold" checked></tct-dropdown-menu-checkbox-item>
       <tct-dropdown-menu-radio-group slot="menu" label="Align" value="left">
         <tct-dropdown-menu-radio-item value="left" label="Left"></tct-dropdown-menu-radio-item>
         <tct-dropdown-menu-radio-item value="right" label="Right"></tct-dropdown-menu-radio-item>
       </tct-dropdown-menu-radio-group>`,
    );
    await el.show();
    const bold = await axNode(el.querySelector('tct-dropdown-menu-checkbox-item')!);
    expect(bold.role).toBe('menuitemcheckbox');
    expect(bold.checked).toBe('true');
    const [left, right] = await Promise.all(
      [...el.querySelectorAll('tct-dropdown-menu-radio-item')].map((node) => axNode(node)),
    );
    expect(left!.role).toBe('menuitemradio');
    expect(left!.checked).toBe('true');
    expect(right!.checked).toBe('false');
    await expectAccessible(el);
  });
});

describe('ContextMenu bottom sheet', () => {
  let stub: ReturnType<typeof stubCompactTouch> | undefined;
  afterEach(() => {
    stub?.restore();
    stub = undefined;
  });

  const ITEMS = [
    {label: 'Edit'},
    {label: 'Move to', items: [{label: 'Folder A'}]},
    {label: 'Delete', variant: 'destructive' as const},
  ];

  it('opens the data items in a bottom sheet when requested', async () => {
    const el = await mount('presentation="bottom-sheet"', '');
    el.items = ITEMS;
    await el.updateComplete;
    await el.show();
    const sheet = el.shadowRoot!.querySelector('tct-bottom-sheet')!;
    await waitUntil(() => sheet.open, 'sheet open');
    expect(sheet.getAttribute('label')).toBe('Context menu');
    expect(isShown(el)).toBe(false);
    expect(sheet.querySelectorAll('tct-list-item')).toHaveLength(3);
  });

  it('drills into nested data items inside the sheet, and back', async () => {
    const el = await mount('presentation="bottom-sheet"', '');
    el.items = ITEMS;
    await el.updateComplete;
    await el.show();
    const sheet = el.shadowRoot!.querySelector('tct-bottom-sheet')!;
    await waitUntil(() => sheet.open, 'sheet open');
    const rows = sheet.querySelectorAll<HTMLElement>('tct-list-item');
    rows[1]!.click();
    await el.updateComplete;
    await waitUntil(() => sheet.querySelectorAll('tct-list-item').length === 1, 'drilled in');
    expect(sheet.getAttribute('label')).toBe('Move to');
    expect(sheet.querySelector('tct-heading')!.textContent).toBe('Move to');
    sheet.querySelector<HTMLElement>('.sheet-back')!.click();
    await el.updateComplete;
    await waitUntil(() => sheet.querySelectorAll('tct-list-item').length === 3, 'back at the root');
  });

  it('uses the bottom sheet for adaptive presentation on compact touch, a popover otherwise', async () => {
    stub = stubCompactTouch(true);
    const el = await mount('presentation="adaptive"', '');
    el.items = ITEMS;
    await el.updateComplete;
    await el.show();
    const sheet = el.shadowRoot!.querySelector('tct-bottom-sheet')!;
    await waitUntil(() => sheet.open, 'sheet open');
    stub.set(false);
    await el.updateComplete;
    await waitUntil(() => isShown(el), 'popover shown after the switch');
    expect(el.open).toBe(true);
    expect(el.shadowRoot!.querySelector('tct-bottom-sheet')).toBeNull();
  });

  it('a sheet close (Escape) asks through tct-open-change and closes', async () => {
    const el = await mount('presentation="bottom-sheet"', '');
    el.items = ITEMS;
    await el.updateComplete;
    const changes = recordEvents(el, 'tct-open-change');
    await el.show();
    const sheet = el.shadowRoot!.querySelector('tct-bottom-sheet')!;
    await waitUntil(() => sheet.open, 'sheet open');
    await animationsFinished(sheet);
    await pressKeys('Escape');
    await waitUntil(() => !el.open, 'closed');
    expect(changes.events.at(-1)!.open).toBe(false);
    expect(changes.events.at(-1)!.reason).toBe('escape');
    expect(layerStack()).toHaveLength(0);
  });
});
