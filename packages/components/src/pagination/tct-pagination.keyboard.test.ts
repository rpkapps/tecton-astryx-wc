/**
 * tct-pagination keyboard contract: the parity.json keyboard table as steps (Tab order with the dots as one
 * stop, activating buttons, arrows / Home / End on the dots, committing the page box), each in LTR and,
 * where the direction matters, RTL.
 */
import {expect} from 'vitest';
import {deepActiveElement} from '@tecton-wc/core/utils/focus.js';
import {runKeyboardSuite} from '@tecton-wc/testing/suites/keyboard.js';
import './define.js';
import type {TctPagination} from './tct-pagination.js';

const parity = Object.values(
  import.meta.glob<{
    entries: {'core.pagination': {keyboard: {keys: string; action: string; when?: string}[]}};
  }>('./parity.json', {eager: true, import: 'default'}),
)[0]!;

const pagination = (element: HTMLElement): TctPagination => element as TctPagination;
const inner = (host: Element | null): HTMLElement =>
  host!.shadowRoot!.querySelector<HTMLElement>('button')!;
const step = (element: HTMLElement, name: string): HTMLElement =>
  inner(element.shadowRoot!.querySelector(`tct-button.${name}`));
const dots = (element: HTMLElement): HTMLElement[] => [
  ...element.shadowRoot!.querySelectorAll<HTMLElement>('button.dot'),
];
const boxInput = (element: HTMLElement): HTMLInputElement =>
  element
    .shadowRoot!.querySelector('tct-number-input')!
    .shadowRoot!.querySelector<HTMLInputElement>('input.input')!;

/** Applies attributes and waits for the paginator (and the elements it renders) to settle. */
async function configure(element: HTMLElement, attributes: Record<string, string>): Promise<void> {
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  await pagination(element).updateComplete;
  await new Promise((resolve) => requestAnimationFrame(resolve));
  await pagination(element).updateComplete;
}

runKeyboardSuite({
  tag: 'tct-pagination',
  render: () => '<tct-pagination total-pages="12" page-size-options="10,25"></tct-pagination>',
  table: parity.entries['core.pagination'].keyboard,
  steps: {
    'Moves through the selector, the buttons and the page box in order; the dots are a single tab stop':
      {
        setup: (element) => configure(element, {variant: 'dots', page: '3'}),
        focus: (element) =>
          element
            .shadowRoot!.querySelector('tct-selector')!
            .shadowRoot!.querySelector<HTMLElement>('button'),
        // Selector, previous, the one dot stop, next: three Tabs land on next.
        keys: ['Tab', 'Tab', 'Tab'],
        expect: ({element}) => {
          expect(deepActiveElement()).toBe(step(element, 'next'));
        },
      },
    'Activates the focused button: previous, next, first, last, a page number or a dot': {
      setup: (element) => configure(element, {page: '3'}),
      focus: (element) => step(element, 'next'),
      keys: ['Enter'],
      expect: ({element}) => {
        expect(pagination(element).page).toBe(4);
      },
    },
    'Moves focus to the next or previous dot and goes to that page; wraps at the ends and follows the reading direction':
      {
        setup: (element) => configure(element, {variant: 'dots', page: '2'}),
        focus: (element) => dots(element)[1]!,
        keys: ['ArrowRight'],
        rtl: {keys: ['ArrowLeft']},
        expect: ({element}) => {
          expect(pagination(element).page).toBe(3);
          expect(element.shadowRoot!.activeElement).toBe(dots(element)[2]);
        },
      },
    'Goes to the first or last page': {
      setup: (element) => configure(element, {variant: 'dots', page: '3'}),
      focus: (element) => dots(element)[2]!,
      keys: ['End'],
      expect: ({element}) => {
        expect(pagination(element).page).toBe(12);
        expect(element.shadowRoot!.activeElement).toBe(dots(element)[11]);
      },
    },
    'Commits the typed page: a number out of range is clamped, an empty or invalid entry is restored':
      {
        setup: (element) => configure(element, {variant: 'input', page: '2'}),
        focus: (element) => boxInput(element),
        keys: ['Control+a', '9', '9', 'Enter'],
        expect: ({element}) => {
          expect(pagination(element).page).toBe(12);
        },
      },
    'Commits the typed page when focus leaves the page box': {
      setup: (element) => configure(element, {variant: 'input', page: '2'}),
      focus: (element) => boxInput(element),
      keys: ['Control+a', '7', 'Tab'],
      expect: ({element}) => {
        expect(pagination(element).page).toBe(7);
      },
    },
  },
});
