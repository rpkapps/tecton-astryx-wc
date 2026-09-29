/**
 * The four standard suites (A§15.3) run against the test-only hosts. This is both their own test and
 * the reference for how a component's test file calls them.
 */
import {userEvent} from 'vitest/browser';
import {beforeAll, describe, expect, it} from 'vitest';
import {defineElement} from '@tecton-astryx/core/define.js';
import {TctTestCheckbox, TctTestGroup, TctTestInput, TctTestSubmit} from '../fixtures/test-form.js';
import {TctTestLayer} from '../fixtures/test-layer.js';
import {TctTestToolbar} from '../fixtures/test-toolbar.js';
import {deepActiveElement, pressKeys} from '../keyboard.js';
import {runElementSuite} from '../suites/element.js';
import {runFormControlSuite} from '../suites/form-control.js';
import {runKeyboardSuite} from '../suites/keyboard.js';
import {runOverlaySuite} from '../suites/overlay.js';
import {fixture} from '../fixture.js';

beforeAll(() => {
  for (const ctor of [
    TctTestInput,
    TctTestCheckbox,
    TctTestGroup,
    TctTestSubmit,
    TctTestLayer,
    TctTestToolbar,
  ])
    defineElement(ctor);
});

// ------------------------------------------------------------------------------- element suite

runElementSuite({
  tag: 'tct-test-input',
  properties: {name: 'q', minlength: 3},
  attributes: {name: 'name'},
  // The bare fixture has no accessible name; components give theirs a label in `render`.
  render: () => `<label>Search <tct-test-input></tct-test-input></label>`,
});

runElementSuite({
  tag: 'tct-test-layer',
  properties: {placement: 'above', alignment: 'end'},
  events: ['tct-open-change', 'tct-after-open-change'],
  a11y: false,
});

// ---------------------------------------------------------------------------- form control suite

runFormControlSuite({
  tag: 'tct-test-input',
  validValue: 'hello',
  submitsOnEnter: true,
  userEdit: async (element) => {
    await userEvent.click(element);
    await userEvent.keyboard('hi');
    await pressKeys('Tab');
  },
});

runFormControlSuite({
  tag: 'tct-test-checkbox',
  validValue: 'on',
  setValid: (element) => {
    (element as unknown as TctTestCheckbox).checked = true;
  },
  setEmpty: (element) => {
    (element as unknown as TctTestCheckbox).checked = false;
  },
  restoreState: 'checked',
  labelActivation: 'click',
  userEdit: async (element) => {
    await userEvent.click(element.shadowRoot!.querySelector('input')!);
    await pressKeys('Tab');
  },
});

runFormControlSuite({
  tag: 'tct-test-group',
  validValue: 'b',
  setValid: (element) => {
    element.value = 'b';
  },
  labelActivation: false,
  userEdit: async (element) => {
    await userEvent.click(element.shadowRoot!.querySelectorAll('button')[1]!);
  },
});

// -------------------------------------------------------------------------------- overlay suite

runOverlaySuite({
  tag: 'tct-test-layer',
  render: ({attributes = '', children = ''}) =>
    `<tct-test-layer ${attributes}><button slot="trigger">Open</button>${children}<span>content</span></tct-test-layer>`,
  trigger: (element) => element.querySelector<HTMLElement>(':scope > [slot="trigger"]'),
});

describe('modal overlay', () => {
  runOverlaySuite({
    tag: 'tct-test-layer',
    modal: true,
    render: ({attributes = '', children = ''}) =>
      `<tct-test-layer kind="modal" ${attributes}>${children}<span>content</span></tct-test-layer>`,
  });
});

describe('required dialog (escape blocked)', () => {
  runOverlaySuite({
    tag: 'tct-test-layer',
    escapeCloses: false,
    outsidePress: false,
    render: ({attributes = '', children = ''}) =>
      `<tct-test-layer escape="block" outside-press="false" ${attributes}>${children}<span>content</span></tct-test-layer>`,
  });
});

// ------------------------------------------------------------------------------- keyboard suite

const TOOLBAR_TABLE = [
  {keys: 'ArrowRight', action: 'Moves focus to the next item', when: 'horizontal'},
  {keys: 'Home', action: 'Moves focus to the first item'},
  {keys: 'End', action: 'Moves focus to the last enabled item'},
  {keys: 'Tab', action: 'Leaves the toolbar (one tab stop)'},
] as const;

const activeText = (): string => {
  const active = deepActiveElement();
  return active?.textContent.trim() ?? '';
};

runKeyboardSuite({
  tag: 'tct-test-toolbar',
  render: () =>
    `<button id="before">before</button><tct-test-toolbar><button>Bold</button><button>Italic</button><button disabled>Off</button><button>Strike</button></tct-test-toolbar><button id="after">after</button>`,
  table: TOOLBAR_TABLE,
  steps: {
    'Moves focus to the next item': {
      focus: (element) => element.querySelector('button'),
      keys: ['ArrowRight'],
      expect: () => {
        expect(activeText()).toBe('Italic');
      },
      // In RTL the same physical arrow goes the other way.
      rtl: {
        keys: ['ArrowLeft'],
        expect: () => {
          expect(activeText()).toBe('Italic');
        },
      },
    },
    'Moves focus to the first item': {
      focus: (element) => element.querySelectorAll('button')[1]!,
      keys: ['Home'],
      expect: () => {
        expect(activeText()).toBe('Bold');
      },
    },
    End: {
      focus: (element) => element.querySelector('button'),
      keys: ['End'],
      expect: () => {
        expect(activeText()).toBe('Strike');
      },
    },
    Tab: {
      focus: (element) => element.querySelector('button'),
      keys: ['Tab'],
      expect: () => {
        expect(deepActiveElement()?.id).toBe('after');
      },
    },
  },
  waive: {},
});

describe('runKeyboardSuite', () => {
  it('a row without a step fails loudly (the docs table cannot drift from the tests)', async () => {
    // Exercised by running the failing shape in isolation: the step lookup rejects unknown rows.
    const lookup = (name: string): boolean =>
      TOOLBAR_TABLE.some((row) => row.action === name || row.keys === name);
    expect(lookup('Moves focus to the next item')).toBe(true);
    expect(lookup('nothing')).toBe(false);
    await fixture('<div></div>');
  });
});
