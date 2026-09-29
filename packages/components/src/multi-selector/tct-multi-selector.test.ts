/**
 * tct-multi-selector: the element and form-control suites (repeated names in FormData, reset, restore),
 * the trigger displays, toggling and select-all with its partial state, sorted-first rows, search,
 * announcements (once per change), disabled and read-only, the bottom sheet and the keyboard table.
 * Ported from upstream MultiSelector.test.tsx where the behaviour applies.
 */
import {html} from 'lit';
import {afterEach, describe, expect, it} from 'vitest';
import {userEvent} from 'vitest/browser';
import {deepActiveElement} from '@tecton-wc/core/utils/focus.js';
import {axNode, expectAccessible} from '@tecton-wc/testing/a11y.js';
import {expectEventFlags, recordEvents} from '@tecton-wc/testing/events.js';
import {formHarness} from '@tecton-wc/testing/forms.js';
import {pressKeys} from '@tecton-wc/testing/keyboard.js';
import {runElementSuite} from '@tecton-wc/testing/suites/element.js';
import {runFormControlSuite} from '@tecton-wc/testing/suites/form-control.js';
import {runKeyboardSuite} from '@tecton-wc/testing/suites/keyboard.js';
import {runOverlaySuite} from '@tecton-wc/testing/suites/overlay.js';
import {isChromium} from '@tecton-wc/testing/tier.js';
import {animationsFinished, nextFrame, waitUntil} from '@tecton-wc/testing/timing.js';
import {stubCompactTouch} from '../dropdown-menu/menu-test-helpers.js';
import '../input-group/define.js';
import './define.js';
import type {SelectorOptionType} from '../selector/selector.types.js';
import {
  FRUIT,
  GROUPED,
  activeText,
  closed,
  isShown,
  layerOf,
  listboxOf,
  mountSelect,
  openByClick,
  optionsOf,
  recordAnnouncements,
  searchOf,
  trigger,
} from '../selector/selector-test-helpers.js';
import type {TctMultiSelector} from './tct-multi-selector.js';

const make = (attributes = 'label="Columns"', options: SelectorOptionType[] = FRUIT) =>
  mountSelect<TctMultiSelector>('tct-multi-selector', attributes, options);

const part = (el: TctMultiSelector, name: string): HTMLElement | null =>
  el.shadowRoot!.querySelector<HTMLElement>(`[part~="${name}"]`);

const rowLabels = (el: TctMultiSelector): string[] =>
  optionsOf(el).map(
    (row) =>
      row.querySelector('tct-selector-option')?.getAttribute('label') ??
      row.querySelector('.option-label')?.textContent.trim() ??
      '',
  );

const checked = (el: TctMultiSelector): string[] =>
  optionsOf(el)
    .filter((row) => row.getAttribute('aria-selected') === 'true')
    .map((row) => row.querySelector('tct-selector-option')?.getAttribute('label') ?? '');

let recorder: ReturnType<typeof recordAnnouncements> | undefined;
let stub: ReturnType<typeof stubCompactTouch> | undefined;
afterEach(() => {
  recorder?.restore();
  recorder = undefined;
  stub?.restore();
  stub = undefined;
});

runElementSuite({
  tag: 'tct-multi-selector',
  render: () => html`<tct-multi-selector label="Columns" name="cols"></tct-multi-selector>`,
  properties: {
    label: 'Other',
    description: 'Help',
    placeholder: 'Pick',
    variant: 'ghost',
    size: 'lg',
    triggerDisplay: 'badges',
    maxBadges: 2,
    hasSelectAll: true,
    selectAllLabel: 'Everything',
    hasClear: true,
    hasSearch: true,
    presentation: 'adaptive',
    indicatorPosition: 'end',
    loading: true,
  },
  attributes: {
    label: 'label',
    description: 'description',
    placeholder: 'placeholder',
    variant: 'variant',
    size: 'size',
    triggerDisplay: 'trigger-display',
    maxBadges: 'max-badges',
    hasSelectAll: 'has-select-all',
    selectAllLabel: 'select-all-label',
    hasClear: 'has-clear',
    hasSearch: 'has-search',
    presentation: 'presentation',
    indicatorPosition: 'indicator-position',
    loading: 'loading',
  },
  events: ['tct-open-change', 'tct-after-open-change', 'tct-clear'],
});

runFormControlSuite({
  tag: 'tct-multi-selector',
  render: (attributes) => `<tct-multi-selector label="Columns" ${attributes}></tct-multi-selector>`,
  validValue: 'Banana',
  setValid: (el) => {
    (el as unknown as TctMultiSelector).options = FRUIT;
    el.value = 'Banana';
  },
  setEmpty: (el) => {
    (el as unknown as TctMultiSelector).options = FRUIT;
    el.value = '';
  },
  required: true,
  readonly: true,
  userEdit: async (el) => {
    const selector = el as unknown as TctMultiSelector;
    selector.options = FRUIT;
    await selector.updateComplete;
    await userEvent.click(trigger(selector));
    await waitUntil(() => selector.open, 'open');
    await nextFrame();
    await userEvent.click(optionsOf(selector)[1]!);
    await pressKeys('Escape');
    await waitUntil(() => !selector.open, 'closed');
    await pressKeys('Tab');
  },
  innerFocusable: (el) => trigger(el),
});

describe('tct-multi-selector: form participation', () => {
  it('submits one entry per chosen value under the name (repeated names in FormData)', async () => {
    const form = await formHarness(
      '<tct-multi-selector label="Columns" name="cols" value="Apple Pear"></tct-multi-selector>',
    );
    const el = form.form.querySelector<TctMultiSelector>('tct-multi-selector')!;
    el.options = FRUIT;
    await el.updateComplete;
    expect(form.entries()).toEqual([
      ['cols', 'Apple'],
      ['cols', 'Pear'],
    ]);
    el.values = ['Banana'];
    await el.updateComplete;
    expect(form.entries()).toEqual([['cols', 'Banana']]);
    el.values = [];
    await el.updateComplete;
    expect(form.entries()).toEqual([]);
  });

  it('a user toggle changes what the form submits, in selection order', async () => {
    const form = await formHarness(
      '<tct-multi-selector label="Columns" name="cols"></tct-multi-selector>',
    );
    const el = form.form.querySelector<TctMultiSelector>('tct-multi-selector')!;
    el.options = FRUIT;
    await el.updateComplete;
    await openByClick(el);
    await userEvent.click(optionsOf(el)[2]!);
    await userEvent.click(optionsOf(el)[0]!);
    await nextFrame();
    expect(form.values('cols')).toEqual(['Orange', 'Apple']);
  });

  it('reset returns to the value attribute; restore brings back the stored values', async () => {
    const form = await formHarness(
      '<tct-multi-selector label="Columns" name="cols" value="Apple"></tct-multi-selector>',
    );
    const el = form.form.querySelector<TctMultiSelector>('tct-multi-selector')!;
    el.options = FRUIT;
    el.values = ['Banana', 'Pear'];
    await el.updateComplete;
    expect(form.values('cols')).toEqual(['Banana', 'Pear']);
    form.reset();
    await el.updateComplete;
    expect(form.values('cols')).toEqual(['Apple']);
    const state = new FormData();
    state.append('value', 'Orange');
    state.append('value', 'Pear');
    el.formStateRestoreCallback(state, 'restore');
    await el.updateComplete;
    expect(form.values('cols')).toEqual(['Orange', 'Pear']);
    el.formStateRestoreCallback('Banana', 'autocomplete');
    await el.updateComplete;
    expect(form.values('cols')).toEqual(['Banana']);
  });

  it('a value that contains whitespace is set through values, and submits whole', async () => {
    const form = await formHarness(
      '<tct-multi-selector label="Columns" name="cols"></tct-multi-selector>',
    );
    const el = form.form.querySelector<TctMultiSelector>('tct-multi-selector')!;
    el.values = ['a b', 'c'];
    await el.updateComplete;
    expect(form.values('cols')).toEqual(['a b', 'c']);
    expect(el.value).toBe('a b c');
  });

  it('required means at least one value; the message shows after a blocked submit', async () => {
    const form = await formHarness(
      '<tct-multi-selector label="Columns" name="cols" required></tct-multi-selector><button type="submit">Go</button>',
    );
    const el = form.form.querySelector<TctMultiSelector>('tct-multi-selector')!;
    el.options = FRUIT;
    await el.updateComplete;
    expect(el.validity.valueMissing).toBe(true);
    await userEvent.click(form.form.querySelector('button')!);
    await nextFrame();
    expect(form.submitEvents).toHaveLength(0);
    expect(trigger(el).getAttribute('aria-invalid')).toBe('true');
    expect(deepActiveElement()).toBe(trigger(el));
    el.values = ['Apple'];
    await el.updateComplete;
    expect(el.validity.valid).toBe(true);
  });

  it('is excluded from the form data when disabled', async () => {
    const form = await formHarness(
      '<tct-multi-selector label="Columns" name="cols" value="Apple" disabled></tct-multi-selector>',
    );
    expect(form.entries()).toEqual([]);
  });
});

describe('tct-multi-selector: the trigger', () => {
  it('shows the localized placeholder until something is chosen', async () => {
    const el = await make();
    expect(part(el, 'placeholder')!.textContent.trim()).toBe('Select…');
    el.placeholder = 'Choose columns';
    await el.updateComplete;
    expect(part(el, 'placeholder')!.textContent.trim()).toBe('Choose columns');
  });

  it('shows a count by default and formats it with formatValue (given values and resolved labels)', async () => {
    const el = await make('label="Columns" value="a c"', [
      {value: 'a', label: 'Alpha'},
      {value: 'b', label: 'Beta'},
      {value: 'c', label: 'Gamma'},
    ]);
    expect(part(el, 'value')!.textContent.trim()).toBe('2 selected');
    let received: unknown;
    el.formatValue = (items) => {
      received = items;
      return `${items.length} of 3`;
    };
    await el.updateComplete;
    expect(part(el, 'value')!.textContent.trim()).toBe('2 of 3');
    expect(received).toEqual([
      {value: 'a', label: 'Alpha'},
      {value: 'c', label: 'Gamma'},
    ]);
  });

  it('never calls formatValue while empty, and ignores it for badges', async () => {
    const el = await make('label="Columns"');
    let calls = 0;
    el.formatValue = () => {
      calls++;
      return 'x';
    };
    await el.updateComplete;
    expect(calls).toBe(0);
    el.values = ['Apple'];
    el.triggerDisplay = 'badges';
    await el.updateComplete;
    expect(calls).toBe(0);
    expect(el.shadowRoot!.querySelectorAll('tct-badge')).toHaveLength(1);
  });

  it('labels display shows the first three and "+N"', async () => {
    const el = await make(
      'label="Columns" trigger-display="labels" value="Apple Banana Orange Pear"',
    );
    expect(part(el, 'value')!.textContent.trim()).toBe('Apple, Banana, Orange, +1');
    el.values = ['Apple', 'Pear'];
    await el.updateComplete;
    expect(part(el, 'value')!.textContent.trim()).toBe('Apple, Pear');
    el.formatValue = (items) => items.map((item) => item.label.toUpperCase()).join('|');
    await el.updateComplete;
    expect(part(el, 'value')!.textContent.trim()).toBe('APPLE|PEAR');
  });

  it('badges display shows up to max-badges and the overflow count', async () => {
    const el = await make(
      'label="Columns" trigger-display="badges" max-badges="2" value="Apple Banana Orange"',
    );
    const badges = [...el.shadowRoot!.querySelectorAll('tct-badge')];
    expect(badges.map((badge) => badge.getAttribute('label'))).toEqual(['Apple', 'Banana']);
    expect(part(el, 'overflow')!.textContent.trim()).toBe('+1');
  });

  it('is a combobox with aria-multiselectable on the list, and shows a status', async () => {
    const el = await make('label="Columns" status-type="error" status-message="Pick one"');
    expect(trigger(el).getAttribute('role')).toBe('combobox');
    expect(trigger(el).getAttribute('aria-invalid')).toBe('true');
    await openByClick(el);
    expect(listboxOf(el)!.getAttribute('aria-multiselectable')).toBe('true');
    if (isChromium) expect((await axNode(trigger(el))).name).toBe('Columns');
  });
});

describe('tct-multi-selector: toggling', () => {
  it('toggles on a click without closing, one input and change per toggle, and marks the row', async () => {
    const el = await make();
    const events = recordEvents(el, ['input', 'change', 'tct-open-change']);
    await openByClick(el);
    await userEvent.click(optionsOf(el)[1]!);
    expect(el.values).toEqual(['Banana']);
    expect(el.open).toBe(true);
    expect(
      events.events.filter((e) => e.type === 'input' || e.type === 'change').map((e) => e.type),
    ).toEqual(['input', 'change']);
    expectEventFlags(events.named('change')[0]!, {bubbles: true, composed: true});
    // The chosen row keeps its place while the list is open: rows sort when it opens, not while it is used.
    expect(optionsOf(el)[1]!.getAttribute('aria-selected')).toBe('true');
    expect(optionsOf(el)[1]!.querySelector('.mark')!.getAttribute('state')).toBe('checked');
    await userEvent.click(optionsOf(el)[1]!);
    expect(el.values).toEqual([]);
  });

  it('keeps the selection order, and does not toggle a disabled option', async () => {
    const el = await make('label="Columns"', GROUPED);
    await openByClick(el);
    await userEvent.click(optionsOf(el)[2]!);
    await userEvent.click(optionsOf(el)[0]!);
    await userEvent.click(optionsOf(el)[3]!, {force: true});
    expect(el.values).toEqual(['Orange', 'apple']);
  });

  it('lists the chosen rows first in their group while open, and restores the order on close', async () => {
    const el = await make('label="Columns" value="Pear"');
    await openByClick(el);
    expect(rowLabels(el)).toEqual(['Pear', 'Apple', 'Banana', 'Orange']);
    await userEvent.click(optionsOf(el)[3]!);
    expect(rowLabels(el)).toEqual(['Pear', 'Apple', 'Banana', 'Orange']);
    await pressKeys('Escape');
    await closed(el);
    await openByClick(el);
    // Chosen rows first, each group in its own original order.
    expect(rowLabels(el)).toEqual(['Orange', 'Pear', 'Apple', 'Banana']);
  });

  it('sorts chosen rows first within each section', async () => {
    const el = await make('label="Columns" value="Lime"', GROUPED);
    await openByClick(el);
    const group = el.shadowRoot!.querySelector('.group')!;
    expect(
      [...group.querySelectorAll('tct-selector-option')].map((option) =>
        option.getAttribute('label'),
      ),
    ).toEqual(['Lime', 'Orange', 'Lemon']);
  });

  it('toggles the right value when chosen rows are sorted to the top', async () => {
    const el = await make('label="Columns" value="Pear"');
    await openByClick(el);
    await userEvent.click(optionsOf(el)[1]!);
    expect(el.values).toEqual(['Pear', 'Apple']);
  });

  it('a click on the box (not the button) toggles the list like the trigger', async () => {
    const el = await make();
    await userEvent.click(part(el, 'input')!.querySelector('.chevron')!);
    await waitUntil(() => el.open, 'opened');
  });

  it('closes on Escape and on Tab, moving focus on', async () => {
    const el = await make();
    el.insertAdjacentHTML('afterend', '<button id="after" type="button">after</button>');
    await openByClick(el);
    await pressKeys('Escape');
    await closed(el);
    expect(deepActiveElement()).toBe(trigger(el));
    await openByClick(el);
    await pressKeys('Tab');
    await closed(el);
    expect(deepActiveElement()?.id).toBe('after');
  });
});

describe('tct-multi-selector: select all', () => {
  const ALL = 'label="Columns" has-select-all';

  it('renders the row first, as an option, with the localized label and a custom one', async () => {
    const el = await make(ALL);
    await openByClick(el);
    const first = optionsOf(el)[0]!;
    expect(first.getAttribute('role')).toBe('option');
    expect(first.hasAttribute('data-select-all')).toBe(true);
    expect(first.textContent.trim()).toBe('Select all');
    el.selectAllLabel = 'Everything';
    await el.updateComplete;
    expect(optionsOf(el)[0]!.textContent.trim()).toBe('Everything');
    expect(el.shadowRoot!.querySelector('.listbox tct-divider.select-all-divider')).toBeNull();
  });

  it('selects every enabled option, and deselects them all when all are chosen; disabled ones keep their state', async () => {
    const el = await make(ALL, ['Apple', 'Banana', {value: 'Fig', disabled: true}, 'Pear']);
    await openByClick(el);
    await userEvent.click(optionsOf(el)[0]!);
    expect(el.values).toEqual(['Apple', 'Banana', 'Pear']);
    expect(optionsOf(el)[0]!.getAttribute('aria-selected')).toBe('true');
    await userEvent.click(optionsOf(el)[0]!);
    expect(el.values).toEqual([]);
    el.values = ['Fig'];
    await el.updateComplete;
    await userEvent.click(optionsOf(el)[0]!);
    expect(el.values).toEqual(['Fig', 'Apple', 'Banana', 'Pear']);
  });

  it('shows the partial state through the name and the indicator, never aria-selected="mixed"', async () => {
    const el = await make(`${ALL} value="Apple"`);
    await openByClick(el);
    const row = optionsOf(el)[0]!;
    expect(row.getAttribute('aria-selected')).toBe('false');
    expect(row.getAttribute('aria-label')).toBe('Select all, partially selected');
    expect(row.querySelector('.mark')!.getAttribute('state')).toBe('indeterminate');
    if (isChromium) expect((await axNode(row)).name).toBe('Select all, partially selected');
    el.values = [];
    await el.updateComplete;
    expect(optionsOf(el)[0]!.hasAttribute('aria-label')).toBe(false);
    expect(optionsOf(el)[0]!.querySelector('.mark')!.getAttribute('state')).toBe('unchecked');
    el.values = [...FRUIT.map(String)];
    await el.updateComplete;
    expect(optionsOf(el)[0]!.querySelector('.mark')!.getAttribute('state')).toBe('checked');
  });

  it('with a search it acts on the options that are shown', async () => {
    const el = await make(`${ALL} has-search`);
    await openByClick(el);
    await userEvent.keyboard('an');
    await el.updateComplete;
    expect(rowLabels(el)).toEqual(['Select all', 'Banana', 'Orange']);
    await userEvent.click(optionsOf(el)[0]!);
    expect(el.values).toEqual(['Banana', 'Orange']);
  });

  it('is toggled from the keyboard and is not offered without options', async () => {
    const el = await make(ALL);
    await openByClick(el);
    await pressKeys('Enter');
    expect(el.values).toEqual([...FRUIT.map(String)]);
    const none = await make(ALL, []);
    await openByClick(none);
    expect(optionsOf(none)).toHaveLength(0);
  });
});

describe('tct-multi-selector: clear and keyboard', () => {
  it('clears everything with the clear button (tct-clear, input, change once) and with Delete or Backspace', async () => {
    const el = await make('label="Columns" has-clear value="Apple Banana"');
    const events = recordEvents(el, ['tct-clear', 'input', 'change']);
    const clear = el.shadowRoot!.querySelector('tct-input-clear-button')!;
    expect(clear.getAttribute('label')).toBe('Clear all Columns');
    await userEvent.click(clear);
    expect(el.values).toEqual([]);
    expect(events.events.map((event) => event.type)).toEqual(['tct-clear', 'input', 'change']);
    for (const key of ['Delete', 'Backspace']) {
      el.values = ['Apple'];
      await el.updateComplete;
      trigger(el).focus();
      await pressKeys(key);
      expect(el.values, key).toEqual([]);
    }
  });

  it('Delete does nothing when nothing is chosen, or without has-clear', async () => {
    const el = await make('label="Columns" has-clear');
    trigger(el).focus();
    const events = recordEvents(el, ['input', 'change']);
    await pressKeys('Delete');
    expect(events.events).toHaveLength(0);
    const plain = await make('label="Columns" value="Apple"');
    trigger(plain).focus();
    await pressKeys('Delete');
    expect(plain.values).toEqual(['Apple']);
  });

  it('does not toggle on the Enter that belongs to an IME composition', async () => {
    const el = await make();
    await openByClick(el);
    await pressKeys('ArrowDown');
    for (const init of [{isComposing: true}, {keyCode: 229}]) {
      trigger(el).dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Enter',
          bubbles: true,
          composed: true,
          cancelable: true,
          ...init,
        }),
      );
    }
    expect(el.values).toEqual([]);
  });
});

runKeyboardSuite({
  tag: 'tct-multi-selector',
  render: () => `<tct-multi-selector label="Columns"></tct-multi-selector>`,
  table: Object.values(
    import.meta.glob<{
      entries: {'core.multi-selector': {keyboard: {keys: string; action: string; when?: string}[]}};
    }>('./parity.json', {eager: true, import: 'default'}),
  )[0]!.entries['core.multi-selector'].keyboard,
  steps: {
    'Opens the list and highlights the first option': {
      setup: async (element) => {
        (element as TctMultiSelector).options = FRUIT;
        await (element as TctMultiSelector).updateComplete;
      },
      focus: (element) => trigger(element),
      keys: ['ArrowDown'],
      rtl: {},
      expect: async ({element}) => {
        const el = element as TctMultiSelector;
        await waitUntil(() => el.open && isShown(el), 'opened');
        await el.updateComplete;
        expect(activeText(trigger(el))).toBe('Apple');
      },
    },
    'Opens the list and highlights the last option': {
      setup: async (element) => {
        (element as TctMultiSelector).options = FRUIT;
        await (element as TctMultiSelector).updateComplete;
      },
      focus: (element) => trigger(element),
      keys: ['ArrowUp'],
      expect: async ({element}) => {
        const el = element as TctMultiSelector;
        await waitUntil(() => el.open && isShown(el), 'opened');
        await el.updateComplete;
        expect(activeText(trigger(el))).toBe('Pear');
      },
    },
    'Moves the highlight to the next or previous enabled option, without wrapping': {
      setup: async (element) => {
        const el = element as TctMultiSelector;
        el.options = FRUIT;
        await el.show();
      },
      focus: (element) => trigger(element),
      keys: ['ArrowDown', 'ArrowDown', 'ArrowUp'],
      rtl: {},
      expect: ({element}) => {
        expect(activeText(trigger(element))).toBe('Apple');
      },
    },
    'Highlights the first or last enabled option': {
      setup: async (element) => {
        const el = element as TctMultiSelector;
        el.options = FRUIT;
        await el.show();
      },
      focus: (element) => trigger(element),
      keys: ['End', 'Home', 'PageDown'],
      expect: ({element}) => {
        expect(activeText(trigger(element))).toBe('Pear');
      },
    },
    'Toggles the highlighted option and keeps the list open': {
      setup: async (element) => {
        const el = element as TctMultiSelector;
        el.options = FRUIT;
        await el.show();
      },
      focus: (element) => trigger(element),
      keys: ['ArrowDown', 'Enter', 'ArrowDown', ' '],
      expect: ({element}) => {
        const el = element as TctMultiSelector;
        expect(el.values).toEqual(['Apple', 'Banana']);
        expect(el.open).toBe(true);
      },
    },
    'Closes the list; focus stays on the trigger': {
      setup: async (element) => {
        const el = element as TctMultiSelector;
        el.options = FRUIT;
        await el.show();
      },
      focus: (element) => trigger(element),
      keys: ['Escape'],
      expect: async ({element}) => {
        const el = element as TctMultiSelector;
        await waitUntil(() => !el.open && !isShown(el), 'closed');
        expect(deepActiveElement()).toBe(trigger(el));
      },
    },
    'Closes the list and moves focus on': {
      setup: async (element) => {
        const el = element as TctMultiSelector;
        el.options = FRUIT;
        el.insertAdjacentHTML('afterend', '<button id="after" type="button">after</button>');
        await el.show();
      },
      focus: (element) => trigger(element),
      keys: ['Tab'],
      expect: async ({element}) => {
        await waitUntil(() => !(element as TctMultiSelector).open, 'closed');
        expect(deepActiveElement()?.id).toBe('after');
      },
    },
    'Opens the list on the option whose label starts with what was typed': {
      setup: async (element) => {
        (element as TctMultiSelector).options = FRUIT;
        await (element as TctMultiSelector).updateComplete;
      },
      focus: (element) => trigger(element),
      keys: ['o'],
      expect: async ({element}) => {
        const el = element as TctMultiSelector;
        await waitUntil(() => el.open && isShown(el), 'opened');
        await el.updateComplete;
        expect(activeText(trigger(el))).toBe('Orange');
      },
    },
    'Clears every value': {
      setup: async (element) => {
        const el = element as TctMultiSelector;
        el.options = FRUIT;
        el.setAttribute('has-clear', '');
        el.values = ['Apple', 'Pear'];
        await el.updateComplete;
      },
      focus: (element) => trigger(element),
      keys: ['Delete'],
      expect: ({element}) => {
        expect((element as TctMultiSelector).values).toEqual([]);
      },
    },
  },
});

describe('tct-multi-selector: search', () => {
  it('filters, keeps group headings above matches and hides empty groups', async () => {
    const el = await make('label="Columns" has-search', GROUPED);
    await openByClick(el);
    await waitUntil(() => deepActiveElement() === searchOf(el), 'search focused');
    await userEvent.keyboard('li');
    await el.updateComplete;
    expect(rowLabels(el)).toEqual(['Lime']);
    expect(
      [...el.shadowRoot!.querySelectorAll('.group-heading')].map((h) => h.textContent.trim()),
    ).toEqual(['Citrus']);
    await userEvent.clear(searchOf(el)!);
    await userEvent.keyboard('app');
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.group')).toBeNull();
    await userEvent.clear(searchOf(el)!);
    await userEvent.keyboard('zzz');
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.message')!.textContent.trim()).toBe('No results found');
  });

  it('the search field is the combobox while open; PageDown and PageUp jump, Home and End move the caret', async () => {
    const el = await make('label="Columns" has-search');
    await openByClick(el);
    const input = searchOf(el)!;
    expect(input.getAttribute('role')).toBe('combobox');
    await userEvent.keyboard('an');
    await pressKeys('PageDown');
    expect(activeText(input)).toBe('Orange');
    await pressKeys('PageUp');
    expect(activeText(input)).toBe('Banana');
    await pressKeys('Home');
    expect(input.selectionStart).toBe(0);
    await pressKeys('Enter');
    expect(el.values).toEqual(['Banana']);
    expect(el.open).toBe(true);
  });

  it('tabs from the search field to the clear button when a query is typed, and leaves without one', async () => {
    const el = await make('label="Columns" has-search');
    el.insertAdjacentHTML('afterend', '<button id="after" type="button">after</button>');
    await openByClick(el);
    await userEvent.keyboard('an');
    await pressKeys('Tab');
    expect(el.open).toBe(true);
    await userEvent.click(el.shadowRoot!.querySelector('.search tct-input-clear-button')!);
    await el.updateComplete;
    expect(searchOf(el)!.value).toBe('');
    await pressKeys('Tab');
    await closed(el);
    expect(deepActiveElement()?.id).toBe('after');
  });
});

describe('tct-multi-selector: announcements', () => {
  const make2 = (attributes: string, options: SelectorOptionType[] = FRUIT) => {
    recorder ??= recordAnnouncements();
    return make(attributes, options);
  };

  it('says the count once per toggle, "All selected" when everything is chosen and "Selection cleared" when none', async () => {
    const el = await make2('label="Columns"', ['Apple', 'Banana']);
    await openByClick(el);
    await userEvent.click(optionsOf(el)[0]!);
    expect(recorder!.messages()).toEqual(['1 of 2 selected']);
    await userEvent.click(optionsOf(el)[1]!);
    expect(recorder!.messages()).toEqual(['1 of 2 selected', 'All selected']);
    await userEvent.click(optionsOf(el)[0]!);
    await userEvent.click(optionsOf(el)[1]!);
    expect(recorder!.messages().slice(2)).toEqual(['1 of 2 selected', 'Selection cleared']);
  });

  it('select all says "All selected" once, and clear says "Selection cleared" once', async () => {
    const el = await make2('label="Columns" has-select-all has-clear');
    await openByClick(el);
    await userEvent.click(optionsOf(el)[0]!);
    expect(recorder!.messages()).toEqual(['All selected']);
    await userEvent.click(el.shadowRoot!.querySelector('tct-input-clear-button')!);
    expect(recorder!.messages()).toEqual(['All selected', 'Selection cleared']);
  });

  it('says the match count once per query change, and says nothing on a plain property write', async () => {
    const el = await make2('label="Columns" has-search');
    await openByClick(el);
    await userEvent.keyboard('an');
    await el.updateComplete;
    expect(recorder!.messages()).toEqual(['4 results', '2 results']);
    el.values = ['Apple'];
    await el.updateComplete;
    expect(recorder!.messages()).toEqual(['4 results', '2 results']);
  });

  it('says the empty state once when opened with no options, and the loading and error states once', async () => {
    const el = await make2('label="Columns" empty-text="Nothing here"', []);
    await openByClick(el);
    await el.updateComplete;
    expect(recorder!.messages()).toEqual(['Nothing here']);
    el.emptyText = '';
    el.optionsState = 'loading';
    await el.updateComplete;
    expect(recorder!.messages()).toEqual(['Nothing here', 'Loading options']);
    el.optionsState = 'error';
    await el.updateComplete;
    expect(recorder!.messages()).toEqual([
      'Nothing here',
      'Loading options',
      'Options could not be loaded',
    ]);
  });
});

describe('tct-multi-selector: disabled, read-only, loading and change action', () => {
  it('a read-only selector keeps its values, blocks the popup and every change path', async () => {
    const el = await make('label="Columns" readonly has-clear value="Apple"');
    const button = trigger(el);
    expect(button.getAttribute('aria-readonly')).toBe('true');
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(el.shadowRoot!.querySelector('tct-input-clear-button')).toBeNull();
    await userEvent.click(button);
    await pressKeys('ArrowDown', 'Enter', 'Delete', 'b');
    await nextFrame();
    expect(el.open).toBe(false);
    expect(el.values).toEqual(['Apple']);
  });

  it('disabled-message keeps the trigger focusable and blocks activation', async () => {
    const el = await make('label="Columns" disabled disabled-message="Select a table first"');
    expect(trigger(el).getAttribute('aria-disabled')).toBe('true');
    trigger(el).focus();
    await pressKeys('Enter', 'ArrowDown');
    await nextFrame();
    expect(el.open).toBe(false);
  });

  it('loading shows the spinner and aria-busy and keeps the options selectable', async () => {
    const el = await make('label="Columns" loading');
    expect(trigger(el).getAttribute('aria-busy')).toBe('true');
    await openByClick(el);
    await userEvent.click(optionsOf(el)[0]!);
    expect(el.values).toEqual(['Apple']);
  });

  it('a change action keeps the new values while pending and restores them when it rejects', async () => {
    const el = await make('label="Columns" value="Apple"');
    el.changeAction = () => Promise.reject(new Error('nope'));
    await openByClick(el);
    await userEvent.click(optionsOf(el)[2]!);
    await waitUntil(() => el.values.length === 1 && el.values[0] === 'Apple', 'reverted');
    expect(trigger(el).getAttribute('aria-busy')).toBeNull();
    let seen: string[] = [];
    el.changeAction = (values) => {
      seen = values;
    };
    await userEvent.click(optionsOf(el)[1]!);
    expect(seen).toEqual(['Apple', 'Banana']);
  });
});

describe('tct-multi-selector: presentation and accessibility', () => {
  it('stays open while toggling in the bottom sheet, and Escape closes it', async () => {
    stub = stubCompactTouch(true);
    const el = await make('label="Columns" presentation="adaptive"');
    await userEvent.click(el.shadowRoot!.querySelector('.input-wrapper')!);
    const sheet = () =>
      el.shadowRoot!.querySelector<HTMLElement & {open: boolean}>('tct-bottom-sheet')!;
    await waitUntil(() => sheet()?.open === true, 'sheet open');
    await waitUntil(() => optionsOf(el).length === 4, 'rows');
    await animationsFinished(sheet());
    await userEvent.click(optionsOf(el)[0]!);
    await userEvent.click(optionsOf(el)[1]!);
    expect(el.values).toEqual(['Apple', 'Banana']);
    expect(el.open).toBe(true);
    await pressKeys('Escape');
    await waitUntil(() => !el.open, 'closed');
    await waitUntil(() => deepActiveElement() === trigger(el), 'focus returned');
  });

  it('passes axe closed, open with select all and a partial state, and in a status', async () => {
    const el = await make(
      'label="Columns" has-select-all value="Apple" description="Pick columns"',
    );
    await expectAccessible(el);
    await openByClick(el);
    await expectAccessible(el);
    const status = await make(
      'label="Columns" status-type="warning" status-message="Careful"',
      GROUPED,
    );
    await expectAccessible(status);
  });

  it('draws the chosen state of every row with more than colour: the checkbox and aria-selected', async () => {
    const el = await make('label="Columns" value="Banana Pear"');
    await openByClick(el);
    expect(checked(el)).toEqual(['Banana', 'Pear']);
    if (isChromium) {
      const node = await axNode(optionsOf(el)[1]!);
      expect(node.selected).toBe('true');
    }
  });
});

runOverlaySuite({
  tag: 'tct-multi-selector',
  render: ({attributes = '', children = ''}) =>
    `<tct-multi-selector label="Columns" ${attributes}>${children}</tct-multi-selector><div style="block-size:320px"></div>`,
  trigger: (el) => trigger(el),
  surface: (el) => el.shadowRoot!.querySelector<HTMLElement>('.surface'),
  open: async (el) => {
    (el as unknown as TctMultiSelector).options = FRUIT;
    await (el as unknown as TctMultiSelector).show();
  },
  close: async (el) => {
    await (el as unknown as TctMultiSelector).hide();
  },
});

void layerOf;
