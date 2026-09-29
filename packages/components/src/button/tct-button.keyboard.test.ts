/** tct-button keyboard contract: every row of the parity.json keyboard table has a step. */
import {expect} from 'vitest';
import {runKeyboardSuite} from '@tecton-astryx/testing/suites/keyboard.js';
import {deepActiveElement} from '@tecton-astryx/testing/keyboard.js';
import parity from './parity.json' with {type: 'json'};
import './define.js';

const table = parity.entries['core.button'].keyboard;

const clicks = (element: HTMLElement): {count: number} => {
  const seen = {count: 0};
  element.addEventListener('click', () => {
    seen.count += 1;
  });
  (element as HTMLElement & {seen?: typeof seen}).seen = seen;
  return seen;
};
const seenOf = (element: HTMLElement): {count: number} =>
  (element as HTMLElement & {seen: {count: number}}).seen;

runKeyboardSuite({
  tag: 'tct-button',
  render: () => `<input id="before" aria-label="before"><tct-button label="Save"></tct-button>`,
  table,
  steps: {
    'Activates the button': {
      setup: (element) => {
        clicks(element);
      },
      focus: (element) => element.shadowRoot!.querySelector<HTMLElement>('.button'),
      keys: ['Enter'],
      expect: ({element}) => {
        expect(seenOf(element).count).toBe(1);
      },
    },
    'Activates the button on key up': {
      setup: (element) => {
        clicks(element);
      },
      focus: (element) => element.shadowRoot!.querySelector<HTMLElement>('.button'),
      keys: [' '],
      expect: ({element}) => {
        expect(seenOf(element).count).toBe(1);
      },
    },
    'Moves focus to the button': {
      focus: (element) => element.previousElementSibling as HTMLElement,
      keys: ['Tab'],
      expect: ({element}) => {
        expect(deepActiveElement()).toBe(element.shadowRoot!.querySelector('.button'));
      },
    },
  },
  // The last two rows need a form / an open tooltip: they are asserted in dedicated tests (named in the waivers).
  waive: {
    "Activates the form's default submit button from a field":
      'covered by tct-button.form.test.ts "Enter in a text input activates the default tct-button submit"',
    'Closes the tooltip':
      'covered by tct-button.test.ts "Escape closes the tooltip and the button stays focused"',
  },
});
