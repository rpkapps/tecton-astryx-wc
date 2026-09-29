/**
 * tct-base-typeahead: the combobox engine every field of the family shares. The element suite, then the
 * APG combobox contract (roles, expanded, controls, active descendant), keyboard, search scheduling
 * (debounce, minimum length, focus bootstrap), stale-response rejection, cancellation, result
 * announcements, IME, focus-out and outside dismissal, intent events, grouping and custom rows. Ported
 * from upstream BaseTypeahead.test.tsx and Typeahead.test.tsx where the behaviour applies.
 */
import {html} from 'lit';
import {userEvent} from 'vitest/browser';
import {describe, expect, it, vi} from 'vitest';
import {deepActiveElement} from '@tecton-wc/core/utils/focus.js';
import {axActiveDescendant, axNode, expectAccessible} from '@tecton-wc/testing/a11y.js';
import {recordEvents} from '@tecton-wc/testing/events.js';
import {fixture} from '@tecton-wc/testing/fixture.js';
import {pressKeys} from '@tecton-wc/testing/keyboard.js';
import {runElementSuite} from '@tecton-wc/testing/suites/element.js';
import {isChromium, isTier2} from '@tecton-wc/testing/tier.js';
import {nextFrame, waitUntil} from '@tecton-wc/testing/timing.js';
import '../button/define.js';
import '../popover/define.js';
import '../tooltip/define.js';
import './define.js';
import {createStaticSource} from './create-static-source.js';
import type {TctBaseTypeahead} from './tct-base-typeahead.js';
import {
  activeDescendantId,
  activeOption,
  comboboxOf,
  controlledSource,
  FRUITS,
  optionLabels,
  optionsOf,
  spyAnnouncements,
  textOf,
  typeInto,
  whenOpen,
} from './typeahead-test-helpers.js';
import type {SearchableItem} from './typeahead.types.js';

async function make(attributes = 'aria-label="Fruit" debounce-ms="0"'): Promise<TctBaseTypeahead> {
  const wrapper = await fixture<HTMLElement>(
    `<div style="padding:24px 24px 240px;inline-size:360px"><tct-base-typeahead ${attributes}></tct-base-typeahead><button type="button">after</button></div>`,
  );
  const element = wrapper.querySelector<TctBaseTypeahead>('tct-base-typeahead')!;
  element.searchSource = createStaticSource(FRUITS);
  await element.updateComplete;
  return element;
}

runElementSuite({
  tag: 'tct-base-typeahead',
  render: () => html`<tct-base-typeahead aria-label="Fruit"></tct-base-typeahead>`,
  properties: {
    placeholder: 'Find fruit',
    entriesOnFocus: true,
    maxMenuItems: 3,
    menuWidth: 300,
    minQueryLength: 2,
    emptySearchResultsText: 'Nothing',
    disabled: true,
    focusableDisabled: true,
    debounceMs: 20,
    size: 'lg',
    inputId: 'custom',
    inputTabIndex: -1,
    item: {id: 'x', label: 'X'},
  },
  attributes: {
    placeholder: 'placeholder',
    maxMenuItems: 'max-menu-items',
    debounceMs: 'debounce-ms',
    minQueryLength: 'min-query-length',
  },
  events: ['tct-selection-change', 'tct-open-change', 'tct-after-open-change'],
});

describe('tct-base-typeahead: combobox semantics (APG editable combobox, list autocomplete)', () => {
  it('renders a combobox input that is collapsed and busy-free at rest, with a localised placeholder', async () => {
    const element = await make();
    const input = comboboxOf(element);
    expect(input.getAttribute('role')).toBe('combobox');
    expect(input.getAttribute('aria-expanded')).toBe('false');
    expect(input.getAttribute('aria-autocomplete')).toBe('list');
    expect(input.hasAttribute('aria-busy')).toBe(false);
    expect(input.placeholder).toBe('Search…');
    expect(input.autocomplete).toBe('off');
    if (isChromium) {
      expect(await axNode(input)).toMatchObject({
        role: 'combobox',
        name: 'Fruit',
        expanded: 'false',
      });
    }
  });

  it('an empty placeholder attribute shows no placeholder; the property wins over the default', async () => {
    const element = await make('aria-label="Fruit" placeholder=""');
    expect(comboboxOf(element).placeholder).toBe('');
    element.placeholder = 'Find fruit';
    await element.updateComplete;
    expect(comboboxOf(element).placeholder).toBe('Find fruit');
  });

  it('typing opens a listbox in the same root, expands the input and points it at the first option', async () => {
    const element = await make();
    await typeInto(element, 'a');
    await whenOpen(element);
    const input = comboboxOf(element);
    expect(input.getAttribute('aria-expanded')).toBe('true');
    const listbox = element.shadowRoot!.getElementById(input.getAttribute('aria-controls')!);
    expect(listbox?.getAttribute('role')).toBe('listbox');
    expect(listbox?.getAttribute('aria-label')).toBe('Search results');
    expect(optionLabels(element)).toEqual(['Apple', 'Apricot', 'Banana']);
    expect(textOf(activeOption(element))).toBe('Apple');
    expect(activeOption(element)?.hasAttribute('data-highlighted')).toBe(true);
    if (isChromium) {
      expect(await axNode(input)).toMatchObject({role: 'combobox', expanded: 'true'});
      expect(await axActiveDescendant(input, optionsOf(element))).toBe(activeOption(element));
    }
  });

  it('DOM focus stays on the input while the highlight moves', async () => {
    const element = await make();
    await typeInto(element, 'a');
    await whenOpen(element);
    await pressKeys('ArrowDown', 'ArrowDown');
    expect(element.shadowRoot!.activeElement).toBe(comboboxOf(element));
    expect(textOf(activeOption(element))).toBe('Banana');
  });

  it('every option carries aria-selected; the chosen item is marked and checked', async () => {
    const element = await make();
    element.item = FRUITS[2]!;
    await typeInto(element, 'a');
    await whenOpen(element);
    const selected = optionsOf(element).filter((o) => o.getAttribute('aria-selected') === 'true');
    expect(selected.map((o) => textOf(o))).toEqual(['Banana']);
    expect(selected[0]!.querySelector('.option-check')).not.toBeNull();
    expect(optionsOf(element).every((o) => o.hasAttribute('aria-selected'))).toBe(true);
  });

  it('a completed empty search shows one disabled option and no active descendant', async () => {
    const element = await make();
    await typeInto(element, 'zzz');
    await waitUntil(() => element.open && optionsOf(element).length === 1, 'the empty state opens');
    const [empty] = optionsOf(element);
    expect(textOf(empty)).toBe('No results found');
    expect(empty!.getAttribute('aria-disabled')).toBe('true');
    expect(activeDescendantId(comboboxOf(element))).toBeNull();
    await pressKeys('Enter');
    expect(element.item).toBeNull();
  });

  it('emptySearchResultsText replaces the default message', async () => {
    const element = await make(
      'aria-label="Fruit" debounce-ms="0" empty-search-results-text="Nothing here"',
    );
    await typeInto(element, 'zzz');
    await waitUntil(() => optionsOf(element).length === 1, 'the empty state opens');
    expect(textOf(optionsOf(element)[0])).toBe('Nothing here');
  });

  it('the host aria-label and aria-labelledby name the input', async () => {
    const wrapper = await fixture<HTMLElement>(
      `<div><span id="lbl">Choose a fruit</span><tct-base-typeahead aria-labelledby="lbl"></tct-base-typeahead></div>`,
    );
    const element = wrapper.querySelector<TctBaseTypeahead>('tct-base-typeahead')!;
    await element.updateComplete;
    if (isChromium) expect((await axNode(comboboxOf(element))).name).toBe('Choose a fruit');
  });

  it('the input id and tab index attributes reach the input', async () => {
    const element = await make('aria-label="Fruit" input-id="mine" input-tab-index="-1"');
    expect(comboboxOf(element).id).toBe('mine');
    expect(comboboxOf(element).tabIndex).toBe(-1);
  });
});

describe('tct-base-typeahead: keyboard (upstream Typeahead keyboard, APG)', () => {
  it('ArrowDown and ArrowUp move the highlight and wrap', async () => {
    const element = await make();
    await typeInto(element, 'a');
    await whenOpen(element);
    await pressKeys('ArrowUp');
    expect(textOf(activeOption(element))).toBe('Banana');
    await pressKeys('ArrowDown');
    expect(textOf(activeOption(element))).toBe('Apple');
    await pressKeys('ArrowDown');
    expect(textOf(activeOption(element))).toBe('Apricot');
  });

  it('Home and End move to the first and last option while the list is open', async () => {
    const element = await make();
    await typeInto(element, 'a');
    await whenOpen(element);
    await pressKeys('End');
    expect(textOf(activeOption(element))).toBe('Banana');
    await pressKeys('Home');
    expect(textOf(activeOption(element))).toBe('Apple');
  });

  it('Enter chooses the highlighted option: item set, query cleared, popup closed, focus kept', async () => {
    const element = await make();
    const events = recordEvents(element, ['tct-selection-change', 'input', 'change']);
    await typeInto(element, 'a');
    await whenOpen(element);
    events.events.length = 0;
    await pressKeys('ArrowDown', 'Enter');
    expect(element.item?.id).toBe('apricot');
    expect(comboboxOf(element).value).toBe('');
    expect(element.query).toBe('');
    await waitUntil(() => !element.open, 'the popup closes');
    expect(comboboxOf(element).getAttribute('aria-expanded')).toBe('false');
    expect(deepActiveElement()).toBe(comboboxOf(element));
    expect(events.counts()).toEqual({'tct-selection-change': 1, input: 1, change: 1});
  });

  it('Enter with the popup closed does nothing (the form may submit)', async () => {
    const element = await make();
    await userEvent.click(comboboxOf(element));
    await pressKeys('Enter');
    expect(element.item).toBeNull();
  });

  it('Escape closes the popup, and ArrowDown opens it again on the same query', async () => {
    const element = await make();
    await typeInto(element, 'b');
    await whenOpen(element);
    await pressKeys('Escape');
    await waitUntil(() => !element.open, 'Escape closes the popup');
    expect(comboboxOf(element).getAttribute('aria-expanded')).toBe('false');
    expect(activeDescendantId(comboboxOf(element))).toBeNull();
    await pressKeys('ArrowDown');
    await whenOpen(element);
    expect(textOf(activeOption(element))).toBe('Banana');
  });

  it('Tab closes the popup on keydown and moves focus on to the next control', async () => {
    const element = await make();
    await typeInto(element, 'a');
    await whenOpen(element);
    await pressKeys('Tab');
    expect(deepActiveElement()?.textContent).toBe('after');
    await waitUntil(() => !element.open, 'Tab closes the popup');
  });

  it('a click on an option chooses it and keeps the input focused', async () => {
    const element = await make();
    await typeInto(element, 'b');
    await whenOpen(element);
    await userEvent.click(optionsOf(element)[1]!);
    expect(element.item?.id).toBe('blueberry');
    expect(deepActiveElement()).toBe(comboboxOf(element));
  });

  it('hovering an option highlights it without scrolling; the keyboard still scrolls (upstream #6077)', async () => {
    const element = await make('aria-label="Fruit" debounce-ms="0" max-menu-items="50"');
    element.searchSource = createStaticSource(
      Array.from({length: 40}, (_, i) => ({id: `f${i}`, label: `Fruit ${i}`})),
    );
    await typeInto(element, 'f');
    await whenOpen(element);
    const listbox = element.shadowRoot!.querySelector<HTMLElement>('[role="listbox"]')!;
    expect(listbox.scrollTop).toBe(0);
    await userEvent.hover(optionsOf(element)[3]!);
    await waitUntil(() => textOf(activeOption(element)) === 'Fruit 3', 'hover highlights');
    expect(listbox.scrollTop).toBe(0);
    await pressKeys('End');
    await nextFrame();
    expect(listbox.scrollTop).toBeGreaterThan(0);
  });

  it('RTL: the popup lays out on the inline start edge of the field', async () => {
    const wrapper = await fixture<HTMLElement>(
      `<div dir="rtl" style="padding:24px 24px 240px;inline-size:360px"><tct-base-typeahead aria-label="فاكهة" debounce-ms="0"></tct-base-typeahead></div>`,
      {lang: 'ar-SA'},
    );
    const element = wrapper.querySelector<TctBaseTypeahead>('tct-base-typeahead')!;
    element.searchSource = createStaticSource(FRUITS);
    await element.updateComplete;
    // The Arabic catalog loads after the first render; the input is located by its placeholder.
    await waitUntil(
      () => comboboxOf(element).placeholder !== 'Search…',
      'the Arabic catalog loaded',
    );
    await typeInto(element, 'a');
    await whenOpen(element);
    await waitUntil(
      () => element.shadowRoot!.querySelector('.popup')!.getBoundingClientRect().width > 0,
      'the popup is laid out',
    );
    const popup = element.shadowRoot!.querySelector<HTMLElement>('.popup')!.getBoundingClientRect();
    const input = comboboxOf(element).getBoundingClientRect();
    expect(Math.abs(popup.right - input.right)).toBeLessThan(2);
    expect(element.shadowRoot!.querySelector('.empty')?.textContent ?? '').not.toContain(
      'No results',
    );
  });
});

describe('tct-base-typeahead: search scheduling', () => {
  it('searches only from the minimum length and keeps the menu closed below it', async () => {
    const element = await make('aria-label="Fruit" debounce-ms="0" min-query-length="3"');
    const search = vi.spyOn(element.searchSource!, 'search');
    await typeInto(element, 'ap');
    await nextFrame();
    expect(search).not.toHaveBeenCalled();
    expect(element.open).toBe(false);
    await userEvent.keyboard('p');
    await whenOpen(element);
    expect(search).toHaveBeenCalledTimes(1);
    expect(search).toHaveBeenCalledWith('app');
    // Falling back below the threshold drops the results and closes the menu again.
    await userEvent.keyboard('{Backspace}');
    await waitUntil(() => !element.open, 'the menu closes below the threshold');
  });

  it('counts the minimum length in graphemes: one emoji is one character', async () => {
    const element = await make('aria-label="Fruit" debounce-ms="0" min-query-length="2"');
    const search = vi.spyOn(element.searchSource!, 'search');
    const input = comboboxOf(element);
    await userEvent.click(input);
    await userEvent.fill(input, '👨‍👩‍👧');
    await nextFrame();
    expect(search).not.toHaveBeenCalled();
    await userEvent.fill(input, '👨‍👩‍👧a');
    await waitUntil(() => search.mock.calls.length === 1, 'searched at two graphemes');
  });

  it('does not fall back to bootstrap on ArrowDown below the threshold', async () => {
    const element = await make(
      'aria-label="Fruit" debounce-ms="0" min-query-length="3" entries-on-focus',
    );
    const bootstrap = vi.spyOn(element.searchSource!, 'bootstrap');
    await typeInto(element, 'a');
    await waitUntil(() => bootstrap.mock.calls.length >= 1, 'bootstrap on focus');
    bootstrap.mockClear();
    await pressKeys('Escape', 'ArrowDown');
    await nextFrame();
    expect(bootstrap).not.toHaveBeenCalled();
  });

  it('entries-on-focus shows the bootstrap results before anything is typed, on keyboard focus too', async () => {
    const element = await make('aria-label="Fruit" debounce-ms="0" entries-on-focus');
    element.focus();
    await whenOpen(element);
    expect(optionLabels(element)).toHaveLength(5);
    await pressKeys('Escape');
    await waitUntil(() => !element.open, 'closed');
    // Re-focusing re-shows the cached results.
    comboboxOf(element).blur();
    element.focus();
    await whenOpen(element);
  });

  it('caps the results at max-menu-items', async () => {
    const element = await make('aria-label="Fruit" debounce-ms="0" max-menu-items="2"');
    await typeInto(element, 'a');
    await whenOpen(element);
    expect(optionLabels(element)).toHaveLength(2);
  });

  it('debounces: several keystrokes make one search of the whole query', async () => {
    const element = await make('aria-label="Fruit" debounce-ms="250"');
    const control = controlledSource();
    element.searchSource = control.source;
    // Three edits in one task: how long real keystrokes take must not decide whether they fall inside the delay.
    const input = comboboxOf(element);
    input.focus();
    for (const value of ['a', 'ab', 'abc']) {
      input.value = value;
      input.dispatchEvent(
        new InputEvent('input', {
          bubbles: true,
          composed: true,
          data: value.at(-1) ?? null,
          inputType: 'insertText',
        }),
      );
    }
    expect(control.calls, 'nothing is searched inside the delay').toHaveLength(0);
    await waitUntil(() => control.calls.length >= 1, 'the search runs once the typing paused');
    control.calls[0]!.resolve([FRUITS[0]!]);
    await whenOpen(element);
    expect(control.calls.map((call) => call.query)).toEqual(['abc']);
  });

  it('debounce-ms=0 searches on every keystroke', async () => {
    const element = await make('aria-label="Fruit" debounce-ms="0"');
    const control = controlledSource();
    element.searchSource = control.source;
    await typeInto(element, 'ab');
    await waitUntil(() => control.calls.length === 2, 'one search per keystroke');
    expect(control.calls.map((call) => call.query)).toEqual(['a', 'ab']);
  });
});

describe('tct-base-typeahead: stale results never win, and work is cancelled', () => {
  it('a response that arrives after a newer query is discarded (out-of-order async results)', async () => {
    const element = await make();
    const control = controlledSource();
    element.searchSource = control.source;
    await typeInto(element, 'a');
    await waitUntil(() => control.calls.length === 1, 'first search');
    await userEvent.keyboard('b');
    await waitUntil(() => control.calls.length === 2, 'second search');
    // The newer query answers first, the older one afterwards.
    control.calls[1]!.resolve([{id: 'ab', label: 'Newer result'}]);
    await whenOpen(element);
    expect(optionLabels(element)).toEqual(['Newer result']);
    control.calls[0]!.resolve([{id: 'a', label: 'Older result'}]);
    await nextFrame();
    await nextFrame();
    expect(optionLabels(element)).toEqual(['Newer result']);
    expect(element.open).toBe(true);
  });

  it('an older response arriving while the newer one is still pending shows nothing', async () => {
    const element = await make();
    const control = controlledSource();
    element.searchSource = control.source;
    await typeInto(element, 'a');
    await waitUntil(() => control.calls.length === 1, 'first search');
    await userEvent.keyboard('b');
    await waitUntil(() => control.calls.length === 2, 'second search');
    control.calls[0]!.resolve([{id: 'a', label: 'Older result'}]);
    await nextFrame();
    await nextFrame();
    expect(element.open).toBe(false);
    expect(optionLabels(element)).toEqual([]);
    expect(comboboxOf(element).getAttribute('aria-busy')).toBe('true');
    control.calls[1]!.resolve([{id: 'ab', label: 'Newer result'}]);
    await whenOpen(element);
    expect(optionLabels(element)).toEqual(['Newer result']);
    await waitUntil(() => !comboboxOf(element).hasAttribute('aria-busy'), 'busy clears');
  });

  it('a response for a query the user has since cleared does not reopen the menu', async () => {
    const element = await make();
    const control = controlledSource();
    element.searchSource = control.source;
    await typeInto(element, 'a');
    await waitUntil(() => control.calls.length === 1, 'search');
    await userEvent.keyboard('{Backspace}');
    await waitUntil(
      () => !comboboxOf(element).hasAttribute('aria-busy'),
      'busy cleared by the empty field',
    );
    control.calls[0]!.resolve([FRUITS[0]!]);
    await nextFrame();
    await nextFrame();
    expect(element.open).toBe(false);
  });

  it('a response from a source that was replaced in flight is dropped', async () => {
    const element = await make();
    const first = controlledSource();
    element.searchSource = first.source;
    await typeInto(element, 'a');
    await waitUntil(() => first.calls.length === 1, 'search on the first source');
    const second = controlledSource();
    element.searchSource = second.source;
    await element.updateComplete;
    expect(first.cancel).toHaveBeenCalled();
    first.calls[0]!.resolve([{id: 'old', label: 'From the old source'}]);
    await nextFrame();
    await nextFrame();
    expect(element.open).toBe(false);
  });

  it('calls source.cancel() when a new search supersedes the previous one and when the menu closes', async () => {
    const element = await make();
    const control = controlledSource();
    element.searchSource = control.source;
    await typeInto(element, 'a');
    await waitUntil(() => control.calls.length === 1, 'search');
    const before = control.cancel.mock.calls.length;
    await userEvent.keyboard('b');
    await waitUntil(() => control.calls.length === 2, 'second search');
    expect(control.cancel.mock.calls.length).toBeGreaterThan(before);
    control.calls[1]!.resolve([FRUITS[0]!]);
    await whenOpen(element);
    const beforeClose = control.cancel.mock.calls.length;
    await pressKeys('Escape');
    await waitUntil(() => !element.open, 'closed');
    expect(control.cancel.mock.calls.length).toBeGreaterThan(beforeClose);
  });

  it('choosing a result invalidates a search still in flight', async () => {
    const element = await make();
    const control = controlledSource();
    element.searchSource = control.source;
    await typeInto(element, 'a');
    await waitUntil(() => control.calls.length === 1, 'search');
    control.calls[0]!.resolve([FRUITS[0]!, FRUITS[1]!]);
    await whenOpen(element);
    await userEvent.keyboard('p');
    await waitUntil(() => control.calls.length === 2, 'second search pending');
    await pressKeys('Enter');
    expect(element.item?.id).toBe('apple');
    control.calls[1]!.resolve([FRUITS[2]!]);
    await nextFrame();
    await nextFrame();
    expect(element.open).toBe(false);
    expect(comboboxOf(element).hasAttribute('aria-busy')).toBe(false);
  });

  it('a rejected search clears the results without opening a menu', async () => {
    const element = await make();
    const control = controlledSource();
    element.searchSource = control.source;
    await typeInto(element, 'a');
    await waitUntil(() => control.calls.length === 1, 'search');
    control.calls[0]!.reject(new Error('network'));
    await waitUntil(() => !comboboxOf(element).hasAttribute('aria-busy'), 'busy clears');
    expect(optionLabels(element)).toEqual([]);
  });

  it('shows aria-busy and a named spinner while a search is pending', async () => {
    const element = await make();
    const control = controlledSource();
    element.searchSource = control.source;
    await typeInto(element, 'a');
    await waitUntil(() => control.calls.length === 1, 'search');
    await element.updateComplete;
    expect(comboboxOf(element).getAttribute('aria-busy')).toBe('true');
    const spinner = element.shadowRoot!.querySelector('tct-spinner');
    expect(spinner?.getAttribute('aria-label')).toBe('Loading');
    control.calls[0]!.resolve([]);
    await waitUntil(() => !element.shadowRoot!.querySelector('tct-spinner'), 'the spinner goes');
  });
});

describe('tct-base-typeahead: announcements', () => {
  it('announces the result count once per menu, not once per keystroke', async () => {
    const spy = spyAnnouncements();
    try {
      const element = await make();
      await typeInto(element, 'bl');
      await whenOpen(element);
      await waitUntil(() => spy.messages.at(-1) === '1 result', 'the final count is announced');
      const spoken = [...spy.messages];
      expect(spoken.every((message, i) => i === 0 || message !== spoken[i - 1])).toBe(true);
      // The same count for a longer query: nothing more is said.
      await userEvent.keyboard('u');
      await waitUntil(() => textOf(optionsOf(element)[0]) === 'Blueberry', 'still one result');
      await nextFrame();
      await nextFrame();
      expect(spy.messages).toEqual(spoken);
      // A changed count is announced.
      await userEvent.keyboard('{Backspace}{Backspace}');
      await waitUntil(() => spy.messages.length > spoken.length, 'a changed count is announced');
      expect(spy.messages.at(-1)).toBe('2 results');
    } finally {
      spy.restore();
    }
  });

  it('announces "no results" and the singular count, in the resolved language', async () => {
    const spy = spyAnnouncements();
    try {
      const element = await make();
      await typeInto(element, 'zzz');
      await waitUntil(() => spy.messages.length === 1, 'the empty message is announced');
      expect(spy.messages[0]).toBe('No results found');
      await userEvent.keyboard('{Backspace}{Backspace}{Backspace}bl');
      await waitUntil(() => spy.messages.length >= 2, 'the singular count is announced');
      expect(spy.messages.at(-1)).toBe('1 result');
    } finally {
      spy.restore();
    }
  });

  it('does not announce the focus-open bootstrap results', async () => {
    const spy = spyAnnouncements();
    try {
      const element = await make('aria-label="Fruit" debounce-ms="0" entries-on-focus');
      element.focus();
      await whenOpen(element);
      await nextFrame();
      expect(spy.messages).toEqual([]);
    } finally {
      spy.restore();
    }
  });
});

describe('tct-base-typeahead: IME', () => {
  const composingEnter = (init: KeyboardEventInit & {keyCode?: number}): KeyboardEvent =>
    new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      composed: true,
      cancelable: true,
      ...init,
    });

  it('does not choose the highlighted result on a composing Enter (isComposing)', async () => {
    const element = await make();
    await typeInto(element, 'a');
    await whenOpen(element);
    const event = composingEnter({isComposing: true});
    comboboxOf(element).dispatchEvent(event);
    expect(element.item).toBeNull();
    expect(element.open).toBe(true);
    expect(event.defaultPrevented).toBe(false);
  });

  it('does not choose on the Safari confirming Enter (keyCode 229) either, and does clear nothing', async () => {
    const element = await make();
    await typeInto(element, 'a');
    await whenOpen(element);
    comboboxOf(element).dispatchEvent(composingEnter({keyCode: 229}));
    expect(element.item).toBeNull();
    expect(comboboxOf(element).value).toBe('a');
    // The next real Enter chooses exactly once.
    await pressKeys('Enter');
    expect(element.item?.id).toBe('apple');
  });

  it('a composing arrow key does not move the highlight and a composing Escape does not close', async () => {
    const element = await make();
    await typeInto(element, 'a');
    await whenOpen(element);
    const before = activeOption(element);
    comboboxOf(element).dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'ArrowDown',
        isComposing: true,
        bubbles: true,
        composed: true,
        cancelable: true,
      }),
    );
    expect(activeOption(element)).toBe(before);
    comboboxOf(element).dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Escape',
        isComposing: true,
        bubbles: true,
        composed: true,
        cancelable: true,
      }),
    );
    expect(element.open).toBe(true);
  });
});

describe('tct-base-typeahead: dismissal', () => {
  it('closes when focus leaves the field for another control', async () => {
    const element = await make();
    await typeInto(element, 'a');
    await whenOpen(element);
    element.parentElement!.querySelector<HTMLElement>('button')!.focus();
    await waitUntil(() => !element.open, 'focus-out closes the popup');
  });

  it('closes on a press outside, and a press on the input itself keeps it open', async () => {
    const element = await make();
    await typeInto(element, 'a');
    await whenOpen(element);
    await userEvent.click(comboboxOf(element));
    expect(element.open).toBe(true);
    await userEvent.click(document.body);
    await waitUntil(() => !element.open, 'an outside press closes the popup');
  });

  it('a press on the popup does not blur the input', async () => {
    const element = await make();
    await typeInto(element, 'a');
    await whenOpen(element);
    const popup = element.shadowRoot!.querySelector<HTMLElement>('.popup')!;
    const down = new MouseEvent('mousedown', {bubbles: true, cancelable: true, composed: true});
    popup.dispatchEvent(down);
    expect(down.defaultPrevented).toBe(true);
  });

  it('Escape closes the popup before an enclosing popover layer (one layer per press)', async () => {
    const wrapper = await fixture<HTMLElement>(
      `<tct-popover label="Filters" open><tct-button label="Filters"></tct-button><div slot="content"><tct-base-typeahead aria-label="Fruit" debounce-ms="0"></tct-base-typeahead></div></tct-popover>`,
    );
    const element = wrapper.querySelector<TctBaseTypeahead>('tct-base-typeahead')!;
    element.searchSource = createStaticSource(FRUITS);
    await element.updateComplete;
    await typeInto(element, 'a');
    await whenOpen(element);
    await pressKeys('Escape');
    await waitUntil(() => !element.open, 'the first Escape closes only the results');
    expect((wrapper as unknown as {open: boolean}).open).toBe(true);
    await pressKeys('Escape');
    await waitUntil(
      () => !(wrapper as unknown as {open: boolean}).open,
      'the second Escape closes the popover',
    );
  });
});

describe('tct-base-typeahead: events', () => {
  it('tct-selection-change fires before the change; preventing it keeps the item, the query and the popup', async () => {
    const element = await make();
    element.addEventListener('tct-selection-change', (event) => event.preventDefault());
    const events = recordEvents(element, ['tct-selection-change', 'input', 'change']);
    await typeInto(element, 'a');
    await whenOpen(element);
    events.events.length = 0;
    await pressKeys('Enter');
    expect(events.counts()).toEqual({'tct-selection-change': 1, input: 0, change: 0});
    expect(element.item).toBeNull();
    expect(comboboxOf(element).value).toBe('a');
    expect(element.open).toBe(true);
    const detail = events.events[0] as unknown as {
      action: string;
      item: SearchableItem;
      items: SearchableItem[];
      reason: string;
    };
    expect([detail.action, detail.item.id, detail.items.length, detail.reason]).toEqual([
      'select',
      'apple',
      1,
      'keyboard',
    ]);
  });

  it('tct-selection-change is cancelable, bubbles and composes', async () => {
    const element = await make();
    const events = recordEvents(element, 'tct-selection-change');
    await typeInto(element, 'a');
    await whenOpen(element);
    await pressKeys('Enter');
    const [event] = events.events;
    expect([event!.bubbles, event!.composed, event!.cancelable]).toEqual([true, true, true]);
  });

  it('tct-open-change is cancelable: preventing the open keeps the popup closed; a close fires once with its reason', async () => {
    const element = await make();
    const prevent = (event: Event): void => event.preventDefault();
    element.addEventListener('tct-open-change', prevent);
    await typeInto(element, 'a');
    await waitUntil(() => comboboxOf(element).getAttribute('aria-busy') === null, 'search settled');
    await nextFrame();
    expect(element.open).toBe(false);
    element.removeEventListener('tct-open-change', prevent);
    await userEvent.keyboard('{Backspace}a');
    const events = recordEvents(element, ['tct-open-change', 'tct-after-open-change']);
    await whenOpen(element);
    // The opening settles (after-open-change) after the animation: wait for it, so it is not mistaken for the close.
    await waitUntil(
      () => events.named('tct-after-open-change').length === 1,
      'the opening settles',
    );
    expect(events.named('tct-after-open-change')[0]).toMatchObject({open: true});
    await pressKeys('Escape');
    await waitUntil(() => events.named('tct-after-open-change').length === 2, 'the close settles');
    // The opening's intent event fired before recording started: the close fires exactly one.
    expect(events.named('tct-open-change').map((event) => event.open)).toEqual([false]);
    expect(events.named('tct-open-change')[0]).toMatchObject({open: false, reason: 'escape'});
    expect(events.named('tct-after-open-change')[1]).toMatchObject({open: false});
  });

  it('typing fires the native input event (composed); no change fires until a choice', async () => {
    const element = await make();
    const events = recordEvents(element, ['input', 'change']);
    await typeInto(element, 'ab');
    expect(events.named('input')).toHaveLength(2);
    expect(events.named('input')[0]!.composed).toBe(true);
    expect(events.named('change')).toHaveLength(0);
    expect(element.query).toBe('ab');
  });
});

describe('tct-base-typeahead: results and rows', () => {
  it('groups results under headings by auxiliaryData.group; ungrouped rows come first', async () => {
    const element = await make();
    element.searchSource = createStaticSource([
      {id: '1', label: 'Alpha', auxiliaryData: {group: 'Greek'}},
      {id: '2', label: 'Beta', auxiliaryData: {group: 'Greek'}},
      {id: '3', label: 'Apple'},
    ]);
    await typeInto(element, 'a');
    await whenOpen(element);
    const groups = [...element.shadowRoot!.querySelectorAll('[role="group"]')];
    expect(groups.map((g) => g.getAttribute('aria-label'))).toEqual(['Greek']);
    expect(groups[0]!.querySelectorAll('[role="option"]')).toHaveLength(2);
    // Indexing is flat: ArrowDown walks the ungrouped row, then the group.
    expect(textOf(activeOption(element))).toBe('Apple');
    await pressKeys('ArrowDown');
    expect(textOf(activeOption(element))).toBe('Alpha');
  });

  it('renderItem replaces the default row content (a template, a node or text); item.element wins over both', async () => {
    const element = await make();
    element.renderItem = (item) => html`<strong class="mine">${item.label.toUpperCase()}</strong>`;
    element.searchSource = createStaticSource([
      {id: '1', label: 'Alpha'},
      {id: '2', label: 'Beta', element: 'Pre-rendered Beta'},
    ]);
    await typeInto(element, 'a');
    await whenOpen(element);
    const [alpha, beta] = optionsOf(element);
    expect(alpha!.querySelector('.mine')?.textContent).toBe('ALPHA');
    expect(textOf(beta)).toBe('Pre-rendered Beta');
    expect(beta!.querySelector('.mine')).toBeNull();
    // The default is tct-typeahead-item.
    element.renderItem = undefined;
    await element.updateComplete;
    expect(alpha!.querySelector('tct-typeahead-item')).not.toBeNull();
  });

  it('a popup width in px is honoured, and the popup is never narrower than the input', async () => {
    const element = await make('aria-label="Fruit" debounce-ms="0" menu-width="200"');
    await typeInto(element, 'a');
    await whenOpen(element);
    await waitUntil(
      () => element.shadowRoot!.querySelector('.popup')!.getBoundingClientRect().width > 0,
      'laid out',
    );
    const popup = element.shadowRoot!.querySelector<HTMLElement>('.popup')!;
    expect(Math.round(popup.getBoundingClientRect().width)).toBeGreaterThanOrEqual(
      Math.round(comboboxOf(element).getBoundingClientRect().width),
    );
  });

  it('the popup stays inside a 320px viewport even when a wider menu width is requested', async () => {
    const wrapper = await fixture<HTMLElement>(
      `<div style="inline-size:320px;padding:8px 8px 240px"><tct-base-typeahead aria-label="Fruit" debounce-ms="0" menu-width="900"></tct-base-typeahead></div>`,
    );
    const element = wrapper.querySelector<TctBaseTypeahead>('tct-base-typeahead')!;
    element.searchSource = createStaticSource(FRUITS);
    await element.updateComplete;
    await typeInto(element, 'a');
    await whenOpen(element);
    await waitUntil(
      () => element.shadowRoot!.querySelector('.popup')!.getBoundingClientRect().width > 0,
      'laid out',
    );
    const rect = element.shadowRoot!.querySelector<HTMLElement>('.popup')!.getBoundingClientRect();
    expect(rect.width).toBeLessThanOrEqual(document.documentElement.clientWidth);
    expect(rect.right).toBeLessThanOrEqual(document.documentElement.clientWidth + 1);
  });
});

describe('tct-base-typeahead: disabled', () => {
  it('a disabled input is natively disabled and never opens', async () => {
    const element = await make('aria-label="Fruit" debounce-ms="0" disabled');
    expect(comboboxOf(element).disabled).toBe(true);
    expect(element.open).toBe(false);
  });

  it('focusable-disabled keeps the input focusable through aria-disabled and read-only, and blocks typing and choosing', async () => {
    const element = await make('aria-label="Fruit" debounce-ms="0" disabled focusable-disabled');
    const input = comboboxOf(element);
    expect(input.disabled).toBe(false);
    expect(input.getAttribute('aria-disabled')).toBe('true');
    expect(input.readOnly).toBe(true);
    // aria-disabled makes the browser's own click helper treat it as not enabled: focus it as a keyboard user would.
    input.focus();
    expect(deepActiveElement()).toBe(input);
    await userEvent.keyboard('a');
    expect(input.value).toBe('');
    expect(element.open).toBe(false);
  });

  it('becoming disabled while open closes the popup and clears the active descendant', async () => {
    const element = await make();
    await typeInto(element, 'a');
    await whenOpen(element);
    element.disabled = true;
    await waitUntil(() => !element.open, 'the popup closes');
    expect(activeDescendantId(comboboxOf(element))).toBeNull();
  });
});

describe('tct-base-typeahead: accessibility', () => {
  it('passes axe closed, with results open and for the empty state', async () => {
    const element = await make();
    await expectAccessible(element);
    await typeInto(element, 'a');
    await whenOpen(element);
    await waitUntil(
      () => element.shadowRoot!.querySelector('.typeahead-layer')!.getAnimations().length === 0,
      'the entry animation ends',
    );
    await expectAccessible(element);
    await userEvent.keyboard('zz');
    await waitUntil(() => optionsOf(element).length === 1, 'the empty state');
    await expectAccessible(element);
  });

  it.skipIf(isTier2)(
    'the highlighted option is exposed as :state(highlighted) on library rows only; plain rows get data-highlighted',
    async () => {
      const element = await make();
      await typeInto(element, 'a');
      await whenOpen(element);
      expect(activeOption(element)?.hasAttribute('data-highlighted')).toBe(true);
    },
  );
});
