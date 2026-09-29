/**
 * tct-selector keyboard contract (WAI-ARIA APG select-only combobox): the parity.json keyboard table as
 * steps, then typeahead, search mode, IME safety and the highlight (`aria-activedescendant`). Ported from
 * upstream Selector.test.tsx (keyboard accessibility, typeahead, hasSearch).
 */
import {userEvent} from 'vitest/browser';
import {describe, expect, it} from 'vitest';
import {deepActiveElement} from '@tecton-wc/core/utils/focus.js';
import {recordEvents} from '@tecton-wc/testing/events.js';
import {pressKeys} from '@tecton-wc/testing/keyboard.js';
import {runKeyboardSuite} from '@tecton-wc/testing/suites/keyboard.js';
import {aTimeout, nextFrame, waitUntil} from '@tecton-wc/testing/timing.js';
import '../input-group/define.js';
import './define.js';
import type {SelectorOptionType} from './selector.types.js';
import type {TctSelector} from './tct-selector.js';
import {
  FRUIT,
  GROUPED,
  activeOption,
  activeText,
  closed,
  isShown,
  listboxOf,
  mountSelect,
  openByClick,
  optionsOf,
  searchOf,
  trigger,
} from './fixtures/selector-test-helpers.js';

const parity = Object.values(
  import.meta.glob<{
    entries: {'core.selector': {keyboard: {keys: string; action: string; when?: string}[]}};
  }>('./parity.json', {eager: true, import: 'default'}),
)[0]!;

const make = (attributes = 'label="Fruit"', options: SelectorOptionType[] = FRUIT) =>
  mountSelect<TctSelector>('tct-selector', attributes, options);

/** The element as the keyboard suite hands it over: options set, ready to focus. */
async function prepared(
  element: HTMLElement,
  attributes: Record<string, string | boolean> = {},
  options: SelectorOptionType[] = FRUIT,
): Promise<TctSelector> {
  const el = element as TctSelector;
  el.options = options;
  for (const [name, value] of Object.entries(attributes)) {
    if (value === true) el.setAttribute(name, '');
    else if (value !== false) el.setAttribute(name, value);
  }
  await el.updateComplete;
  await nextFrame();
  return el;
}

const shownOpen = async (el: TctSelector): Promise<void> => {
  await waitUntil(() => el.open && isShown(el), 'opened');
  await el.updateComplete;
};

runKeyboardSuite({
  tag: 'tct-selector',
  render: () => `<tct-selector label="Fruit"></tct-selector>`,
  table: parity.entries['core.selector'].keyboard,
  steps: {
    'Opens the list and highlights the chosen option (the first when nothing is chosen)': {
      setup: (element) => prepared(element, {value: 'Orange'}).then(() => undefined),
      focus: (element) => trigger(element),
      keys: ['ArrowDown'],
      rtl: {},
      expect: async ({element}) => {
        await shownOpen(element as TctSelector);
        expect(activeText(trigger(element))).toBe('Orange');
      },
    },
    'Opens the list and highlights the chosen option (the last when nothing is chosen)': {
      setup: (element) => prepared(element).then(() => undefined),
      focus: (element) => trigger(element),
      keys: ['ArrowUp'],
      rtl: {},
      expect: async ({element}) => {
        await shownOpen(element as TctSelector);
        expect(activeText(trigger(element))).toBe('Pear');
      },
    },
    'Moves the highlight to the next or previous enabled option, without wrapping': {
      setup: async (element) => {
        const el = await prepared(element, {value: 'Apple'}, GROUPED);
        await el.show();
      },
      focus: (element) => trigger(element),
      keys: ['ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowUp'],
      rtl: {},
      expect: ({element}) => {
        // Apple → Banana → Orange → (Lemon is disabled) Lime → stays on Lime → back to Orange.
        expect(activeText(trigger(element))).toBe('Orange');
      },
    },
    'Highlights the first or last enabled option': {
      setup: async (element) => {
        const el = await prepared(element, {}, GROUPED);
        await el.show();
      },
      focus: (element) => trigger(element),
      keys: ['End', 'Home', 'End'],
      expect: ({element}) => {
        expect(activeText(trigger(element))).toBe('Lime');
      },
    },
    'Chooses the highlighted option and closes the list': {
      setup: async (element) => {
        const el = await prepared(element);
        await el.show();
      },
      focus: (element) => trigger(element),
      keys: ['ArrowDown', 'ArrowDown', 'Enter'],
      expect: async ({element}) => {
        const el = element as TctSelector;
        await waitUntil(() => !el.open, 'closed');
        expect(el.value).toBe('Banana');
      },
    },
    'Closes the list; focus stays on the trigger': {
      setup: async (element) => {
        const el = await prepared(element);
        await el.show();
      },
      focus: (element) => trigger(element),
      keys: ['Escape'],
      expect: async ({element}) => {
        const el = element as TctSelector;
        await waitUntil(() => !el.open && !isShown(el), 'closed');
        expect(deepActiveElement()).toBe(trigger(el));
      },
    },
    'Closes the list and moves focus on': {
      setup: async (element) => {
        const el = await prepared(element);
        el.insertAdjacentHTML('afterend', '<button id="after" type="button">after</button>');
        await el.show();
      },
      focus: (element) => trigger(element),
      keys: ['Tab'],
      expect: async ({element}) => {
        const el = element as TctSelector;
        await waitUntil(() => !el.open, 'closed');
        expect(deepActiveElement()?.id).toBe('after');
      },
    },
    'Chooses the option whose label starts with what was typed, without opening; repeating a letter cycles':
      {
        setup: (element) =>
          prepared(element, {}, ['Apple', 'Avocado', 'Banana']).then(() => undefined),
        focus: (element) => trigger(element),
        keys: ['a', 'a'],
        expect: ({element}) => {
          const el = element as TctSelector;
          expect(el.value).toBe('Avocado');
          expect(el.open).toBe(false);
        },
      },
    'Moves the highlight to the next matching option; nothing is chosen until Enter': {
      setup: async (element) => {
        const el = await prepared(element, {}, ['Apple', 'Avocado', 'Banana']);
        await el.show();
      },
      focus: (element) => trigger(element),
      keys: ['b'],
      expect: ({element}) => {
        const el = element as TctSelector;
        expect(activeText(trigger(el))).toBe('Banana');
        expect(el.value).toBe('');
      },
    },
    'Clears the value': {
      setup: (element) =>
        prepared(element, {'has-clear': true, value: 'Apple'}).then(() => undefined),
      focus: (element) => trigger(element),
      keys: ['Delete'],
      expect: ({element}) => {
        expect((element as TctSelector).value).toBe('');
      },
    },
    'Opens the list and puts the typed text into the search field': {
      setup: (element) => prepared(element, {'has-search': true}).then(() => undefined),
      focus: (element) => trigger(element),
      keys: ['o', 'r'],
      expect: async ({element}) => {
        const el = element as TctSelector;
        await shownOpen(el);
        await waitUntil(() => searchOf(el)?.value === 'or', 'query seeded');
        expect(optionsOf(el)).toHaveLength(1);
      },
    },
    'Moves from the search field to the clear button and keeps the list open': {
      setup: async (element) => {
        const el = await prepared(element, {'has-search': true});
        await el.show();
        await waitUntil(() => searchOf(el) !== null, 'search rendered');
        await userEvent.type(searchOf(el)!, 'an');
      },
      focus: (element) => searchOf(element),
      keys: ['Tab'],
      expect: async ({element}) => {
        const el = element as TctSelector;
        await nextFrame();
        expect(el.open).toBe(true);
        const clear = el.shadowRoot!.querySelector('.search tct-input-clear-button')!;
        expect(deepActiveElement()!.getRootNode()).toBe(clear.shadowRoot);
      },
    },
  },
  waive: {},
});

describe('tct-selector: the highlight (aria-activedescendant)', () => {
  it('opening by click highlights the chosen option; the highlight is exposed on the trigger, not as DOM focus', async () => {
    const el = await make('label="Fruit" value="Orange"');
    await openByClick(el);
    expect(activeText(trigger(el))).toBe('Orange');
    expect(optionsOf(el)[2]!.hasAttribute('data-highlighted')).toBe(true);
    expect(deepActiveElement()).toBe(trigger(el));
  });

  it('opening with nothing chosen highlights the first option', async () => {
    const el = await make();
    await openByClick(el);
    expect(activeText(trigger(el))).toBe('Apple');
  });

  it('End and Home jump to the last and first option', async () => {
    const el = await make();
    await openByClick(el);
    await pressKeys('End');
    expect(activeOption(trigger(el))).toBe(optionsOf(el).at(-1));
    await pressKeys('Home');
    expect(activeOption(trigger(el))).toBe(optionsOf(el)[0]);
  });

  it('PageDown and PageUp jump to the last and first option too', async () => {
    const el = await make();
    await openByClick(el);
    await pressKeys('PageDown');
    expect(activeText(trigger(el))).toBe('Pear');
    await pressKeys('PageUp');
    expect(activeText(trigger(el))).toBe('Apple');
  });

  it('skips disabled options with the arrows and cannot highlight them by pointer', async () => {
    const el = await make('label="Fruit"', GROUPED);
    await openByClick(el);
    await pressKeys('End');
    await pressKeys('ArrowUp');
    // Lemon is disabled: the arrow steps over it.
    expect(activeText(trigger(el))).toBe('Orange');
    await userEvent.hover(optionsOf(el)[3]!, {force: true});
    expect(activeText(trigger(el))).toBe('Orange');
  });

  it('a pointer highlight follows the pointer and never scrolls the list', async () => {
    const many = Array.from({length: 40}, (_, index) => `Option ${index + 1}`);
    const el = await make('label="Fruit"', many);
    await openByClick(el);
    const list = listboxOf(el)!;
    const before = list.scrollTop;
    await userEvent.hover(optionsOf(el)[3]!);
    expect(activeText(trigger(el))).toBe('Option 4');
    expect(list.scrollTop).toBe(before);
  });

  it('a keyboard highlight scrolls the option into view', async () => {
    const many = Array.from({length: 40}, (_, index) => `Option ${index + 1}`);
    const el = await make('label="Fruit"', many);
    await openByClick(el);
    await pressKeys('End');
    await nextFrame();
    expect(listboxOf(el)!.scrollTop).toBeGreaterThan(0);
    const box = optionsOf(el).at(-1)!.getBoundingClientRect();
    const list = listboxOf(el)!.getBoundingClientRect();
    expect(box.bottom).toBeLessThanOrEqual(list.bottom + 1);
  });

  it('clears the highlight and the reference when the list closes', async () => {
    const el = await make('label="Fruit" value="Apple"');
    await openByClick(el);
    await pressKeys('Escape');
    await closed(el);
    expect(activeOption(trigger(el))).toBeNull();
    expect(el.shadowRoot!.querySelector('[data-highlighted]')).toBeNull();
  });
});

describe('tct-selector: typeahead', () => {
  const TYPE = ['Apple', 'Avocado', 'Banana', 'Blueberry', 'Cherry'];

  it('selects the matching option by typing on the closed trigger, and announces nothing else', async () => {
    const el = await make('label="Fruit"', TYPE);
    const events = recordEvents(el, ['input', 'change']);
    trigger(el).focus();
    await pressKeys('b');
    expect(el.value).toBe('Banana');
    expect(el.open).toBe(false);
    expect(events.events.map((event) => event.type)).toEqual(['input', 'change']);
  });

  it('cycles through options sharing a first letter on repeated presses', async () => {
    const el = await make('label="Fruit"', TYPE);
    trigger(el).focus();
    await pressKeys('b');
    expect(el.value).toBe('Banana');
    await pressKeys('b');
    expect(el.value).toBe('Blueberry');
    await pressKeys('b');
    expect(el.value).toBe('Banana');
  });

  it('advances past the current selection on a fresh single-letter press', async () => {
    const el = await make('label="Fruit" value="Apple"', TYPE);
    trigger(el).focus();
    await pressKeys('a');
    expect(el.value).toBe('Avocado');
  });

  it('accumulates a multi-character prefix and resets it after the pause', async () => {
    const el = await make('label="Fruit"', TYPE);
    trigger(el).focus();
    await pressKeys('b', 'l');
    expect(el.value).toBe('Blueberry');
    await aTimeout(900);
    // The buffer is fresh again: "a" searches on from the chosen Blueberry and wraps to Apple.
    await pressKeys('a');
    expect(el.value).toBe('Apple');
  });

  it('treats a space mid-buffer as part of the match, not as opening', async () => {
    const el = await make('label="City"', ['New Delhi', 'New York', 'Newark']);
    trigger(el).focus();
    await pressKeys('n', 'e', 'w', ' ', 'y');
    expect(el.value).toBe('New York');
    expect(el.open).toBe(false);
  });

  it('lets a lone Space open the list after an abandoned typeahead', async () => {
    const el = await make('label="Fruit"', TYPE);
    trigger(el).focus();
    await pressKeys('z');
    await aTimeout(900);
    await pressKeys(' ');
    await waitUntil(() => el.open, 'opened');
  });

  it('skips disabled options and ignores keys with Ctrl or Meta', async () => {
    const el = await make('label="Fruit"', [{value: 'Banana', disabled: true}, 'Blueberry']);
    trigger(el).focus();
    await pressKeys('b');
    expect(el.value).toBe('Blueberry');
    const other = await make('label="Fruit"', TYPE);
    trigger(other).focus();
    await pressKeys('Control+b', 'Meta+b');
    expect(other.value).toBe('');
  });

  it('matches across sections, ignoring dividers and group titles', async () => {
    const el = await make('label="Fruit"', GROUPED);
    trigger(el).focus();
    await pressKeys('l', 'i', 'm');
    expect(el.value).toBe('Lime');
  });

  it('matches on the label, not the description, and commits the value', async () => {
    const el = await make('label="Fruit"', [
      {value: 'x-1', label: 'Alpha', description: 'Zulu'},
      {value: 'x-2', label: 'Zebra'},
    ]);
    trigger(el).focus();
    await pressKeys('z');
    expect(el.value).toBe('x-2');
  });

  it('does not fire change when the only match is already chosen', async () => {
    const el = await make('label="Fruit" value="Cherry"', TYPE);
    const events = recordEvents(el, ['input', 'change']);
    trigger(el).focus();
    await pressKeys('c');
    expect(events.events).toHaveLength(0);
  });

  it('with the list open, moves the highlight without committing, and Enter commits it', async () => {
    const el = await make('label="Fruit"', TYPE);
    await openByClick(el);
    await pressKeys('c');
    expect(activeText(trigger(el))).toBe('Cherry');
    expect(el.value).toBe('');
    await pressKeys('Enter');
    await closed(el);
    expect(el.value).toBe('Cherry');
  });

  it('starts a fresh buffer after choosing from the open list', async () => {
    const el = await make('label="Fruit"', TYPE);
    await openByClick(el);
    await pressKeys('b');
    await pressKeys('Enter');
    await closed(el);
    trigger(el).focus();
    await pressKeys('a');
    expect(el.value).toBe('Apple');
  });

  it('does not select while the selector is focusable-disabled or read-only', async () => {
    const disabled = await make('label="Fruit" disabled disabled-message="Not now"', TYPE);
    trigger(disabled).focus();
    await pressKeys('b');
    expect(disabled.value).toBe('');
    const readonly = await make('label="Fruit" readonly value="Apple"', TYPE);
    trigger(readonly).focus();
    await pressKeys('b');
    expect(readonly.value).toBe('Apple');
  });
});

describe('tct-selector: search', () => {
  const SEARCH = 'label="Fruit" has-search';

  it('renders a search field that is the combobox while open, and the trigger is a plain popup button', async () => {
    const el = await make(SEARCH);
    expect(trigger(el).hasAttribute('role')).toBe(false);
    expect(trigger(el).getAttribute('aria-haspopup')).toBe('listbox');
    await openByClick(el);
    await waitUntil(() => deepActiveElement() === searchOf(el), 'search focused');
    const input = searchOf(el)!;
    expect(input.getAttribute('role')).toBe('combobox');
    expect(input.getAttribute('aria-autocomplete')).toBe('list');
    expect(input.getAttribute('aria-controls')).toBe(listboxOf(el)!.id);
    expect(input.getAttribute('aria-expanded')).toBe('true');
    expect(input.getAttribute('aria-label')).toBe('Search options');
  });

  it('filters the options by the query, case-insensitively', async () => {
    const el = await make(SEARCH);
    await openByClick(el);
    await userEvent.keyboard('AN');
    await el.updateComplete;
    expect(
      optionsOf(el).map((option) =>
        option.querySelector('tct-selector-option')!.getAttribute('label'),
      ),
    ).toEqual(['Banana', 'Orange']);
  });

  it('shows the empty-search message and no options when nothing matches', async () => {
    const el = await make(SEARCH);
    await openByClick(el);
    await userEvent.keyboard('zzz');
    await el.updateComplete;
    expect(optionsOf(el)).toHaveLength(0);
    const message = el.shadowRoot!.querySelector('.message')!;
    expect(message.getAttribute('role')).toBe('presentation');
    expect(message.textContent.trim()).toBe('No results found');
    el.emptySearchText = 'Nothing here';
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.message')!.textContent.trim()).toBe('Nothing here');
  });

  it('the arrows move the highlight in the search field and Enter chooses; focus returns to the trigger', async () => {
    const el = await make(SEARCH);
    await openByClick(el);
    await userEvent.keyboard('a');
    await pressKeys('ArrowDown', 'ArrowDown');
    expect(activeText(searchOf(el)!)).toBe('Banana');
    await pressKeys('Enter');
    await closed(el);
    expect(el.value).toBe('Banana');
    await waitUntil(() => deepActiveElement() === trigger(el), 'focus back on the trigger');
  });

  it('Home and End move the caret; PageDown and PageUp jump the highlight', async () => {
    const el = await make(SEARCH);
    await openByClick(el);
    await userEvent.keyboard('an');
    await pressKeys('Home');
    expect(searchOf(el)!.selectionStart).toBe(0);
    expect(activeOption(searchOf(el)!)).toBeNull();
    await pressKeys('PageDown');
    expect(activeText(searchOf(el)!)).toBe('Orange');
    await pressKeys('PageUp');
    expect(activeText(searchOf(el)!)).toBe('Banana');
  });

  it('Space types into the search field instead of choosing', async () => {
    const el = await make(SEARCH, ['New Delhi', 'New York', 'Paris']);
    await openByClick(el);
    await userEvent.keyboard('new y');
    await el.updateComplete;
    expect(searchOf(el)!.value).toBe('new y');
    expect(optionsOf(el)).toHaveLength(1);
  });

  it('Escape closes and returns focus to the trigger; the query is forgotten', async () => {
    const el = await make(SEARCH);
    await openByClick(el);
    await userEvent.keyboard('an');
    await pressKeys('Escape');
    await closed(el);
    await waitUntil(() => deepActiveElement() === trigger(el), 'focus returned');
    await openByClick(el);
    expect(searchOf(el)!.value).toBe('');
    expect(optionsOf(el)).toHaveLength(4);
  });

  it('Tab closes the list without preventing the focus move when there is no query', async () => {
    const el = await make(SEARCH, FRUIT);
    el.insertAdjacentHTML('afterend', '<button id="after" type="button">after</button>');
    await openByClick(el);
    await pressKeys('Tab');
    await closed(el);
    expect(deepActiveElement()?.id).toBe('after');
  });

  it('with a query Tab goes to the clear button and keeps the list open; a second Tab leaves', async () => {
    const el = await make(SEARCH, FRUIT);
    el.insertAdjacentHTML('afterend', '<button id="after" type="button">after</button>');
    await openByClick(el);
    await userEvent.keyboard('an');
    await pressKeys('Tab');
    await nextFrame();
    expect(el.open).toBe(true);
    const clear = el.shadowRoot!.querySelector('.search tct-input-clear-button')!;
    expect(deepActiveElement()!.getRootNode()).toBe(clear.shadowRoot);
    await pressKeys('Tab');
    await closed(el);
    expect(deepActiveElement()?.id).toBe('after');
  });

  it('the clear button empties the query, keeps the list open and returns focus to the search field', async () => {
    const el = await make(SEARCH);
    await openByClick(el);
    await userEvent.keyboard('an');
    await userEvent.click(el.shadowRoot!.querySelector('.search tct-input-clear-button')!);
    await el.updateComplete;
    expect(searchOf(el)!.value).toBe('');
    expect(optionsOf(el)).toHaveLength(4);
    expect(deepActiveElement()).toBe(searchOf(el));
    expect(el.open).toBe(true);
  });

  it('keeps the group heading above matching options and hides a group with none', async () => {
    const el = await make(SEARCH, GROUPED);
    await openByClick(el);
    await userEvent.keyboard('li');
    await el.updateComplete;
    const headings = [...el.shadowRoot!.querySelectorAll('.group-heading')].map((h) =>
      h.textContent.trim(),
    );
    expect(headings).toEqual(['Citrus']);
    expect(el.shadowRoot!.querySelector('.option-divider')).toBeNull();
    await userEvent.clear(searchOf(el)!);
    await userEvent.keyboard('app');
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.group')).toBeNull();
  });

  it('lands the keyboard on the right option after filtering', async () => {
    const el = await make(SEARCH, GROUPED);
    await openByClick(el);
    await userEvent.keyboard('li');
    await pressKeys('ArrowDown');
    expect(activeText(searchOf(el)!)).toBe('Lime');
  });

  it('does not choose on the Enter or Escape that belongs to an IME composition', async () => {
    const el = await make(SEARCH);
    await openByClick(el);
    await userEvent.keyboard('a');
    await pressKeys('ArrowDown');
    const input = searchOf(el)!;
    for (const init of [{isComposing: true}, {keyCode: 229}]) {
      input.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Enter',
          bubbles: true,
          composed: true,
          cancelable: true,
          ...init,
        }),
      );
      input.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Escape',
          bubbles: true,
          composed: true,
          cancelable: true,
          ...init,
        }),
      );
    }
    await nextFrame();
    expect(el.value).toBe('');
    expect(el.open).toBe(true);
  });

  it('a composing key on the closed trigger opens and chooses nothing', async () => {
    const el = await make('label="Fruit"');
    const button = trigger(el);
    button.focus();
    button.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
        composed: true,
        cancelable: true,
        isComposing: true,
      }),
    );
    await nextFrame();
    expect(el.open).toBe(false);
  });

  it('does not treat printable keys as search seeds while open with focus in the list', async () => {
    const el = await make(SEARCH);
    await openByClick(el);
    await userEvent.keyboard('o');
    await el.updateComplete;
    expect(searchOf(el)!.value).toBe('o');
  });
});
