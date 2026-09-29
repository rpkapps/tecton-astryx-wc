/**
 * The keyboard tables of `parity.json`, turned into tests (runKeyboardSuite): every row of the bottom
 * sheet's and the switcher's table has a named step, so the docs and the tests cannot drift apart.
 */
import {describe, expect, it} from 'vitest';
import {deepActiveElement} from '@tecton-wc/core/utils/focus.js';
import {runKeyboardSuite, waitUntil} from '@tecton-wc/testing/index.js';
import './define.js';
import type {TctBottomSheetSwitcher} from './tct-bottom-sheet-switcher.js';
import type {TctBottomSheet} from './tct-bottom-sheet.js';
import {handleOf, openSheet, sheetOf} from './fixtures/sheet-test-utils.js';

// `import.meta.glob` keeps parity.json (not part of the TypeScript project) out of the program.
const parity = Object.values(
  import.meta.glob<{
    entries: Record<string, {keyboard: {keys: string; action: string; when?: string}[]}>;
  }>('./parity.json', {eager: true, import: 'default'}),
)[0]!;

const asSheet = (element: HTMLElement): TctBottomSheet => element as TctBottomSheet;

/** Opens the sheet, optionally resting at its shorter stop first. */
async function ready(element: HTMLElement, atShortest = false): Promise<TctBottomSheet> {
  const sheet = asSheet(element);
  await openSheet(sheet);
  if (atShortest) {
    sheet.snapTo(1);
    await waitUntil(() => sheet.snapIndex === 1, 'at the shorter stop');
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return sheet;
}

describe('keyboard tables', () => {
  it('lists a row for every documented key', () => {
    expect(parity.entries['core.bottom-sheet']!.keyboard.length).toBeGreaterThanOrEqual(7);
    expect(parity.entries['core.bottom-sheet-switcher']!.keyboard).toHaveLength(1);
  });
});

runKeyboardSuite({
  tag: 'tct-bottom-sheet',
  render: () =>
    `<tct-bottom-sheet label="Route" height="tall" snap-points="0.5"><button id="inside">Inside</button></tct-bottom-sheet>`,
  table: parity.entries['core.bottom-sheet']!.keyboard,
  steps: {
    'Closes the sheet (cancelable tct-open-change) and returns focus to the opener': {
      setup: async (element) => {
        await ready(element);
      },
      focus: (element) => sheetOf(asSheet(element)),
      keys: ['Escape'],
      expect: async ({element}) => {
        await waitUntil(() => !asSheet(element).open, 'closed by Escape');
      },
    },
    "Moves between the resize handle and the sheet's controls; focus stays inside a modal sheet": {
      setup: async (element) => {
        await ready(element);
      },
      focus: (element) => handleOf(asSheet(element)),
      keys: ['Tab'],
      expect: () => {
        expect(deepActiveElement()?.id).toBe('inside');
      },
    },
    'Moves the sheet to the next taller stop': {
      setup: async (element) => {
        await ready(element, true);
      },
      focus: (element) => handleOf(asSheet(element)),
      keys: ['ArrowUp'],
      expect: async ({element}) => {
        await waitUntil(() => asSheet(element).snapIndex === 0, 'taller');
      },
    },
    'Moves the sheet to the next shorter stop': {
      setup: async (element) => {
        await ready(element);
      },
      focus: (element) => handleOf(asSheet(element)),
      keys: ['ArrowDown'],
      expect: async ({element}) => {
        await waitUntil(() => asSheet(element).snapIndex === 1, 'shorter');
      },
    },
    'Moves the sheet to its tallest stop': {
      setup: async (element) => {
        await ready(element, true);
      },
      focus: (element) => handleOf(asSheet(element)),
      keys: ['End'],
      expect: async ({element}) => {
        await waitUntil(() => asSheet(element).snapIndex === 0, 'tallest');
      },
    },
    'Moves the sheet to its shortest stop': {
      setup: async (element) => {
        await ready(element);
      },
      focus: (element) => handleOf(asSheet(element)),
      keys: ['Home'],
      expect: async ({element}) => {
        await waitUntil(() => asSheet(element).snapIndex === 1, 'shortest');
      },
    },
    'Cycles the stops: one taller, and from the tallest to the shortest': {
      setup: async (element) => {
        await ready(element);
      },
      focus: (element) => handleOf(asSheet(element)),
      keys: ['Enter'],
      expect: async ({element}) => {
        await waitUntil(() => asSheet(element).snapIndex === 1, 'cycled to the shortest');
      },
    },
  },
});

runKeyboardSuite({
  tag: 'tct-bottom-sheet-switcher',
  render: () =>
    `<tct-bottom-sheet-switcher><tct-bottom-sheet sheet-id="a" label="First" height="hug"><button id="inside">Inside</button></tct-bottom-sheet></tct-bottom-sheet-switcher>`,
  table: parity.entries['core.bottom-sheet-switcher']!.keyboard,
  steps: {
    'Closes the flow (cancelable tct-open-change) and returns focus to the original opener': {
      setup: async (element) => {
        const flow = element as TctBottomSheetSwitcher;
        flow.activeSheet = 'a';
        await waitUntil(
          () => flow.querySelector<TctBottomSheet>('[sheet-id=a]')!.phase === 'active',
          'the sheet is active',
        );
        await new Promise((resolve) => setTimeout(resolve, 500));
      },
      focus: (element) => element.querySelector<HTMLElement>('#inside'),
      keys: ['Escape'],
      expect: async ({element}) => {
        await waitUntil(() => (element as TctBottomSheetSwitcher).activeSheet === null, 'closed');
      },
    },
  },
});
