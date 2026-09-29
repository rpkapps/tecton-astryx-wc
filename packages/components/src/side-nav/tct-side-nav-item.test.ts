/**
 * tct-side-nav-item: the link or button row, the selected and disabled states, sub-items and their
 * toggle (whole row, or a separate chevron button next to a link), actions, the collapsed rail (named
 * icon buttons with tooltips, flyouts for items with sub-items), routing, and text contrast in every state
 * (ported from the upstream SideNavItem tests).
 */
import {html} from 'lit';
import {afterEach, describe, expect, it} from 'vitest';
import {cdp, page, userEvent} from 'vitest/browser';
import {containsFlat, deepActiveElement} from '@tecton-wc/core/utils/focus.js';
import {axNode, expectAccessible} from '@tecton-wc/testing/a11y.js';
import {emulateMedia} from '@tecton-wc/testing/emulate.js';
import {recordEvents} from '@tecton-wc/testing/events.js';
import {fixture} from '@tecton-wc/testing/fixture.js';
import {pressKeys, tabSequence} from '@tecton-wc/testing/keyboard.js';
import {runElementSuite} from '@tecton-wc/testing/suites/element.js';
import {animationsFinished, nextFrame, waitUntil} from '@tecton-wc/testing/timing.js';
import '../link/define.js';
import './define.js';
import type {TctSideNavItem} from './tct-side-nav-item.js';

afterEach(async () => {
  await page.viewport(1000, 700);
  await userEvent.hover(document.body, {position: {x: 0, y: 0}}).catch(() => undefined);
});

const contrastOnly = {runOnly: {type: 'rule' as const, values: ['color-contrast']}};

runElementSuite({
  tag: 'tct-side-nav-item',
  render: () => html`<tct-side-nav-item label="Dashboard" href="#"></tct-side-nav-item>`,
  properties: {
    label: 'Projects',
    icon: 'funnel',
    selectedIcon: 'funnel',
    selected: true,
    disabled: true,
    href: '#projects',
    size: 'lg',
    noCollapse: true,
    collapsed: true,
    hasAction: true,
  },
  attributes: {
    label: 'label',
    icon: 'icon',
    selectedIcon: 'selected-icon',
    selected: 'selected',
    disabled: 'disabled',
    href: 'href',
    size: 'size',
    noCollapse: 'no-collapse',
    collapsed: 'collapsed',
    hasAction: 'has-action',
  },
  events: ['tct-collapse-change'],
});

/** A side navigation (optionally collapsible and collapsed) around the items under test. */
async function nav(content: string, attributes = '', theme?: 'light' | 'dark') {
  await page.viewport(1000, 700);
  const wrapper = await fixture<HTMLElement>(
    `<div style="block-size: 500px"><tct-side-nav ${attributes}><tct-side-nav-section heading="Main">${content}</tct-side-nav-section></tct-side-nav></div>`,
    theme ? {theme} : {},
  );
  const element = wrapper.querySelector('tct-side-nav')!;
  await element.updateComplete;
  await nextFrame();
  return {wrapper, nav: element};
}

const item = (root: ParentNode, selector: string): TctSideNavItem =>
  root.querySelector<TctSideNavItem>(selector)!;
const inner = <T extends HTMLElement = HTMLElement>(element: Element, selector: string): T =>
  element.shadowRoot!.querySelector<T>(selector)!;
const primary = (element: Element): HTMLElement => inner(element, '.primary');

describe('tct-side-nav-item: the row', () => {
  it('renders the label as a link when it has an href', async () => {
    const {nav: root} = await nav(
      '<tct-side-nav-item id="a" label="Dashboard" href="#dash"></tct-side-nav-item>',
    );
    const link = primary(item(root, '#a'));
    expect(link.localName).toBe('a');
    expect(link.getAttribute('href')).toBe('#dash');
    expect(link.textContent).toContain('Dashboard');
    expect(await axNode(link)).toMatchObject({role: 'link', name: 'Dashboard'});
  });

  it('renders a button without an href', async () => {
    const {nav: root} = await nav('<tct-side-nav-item id="a" label="Create"></tct-side-nav-item>');
    const button = primary(item(root, '#a'));
    expect(button.localName).toBe('button');
    expect(button.getAttribute('type')).toBe('button');
    expect(await axNode(button)).toMatchObject({role: 'button', name: 'Create'});
  });

  it('marks the current page with aria-current="page" on the link, and only when selected', async () => {
    const {nav: root} = await nav(`
      <tct-side-nav-item id="a" label="Dashboard" href="#a" selected></tct-side-nav-item>
      <tct-side-nav-item id="b" label="Projects" href="#b"></tct-side-nav-item>`);
    expect(primary(item(root, '#a')).getAttribute('aria-current')).toBe('page');
    expect(primary(item(root, '#b')).hasAttribute('aria-current')).toBe(false);
    expect(await axNode(primary(item(root, '#a')))).toMatchObject({
      role: 'link',
      name: 'Dashboard',
    });
  });

  it('disables a button, and turns a disabled link into a disabled button', async () => {
    const {nav: root} = await nav(`
      <tct-side-nav-item id="a" label="One" disabled></tct-side-nav-item>
      <tct-side-nav-item id="b" label="Two" href="#b" disabled></tct-side-nav-item>`);
    for (const id of ['#a', '#b']) {
      const control = primary(item(root, id)) as HTMLButtonElement;
      expect(control.localName).toBe('button');
      expect(control.disabled).toBe(true);
    }
    expect(primary(item(root, '#b')).hasAttribute('href')).toBe(false);
  });

  it('fires no click for a disabled item', async () => {
    const {nav: root} = await nav(
      '<tct-side-nav-item id="a" label="One" disabled></tct-side-nav-item>',
    );
    const events = recordEvents(root, ['click']);
    await userEvent.click(primary(item(root, '#a')), {force: true}).catch(() => undefined);
    expect(events.named('click').length).toBe(0);
  });

  it('shows the icon, and the selected icon while selected', async () => {
    const {nav: root} = await nav(`
      <tct-side-nav-item id="a" label="One" icon="funnel" selected-icon="wrench"></tct-side-nav-item>`);
    const one = item(root, '#a');
    expect(inner(one, 'tct-icon').getAttribute('name')).toBe('funnel');
    one.selected = true;
    await one.updateComplete;
    expect(inner(one, 'tct-icon').getAttribute('name')).toBe('wrench');
  });

  it('projects a custom icon from the icon slot, and end content from the end slot', async () => {
    const {nav: root} = await nav(`
      <tct-side-nav-item id="a" label="One">
        <svg slot="icon" id="glyph" width="16" height="16"></svg>
        <span slot="end" id="count">3</span>
      </tct-side-nav-item>`);
    const one = item(root, '#a');
    expect(inner<HTMLSlotElement>(one, 'slot[name="icon"]').assignedElements()[0]!.id).toBe(
      'glyph',
    );
    expect(inner<HTMLSlotElement>(one, 'slot[name="end"]').assignedElements()[0]!.id).toBe('count');
    expect(primary(one).contains(inner(one, 'slot[name="end"]'))).toBe(true);
  });

  it('a host aria-label names the control in place of the label', async () => {
    const {nav: root} = await nav(
      '<tct-side-nav-item id="a" label="One" aria-label="Go to one" href="#a"></tct-side-nav-item>',
    );
    expect((await axNode(primary(item(root, '#a')))).name).toBe('Go to one');
  });

  it('has the three row heights', async () => {
    const {nav: root} = await nav(`
      <tct-side-nav-item id="sm" label="S" size="sm" href="#"></tct-side-nav-item>
      <tct-side-nav-item id="md" label="M" href="#"></tct-side-nav-item>
      <tct-side-nav-item id="lg" label="L" size="lg" href="#"></tct-side-nav-item>`);
    expect(primary(item(root, '#sm')).getBoundingClientRect().height).toBe(28);
    expect(primary(item(root, '#md')).getBoundingClientRect().height).toBe(32);
    expect(primary(item(root, '#lg')).getBoundingClientRect().height).toBe(36);
  });

  it('is accessible in every state', async () => {
    const {wrapper} = await nav(`
      <tct-side-nav-item label="Dashboard" icon="viewColumns" href="#a" selected></tct-side-nav-item>
      <tct-side-nav-item label="Projects" icon="funnel" href="#b"></tct-side-nav-item>
      <tct-side-nav-item label="Disabled" icon="close" disabled></tct-side-nav-item>
      <tct-side-nav-item label="Settings" icon="wrench">
        <tct-side-nav-item label="General" href="#c"></tct-side-nav-item>
      </tct-side-nav-item>`);
    await expectAccessible(wrapper);
  });
});

describe('tct-side-nav-item: text contrast in every state', () => {
  const CONTENT = `
    <tct-side-nav-item id="a" label="Dashboard" icon="viewColumns" href="#a" selected></tct-side-nav-item>
    <tct-side-nav-item id="b" label="Projects" icon="funnel" href="#b"></tct-side-nav-item>`;

  for (const theme of ['light', 'dark'] as const) {
    it(`rest, selected and section heading (${theme})`, async () => {
      const {wrapper} = await nav(CONTENT, '', theme);
      await expectAccessible(wrapper, contrastOnly);
    });

    it(`hover on the resting row and on the selected row (${theme})`, async () => {
      const {wrapper, nav: root} = await nav(CONTENT, '', theme);
      for (const id of ['#b', '#a']) {
        await userEvent.hover(primary(item(root, id)));
        await animationsFinished(primary(item(root, id)));
        await expectAccessible(wrapper, contrastOnly);
      }
    });

    it(`keyboard focus (${theme})`, async () => {
      const {wrapper, nav: root} = await nav(CONTENT, '', theme);
      primary(item(root, '#b')).focus();
      await pressKeys('Shift+Tab');
      await pressKeys('Tab');
      await expectAccessible(wrapper, contrastOnly);
    });

    it(`pressed (${theme})`, async () => {
      const {wrapper, nav: root} = await nav(CONTENT, '', theme);
      const row = primary(item(root, '#b')).getBoundingClientRect();
      const x = row.left + row.width / 2;
      const y = row.top + row.height / 2;
      const session = cdp();
      await session.send('Input.dispatchMouseEvent', {type: 'mouseMoved', x, y});
      await session.send('Input.dispatchMouseEvent', {
        type: 'mousePressed',
        x,
        y,
        button: 'left',
        clickCount: 1,
      });
      try {
        await expectAccessible(wrapper, contrastOnly);
      } finally {
        await session.send('Input.dispatchMouseEvent', {
          type: 'mouseReleased',
          x,
          y,
          button: 'left',
          clickCount: 1,
        });
      }
    });
  }
});

describe('tct-side-nav-item: sub-items', () => {
  const GROUP = `
    <tct-side-nav-item id="g" label="Settings" icon="wrench">
      <tct-side-nav-item id="general" label="General" href="#general"></tct-side-nav-item>
      <tct-side-nav-item id="security" label="Security" href="#security"></tct-side-nav-item>
    </tct-side-nav-item>`;

  it('renders the sub-items in a group named by the item, indented', async () => {
    const {nav: root} = await nav(GROUP);
    const group = item(root, '#g');
    const children = inner(group, '.children');
    expect(children.getAttribute('role')).toBe('group');
    expect((await axNode(children)).name).toBe('Settings');
    const parent = primary(group).getBoundingClientRect();
    const child = primary(item(root, '#general')).getBoundingClientRect();
    expect(child.left - parent.left).toBeGreaterThanOrEqual(24);
  });

  it('a whole-row toggle: the row is the disclosure button, and Enter and Space toggle', async () => {
    const {nav: root} = await nav(GROUP);
    const group = item(root, '#g');
    const events = recordEvents(root, ['tct-collapse-change']);
    const row = primary(group);
    expect(await axNode(row)).toMatchObject({role: 'button', name: 'Settings', expanded: 'true'});
    row.focus();
    await pressKeys('Enter');
    await group.updateComplete;
    expect(group.collapsed).toBe(true);
    expect((await axNode(row)).expanded).toBe('false');
    await pressKeys('Space');
    await group.updateComplete;
    expect(group.collapsed).toBe(false);
    expect(
      events
        .named('tct-collapse-change')
        .map((event) => (event as never as {reason: string}).reason),
    ).toEqual(['keyboard', 'keyboard']);
  });

  it('collapsed sub-items are inert: not focusable and not in the accessibility tree', async () => {
    const {nav: root} = await nav(GROUP);
    const group = item(root, '#g');
    group.collapsed = true;
    await group.updateComplete;
    await animationsFinished(inner(group, '.children'));
    expect(inner(group, '.children').inert).toBe(true);
    const link = primary(item(root, '#general'));
    link.focus();
    expect(containsFlat(link, deepActiveElement())).toBe(false);
    expect((await axNode(link)).ignored).toBe('true');
    // Tabbing through the navigation skips the hidden links.
    primary(group).focus();
    await pressKeys('Tab');
    expect(deepActiveElement()).not.toBe(link);
  });

  it('the attribute is the initial state; a click asks with a cancelable tct-collapse-change first', async () => {
    const {nav: root} = await nav(GROUP.replace('id="g"', 'id="g" collapsed'));
    const group = item(root, '#g');
    expect(group.collapsed).toBe(true);
    const events = recordEvents(root, ['tct-collapse-change']);
    group.addEventListener('tct-collapse-change', (event) => {
      event.preventDefault();
    });
    await userEvent.click(primary(group));
    expect(events.named('tct-collapse-change').length).toBe(1);
    expect(
      (events.named('tct-collapse-change')[0] as never as {collapsed: boolean}).collapsed,
    ).toBe(false);
    expect(group.collapsed).toBe(true);
    group.collapsed = false;
    await group.updateComplete;
    expect(events.named('tct-collapse-change').length).toBe(1);
  });

  it('a link with sub-items keeps its destination: a separate chevron button toggles them', async () => {
    const {nav: root} = await nav(GROUP.replace('id="g" ', 'id="g" href="#settings" '));
    const group = item(root, '#g');
    const link = primary(group);
    expect(link.localName).toBe('a');
    expect(link.hasAttribute('aria-expanded')).toBe(false);
    const toggle = inner(group, '.toggle');
    expect(await axNode(toggle)).toMatchObject({
      role: 'button',
      name: 'Collapse Settings',
      expanded: 'true',
    });
    // Clicking the link does not toggle; clicking the chevron does, and never bubbles as an item click.
    const clicks = recordEvents(group, ['click']);
    await userEvent.click(toggle);
    await group.updateComplete;
    expect(group.collapsed).toBe(true);
    expect(clicks.named('click').length).toBe(0);
    expect((await axNode(toggle)).name).toBe('Expand Settings');
    link.addEventListener('click', (event) => {
      event.preventDefault();
    });
    await userEvent.click(link);
    expect(group.collapsed).toBe(true);
  });

  it('has-action gives a button row the same separate toggle', async () => {
    const {nav: root} = await nav(GROUP.replace('id="g" ', 'id="g" has-action '));
    expect(inner(item(root, '#g'), '.toggle')).not.toBeNull();
    expect(primary(item(root, '#g')).hasAttribute('aria-expanded')).toBe(false);
  });

  it('no-collapse keeps the sub-items always shown', async () => {
    const {nav: root} = await nav(GROUP.replace('id="g" ', 'id="g" no-collapse '));
    const group = item(root, '#g');
    expect(primary(group).hasAttribute('aria-expanded')).toBe(false);
    expect(inner(group, '.chevron')).toBeNull();
    await userEvent.click(primary(group));
    expect(group.collapsed).toBe(false);
  });

  it('an item without sub-items has no toggle and no chevron', async () => {
    const {nav: root} = await nav(
      '<tct-side-nav-item id="a" label="One" href="#"></tct-side-nav-item>',
    );
    expect(inner(item(root, '#a'), '.chevron')).toBeNull();
    expect(inner(item(root, '#a'), '.children')).toBeNull();
  });
});

describe('tct-side-nav-item: actions', () => {
  const ACTIONS = `
    <tct-side-nav-item id="a" label="Projects" href="#projects">
      <tct-button slot="actions" id="more" variant="ghost" icon-only icon="close" label="Project actions"></tct-button>
      <tct-side-nav-item id="alpha" label="Alpha" href="#alpha"></tct-side-nav-item>
    </tct-side-nav-item>`;

  it('renders the actions beside the primary, not inside it, at the compact size', async () => {
    const {nav: root} = await nav(ACTIONS);
    const row = item(root, '#a');
    const action = root.querySelector<HTMLElement>('#more')!;
    expect(primary(row).contains(inner(row, 'slot[name="actions"]'))).toBe(false);
    expect(inner<HTMLSlotElement>(row, 'slot[name="actions"]').assignedElements()[0]).toBe(action);
    await waitUntil(
      () => action.shadowRoot!.querySelector('.button')!.getAttribute('data-size') === 'sm',
      'compact size',
    );
  });

  it('tabs reach the primary, the toggle and the action before the sub-items', async () => {
    const {nav: root} = await nav(ACTIONS);
    const row = item(root, '#a');
    const stops = await tabSequence(row, {start: primary(row)});
    expect(stops[0]).toBe(inner(row, '.toggle'));
    expect(containsFlat(root.querySelector('#more'), stops[1] ?? null)).toBe(true);
    expect(containsFlat(item(root, '#alpha'), stops[2] ?? null)).toBe(true);
  });

  it('clicking an action does not activate the item', async () => {
    const {nav: root} = await nav(ACTIONS);
    const row = item(root, '#a');
    let navigated = false;
    primary(row).addEventListener('click', () => {
      navigated = true;
    });
    await userEvent.click(root.querySelector<HTMLElement>('#more')!);
    expect(navigated).toBe(false);
    expect(row.collapsed).toBe(false);
  });

  it('a disabled row keeps its actions clickable', async () => {
    const {nav: root} = await nav(`
      <tct-side-nav-item id="a" label="One" disabled>
        <tct-button slot="actions" id="more" variant="ghost" icon-only icon="close" label="More"></tct-button>
      </tct-side-nav-item>`);
    let clicks = 0;
    root.querySelector('#more')!.addEventListener('click', () => {
      clicks += 1;
    });
    await userEvent.click(root.querySelector<HTMLElement>('#more')!);
    expect(clicks).toBe(1);
  });

  it('adds no row wrapper without actions', async () => {
    const {nav: root} = await nav(
      '<tct-side-nav-item id="a" label="One" href="#"></tct-side-nav-item>',
    );
    expect(inner(item(root, '#a'), '.row-wrap')).toBeNull();
  });
});

describe('tct-side-nav-item: routing', () => {
  it('hands an unmodified click on an internal link to the router', async () => {
    await page.viewport(1000, 700);
    const wrapper = await fixture<HTMLElement>(
      `<tct-link-provider><tct-side-nav><tct-side-nav-item id="a" label="One" href="/one"></tct-side-nav-item></tct-side-nav></tct-link-provider>`,
    );
    const provider = wrapper as HTMLElement & {
      navigate?: (href: string, event: MouseEvent) => boolean;
    };
    const calls: string[] = [];
    provider.navigate = (href) => {
      calls.push(href);
      return true;
    };
    await userEvent.click(primary(item(wrapper, '#a')));
    expect(calls).toEqual(['/one']);
  });

  it('a javascript: destination renders no href', async () => {
    const {nav: root} = await nav(
      '<tct-side-nav-item id="a" label="One" href="javascript:alert(1)"></tct-side-nav-item>',
    );
    expect(primary(item(root, '#a')).hasAttribute('href')).toBe(false);
  });
});

describe('tct-side-nav-item: forced colors', () => {
  it('marks the current page with Highlight and HighlightText', async () => {
    const {nav: root} = await nav(
      '<tct-side-nav-item id="a" label="One" icon="funnel" href="#a" selected></tct-side-nav-item>',
    );
    await emulateMedia({forcedColors: 'active'});
    await nextFrame();
    const row = primary(item(root, '#a'));
    const probe = document.createElement('div');
    probe.style.cssText = 'background: Highlight; color: HighlightText';
    document.body.append(probe);
    const expected = getComputedStyle(probe);
    const style = getComputedStyle(row);
    expect(style.backgroundColor).toBe(expected.backgroundColor);
    expect(style.color).toBe(expected.color);
    probe.remove();
  });
});

describe('tct-side-nav-item: the collapsed rail', () => {
  const RAIL = `
    <tct-side-nav-item id="dash" label="Dashboard" icon="viewColumns" href="#dash" selected></tct-side-nav-item>
    <tct-side-nav-item id="plain" label="Create" icon="funnel"></tct-side-nav-item>
    <tct-side-nav-item id="noicon" label="No icon" href="#no"></tct-side-nav-item>
    <tct-side-nav-item id="settings" label="Settings" icon="wrench">
      <tct-side-nav-item id="general" label="General" href="#general"></tct-side-nav-item>
      <tct-side-nav-item id="security" label="Security" href="#security"></tct-side-nav-item>
    </tct-side-nav-item>`;

  async function rail(content = RAIL) {
    const parts = await nav(content, 'collapsible collapsed');
    return parts;
  }

  it('hides an item without an icon', async () => {
    const {nav: root} = await rail();
    expect(item(root, '#noicon').shadowRoot!.querySelector('.root')).toBeNull();
    expect(item(root, '#noicon').getBoundingClientRect().height).toBe(0);
  });

  it('renders an icon-only link named by its label, with the current page marked', async () => {
    const {nav: root} = await rail();
    const link = primary(item(root, '#dash'));
    expect(link.localName).toBe('a');
    expect(await axNode(link)).toMatchObject({role: 'link', name: 'Dashboard'});
    expect(link.getAttribute('aria-current')).toBe('page');
    expect(link.getBoundingClientRect().width).toBe(32);
    expect(link.querySelector('.nav-row-label')).toBeNull();
  });

  it('renders an icon-only button for an item without a destination', async () => {
    const {nav: root} = await rail();
    expect(await axNode(primary(item(root, '#plain')))).toMatchObject({
      role: 'button',
      name: 'Create',
    });
  });

  it('keeps a consumer aria-label, and falls back to the label when it is blank', async () => {
    const {nav: root} = await rail(`
      <tct-side-nav-item id="a" label="Dashboard" icon="funnel" href="#a" aria-label="Open dashboard"></tct-side-nav-item>
      <tct-side-nav-item id="b" label="Reports" icon="funnel" href="#b" aria-label="   "></tct-side-nav-item>`);
    expect((await axNode(primary(item(root, '#a')))).name).toBe('Open dashboard');
    expect((await axNode(primary(item(root, '#b')))).name).toBe('Reports');
  });

  it('shows the label in a tooltip on keyboard focus', async () => {
    const {nav: root} = await rail();
    const link = primary(item(root, '#dash'));
    link.focus();
    await pressKeys('Shift+Tab');
    await pressKeys('Tab');
    const surface = inner(item(root, '#dash'), '.tooltip-surface');
    await waitUntil(() => surface.matches(':popover-open'), 'the tooltip opens');
    await animationsFinished(surface);
    expect(surface.textContent?.trim()).toBe('Dashboard');
    // It sits beside the rail, on the inline end.
    const tip = surface.getBoundingClientRect();
    expect(tip.left).toBeGreaterThanOrEqual(link.getBoundingClientRect().right);
    await pressKeys('Escape');
    await waitUntil(() => !surface.matches(':popover-open'), 'Escape closes the tooltip');
  });

  it('shows the tooltip on hover', async () => {
    const {nav: root} = await rail();
    const link = primary(item(root, '#dash'));
    await userEvent.hover(link);
    const surface = inner(item(root, '#dash'), '.tooltip-surface');
    await waitUntil(() => surface.matches(':popover-open'), 'the tooltip opens on hover');
  });

  it('an item with sub-items is a button that opens a flyout of the sub-items, in full', async () => {
    const {nav: root} = await rail();
    const settings = item(root, '#settings');
    const trigger = inner(settings, '.rail-trigger');
    expect(await axNode(trigger)).toMatchObject({
      role: 'button',
      name: 'Settings',
      expanded: 'false',
    });
    await userEvent.click(trigger);
    const layer = inner(settings, '.flyout-layer');
    await waitUntil(() => layer.matches(':popover-open'), 'the flyout opens');
    await animationsFinished(layer);
    expect((await axNode(trigger)).expanded).toBe('true');
    const flyout = inner(settings, '.flyout');
    expect(await axNode(flyout)).toMatchObject({role: 'dialog', name: 'Settings submenu'});
    // The sub-items render as full rows (labels), not icon buttons, and beside the rail.
    const general = primary(item(root, '#general'));
    expect(general.textContent).toContain('General');
    expect(general.getBoundingClientRect().width).toBeGreaterThan(100);
    expect(layer.getBoundingClientRect().left).toBeGreaterThanOrEqual(
      trigger.getBoundingClientRect().right,
    );
    await expectAccessible(root.parentElement!);
  });

  it('opens from the keyboard, moves focus into the flyout, and Escape returns it to the button', async () => {
    const {nav: root} = await rail();
    const settings = item(root, '#settings');
    const trigger = inner(settings, '.rail-trigger');
    trigger.focus();
    await pressKeys('Enter');
    const layer = inner(settings, '.flyout-layer');
    await waitUntil(() => layer.matches(':popover-open'), 'the flyout opens');
    await waitUntil(
      () => containsFlat(item(root, '#general'), deepActiveElement()),
      'focus moves to the first link',
    );
    await pressKeys('Escape');
    await waitUntil(() => !layer.matches(':popover-open'), 'Escape closes it');
    await waitUntil(() => deepActiveElement() === trigger, 'focus returns to the button');
  });

  it('a hover-open leaves focus where it was', async () => {
    const {nav: root} = await rail();
    const settings = item(root, '#settings');
    const trigger = inner(settings, '.rail-trigger');
    await userEvent.hover(trigger);
    const layer = inner(settings, '.flyout-layer');
    await waitUntil(() => layer.matches(':popover-open'), 'hover opens the flyout');
    expect(containsFlat(layer, deepActiveElement())).toBe(false);
  });

  it('a click within the guard after a hover-open confirms it, and a later click closes it', async () => {
    const {nav: root} = await rail();
    const settings = item(root, '#settings');
    const trigger = inner(settings, '.rail-trigger');
    const layer = inner(settings, '.flyout-layer');
    await userEvent.hover(trigger);
    await waitUntil(() => layer.matches(':popover-open'), 'hover opens the flyout');
    await userEvent.click(trigger);
    // Upstream: the flyout opens beside the rail, so a click after a hover-open is a deliberate dismissal.
    await waitUntil(() => !layer.matches(':popover-open'), 'the click closes it');
  });

  it('a hover-open closes when the pointer leaves; a click-open stays', async () => {
    const {nav: root} = await rail();
    const settings = item(root, '#settings');
    const trigger = inner(settings, '.rail-trigger');
    const layer = inner(settings, '.flyout-layer');
    await userEvent.hover(trigger);
    await waitUntil(() => layer.matches(':popover-open'), 'hover opens it');
    await userEvent.hover(document.body, {position: {x: 900, y: 600}});
    await waitUntil(() => !layer.matches(':popover-open'), 'leaving closes a hover-open');
    await userEvent.click(trigger);
    await waitUntil(() => layer.matches(':popover-open'), 'a click opens it');
    await userEvent.hover(document.body, {position: {x: 900, y: 600}});
    await nextFrame();
    expect(layer.matches(':popover-open')).toBe(true);
  });

  it('choosing a link in the flyout closes it', async () => {
    const {nav: root} = await rail();
    const settings = item(root, '#settings');
    const layer = inner(settings, '.flyout-layer');
    await userEvent.click(inner(settings, '.rail-trigger'));
    await waitUntil(() => layer.matches(':popover-open'), 'the flyout opens');
    const link = primary(item(root, '#general'));
    link.addEventListener('click', (event) => {
      event.preventDefault();
    });
    await userEvent.click(link);
    await waitUntil(() => !layer.matches(':popover-open'), 'the flyout closes');
  });

  it('closes when focus leaves it, and when the navigation expands', async () => {
    const {nav: root} = await rail();
    const settings = item(root, '#settings');
    const layer = inner(settings, '.flyout-layer');
    await userEvent.click(inner(settings, '.rail-trigger'));
    await waitUntil(() => layer.matches(':popover-open'), 'the flyout opens');
    root.expand();
    await root.updateComplete;
    await waitUntil(
      () => item(root, '#settings').shadowRoot!.querySelector('.flyout-layer') === null,
      'the row renders',
    );
  });

  it('gives the flyout the German name and mirrors beside the rail in RTL', async () => {
    await page.viewport(1000, 700);
    const wrapper = await fixture<HTMLElement>(
      `<div style="block-size: 500px"><tct-side-nav collapsible collapsed>${RAIL}</tct-side-nav></div>`,
      {dir: 'rtl', lang: 'de-DE'},
    );
    const root = wrapper.querySelector('tct-side-nav')!;
    await root.updateComplete;
    await nextFrame();
    const settings = item(root, '#settings');
    const trigger = inner(settings, '.rail-trigger');
    await userEvent.click(trigger);
    const layer = inner(settings, '.flyout-layer');
    await waitUntil(() => layer.matches(':popover-open'), 'the flyout opens');
    await animationsFinished(layer);
    expect((await axNode(inner(settings, '.flyout'))).name).toMatch(/Settings/);
    // The rail is on the right in RTL, so the flyout opens to its left.
    expect(layer.getBoundingClientRect().right).toBeLessThanOrEqual(
      trigger.getBoundingClientRect().left,
    );
  });
});
