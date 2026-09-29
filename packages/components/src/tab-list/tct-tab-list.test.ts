/**
 * `tct-tab-list`, `tct-tab`: the navigation pattern (a `<nav>` of buttons and links with
 * `aria-current`), the WAI-ARIA tabs pattern with panels (automatic and manual activation), the roving
 * tab stop, overflow scrolling, edge compensation, RTL, forced colours and contrast in every state.
 * Test names follow upstream `TabList.test.tsx`.
 */
import {html} from 'lit';
import {userEvent} from 'vitest/browser';
import {describe, expect, it} from 'vitest';
import {axNode} from '@tecton-wc/testing/a11y.js';
import {expectEventCounts, recordEvents} from '@tecton-wc/testing/events.js';
import {fixture} from '@tecton-wc/testing/fixture.js';
import {deepActiveElement, pressKeys, tabSequence} from '@tecton-wc/testing/keyboard.js';
import {runElementSuite} from '@tecton-wc/testing/suites/element.js';
import {nextFrame} from '@tecton-wc/testing/timing.js';
import './define.js';
import type {TctTab} from './tct-tab.js';
import type {TctTabList} from './tct-tab-list.js';

const TABS =
  '<tct-tab value="overview" label="Overview"></tct-tab>' +
  '<tct-tab value="activity" label="Activity"></tct-tab>' +
  '<tct-tab value="settings" label="Settings"></tct-tab>';

async function tabList(
  attributes = 'value="overview"',
  inner = TABS,
  wrapperStyle = 'width: 480px',
): Promise<TctTabList> {
  const wrapper = await fixture<HTMLDivElement>(
    `<div style="${wrapperStyle}"><button id="before">before</button>` +
      `<tct-tab-list ${attributes}>${inner}</tct-tab-list><button id="after">after</button></div>`,
  );
  const element = wrapper.querySelector('tct-tab-list')!;
  await element.updateComplete;
  await settleTabs(element);
  return element;
}

/** Tabs render after the strip does, then the tab stop is placed: wait for both. */
async function settleTabs(element: TctTabList): Promise<void> {
  await Promise.all([...element.children].map((child) => (child as TctTab).updateComplete));
  await nextFrame();
  await nextFrame();
}

const tabs = (element: Element): TctTab[] =>
  [...element.children].filter((child) => child.localName === 'tct-tab') as TctTab[];
const tab = (element: Element, value: string): TctTab =>
  tabs(element).find((candidate) => candidate.value === value)!;
const control = (element: Element, value: string): HTMLElement => tab(element, value).control!;
const focusedValue = (): string => {
  const active = deepActiveElement();
  const host = ([...document.querySelectorAll('tct-tab')] as TctTab[]).find(
    (candidate) => candidate.control === active,
  );
  return host?.value ?? '';
};
const tabindexes = (element: Element): (string | null)[] =>
  tabs(element).map((candidate) => candidate.control!.getAttribute('tabindex'));

// -------------------------------------------------------------------------------- element suite

runElementSuite({
  tag: 'tct-tab-list',
  render: () =>
    html`<tct-tab-list value="a"
      ><tct-tab value="a" label="A"></tct-tab><tct-tab value="b" label="B"></tct-tab
    ></tct-tab-list>`,
  properties: {
    size: 'lg',
    layout: 'fill',
    hasDivider: true,
    pattern: 'tabs',
    overflow: 'visible',
    activation: 'manual',
    value: 'b',
  },
  attributes: {
    size: 'size',
    layout: 'layout',
    pattern: 'pattern',
    overflow: 'overflow',
    activation: 'activation',
  },
  events: ['tct-value-change'],
  skip: ['a11y'],
});

runElementSuite({
  tag: 'tct-tab',
  render: () =>
    html`<tct-tab-list value="a"
      ><tct-tab id="under-test" value="a" label="A"></tct-tab
    ></tct-tab-list>`,
  properties: {value: 'b', label: 'B', labelHidden: true, disabled: true, href: '/x', panelId: 'p'},
  attributes: {value: 'value', label: 'label'},
  skip: ['a11y', 'hostBox'],
});

// ------------------------------------------------------------------------ navigation pattern

describe('tct-tab-list: navigation pattern (upstream: renders a nav element with tab buttons)', () => {
  it('renders a navigation landmark named "Tabs" with a button per tab', async () => {
    const element = await tabList();
    const nav = element.shadowRoot!.querySelector('nav')!;
    expect(await axNode(nav)).toMatchObject({role: 'navigation', name: 'Tabs'});
    for (const candidate of tabs(element)) {
      expect(candidate.control!.localName).toBe('button');
      expect(await axNode(candidate.control!)).toMatchObject({role: 'button'});
    }
  });

  it('does not set aria-orientation on the nav (invalid for role navigation)', async () => {
    const element = await tabList();
    expect(element.shadowRoot!.querySelector('nav')!.hasAttribute('aria-orientation')).toBe(false);
  });

  it('ignores a consumer-supplied aria-orientation on the nav', async () => {
    const element = await tabList('value="overview" aria-orientation="vertical"');
    expect(element.shadowRoot!.querySelector('nav')!.hasAttribute('aria-orientation')).toBe(false);
  });

  it('marks the selected tab with a generic aria-current, not "page"', async () => {
    const element = await tabList();
    expect(control(element, 'overview').getAttribute('aria-current')).toBe('true');
    expect(control(element, 'activity').hasAttribute('aria-current')).toBe(false);
    expect(tab(element, 'overview').matches(':state(selected)')).toBe(true);
  });

  it('marks a selected link tab with the same generic aria-current', async () => {
    const element = await tabList(
      'value="a"',
      '<tct-tab value="a" label="A" href="#a"></tct-tab><tct-tab value="b" label="B" href="#b"></tct-tab>',
    );
    const link = control(element, 'a');
    expect(link.localName).toBe('a');
    expect(link.getAttribute('href')).toBe('#a');
    expect(link.getAttribute('aria-current')).toBe('true');
    expect(await axNode(link)).toMatchObject({role: 'link', name: 'A'});
  });

  it('updates aria-current when value changes', async () => {
    const element = await tabList();
    element.value = 'settings';
    await element.updateComplete;
    await settleTabs(element);
    expect(control(element, 'overview').hasAttribute('aria-current')).toBe(false);
    expect(control(element, 'settings').getAttribute('aria-current')).toBe('true');
  });

  it('the value attribute is the initial selection and the property is the current one', async () => {
    const element = await tabList('value="activity"');
    expect(element.value).toBe('activity');
    expect(control(element, 'activity').getAttribute('aria-current')).toBe('true');
  });

  it('follows an aria-label on the host', async () => {
    const element = await tabList('value="overview" aria-label="Project sections"');
    expect(await axNode(element.shadowRoot!.querySelector('nav')!)).toMatchObject({
      role: 'navigation',
      name: 'Project sections',
    });
  });
});

describe('tct-tab-list: selecting', () => {
  it('fires a cancelable tct-value-change and selects when a tab is clicked', async () => {
    const element = await tabList();
    const events = recordEvents(element, ['tct-value-change', 'change', 'input']);
    await userEvent.click(control(element, 'activity'));
    expect(events.named('tct-value-change')).toHaveLength(1);
    const event = events.named('tct-value-change')[0]!;
    expect(event).toMatchObject({value: 'activity', oldValue: 'overview', reason: 'pointer'});
    expect(event.bubbles && event.composed && event.cancelable).toBe(true);
    expectEventCounts(events, {'tct-value-change': 1});
    expect(element.value).toBe('activity');
    expect(control(element, 'activity').getAttribute('aria-current')).toBe('true');
  });

  it('keeps the value when tct-value-change is prevented (controlled use)', async () => {
    const element = await tabList();
    element.addEventListener('tct-value-change', (event) => event.preventDefault());
    await userEvent.click(control(element, 'activity'));
    expect(element.value).toBe('overview');
    expect(control(element, 'overview').getAttribute('aria-current')).toBe('true');
  });

  it('a controlled framework binding sets the property back from the event', async () => {
    const element = await tabList();
    element.addEventListener('tct-value-change', (event) => {
      event.preventDefault();
      element.value = event.value;
    });
    await userEvent.click(control(element, 'settings'));
    expect(element.value).toBe('settings');
  });

  it('does not fire events for the tab that is already selected', async () => {
    const element = await tabList();
    const events = recordEvents(element, 'tct-value-change');
    await userEvent.click(control(element, 'overview'));
    expect(events.events).toHaveLength(0);
  });

  it('does not fire events on property or attribute writes', async () => {
    const element = await tabList();
    const events = recordEvents(element, ['tct-value-change', 'input', 'change']);
    element.value = 'activity';
    element.setAttribute('value', 'settings');
    element.pattern = 'tabs';
    await element.updateComplete;
    expectEventCounts(events, {});
  });

  it('does not activate a disabled button tab or fire its handlers', async () => {
    const element = await tabList(
      'value="overview"',
      '<tct-tab value="overview" label="Overview"></tct-tab><tct-tab value="locked" label="Locked" disabled></tct-tab>',
    );
    const events = recordEvents(element, ['tct-value-change', 'click']);
    await userEvent.click(control(element, 'locked'), {force: true});
    expect(events.named('tct-value-change')).toHaveLength(0);
    expect(events.named('click')).toHaveLength(0);
    expect(element.value).toBe('overview');
    expect(control(element, 'locked').getAttribute('aria-disabled')).toBe('true');
  });

  it('removes navigation from a disabled link tab', async () => {
    const element = await tabList(
      'value="a"',
      '<tct-tab value="a" label="A" href="#a"></tct-tab><tct-tab value="b" label="B" href="#b" disabled></tct-tab>',
    );
    expect(control(element, 'b').hasAttribute('href')).toBe(false);
    expect(control(element, 'b').getAttribute('aria-disabled')).toBe('true');
  });

  it('renders an icon-only tab named by its label', async () => {
    const element = await tabList(
      'value="a"',
      '<tct-tab value="a" label="Home" label-hidden><tct-icon slot="icon" name="check"></tct-icon></tct-tab>',
    );
    const inner = control(element, 'a');
    expect(await axNode(inner)).toMatchObject({role: 'button', name: 'Home'});
    expect(inner.querySelector('.label-box')).toBeNull();
  });

  it('shows selected-icon while selected and icon otherwise; renders end content after the label', async () => {
    const element = await tabList(
      'value="a"',
      `<tct-tab value="a" label="A"><tct-icon slot="icon" name="close"></tct-icon><tct-icon slot="selected-icon" name="check"></tct-icon><span slot="end">3</span></tct-tab>
       <tct-tab value="b" label="B"><tct-icon slot="icon" name="close"></tct-icon><tct-icon slot="selected-icon" name="check"></tct-icon></tct-tab>`,
    );
    const slotName = (value: string): string | null =>
      tab(element, value).shadowRoot!.querySelector('.icon-slot slot')?.getAttribute('name') ??
      null;
    expect(slotName('a')).toBe('selected-icon');
    expect(slotName('b')).toBe('icon');
    expect(tab(element, 'a').shadowRoot!.querySelector('.end slot')).not.toBeNull();
    expect(tab(element, 'b').shadowRoot!.querySelector('.end')).toBeNull();
  });

  it('renders different sizes', async () => {
    const heights: number[] = [];
    for (const size of ['sm', 'md', 'lg']) {
      const element = await tabList(`value="overview" size="${size}"`);
      heights.push(control(element, 'overview').getBoundingClientRect().height);
    }
    expect(heights[0]).toBeLessThan(heights[1]!);
    expect(heights[1]).toBeLessThan(heights[2]!);
  });

  it('layout="fill" stretches the tabs across the strip', async () => {
    const hug = await tabList('value="overview"');
    const hugWidth = tab(hug, 'overview').getBoundingClientRect().width;
    const fill = await tabList('value="overview" layout="fill"');
    const stripWidth = fill.shadowRoot!.querySelector('.strip')!.getBoundingClientRect().width;
    const widths = tabs(fill).map((candidate) => candidate.getBoundingClientRect().width);
    expect(widths[0]).toBeGreaterThan(hugWidth);
    expect(widths.reduce((sum, w) => sum + w, 0)).toBeGreaterThan(stripWidth * 0.9);
  });
});

// ----------------------------------------------------------------------------- roving keyboard

describe('tct-tab-list: keyboard navigation (roving tabindex)', () => {
  it('exposes the strip as a single Tab stop (only the selected tab is tabbable)', async () => {
    const element = await tabList('value="activity"');
    expect(tabindexes(element)).toEqual(['-1', '0', '-1']);
    const sequence = await tabSequence(element, {start: document.getElementById('before')!});
    expect(sequence.map((el) => el.id || (el as HTMLElement).getAttribute('part'))).toEqual([
      'tab',
      'after',
    ]);
  });

  it('makes the first tab tabbable when the selected value matches no tab', async () => {
    const element = await tabList('value="nope"');
    expect(tabindexes(element)).toEqual(['0', '-1', '-1']);
  });

  it('moves focus with ArrowRight and ArrowLeft without selecting', async () => {
    const element = await tabList();
    control(element, 'overview').focus();
    await pressKeys('ArrowRight');
    expect(focusedValue()).toBe('activity');
    expect(element.value).toBe('overview');
    await pressKeys('ArrowLeft');
    expect(focusedValue()).toBe('overview');
    expect(tabindexes(element)).toEqual(['0', '-1', '-1']);
  });

  it('supports ArrowDown and ArrowUp as forward and backward too (navigation pattern)', async () => {
    const element = await tabList();
    control(element, 'overview').focus();
    await pressKeys('ArrowDown');
    expect(focusedValue()).toBe('activity');
    await pressKeys('ArrowUp');
    expect(focusedValue()).toBe('overview');
  });

  it('jumps to the first and last tab with Home and End, and wraps at the ends', async () => {
    const element = await tabList();
    control(element, 'activity').focus();
    await pressKeys('End');
    expect(focusedValue()).toBe('settings');
    await pressKeys('ArrowRight');
    expect(focusedValue()).toBe('overview');
    await pressKeys('ArrowLeft');
    expect(focusedValue()).toBe('settings');
    await pressKeys('Home');
    expect(focusedValue()).toBe('overview');
  });

  it('skips disabled tabs during arrow navigation', async () => {
    const element = await tabList(
      'value="overview"',
      '<tct-tab value="overview" label="A"></tct-tab><tct-tab value="mid" label="B" disabled></tct-tab><tct-tab value="last" label="C"></tct-tab>',
    );
    control(element, 'overview').focus();
    await pressKeys('ArrowRight');
    expect(focusedValue()).toBe('last');
  });

  it('selects the focused tab with Enter and Space', async () => {
    const element = await tabList();
    const events = recordEvents(element, 'tct-value-change');
    control(element, 'overview').focus();
    await pressKeys('ArrowRight', 'Enter');
    expect(element.value).toBe('activity');
    expect(events.named('tct-value-change')[0]).toMatchObject({reason: 'keyboard'});
    await pressKeys('ArrowRight', ' ');
    expect(element.value).toBe('settings');
  });

  it('does not intercept unrelated keys', async () => {
    const element = await tabList();
    control(element, 'overview').focus();
    await pressKeys('a', 'Escape');
    expect(focusedValue()).toBe('overview');
  });

  it('respects preventDefault from a consumer keydown listener on the strip in the capture phase', async () => {
    const element = await tabList();
    element.addEventListener('keydown', (event) => event.preventDefault(), {capture: true});
    control(element, 'overview').focus();
    await pressKeys('ArrowRight');
    expect(focusedValue()).toBe('overview');
  });

  it('mirrors the arrow keys in right-to-left', async () => {
    const wrapper = await fixture<HTMLElement>(
      `<div dir="rtl" style="width: 480px"><tct-tab-list value="overview">${TABS}</tct-tab-list></div>`,
    );
    const element = wrapper.querySelector('tct-tab-list')!;
    await settleTabs(element);
    control(element, 'overview').focus();
    await pressKeys('ArrowLeft');
    expect(focusedValue()).toBe('activity');
    await pressKeys('ArrowRight');
    expect(focusedValue()).toBe('overview');
  });

  it('a click on a tab makes it the tab stop', async () => {
    const element = await tabList();
    element.addEventListener('tct-value-change', (event) => event.preventDefault());
    await userEvent.click(control(element, 'settings'));
    expect(tabindexes(element)).toEqual(['-1', '-1', '0']);
  });
});
