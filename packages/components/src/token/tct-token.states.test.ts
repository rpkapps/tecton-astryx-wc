/**
 * Text contrast of every token colour in every interactive state, light and dark. The hover and pressed
 * washes are painted over the colour's own fill, so the ink that reads at rest can fail on them (and the
 * link, button and container forms draw the ring differently): a resting-state axe run never sees that. The
 * pointer and keyboard put each token into the state explicitly, `:active` is forced through the DevTools
 * protocol, and axe runs after the state transition has finished.
 */
import {userEvent} from 'vitest/browser';
import {afterEach, describe, expect, it} from 'vitest';
import {expectAccessible} from '@tecton-wc/testing/a11y.js';
import {fixture} from '@tecton-wc/testing/fixture.js';
import {pressKeys} from '@tecton-wc/testing/keyboard.js';
import {isChromium} from '@tecton-wc/testing/tier.js';
import '../icon/define.js';
import './define.js';
import {forcePseudoState, motionDone} from '../typeahead/fixtures/typeahead-test-helpers.js';
import {TOKEN_COLORS} from './token.types.js';
import type {TctToken} from './tct-token.js';

const contrastOnly = {runOnly: {type: 'rule' as const, values: ['color-contrast']}};

afterEach(async () => {
  // Park the pointer away from the next fixture.
  await userEvent.hover(document.body, {position: {x: 0, y: 0}}).catch(() => undefined);
});

const FORMS: Record<string, string> = {
  clickable: 'clickable removable',
  link: 'href="https://example.com"',
  'linked and removable': 'href="https://example.com" removable',
};

async function mount(
  theme: 'light' | 'dark',
  color: string,
  attributes: string,
): Promise<{wrapper: HTMLElement; token: TctToken}> {
  const wrapper = await fixture<HTMLElement>(
    `<div style="padding:16px"><button type="button">before</button> <tct-token label="Design team" color="${color}" ${attributes}><tct-icon slot="icon" name="search"></tct-icon></tct-token></div>`,
    {theme},
  );
  wrapper.addEventListener('click', (event) => event.preventDefault());
  const token = wrapper.querySelector<TctToken>('tct-token')!;
  await token.updateComplete;
  return {wrapper, token};
}

for (const theme of ['light', 'dark'] as const) {
  describe(`tct-token: text contrast in every state (${theme})`, () => {
    for (const color of TOKEN_COLORS) {
      it(`${color}: plain at rest`, async () => {
        const {wrapper} = await mount(theme, color, '');
        await expectAccessible(wrapper, contrastOnly);
      });

      for (const [name, attributes] of Object.entries(FORMS)) {
        it(`${color}, ${name}: hover`, async () => {
          const {wrapper, token} = await mount(theme, color, attributes);
          await userEvent.hover(token.shadowRoot!.querySelector('.base')!);
          await motionDone(wrapper);
          await expectAccessible(wrapper, contrastOnly);
        });

        it(`${color}, ${name}: keyboard focus`, async () => {
          const {wrapper} = await mount(theme, color, attributes);
          wrapper.querySelector('button')!.focus();
          await pressKeys('Tab');
          await motionDone(wrapper);
          await expectAccessible(wrapper, contrastOnly);
        });

        it.skipIf(!isChromium)(`${color}, ${name}: pressed (:active)`, async () => {
          const {wrapper, token} = await mount(theme, color, attributes);
          const pill = token.shadowRoot!.querySelector<HTMLElement>('.base')!;
          const resting = getComputedStyle(pill).borderTopColor;
          const release = await forcePseudoState(pill, ['active', 'hover']);
          try {
            await motionDone(wrapper);
            expect(getComputedStyle(pill).borderTopColor, 'the pressed edge is drawn').not.toBe(
              resting,
            );
            await expectAccessible(wrapper, contrastOnly);
          } finally {
            await release();
          }
        });
      }
    }
  });
}
