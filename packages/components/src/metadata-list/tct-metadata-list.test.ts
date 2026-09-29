/**
 * tct-metadata-list and tct-metadata-list-item: semantics, heading, columns, label position and width,
 * horizontal flow, collapse with "Show more", localisation, RTL, forced colours (ported from upstream
 * MetadataList.test.tsx).
 */
import {html} from 'lit';
import {describe, expect, it} from 'vitest';
import {userEvent} from 'vitest/browser';
import {axNode, axTree, expectAccessible} from '@tecton-wc/testing/a11y.js';
import {emulateMedia} from '@tecton-wc/testing/emulate.js';
import {expectEventCounts, expectEventFlags, recordEvents} from '@tecton-wc/testing/events.js';
import {fixture} from '@tecton-wc/testing/fixture.js';
import {pressKeys} from '@tecton-wc/testing/keyboard.js';
import {runElementSuite} from '@tecton-wc/testing/suites/element.js';
import {runKeyboardSuite, type KeyboardRow} from '@tecton-wc/testing/suites/keyboard.js';
import {isChromium} from '@tecton-wc/testing/tier.js';
import {waitUntil} from '@tecton-wc/testing/timing.js';
import './define.js';
import type {TctMetadataList} from './tct-metadata-list.js';
import type {TctMetadataListItem} from './tct-metadata-list-item.js';

const PAIRS = `
  <tct-metadata-list-item label="Quality">Good</tct-metadata-list-item>
  <tct-metadata-list-item label="Condition">Excellent</tct-metadata-list-item>
  <tct-metadata-list-item label="Status">Active</tct-metadata-list-item>`;

const make = async (
  attributes = '',
  items = PAIRS,
  options: {dir?: 'ltr' | 'rtl'; lang?: string; width?: number} = {},
): Promise<TctMetadataList> => {
  const wrapper = await fixture<HTMLElement>(
    `<div style="width: ${options.width ?? 640}px"><tct-metadata-list ${attributes}>${items}</tct-metadata-list></div>`,
    options,
  );
  return wrapper.querySelector<TctMetadataList>('tct-metadata-list')!;
};
const list = (element: TctMetadataList): HTMLElement =>
  element.shadowRoot!.querySelector<HTMLElement>('.list')!;
const items = (element: TctMetadataList): TctMetadataListItem[] => [
  ...element.querySelectorAll<TctMetadataListItem>('tct-metadata-list-item'),
];
const toggle = (element: TctMetadataList): HTMLButtonElement | null =>
  element.shadowRoot!.querySelector<HTMLButtonElement>('.toggle');
const label = (item: TctMetadataListItem): HTMLElement =>
  item.shadowRoot!.querySelector<HTMLElement>('.label')!;
const value = (item: TctMetadataListItem): HTMLElement =>
  item.shadowRoot!.querySelector<HTMLElement>('.value')!;
const visible = (item: Element): boolean => getComputedStyle(item).display !== 'none';

runElementSuite({
  tag: 'tct-metadata-list',
  render: () =>
    html`<tct-metadata-list
      ><tct-metadata-list-item label="Quality">Good</tct-metadata-list-item></tct-metadata-list
    >`,
  properties: {
    columns: 3,
    labelPosition: 'top',
    labelWidth: 120,
    maxNumOfItems: 2,
    orientation: 'horizontal',
    heading: 'Details',
    expanded: true,
    showMoreLabel: 'More',
    showLessLabel: 'Less',
  },
  attributes: {
    labelPosition: 'label-position',
    maxNumOfItems: 'max-num-of-items',
    orientation: 'orientation',
    heading: 'heading',
    showMoreLabel: 'show-more-label',
    showLessLabel: 'show-less-label',
  },
  events: ['tct-open-change'],
});

runElementSuite({
  tag: 'tct-metadata-list-item',
  render: () =>
    html`<tct-metadata-list
      ><tct-metadata-list-item label="Quality">Good</tct-metadata-list-item></tct-metadata-list
    >`,
  properties: {label: 'Condition'},
  attributes: {label: 'label'},
});

describe('tct-metadata-list: semantics (MetadataList.test.tsx)', () => {
  it('renders a list of items with a term and a definition each', async () => {
    const element = await make();
    expect(await axTree(element)).toEqual([
      'list',
      'listitem',
      'term: Quality',
      'definition',
      'listitem',
      'term: Condition',
      'definition',
      'listitem',
      'term: Status',
      'definition',
    ]);
  });

  it('exposes the list on an inner element and each pair as a listitem', async () => {
    const element = await make();
    expect(await axNode(list(element))).toMatchObject({role: 'list'});
    for (const item of items(element)) expect(await axNode(item)).toMatchObject({role: 'listitem'});
  });

  it('renders the label and its value', async () => {
    const element = await make(
      '',
      '<tct-metadata-list-item label="Depth">1,240 m</tct-metadata-list-item>',
    );
    const item = items(element)[0]!;
    expect(label(item).textContent).toBe('Depth');
    expect(item.textContent).toBe('1,240 m');
    expect(await axNode(label(item))).toMatchObject({role: 'term', name: 'Depth'});
    expect(await axNode(value(item))).toMatchObject({role: 'definition'});
  });

  it('renders a heading when provided, from the attribute or the slot', async () => {
    const element = await make('heading="Well details"');
    expect(element.shadowRoot!.querySelector('.heading')!.textContent.trim()).toBe('Well details');
    const rich = await fixture<HTMLElement>(
      '<div><tct-metadata-list><strong slot="heading">Rich heading</strong><tct-metadata-list-item label="A">1</tct-metadata-list-item></tct-metadata-list></div>',
    );
    const slot = rich
      .querySelector<TctMetadataList>('tct-metadata-list')!
      .shadowRoot!.querySelector<HTMLSlotElement>('slot[name="heading"]')!;
    expect(slot.assignedElements()).toHaveLength(1);
  });

  it('does not render a heading wrapper without one', async () => {
    const element = await make();
    expect(element.shadowRoot!.querySelector('.heading')).toBeNull();
  });

  it('renders an icon before the label when provided', async () => {
    const element = await make(
      '',
      '<tct-metadata-list-item label="Depth"><span slot="icon" id="icon">i</span>1 m</tct-metadata-list-item>',
    );
    const item = items(element)[0]!;
    expect(label(item).querySelector('.icon')).not.toBeNull();
    const icon = item.querySelector('#icon')!.getBoundingClientRect();
    const text = label(item).getBoundingClientRect();
    expect(icon.left).toBeGreaterThanOrEqual(text.left - 1);
    expect(icon.right).toBeLessThanOrEqual(text.right + 1);
    const plain = await make(
      '',
      '<tct-metadata-list-item label="Depth">1 m</tct-metadata-list-item>',
    );
    expect(label(items(plain)[0]!).querySelector('.icon')).toBeNull();
  });

  it('is accessible in every layout', async () => {
    for (const attributes of [
      '',
      'heading="Details"',
      'columns="multi"',
      'columns="2"',
      'label-position="top"',
      'orientation="horizontal"',
      'max-num-of-items="1"',
    ]) {
      const element = await make(attributes);
      await expectAccessible(element.parentElement!);
    }
  });
});

describe('tct-metadata-list: layout', () => {
  const rect = (element: Element) => element.getBoundingClientRect();

  it('a single column places each label beside its value, and aligns the labels across rows', async () => {
    const element = await make('', PAIRS);
    const rows = items(element);
    for (const item of rows)
      expect(rect(label(item)).right).toBeLessThanOrEqual(rect(value(item)).left + 1);
    const lefts = rows.map((item) => Math.round(rect(value(item)).left));
    expect(new Set(lefts).size).toBe(1); // the value column is shared: a subgrid, not per-row tracks
    const tops = rows.map((item) => rect(item).top);
    expect(tops[1]!).toBeGreaterThan(tops[0]!);
  });

  it('label-position="top" stacks the label above the value', async () => {
    const element = await make('label-position="top"');
    const item = items(element)[0]!;
    expect(rect(value(item)).top).toBeGreaterThanOrEqual(rect(label(item)).bottom - 1);
  });

  it('applies a custom label width with side labels', async () => {
    const element = await make('label-width="120"');
    expect(
      Math.round(rect(value(items(element)[0]!)).left - rect(items(element)[0]!).left),
    ).toBeGreaterThanOrEqual(120);
    const track = getComputedStyle(list(element)).gridTemplateColumns.split(' ')[0];
    expect(track).toBe('120px');
  });

  it('accepts a CSS length as the label width', async () => {
    const element = await make('label-width="9rem"');
    expect(getComputedStyle(list(element)).gridTemplateColumns.split(' ')[0]).toBe('144px');
  });

  it('renders the requested number of columns with stacked labels', async () => {
    const element = await make(
      'columns="3"',
      `${PAIRS}<tct-metadata-list-item label="Extra">x</tct-metadata-list-item>`,
    );
    expect(getComputedStyle(list(element)).gridTemplateColumns.split(' ')).toHaveLength(3);
    const tops = items(element).map((item) => Math.round(rect(item).top));
    expect(tops.slice(0, 3)).toEqual([tops[0], tops[0], tops[0]]);
    expect(tops[3]!).toBeGreaterThan(tops[0]!);
  });

  it('renders label and value tracks per column with side labels', async () => {
    const element = await make('columns="2" label-position="start"');
    expect(getComputedStyle(list(element)).gridTemplateColumns.split(' ')).toHaveLength(4);
    const [first, second] = items(element);
    expect(Math.round(rect(first!).top)).toBe(Math.round(rect(second!).top));
    expect(rect(value(first!)).left).toBeGreaterThan(rect(label(first!)).left);
  });

  it('columns="multi" fills as many columns as fit, stacked by default', async () => {
    const wide = await make('columns="multi"', PAIRS, {width: 900});
    const narrow = await make('columns="multi"', PAIRS, {width: 320});
    const count = (element: TctMetadataList) =>
      new Set(items(element).map((item) => Math.round(item.getBoundingClientRect().left))).size;
    expect(count(wide)).toBeGreaterThan(count(narrow));
    expect(count(narrow)).toBe(1);
    expect(list(wide).dataset.mode).toBe('stacked');
  });

  it('horizontal flows the pairs in a wrapping row with labels above, ignoring columns', async () => {
    const element = await make('orientation="horizontal" columns="3"');
    expect(getComputedStyle(list(element)).display).toBe('flex');
    expect(getComputedStyle(list(element)).flexWrap).toBe('wrap');
    const tops = items(element).map((item) => Math.round(item.getBoundingClientRect().top));
    expect(new Set(tops).size).toBe(1);
    const item = items(element)[0]!;
    expect(value(item).getBoundingClientRect().top).toBeGreaterThanOrEqual(
      label(item).getBoundingClientRect().bottom - 1,
    );
  });

  it('a list item outside a list stacks its label and value', async () => {
    const wrapper = await fixture<HTMLElement>(
      '<div><tct-metadata-list-item label="Alone">value</tct-metadata-list-item></div>',
    );
    const item = wrapper.querySelector<TctMetadataListItem>('tct-metadata-list-item')!;
    expect(value(item).getBoundingClientRect().top).toBeGreaterThanOrEqual(
      label(item).getBoundingClientRect().bottom - 1,
    );
  });

  it('wraps long values instead of overflowing', async () => {
    const element = await make(
      '',
      `<tct-metadata-list-item label="Path">${'segment/'.repeat(40)}</tct-metadata-list-item>`,
      {width: 300},
    );
    const item = items(element)[0]!;
    expect(item.getBoundingClientRect().right).toBeLessThanOrEqual(
      element.getBoundingClientRect().right + 1,
    );
  });
});

describe('tct-metadata-list: collapse with Show more', () => {
  const four = `${PAIRS}<tct-metadata-list-item label="Owner">Ada</tct-metadata-list-item>`;

  it('shows the toggle when items exceed max-num-of-items and hides the extra items', async () => {
    const element = await make('max-num-of-items="2"', four);
    expect(toggle(element)!.textContent.trim()).toBe('Show more');
    expect(items(element).map(visible)).toEqual([true, true, false, false]);
  });

  it('shows no toggle when everything fits, and none without a cap', async () => {
    expect(toggle(await make('max-num-of-items="4"', four))).toBeNull();
    expect(toggle(await make('', four))).toBeNull();
  });

  it('toggles Show more and Show less, with aria-expanded and aria-controls', async () => {
    const element = await make('max-num-of-items="2"', four);
    const button = toggle(element)!;
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(button.getAttribute('aria-controls')).toBe(list(element).id);
    expect(element.shadowRoot!.getElementById(button.getAttribute('aria-controls')!)).toBe(
      list(element),
    );
    await userEvent.click(button);
    expect(toggle(element)!.textContent.trim()).toBe('Show less');
    expect(toggle(element)!.getAttribute('aria-expanded')).toBe('true');
    expect(items(element).map(visible)).toEqual([true, true, true, true]);
    await userEvent.click(toggle(element)!);
    expect(toggle(element)!.textContent.trim()).toBe('Show more');
    expect(items(element).map(visible)).toEqual([true, true, false, false]);
  });

  it('collapsed items are not exposed to assistive technology', async () => {
    const element = await make('max-num-of-items="2"', four);
    expect((await axTree(element)).filter((line) => line === 'listitem')).toHaveLength(2);
  });

  it('starts expanded with the expanded attribute', async () => {
    const element = await make('max-num-of-items="2" expanded', four);
    expect(items(element).map(visible)).toEqual([true, true, true, true]);
    expect(toggle(element)!.textContent.trim()).toBe('Show less');
  });

  it('emits a cancelable tct-open-change before the state changes, and honours preventDefault', async () => {
    const element = await make('max-num-of-items="2"', four);
    const events = recordEvents(element, 'tct-open-change');
    await userEvent.click(toggle(element)!);
    expectEventCounts(events, {'tct-open-change': 1});
    expectEventFlags(events.events[0]!, {bubbles: true, composed: true, cancelable: true});
    expect(events.events[0]!.open).toBe(true);
    expect(events.events[0]!.reason).toBe('trigger');
    expect(element.expanded).toBe(true);

    element.addEventListener('tct-open-change', (event) => event.preventDefault(), {once: true});
    await userEvent.click(toggle(element)!);
    expect(element.expanded).toBe(true); // the second request was prevented
  });

  it('emits no event when expanded or the cap change programmatically', async () => {
    const element = await make('max-num-of-items="2"', four);
    const events = recordEvents(element, 'tct-open-change');
    element.expanded = true;
    element.maxNumOfItems = 3;
    await element.updateComplete;
    expectEventCounts(events, {'tct-open-change': 0});
  });

  it('does not show the toggle in horizontal mode even with max-num-of-items', async () => {
    const element = await make('orientation="horizontal" max-num-of-items="1"');
    expect(toggle(element)).toBeNull();
    expect(items(element).every(visible)).toBe(true);
  });

  it('follows items added after the first render', async () => {
    const element = await make('max-num-of-items="2"', PAIRS);
    const added = document.createElement('tct-metadata-list-item');
    added.label = 'New';
    added.textContent = 'x';
    element.append(added);
    await added.updateComplete;
    await element.updateComplete;
    expect(items(element).map(visible)).toEqual([true, true, false, false]);
  });

  it('attribute overrides win for the toggle labels', async () => {
    const element = await make(
      'max-num-of-items="1" show-more-label="More" show-less-label="Less"',
    );
    expect(toggle(element)!.textContent.trim()).toBe('More');
    await userEvent.click(toggle(element)!);
    expect(toggle(element)!.textContent.trim()).toBe('Less');
  });

  it('localises the toggle labels (de-DE) and keeps working in Arabic (ar-SA, RTL)', async () => {
    const german = await make('max-num-of-items="1"', PAIRS, {lang: 'de-DE'});
    await waitUntil(() => toggle(german)!.textContent.trim() === 'Mehr anzeigen', 'German label');
    await userEvent.click(toggle(german)!);
    await waitUntil(() => toggle(german)!.textContent.trim() === 'Weniger anzeigen', 'German less');

    const arabic = await make('max-num-of-items="1"', PAIRS, {lang: 'ar-SA', dir: 'rtl'});
    await waitUntil(() => toggle(arabic)!.textContent.trim() !== 'Show more', 'Arabic label');
    expect(toggle(arabic)!.textContent.trim()).not.toBe('');
    expect(getComputedStyle(toggle(arabic)!).direction).toBe('rtl');
  });

  it('the toggle is keyboard operable and draws a focus ring', async () => {
    const element = await make('max-num-of-items="1"');
    await pressKeys('Tab');
    expect(element.shadowRoot!.activeElement).toBe(toggle(element));
    expect(getComputedStyle(toggle(element)!).outlineStyle).not.toBe('none');
    await pressKeys('Enter');
    expect(element.expanded).toBe(true);
    await pressKeys(' ');
    expect(element.expanded).toBe(false);
  });
});

describe('tct-metadata-list: keyboard', () => {
  const parity = Object.values(
    import.meta.glob<{entries: Record<string, {keyboard: KeyboardRow[]}>}>('./parity.json', {
      eager: true,
      import: 'default',
    }),
  )[0]!;
  const rows = parity.entries['core.metadata-list']!.keyboard;
  const list3 = `<button id="before">before</button><tct-metadata-list max-num-of-items="1">${PAIRS}</tct-metadata-list>`;

  runKeyboardSuite({
    tag: 'tct-metadata-list',
    render: () => list3,
    table: rows,
    steps: {
      'Moves focus to the Show more toggle': {
        focus: (element) => element.parentElement!.querySelector<HTMLElement>('#before'),
        keys: ['Tab'],
        expect: ({element}) => {
          expect(element.shadowRoot!.activeElement).toBe(
            element.shadowRoot!.querySelector('.toggle'),
          );
        },
      },
      'Expands or collapses the list': {
        focus: (element) => element.shadowRoot!.querySelector<HTMLElement>('.toggle'),
        keys: ['Enter', ' '],
        expect: ({element}) => {
          // Enter expanded it, Space collapsed it again.
          expect((element as TctMetadataList).expanded).toBe(false);
        },
      },
    },
  });
});

describe('tct-metadata-list: RTL and forced colours', () => {
  it('mirrors: labels sit at the inline start and values follow', async () => {
    const ltr = await make();
    const rtl = await make('', PAIRS, {dir: 'rtl'});
    const first = (element: TctMetadataList) => items(element)[0]!;
    expect(label(first(ltr)).getBoundingClientRect().left).toBeLessThan(
      value(first(ltr)).getBoundingClientRect().left,
    );
    expect(label(first(rtl)).getBoundingClientRect().left).toBeGreaterThan(
      value(first(rtl)).getBoundingClientRect().left,
    );
  });

  it.skipIf(!isChromium)(
    'draws the toggle in a system link colour under forced colours',
    async () => {
      await emulateMedia({forcedColors: 'active'});
      const element = await make('max-num-of-items="1"');
      expect(getComputedStyle(toggle(element)!).color).not.toBe('rgba(0, 0, 0, 0)');
      await pressKeys('Tab');
      expect(getComputedStyle(toggle(element)!).outlineStyle).not.toBe('none');
    },
  );
});
