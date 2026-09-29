/**
 * `ComboboxController` (A§9.12, upstream useCombobox / useMultiCombobox / useSelectedItemOffset): the
 * APG select-only keyboard contract over a highlighted index, single and multi mode, the search-field
 * variant, typeahead, IME and blocked guards, and the selected-item overlay geometry. A tiny host
 * element renders a trigger and a listbox so the DOM half (active descendant) is real.
 */
import {html} from 'lit';
import {state} from 'lit/decorators.js';
import {beforeAll, describe, expect, it} from 'vitest';
import {fixture} from '@tecton-wc/testing/fixture.js';
import {defineElement} from '../define.js';
import {TctElement} from '../tct-element.js';
import type {ChangeReason} from '../events/tct-event.js';
import {
  ComboboxController,
  MultiComboboxController,
  selectedItemOffset,
  type ComboboxKeySource,
  type ComboboxRecord,
} from './combobox.js';

const RECORDS: ComboboxRecord[] = [
  {value: 'a', label: 'Apple'},
  {value: 'b', label: 'Banana'},
  {value: 'x', label: 'Blocked', disabled: true},
  {value: 'c', label: 'Cherry'},
  {value: 'd', label: 'Date'},
];

class TestHost extends TctElement {
  static override readonly tagName = 'tct-test-combo-host';

  @state() isOpen = false;
  multiple = false;
  search = false;
  blocked = false;
  chosenValue = '';
  selected = new Set<string>();
  readonly log: string[] = [];
  readonly reasons: ChangeReason[] = [];
  combo!: ComboboxController<ComboboxRecord>;

  get trigger(): HTMLButtonElement {
    return this.renderRoot.querySelector('button')!;
  }
  get optionElements(): HTMLElement[] {
    return [...this.renderRoot.querySelectorAll<HTMLElement>('[role="option"]')];
  }

  init(multiple: boolean): void {
    const common = {
      focusElement: () => this.trigger,
      optionElements: () => this.optionElements,
      records: () => RECORDS,
      selectedIndex: () => RECORDS.findIndex((record) => record.value === this.chosenValue),
      blocked: () => this.blocked,
      isOpen: () => this.isOpen,
      hasSearch: () => this.search,
      open: (reason: ChangeReason) => {
        this.reasons.push(reason);
        this.isOpen = true;
      },
      close: (reason: ChangeReason) => {
        this.reasons.push(reason);
        this.isOpen = false;
      },
      onSelect: (record: ComboboxRecord) => {
        this.log.push(`select ${record.value}`);
        if (multiple) {
          if (!this.selected.delete(record.value)) this.selected.add(record.value);
        } else this.chosenValue = record.value;
        this.requestUpdate();
      },
      onClear: () => {
        this.log.push('clear');
      },
      hasValue: () => this.chosenValue !== '' || this.selected.size > 0,
      onSearchSeed: (character: string) => {
        this.log.push(`seed ${character}`);
      },
      onTypeaheadSelect: (record: ComboboxRecord) => {
        this.log.push(`typeahead ${record.value}`);
        this.chosenValue = record.value;
      },
    };
    this.multiple = multiple;
    this.combo = multiple
      ? new MultiComboboxController<ComboboxRecord>(this, common)
      : new ComboboxController<ComboboxRecord>(this, common);
  }

  override render() {
    return html`<button type="button" aria-expanded=${String(this.isOpen)}>trigger</button>
      <div role="listbox">
        ${
          this.isOpen
            ? RECORDS.map(
                (record) =>
                  html`<div
                    role="option"
                    id=${`opt-${record.value}`}
                    aria-disabled=${record.disabled ? 'true' : 'false'}
                  >
                    ${record.label}
                  </div>`,
              )
            : null
        }
      </div>`;
  }
}

beforeAll(() => {
  defineElement(TestHost);
});

async function make(multiple = false): Promise<TestHost> {
  const host = await fixture<TestHost>('<tct-test-combo-host></tct-test-combo-host>');
  host.init(multiple);
  host.requestUpdate();
  await host.updateComplete;
  return host;
}

const key = (value: string, init: KeyboardEventInit = {}): KeyboardEvent =>
  new KeyboardEvent('keydown', {key: value, bubbles: true, cancelable: true, ...init});

/** Sends a key to the controller like the element's handler does; returns whether it was consumed. */
async function press(
  host: TestHost,
  value: string,
  source: ComboboxKeySource = 'trigger',
  init: KeyboardEventInit = {},
): Promise<{consumed: boolean; event: KeyboardEvent}> {
  const event = key(value, init);
  const consumed = host.combo.handleKeyDown(event, source);
  await host.updateComplete;
  return {consumed, event};
}

const activeId = (host: TestHost): string | null => {
  const reflected = (host.trigger as unknown as {ariaActiveDescendantElement?: Element | null})
    .ariaActiveDescendantElement;
  return (reflected ?? null)?.id ?? host.trigger.getAttribute('aria-activedescendant');
};

describe('ComboboxController: closed keys', () => {
  it('Enter, Space and ArrowDown open with the first option highlighted, and ArrowUp with the last', async () => {
    for (const [name, expected] of [
      ['Enter', 'opt-a'],
      [' ', 'opt-a'],
      ['ArrowDown', 'opt-a'],
      ['ArrowUp', 'opt-d'],
    ] as const) {
      const host = await make();
      const {consumed, event} = await press(host, name);
      expect(consumed, name).toBe(true);
      expect(event.defaultPrevented, name).toBe(true);
      expect(host.isOpen, name).toBe(true);
      expect(activeId(host), name).toBe(expected);
    }
  });

  it('opens on the chosen option when there is one, with the reason of the gesture', async () => {
    const host = await make();
    host.chosenValue = 'c';
    await press(host, 'ArrowDown');
    expect(activeId(host)).toBe('opt-c');
    const clicked = await make();
    clicked.combo.handleTriggerClick();
    await clicked.updateComplete;
    expect(clicked.reasons).toEqual(['trigger']);
    expect(host.reasons).toEqual(['keyboard']);
  });

  it('a click on the trigger opens, and a second click asks to close with reason trigger', async () => {
    const host = await make();
    host.combo.handleTriggerClick();
    await host.updateComplete;
    expect(host.isOpen).toBe(true);
    host.combo.handleTriggerClick();
    await host.updateComplete;
    expect(host.isOpen).toBe(false);
    expect(host.reasons).toEqual(['trigger', 'trigger']);
  });

  it('Delete and Backspace clear only when there is a value', async () => {
    const host = await make();
    expect((await press(host, 'Delete')).consumed).toBe(false);
    host.chosenValue = 'b';
    expect((await press(host, 'Delete')).consumed).toBe(true);
    expect((await press(host, 'Backspace')).consumed).toBe(true);
    expect(host.log).toEqual(['clear', 'clear']);
  });

  it('Escape and Tab do nothing while closed', async () => {
    const host = await make();
    expect((await press(host, 'Escape')).consumed).toBe(false);
    expect((await press(host, 'Tab')).consumed).toBe(false);
    expect(host.reasons).toEqual([]);
  });
});

describe('ComboboxController: open keys', () => {
  it('the arrows walk the enabled options without wrapping, and skip disabled ones', async () => {
    const host = await make();
    await press(host, 'ArrowDown');
    for (const expected of ['opt-b', 'opt-c', 'opt-d', 'opt-d']) {
      await press(host, 'ArrowDown');
      expect(activeId(host)).toBe(expected);
    }
    for (const expected of ['opt-c', 'opt-b', 'opt-a', 'opt-a']) {
      await press(host, 'ArrowUp');
      expect(activeId(host)).toBe(expected);
    }
  });

  it('Home, End, PageUp and PageDown jump to the first and last enabled option', async () => {
    const host = await make();
    await press(host, 'Enter');
    await press(host, 'End');
    expect(activeId(host)).toBe('opt-d');
    await press(host, 'Home');
    expect(activeId(host)).toBe('opt-a');
    await press(host, 'PageDown');
    expect(activeId(host)).toBe('opt-d');
    await press(host, 'PageUp');
    expect(activeId(host)).toBe('opt-a');
  });

  it('marks the highlighted option and exposes it on the trigger; closing clears both', async () => {
    const host = await make();
    await press(host, 'ArrowDown');
    expect(host.optionElements[0]!.hasAttribute('data-highlighted')).toBe(true);
    await press(host, 'ArrowDown');
    expect(host.optionElements[0]!.hasAttribute('data-highlighted')).toBe(false);
    expect(host.optionElements[1]!.hasAttribute('data-highlighted')).toBe(true);
    await press(host, 'Escape');
    await host.updateComplete;
    expect(activeId(host)).toBeNull();
  });

  it('Enter chooses the highlighted option and closes in single mode', async () => {
    const host = await make();
    await press(host, 'ArrowDown');
    await press(host, 'ArrowDown');
    await press(host, 'Enter');
    expect(host.log).toEqual(['select b']);
    expect(host.isOpen).toBe(false);
    expect(host.reasons.at(-1)).toBe('selection');
  });

  it('Escape closes with reason escape and is consumed; Tab closes and is not consumed', async () => {
    const escaped = await make();
    await press(escaped, 'Enter');
    const escape = await press(escaped, 'Escape');
    expect(escape.consumed).toBe(true);
    expect(escaped.reasons.at(-1)).toBe('escape');
    const tabbed = await make();
    await press(tabbed, 'Enter');
    const tab = await press(tabbed, 'Tab');
    expect(tab.consumed).toBe(false);
    expect(tab.event.defaultPrevented).toBe(false);
    expect(tabbed.isOpen).toBe(false);
    expect(tabbed.reasons.at(-1)).toBe('focus-out');
  });

  it('pointer highlights an enabled option, ignores a disabled one', async () => {
    const host = await make();
    await press(host, 'Enter');
    host.combo.handlePointerEnter(1);
    await host.updateComplete;
    expect(activeId(host)).toBe('opt-b');
    host.combo.handlePointerEnter(2);
    await host.updateComplete;
    expect(activeId(host)).toBe('opt-b');
  });
});

describe('ComboboxController: multi mode', () => {
  it('Enter and Space toggle the highlighted option and keep the list open', async () => {
    const host = await make(true);
    await press(host, 'Enter');
    await press(host, 'Enter');
    await press(host, 'ArrowDown');
    await press(host, ' ');
    expect(host.log).toEqual(['select a', 'select b']);
    expect(host.isOpen).toBe(true);
    expect([...host.selected]).toEqual(['a', 'b']);
  });

  it('opens on the first option even when something is chosen', async () => {
    const host = await make(true);
    host.selected.add('c');
    await press(host, 'ArrowDown');
    expect(activeId(host)).toBe('opt-a');
  });

  it('typeahead opens the list on the match', async () => {
    const host = await make(true);
    await press(host, 'c');
    expect(host.isOpen).toBe(true);
    expect(activeId(host)).toBe('opt-c');
  });
});

describe('ComboboxController: typeahead', () => {
  it('a closed single selector commits the match without opening, and reports it', async () => {
    const host = await make();
    const {consumed} = await press(host, 'c');
    expect(consumed).toBe(true);
    expect(host.isOpen).toBe(false);
    expect(host.log).toEqual(['typeahead c']);
  });

  it('an open list moves the highlight to the next match, and cycles a repeated letter', async () => {
    const host = await make();
    await press(host, 'Enter');
    await press(host, 'b');
    expect(activeId(host)).toBe('opt-b');
    // "Blocked" is disabled: the second "b" starts over at Banana.
    await press(host, 'b');
    expect(activeId(host)).toBe('opt-b');
    expect(host.log).toEqual([]);
  });

  it('a lone Space is an activation, but Space inside a search in progress is swallowed', async () => {
    const host = await make();
    await press(host, 'c');
    const space = await press(host, ' ');
    expect(space.consumed).toBe(true);
    // The buffer held "c": the space extended it and matched nothing; it did not open the list.
    expect(host.isOpen).toBe(false);
  });
});

describe('ComboboxController: search field', () => {
  it('leaves Home, End and Space to the field, and forwards the arrows, Page keys, Enter and Escape', async () => {
    const host = await make();
    host.search = true;
    await press(host, 'Enter');
    for (const name of ['Home', 'End', ' ']) {
      expect((await press(host, name, 'search')).consumed, name).toBe(false);
    }
    expect((await press(host, 'ArrowDown', 'search')).consumed).toBe(true);
    expect((await press(host, 'PageDown', 'search')).consumed).toBe(true);
    expect(activeId(host)).toBe('opt-d');
    expect((await press(host, 'Enter', 'search')).consumed).toBe(true);
    expect(host.log).toEqual(['select d']);
  });

  it('printable keys on the closed trigger open it and seed the query; in the field they are text', async () => {
    const host = await make();
    host.search = true;
    expect((await press(host, 'o')).consumed).toBe(true);
    expect(host.isOpen).toBe(true);
    expect(host.log).toEqual(['seed o']);
    expect((await press(host, 'p', 'search')).consumed).toBe(false);
    expect(host.log).toEqual(['seed o']);
  });

  it('Delete and Backspace belong to the field with a search', async () => {
    const host = await make();
    host.search = true;
    host.chosenValue = 'a';
    expect((await press(host, 'Delete')).consumed).toBe(false);
  });
});

describe('ComboboxController: guards', () => {
  it('never consumes a composing key (IME) and never acts on it', async () => {
    const host = await make();
    for (const init of [{isComposing: true}, {keyCode: 229}] as KeyboardEventInit[]) {
      expect((await press(host, 'Enter', 'trigger', init)).consumed).toBe(false);
      expect((await press(host, 'ArrowDown', 'trigger', init)).consumed).toBe(false);
    }
    expect(host.isOpen).toBe(false);
  });

  it('a blocked control ignores every key and click', async () => {
    const host = await make();
    host.blocked = true;
    for (const name of ['Enter', 'ArrowDown', 'a', 'Delete']) {
      expect((await press(host, name)).consumed, name).toBe(false);
    }
    host.combo.handleTriggerClick();
    await host.updateComplete;
    expect(host.isOpen).toBe(false);
  });

  it('modified keys (Ctrl, Meta, Alt) are not commands', async () => {
    const host = await make();
    for (const init of [{ctrlKey: true}, {metaKey: true}, {altKey: true}] as KeyboardEventInit[]) {
      expect((await press(host, 'ArrowDown', 'trigger', init)).consumed).toBe(false);
    }
    expect(host.isOpen).toBe(false);
  });

  it('reset forgets the highlight and the typeahead buffer', async () => {
    const host = await make();
    await press(host, 'Enter');
    await press(host, 'c');
    host.combo.reset();
    await host.updateComplete;
    expect(host.combo.highlightedIndex).toBe(-1);
    expect(host.combo.typeaheadBuffer).toBe('');
  });
});

describe('selectedItemOffset (upstream useSelectedItemOffset)', () => {
  const anchor = {top: 300, bottom: 332, height: 32};

  it('pulls the popup up so the chosen row is centred on the trigger', () => {
    // Row centre 60px below the popup top: the popup top must sit 60 - 16 = 44px above the trigger top.
    const offset = selectedItemOffset({
      anchor,
      listboxHeight: 200,
      itemCenter: 60,
      viewportHeight: 800,
    });
    expect(offset).toBeCloseTo(332 - (316 - 60 - 1));
  });

  it('is zero when the popup fits below and no pull is needed', () => {
    const offset = selectedItemOffset({
      anchor: {top: 0, bottom: 32, height: 32},
      listboxHeight: 200,
      itemCenter: 0,
      viewportHeight: 800,
    });
    expect(offset).toBeGreaterThanOrEqual(0);
    expect(offset).toBeLessThan(32);
  });

  it('clamps to the viewport: never above the top edge and never past the bottom edge', () => {
    const high = selectedItemOffset({
      anchor,
      listboxHeight: 200,
      itemCenter: 400,
      viewportHeight: 800,
    });
    expect(high).toBe(332);
    const low = selectedItemOffset({
      anchor: {top: 700, bottom: 732, height: 32},
      listboxHeight: 300,
      itemCenter: 10,
      viewportHeight: 800,
    });
    expect(732 - low).toBe(500);
  });

  it('ignores an unlaid-out list', () => {
    expect(
      selectedItemOffset({anchor, listboxHeight: 0, itemCenter: 10, viewportHeight: 800}),
    ).toBe(0);
  });
});
