/// <reference types="@vitest/browser-playwright" />
import {html} from 'lit';
import {describe, expect, it} from 'vitest';
import {userEvent} from 'vitest/browser';
import {axActiveDescendant, axNode, expectAccessible} from '@tecton-wc/testing/a11y.js';
import {expectEventCounts, recordEvents} from '@tecton-wc/testing/events.js';
import {fixture} from '@tecton-wc/testing/fixture.js';
import {deepActiveElement} from '@tecton-wc/testing/keyboard.js';
import {isChromium} from '@tecton-wc/testing/tier.js';
import {animationsFinished, waitUntil} from '@tecton-wc/testing/timing.js';
import './define.js';
import type {ChatComposerSearchItem, ChatComposerTrigger} from './chat-composer.types.js';
import type {TctChatComposerInput} from './tct-chat-composer-input.js';

const PEOPLE: ChatComposerSearchItem[] = [
  {id: 'ada', label: 'Ada Lovelace'},
  {id: 'alan', label: 'Alan Turing'},
  {id: 'grace', label: 'Grace Hopper'},
];

const people = (items = PEOPLE): ChatComposerTrigger => ({
  character: '@',
  searchSource: {
    search: (query) =>
      items.filter((item) => item.label.toLowerCase().includes(query.toLowerCase())),
  },
  onSelect: (item) => ({value: `@${item.id}`, label: item.label}),
});

const editableOf = (input: Element): HTMLElement =>
  input.shadowRoot!.querySelector<HTMLElement>('.editable')!;
const menuOf = (input: Element): HTMLElement =>
  input.shadowRoot!.querySelector<HTMLElement>('.trigger-menu')!;
const optionsOf = (input: Element): HTMLElement[] => [
  ...input.shadowRoot!.querySelectorAll<HTMLElement>('[role="option"]'),
];
const isOpen = (input: Element): boolean => menuOf(input).matches(':popover-open');
const tokensOf = (input: Element): Element[] => [
  ...editableOf(input).querySelectorAll('tct-chat-composer-token-element'),
];

async function make(
  triggers: ChatComposerTrigger[] = [people()],
  attributes = '',
): Promise<TctChatComposerInput> {
  const root = await fixture<HTMLElement>(
    `<div style="padding-block-start: 160px; inline-size: 420px"><tct-chat-composer-input ${attributes}></tct-chat-composer-input></div>`,
  );
  const input = root.querySelector<TctChatComposerInput>('tct-chat-composer-input')!;
  input.triggers = triggers;
  await input.updateComplete;
  return input;
}

async function type(input: TctChatComposerInput, text: string): Promise<void> {
  if (deepActiveElement() !== editableOf(input)) editableOf(input).focus();
  await userEvent.keyboard(text);
}

/** The menu has opened and its results are in. */
const opened = async (input: TctChatComposerInput, count?: number): Promise<void> => {
  await waitUntil(() => isOpen(input), 'the menu opens');
  await input.updateComplete;
  if (count !== undefined)
    await waitUntil(() => optionsOf(input).length === count, `${count} options`);
};

describe('trigger menu: roles and opening', () => {
  it('is a plain multiline textbox without triggers, and a combobox with them', async () => {
    const plain = await make([]);
    expect(editableOf(plain).getAttribute('role')).toBe('textbox');
    expect(editableOf(plain).getAttribute('aria-multiline')).toBe('true');
    expect(editableOf(plain).hasAttribute('aria-expanded')).toBe(false);
    const box = await make();
    const editable = editableOf(box);
    expect(editable.getAttribute('role')).toBe('combobox');
    expect(editable.getAttribute('aria-haspopup')).toBe('listbox');
    expect(editable.getAttribute('aria-expanded')).toBe('false');
    // aria-multiline is not allowed on a combobox.
    expect(editable.hasAttribute('aria-multiline')).toBe(false);
    if (isChromium)
      expect(await axNode(editable)).toMatchObject({role: 'combobox', expanded: 'false'});
    await expectAccessible(box);
  });

  it('opens at a trigger character with the source items, and exposes the open state', async () => {
    const input = await make();
    await type(input, '@');
    await opened(input, 3);
    const editable = editableOf(input);
    expect(editable.getAttribute('aria-expanded')).toBe('true');
    const listbox = input.shadowRoot!.querySelector('[role="listbox"]')!;
    expect(editable.getAttribute('aria-controls')).toBe(listbox.id);
    expect(listbox.getAttribute('aria-label')).toBe('Suggestions');
    expect(optionsOf(input).map((option) => option.textContent.trim())).toEqual([
      'Ada Lovelace',
      'Alan Turing',
      'Grace Hopper',
    ]);
    expect(optionsOf(input)[0]!.getAttribute('aria-selected')).toBe('true');
    expect(editable.getAttribute('aria-activedescendant')).toBe(optionsOf(input)[0]!.id);
    // Focus never leaves the editable.
    expect(deepActiveElement()).toBe(editable);
  });

  it('filters by what is typed after the character, and closes when the word ends', async () => {
    const input = await make();
    await type(input, '@a');
    await waitUntil(() => optionsOf(input).length === 3, 'three matches');
    await userEvent.keyboard('l');
    await waitUntil(() => optionsOf(input).length === 1, 'one match');
    expect(optionsOf(input).map((option) => option.textContent.trim())).toEqual(['Alan Turing']);
    await userEvent.keyboard(' ');
    await waitUntil(() => !isOpen(input), 'the menu closes at the space');
    expect(editableOf(input).getAttribute('aria-expanded')).toBe('false');
  });

  it('opens only at the start of a word: not inside an address, yes after a space, a newline or a token', async () => {
    const input = await make();
    await type(input, 'mail me at a@');
    expect(isOpen(input)).toBe(false);
    await userEvent.keyboard(' @');
    await opened(input);
    await userEvent.keyboard('{Escape}');
    await userEvent.keyboard('{Shift>}{Enter}{/Shift}@');
    await opened(input);
    await userEvent.keyboard('{Escape}{Backspace}');
    input.insertToken({value: '#t', label: 't'});
    await userEvent.keyboard('@');
    await opened(input);
  });

  it('never opens while an input method is composing, and evaluates when the composition ends', async () => {
    const input = await make();
    const editable = editableOf(input);
    editable.focus();
    editable.dispatchEvent(
      new CompositionEvent('compositionstart', {bubbles: true, composed: true}),
    );
    input.insertText('@');
    await input.updateComplete;
    expect(isOpen(input)).toBe(false);
    editable.dispatchEvent(new CompositionEvent('compositionend', {bubbles: true, composed: true}));
    await opened(input);
  });

  it('positions the popup above the caret', async () => {
    const input = await make();
    await type(input, 'hi @');
    await opened(input, 3);
    await animationsFinished(menuOf(input));
    const menu = menuOf(input).getBoundingClientRect();
    const editable = editableOf(input).getBoundingClientRect();
    expect(menu.bottom).toBeLessThanOrEqual(editable.top + editable.height);
    expect(menu.width).toBeGreaterThan(100);
    expect(menu.top).toBeGreaterThanOrEqual(0);
  });
});

describe('trigger menu: keyboard', () => {
  it('ArrowDown and ArrowUp move the highlight (wrapping) and aria-activedescendant follows', async () => {
    const input = await make();
    await type(input, '@');
    await opened(input, 3);
    const editable = editableOf(input);
    const highlighted = (): number =>
      optionsOf(input).findIndex((o) => o.getAttribute('aria-selected') === 'true');
    await userEvent.keyboard('{ArrowDown}');
    expect(highlighted()).toBe(1);
    await input.updateComplete;
    expect(editable.getAttribute('aria-activedescendant')).toBe(optionsOf(input)[1]!.id);
    if (isChromium)
      expect(await axActiveDescendant(editable, optionsOf(input))).toBe(optionsOf(input)[1]);
    await userEvent.keyboard('{ArrowDown}{ArrowDown}');
    expect(highlighted()).toBe(0);
    await userEvent.keyboard('{ArrowUp}');
    expect(highlighted()).toBe(2);
    // The keys never moved the caret or recalled history.
    expect(input.value).toBe('@');
  });

  it('Enter chooses the highlighted item: a token replaces the trigger word, once, and the menu closes', async () => {
    const input = await make();
    const submits = recordEvents(input, ['tct-chat-submit']);
    await type(input, 'ask @a');
    await waitUntil(() => optionsOf(input).length === 3, 'three matches');
    await userEvent.keyboard('{ArrowDown}');
    const events = recordEvents(input, ['input']);
    await userEvent.keyboard('{Enter}');
    expect(submits.events).toHaveLength(0);
    expect(tokensOf(input)).toHaveLength(1);
    expect(tokensOf(input)[0]!.getAttribute('data-tct-token-value')).toBe('@alan');
    expect(input.value).toBe('ask @alan ');
    expectEventCounts(events, {input: 1});
    await waitUntil(() => !isOpen(input), 'the menu closes');
    await userEvent.keyboard('now');
    expect(input.value).toBe('ask @alan now');
  });

  it('Tab chooses too, and stays in the field', async () => {
    const input = await make();
    await type(input, '@gr');
    await waitUntil(() => optionsOf(input).length === 1, 'one match');
    await userEvent.keyboard('{Tab}');
    expect(input.value).toBe('@grace ');
    expect(deepActiveElement()).toBe(editableOf(input));
  });

  it('a string result is inserted as plain text', async () => {
    const trigger: ChatComposerTrigger = {
      character: '/',
      searchSource: {search: () => [{id: 'summarize', label: 'Summarize'}]},
      onSelect: (item) => `/${item.id} `,
    };
    const input = await make([trigger]);
    await type(input, '/');
    await opened(input, 1);
    await userEvent.keyboard('{Enter}');
    expect(input.value).toBe('/summarize ');
    expect(tokensOf(input)).toHaveLength(0);
  });

  it('Escape closes the menu, keeps the draft and does not submit', async () => {
    const input = await make();
    const submits = recordEvents(input, ['tct-chat-submit']);
    await type(input, 'hey @a');
    await opened(input);
    await userEvent.keyboard('{Escape}');
    await waitUntil(() => !isOpen(input), 'closed');
    expect(input.value).toBe('hey @a');
    expect(submits.events).toHaveLength(0);
    expect(editableOf(input).getAttribute('aria-expanded')).toBe('false');
    expect(deepActiveElement()).toBe(editableOf(input));
  });

  it('Enter with the menu open but nothing highlighted is an ordinary Enter (submits)', async () => {
    const input = await make();
    const submits = recordEvents(input, ['tct-chat-submit']);
    await type(input, 'x @zzz');
    await waitUntil(() => input.shadowRoot!.querySelector('.status') !== null, 'the empty message');
    await userEvent.keyboard('{Enter}');
    expect(submits.events).toHaveLength(1);
    expect(submits.events[0]!.value).toBe('x @zzz');
  });

  it("shows the localised empty text, or the trigger's own", async () => {
    const input = await make();
    await type(input, '@zzz');
    await waitUntil(() => input.shadowRoot!.querySelector('.status') !== null, 'empty message');
    expect(input.shadowRoot!.querySelector('.status')!.textContent.trim()).toBe('No results');
    expect(input.shadowRoot!.querySelector('.status')!.getAttribute('role')).toBe('status');
    const custom = await make([
      {...people(), emptySearchResultsText: 'Nobody found', menuLabel: 'People'},
    ]);
    await type(custom, '@zzz');
    await waitUntil(() => custom.shadowRoot!.querySelector('.status') !== null, 'empty message');
    expect(custom.shadowRoot!.querySelector('.status')!.textContent.trim()).toBe('Nobody found');
    expect(custom.shadowRoot!.querySelector('[role="listbox"]')!.getAttribute('aria-label')).toBe(
      'People',
    );
  });
});

describe('trigger menu: pointer and dismissal', () => {
  it('choosing an option with the pointer inserts it and keeps focus in the field', async () => {
    const input = await make();
    await type(input, '@');
    await opened(input, 3);
    await userEvent.click(optionsOf(input)[2]!);
    expect(input.value).toBe('@grace ');
    expect(tokensOf(input)).toHaveLength(1);
    expect(deepActiveElement()).toBe(editableOf(input));
  });

  it('hovering highlights an option without moving the caret or the scroll', async () => {
    const input = await make();
    await type(input, '@');
    await opened(input, 3);
    await userEvent.hover(optionsOf(input)[1]!);
    await waitUntil(
      () => optionsOf(input)[1]!.getAttribute('aria-selected') === 'true',
      'hover highlights',
    );
    expect(input.value).toBe('@');
  });

  it('a press outside closes the menu', async () => {
    const input = await make();
    await type(input, '@');
    await opened(input, 3);
    await userEvent.click(document.body, {position: {x: 5, y: 5}});
    await waitUntil(() => !isOpen(input), 'closed by the outside press');
  });

  it('losing focus closes the menu', async () => {
    const root = await fixture<HTMLElement>(
      `<div style="padding-block-start: 160px"><tct-chat-composer-input></tct-chat-composer-input><button type="button">next</button></div>`,
    );
    const input = root.querySelector<TctChatComposerInput>('tct-chat-composer-input')!;
    input.triggers = [people()];
    await input.updateComplete;
    await type(input, '@');
    await opened(input, 3);
    root.querySelector('button')!.focus();
    await waitUntil(() => !isOpen(input), 'closed on blur');
  });

  it('moving the caret out of the trigger word closes it', async () => {
    const input = await make();
    await type(input, 'ab @c');
    await opened(input);
    await userEvent.keyboard('{Home}');
    await waitUntil(() => !isOpen(input), 'closed after Home');
  });
});

describe('trigger menu: searching', () => {
  interface Deferred {
    query: string;
    resolve(items: ChatComposerSearchItem[]): void;
    reject(): void;
  }
  function asyncSource(): {trigger: ChatComposerTrigger; calls: Deferred[]; cancels: () => number} {
    const calls: Deferred[] = [];
    let cancels = 0;
    const trigger: ChatComposerTrigger = {
      character: '@',
      searchSource: {
        search: (query) =>
          new Promise<ChatComposerSearchItem[]>((resolve, reject) => {
            calls.push({query, resolve, reject: () => reject(new Error('nope'))});
          }),
        cancel: () => {
          cancels++;
        },
      },
      onSelect: (item) => ({value: `@${item.id}`, label: item.label}),
      loadingText: 'Looking…',
    };
    return {trigger, calls, cancels: () => cancels};
  }

  it('shows a loading status, then the items; a busy listbox meanwhile', async () => {
    const {trigger, calls} = asyncSource();
    const input = await make([trigger], 'debounce-ms="0"');
    await type(input, '@');
    await waitUntil(() => calls.length === 1, 'a search started');
    await waitUntil(
      () => input.shadowRoot!.querySelector('.status') !== null,
      'the loading status',
    );
    expect(input.shadowRoot!.querySelector('.status')!.textContent.trim()).toBe('Looking…');
    expect(input.shadowRoot!.querySelector('[role="listbox"]')!.getAttribute('aria-busy')).toBe(
      'true',
    );
    calls[0]!.resolve([PEOPLE[0]!]);
    await waitUntil(() => optionsOf(input).length === 1, 'the result');
    expect(input.shadowRoot!.querySelector('.status')).toBeNull();
    expect(input.shadowRoot!.querySelector('[role="listbox"]')!.hasAttribute('aria-busy')).toBe(
      false,
    );
  });

  it('cancels the search it supersedes and drops a stale answer', async () => {
    const {trigger, calls, cancels} = asyncSource();
    const input = await make([trigger], 'debounce-ms="0"');
    await type(input, '@');
    await waitUntil(() => calls.length === 1, 'first search');
    await userEvent.keyboard('a');
    await waitUntil(() => calls.length === 2, 'second search');
    expect(cancels()).toBeGreaterThanOrEqual(1);
    calls[0]!.resolve([PEOPLE[2]!]); // stale: ""
    calls[1]!.resolve([PEOPLE[1]!]); // current: "a"
    await waitUntil(() => optionsOf(input).length === 1, 'the current result');
    expect(optionsOf(input)[0]!.textContent.trim()).toBe('Alan Turing');
  });

  it('debounces an asynchronous source after its first answer, and searches at once before', async () => {
    const {trigger, calls} = asyncSource();
    // A window long enough that four keystrokes always fall inside it: with 120 ms, typing 'alan' under
    // load took longer than the window and made a second search.
    const input = await make([trigger], 'debounce-ms="1000"');
    await type(input, '@');
    // The first query is not delayed (nothing is known about the source yet).
    await waitUntil(() => calls.length === 1, 'the first search runs at once');
    calls[0]!.resolve([]);
    await userEvent.keyboard('alan');
    // Four keystrokes inside one debounce window make a single search.
    await waitUntil(() => calls.length >= 2, 'the debounced search', 5000);
    expect(calls).toHaveLength(2);
    expect(calls[1]!.query).toBe('alan');
  });

  it('a rejected search shows the empty state', async () => {
    const {trigger, calls} = asyncSource();
    const input = await make([trigger], 'debounce-ms="0"');
    await type(input, '@');
    await waitUntil(() => calls.length === 1, 'search');
    calls[0]!.reject();
    await waitUntil(
      () => input.shadowRoot!.querySelector('.status')?.textContent?.trim() === 'No results',
      'empty',
    );
  });

  it('a synchronous source answers within the same keystroke', async () => {
    const input = await make();
    await type(input, '@');
    await opened(input);
    expect(optionsOf(input)).toHaveLength(3);
  });
});

describe('trigger menu: rendering items', () => {
  it('groups items under headings from auxiliaryData.group, ungrouped last', async () => {
    const items: ChatComposerSearchItem[] = [
      {id: '1', label: 'Home', auxiliaryData: {group: 'Navigation'}},
      {id: '2', label: 'Help'},
      {id: '3', label: 'Settings', auxiliaryData: {group: 'Navigation'}},
      {id: '4', label: 'Dark mode', auxiliaryData: {group: 'Preferences'}},
    ];
    const input = await make([people(items)]);
    await type(input, '@');
    await opened(input, 4);
    const groups = [...input.shadowRoot!.querySelectorAll<HTMLElement>('[role="group"]')];
    expect(groups.map((group) => group.getAttribute('aria-label'))).toEqual([
      'Navigation',
      'Preferences',
    ]);
    expect(optionsOf(input).map((option) => option.textContent.trim())).toEqual([
      'Home',
      'Settings',
      'Dark mode',
      'Help',
    ]);
    // Arrow order follows the visual order.
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}{Enter}');
    expect(input.value).toBe('@2 ');
  });

  it('renders items through renderItem (text, template or node)', async () => {
    const trigger: ChatComposerTrigger = {
      ...people(),
      renderItem: (item) => html`<b class="custom">${item.label.toUpperCase()}</b>`,
    };
    const input = await make([trigger]);
    await type(input, '@gr');
    await opened(input, 1);
    expect(optionsOf(input)[0]!.querySelector('.custom')!.textContent).toBe('GRACE HOPPER');
  });

  it('works with several triggers', async () => {
    const slash: ChatComposerTrigger = {
      character: '/',
      searchSource: {search: () => [{id: 'clear', label: 'Clear'}]},
      onSelect: (item) => ({value: `/${item.id}`, label: item.label, variant: 'info'}),
    };
    const input = await make([people(), slash]);
    await type(input, '/');
    await opened(input, 1);
    expect(optionsOf(input)[0]!.textContent.trim()).toBe('Clear');
    await userEvent.keyboard('{Enter}');
    expect(input.value).toBe('/clear ');
  });

  it('passes axe with the menu open, hovering and highlighted, in light and dark', async () => {
    for (const theme of ['light', 'dark'] as const) {
      const root = await fixture<HTMLElement>(
        `<div style="padding-block-start: 200px; inline-size: 420px"><tct-chat-composer-input></tct-chat-composer-input></div>`,
        {theme},
      );
      const input = root.querySelector<TctChatComposerInput>('tct-chat-composer-input')!;
      input.triggers = [
        people([...PEOPLE, {id: 'x', label: 'Grouped', auxiliaryData: {group: 'Group'}}]),
      ];
      await input.updateComplete;
      await type(input, '@');
      await opened(input, 4);
      await animationsFinished(menuOf(input));
      await userEvent.hover(optionsOf(input)[1]!);
      await waitUntil(() => optionsOf(input)[1]!.getAttribute('aria-selected') === 'true', 'hover');
      await expectAccessible(root);
    }
  });
});
