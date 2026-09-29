/**
 * tct-selector: the element and form-control suites, then rendering, the popup, choosing, clear, disabled
 * with a reason, read-only, sections and dividers, custom rows and values, status, the InputGroup,
 * events, accessibility, RTL and forced colours. Ported from upstream Selector.test.tsx where the
 * behaviour applies.
 */
import {html} from 'lit';
import {page, userEvent} from 'vitest/browser';
import {describe, expect, it} from 'vitest';
import {deepActiveElement} from '@tecton-wc/core/utils/focus.js';
import {axNode, expectAccessible} from '@tecton-wc/testing/a11y.js';
import {emulateMedia} from '@tecton-wc/testing/emulate.js';
import {expectEventFlags, recordEvents} from '@tecton-wc/testing/events.js';
import {fixture} from '@tecton-wc/testing/fixture.js';
import {formHarness, hasCustomState} from '@tecton-wc/testing/forms.js';
import {pressKeys} from '@tecton-wc/testing/keyboard.js';
import {runElementSuite} from '@tecton-wc/testing/suites/element.js';
import {runFormControlSuite} from '@tecton-wc/testing/suites/form-control.js';
import {runOverlaySuite} from '@tecton-wc/testing/suites/overlay.js';
import {isChromium, isTier2} from '@tecton-wc/testing/tier.js';
import {animationsFinished, nextFrame, waitUntil} from '@tecton-wc/testing/timing.js';
import '../field/define.js';
import '../form-layout/define.js';
import '../input-group/define.js';
import '../tooltip/define.js';
import './define.js';
import type {SelectorOptionType} from './selector.types.js';
import type {TctSelector} from './tct-selector.js';
import {
  FRUIT,
  GROUPED,
  closed,
  isShown,
  layerOf,
  listboxOf,
  mountSelect,
  openByClick,
  optionTexts,
  optionsOf,
  trigger,
} from './selector-test-helpers.js';

const make = (attributes = 'label="Fruit"', options: SelectorOptionType[] = FRUIT) =>
  mountSelect<TctSelector>('tct-selector', attributes, options);

const part = (el: TctSelector, name: string): HTMLElement | null =>
  el.shadowRoot!.querySelector<HTMLElement>(`[part~="${name}"]`);

runElementSuite({
  tag: 'tct-selector',
  render: () => html`<tct-selector label="Fruit" name="fruit"></tct-selector>`,
  properties: {
    label: 'Other',
    description: 'Help',
    placeholder: 'Pick one',
    variant: 'ghost',
    size: 'lg',
    hasClear: true,
    hasSearch: true,
    startIcon: 'search',
    presentation: 'adaptive',
    optionsState: 'loading',
    indicatorPosition: 'start',
    loading: true,
    width: 240,
  },
  attributes: {
    label: 'label',
    description: 'description',
    placeholder: 'placeholder',
    variant: 'variant',
    size: 'size',
    hasClear: 'has-clear',
    hasSearch: 'has-search',
    startIcon: 'start-icon',
    presentation: 'presentation',
    optionsState: 'options-state',
    indicatorPosition: 'indicator-position',
    loading: 'loading',
    width: 'width',
  },
  events: ['tct-open-change', 'tct-after-open-change', 'tct-clear'],
});

runFormControlSuite({
  tag: 'tct-selector',
  render: (attributes) => `<tct-selector label="Fruit" ${attributes}></tct-selector>`,
  validValue: 'Banana',
  setValid: (el) => {
    (el as unknown as TctSelector).options = FRUIT;
    el.value = 'Banana';
  },
  setEmpty: (el) => {
    (el as unknown as TctSelector).options = FRUIT;
    el.value = '';
  },
  required: true,
  readonly: true,
  userEdit: async (el) => {
    const selector = el as unknown as TctSelector;
    selector.options = FRUIT;
    await selector.updateComplete;
    await userEvent.click(trigger(selector));
    await waitUntil(() => selector.open, 'open');
    await nextFrame();
    await userEvent.click(optionsOf(selector)[1]!);
    await waitUntil(() => !selector.open, 'closed');
    await pressKeys('Tab');
  },
  innerFocusable: (el) => trigger(el),
});

describe('tct-selector: rendering', () => {
  it('shows the localized placeholder until something is chosen, and a custom one', async () => {
    const el = await make();
    expect(part(el, 'placeholder')!.textContent.trim()).toBe('Select…');
    el.placeholder = 'Choose a fruit';
    await el.updateComplete;
    expect(part(el, 'placeholder')!.textContent.trim()).toBe('Choose a fruit');
  });

  it('shows the chosen option label, and the placeholder for a value that is not an option', async () => {
    const el = await make('label="Fruit" value="Banana"');
    expect(part(el, 'value')!.textContent.trim()).toBe('Banana');
    el.value = 'Kiwi';
    await el.updateComplete;
    expect(part(el, 'placeholder')).not.toBeNull();
  });

  it('shows the label of an object option, not its value', async () => {
    const el = await make('label="Fruit" value="b"', [
      {value: 'a', label: 'Apple'},
      {value: 'b', label: 'Banana'},
    ]);
    expect(part(el, 'value')!.textContent.trim()).toBe('Banana');
  });

  it('is a combobox named by its label with the popup announced as a listbox', async () => {
    const el = await make();
    const button = trigger(el);
    expect(button.getAttribute('role')).toBe('combobox');
    expect(button.getAttribute('aria-haspopup')).toBe('listbox');
    expect(button.getAttribute('aria-expanded')).toBe('false');
    if (isChromium) {
      const node = await axNode(button);
      expect(node.role).toBe('combobox');
      expect(node.name).toBe('Fruit');
    }
  });

  it('draws the trigger of every size and variant', async () => {
    for (const size of ['sm', 'md', 'lg']) {
      const el = await make(`label="Fruit" size="${size}"`);
      const box = part(el, 'input')!;
      const min = getComputedStyle(box).minBlockSize;
      expect(parseFloat(min), size).toBeGreaterThan(20);
    }
    const ghost = await make('label="Fruit" variant="ghost" value="Apple"');
    expect(ghost.variant).toBe('ghost');
    expect(getComputedStyle(part(ghost, 'input')!).borderTopColor).toBe('rgba(0, 0, 0, 0)');
  });

  it('shows the start icon instead of the chosen option icon', async () => {
    const withOptionIcon = await make('label="Fruit" value="a"', [
      {value: 'a', label: 'Apple', icon: 'search'},
    ]);
    expect(withOptionIcon.shadowRoot!.querySelector('.value-icon')).not.toBeNull();
    const withStart = await make('label="Fruit" value="a" start-icon="info"', [
      {value: 'a', label: 'Apple', icon: 'search'},
    ]);
    expect(withStart.shadowRoot!.querySelector('.value-icon')).toBeNull();
    expect(part(withStart, 'start-icon')!.getAttribute('name')).toBe('info');
  });

  it('renders the chosen option through renderValue, and never for the placeholder', async () => {
    const el = await make('label="Fruit"');
    let calls = 0;
    el.renderValue = (option) => {
      calls++;
      return html`<tct-selector-option
        label=${option.label ?? option.value}
        description="Chosen"
      ></tct-selector-option>`;
    };
    await el.updateComplete;
    expect(calls).toBe(0);
    el.value = 'Pear';
    await el.updateComplete;
    expect(calls).toBeGreaterThan(0);
    const value = el.shadowRoot!.querySelector('tct-selector-value')!;
    expect(value.querySelector('tct-selector-option')!.getAttribute('label')).toBe('Pear');
  });

  it('folds a custom value onto one line inside an input group', async () => {
    const root = await fixture<HTMLElement>(
      `<div style="padding:24px;inline-size:420px"><tct-input-group label="Fruit">
        <tct-selector label="Fruit" value="b"></tct-selector></tct-input-group></div>`,
    );
    const el = root.querySelector<TctSelector>('tct-selector')!;
    el.options = [{value: 'b', label: 'Banana', description: 'Yellow'}];
    el.renderValue = (option) =>
      html`<tct-selector-option
        label=${option.label ?? option.value}
        description=${option.description ?? ''}
      ></tct-selector-option>`;
    await el.updateComplete;
    await nextFrame();
    const value = el.shadowRoot!.querySelector('tct-selector-value')!;
    expect(value.getAttribute('layout')).toBe('inline');
    const option = value.querySelector('tct-selector-option')!;
    await (option as unknown as {updateComplete: Promise<boolean>}).updateComplete;
    expect(option.shadowRoot!.querySelector('tct-item')!.getAttribute('layout')).toBe('inline');
  });

  it('shows the busy spinner and aria-busy while loading, and keeps the options selectable', async () => {
    const el = await make('label="Fruit" loading');
    expect(trigger(el).getAttribute('aria-busy')).toBe('true');
    expect(part(el, 'busy')).not.toBeNull();
    await openByClick(el);
    expect(optionTexts(el)).toEqual(['Apple', 'Banana', 'Orange', 'Pear']);
    await userEvent.click(optionsOf(el)[2]!);
    expect(el.value).toBe('Orange');
  });

  it('draws a status: the box border, the glyph in place of the chevron, and the message', async () => {
    const el = await make('label="Fruit" status-type="error" status-message="Pick one"');
    expect(part(el, 'status-icon')).not.toBeNull();
    expect(part(el, 'indicator')).toBeNull();
    expect(trigger(el).getAttribute('aria-invalid')).toBe('true');
    const message = el.shadowRoot!.querySelector('tct-field-status')!;
    expect(message.textContent).toContain('Pick one');
  });

  it('detaches an attached status of the ghost variant', async () => {
    const el = await make(
      'label="Fruit" variant="ghost" status-type="warning" status-message="Careful"',
    );
    expect(part(el, 'status-icon')).toBeNull();
    expect(el.shadowRoot!.querySelector('tct-field-status')!.getAttribute('variant')).toBe(
      'detached',
    );
  });

  it('places the mark after the row content by default and before it with indicator-position="start"', async () => {
    const el = await make('label="Fruit" value="Apple"');
    await openByClick(el);
    const row = optionsOf(el)[0]!;
    expect(row.getAttribute('data-position')).toBe('end');
    expect(
      row
        .querySelector('.option-content')!
        .compareDocumentPosition(row.querySelector('.mark-column')!),
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    el.indicatorPosition = 'start';
    await el.updateComplete;
    const start = optionsOf(el)[0]!;
    expect(start.getAttribute('data-position')).toBe('start');
    expect(
      start
        .querySelector('.mark-column')!
        .compareDocumentPosition(start.querySelector('.option-content')!),
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('marks the chosen row selected and draws the check only there', async () => {
    const el = await make('label="Fruit" value="Banana"');
    await openByClick(el);
    const rows = optionsOf(el);
    expect(rows.map((row) => row.getAttribute('aria-selected'))).toEqual([
      'false',
      'true',
      'false',
      'false',
    ]);
    expect(rows[1]!.querySelector('.mark')!.getAttribute('state')).toBe('checked');
    expect(rows[0]!.querySelector('.mark')!.getAttribute('state')).toBe('unchecked');
  });
});

describe('tct-selector: sections, dividers, descriptions and custom rows', () => {
  it('renders a titled section as a group with an aria-hidden heading, and hides dividers from the tree', async () => {
    const el = await make('label="Fruit"', GROUPED);
    await openByClick(el);
    const group = listboxOf(el)!.querySelector('[role="group"]')!;
    expect(group.getAttribute('aria-label')).toBe('Citrus');
    expect(group.querySelector('.group-heading')!.getAttribute('aria-hidden')).toBe('true');
    const divider = listboxOf(el)!.querySelector('.option-divider')!;
    expect(divider.getAttribute('aria-hidden')).toBe('true');
    expect(optionTexts(el)).toEqual(['Apple', 'Banana', 'Orange', 'Lemon', 'Lime']);
    await expectAccessible(el);
  });

  it('renders an option description and icon in its row', async () => {
    const el = await make('label="Fruit"', GROUPED);
    await openByClick(el);
    const apple = optionsOf(el)[0]!.querySelector('tct-selector-option')!;
    expect(apple.getAttribute('description')).toBe('Crisp');
    const banana = optionsOf(el)[1]!.querySelector('tct-selector-option')!;
    expect(banana.getAttribute('icon')).toBe('search');
  });

  it('renders custom option content through renderOption, keeping the row role and state', async () => {
    const el = await make('label="Fruit" value="Pear"');
    el.renderOption = (option) =>
      html`<tct-selector-option
        label=${`« ${option.label ?? option.value} »`}
        description="custom"
      ></tct-selector-option>`;
    await el.updateComplete;
    await openByClick(el);
    const rows = optionsOf(el);
    expect(rows[3]!.getAttribute('aria-selected')).toBe('true');
    expect(rows[0]!.querySelector('tct-selector-option')!.getAttribute('label')).toBe('« Apple »');
  });

  it('renders text returned by renderOption as text, never as markup', async () => {
    const el = await make('label="Fruit"', ['<b>bold</b>']);
    el.renderOption = (option) => option.label;
    await el.updateComplete;
    await openByClick(el);
    expect(optionsOf(el)[0]!.querySelector('b')).toBeNull();
    expect(optionsOf(el)[0]!.textContent).toContain('<b>bold</b>');
  });

  it('accepts strings and objects together, and defaults the label to the value', async () => {
    const el = await make('label="Fruit"', ['Apple', {value: 'b'}, {value: 'c', label: 'Cherry'}]);
    await openByClick(el);
    expect(optionTexts(el)).toEqual(['Apple', 'b', 'Cherry']);
  });
});

describe('tct-selector: opening and choosing', () => {
  it('opens on a click and closes on a second click, with one intent event and one commit event each', async () => {
    const el = await make();
    const open = recordEvents(el, ['tct-open-change', 'tct-after-open-change']);
    await openByClick(el);
    expect(trigger(el).getAttribute('aria-expanded')).toBe('true');
    expect(open.named('tct-open-change').map((e) => [e.open, e.reason])).toEqual([
      [true, 'trigger'],
    ]);
    await userEvent.click(trigger(el));
    await closed(el);
    expect(open.named('tct-open-change').map((e) => [e.open, e.reason])).toEqual([
      [true, 'trigger'],
      [false, 'trigger'],
    ]);
    await waitUntil(() => open.named('tct-after-open-change').length === 2, 'two after events');
    expect(open.named('tct-after-open-change').map((e) => e.open)).toEqual([true, false]);
    expectEventFlags(open.named('tct-open-change')[0]!, {
      bubbles: true,
      composed: true,
      cancelable: true,
    });
  });

  it('property writes to open emit no intent event but do open and report', async () => {
    const el = await make();
    const open = recordEvents(el, ['tct-open-change', 'tct-after-open-change']);
    await el.show();
    expect(isShown(el)).toBe(true);
    await el.hide();
    expect(isShown(el)).toBe(false);
    expect(open.named('tct-open-change')).toHaveLength(0);
    expect(open.named('tct-after-open-change').map((e) => e.open)).toEqual([true, false]);
  });

  it('a prevented open intent keeps it closed', async () => {
    const el = await make();
    el.addEventListener('tct-open-change', (event) => {
      event.preventDefault();
    });
    await userEvent.click(trigger(el));
    await nextFrame();
    expect(el.open).toBe(false);
    expect(isShown(el)).toBe(false);
  });

  it('choosing an option sets the value, closes, fires input then change once, and keeps focus on the trigger', async () => {
    const el = await make();
    const events = recordEvents(el, ['input', 'change']);
    await openByClick(el);
    await userEvent.click(optionsOf(el)[1]!);
    await closed(el);
    expect(el.value).toBe('Banana');
    expect(events.events.map((event) => event.type)).toEqual(['input', 'change']);
    expectEventFlags(events.events[1]!, {bubbles: true, composed: true});
    expect(part(el, 'value')!.textContent.trim()).toBe('Banana');
    expect(deepActiveElement()).toBe(trigger(el));
  });

  it('choosing the value that is already chosen closes without an event', async () => {
    const el = await make('label="Fruit" value="Banana"');
    const events = recordEvents(el, ['input', 'change']);
    await openByClick(el);
    await userEvent.click(optionsOf(el)[1]!);
    await closed(el);
    expect(events.events).toHaveLength(0);
  });

  it('cannot choose a disabled option', async () => {
    const el = await make('label="Fruit"', GROUPED);
    const events = recordEvents(el, ['input', 'change']);
    await openByClick(el);
    await userEvent.click(optionsOf(el)[3]!, {force: true});
    await nextFrame();
    expect(el.value).toBe('');
    expect(el.open).toBe(true);
    expect(events.events).toHaveLength(0);
    expect(optionsOf(el)[3]!.getAttribute('aria-disabled')).toBe('true');
  });

  it('an outside press closes it (reason outside) without changing the value', async () => {
    const el = await make('label="Fruit" value="Apple"');
    const open = recordEvents(el, 'tct-open-change');
    await openByClick(el);
    await userEvent.click(document.body);
    await closed(el);
    expect(open.events.at(-1)!.reason).toBe('outside');
    expect(el.value).toBe('Apple');
  });

  it('a press on the box (not the button) toggles it like the trigger', async () => {
    const el = await make();
    await userEvent.click(part(el, 'input')!.querySelector('.chevron')!);
    await waitUntil(() => el.open, 'opened by the chevron');
    await userEvent.click(part(el, 'input')!.querySelector('.chevron')!);
    await closed(el);
  });

  it('the click that dismissed the popup does not reopen it (gesture guard)', async () => {
    const el = await make();
    await openByClick(el);
    await userEvent.click(trigger(el));
    await nextFrame();
    await closed(el);
    expect(el.open).toBe(false);
  });

  it('property and attribute writes to the value fire no input or change', async () => {
    const el = await make();
    const events = recordEvents(el, ['input', 'change']);
    el.value = 'Apple';
    el.setAttribute('value', 'Pear');
    await el.updateComplete;
    expect(events.events).toHaveLength(0);
  });
});

describe('tct-selector: has-clear', () => {
  it('shows the clear button only with a value, and not when disabled or read-only', async () => {
    const empty = await make('label="Fruit" has-clear');
    expect(empty.shadowRoot!.querySelector('tct-input-clear-button')).toBeNull();
    const filled = await make('label="Fruit" has-clear value="Apple"');
    const clear = filled.shadowRoot!.querySelector('tct-input-clear-button')!;
    expect(clear.getAttribute('label')).toBe('Clear Fruit');
    const disabled = await make('label="Fruit" has-clear value="Apple" disabled');
    expect(disabled.shadowRoot!.querySelector('tct-input-clear-button')).toBeNull();
    const readonly = await make('label="Fruit" has-clear value="Apple" readonly');
    expect(readonly.shadowRoot!.querySelector('tct-input-clear-button')).toBeNull();
  });

  it('clears on a click with tct-clear, input and change once, returns focus and shows the placeholder', async () => {
    const el = await make('label="Fruit" has-clear value="Apple"');
    const events = recordEvents(el, ['tct-clear', 'input', 'change']);
    await userEvent.click(el.shadowRoot!.querySelector('tct-input-clear-button')!);
    await el.updateComplete;
    expect(el.value).toBe('');
    expect(events.events.map((event) => event.type)).toEqual(['tct-clear', 'input', 'change']);
    expect(part(el, 'placeholder')).not.toBeNull();
    expect(deepActiveElement()).toBe(trigger(el));
  });

  it('a prevented tct-clear keeps the value', async () => {
    const el = await make('label="Fruit" has-clear value="Apple"');
    el.addEventListener('tct-clear', (event) => {
      event.preventDefault();
    });
    const events = recordEvents(el, ['input', 'change']);
    await userEvent.click(el.shadowRoot!.querySelector('tct-input-clear-button')!);
    expect(el.value).toBe('Apple');
    expect(events.events).toHaveLength(0);
  });

  it('clears with Delete or Backspace on the focused closed trigger, only with has-clear', async () => {
    for (const key of ['Delete', 'Backspace']) {
      const el = await make('label="Fruit" has-clear value="Apple"');
      trigger(el).focus();
      await pressKeys(key);
      await el.updateComplete;
      expect(el.value, key).toBe('');
    }
    const plain = await make('label="Fruit" value="Apple"');
    trigger(plain).focus();
    await pressKeys('Delete');
    expect(plain.value).toBe('Apple');
  });

  it('clearing while open keeps the popup open', async () => {
    const el = await make('label="Fruit" has-clear value="Apple"');
    await openByClick(el);
    await userEvent.click(el.shadowRoot!.querySelector('tct-input-clear-button')!);
    await el.updateComplete;
    expect(el.value).toBe('');
    expect(el.open).toBe(true);
  });
});

describe('tct-selector: disabled and read-only', () => {
  it('a disabled selector is not focusable, opens nothing and submits nothing', async () => {
    const form = await formHarness(
      '<tct-selector label="Fruit" name="fruit" value="Apple" disabled></tct-selector>',
    );
    const el = form.form.querySelector<TctSelector>('tct-selector')!;
    el.options = FRUIT;
    await el.updateComplete;
    expect(trigger(el).disabled).toBe(true);
    expect(form.entries()).toEqual([]);
    expect(el.open).toBe(false);
  });

  it('disabled-message keeps the trigger focusable with aria-disabled, blocks activation and describes the reason', async () => {
    const el = await make('label="Fruit" disabled disabled-message="Ask an admin"');
    const button = trigger(el);
    expect(button.disabled).toBe(false);
    expect(button.getAttribute('aria-disabled')).toBe('true');
    button.focus();
    expect(deepActiveElement()).toBe(button);
    await userEvent.click(button, {force: true});
    await pressKeys('Enter', 'ArrowDown');
    await nextFrame();
    expect(el.open).toBe(false);
    const describedBy = button.getAttribute('aria-describedby') ?? '';
    const reason = el.shadowRoot!.getElementById(
      describedBy
        .split(' ')
        .find((id) => el.shadowRoot!.getElementById(id)?.textContent.includes('Ask an admin')) ??
        '',
    );
    expect(reason?.textContent).toContain('Ask an admin');
    if (isChromium) expect((await axNode(button)).description).toContain('Ask an admin');
  });

  it('a read-only selector keeps the combobox identity, blocks the popup and describes itself as read only', async () => {
    const form = await formHarness(
      '<tct-selector label="Fruit" name="fruit" value="Banana" readonly></tct-selector>',
    );
    const el = form.form.querySelector<TctSelector>('tct-selector')!;
    el.options = FRUIT;
    await el.updateComplete;
    const button = trigger(el);
    expect(button.getAttribute('role')).toBe('combobox');
    expect(button.getAttribute('aria-readonly')).toBe('true');
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(button.hasAttribute('aria-haspopup')).toBe(false);
    expect(button.hasAttribute('aria-controls')).toBe(false);
    expect(part(el, 'indicator')).toBeNull();
    expect(form.values('fruit')).toEqual(['Banana']);
    await userEvent.click(button);
    await pressKeys('ArrowDown', 'Enter', 'Delete');
    await nextFrame();
    expect(el.open).toBe(false);
    expect(el.value).toBe('Banana');
    if (isChromium) expect((await axNode(button)).description).toContain('Read only');
  });

  it('closes an open popup when the selector becomes read-only or disabled', async () => {
    const el = await make();
    await openByClick(el);
    el.readonly = true;
    await waitUntil(() => !el.open && !isShown(el), 'closed by read-only');
    el.readonly = false;
    await el.show();
    el.disabled = true;
    await waitUntil(() => !el.open && !isShown(el), 'closed by disabled');
  });
});

describe('tct-selector: input group', () => {
  it('takes the group label and draws no chrome of its own', async () => {
    const root = await fixture<HTMLElement>(
      `<div style="padding:24px;inline-size:420px"><tct-input-group label="Country">
        <tct-selector label="Country" value="b"></tct-selector></tct-input-group></div>`,
    );
    const el = root.querySelector<TctSelector>('tct-selector')!;
    el.options = ['a', 'b'];
    await el.updateComplete;
    await nextFrame();
    expect(el.shadowRoot!.querySelector('[part~="label"]')).toBeNull();
    expect(el.shadowRoot!.querySelector('.visually-hidden')!.textContent).toBe('Country');
    if (isChromium) expect((await axNode(trigger(el))).name).toBe('Country');
  });
});

describe('tct-selector: async change action', () => {
  it('is busy while the action is pending and keeps the new value, then settles', async () => {
    const el = await make();
    let resolve!: () => void;
    el.changeAction = () =>
      new Promise<void>((done) => {
        resolve = done;
      });
    await openByClick(el);
    await userEvent.click(optionsOf(el)[1]!);
    await closed(el);
    await el.updateComplete;
    expect(el.value).toBe('Banana');
    expect(trigger(el).getAttribute('aria-busy')).toBe('true');
    expect(hasCustomState(el, 'busy') || isTier2).toBe(true);
    resolve();
    await waitUntil(() => trigger(el).getAttribute('aria-busy') === null, 'settled');
    expect(el.value).toBe('Banana');
  });

  it('returns to the previous value when the action rejects', async () => {
    const el = await make('label="Fruit" value="Apple"');
    el.changeAction = () => Promise.reject(new Error('nope'));
    await openByClick(el);
    await userEvent.click(optionsOf(el)[2]!);
    await waitUntil(() => el.value === 'Apple', 'reverted');
    expect(trigger(el).getAttribute('aria-busy')).toBeNull();
  });

  it('runs a synchronous action and calls it once per user change', async () => {
    const el = await make();
    const seen: string[] = [];
    el.changeAction = (value) => {
      seen.push(value);
    };
    await openByClick(el);
    await userEvent.click(optionsOf(el)[3]!);
    await closed(el);
    expect(seen).toEqual(['Pear']);
  });
});

describe('tct-selector: validation', () => {
  it('required and empty is invalid; the message shows after the user chose and cleared', async () => {
    const form = await formHarness(
      '<tct-selector label="Fruit" name="fruit" required has-clear></tct-selector><button type="submit">Go</button>',
    );
    const el = form.form.querySelector<TctSelector>('tct-selector')!;
    el.options = FRUIT;
    await el.updateComplete;
    expect(el.validity.valueMissing).toBe(true);
    expect(trigger(el).getAttribute('aria-required')).toBe('true');
    await userEvent.click(form.form.querySelector('button')!);
    await el.updateComplete;
    await nextFrame();
    expect(form.submitEvents).toHaveLength(0);
    expect(trigger(el).getAttribute('aria-invalid')).toBe('true');
    expect(el.displayedValidationMessage).not.toBe('');
    expect(deepActiveElement()).toBe(trigger(el));
  });

  it('a chosen value satisfies required and submits', async () => {
    const form = await formHarness(
      '<tct-selector label="Fruit" name="fruit" required value="Apple"></tct-selector><button type="submit">Go</button>',
    );
    const el = form.form.querySelector<TctSelector>('tct-selector')!;
    el.options = FRUIT;
    await el.updateComplete;
    await userEvent.click(form.form.querySelector('button')!);
    expect(form.submitEvents).toHaveLength(1);
    expect(form.entries()).toEqual([['fruit', 'Apple']]);
  });

  it('submits an empty string while nothing is chosen, like a hidden input', async () => {
    const form = await formHarness('<tct-selector label="Fruit" name="fruit"></tct-selector>');
    expect(form.entries()).toEqual([['fruit', '']]);
  });
});

describe('tct-selector: accessibility and environment', () => {
  it('passes axe closed, open, with a value, grouped and in a status', async () => {
    const el = await make('label="Fruit" description="Pick one" value="Apple" has-clear');
    await expectAccessible(el);
    await openByClick(el);
    await expectAccessible(el);
    const grouped = await make('label="Fruit" status-type="error" status-message="Nope"', GROUPED);
    await expectAccessible(grouped);
  });

  it('the open listbox is named by the label and each option by its text', async () => {
    const el = await make('label="Fruit" value="Banana"');
    await openByClick(el);
    const listbox = listboxOf(el)!;
    expect(listbox.getAttribute('aria-label')).toBe('Fruit');
    expect(trigger(el).getAttribute('aria-controls')).toBe(listbox.id);
    if (isChromium) {
      const node = await axNode(optionsOf(el)[1]!);
      expect(node.role).toBe('option');
      expect(node.name).toBe('Banana');
      expect(node.selected).toBe('true');
    }
  });

  it('mirrors the layout in RTL: the chevron sits at the start side and the popup aligns to the start edge', async () => {
    const el = await mountSelect<TctSelector>(
      'tct-selector',
      'label="Fruit" value="Apple"',
      FRUIT,
      {dir: 'rtl'},
    );
    const box = part(el, 'input')!.getBoundingClientRect();
    const chevron = part(el, 'indicator')!.getBoundingClientRect();
    expect(chevron.left - box.left).toBeLessThan(box.right - chevron.right);
    await openByClick(el);
    const surface = el.shadowRoot!.querySelector<HTMLElement>('.surface')!.getBoundingClientRect();
    expect(Math.abs(surface.right - box.right)).toBeLessThan(2);
  });

  it('draws readable surfaces in forced colours', async () => {
    const el = await make('label="Fruit" value="Banana"');
    await openByClick(el);
    const restore = await emulateMedia({forcedColors: 'active'});
    await nextFrame();
    const surface = getComputedStyle(el.shadowRoot!.querySelector('.surface')!);
    expect(surface.borderTopColor).not.toBe('rgba(0, 0, 0, 0)');
    const box = getComputedStyle(part(el, 'input')!);
    expect(box.borderTopStyle).not.toBe('none');
    trigger(el).focus();
    await restore();
  });

  it('shows the popup in light and dark with a screenshot-ready open state', async () => {
    for (const theme of ['light', 'dark'] as const) {
      const root = await fixture<HTMLElement>(
        `<div style="padding:24px 24px 260px;inline-size:420px"><tct-selector label="Fruit" value="Banana"></tct-selector></div>`,
        {theme},
      );
      const el = root.querySelector<TctSelector>('tct-selector')!;
      el.options = FRUIT;
      await el.updateComplete;
      await openByClick(el);
      await expectAccessible(el);
      await animationsFinished(layerOf(el));
    }
    expect(page).toBeDefined();
  });
});

runOverlaySuite({
  tag: 'tct-selector',
  render: ({attributes = '', children = ''}) =>
    `<tct-selector label="Fruit" ${attributes}>${children}</tct-selector><div style="block-size:320px"></div>`,
  trigger: (el) => trigger(el),
  surface: (el) => el.shadowRoot!.querySelector<HTMLElement>('.surface'),
  open: async (el) => {
    (el as unknown as TctSelector).options = FRUIT;
    await (el as unknown as TctSelector).show();
  },
  close: async (el) => {
    await (el as unknown as TctSelector).hide();
  },
});
