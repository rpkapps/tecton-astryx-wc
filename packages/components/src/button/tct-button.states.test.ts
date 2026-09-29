/**
 * Text contrast in every interactive state. Each state pairs its fill with its own text role; the
 * resting ink on a state fill can fail (primary in dark mode: 4.18:1 on the hover/focus fill), which
 * a resting-state axe run never sees. The pointer and keyboard put each button into the state
 * explicitly, so this does not depend on where an earlier test left the mouse, and axe runs after the
 * state transition has finished.
 */
import {userEvent} from 'vitest/browser';
import {afterEach, describe, it} from 'vitest';
import {expectAccessible} from '@tecton-wc/testing/a11y.js';
import {fixture} from '@tecton-wc/testing/fixture.js';
import {pressKeys} from '@tecton-wc/testing/keyboard.js';
import {BUTTON_VARIANTS} from './button.types.js';
import './define.js';

const contrastOnly = {runOnly: {type: 'rule' as const, values: ['color-contrast']}};

/** State colours arrive through a CSS transition: measure the settled state, not the first frame. */
async function settled(button: Element): Promise<void> {
  const inner = button.shadowRoot!.querySelector('.button')!;
  await Promise.all(inner.getAnimations().map((animation) => animation.finished));
}

afterEach(async () => {
  // Park the pointer away from the next fixture.
  await userEvent.hover(document.body, {position: {x: 0, y: 0}}).catch(() => undefined);
});

describe('tct-button: text contrast in hover and focus states', () => {
  for (const theme of ['light', 'dark'] as const) {
    for (const variant of BUTTON_VARIANTS) {
      it(`${variant} (${theme}): hover`, async () => {
        const wrapper = await fixture<HTMLElement>(
          `<div><tct-button label="Save changes" variant="${variant}"></tct-button></div>`,
          {theme},
        );
        const button = wrapper.querySelector('tct-button')!;
        await userEvent.hover(button);
        await settled(button);
        await expectAccessible(wrapper, contrastOnly);
      });

      it(`${variant} (${theme}): keyboard focus`, async () => {
        const wrapper = await fixture<HTMLElement>(
          `<div><button>before</button><tct-button label="Save changes" variant="${variant}"></tct-button></div>`,
          {theme},
        );
        wrapper.querySelector('button')!.focus();
        await pressKeys('Tab');
        await settled(wrapper.querySelector('tct-button')!);
        await expectAccessible(wrapper, contrastOnly);
      });
    }
  }
});
