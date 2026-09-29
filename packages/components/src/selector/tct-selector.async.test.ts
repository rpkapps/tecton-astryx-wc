/**
 * tct-selector async option-source states and announcements: loading, empty and error are said exactly
 * once per arrival (`ariaNotify` is stubbed so every spoken message is one call), the count of search
 * matches once per query, a typeahead choice once. Options that are given stay selectable while the
 * value is `loading` or the source is (AST-001 DEC-1).
 */
import {afterEach, describe, expect, it} from 'vitest';
import {userEvent} from 'vitest/browser';
import {pressKeys} from '@tecton-wc/testing/keyboard.js';
import {aTimeout, nextFrame, waitUntil} from '@tecton-wc/testing/timing.js';
import './define.js';
import type {SelectorOptionType} from './selector.types.js';
import type {TctSelector} from './tct-selector.js';
import {
  FRUIT,
  closed,
  listboxOf,
  mountSelect,
  openByClick,
  optionsOf,
  recordAnnouncements,
  trigger,
} from './fixtures/selector-test-helpers.js';

let recorder: ReturnType<typeof recordAnnouncements> | undefined;
afterEach(() => {
  recorder?.restore();
  recorder = undefined;
});

const make = (attributes = 'label="Fruit"', options: SelectorOptionType[] = FRUIT) => {
  recorder ??= recordAnnouncements();
  return mountSelect<TctSelector>('tct-selector', attributes, options);
};

const message = (el: TctSelector): HTMLElement | null =>
  el.shadowRoot!.querySelector<HTMLElement>('.message');

/** Lets pending updates and announcement calls settle without waiting a fixed time for nothing. */
const settle = async (el: TctSelector): Promise<void> => {
  await el.updateComplete;
  await nextFrame();
  await el.updateComplete;
};

describe('tct-selector: the empty panel', () => {
  it('says "No options" once when opened with none, and draws it as a presentation message', async () => {
    const el = await make('label="Fruit"', []);
    await openByClick(el);
    await settle(el);
    expect(message(el)!.textContent.trim()).toBe('No options');
    expect(message(el)!.getAttribute('role')).toBe('presentation');
    expect(recorder!.messages()).toEqual(['No options']);
    // Nothing more is said for unrelated updates: hover, a resize, a property write.
    el.label = 'Fruit basket';
    await settle(el);
    await userEvent.hover(message(el)!);
    await settle(el);
    expect(recorder!.messages()).toEqual(['No options']);
  });

  it('keeps the empty listbox out of the accessibility tree', async () => {
    const el = await make('label="Fruit"', []);
    await openByClick(el);
    expect(listboxOf(el)!.hasAttribute('hidden')).toBe(true);
    expect(optionsOf(el)).toHaveLength(0);
  });

  it('says it again on the next open, once, and announces a custom text verbatim', async () => {
    const el = await make('label="Fruit" empty-text="Nothing to pick yet"', []);
    await openByClick(el);
    await settle(el);
    await pressKeys('Escape');
    await closed(el);
    await openByClick(el);
    await settle(el);
    expect(recorder!.messages()).toEqual(['Nothing to pick yet', 'Nothing to pick yet']);
  });

  it('announces nothing when the panel has options', async () => {
    const el = await make();
    await openByClick(el);
    await settle(el);
    expect(recorder!.messages()).toEqual([]);
  });
});

describe('tct-selector: loading and error option sources', () => {
  it('says loading once while the options are on their way, and the empty state once when they land empty', async () => {
    const el = await make('label="Fruit" options-state="loading"', []);
    await openByClick(el);
    await settle(el);
    expect(message(el)!.textContent.trim()).toBe('Loading options');
    expect(recorder!.messages()).toEqual(['Loading options']);
    // The source completes with nothing: the new outcome is said once.
    el.optionsState = 'ready';
    await settle(el);
    expect(message(el)!.textContent.trim()).toBe('No options');
    expect(recorder!.messages()).toEqual(['Loading options', 'No options']);
    // Settling again does not repeat it.
    el.requestUpdate();
    await settle(el);
    expect(recorder!.messages()).toEqual(['Loading options', 'No options']);
  });

  it('a fetch that lands with options replaces the message and says nothing more', async () => {
    const el = await make('label="Fruit" options-state="loading"', []);
    await openByClick(el);
    await settle(el);
    el.options = FRUIT;
    el.optionsState = 'ready';
    await settle(el);
    expect(message(el)).toBeNull();
    expect(optionsOf(el)).toHaveLength(4);
    expect(recorder!.messages()).toEqual(['Loading options']);
  });

  it('says the error once, with a custom text verbatim, and the trigger keeps its name and value', async () => {
    const el = await make('label="Fruit" options-state="error" value="Apple"', []);
    await openByClick(el);
    await settle(el);
    expect(message(el)!.textContent.trim()).toBe('Options could not be loaded');
    expect(recorder!.messages()).toEqual(['Options could not be loaded']);
    el.errorText = 'The service is down';
    await settle(el);
    expect(message(el)!.textContent.trim()).toBe('The service is down');
    expect(recorder!.messages()).toEqual(['Options could not be loaded', 'The service is down']);
    expect(trigger(el).getAttribute('aria-expanded')).toBe('true');
    expect(el.value).toBe('Apple');
  });

  it('a state that is on screen while closed is said when the list opens, not before', async () => {
    const el = await make('label="Fruit" options-state="error"', []);
    await settle(el);
    expect(recorder!.messages()).toEqual([]);
    await openByClick(el);
    await settle(el);
    expect(recorder!.messages()).toEqual(['Options could not be loaded']);
  });

  it('provided options stay selectable in every state, and the value loading does not hide them', async () => {
    for (const attributes of [
      'label="Fruit" options-state="loading"',
      'label="Fruit" options-state="error"',
      'label="Fruit" loading',
    ]) {
      const el = await make(attributes);
      await openByClick(el);
      expect(optionsOf(el), attributes).toHaveLength(4);
      expect(message(el), attributes).toBeNull();
      await userEvent.click(optionsOf(el)[1]!);
      expect(el.value, attributes).toBe('Banana');
    }
    await settle(await make());
    expect(recorder!.messages()).toEqual([]);
  });

  it('value loading is separate from the option source: empty options and loading still say the empty state', async () => {
    const el = await make('label="Fruit" loading', []);
    await openByClick(el);
    await settle(el);
    expect(recorder!.messages()).toEqual(['No options']);
    expect(trigger(el).getAttribute('aria-busy')).toBe('true');
  });
});

describe('tct-selector: search announcements', () => {
  const SEARCH = 'label="Fruit" has-search';

  it('announces the count of matches once per query change, singular and plural', async () => {
    const el = await make(SEARCH, ['Apple', 'Apricot', 'Banana']);
    await openByClick(el);
    await settle(el);
    expect(recorder!.messages()).toEqual([]);
    await userEvent.keyboard('a');
    await settle(el);
    expect(recorder!.messages()).toEqual(['3 results']);
    await userEvent.keyboard('p');
    await settle(el);
    expect(recorder!.messages()).toEqual(['3 results', '2 results']);
    await userEvent.keyboard('r');
    await settle(el);
    expect(recorder!.messages()).toEqual(['3 results', '2 results', '1 result']);
  });

  it('announces the empty-search message (or the custom one) when nothing matches, and never for an emptied query', async () => {
    const el = await make(`${SEARCH} empty-search-text="No fruit like that"`);
    await openByClick(el);
    await userEvent.keyboard('zz');
    await settle(el);
    expect(recorder!.messages().at(-1)).toBe('No fruit like that');
    // Each query change with no match says so: two letters, two messages.
    expect(recorder!.messages()).toEqual(['No fruit like that', 'No fruit like that']);
    await pressKeys('Backspace');
    await settle(el);
    const before = recorder!.messages().length;
    await pressKeys('Backspace');
    await settle(el);
    expect(recorder!.messages()).toHaveLength(before);
  });

  it('the count is announced for a query seeded by typing on the closed trigger', async () => {
    const el = await make(SEARCH, ['Apple', 'Apricot', 'Banana']);
    trigger(el).focus();
    await pressKeys('a', 'p');
    await waitUntil(() => el.open, 'opened');
    await settle(el);
    expect(recorder!.messages()).toEqual(['3 results', '2 results']);
  });

  it('does not repeat an announcement on unrelated updates while the query stands', async () => {
    const el = await make(SEARCH, ['Apple', 'Apricot', 'Banana']);
    await openByClick(el);
    await userEvent.keyboard('ap');
    await settle(el);
    const spoken = recorder!.messages().length;
    await pressKeys('ArrowDown', 'ArrowDown', 'ArrowUp');
    el.requestUpdate();
    await settle(el);
    expect(recorder!.messages()).toHaveLength(spoken);
  });
});

describe('tct-selector: typeahead announcement', () => {
  it('says the label of an option chosen by typing on the closed trigger, once', async () => {
    const el = await make('label="Fruit"', ['Apple', 'Banana', 'Cherry']);
    trigger(el).focus();
    await pressKeys('c');
    await settle(el);
    expect(el.value).toBe('Cherry');
    expect(recorder!.messages()).toEqual(['Cherry']);
    await aTimeout(50);
    expect(recorder!.messages()).toEqual(['Cherry']);
  });

  it('says nothing for a choice made from the open list (focus moves with the highlight)', async () => {
    const el = await make();
    await openByClick(el);
    await pressKeys('ArrowDown', 'Enter');
    await closed(el);
    await settle(el);
    expect(recorder!.messages()).toEqual([]);
  });
});
