/**
 * The keyboard table of `parity.json` (core.typeahead), one named step per row: the docs table and the tests
 * cannot drift apart. The combobox engine's finer behaviour (IME, focus-out, races) is in
 * tct-base-typeahead.test.ts and tct-typeahead.test.ts.
 */
import {expect} from 'vitest';
import {deepActiveElement} from '@tecton-wc/core/utils/focus.js';
import {runKeyboardSuite, type KeyboardRow} from '@tecton-wc/testing/suites/keyboard.js';
import {pressKeys} from '@tecton-wc/testing/keyboard.js';
import {waitUntil} from '@tecton-wc/testing/timing.js';
import './define.js';
import {createStaticSource} from './create-static-source.js';
import type {TctTypeahead} from './tct-typeahead.js';
import {
  activeOption,
  comboboxOf,
  FRUITS,
  optionsOf,
  typeInto,
  whenOpen,
} from './typeahead-test-helpers.js';

// `import.meta.glob` keeps parity.json (not part of the TypeScript project) out of the program.
const parity = Object.values(
  import.meta.glob<{entries: {'core.typeahead': {keyboard: KeyboardRow[]}}}>('./parity.json', {
    eager: true,
    import: 'default',
  }),
)[0]!;

const field = (element: HTMLElement): TctTypeahead => element as TctTypeahead;

/** A source, and the results open for "a": Apple, Apricot and Banana. */
async function openResults(element: HTMLElement): Promise<void> {
  const typeahead = field(element);
  typeahead.searchSource = createStaticSource(FRUITS);
  await typeInto(typeahead, 'a');
  await whenOpen(typeahead);
}

const indexOfActive = (element: HTMLElement): number =>
  optionsOf(field(element)).indexOf(activeOption(field(element))!);

runKeyboardSuite({
  tag: 'tct-typeahead',
  render: () =>
    `<tct-typeahead label="Fruit" debounce-ms="0"></tct-typeahead><button type="button" id="after">after</button>`,
  table: parity.entries['core.typeahead'].keyboard,
  steps: {
    'Opens the results and highlights the first one': {
      setup: async (element) => {
        await openResults(element);
        await pressKeys('Escape');
        await waitUntil(() => !field(element).open, 'the results close');
      },
      focus: (element) => comboboxOf(field(element)),
      keys: ['ArrowDown'],
      expect: async ({element}) => {
        await whenOpen(field(element));
        expect(indexOfActive(element)).toBe(0);
      },
    },
    'Highlights the next result': {
      setup: openResults,
      focus: (element) => comboboxOf(field(element)),
      keys: ['ArrowDown'],
      expect: ({element}) => {
        expect(indexOfActive(element)).toBe(1);
      },
    },
    'Highlights the previous result': {
      setup: async (element) => {
        await openResults(element);
        await pressKeys('ArrowDown', 'ArrowDown');
        expect(indexOfActive(element)).toBe(2);
      },
      focus: (element) => comboboxOf(field(element)),
      keys: ['ArrowUp'],
      expect: ({element}) => {
        expect(indexOfActive(element)).toBe(1);
      },
    },
    'Highlights the first result': {
      setup: async (element) => {
        await openResults(element);
        await pressKeys('ArrowDown', 'ArrowDown');
      },
      focus: (element) => comboboxOf(field(element)),
      keys: ['Home'],
      expect: ({element}) => {
        expect(indexOfActive(element)).toBe(0);
      },
    },
    'Highlights the last result': {
      setup: openResults,
      focus: (element) => comboboxOf(field(element)),
      keys: ['End'],
      expect: ({element}) => {
        expect(indexOfActive(element)).toBe(optionsOf(field(element)).length - 1);
      },
    },
    'Chooses the highlighted result and closes the results': {
      setup: openResults,
      focus: (element) => comboboxOf(field(element)),
      keys: ['ArrowDown', 'Enter'],
      expect: ({element}) => {
        expect(field(element).item?.id).toBe('apricot');
        expect(field(element).open).toBe(false);
      },
    },
    'Closes the results, keeping the text': {
      setup: openResults,
      focus: (element) => comboboxOf(field(element)),
      keys: ['Escape'],
      expect: async ({element}) => {
        await waitUntil(() => !field(element).open, 'the results close');
        expect(comboboxOf(field(element)).value).toBe('a');
        expect(field(element).item).toBeNull();
      },
    },
    'Closes the results and moves focus on': {
      setup: openResults,
      focus: (element) => comboboxOf(field(element)),
      keys: ['Tab'],
      expect: async ({element}) => {
        await waitUntil(() => !field(element).open, 'the results close');
        expect(deepActiveElement()?.id).toBe('after');
      },
    },
    'Edits the chosen item: the query becomes its label': {
      setup: async (element) => {
        field(element).searchSource = createStaticSource(FRUITS);
        field(element).item = FRUITS[3]!;
        await field(element).updateComplete;
      },
      focus: (element) =>
        field(element)
          .shadowRoot!.querySelector<HTMLElement>('tct-token')!
          .shadowRoot!.querySelector<HTMLElement>('button.action'),
      keys: ['Enter'],
      expect: async ({element}) => {
        await waitUntil(() => field(element).editing, 'edit mode');
        expect(comboboxOf(field(element)).value).toBe('Blueberry');
      },
    },
    'Leaves edit mode, restores the token and focuses it': {
      setup: async (element) => {
        field(element).searchSource = createStaticSource(FRUITS);
        field(element).item = FRUITS[3]!;
        await field(element).updateComplete;
        field(element)
          .shadowRoot!.querySelector<HTMLElement>('tct-token')!
          .shadowRoot!.querySelector<HTMLElement>('button.action')!
          .click();
        await waitUntil(() => field(element).editing, 'edit mode');
      },
      focus: (element) => comboboxOf(field(element)),
      keys: ['Escape'],
      expect: async ({element}) => {
        await waitUntil(() => !field(element).editing, 'edit mode ends');
        const token = field(element).shadowRoot!.querySelector('tct-token');
        expect(token).not.toBeNull();
        await waitUntil(() => token!.matches(':focus-within'), 'the token has focus');
        expect(field(element).item?.id).toBe('blueberry');
      },
    },
  },
  waive: {
    'Ignored while an input method editor is composing':
      'a composing key event cannot be produced by pressKeys; covered by "does not choose the highlighted result on a composing Enter (isComposing)" in tct-base-typeahead.test.ts and "a composing Escape (IME) does not leave edit mode" in tct-typeahead.test.ts',
  },
});
