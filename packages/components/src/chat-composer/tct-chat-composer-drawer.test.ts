/// <reference types="@vitest/browser-playwright" />
import {describe, expect, it} from 'vitest';
import {userEvent} from 'vitest/browser';
import {axNode, expectAccessible} from '@tecton-wc/testing/a11y.js';
import {emulateMedia} from '@tecton-wc/testing/emulate.js';
import {expectEventCounts, expectEventFlags, recordEvents} from '@tecton-wc/testing/events.js';
import {fixture} from '@tecton-wc/testing/fixture.js';
import {deepActiveElement, pressKeys, tabSequence} from '@tecton-wc/testing/keyboard.js';
import {runElementSuite} from '@tecton-wc/testing/suites/element.js';
import {isChromium} from '@tecton-wc/testing/tier.js';
import {waitUntil} from '@tecton-wc/testing/timing.js';
import '../badge/define.js';
import './define.js';
import type {TctChatComposerDrawer} from './tct-chat-composer-drawer.js';

const toggleOf = (drawer: Element): HTMLButtonElement =>
  drawer.shadowRoot!.querySelector<HTMLButtonElement>('.toggle')!;
const gridOf = (drawer: Element): HTMLElement => drawer.shadowRoot!.querySelector<HTMLElement>('.grid')!;

async function make(attributes = '', content = '<button type="button">one.png</button><button type="button">two.png</button>'): Promise<TctChatComposerDrawer> {
  const root = await fixture<HTMLElement>(
    `<div style="inline-size: 420px"><tct-chat-composer-drawer ${attributes}>${content}</tct-chat-composer-drawer></div>`,
  );
  return root.querySelector<TctChatComposerDrawer>('tct-chat-composer-drawer')!;
}

/** The disclosure's height change is an animation of the grid track: wait for it, then measure. */
async function transitioned(drawer: Element): Promise<void> {
  await Promise.all(
    [...drawer.shadowRoot!.querySelectorAll('*')]
      .flatMap((element) => element.getAnimations())
      .map((animation) => animation.finished),
  );
}

runElementSuite({
  tag: 'tct-chat-composer-drawer',
  properties: {count: 3, label: 'Attachments', collapsed: true},
  attributes: {count: 'count', label: 'label', collapsed: 'collapsed'},
  events: ['tct-collapse-change'],
});

describe('tct-chat-composer-drawer: without a count', () => {
  it('is a plain container: no toggle, the content always shown', async () => {
    const drawer = await make();
    expect(toggleOf(drawer)).toBeNull();
    expect(gridOf(drawer).hasAttribute('inert')).toBe(false);
    // `collapsed` has nothing to collapse without a count.
    drawer.collapsed = true;
    await drawer.updateComplete;
    expect(gridOf(drawer).hasAttribute('inert')).toBe(false);
    expect(drawer.getBoundingClientRect().height).toBeGreaterThan(0);
    await expectAccessible(drawer);
  });
});

describe('tct-chat-composer-drawer: the toggle', () => {
  it('is a real button naming the action, with aria-expanded and aria-controls', async () => {
    const drawer = await make('count="2" label="Attachments"');
    const toggle = toggleOf(drawer);
    expect(toggle.tagName).toBe('BUTTON');
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(toggle.getAttribute('aria-label')).toBe('Collapse Attachments');
    expect(toggle.getAttribute('aria-controls')).toBe(gridOf(drawer).id);
    if (isChromium) {
      expect(await axNode(toggle)).toMatchObject({role: 'button', name: 'Collapse Attachments', expanded: 'true'});
    }
    drawer.collapsed = true;
    await drawer.updateComplete;
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(toggle.getAttribute('aria-label')).toBe('Expand Attachments');
  });

  it('defaults the label to "Items"', async () => {
    const drawer = await make('count="1"');
    expect(toggleOf(drawer).getAttribute('aria-label')).toBe('Collapse Items');
  });

  it('collapses and expands on click, asking first with a cancelable event', async () => {
    const drawer = await make('count="2"');
    const events = recordEvents(drawer, ['tct-collapse-change']);
    await userEvent.click(toggleOf(drawer));
    expect(drawer.collapsed).toBe(true);
    expect(drawer.hasAttribute('collapsed')).toBe(true);
    expectEventCounts(events, {'tct-collapse-change': 1});
    const event = events.events[0]!;
    expectEventFlags(event, {bubbles: true, composed: true, cancelable: true});
    expect(event).toMatchObject({collapsed: true, reason: 'pointer'});
    await userEvent.click(toggleOf(drawer));
    expect(drawer.collapsed).toBe(false);
    expect(events.events[1]).toMatchObject({collapsed: false, reason: 'pointer'});
  });

  it('operates with Enter and Space and reports the keyboard as the reason', async () => {
    const drawer = await make('count="2"');
    const events = recordEvents(drawer, ['tct-collapse-change']);
    toggleOf(drawer).focus();
    await pressKeys('Enter');
    expect(drawer.collapsed).toBe(true);
    await pressKeys(' ');
    expect(drawer.collapsed).toBe(false);
    expect(events.events.map((event) => (event as unknown as {reason: string}).reason)).toEqual(['keyboard', 'keyboard']);
  });

  it('preventDefault keeps the state, so a page can own it', async () => {
    const drawer = await make('count="2"');
    drawer.addEventListener('tct-collapse-change', (event) => event.preventDefault());
    await userEvent.click(toggleOf(drawer));
    expect(drawer.collapsed).toBe(false);
  });

  it('property and attribute writes never fire the event', async () => {
    const drawer = await make('count="2"');
    const events = recordEvents(drawer, ['tct-collapse-change', 'input', 'change']);
    drawer.collapsed = true;
    drawer.count = 5;
    drawer.label = 'Files';
    drawer.setAttribute('collapsed', '');
    await drawer.updateComplete;
    expectEventCounts(events, {});
  });

  it('shows a visible keyboard focus ring on the toggle', async () => {
    const root = await fixture<HTMLElement>(
      `<div><button type="button">before</button><tct-chat-composer-drawer count="1"><span>x</span></tct-chat-composer-drawer></div>`,
    );
    root.querySelector('button')!.focus();
    await pressKeys('Tab');
    const toggle = toggleOf(root.querySelector('tct-chat-composer-drawer')!);
    expect(toggle.matches(':focus-visible')).toBe(true);
    expect(getComputedStyle(toggle).outlineStyle).not.toBe('none');
  });
});

describe('tct-chat-composer-drawer: the collapsed state', () => {
  it('removes the content from the tab order and the accessibility tree until it expands', async () => {
    const root = await fixture<HTMLElement>(
      `<div><tct-chat-composer-drawer count="2" label="Files"><button type="button" id="a">a</button></tct-chat-composer-drawer><button type="button" id="after">after</button></div>`,
    );
    const drawer = root.querySelector<TctChatComposerDrawer>('tct-chat-composer-drawer')!;
    const inTabs = async (): Promise<string[]> => {
      toggleOf(drawer).focus();
      const order = await tabSequence(root, {max: 3});
      return order.map((element) => (element as HTMLElement).id).filter(Boolean);
    };
    expect(await inTabs()).toContain('a');
    drawer.collapsed = true;
    await drawer.updateComplete;
    expect(gridOf(drawer).hasAttribute('inert')).toBe(true);
    expect(await inTabs()).not.toContain('a');
    if (isChromium) expect((await axNode(root.querySelector('#a')!)).ignored).toBe('true');
  });

  it('shows the count badge and the label in place of the content, and hides the handle', async () => {
    const drawer = await make('count="4" label="Attachments" collapsed');
    await transitioned(drawer);
    const summary = drawer.shadowRoot!.querySelector<HTMLElement>('.summary')!;
    expect(summary.querySelector('tct-badge')!.getAttribute('label')).toBe('4');
    expect(summary.textContent).toContain('Attachments');
    expect(summary.getAttribute('aria-hidden')).toBe('true');
    expect(getComputedStyle(summary).opacity).toBe('1');
    expect(getComputedStyle(drawer.shadowRoot!.querySelector('.handle')!).opacity).toBe('0');
    drawer.collapsed = false;
    await drawer.updateComplete;
    await transitioned(drawer);
    expect(getComputedStyle(summary).opacity).toBe('0');
    expect(getComputedStyle(drawer.shadowRoot!.querySelector('.handle')!).opacity).toBe('1');
  });

  it('takes a custom collapsed summary through the collapsed-summary slot', async () => {
    const drawer = await make(
      'count="2" collapsed',
      '<span slot="collapsed-summary" id="mine">2 files ready</span><span>content</span>',
    );
    const slot = drawer.shadowRoot!.querySelector<HTMLSlotElement>('slot[name="collapsed-summary"]')!;
    expect(slot.assignedElements()[0]!.id).toBe('mine');
    expect(drawer.shadowRoot!.querySelector('tct-badge')).toBeNull();
  });

  it('collapses the height (the content takes no room) and restores it', async () => {
    const drawer = await make('count="2"');
    await transitioned(drawer);
    const open = drawer.getBoundingClientRect().height;
    drawer.collapsed = true;
    await drawer.updateComplete;
    await waitUntil(() => drawer.getBoundingClientRect().height < open, 'the drawer shrinks');
    await transitioned(drawer);
    const closed = drawer.getBoundingClientRect().height;
    expect(closed).toBeLessThan(open);
    drawer.collapsed = false;
    await drawer.updateComplete;
    await transitioned(drawer);
    expect(drawer.getBoundingClientRect().height).toBe(open);
  });

  it('under reduced motion the content still swaps, without animating the height', async () => {
    const restore = await emulateMedia({reducedMotion: 'reduce'});
    try {
      const drawer = await make('count="2"');
      const grid = gridOf(drawer);
      expect(getComputedStyle(grid).transitionProperty).not.toContain('grid-template-rows');
      drawer.collapsed = true;
      await drawer.updateComplete;
      expect(getComputedStyle(grid).gridTemplateRows).toBe('0px');
    } finally {
      await restore();
    }
  });

  it('exposes the collapsed custom state', async () => {
    const drawer = await make('count="2" collapsed');
    if (drawer.matches(':state(collapsed)') !== undefined) {
      expect(drawer.matches(':state(collapsed)')).toBe(true);
      drawer.collapsed = false;
      await drawer.updateComplete;
      expect(drawer.matches(':state(collapsed)')).toBe(false);
    }
  });
});

describe('tct-chat-composer-drawer: accessibility and text contrast', () => {
  const contrast = {runOnly: {type: 'rule' as const, values: ['color-contrast']}};
  for (const theme of ['light', 'dark'] as const) {
    for (const collapsed of [false, true]) {
      it(`passes axe ${collapsed ? 'collapsed' : 'expanded'}, resting, hovered and keyboard-focused (${theme})`, async () => {
        const root = await fixture<HTMLElement>(
          `<div style="inline-size: 420px"><button type="button">before</button><tct-chat-composer-drawer count="3" label="Attachments" ${collapsed ? 'collapsed' : ''}><span>one.png</span><span>two.png</span></tct-chat-composer-drawer></div>`,
          {theme},
        );
        const drawer = root.querySelector<TctChatComposerDrawer>('tct-chat-composer-drawer')!;
        await transitioned(drawer);
        await expectAccessible(root);
        await userEvent.hover(toggleOf(drawer));
        await transitioned(drawer);
        await expectAccessible(root, contrast);
        await userEvent.hover(document.body, {position: {x: 0, y: 0}});
        root.querySelector('button')!.focus();
        await pressKeys('Tab');
        expect(deepActiveElement()).toBe(toggleOf(drawer));
        await transitioned(drawer);
        await expectAccessible(root, contrast);
      });
    }
  }

  it('keeps an edge in forced colours', async () => {
    if (!isChromium) return;
    const restore = await emulateMedia({forcedColors: 'active'});
    try {
      const drawer = await make('count="1"');
      expect(getComputedStyle(drawer.shadowRoot!.querySelector('.base')!).borderTopStyle).toBe('solid');
    } finally {
      await restore();
    }
  });

  it('names the toggle in German and mirrors in right-to-left', async () => {
    const german = await fixture<HTMLElement>(
      `<div lang="de-DE"><tct-chat-composer-drawer count="1" label="Anhänge"><span>x</span></tct-chat-composer-drawer></div>`,
    );
    const drawer = german.querySelector<TctChatComposerDrawer>('tct-chat-composer-drawer')!;
    await waitUntil(() => !toggleOf(drawer).getAttribute('aria-label')!.startsWith('Collapse'), 'German loads');
    expect(toggleOf(drawer).getAttribute('aria-label')).toContain('Anhänge');
    const rtl = await fixture<HTMLElement>(
      `<div dir="rtl" style="inline-size: 420px"><tct-chat-composer-drawer count="2" label="x" collapsed><span>x</span></tct-chat-composer-drawer></div>`,
    );
    const mirrored = rtl.querySelector<TctChatComposerDrawer>('tct-chat-composer-drawer')!;
    await transitioned(mirrored);
    const summary = mirrored.shadowRoot!.querySelector('.summary')!.getBoundingClientRect();
    const box = mirrored.getBoundingClientRect();
    // The summary starts at the inline start: the right edge in RTL.
    expect(box.right - summary.right).toBeLessThan(summary.left - box.left);
  });
});
