/**
 * Text contrast in every state of the tokenizer's result popup and its field, light and dark: rows at rest, hovered,
 * moved to by the keyboard and pressed, the Create entry, the empty state, the "+N more" indicator, and the tokens
 * and the clear-all button while hovered and keyboard focused. Each state paints its own fill, and a resting-state
 * axe run never sees a defect that only appears on it. The pointer, the keyboard and the DevTools protocol (for
 * `:active`) put each element into the state explicitly, and axe runs after every transition has finished.
 */
import {userEvent} from 'vitest/browser';
import {afterEach, describe, expect, it} from 'vitest';
import {expectAccessible} from '@tecton-wc/testing/a11y.js';
import {fixture} from '@tecton-wc/testing/fixture.js';
import {pressKeys} from '@tecton-wc/testing/keyboard.js';
import {isChromium} from '@tecton-wc/testing/tier.js';
import {waitUntil} from '@tecton-wc/testing/timing.js';
import '../icon/define.js';
import '../tooltip/define.js';
import '../typeahead/define.js';
import './define.js';
import {createStaticSource} from '../typeahead/create-static-source.js';
import {
  activeOption,
  comboboxOf,
  forcePseudoState,
  motionDone,
  optionsOf,
  typeInto,
  whenOpen,
} from '../typeahead/fixtures/typeahead-test-helpers.js';
import type {SearchableItem} from '../typeahead/typeahead.types.js';
import type {TctTokenizer} from './tct-tokenizer.js';

const contrastOnly = {runOnly: {type: 'rule' as const, values: ['color-contrast']}};

const TEAMS: SearchableItem[] = [
  {id: 'design', label: 'Design'},
  {id: 'engineering', label: 'Engineering'},
  {id: 'marketing', label: 'Marketing'},
  {id: 'sales', label: 'Sales'},
  {id: 'support', label: 'Support'},
  {id: 'legal', label: 'Legal'},
];

afterEach(async () => {
  // Park the pointer away from the next fixture.
  await userEvent.hover(document.body, {position: {x: 0, y: 0}}).catch(() => undefined);
});

async function mount(
  theme: 'light' | 'dark',
  attributes = '',
  items: SearchableItem[] = [],
  width = 420,
): Promise<{root: HTMLElement; field: TctTokenizer}> {
  const root = await fixture<HTMLElement>(
    `<div style="padding:24px 24px 300px;inline-size:${width}px"><button type="button">before</button><tct-tokenizer label="Teams" description="Pick some" debounce-ms="0" ${attributes}></tct-tokenizer></div>`,
    {theme},
  );
  const field = root.querySelector<TctTokenizer>('tct-tokenizer')!;
  field.searchSource = createStaticSource(TEAMS);
  if (items.length > 0) field.items = items;
  await field.updateComplete;
  return {root, field};
}

/** The results of "e" open, with an icon and a description in every row. */
async function open(
  theme: 'light' | 'dark',
  attributes = '',
): Promise<{root: HTMLElement; field: TctTokenizer}> {
  const mounted = await mount(theme, attributes);
  await typeInto(mounted.field, 'e');
  await whenOpen(mounted.field);
  await motionDone(mounted.root);
  return mounted;
}

for (const theme of ['light', 'dark'] as const) {
  describe(`tct-tokenizer: text contrast in every state (${theme})`, () => {
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

    it('the Create entry, highlighted and hovered', async () => {
      const {root, field} = await mount(theme, 'has-create');
      await typeInto(field, 'QA');
      await whenOpen(field);
      await motionDone(root);
      await expectAccessible(root, contrastOnly);
      await userEvent.hover(optionsOf(field).at(-1)!);
      await waitUntil(
        () => activeOption(field) === optionsOf(field).at(-1),
        'the hover highlights the Create entry',
      );
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

    it('the tokens at rest, hovered and keyboard focused (the remove button)', async () => {
      const {root, field} = await mount(theme, 'has-clear', TEAMS.slice(0, 3));
      await motionDone(root);
      await expectAccessible(root, contrastOnly);
      const token = field.shadowRoot!.querySelector('tct-token')!;
      await userEvent.hover(token.shadowRoot!.querySelector('button.remove')!);
      await motionDone(root);
      await expectAccessible(root, contrastOnly);
      await userEvent.unhover(token);
      comboboxOf(field).focus();
      await pressKeys('Shift+Tab');
      await motionDone(root);
      await expectAccessible(root, contrastOnly);
    });

    it('the clear-all button hovered and keyboard focused', async () => {
      const {root, field} = await mount(theme, 'has-clear', TEAMS.slice(0, 2));
      const clear = field.shadowRoot!.querySelector('tct-input-clear-button')!;
      await userEvent.hover(clear);
      await motionDone(root);
      await expectAccessible(root, contrastOnly);
      await userEvent.unhover(clear);
      comboboxOf(field).focus();
      await pressKeys('Tab');
      await motionDone(root);
      await expectAccessible(root, contrastOnly);
    });

    it('the "+N more" indicator while the field is not focused', async () => {
      const {root, field} = await mount(theme, 'token-overflow="unfocused-inline"', TEAMS, 300);
      const list = (): HTMLElement | null => field.shadowRoot!.querySelector('tct-overflow-list');
      await waitUntil(
        () => list()?.shadowRoot?.querySelector('.indicator') != null,
        'the indicator shows',
      );
      await motionDone(root);
      await expectAccessible(root, contrastOnly);
    });

    it('the disabled field, its label and its description', async () => {
      // Disabled tokens keep the dimmed Tecton ink: WCAG 1.4.3 exempts inactive components, but axe can only see
      // that for a native disabled control (the input, the label that names it), not for a plain-text token label.
      const {root, field} = await mount(theme, 'disabled has-clear');
      await field.updateComplete;
      await motionDone(root);
      await expectAccessible(root, contrastOnly);
    });
  });
}
