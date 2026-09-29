/**
 * The keyboard table of `parity.json` (core.token), one named step per row: the docs table and the tests
 * cannot drift apart.
 */
import {expect} from 'vitest';
import {runKeyboardSuite, type KeyboardRow} from '@tecton-wc/testing/suites/keyboard.js';
import './define.js';
import type {TctToken} from './tct-token.js';

// `import.meta.glob` keeps parity.json (not part of the TypeScript project) out of the program.
const parity = Object.values(
  import.meta.glob<{entries: {'core.token': {keyboard: KeyboardRow[]}}}>('./parity.json', {
    eager: true,
    import: 'default',
  }),
)[0]!;

const token = (element: HTMLElement): TctToken => element as TctToken;
const inner = (element: HTMLElement, selector: string): HTMLElement =>
  token(element).shadowRoot!.querySelector<HTMLElement>(selector)!;

/** Counts (and stops the navigation of) the events a step expects. */
function count(element: HTMLElement, type: string): () => number {
  let events = 0;
  element.addEventListener(type, (event) => {
    event.preventDefault();
    events += 1;
  });
  return () => events;
}

const counts = new WeakMap<HTMLElement, () => number>();

runKeyboardSuite({
  tag: 'tct-token',
  render: () => `<tct-token label="Design" clickable removable></tct-token>`,
  table: parity.entries['core.token'].keyboard,
  steps: {
    'Presses a clickable token': {
      setup: (element) => {
        counts.set(element, count(element, 'click'));
      },
      focus: (element) => inner(element, 'button.action'),
      keys: ['Enter', 'Space'],
      expect: ({element}) => {
        expect(counts.get(element)!()).toBe(2);
      },
    },
    'Follows the link of a link token': {
      setup: async (element) => {
        token(element).clickable = false;
        token(element).href = '#design';
        await token(element).updateComplete;
        counts.set(element, count(element, 'click'));
      },
      focus: (element) => inner(element, 'a.action'),
      keys: ['Enter'],
      expect: ({element}) => {
        expect(counts.get(element)!()).toBe(1);
      },
    },
    'Moves from the label to the remove button (two tab stops)': {
      focus: (element) => inner(element, 'button.action'),
      keys: ['Tab'],
      expect: ({element}) => {
        expect(token(element).shadowRoot!.activeElement).toBe(inner(element, 'button.remove'));
      },
    },
    'Fires tct-remove': {
      setup: (element) => {
        counts.set(element, count(element, 'tct-remove'));
      },
      focus: (element) => inner(element, 'button.remove'),
      keys: ['Enter', 'Space'],
      expect: ({element}) => {
        expect(counts.get(element)!()).toBe(2);
      },
    },
  },
});
