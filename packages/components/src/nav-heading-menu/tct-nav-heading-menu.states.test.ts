/**
 * Text contrast of a nav heading menu row in every state, on the popover surface a heading paints: rest,
 * hover, keyboard focus and pressed, with and without a description, light and dark. Axe runs only after
 * the state's transition has finished.
 */
import {cdp, userEvent} from 'vitest/browser';
import {afterEach, describe, it} from 'vitest';
import {expectAccessible} from '@tecton-wc/testing/a11y.js';
import {fixture} from '@tecton-wc/testing/fixture.js';
import {pressKeys} from '@tecton-wc/testing/keyboard.js';
import {nextFrame} from '@tecton-wc/testing/timing.js';
import './define.js';
import type {TctNavHeadingMenu} from './tct-nav-heading-menu.js';
import type {TctNavHeadingMenuItem} from './tct-nav-heading-menu-item.js';

const contrastOnly = {runOnly: {type: 'rule' as const, values: ['color-contrast']}};

async function settled(): Promise<void> {
  await nextFrame();
  await Promise.allSettled(document.getAnimations().map((animation) => animation.finished));
}

afterEach(async () => {
  await userEvent.hover(document.body, {position: {x: 0, y: 0}}).catch(() => undefined);
  await cdp()
    .send('Input.dispatchMouseEvent', {type: 'mouseReleased', x: 0, y: 0, button: 'left'})
    .catch(() => undefined);
});

describe('tct-nav-heading-menu-item: text contrast in every state', () => {
  for (const theme of ['light', 'dark'] as const) {
    const mount = async (): Promise<{wrapper: HTMLElement; rows: TctNavHeadingMenuItem[]}> => {
      const wrapper = await fixture<HTMLElement>(
        `<div style="background: var(--color-background-popover); padding: 8px; width: 320px"><button>before</button>` +
          `<tct-nav-heading-menu size="lg"><tct-nav-heading-menu-item label="Dashboard" description="Overview of everything" icon="check" href="#a"></tct-nav-heading-menu-item>` +
          `<tct-nav-heading-menu-item label="Analytics" href="#b"></tct-nav-heading-menu-item>` +
          `<tct-nav-heading-menu-item label="Settings" description="Preferences"></tct-nav-heading-menu-item>` +
          `<tct-nav-heading-menu-item label="Locked" description="Not available" disabled></tct-nav-heading-menu-item></tct-nav-heading-menu></div>`,
        {theme},
      );
      const menu = wrapper.querySelector<TctNavHeadingMenu>('tct-nav-heading-menu')!;
      const rows = [...menu.children] as TctNavHeadingMenuItem[];
      await Promise.all(rows.map((row) => row.updateComplete));
      await nextFrame();
      return {wrapper, rows};
    };

    it(`rest (${theme})`, async () => {
      const {wrapper} = await mount();
      await settled();
      await expectAccessible(wrapper, contrastOnly);
    });

    it(`hover (${theme})`, async () => {
      const {wrapper, rows} = await mount();
      await userEvent.hover(rows[0]!.control!);
      await settled();
      await expectAccessible(wrapper, contrastOnly);
    });

    it(`keyboard focus on a row with a description (${theme})`, async () => {
      const {wrapper} = await mount();
      wrapper.querySelector('button')!.focus();
      await pressKeys('Tab');
      await settled();
      await expectAccessible(wrapper, contrastOnly);
      await pressKeys('ArrowDown', 'ArrowDown');
      await settled();
      await expectAccessible(wrapper, contrastOnly);
    });

    it(`pressed (${theme})`, async () => {
      const {wrapper, rows} = await mount();
      const box = rows[2]!.control!.getBoundingClientRect();
      const point = {x: box.left + box.width / 2, y: box.top + box.height / 2};
      const session = cdp();
      await session.send('Input.dispatchMouseEvent', {type: 'mouseMoved', ...point});
      await session.send('Input.dispatchMouseEvent', {
        type: 'mousePressed',
        ...point,
        button: 'left',
        clickCount: 1,
      });
      await settled();
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
});
