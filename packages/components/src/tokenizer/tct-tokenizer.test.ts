/**
 * tct-tokenizer: the element and form-control suites (repeated entries, reset, restore), then rendering,
 * adding and removing tokens (click, Backspace, clear all) with their announcements, exclusion of chosen
 * results, max-entries, has-create, paste splitting, focus, inline overflow, the focus-bootstrap lifecycle,
 * disabled and read-only, events, custom rendering, RTL, forced colours and i18n. The combobox engine
 * itself (keyboard, debounce, stale results) is covered in tct-base-typeahead.test.ts. Ported from upstream
 * Tokenizer.test.tsx where the behaviour applies.
 */
import {html} from 'lit';
import {page, userEvent} from 'vitest/browser';
import {describe, expect, it} from 'vitest';
import {deepActiveElement} from '@tecton-wc/core/utils/focus.js';
import {axNode, expectAccessible} from '@tecton-wc/testing/a11y.js';
import {emulateMedia} from '@tecton-wc/testing/emulate.js';
import {recordEvents} from '@tecton-wc/testing/events.js';
import {fixture} from '@tecton-wc/testing/fixture.js';
import {formHarness, hasCustomState} from '@tecton-wc/testing/forms.js';
import {pressKeys} from '@tecton-wc/testing/keyboard.js';
import {runElementSuite} from '@tecton-wc/testing/suites/element.js';
import {runFormControlSuite} from '@tecton-wc/testing/suites/form-control.js';
import {isChromium, isTier2} from '@tecton-wc/testing/tier.js';
import {nextFrame, waitUntil} from '@tecton-wc/testing/timing.js';
import '../field/define.js';
import '../form-layout/define.js';
import '../tooltip/define.js';
import '../typeahead/define.js';
import './define.js';
import {createStaticSource} from '../typeahead/create-static-source.js';
import {
  activeOption,
  comboboxOf,
  controlledSource,
  motionDone,
  optionLabels,
  optionsOf,
  spyAnnouncements,
  textOf,
  typeInto,
  whenOpen,
} from '../typeahead/fixtures/typeahead-test-helpers.js';
import type {SearchableItem} from '../typeahead/typeahead.types.js';
import type {TctTokenizer} from './tct-tokenizer.js';

const TEAMS: SearchableItem[] = [
  {id: 'design', label: 'Design'},
  {id: 'engineering', label: 'Engineering'},
  {id: 'marketing', label: 'Marketing'},
  {id: 'sales', label: 'Sales'},
  {id: 'support', label: 'Support'},
  {id: 'legal', label: 'Legal'},
];

const part = (element: TctTokenizer, name: string): HTMLElement | null =>
  element.shadowRoot!.querySelector<HTMLElement>(`[part="${name}"]`);
const tokensOf = (element: TctTokenizer): HTMLElement[] => [
  ...element.shadowRoot!.querySelectorAll<HTMLElement>('tct-token'),
];
const removeOf = (token: HTMLElement): HTMLButtonElement =>
  token.shadowRoot!.querySelector<HTMLButtonElement>('button.remove')!;
const clearAll = (element: TctTokenizer): HTMLElement | null =>
  element.shadowRoot!.querySelector<HTMLElement>('tct-input-clear-button');
const statusOf = (element: TctTokenizer): HTMLElement | null =>
  element.shadowRoot!.querySelector<HTMLElement>('tct-field-status');

async function make(
  attributes = 'label="Teams"',
  items: SearchableItem[] = [],
  width = 420,
): Promise<TctTokenizer> {
  const wrapper = await fixture<HTMLElement>(
    `<div style="padding:24px 24px 320px;inline-size:${width + 48}px"><tct-tokenizer debounce-ms="0" ${attributes}></tct-tokenizer><button type="button">after</button></div>`,
  );
  const element = wrapper.querySelector<TctTokenizer>('tct-tokenizer')!;
  element.searchSource = createStaticSource(TEAMS);
  if (items.length > 0) element.items = items;
  await element.updateComplete;
  await nextFrame();
  return element;
}

const restoreState = new FormData();
restoreState.append('field', 'design');

runElementSuite({
  tag: 'tct-tokenizer',
  render: () => html`<tct-tokenizer label="Teams" name="teams"></tct-tokenizer>`,
  properties: {
    label: 'Other',
    description: 'Help',
    placeholder: 'Find',
    size: 'lg',
    entriesOnFocus: true,
    maxMenuItems: 4,
    maxEntries: 3,
    minQueryLength: 2,
    debounceMs: 40,
    hasClear: true,
    hasCreate: true,
    tokenOverflow: 'unfocused-inline',
    startIcon: 'search',
    width: 300,
    loading: true,
    items: [{id: 'x', label: 'X'}],
  },
  attributes: {
    label: 'label',
    description: 'description',
    placeholder: 'placeholder',
    maxEntries: 'max-entries',
    debounceMs: 'debounce-ms',
    minQueryLength: 'min-query-length',
    tokenOverflow: 'token-overflow',
  },
  events: ['tct-selection-change', 'tct-open-change', 'tct-after-open-change'],
});

runFormControlSuite({
  tag: 'tct-tokenizer',
  render: (attributes) =>
    `<tct-tokenizer label="Teams" debounce-ms="0" ${attributes}></tct-tokenizer>`,
  validValue: 'design',
  setValid: (element) => {
    (element as unknown as TctTokenizer).items = [{id: 'design', label: 'Design'}];
  },
  setEmpty: (element) => {
    (element as unknown as TctTokenizer).items = [];
  },
  restoreState,
  submitsOnEnter: true,
  readonly: true,
  labelActivation: 'focus',
  userEdit: async (element) => {
    (element as unknown as TctTokenizer).searchSource = createStaticSource(TEAMS);
    await userEvent.click(comboboxOf(element));
    await userEvent.keyboard('d');
    await waitUntil(() => (element as unknown as TctTokenizer).open, 'results open');
    await pressKeys('Enter', 'Tab');
  },
});

describe('tct-tokenizer: rendering (Tokenizer.test.tsx)', () => {
  it('renders the label, the description and a group named by the label around a combobox', async () => {
    const element = await make('label="Team members" description="Who is on the project"');
    expect(textOf(part(element, 'label'))).toBe('Team members');
    expect(textOf(part(element, 'description'))).toBe('Who is on the project');
    const group = part(element, 'group')!;
    expect(group.getAttribute('role')).toBe('group');
    expect(group.getAttribute('aria-label')).toBe('Team members');
    expect(group.contains(comboboxOf(element))).toBe(true);
    if (isChromium) {
      expect(await axNode(comboboxOf(element))).toMatchObject({
        role: 'combobox',
        name: 'Team members',
      });
    }
  });

  it('shows the placeholder without tokens (default "Search…") and hides it once there are tokens', async () => {
    const element = await make('label="Teams"');
    expect(comboboxOf(element).placeholder).toBe('Search…');
    element.setAttribute('placeholder', 'Add a team');
    await element.updateComplete;
    expect(comboboxOf(element).placeholder).toBe('Add a team');
    element.items = [TEAMS[0]!];
    await element.updateComplete;
    expect(comboboxOf(element).placeholder).toBe('');
  });

  it('renders one token per item, in order, with a remove button named after the item', async () => {
    const element = await make('label="Teams"', [TEAMS[0]!, TEAMS[2]!]);
    const tokens = tokensOf(element);
    expect(tokens.map((token) => token.getAttribute('label'))).toEqual(['Design', 'Marketing']);
    expect(removeOf(tokens[0]!).getAttribute('aria-label')).toBe('Remove Design');
    expect(element.values).toEqual(['design', 'marketing']);
  });

  it('the tokens are direct children of the wrapping lane, beside the input (no sub-container)', async () => {
    const element = await make('label="Teams"', [TEAMS[0]!, TEAMS[1]!]);
    const lane = element.shadowRoot!.querySelector('.lane')!;
    expect(tokensOf(element).every((token) => token.parentElement === lane)).toBe(true);
    expect(comboboxOf(element).parentElement).toBe(lane);
  });

  it('wraps tokens onto more rows and the field grows; the end controls stay on the first row', async () => {
    const element = await make('label="Teams" has-clear', TEAMS, 300);
    await waitUntil(() => tokensOf(element).length === TEAMS.length, 'tokens rendered');
    const box = part(element, 'input')!.getBoundingClientRect();
    const tops = new Set(
      tokensOf(element).map((token) => Math.round(token.getBoundingClientRect().top)),
    );
    expect(tops.size).toBeGreaterThan(1);
    const single = await make('label="Teams"');
    expect(box.height).toBeGreaterThan(part(single, 'input')!.getBoundingClientRect().height);
    const clear = clearAll(element)!.getBoundingClientRect();
    expect(clear.top).toBeLessThan(box.top + 40);
    expect(clear.right).toBeLessThanOrEqual(box.right);
  });

  it('renders the sizes sm, md and lg; one row of tokens keeps the control height', async () => {
    const heights: number[] = [];
    for (const size of ['sm', 'md', 'lg']) {
      const element = await make(`label="Teams" size="${size}"`, [TEAMS[0]!]);
      heights.push(Math.round(part(element, 'input')!.getBoundingClientRect().height));
      expect(tokensOf(element)[0]!.getAttribute('size')).toBe(size);
    }
    expect(heights).toEqual([28, 32, 36]);
  });

  it('a start icon and the start slot render before the tokens; end content renders in the end lane', async () => {
    const wrapper = await fixture<HTMLElement>(
      `<div style="padding:24px;inline-size:420px"><tct-tokenizer label="Teams" start-icon="search"><span slot="start" id="s">@</span><span slot="end" id="e">3</span></tct-tokenizer></div>`,
    );
    const element = wrapper.querySelector<TctTokenizer>('tct-tokenizer')!;
    element.items = [TEAMS[0]!];
    await element.updateComplete;
    expect(part(element, 'start-icon')).not.toBeNull();
    const start = element.shadowRoot!.querySelector<HTMLSlotElement>('slot[name="start"]')!;
    const end = element.shadowRoot!.querySelector<HTMLSlotElement>('slot[name="end"]')!;
    expect(start.assignedElements()[0]?.id).toBe('s');
    expect(end.assignedElements()[0]?.id).toBe('e');
    const lane = element.shadowRoot!.querySelector('.end-lane')!;
    expect(lane.contains(end)).toBe(true);
  });

  it('renders an error status and keeps the group and the input reachable', async () => {
    const element = await make(
      'label="Teams" status-type="error" status-message="Add at least one"',
    );
    expect(textOf(statusOf(element))).toContain('Add at least one');
    expect(part(element, 'input')!.getAttribute('data-status')).toBe('error');
    if (isChromium)
      expect((await axNode(comboboxOf(element))).description).toContain('Add at least one');
  });

  it('takes its name from the label even inside an input group (no chrome of its own)', async () => {
    await page.viewport(900, 800);
    const wrapper = await fixture<HTMLElement>(
      `<tct-form-layout direction="horizontal-labels"><tct-tokenizer label="Teams"></tct-tokenizer></tct-form-layout>`,
    );
    const element = wrapper.querySelector<TctTokenizer>('tct-tokenizer')!;
    await element.updateComplete;
    await nextFrame();
    expect(part(element, 'label')!.getBoundingClientRect().right).toBeLessThanOrEqual(
      part(element, 'input')!.getBoundingClientRect().left + 1,
    );
  });
});

describe('tct-tokenizer: adding tokens', () => {
  it('choosing a result adds a token, clears the query, closes the menu and keeps focus in the input', async () => {
    const element = await make();
    await typeInto(element, 'de');
    await whenOpen(element);
    await pressKeys('Enter');
    expect(element.values).toEqual(['design']);
    expect(tokensOf(element)).toHaveLength(1);
    expect(comboboxOf(element).value).toBe('');
    await waitUntil(() => !element.open, 'the menu closes');
    expect(deepActiveElement()).toBe(comboboxOf(element));
  });

  it('a click on a result adds it too', async () => {
    const element = await make();
    await typeInto(element, 'e');
    await whenOpen(element);
    await userEvent.click(optionsOf(element)[1]!);
    expect(element.values).toEqual(['engineering']);
  });

  it('leaves out results already chosen, by id (distinct ids with the same label stay)', async () => {
    const element = await make('label="Teams"', [TEAMS[0]!]);
    element.searchSource = createStaticSource([...TEAMS, {id: 'design-2', label: 'Design'}]);
    await typeInto(element, 'des');
    await whenOpen(element);
    expect(optionLabels(element)).toEqual(['Design']);
    await pressKeys('Enter');
    expect(element.values).toEqual(['design', 'design-2']);
  });

  it('a chosen result reaches an unselected menu only once the token is removed', async () => {
    const element = await make('label="Teams"', [TEAMS[0]!]);
    await typeInto(element, 'esig');
    await waitUntil(() => optionsOf(element).length === 1, 'the empty state');
    expect(textOf(optionsOf(element)[0])).toBe('No results found');
  });

  it('fires tct-selection-change (add), then input, then one change; preventing it adds nothing', async () => {
    const element = await make();
    const events = recordEvents(element, ['tct-selection-change', 'input', 'change']);
    await typeInto(element, 'de');
    await whenOpen(element);
    events.events.length = 0;
    await pressKeys('Enter');
    expect(events.events.map((event) => event.type)).toEqual([
      'tct-selection-change',
      'input',
      'change',
    ]);
    expect(events.events[0]).toMatchObject({action: 'add', reason: 'keyboard'});
    expect((events.events[0] as unknown as {item: SearchableItem}).item.id).toBe('design');
    expect((events.events[0] as unknown as {items: SearchableItem[]}).items).toHaveLength(1);

    const second = await make();
    second.addEventListener('tct-selection-change', (event) => event.preventDefault());
    await typeInto(second, 'de');
    await whenOpen(second);
    await pressKeys('Enter');
    expect(second.values).toEqual([]);
    expect(second.open).toBe(true);
  });

  it('property writes emit no events', async () => {
    const element = await make();
    const events = recordEvents(element, ['input', 'change', 'tct-selection-change']);
    element.items = [TEAMS[0]!, TEAMS[1]!];
    await element.updateComplete;
    expect(events.events).toHaveLength(0);
    expect(tokensOf(element)).toHaveLength(2);
  });

  it('announces additions politely, once, and nothing on mount or while typing', async () => {
    const spy = spyAnnouncements();
    try {
      const element = await make('label="Teams"', [TEAMS[3]!]);
      expect(spy.messages).toEqual([]);
      await typeInto(element, 'de');
      await whenOpen(element);
      await pressKeys('Enter');
      expect(spy.messages.filter((message) => message === 'Added Design')).toHaveLength(1);
      expect(
        spy.messages.filter((message) => !message.includes('result') && message !== 'Added Design'),
      ).toEqual([]);
    } finally {
      spy.restore();
    }
  });
});

describe('tct-tokenizer: removing tokens', () => {
  it('the remove button removes the token, fires the events, announces it and returns focus to the input', async () => {
    const spy = spyAnnouncements();
    try {
      const element = await make('label="Teams"', [TEAMS[0]!, TEAMS[1]!]);
      const events = recordEvents(element, [
        'tct-selection-change',
        'input',
        'change',
        'tct-remove',
      ]);
      await userEvent.click(removeOf(tokensOf(element)[0]!));
      expect(element.values).toEqual(['engineering']);
      expect(events.events.map((event) => event.type)).toEqual([
        'tct-selection-change',
        'input',
        'change',
      ]);
      expect(events.events[0]).toMatchObject({action: 'remove'});
      expect(events.named('tct-remove'), "the token's own event stays inside").toHaveLength(0);
      expect(spy.messages).toEqual(['Removed Design']);
      await waitUntil(
        () => deepActiveElement() === comboboxOf(element),
        'focus returns to the input',
      );
    } finally {
      spy.restore();
    }
  });

  it('Backspace in an empty input removes the last token, announced once; with text it edits the text', async () => {
    const spy = spyAnnouncements();
    try {
      const element = await make('label="Teams"', [TEAMS[0]!, TEAMS[1]!]);
      await userEvent.click(comboboxOf(element));
      await userEvent.keyboard('x{Backspace}');
      expect(element.values).toEqual(['design', 'engineering']);
      await userEvent.keyboard('{Backspace}');
      expect(element.values).toEqual(['design']);
      expect(spy.messages.filter((message) => message === 'Removed Engineering')).toHaveLength(1);
      await userEvent.keyboard('{Backspace}');
      expect(element.values).toEqual([]);
      await userEvent.keyboard('{Backspace}');
      expect(element.values).toEqual([]);
    } finally {
      spy.restore();
    }
  });

  it('a composing Backspace (IME) removes nothing', async () => {
    const element = await make('label="Teams"', [TEAMS[0]!]);
    await userEvent.click(comboboxOf(element));
    comboboxOf(element).dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Backspace',
        isComposing: true,
        bubbles: true,
        composed: true,
        cancelable: true,
      }),
    );
    expect(element.values).toEqual(['design']);
  });

  it('has-clear shows a clear-all button while there are tokens; it clears all, fires one change and focuses the input', async () => {
    const element = await make('label="Teams" has-clear');
    expect(clearAll(element)).toBeNull();
    element.items = [TEAMS[0]!, TEAMS[1]!];
    await element.updateComplete;
    expect(clearAll(element)!.getAttribute('label')).toBe('Clear all');
    const events = recordEvents(element, ['tct-selection-change', 'input', 'change']);
    await userEvent.click(clearAll(element)!);
    expect(element.values).toEqual([]);
    expect(events.events.map((event) => event.type)).toEqual([
      'tct-selection-change',
      'input',
      'change',
    ]);
    expect(events.events[0]).toMatchObject({action: 'clear', items: []});
    await waitUntil(
      () => deepActiveElement() === comboboxOf(element),
      'focus returns to the input',
    );
  });

  it('the token remove event of the tokens is not exposed by the tokenizer', async () => {
    const element = await make('label="Teams"', [TEAMS[0]!]);
    const events = recordEvents(element, 'tct-remove');
    await userEvent.click(removeOf(tokensOf(element)[0]!));
    expect(events.events).toHaveLength(0);
  });
});

describe('tct-tokenizer: max-entries', () => {
  it('at the limit the input takes no room but stays focusable, and offers no results', async () => {
    const element = await make('label="Teams" max-entries="2"', [TEAMS[0]!, TEAMS[1]!]);
    const input = comboboxOf(element);
    expect(Math.round(input.getBoundingClientRect().width)).toBe(0);
    expect(getComputedStyle(input).opacity).toBe('0');
    input.focus();
    expect(deepActiveElement()).toBe(input);
    await userEvent.keyboard('m');
    await nextFrame();
    expect(element.open).toBe(false);
    expect(element.values).toEqual(['design', 'engineering']);
  });

  it('Backspace still removes at the limit, and the input returns', async () => {
    const element = await make('label="Teams" max-entries="2"', [TEAMS[0]!, TEAMS[1]!]);
    comboboxOf(element).focus();
    await pressKeys('Backspace');
    expect(element.values).toEqual(['design']);
    await waitUntil(
      () => comboboxOf(element).getBoundingClientRect().width > 20,
      'the input is back',
    );
  });

  it('under the limit the input is shown and results are offered', async () => {
    const element = await make('label="Teams" max-entries="3"', [TEAMS[0]!]);
    expect(comboboxOf(element).getBoundingClientRect().width).toBeGreaterThan(20);
    await typeInto(element, 'e');
    await whenOpen(element);
  });

  it('adding the token that reaches the limit closes the menu', async () => {
    const element = await make('label="Teams" max-entries="1"');
    await typeInto(element, 'e');
    await whenOpen(element);
    await pressKeys('Enter');
    expect(element.values).toHaveLength(1);
    await waitUntil(() => !element.open, 'the menu closes at the limit');
  });
});

describe('tct-tokenizer: has-create', () => {
  it('offers a localised Create entry for typed text, and creating adds a token whose id and label are the text', async () => {
    const element = await make('label="Teams" has-create');
    const events = recordEvents(element, ['tct-selection-change']);
    await typeInto(element, 'QA');
    await whenOpen(element);
    expect(optionLabels(element).at(-1)).toBe('Create "QA"');
    await pressKeys('End', 'Enter');
    expect(element.items).toEqual([{id: 'QA', label: 'QA'}]);
    expect(events.events[0]).toMatchObject({action: 'create'});
  });

  it('still offers Create below min-query-length, without searching', async () => {
    const element = await make('label="Teams" has-create min-query-length="4"');
    await typeInto(element, 'QA');
    await waitUntil(
      () => element.open && optionLabels(element).length === 1,
      'the create entry opens',
    );
    expect(optionLabels(element)).toEqual(['Create "QA"']);
  });

  it('offers no menu below the threshold without has-create', async () => {
    const element = await make('label="Teams" min-query-length="4"');
    await typeInto(element, 'QA');
    await nextFrame();
    expect(element.open).toBe(false);
  });

  it('does not offer Create for a token already held, or when the text names a result exactly', async () => {
    const element = await make('label="Teams" has-create', [{id: 'QA', label: 'QA'}]);
    await typeInto(element, 'QA');
    await nextFrame();
    await nextFrame();
    expect(optionLabels(element).filter((label) => label.startsWith('Create'))).toEqual([]);
    const other = await make('label="Teams" has-create');
    await typeInto(other, 'design');
    await whenOpen(other);
    expect(optionLabels(other)).toEqual(['Design']);
  });

  it('puts Create on top of a full menu, not in place of a result', async () => {
    const element = await make('label="Teams" has-create max-menu-items="2"');
    await typeInto(element, 'e');
    await whenOpen(element);
    const labels = optionLabels(element);
    expect(labels).toHaveLength(3);
    expect(labels.at(-1)).toBe('Create "e"');
  });

  it('has-create off: no Create entry', async () => {
    const element = await make('label="Teams"');
    await typeInto(element, 'zzz');
    await waitUntil(() => optionsOf(element).length === 1, 'the empty state');
    expect(optionLabels(element)).toEqual([]);
  });
});

describe('tct-tokenizer: paste splitting (acceptance)', () => {
  const paste = (element: TctTokenizer, text: string): ClipboardEvent => {
    const data = new DataTransfer();
    data.setData('text/plain', text);
    const event = new ClipboardEvent('paste', {
      clipboardData: data,
      bubbles: true,
      composed: true,
      cancelable: true,
    });
    comboboxOf(element).dispatchEvent(event);
    return event;
  };

  it('a pasted list adds one token per entry that names a result exactly, in one change', async () => {
    const spy = spyAnnouncements();
    try {
      const element = await make();
      const events = recordEvents(element, ['tct-selection-change', 'input', 'change']);
      await userEvent.click(comboboxOf(element));
      const event = paste(element, 'Design, marketing\nSALES');
      expect(event.defaultPrevented).toBe(true);
      await waitUntil(() => element.values.length === 3, 'the tokens are added');
      expect(element.values).toEqual(['design', 'marketing', 'sales']);
      expect(events.counts()).toEqual({'tct-selection-change': 1, input: 1, change: 1});
      expect(events.events[0]).toMatchObject({action: 'add'});
      await waitUntil(() => spy.messages.includes('Added 3 items'), 'announced once as a count');
      expect(comboboxOf(element).value).toBe('');
    } finally {
      spy.restore();
    }
  });

  it('keeps what it could not resolve in the input, and searches for it', async () => {
    const element = await make();
    await userEvent.click(comboboxOf(element));
    paste(element, 'Design; Unknown; Legal');
    await waitUntil(() => element.values.length === 2, 'the tokens are added');
    expect(element.values).toEqual(['design', 'legal']);
    expect(comboboxOf(element).value).toBe('Unknown');
    expect(element.query).toBe('Unknown');
  });

  it('with has-create every unresolved entry becomes a new token; duplicates and held tokens are skipped', async () => {
    const element = await make('label="Teams" has-create', [TEAMS[0]!]);
    await userEvent.click(comboboxOf(element));
    const event = paste(element, 'Design,Alpha,alpha\nBeta,Alpha');
    expect(event.defaultPrevented).toBe(true);
    await waitUntil(() => element.values.length === 4, 'the tokens are added');
    expect(element.values).toEqual(['design', 'Alpha', 'alpha', 'Beta']);
    expect(element.items.map((item) => item.label)).toEqual(['Design', 'Alpha', 'alpha', 'Beta']);
  });

  it('respects max-entries: the entries that do not fit stay in the input', async () => {
    const element = await make('label="Teams" max-entries="2"');
    await userEvent.click(comboboxOf(element));
    paste(element, 'Design, Sales, Legal');
    await waitUntil(() => element.values.length === 2, 'two tokens fit');
    expect(element.values).toEqual(['design', 'sales']);
    expect(comboboxOf(element).value).toBe('Legal');
  });

  it('a paste without a separator, or with nothing resolvable, is ordinary typing (not intercepted)', async () => {
    const element = await make();
    await userEvent.click(comboboxOf(element));
    expect(paste(element, 'Design').defaultPrevented).toBe(false);
    await nextFrame();
    expect(element.values).toEqual([]);
    paste(element, 'Nothing, Here');
    await waitUntil(() => comboboxOf(element).value === 'Nothing, Here', 'the text is kept');
    expect(element.values).toEqual([]);
  });

  it('preventing tct-selection-change keeps the tokens (and the input text)', async () => {
    const element = await make();
    element.addEventListener('tct-selection-change', (event) => event.preventDefault());
    await userEvent.click(comboboxOf(element));
    paste(element, 'Design, Sales');
    await nextFrame();
    await nextFrame();
    expect(element.values).toEqual([]);
  });

  it('a disabled or read-only field ignores a paste', async () => {
    const element = await make('label="Teams" readonly');
    comboboxOf(element).focus();
    expect(paste(element, 'Design, Sales').defaultPrevented).toBe(false);
    await nextFrame();
    expect(element.values).toEqual([]);
  });

  it('a search that fails leaves the entry in the input instead of losing it', async () => {
    const element = await make();
    element.searchSource = {
      search: () => Promise.reject(new Error('offline')),
      bootstrap: () => [],
    };
    await userEvent.click(comboboxOf(element));
    paste(element, 'Design, Sales');
    await waitUntil(() => comboboxOf(element).value === 'Design, Sales', 'both entries stay');
    expect(element.values).toEqual([]);
  });
});

describe('tct-tokenizer: form (acceptance: repeated entries, reset, restore)', () => {
  it('submits one entry per token under the name, in order, with the id as the value', async () => {
    const form = await formHarness(
      `<tct-tokenizer label="Teams" name="teams" debounce-ms="0"></tct-tokenizer><button type="submit">go</button>`,
    );
    const element = form.form.querySelector<TctTokenizer>('tct-tokenizer')!;
    element.searchSource = createStaticSource(TEAMS);
    await element.updateComplete;
    expect(form.entries()).toEqual([]);
    await typeInto(element, 'de');
    await whenOpen(element);
    await pressKeys('Enter');
    await userEvent.keyboard('sal');
    await whenOpen(element);
    await pressKeys('Enter');
    expect(form.values('teams')).toEqual(['design', 'sales']);
    expect(form.entries()).toEqual([
      ['teams', 'design'],
      ['teams', 'sales'],
    ]);
    element.items = [];
    await element.updateComplete;
    expect(form.entries()).toEqual([]);
  });

  it('submits nothing without a name, and nothing while disabled or in a disabled fieldset', async () => {
    const form = await formHarness(
      `<fieldset><tct-tokenizer label="Teams" name="teams"></tct-tokenizer></fieldset><tct-tokenizer label="Other"></tct-tokenizer>`,
    );
    const [named, nameless] = [...form.form.querySelectorAll<TctTokenizer>('tct-tokenizer')];
    named!.items = TEAMS.slice(0, 2);
    nameless!.items = TEAMS.slice(0, 2);
    await named!.updateComplete;
    expect(form.values('teams')).toEqual(['design', 'engineering']);
    expect(form.entries()).toHaveLength(2);
    form.form.querySelector('fieldset')!.disabled = true;
    await named!.updateComplete;
    expect(form.entries()).toEqual([]);
    expect(named!.querySelector('input')).toBeNull();
  });

  it('typing text without choosing submits nothing (the query is not a value)', async () => {
    const form = await formHarness(
      `<tct-tokenizer label="Teams" name="teams" debounce-ms="0"></tct-tokenizer>`,
    );
    const element = form.form.querySelector<TctTokenizer>('tct-tokenizer')!;
    element.searchSource = createStaticSource(TEAMS);
    await typeInto(element, 'des');
    expect(form.entries()).toEqual([]);
  });

  it('reset returns to defaultItems (empty by default) and forgets the query', async () => {
    const form = await formHarness(
      `<tct-tokenizer label="Teams" name="teams" debounce-ms="0"></tct-tokenizer>`,
    );
    const element = form.form.querySelector<TctTokenizer>('tct-tokenizer')!;
    element.searchSource = createStaticSource(TEAMS);
    element.defaultItems = [TEAMS[4]!];
    await element.updateComplete;
    expect(form.values('teams')).toEqual(['support']);
    element.items = [TEAMS[0]!, TEAMS[1]!];
    await typeInto(element, 'zz');
    await element.updateComplete;
    expect(form.values('teams')).toEqual(['design', 'engineering']);
    form.reset();
    await element.updateComplete;
    expect(form.values('teams')).toEqual(['support']);
    expect(element.query).toBe('');
    expect(tokensOf(element).map((token) => token.getAttribute('label'))).toEqual(['Support']);
    element.defaultItems = undefined;
    form.reset();
    await element.updateComplete;
    expect(form.entries()).toEqual([]);
  });

  it('restores the tokens with their labels from the saved state, and plain ids from autofill', async () => {
    const form = await formHarness(`<tct-tokenizer label="Teams" name="teams"></tct-tokenizer>`);
    const element = form.form.querySelector<TctTokenizer>('tct-tokenizer')!;
    element.items = [TEAMS[0]!, TEAMS[1]!];
    await element.updateComplete;
    const saved = (element as unknown as {formState(): FormData | null}).formState();
    element.items = [];
    element.formStateRestoreCallback(saved, 'restore');
    await element.updateComplete;
    expect(element.items).toEqual([TEAMS[0], TEAMS[1]]);
    const autofill = new FormData();
    autofill.append('teams', 'legal');
    element.formStateRestoreCallback(autofill, 'autocomplete');
    await element.updateComplete;
    expect(element.items).toEqual([{id: 'legal', label: 'legal'}]);
  });

  it('required means at least one token; typed text does not satisfy it, and the error appears after a commit', async () => {
    const form = await formHarness(
      `<tct-tokenizer label="Teams" name="teams" required debounce-ms="0"></tct-tokenizer><button type="submit">go</button>`,
    );
    const element = form.form.querySelector<TctTokenizer>('tct-tokenizer')!;
    element.searchSource = createStaticSource(TEAMS);
    await element.updateComplete;
    await typeInto(element, 'des');
    expect(element.validity.valueMissing).toBe(true);
    expect(element.showInvalid).toBe(false);
    await pressKeys('Escape');
    await waitUntil(() => !element.open, 'the popup closes');
    await userEvent.click(form.form.querySelector('button')!);
    await waitUntil(() => element.showInvalid, 'the blocked submit shows the error');
    expect(form.submitEvents).toHaveLength(0);
    expect(comboboxOf(element).getAttribute('aria-invalid')).toBe('true');
    if (!isTier2) expect(hasCustomState(element, 'user-invalid')).toBe(true);
    expect(textOf(statusOf(element))).not.toBe('');
    element.items = [TEAMS[0]!];
    await element.updateComplete;
    expect(element.validity.valid).toBe(true);
  });

  it('Enter chooses while the menu is open and never submits; with it closed Enter submits the form', async () => {
    const form = await formHarness(
      `<tct-tokenizer label="Teams" name="teams" debounce-ms="0"></tct-tokenizer>`,
    );
    const element = form.form.querySelector<TctTokenizer>('tct-tokenizer')!;
    element.searchSource = createStaticSource(TEAMS);
    await typeInto(element, 'de');
    await whenOpen(element);
    await pressKeys('Enter');
    expect(form.submitEvents).toHaveLength(0);
    expect(element.values).toEqual(['design']);
    await pressKeys('Enter');
    expect(form.submitEvents).toHaveLength(1);
  });
});

describe('tct-tokenizer: focus', () => {
  it('focus arriving from outside lands on the input, not on a token remove button', async () => {
    const element = await make('label="Teams"', [TEAMS[0]!, TEAMS[1]!]);
    const after = element.parentElement!.querySelector('button')!;
    after.focus();
    await pressKeys('Shift+Tab');
    expect(deepActiveElement()).toBe(comboboxOf(element));
    // From the input, Shift+Tab does reach the tokens' remove buttons (focus moves inside the field).
    await pressKeys('Shift+Tab');
    expect(deepActiveElement()).toBe(removeOf(tokensOf(element)[1]!));
  });

  it('host.focus() and the autofocus attribute reach the input', async () => {
    const element = await make('label="Teams" autofocus', [TEAMS[0]!]);
    await waitUntil(() => deepActiveElement() === comboboxOf(element), 'autofocused');
    element.blur();
    element.focus();
    expect(deepActiveElement()).toBe(comboboxOf(element));
  });

  it('a press on the field outside the tokens focuses the input', async () => {
    const element = await make('label="Teams"', [TEAMS[0]!]);
    const box = part(element, 'input')!.getBoundingClientRect();
    await userEvent.click(part(element, 'input')!, {
      position: {x: box.width - 30, y: box.height / 2},
    });
    await waitUntil(() => deepActiveElement() === comboboxOf(element), 'the input has focus');
  });

  it('draws one focus ring around the whole box while the input has keyboard focus', async () => {
    const element = await make('label="Teams"', [TEAMS[0]!]);
    element.parentElement!.querySelector('button')!.focus();
    await pressKeys('Shift+Tab');
    const box = part(element, 'input')!;
    await waitUntil(() => getComputedStyle(box).outlineStyle !== 'none', 'the ring is drawn');
  });

  it('fires the native focus and blur on the host only when focus enters and leaves the whole field', async () => {
    const element = await make('label="Teams"', [TEAMS[0]!, TEAMS[1]!]);
    const events = recordEvents(element, ['focus', 'blur']);
    comboboxOf(element).focus();
    await pressKeys('Shift+Tab');
    await pressKeys('Shift+Tab');
    expect(events.counts()).toEqual({focus: 1, blur: 0});
    element.parentElement!.querySelector('button')!.focus();
    expect(events.counts()).toEqual({focus: 1, blur: 1});
  });
});

describe('tct-tokenizer: inline overflow', () => {
  const NAMES = ['Design', 'Engineering', 'Marketing', 'Sales', 'Support', 'Legal'];
  const many = NAMES.map((label) => ({id: label.toLowerCase(), label}));

  it('unfocused-inline keeps one row with a "+N more" indicator, and expands inline on focus', async () => {
    const element = await make('label="Teams" token-overflow="unfocused-inline"', many, 320);
    const list = (): HTMLElement | null => element.shadowRoot!.querySelector('tct-overflow-list');
    await waitUntil(() => list() !== null, 'the overflow list renders');
    const singleRow = part(element, 'input')!.getBoundingClientRect().height;
    await waitUntil(
      () =>
        textOf(list()).includes('more') || (list()!.shadowRoot?.textContent ?? '').includes('more'),
      'the indicator shows',
    );
    const indicator = list()!.shadowRoot!.querySelector('.indicator')!;
    expect(textOf(indicator)).toMatch(/^\+\d+ more$/);
    const visible = tokensOf(element).filter((token) => !token.hasAttribute('data-tct-overflow'));
    expect(visible.length).toBeLessThan(many.length);
    // Focus expands every token in place, wrapping onto more rows.
    comboboxOf(element).focus();
    await waitUntil(() => list() === null, 'the overflow list is replaced by the tokens');
    expect(tokensOf(element)).toHaveLength(many.length);
    expect(tokensOf(element).some((token) => token.hasAttribute('data-tct-overflow'))).toBe(false);
    await waitUntil(
      () => part(element, 'input')!.getBoundingClientRect().height > singleRow,
      'the field grows',
    );
    // Blur collapses again.
    element.parentElement!.querySelector('button')!.focus();
    await waitUntil(() => list() !== null, 'the overflow list returns');
  });

  it('does not truncate when there are no tokens, and none is hidden when they all fit', async () => {
    const element = await make('label="Teams" token-overflow="unfocused-inline"');
    expect(element.shadowRoot!.querySelector('tct-overflow-list')).toBeNull();
    element.items = [TEAMS[0]!];
    await element.updateComplete;
    const list = element.shadowRoot!.querySelector('tct-overflow-list');
    expect(list).not.toBeNull();
    await nextFrame();
    expect(tokensOf(element).some((token) => token.hasAttribute('data-tct-overflow'))).toBe(false);
  });

  it('the input stays mounted and named while collapsed', async () => {
    const element = await make('label="Teams" token-overflow="unfocused-inline"', many, 320);
    await waitUntil(
      () => element.shadowRoot!.querySelector('tct-overflow-list') !== null,
      'collapsed',
    );
    expect(comboboxOf(element)).not.toBeNull();
    expect(Math.round(comboboxOf(element).getBoundingClientRect().width)).toBe(0);
    if (isChromium) expect((await axNode(comboboxOf(element))).name).toBe('Teams');
  });
});

describe('tct-tokenizer: focus bootstrap lifecycle (upstream spec DEC-2, FR13-FR15)', () => {
  it('choosing from the empty-query cohort keeps the menu open on the remaining results, next option active', async () => {
    const element = await make('label="Teams" entries-on-focus');
    element.focus();
    await whenOpen(element);
    await pressKeys('ArrowDown');
    expect(textOf(activeOption(element))).toBe('Engineering');
    await pressKeys('Enter');
    expect(element.values).toEqual(['engineering']);
    expect(element.open).toBe(true);
    expect(optionLabels(element)).toEqual(['Design', 'Marketing', 'Sales', 'Support', 'Legal']);
    expect(textOf(activeOption(element))).toBe('Marketing');
    expect(deepActiveElement()).toBe(comboboxOf(element));
  });

  it('when the chosen option was last, the nearest preceding option becomes active', async () => {
    const element = await make('label="Teams" entries-on-focus');
    element.focus();
    await whenOpen(element);
    await pressKeys('End', 'Enter');
    expect(element.values).toEqual(['legal']);
    expect(textOf(activeOption(element))).toBe('Support');
  });

  it('closes when no eligible result remains, at max-entries, when disabled, and on Escape; a late response cannot reopen it', async () => {
    const element = await make('label="Teams" entries-on-focus');
    element.searchSource = createStaticSource(TEAMS.slice(0, 2));
    element.focus();
    await whenOpen(element);
    await pressKeys('Enter');
    expect(element.open).toBe(true);
    await pressKeys('Enter');
    await waitUntil(() => !element.open, 'the menu closes when nothing remains');
    expect(element.values).toEqual(['design', 'engineering']);
    expect(comboboxOf(element).getAttribute('aria-activedescendant')).toBeNull();

    const limited = await make('label="Teams" entries-on-focus max-entries="1"');
    limited.focus();
    await whenOpen(limited);
    await pressKeys('Enter');
    await waitUntil(() => !limited.open, 'the menu closes at max-entries');

    const escaped = await make('label="Teams" entries-on-focus');
    escaped.focus();
    await whenOpen(escaped);
    await pressKeys('Enter', 'Escape');
    await waitUntil(() => !escaped.open, 'Escape closes the retained menu');
  });

  it('without entries-on-focus a choice closes the menu as before', async () => {
    const element = await make();
    await typeInto(element, 'e');
    await whenOpen(element);
    await pressKeys('Enter');
    await waitUntil(() => !element.open, 'the menu closes');
  });
});

describe('tct-tokenizer: disabled and read-only', () => {
  it('disabled: tokens are disabled without remove buttons, the input is natively disabled, nothing is submitted', async () => {
    const element = await make('label="Teams" disabled', [TEAMS[0]!]);
    expect(comboboxOf(element).disabled).toBe(true);
    const [token] = tokensOf(element);
    expect(token!.hasAttribute('disabled')).toBe(true);
    expect(token!.hasAttribute('removable')).toBe(false);
    expect(clearAll(element)).toBeNull();
  });

  it('disabled-message keeps the input focusable (aria-disabled), blocks typing and removal, and describes the reason', async () => {
    const element = await make(
      'label="Teams" disabled disabled-message="You need the Editor role"',
      [TEAMS[0]!],
    );
    const input = comboboxOf(element);
    expect(input.disabled).toBe(false);
    expect(input.getAttribute('aria-disabled')).toBe('true');
    expect(input.readOnly).toBe(true);
    input.focus();
    await userEvent.keyboard('x');
    expect(input.value).toBe('');
    await userEvent.keyboard('{Backspace}');
    expect(element.values).toEqual(['design']);
    if (isChromium) expect((await axNode(input)).description).toContain('You need the Editor role');
  });

  it('read-only: tokens have no remove button and nothing can be added or removed', async () => {
    const element = await make('label="Teams" readonly', [TEAMS[0]!]);
    expect(tokensOf(element)[0]!.hasAttribute('removable')).toBe(false);
    comboboxOf(element).focus();
    await userEvent.keyboard('x{Backspace}{Backspace}');
    expect(element.values).toEqual(['design']);
  });

  it('becoming disabled while the menu is open closes it', async () => {
    const element = await make();
    await typeInto(element, 'e');
    await whenOpen(element);
    element.disabled = true;
    await waitUntil(() => !element.open, 'the menu closes');
  });
});

describe('tct-tokenizer: busy and custom rendering', () => {
  it('shows one spinner in the end lane and :state(busy) while a search is pending', async () => {
    const element = await make();
    const control = controlledSource();
    element.searchSource = control.source;
    await typeInto(element, 'a');
    await waitUntil(() => control.calls.length === 1, 'search pending');
    await element.updateComplete;
    expect(element.shadowRoot!.querySelectorAll('tct-spinner')).toHaveLength(1);
    expect(element.shadowRoot!.querySelector('.end-lane tct-spinner')).not.toBeNull();
    if (!isTier2) expect(hasCustomState(element, 'busy')).toBe(true);
    control.calls[0]!.resolve([TEAMS[0]!]);
    await waitUntil(() => !element.shadowRoot!.querySelector('tct-spinner'), 'the spinner goes');
  });

  it('renderToken replaces the token markup and gets a remove callback that removes the item', async () => {
    const element = await make('label="Teams"', [TEAMS[0]!, TEAMS[1]!]);
    element.renderToken = (item, remove) =>
      html`<button type="button" class="mine" @click=${remove}>
        ${item.label.toUpperCase()}
      </button>`;
    await element.updateComplete;
    const mine = [...element.shadowRoot!.querySelectorAll<HTMLButtonElement>('.mine')];
    expect(mine.map((button) => textOf(button))).toEqual(['DESIGN', 'ENGINEERING']);
    expect(tokensOf(element)).toHaveLength(0);
    mine[0]!.click();
    expect(element.values).toEqual(['engineering']);
  });

  it('renderItem replaces the result rows, and search results render through tct-typeahead-item by default', async () => {
    const element = await make();
    await typeInto(element, 'de');
    await whenOpen(element);
    expect(optionsOf(element)[0]!.querySelector('tct-typeahead-item')).not.toBeNull();
    element.renderItem = (item) => html`<em class="mine">${item.label}</em>`;
    await element.updateComplete;
    expect(optionsOf(element)[0]!.querySelector('.mine')?.textContent).toBe('Design');
  });
});

describe('tct-tokenizer: accessibility, RTL, forced colours and i18n', () => {
  it('passes axe at rest, with tokens, open, at max-entries, collapsed, disabled and invalid', async () => {
    const element = await make('label="Teams" has-clear');
    await expectAccessible(element);
    element.items = [TEAMS[0]!, TEAMS[1]!];
    await element.updateComplete;
    await motionDone(element);
    await expectAccessible(element);
    element.maxEntries = 2;
    await element.updateComplete;
    await expectAccessible(element);
    element.maxEntries = undefined;
    element.tokenOverflow = 'unfocused-inline';
    await element.updateComplete;
    await nextFrame();
    await expectAccessible(element);
    element.tokenOverflow = 'none';
    element.disabled = true;
    await element.updateComplete;
    await motionDone(element);
    await expectAccessible(element, {rules: {'color-contrast': {enabled: false}}});
    element.disabled = false;
    element.status = {type: 'error', message: 'Add a team'};
    await element.updateComplete;
    await motionDone(element);
    await expectAccessible(element);
    element.status = undefined;
    await element.updateComplete;
    await typeInto(element, 'm');
    await whenOpen(element);
    await motionDone(element);
    await expectAccessible(element);
  });

  it('forced colours: the box and the tokens keep a system-colour edge', async () => {
    if (!isChromium) return;
    const element = await make('label="Teams"', [TEAMS[0]!]);
    await emulateMedia({forcedColors: 'active'});
    try {
      await nextFrame();
      expect(getComputedStyle(part(element, 'input')!).borderTopColor).not.toBe('rgba(0, 0, 0, 0)');
      const token = tokensOf(element)[0]!.shadowRoot!.querySelector('.base')!;
      expect(getComputedStyle(token).borderTopColor).not.toBe('rgba(0, 0, 0, 0)');
    } finally {
      await emulateMedia({forcedColors: 'none'});
    }
  });

  it('RTL: tokens start at the right, the end controls sit at the left, and the menu aligns to the field', async () => {
    const wrapper = await fixture<HTMLElement>(
      `<div dir="rtl" style="padding:24px 24px 300px;inline-size:420px"><tct-tokenizer label="فرق" has-clear debounce-ms="0"></tct-tokenizer></div>`,
      {lang: 'ar-SA'},
    );
    const element = wrapper.querySelector<TctTokenizer>('tct-tokenizer')!;
    element.searchSource = createStaticSource(TEAMS);
    element.items = [TEAMS[0]!, TEAMS[1]!];
    await element.updateComplete;
    await waitUntil(() => tokensOf(element).length === 2, 'tokens render');
    await waitUntil(
      () => comboboxOf(element).placeholder !== 'Search…',
      'the Arabic catalog loaded',
    );
    const box = part(element, 'input')!.getBoundingClientRect();
    const first = tokensOf(element)[0]!.getBoundingClientRect();
    const clear = clearAll(element)!.getBoundingClientRect();
    expect(box.right - first.right).toBeLessThan(20);
    expect(clear.left - box.left).toBeLessThan(box.width / 3);
    await typeInto(element, 'm');
    await whenOpen(element);
    await waitUntil(
      () => element.shadowRoot!.querySelector('.popup')!.getBoundingClientRect().width > 0,
      'the popup is laid out',
    );
    const popup = element.shadowRoot!.querySelector('.popup')!.getBoundingClientRect();
    expect(Math.abs(popup.right - box.right)).toBeLessThan(2);
  });

  it('focus() and blur() reach the input, not the first token (upstream handleRef)', async () => {
    const element = await make('label="Teams"', [TEAMS[0]!, TEAMS[1]!]);
    element.focus();
    expect(element.shadowRoot!.activeElement).toBe(comboboxOf(element));
    element.blur();
    expect(element.shadowRoot!.activeElement).toBeNull();
  });

  it('de-DE: the clear label, the token names and the announcements come from the catalog', async () => {
    const spy = spyAnnouncements();
    try {
      const wrapper = await fixture<HTMLElement>(
        `<div lang="de-DE" style="padding:24px 24px 300px;inline-size:420px"><tct-tokenizer label="Teams" has-clear debounce-ms="0"></tct-tokenizer></div>`,
      );
      const element = wrapper.querySelector<TctTokenizer>('tct-tokenizer')!;
      element.searchSource = createStaticSource(TEAMS);
      element.items = [TEAMS[0]!];
      await element.updateComplete;
      await waitUntil(
        () =>
          comboboxOf(element) !== null &&
          clearAll(element)?.getAttribute('label') === 'Alle löschen',
        'German catalog loaded',
      );
      expect(removeOf(tokensOf(element)[0]!).getAttribute('aria-label')).toBe('Design entfernen');
      await userEvent.click(removeOf(tokensOf(element)[0]!));
      expect(spy.messages).toContain('Design entfernt');
    } finally {
      spy.restore();
    }
  });

  it('the Create entry and the "+N more" indicator are localised', async () => {
    const wrapper = await fixture<HTMLElement>(
      `<div lang="de-DE" style="padding:24px 24px 300px;inline-size:420px"><tct-tokenizer label="Teams" has-create debounce-ms="0"></tct-tokenizer></div>`,
    );
    const element = wrapper.querySelector<TctTokenizer>('tct-tokenizer')!;
    element.searchSource = createStaticSource(TEAMS);
    await element.updateComplete;
    // The placeholder changes once the German typeahead catalog has loaded; typing before that would retarget.
    await waitUntil(() => comboboxOf(element).placeholder !== 'Search…', 'German catalog loaded');
    // The new messages are not translated: they fall back to English until the catalogs carry them.
    await typeInto(element, 'QA');
    await whenOpen(element);
    expect(optionLabels(element).at(-1)).toBe('Create "QA"');
  });
});
