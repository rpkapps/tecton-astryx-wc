/**
 * The WAI-ARIA tabs pattern of `tct-tab-list` (`pattern="tabs"`, or `role="tablist"` on the element):
 * one tablist owning only tabs, `aria-selected`, `aria-controls` to the panel, no landmark, no
 * navigation, automatic and manual activation. Upstream: "TabList ARIA pattern — role=tablist".
 */
import {userEvent} from 'vitest/browser';
import {describe, expect, it, vi} from 'vitest';
import {axNode, expectAccessible} from '@tecton-wc/testing/a11y.js';
import {expectEventCounts, recordEvents} from '@tecton-wc/testing/events.js';
import {fixture} from '@tecton-wc/testing/fixture.js';
import {deepActiveElement, pressKeys, tabSequence} from '@tecton-wc/testing/keyboard.js';
import {nextFrame} from '@tecton-wc/testing/timing.js';
import {resetDevWarnings} from '@tecton-wc/core/utils/dev.js';
import './define.js';
import type {TctTab} from './tct-tab.js';
import type {TctTabList} from './tct-tab-list.js';

const TABS =
  '<tct-tab value="overview" label="Overview" panel-id="p-overview"></tct-tab>' +
  '<tct-tab value="activity" label="Activity" panel-id="p-activity"></tct-tab>' +
  '<tct-tab value="settings" label="Settings" panel-id="p-settings"></tct-tab>';

const PANELS =
  '<div id="p-overview" role="tabpanel" aria-labelledby="t-overview">Overview panel</div>' +
  '<div id="p-activity" role="tabpanel" aria-labelledby="t-activity" hidden>Activity panel</div>' +
  '<div id="p-settings" role="tabpanel" aria-labelledby="t-settings" hidden>Settings panel</div>';

async function tabsFixture(attributes = 'pattern="tabs" value="overview"'): Promise<TctTabList> {
  const wrapper = await fixture<HTMLDivElement>(
    `<div style="width: 480px"><button id="before">before</button>` +
      `<tct-tab-list ${attributes} aria-label="Sections">${TABS}</tct-tab-list>${PANELS}<button id="after">after</button></div>`,
  );
  const element = wrapper.querySelector('tct-tab-list')!;
  await element.updateComplete;
  await Promise.all([...element.children].map((child) => (child as TctTab).updateComplete));
  await nextFrame();
  await nextFrame();
  return element;
}

const tabs = (element: Element): TctTab[] => [...element.querySelectorAll('tct-tab')] as TctTab[];
const control = (element: Element, value: string): HTMLElement =>
  tabs(element).find((candidate) => candidate.value === value)!.control!;
const focusedValue = (element: Element): string =>
  tabs(element).find((candidate) => candidate.control === deepActiveElement())?.value ?? '';

describe('tct-tab-list: tabs pattern (upstream: TabList ARIA pattern, role="tablist")', () => {
  it('the element is the tablist and every tab is a tab; no navigation landmark', async () => {
    const element = await tabsFixture();
    expect(await axNode(element)).toMatchObject({role: 'tablist', name: 'Sections'});
    expect(element.shadowRoot!.querySelector('nav')).toBeNull();
    expect(element.matches(':state(tabs)')).toBe(true);
    for (const value of ['overview', 'activity', 'settings']) {
      expect(await axNode(control(element, value))).toMatchObject({role: 'tab'});
    }
  });

  it('does not mix navigation semantics into tabs: aria-selected, never aria-current', async () => {
    const element = await tabsFixture();
    const selected = control(element, 'overview');
    expect(selected.getAttribute('aria-selected')).toBe('true');
    expect(selected.hasAttribute('aria-current')).toBe(false);
    expect(control(element, 'activity').getAttribute('aria-selected')).toBe('false');
    expect(await axNode(selected)).toMatchObject({selected: 'true'});
  });

  it('role="tablist" on the element is the same as pattern="tabs"', async () => {
    const element = await tabsFixture('role="tablist" value="overview"');
    expect(await axNode(element)).toMatchObject({role: 'tablist'});
    expect(element.shadowRoot!.querySelector('nav')).toBeNull();
    expect(control(element, 'overview').getAttribute('role')).toBe('tab');
  });

  it('names the tablist from another element (aria-labelledby on the host)', async () => {
    const wrapper = await fixture<HTMLDivElement>(
      `<div><h2 id="heading">Project views</h2><tct-tab-list pattern="tabs" value="overview" aria-labelledby="heading">${TABS}</tct-tab-list></div>`,
    );
    const element = wrapper.querySelector('tct-tab-list')!;
    await element.updateComplete;
    expect(await axNode(element)).toMatchObject({role: 'tablist', name: 'Project views'});
  });

  it('falls back to the localized "Tabs" name', async () => {
    const wrapper = await fixture<HTMLDivElement>(
      `<div><tct-tab-list pattern="tabs" value="overview">${TABS}</tct-tab-list></div>`,
    );
    const element = wrapper.querySelector('tct-tab-list')!;
    await element.updateComplete;
    expect(await axNode(element)).toMatchObject({role: 'tablist', name: 'Tabs'});
  });

  it('points each tab at its panel with aria-controls', async () => {
    const element = await tabsFixture();
    const panel = document.getElementById('p-activity')!;
    const inner = control(element, 'activity');
    expect(inner.ariaControlsElements).toEqual([panel]);
    // Chromium exposes the relation for a panel that is rendered (the selected one).
    const selected = await axNode(control(element, 'overview'));
    expect(selected, 'the AX tree carries the controls relation').toHaveProperty('controls');
  });

  it('warns about a tab without a panel-id, and about anything else in the strip', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    globalThis.tctDevMode = true;
    resetDevWarnings();
    try {
      const wrapper = await fixture<HTMLDivElement>(
        `<div><tct-tab-list pattern="tabs" value="a"><tct-tab value="a" label="A"></tct-tab><button>stranger</button></tct-tab-list></div>`,
      );
      await wrapper.querySelector<TctTabList>('tct-tab-list')!.updateComplete;
      await nextFrame();
      await nextFrame();
      const messages = warn.mock.calls.map((call) => String(call[0]));
      expect(messages.some((message) => message.includes('panel-id'))).toBe(true);
      expect(messages.some((message) => message.includes('owns only tabs'))).toBe(true);
    } finally {
      globalThis.tctDevMode = undefined;
      warn.mockRestore();
    }
  });

  it('ignores href: the tab is a button, and the caller is told', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    globalThis.tctDevMode = true;
    resetDevWarnings();
    try {
      const wrapper = await fixture<HTMLDivElement>(
        `<div><tct-tab-list pattern="tabs" value="a"><tct-tab value="a" label="A" href="/x" panel-id="p"></tct-tab></tct-tab-list><div id="p" role="tabpanel"></div></div>`,
      );
      const element = wrapper.querySelector('tct-tab-list')!;
      await element.updateComplete;
      const inner = control(element, 'a');
      expect(inner.localName).toBe('button');
      expect(inner.hasAttribute('href')).toBe(false);
      expect(warn.mock.calls.some((call) => String(call[0]).includes('href is ignored'))).toBe(
        true,
      );
    } finally {
      globalThis.tctDevMode = undefined;
      warn.mockRestore();
    }
  });

  it('is one Tab stop; Tab leaves the strip for the panel area', async () => {
    const element = await tabsFixture();
    const sequence = await tabSequence(element, {start: document.getElementById('before')!});
    expect(sequence[0]).toBe(control(element, 'overview'));
    expect(sequence.at(1)?.id).toBe('after');
  });
});

describe('tct-tab-list: tabs pattern, automatic activation (default)', () => {
  it('arrow keys move focus and select together, wrapping', async () => {
    const element = await tabsFixture();
    const events = recordEvents(element, 'tct-value-change');
    control(element, 'overview').focus();
    await pressKeys('ArrowRight');
    expect(focusedValue(element)).toBe('activity');
    expect(element.value).toBe('activity');
    await pressKeys('End');
    expect(element.value).toBe('settings');
    await pressKeys('ArrowRight');
    expect(focusedValue(element)).toBe('overview');
    expect(element.value).toBe('overview');
    expect(events.events.length).toBe(3);
    expect(events.events.every((event) => event.reason === 'keyboard')).toBe(true);
  });

  it('leaves ArrowDown and ArrowUp to the page', async () => {
    const element = await tabsFixture();
    control(element, 'overview').focus();
    const event = new KeyboardEvent('keydown', {
      key: 'ArrowDown',
      bubbles: true,
      cancelable: true,
      composed: true,
    });
    control(element, 'overview').dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    expect(focusedValue(element)).toBe('overview');
  });

  it('a prevented tct-value-change keeps the selection while focus still moves', async () => {
    const element = await tabsFixture();
    element.addEventListener('tct-value-change', (event) => event.preventDefault());
    control(element, 'overview').focus();
    await pressKeys('ArrowRight');
    expect(focusedValue(element)).toBe('activity');
    expect(element.value).toBe('overview');
  });

  it('a controlled panel switch: the app shows the panel of the requested value', async () => {
    const element = await tabsFixture();
    const panels = [...document.querySelectorAll<HTMLElement>('[role="tabpanel"]')];
    element.addEventListener('tct-value-change', (event) => {
      for (const panel of panels) panel.hidden = panel.id !== `p-${event.value}`;
    });
    await userEvent.click(control(element, 'settings'));
    expect(panels.map((panel) => panel.hidden)).toEqual([true, true, false]);
    expect(control(element, 'settings').getAttribute('aria-selected')).toBe('true');
  });
});

describe('tct-tab-list: tabs pattern, manual activation', () => {
  it('arrow keys move focus only; Enter and Space select', async () => {
    const element = await tabsFixture('pattern="tabs" activation="manual" value="overview"');
    const events = recordEvents(element, 'tct-value-change');
    control(element, 'overview').focus();
    await pressKeys('ArrowRight');
    expect(focusedValue(element)).toBe('activity');
    expect(element.value).toBe('overview');
    expectEventCounts(events, {'tct-value-change': 0});
    await pressKeys('Enter');
    expect(element.value).toBe('activity');
    await pressKeys('ArrowRight', ' ');
    expect(element.value).toBe('settings');
    expect(events.events.map((event) => event.reason)).toEqual(['keyboard', 'keyboard']);
  });

  it('Home and End move focus without selecting', async () => {
    const element = await tabsFixture('pattern="tabs" activation="manual" value="overview"');
    control(element, 'overview').focus();
    await pressKeys('End');
    expect(focusedValue(element)).toBe('settings');
    expect(element.value).toBe('overview');
  });

  it('the roving stop follows focus, and returns to the selected tab when focus leaves', async () => {
    const element = await tabsFixture('pattern="tabs" activation="manual" value="overview"');
    control(element, 'overview').focus();
    await pressKeys('ArrowRight');
    expect(control(element, 'activity').getAttribute('tabindex')).toBe('0');
    await pressKeys('Tab');
    expect(document.activeElement?.id).toBe('after');
  });
});

describe('tct-tab-list: tabs pattern accessibility', () => {
  it('has no axe violations, with a selected panel', async () => {
    const element = await tabsFixture();
    await expectAccessible(element.parentElement!);
  });
});
