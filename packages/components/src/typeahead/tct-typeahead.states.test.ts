/**
 * Text contrast in every state of the typeahead's result popup and its field, light and dark. Each state
 * paints its own fill (highlight, pressed, selected) and the ink on it must still read: a resting-state axe
 * run never sees a defect that only appears on the highlight fill. The pointer, the keyboard and the
 * DevTools protocol (for `:active`) put each row into the state explicitly, so this does not depend on where
 * an earlier test left the mouse, and axe runs after every transition has finished.
 */
import {html} from 'lit';
import {userEvent} from 'vitest/browser';
import {afterEach, describe, expect, it} from 'vitest';
import {expectAccessible} from '@tecton-wc/testing/a11y.js';
import {fixture} from '@tecton-wc/testing/fixture.js';
import {pressKeys} from '@tecton-wc/testing/keyboard.js';
import {isChromium} from '@tecton-wc/testing/tier.js';
import {waitUntil} from '@tecton-wc/testing/timing.js';
import '../icon/define.js';
import '../tooltip/define.js';
import './define.js';
import {createStaticSource} from './create-static-source.js';
import type {TctTypeahead} from './tct-typeahead.js';
import {
  activeOption,
  comboboxOf,
  forcePseudoState,
  FRUITS,
  motionDone,
  optionsOf,
  typeInto,
  whenOpen,
} from './typeahead-test-helpers.js';

const contrastOnly = {runOnly: {type: 'rule' as const, values: ['color-contrast']}};

afterEach(async () => {
  // Park the pointer away from the next fixture.
  await userEvent.hover(document.body, {position: {x: 0, y: 0}}).catch(() => undefined);
});

async function open(
  theme: 'light' | 'dark',
  attributes = '',
): Promise<{root: HTMLElement; field: TctTypeahead}> {
  const root = await fixture<HTMLElement>(
    `<div style="padding:24px 24px 300px;inline-size:420px"><tct-typeahead label="Fruit" description="Pick one" debounce-ms="0" ${attributes}></tct-typeahead></div>`,
    {theme},
  );
  const field = root.querySelector<TctTypeahead>('tct-typeahead')!;
  field.searchSource = createStaticSource(FRUITS);
  // Rows with an icon and a description: the secondary ink sits on the highlight fill too.
  field.renderItem = (item) =>
    html`<tct-typeahead-item .item=${item} description=${`About ${item.label}`}
      ><tct-icon slot="icon" name="search"></tct-icon
    ></tct-typeahead-item>`;
  await field.updateComplete;
  await typeInto(field, 'a');
  await whenOpen(field);
  await motionDone(root);
  return {root, field};
}

for (const theme of ['light', 'dark'] as const) {
  describe(`tct-typeahead: text contrast in every state (${theme})`, () => {
    it('the rows at rest, the first one highlighted by the keyboard (active descendant)', async () => {
      const {root, field} = await open(theme);
      expect(activeOption(field)).not.toBeNull();
      await expectAccessible(root, contrastOnly);
    });

    it('a row hovered by the pointer', async () => {
      const {root, field} = await open(theme);
      await userEvent.hover(optionsOf(field)[2]!);
      await waitUntil(() => activeOption(field) === optionsOf(field)[2], 'the hover highlights');
      await motionDone(root);
      await expectAccessible(root, contrastOnly);
    });

    it('a row moved to by ArrowDown', async () => {
      const {root} = await open(theme);
      await pressKeys('ArrowDown', 'ArrowDown');
      await motionDone(root);
      await expectAccessible(root, contrastOnly);
    });

    it.skipIf(!isChromium)('a row pressed (:active)', async () => {
      const {root, field} = await open(theme);
      const row = optionsOf(field)[1]!;
      await userEvent.hover(row);
      await waitUntil(() => activeOption(field) === row, 'the hover highlights');
      const highlighted = getComputedStyle(row).backgroundColor;
      const release = await forcePseudoState(row, ['active', 'hover']);
      try {
        await motionDone(root);
        expect(getComputedStyle(row).backgroundColor, 'the pressed fill is painted').not.toBe(
          highlighted,
        );
        await expectAccessible(root, contrastOnly);
      } finally {
        await release();
      }
    });

    it('the chosen row (selected weight and check) highlighted and not', async () => {
      const {root, field} = await open(theme);
      field.item = FRUITS[0]!;
      await field.updateComplete;
      await motionDone(root);
      await expectAccessible(root, contrastOnly);
      await pressKeys('ArrowDown');
      await motionDone(root);
      await expectAccessible(root, contrastOnly);
    });

    it('the empty state', async () => {
      const {root, field} = await open(theme);
      await userEvent.keyboard('zzz');
      await waitUntil(() => optionsOf(field).length === 1, 'the empty state');
      await motionDone(root);
      await expectAccessible(root, contrastOnly);
    });

    it('grouped results: the heading ink on the popup surface', async () => {
      const {root, field} = await open(theme);
      field.searchSource = createStaticSource(
        FRUITS.map((item, i) => ({
          ...item,
          auxiliaryData: {group: i < 2 ? 'A fruits' : 'Other fruits'},
        })),
      );
      await userEvent.keyboard('{Backspace}a');
      await waitUntil(
        () => field.shadowRoot!.querySelector('[role="group"]') !== null,
        'groups render',
      );
      await motionDone(root);
      await expectAccessible(root, contrastOnly);
    });

    it('the field with a chosen item: the token, the clear button and the label while hovered and keyboard focused', async () => {
      const {root, field} = await open(theme);
      await pressKeys('Escape');
      field.item = FRUITS[3]!;
      field.disabled = false;
      await field.updateComplete;
      await userEvent.hover(field.shadowRoot!.querySelector('tct-token')!);
      await motionDone(root);
      await expectAccessible(root, contrastOnly);
      await userEvent.unhover(field.shadowRoot!.querySelector('tct-token')!);
      comboboxOf(field).blur();
      await pressKeys('Tab');
      await motionDone(root);
      await expectAccessible(root, contrastOnly);
    });

    it('the disabled field and its label', async () => {
      const {root, field} = await open(theme);
      await pressKeys('Escape');
      field.disabled = true;
      field.item = FRUITS[0]!;
      await field.updateComplete;
      await motionDone(root);
      await expectAccessible(root, contrastOnly);
    });
  });
}
