/**
 * The keyboard table of `parity.json` (core.tokenizer), one named step per row: the docs table and the tests
 * cannot drift apart. The combobox engine's finer behaviour is covered by the typeahead tests and
 * tct-tokenizer.test.ts.
 */
import {expect} from 'vitest';
import {deepActiveElement} from '@tecton-wc/core/utils/focus.js';
import {pressKeys} from '@tecton-wc/testing/keyboard.js';
import {runKeyboardSuite, type KeyboardRow} from '@tecton-wc/testing/suites/keyboard.js';
import {waitUntil} from '@tecton-wc/testing/timing.js';
import '../typeahead/define.js';
import './define.js';
import {createStaticSource} from '../typeahead/create-static-source.js';
import {
  activeOption,
  comboboxOf,
  optionsOf,
  typeInto,
  whenOpen,
} from '../typeahead/typeahead-test-helpers.js';
import type {SearchableItem} from '../typeahead/typeahead.types.js';
import type {TctTokenizer} from './tct-tokenizer.js';

// `import.meta.glob` keeps parity.json (not part of the TypeScript project) out of the program.
const parity = Object.values(
  import.meta.glob<{entries: {'core.tokenizer': {keyboard: KeyboardRow[]}}}>('./parity.json', {
    eager: true,
    import: 'default',
  }),
)[0]!;

const TEAMS: SearchableItem[] = [
  {id: 'design', label: 'Design'},
  {id: 'engineering', label: 'Engineering'},
  {id: 'marketing', label: 'Marketing'},
  {id: 'sales', label: 'Sales'},
];

const field = (element: HTMLElement): TctTokenizer => element as TctTokenizer;
const tokensOf = (element: HTMLElement): HTMLElement[] => [
  ...field(element).shadowRoot!.querySelectorAll<HTMLElement>('tct-token'),
];
const indexOfActive = (element: HTMLElement): number =>
  optionsOf(field(element)).indexOf(activeOption(field(element))!);

/** The source and the results open for "e" (Design, Engineering and Sales). */
async function openResults(element: HTMLElement): Promise<void> {
  field(element).searchSource = createStaticSource(TEAMS);
  await typeInto(field(element), 'e');
  await whenOpen(field(element));
}

runKeyboardSuite({
  tag: 'tct-tokenizer',
  render: () =>
    `<button type="button" id="before">before</button><tct-tokenizer label="Teams" debounce-ms="0"></tct-tokenizer><button type="button" id="after">after</button>`,
  table: parity.entries['core.tokenizer'].keyboard,
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
    'Adds the highlighted result as a token and keeps the input for the next one': {
      setup: openResults,
      focus: (element) => comboboxOf(field(element)),
      keys: ['ArrowDown', 'Enter'],
      expect: async ({element}) => {
        await waitUntil(() => field(element).values.length === 1, 'the token is added');
        expect(field(element).values).toEqual(['engineering']);
        expect(comboboxOf(field(element)).value).toBe('');
        expect(field(element).shadowRoot!.activeElement).toBe(comboboxOf(field(element)));
      },
    },
    'Closes the results, keeping the text': {
      setup: openResults,
      focus: (element) => comboboxOf(field(element)),
      keys: ['Escape'],
      expect: async ({element}) => {
        await waitUntil(() => !field(element).open, 'the results close');
        expect(comboboxOf(field(element)).value).toBe('e');
        expect(field(element).values).toEqual([]);
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
    'Removes the last token and announces it': {
      setup: (element) => {
        field(element).searchSource = createStaticSource(TEAMS);
        field(element).items = [TEAMS[0]!, TEAMS[1]!];
        return field(element).updateComplete as unknown as Promise<void>;
      },
      focus: (element) => comboboxOf(field(element)),
      keys: ['Backspace'],
      expect: async ({element}) => {
        // The announcement is asserted in tct-tokenizer.test.ts ("Backspace in an empty input removes the last token, announced once").
        await waitUntil(() => field(element).values.length === 1, 'the last token is removed');
        expect(field(element).values).toEqual(['design']);
        expect(tokensOf(element)).toHaveLength(1);
      },
    },
    "Lands on the input, not on the first token's remove button": {
      setup: (element) => {
        field(element).items = [TEAMS[0]!, TEAMS[1]!];
        return field(element).updateComplete as unknown as Promise<void>;
      },
      focus: (element) => element.ownerDocument.getElementById('before'),
      keys: ['Tab'],
      expect: ({element}) => {
        expect(field(element).shadowRoot!.activeElement).toBe(comboboxOf(field(element)));
      },
    },
    'Removes a token': {
      setup: (element) => {
        field(element).items = [TEAMS[0]!, TEAMS[1]!];
        return field(element).updateComplete as unknown as Promise<void>;
      },
      // Focus enters the field on the input (from outside it never lands on a remove button); Shift+Tab walks back.
      focus: (element) => comboboxOf(field(element)),
      keys: ['Shift+Tab', 'Enter'],
      expect: async ({element}) => {
        await waitUntil(() => field(element).values.length === 1, 'the token is removed');
        expect(field(element).values).toEqual(['design']);
      },
    },
  },
});
