/**
 * Text contrast in every interactive state of a tab: rest, hover, keyboard focus, pressed, selected and
 * selected while hovered, light and dark, in both patterns. Each state pairs its fill with its own text
 * role, so a resting-state axe run proves nothing about the others. The pointer and keyboard put the tab
 * into the state explicitly, and axe runs only after the state's CSS transition has finished.
 */
import {cdp, userEvent} from 'vitest/browser';
import {afterEach, describe, it} from 'vitest';
import {expectAccessible} from '@tecton-wc/testing/a11y.js';
import {fixture} from '@tecton-wc/testing/fixture.js';
import {pressKeys} from '@tecton-wc/testing/keyboard.js';
import {nextFrame} from '@tecton-wc/testing/timing.js';
import './define.js';
import type {TctTab} from './tct-tab.js';
import type {TctTabList} from './tct-tab-list.js';

const contrastOnly = {runOnly: {type: 'rule' as const, values: ['color-contrast']}};

async function settledStrip(list: TctTabList): Promise<void> {
  await nextFrame();
  const tabs = [...list.querySelectorAll('tct-tab')] as TctTab[];
  const animations = tabs.flatMap((tab) => tab.control!.getAnimations({subtree: true}));
  await Promise.all(animations.map((animation) => animation.finished));
}

const center = (element: Element): {x: number; y: number} => {
  const box = element.getBoundingClientRect();
  return {x: box.left + box.width / 2, y: box.top + box.height / 2};
};

afterEach(async () => {
  await cdp()
    .send('Input.dispatchMouseEvent', {type: 'mouseReleased', x: 0, y: 0, button: 'left', clickCount: 1})
    .catch(() => undefined);
  await userEvent.hover(document.body, {position: {x: 0, y: 0}}).catch(() => undefined);
});

async function mount(theme: 'light' | 'dark', pattern: 'nav' | 'tabs'): Promise<HTMLElement> {
  const panelIds = pattern === 'tabs';
  const wrapper = await fixture<HTMLElement>(
    `<div style="background: var(--color-background-body); padding: 16px; width: 480px"><button>before</button>` +
      `<tct-tab-list value="activity" pattern="${pattern}" aria-label="Sections">` +
      `<tct-tab value="overview" label="Overview" ${panelIds ? 'panel-id="p1"' : ''}></tct-tab>` +
      `<tct-tab value="activity" label="Activity" ${panelIds ? 'panel-id="p2"' : ''}></tct-tab>` +
      `<tct-tab value="settings" label="Settings" ${panelIds ? 'panel-id="p3"' : ''}></tct-tab>` +
      `<tct-tab value="locked" label="Locked" disabled></tct-tab></tct-tab-list>` +
      `<div id="p1" role="tabpanel"></div><div id="p2" role="tabpanel"></div><div id="p3" role="tabpanel"></div></div>`,
    {theme},
  );
  const list = wrapper.querySelector('tct-tab-list')!;
  await list.updateComplete;
  await Promise.all([...list.children].map((child) => (child as TctTab).updateComplete));
  await nextFrame();
  return wrapper;
}

describe('tct-tab: text contrast in every state', () => {
  for (const theme of ['light', 'dark'] as const) {
    for (const pattern of ['nav', 'tabs'] as const) {
      const where = `${pattern}, ${theme}`;
      const tabOf = (wrapper: HTMLElement, value: string): TctTab =>
        wrapper.querySelector<TctTab>(`tct-tab[value="${value}"]`)!;

      it(`rest, selected and disabled (${where})`, async () => {
        const wrapper = await mount(theme, pattern);
        await settledStrip(wrapper.querySelector('tct-tab-list')!);
        await expectAccessible(wrapper, contrastOnly);
      });

      it(`hover on an unselected tab (${where})`, async () => {
        const wrapper = await mount(theme, pattern);
        await userEvent.hover(tabOf(wrapper, 'overview').control!);
        await settledStrip(wrapper.querySelector('tct-tab-list')!);
        await expectAccessible(wrapper, contrastOnly);
      });

      it(`hover on the selected tab (${where})`, async () => {
        const wrapper = await mount(theme, pattern);
        await userEvent.hover(tabOf(wrapper, 'activity').control!);
        await settledStrip(wrapper.querySelector('tct-tab-list')!);
        await expectAccessible(wrapper, contrastOnly);
      });

      it(`keyboard focus on an unselected tab (${where})`, async () => {
        const wrapper = await mount(theme, pattern);
        wrapper.querySelector('button')!.focus();
        await pressKeys('Tab');
        // Tab enters at the selected tab; arrow to an unselected one (manual keeps selection in place).
        await pressKeys('ArrowLeft');
        await settledStrip(wrapper.querySelector('tct-tab-list')!);
        await expectAccessible(wrapper, contrastOnly);
      });

      it(`keyboard focus on the selected tab (${where})`, async () => {
        const wrapper = await mount(theme, pattern);
        wrapper.querySelector('button')!.focus();
        await pressKeys('Tab');
        await settledStrip(wrapper.querySelector('tct-tab-list')!);
        await expectAccessible(wrapper, contrastOnly);
      });

      it(`pressed (${where})`, async () => {
        const wrapper = await mount(theme, pattern);
        const point = center(tabOf(wrapper, 'settings').control!);
        const session = cdp();
        await session.send('Input.dispatchMouseEvent', {type: 'mouseMoved', ...point});
        await session.send('Input.dispatchMouseEvent', {
          type: 'mousePressed',
          ...point,
          button: 'left',
          clickCount: 1,
        });
        await settledStrip(wrapper.querySelector('tct-tab-list')!);
        try {
          await expectAccessible(wrapper, contrastOnly);
        } finally {
          await session.send('Input.dispatchMouseEvent', {
            type: 'mouseReleased',
            ...point,
            button: 'left',
            clickCount: 1,
          });
        }
      });
    }
  }
});
