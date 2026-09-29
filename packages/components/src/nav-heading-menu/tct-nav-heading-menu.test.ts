/**
 * `tct-nav-heading-menu` and `tct-nav-heading-menu-item`: the `role="menu"` of a navigation heading popover,
 * its rows (links and actions, icon, label, description, disabled), the roving keyboard model with typeahead,
 * and the close callback a heading provides. Test names follow upstream `NavHeadingMenu.test.tsx`.
 */
import {html} from 'lit';
import {userEvent} from 'vitest/browser';
import {describe, expect, it, vi} from 'vitest';
import {ContextProvider} from '@tecton-wc/core/context/protocol.js';
import {defineElement} from '@tecton-wc/core/define.js';
import {TctElement} from '@tecton-wc/core/tct-element.js';
import {axNode, expectAccessible} from '@tecton-wc/testing/a11y.js';
import {recordEvents} from '@tecton-wc/testing/events.js';
import {fixture} from '@tecton-wc/testing/fixture.js';
import {deepActiveElement, pressKeys, tabSequence} from '@tecton-wc/testing/keyboard.js';
import {runElementSuite} from '@tecton-wc/testing/suites/element.js';
import {nextFrame, waitUntil} from '@tecton-wc/testing/timing.js';
import {navHeadingCloseContext, type NavHeadingCloseContextValue} from './nav-heading-menu.context.js';
import './define.js';
import type {TctNavHeadingMenu} from './tct-nav-heading-menu.js';
import type {TctNavHeadingMenuItem} from './tct-nav-heading-menu-item.js';

/** Stands in for the popover of a navigation heading: provides the close callback. */
class TestHeadingPopover extends TctElement {
  static override readonly tagName = 'test-heading-popover';
  closed = 0;
  readonly provider = new ContextProvider(this, {
    context: navHeadingCloseContext,
    initialValue: {
      closeMenu: () => {
        this.closed++;
      },
    } satisfies NavHeadingCloseContextValue,
  });
  override render() {
    return html`<slot></slot>`;
  }
}
defineElement(TestHeadingPopover as never);

const ROWS =
  '<tct-nav-heading-menu-item label="Dashboard" href="#dashboard"></tct-nav-heading-menu-item>' +
  '<tct-nav-heading-menu-item label="Analytics" description="Trends and reports" href="#analytics"></tct-nav-heading-menu-item>' +
  '<tct-nav-heading-menu-item label="Settings" icon="check"></tct-nav-heading-menu-item>';

async function menu(attributes = '', inner = ROWS, wrap = false): Promise<TctNavHeadingMenu> {
  const body = `<tct-nav-heading-menu ${attributes}>${inner}</tct-nav-heading-menu>`;
  const wrapper = await fixture<HTMLDivElement>(
    `<div><button id="before">before</button>${wrap ? `<test-heading-popover>${body}</test-heading-popover>` : body}<button id="after">after</button></div>`,
  );
  const element = wrapper.querySelector('tct-nav-heading-menu')!;
  await element.updateComplete;
  await settle(element);
  return element;
}

async function settle(element: Element): Promise<void> {
  await Promise.all([...element.children].map((child) => (child as TctNavHeadingMenuItem).updateComplete));
  await nextFrame();
  await nextFrame();
}

const rows = (element: Element): TctNavHeadingMenuItem[] => [...element.children] as TctNavHeadingMenuItem[];
const control = (row: TctNavHeadingMenuItem): HTMLElement => row.control!;
const focusedIndex = (element: Element): number =>
  rows(element).findIndex((row) => row.control === deepActiveElement());

runElementSuite({
  tag: 'tct-nav-heading-menu',
  render: () =>
    html`<tct-nav-heading-menu
      ><tct-nav-heading-menu-item label="One"></tct-nav-heading-menu-item
    ></tct-nav-heading-menu>`,
  properties: {size: 'lg', minWidth: '300'},
  attributes: {size: 'size', minWidth: 'min-width'},
});

runElementSuite({
  tag: 'tct-nav-heading-menu-item',
  render: () =>
    html`<tct-nav-heading-menu
      ><tct-nav-heading-menu-item id="under-test" label="One"></tct-nav-heading-menu-item
    ></tct-nav-heading-menu>`,
  properties: {label: 'Other', description: 'More', icon: 'check', href: '#x', disabled: true},
  attributes: {label: 'label', description: 'description', icon: 'icon', href: 'href'},
  skip: ['hostBox'],
});

describe('tct-nav-heading-menu', () => {
  it('is a menu whose rows are menuitems', async () => {
    const element = await menu();
    expect(await axNode(element)).toMatchObject({role: 'menu'});
    for (const row of rows(element)) expect(await axNode(control(row))).toMatchObject({role: 'menuitem'});
    expect(await axNode(control(rows(element)[0]!))).toMatchObject({name: 'Dashboard'});
  });

  it('sizes the menu by size and lets min-width override it', async () => {
    const width = async (attributes: string): Promise<number> =>
      Math.round((await menu(`style="display: inline-block" ${attributes}`)).shadowRoot!.querySelector('.menu')!.getBoundingClientRect().width);
    expect(await width('size="sm"')).toBe(160);
    expect(await width('')).toBe(200);
    expect(await width('size="lg"')).toBe(240);
    expect(await width('size="sm" min-width="300"')).toBe(300);
    expect(await width('min-width="18rem"')).toBe(288);
  });

  it('passes the size to the rows', async () => {
    const small = await menu('size="sm"');
    const large = await menu('size="lg"');
    expect(rows(large)[0]!.getBoundingClientRect().height).toBeGreaterThan(rows(small)[0]!.getBoundingClientRect().height);
  });
});

describe('tct-nav-heading-menu-item', () => {
  it('renders a link when href is provided and a div when not', async () => {
    const element = await menu();
    expect(control(rows(element)[0]!).localName).toBe('a');
    expect(control(rows(element)[0]!).getAttribute('href')).toBe('#dashboard');
    expect(control(rows(element)[2]!).localName).toBe('div');
    expect(await axNode(control(rows(element)[0]!))).toMatchObject({role: 'menuitem'});
  });

  it('renders the description, the icon and a slotted rich label', async () => {
    const element = await menu(
      '',
      '<tct-nav-heading-menu-item label="A" description="Trends" icon="check"></tct-nav-heading-menu-item>' +
        '<tct-nav-heading-menu-item><b slot="label">Rich</b><span slot="description">Desc</span><tct-icon slot="icon" name="close"></tct-icon></tct-nav-heading-menu-item>',
    );
    const [plain, rich] = rows(element);
    expect(plain!.shadowRoot!.querySelector('tct-text[type="supporting"]')!.textContent).toBe('Trends');
    expect(plain!.shadowRoot!.querySelector('tct-icon')!.getAttribute('name')).toBe('check');
    expect(rich!.shadowRoot!.querySelector('slot[name="label"]')).not.toBeNull();
    expect(rich!.shadowRoot!.querySelector('slot[name="description"]')).not.toBeNull();
    expect(rich!.shadowRoot!.querySelector('slot[name="icon"]')).not.toBeNull();
    expect(rich!.menuLabel).toBe('Rich');
  });

  it('fires click once on an action row', async () => {
    const element = await menu();
    const events = recordEvents(rows(element)[2]!, 'click');
    await userEvent.click(control(rows(element)[2]!));
    expect(events.events).toHaveLength(1);
  });

  it('does not fire click when disabled, and sets aria-disabled', async () => {
    const element = await menu('', '<tct-nav-heading-menu-item label="Off" disabled></tct-nav-heading-menu-item>');
    const row = rows(element)[0]!;
    const events = recordEvents(row, 'click');
    await userEvent.click(control(row), {force: true});
    expect(events.events).toHaveLength(0);
    expect(control(row).getAttribute('aria-disabled')).toBe('true');
    // Never a tab stop (arrow keys and typeahead skip it too).
    expect(control(row).getAttribute('tabindex')).not.toBe('0');
    expect(row.matches(':state(disabled)')).toBe(true);
  });

  it('a disabled link has no href', async () => {
    const element = await menu('', '<tct-nav-heading-menu-item label="Off" href="#x" disabled></tct-nav-heading-menu-item>');
    expect(control(rows(element)[0]!).hasAttribute('href')).toBe(false);
  });
});

describe('tct-nav-heading-menu: keyboard navigation', () => {
  it('is a single tab stop', async () => {
    const element = await menu();
    expect(rows(element).map((row) => control(row).getAttribute('tabindex'))).toEqual(['0', '-1', '-1']);
    const sequence = await tabSequence(element, {start: document.getElementById('before')!});
    expect(sequence.map((el) => el.id || 'row')).toEqual(['row', 'after']);
  });

  it('moves focus with arrow keys and wraps at the boundaries', async () => {
    const element = await menu();
    control(rows(element)[0]!).focus();
    await pressKeys('ArrowDown');
    expect(focusedIndex(element)).toBe(1);
    await pressKeys('ArrowDown', 'ArrowDown');
    expect(focusedIndex(element)).toBe(0);
    await pressKeys('ArrowUp');
    expect(focusedIndex(element)).toBe(2);
  });

  it('Home focuses the first item, End the last', async () => {
    const element = await menu();
    control(rows(element)[1]!).focus();
    await pressKeys('End');
    expect(focusedIndex(element)).toBe(2);
    await pressKeys('Home');
    expect(focusedIndex(element)).toBe(0);
  });

  it('skips disabled rows', async () => {
    const element = await menu(
      '',
      '<tct-nav-heading-menu-item label="A"></tct-nav-heading-menu-item><tct-nav-heading-menu-item label="B" disabled></tct-nav-heading-menu-item><tct-nav-heading-menu-item label="C"></tct-nav-heading-menu-item>',
    );
    control(rows(element)[0]!).focus();
    await pressKeys('ArrowDown');
    expect(focusedIndex(element)).toBe(2);
  });

  it('activates a focused action row with Enter and with Space', async () => {
    const element = await menu();
    const events = recordEvents(rows(element)[2]!, 'click');
    control(rows(element)[2]!).focus();
    await pressKeys('Enter');
    expect(events.events).toHaveLength(1);
    await pressKeys(' ');
    expect(events.events).toHaveLength(2);
  });

  it('activates a focused link row with Space as well as Enter', async () => {
    const element = await menu();
    const events = recordEvents(rows(element)[0]!, 'click');
    control(rows(element)[0]!).focus();
    await pressKeys(' ');
    expect(events.events).toHaveLength(1);
    await pressKeys('Enter');
    expect(events.events).toHaveLength(2);
  });

  it('does not activate a disabled row with Enter', async () => {
    const element = await menu('', '<tct-nav-heading-menu-item label="Off" disabled></tct-nav-heading-menu-item>');
    const events = recordEvents(rows(element)[0]!, 'click');
    await pressKeys('Enter');
    expect(events.events).toHaveLength(0);
  });

  it('typeahead focuses the row that matches the typed character and skips disabled rows', async () => {
    const element = await menu(
      '',
      '<tct-nav-heading-menu-item label="Alpha"></tct-nav-heading-menu-item><tct-nav-heading-menu-item label="Beta" disabled></tct-nav-heading-menu-item><tct-nav-heading-menu-item label="Bravo"></tct-nav-heading-menu-item>',
    );
    control(rows(element)[0]!).focus();
    await pressKeys('b');
    expect(focusedIndex(element)).toBe(2);
  });

  it('focusFirst and focusLast move focus into the menu', async () => {
    const element = await menu();
    expect(element.focusFirst()).toBe(true);
    expect(focusedIndex(element)).toBe(0);
    expect(element.focusLast()).toBe(true);
    expect(focusedIndex(element)).toBe(2);
  });
});

describe('tct-nav-heading-menu: context forwarding', () => {
  it('closes the heading popover after a row is chosen', async () => {
    const element = await menu('', ROWS, true);
    const popover = element.closest<TestHeadingPopover>('test-heading-popover')!;
    await userEvent.click(control(rows(element)[2]!));
    await waitUntil(() => popover.closed === 1, 'closed after selection');
  });

  it('does not close it for a disabled row', async () => {
    const element = await menu('', '<tct-nav-heading-menu-item label="Off" disabled></tct-nav-heading-menu-item>', true);
    const popover = element.closest<TestHeadingPopover>('test-heading-popover')!;
    await userEvent.click(control(rows(element)[0]!), {force: true});
    await nextFrame();
    expect(popover.closed).toBe(0);
  });

  it('calls the parent close on Escape', async () => {
    const element = await menu('', ROWS, true);
    const popover = element.closest<TestHeadingPopover>('test-heading-popover')!;
    control(rows(element)[1]!).focus();
    await pressKeys('Escape');
    expect(popover.closed).toBe(1);
  });

  it('works on its own: choosing a row or pressing Escape closes nothing and throws nothing', async () => {
    const element = await menu();
    const error = vi.fn();
    window.addEventListener('error', error);
    await userEvent.click(control(rows(element)[2]!));
    control(rows(element)[1]!).focus();
    await pressKeys('Escape');
    window.removeEventListener('error', error);
    expect(error).not.toHaveBeenCalled();
  });
});

describe('tct-nav-heading-menu: accessibility', () => {
  it('has no axe violations', async () => {
    const element = await menu();
    await expectAccessible(element.parentElement!);
  });
});
