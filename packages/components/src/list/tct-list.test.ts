/**
 * tct-list and tct-list-item: list semantics, header naming, density, dividers, markers, edge
 * compensation, interactive rows, ARIA delegation, RTL, forced colours (ported from upstream
 * List.test.tsx).
 */
import {html} from 'lit';
import {describe, expect, it} from 'vitest';
import {userEvent} from 'vitest/browser';
import {axNode, axTree, expectAccessible} from '@tecton-astryx/testing/a11y.js';
import {emulateMedia} from '@tecton-astryx/testing/emulate.js';
import {expectEventCounts, recordEvents} from '@tecton-astryx/testing/events.js';
import {fixture} from '@tecton-astryx/testing/fixture.js';
import {pressKeys, tabSequence} from '@tecton-astryx/testing/keyboard.js';
import {runElementSuite} from '@tecton-astryx/testing/suites/element.js';
import {runKeyboardSuite, type KeyboardRow} from '@tecton-astryx/testing/suites/keyboard.js';
import {isChromium} from '@tecton-astryx/testing/tier.js';
import '../item/define.js';
import './define.js';
import type {TctItem} from '../item/tct-item.js';
import type {TctList} from './tct-list.js';
import type {TctListItem} from './tct-list-item.js';

const make = async (
  attributes = '',
  items = '<tct-list-item label="One"></tct-list-item><tct-list-item label="Two"></tct-list-item>',
  options: {dir?: 'ltr' | 'rtl'} = {},
): Promise<TctList> => {
  const wrapper = await fixture<HTMLElement>(
    `<div style="width: 320px"><tct-list ${attributes}>${items}</tct-list></div>`,
    options,
  );
  return wrapper.querySelector<TctList>('tct-list')!;
};
const inner = (list: TctList): HTMLElement => list.shadowRoot!.querySelector<HTMLElement>('.list')!;
const rows = (list: TctList): TctListItem[] => [
  ...list.querySelectorAll<TctListItem>('tct-list-item'),
];
const itemOf = (row: TctListItem): TctItem => row.shadowRoot!.querySelector<TctItem>('tct-item')!;
const paint = (row: TctListItem): HTMLElement =>
  itemOf(row).shadowRoot!.querySelector<HTMLElement>('.base')!;
const wrapperOf = (row: TctListItem): HTMLElement =>
  row.shadowRoot!.querySelector<HTMLElement>('.row')!;

runElementSuite({
  tag: 'tct-list',
  render: () => html`<tct-list><tct-list-item label="One"></tct-list-item></tct-list>`,
  properties: {
    density: 'compact',
    hasDividers: true,
    edgeCompensation: 'inline',
    listStyle: 'disc',
    start: 3,
  },
  attributes: {
    density: 'density',
    hasDividers: 'has-dividers',
    listStyle: 'list-style',
    start: 'start',
  },
});

runElementSuite({
  tag: 'tct-list-item',
  render: () => html`<tct-list><tct-list-item label="One"></tct-list-item></tct-list>`,
  properties: {label: 'One', description: 'Two', pressable: true, selected: true, disabled: true},
  attributes: {label: 'label', description: 'description'},
  events: ['click'],
});

describe('tct-list: semantics (List.test.tsx)', () => {
  it('renders a list with items', async () => {
    const list = await make();
    expect(await axTree(list)).toEqual(['list', 'listitem', 'listitem']);
    expect(rows(list)).toHaveLength(2);
  });

  it('renders label and description', async () => {
    const list = await make(
      '',
      '<tct-list-item label="Settings" description="Manage"></tct-list-item>',
    );
    const item = itemOf(rows(list)[0]!);
    expect(item.shadowRoot!.querySelector('.label')!.textContent).toBe('Settings');
    expect(item.shadowRoot!.querySelector('.description')!.textContent).toBe('Manage');
  });

  it('renders as a <ul> by default, with an explicit list role', async () => {
    const list = await make();
    expect(inner(list).tagName).toBe('UL');
    expect(inner(list).getAttribute('role')).toBe('list');
    expect(await axNode(inner(list))).toMatchObject({role: 'list'});
  });

  it('renders as an <ol> when list-style is decimal', async () => {
    const list = await make('list-style="decimal"');
    expect(inner(list).tagName).toBe('OL');
    expect(inner(list).getAttribute('role')).toBe('list');
  });

  it('renders as <ul> when list-style is disc or circle', async () => {
    for (const style of ['disc', 'circle']) {
      const list = await make(`list-style="${style}"`);
      expect(inner(list).tagName).toBe('UL');
    }
  });

  it('emits the start HTML attribute on <ol> only when non-default', async () => {
    expect(
      (await make('list-style="decimal" start="5"'))
        .shadowRoot!.querySelector('ol')!
        .getAttribute('start'),
    ).toBe('5');
    expect(
      (await make('list-style="decimal"')).shadowRoot!.querySelector('ol')!.hasAttribute('start'),
    ).toBe(false);
    expect(
      (await make('list-style="decimal" start="1"'))
        .shadowRoot!.querySelector('ol')!
        .hasAttribute('start'),
    ).toBe(false);
  });

  it('exposes every row as a listitem', async () => {
    const list = await make();
    for (const row of rows(list)) expect(await axNode(row)).toMatchObject({role: 'listitem'});
  });

  it('names the list from its header and renders the header above it', async () => {
    const list = await make('header="Recent files"');
    const header = list.shadowRoot!.querySelector<HTMLElement>('.header')!;
    expect(header.textContent.trim()).toBe('Recent files');
    expect(inner(list).getAttribute('aria-labelledby')).toBe(header.id);
    expect(await axNode(inner(list))).toMatchObject({role: 'list', name: 'Recent files'});
    expect(header.getBoundingClientRect().bottom).toBeLessThanOrEqual(
      inner(list).getBoundingClientRect().top + 1,
    );
  });

  it('names the list from rich header content in the header slot', async () => {
    const wrapper = await fixture<HTMLElement>(
      '<div><tct-list><strong slot="header">Rich <em>header</em></strong><tct-list-item label="One"></tct-list-item></tct-list></div>',
    );
    const list = wrapper.querySelector<TctList>('tct-list')!;
    expect(await axNode(inner(list))).toMatchObject({role: 'list', name: 'Rich header'});
  });

  it('does not render aria-labelledby or a header wrapper when there is no header', async () => {
    const list = await make();
    expect(inner(list).hasAttribute('aria-labelledby')).toBe(false);
    expect(list.shadowRoot!.querySelector('.header')).toBeNull();
  });

  it('forwards aria attributes on the host onto the list element', async () => {
    const list = await make('aria-label="Team members" aria-description="Sorted by name"');
    expect(await axNode(inner(list))).toMatchObject({role: 'list', name: 'Team members'});
    expect(inner(list).getAttribute('aria-description')).toBe('Sorted by name');
  });

  it('keeps an aria-labelledby that points outside the component when there is no header', async () => {
    const wrapper = await fixture<HTMLElement>(
      '<div><h3 id="outside-title">Outside title</h3><tct-list aria-labelledby="outside-title"><tct-list-item label="One"></tct-list-item></tct-list></div>',
    );
    const list = wrapper.querySelector<TctList>('tct-list')!;
    expect(await axNode(inner(list))).toMatchObject({role: 'list', name: 'Outside title'});
  });

  it('keeps its own list role and header association over a delegated aria-labelledby', async () => {
    const wrapper = await fixture<HTMLElement>(
      '<div><h3 id="outside-title">Outside title</h3><tct-list header="Own header" aria-labelledby="outside-title"><tct-list-item label="One"></tct-list-item></tct-list></div>',
    );
    const list = wrapper.querySelector<TctList>('tct-list')!;
    expect(await axNode(inner(list))).toMatchObject({role: 'list', name: 'Own header'});
  });

  it('is accessible in every configuration', async () => {
    for (const attributes of [
      '',
      'header="Files"',
      'list-style="decimal" header="Steps"',
      'has-dividers aria-label="Items"',
      'list-style="disc" aria-label="Bulleted"',
    ]) {
      const list = await make(attributes);
      await expectAccessible(list.parentElement!);
    }
  });
});

describe('tct-list: density, dividers and radius', () => {
  it('passes the density to every item; balanced is the default', async () => {
    const dense = await make('density="compact"');
    expect(rows(dense).map((row) => itemOf(row).density)).toEqual(['compact', 'compact']);
    const standard = await make();
    expect(rows(standard).map((row) => itemOf(row).density)).toEqual(['balanced', 'balanced']);
    const roomy = await make('density="spacious"');
    expect(rows(roomy).map((row) => itemOf(row).density)).toEqual(['spacious', 'spacious']);
  });

  it('follows a density change', async () => {
    const list = await make();
    list.density = 'spacious';
    await list.updateComplete;
    await Promise.all(rows(list).map((row) => row.updateComplete));
    expect(itemOf(rows(list)[0]!).density).toBe('spacious');
  });

  it('renders dividers between items, and none after the last', async () => {
    const list = await make(
      'has-dividers',
      '<tct-list-item label="A"></tct-list-item><tct-list-item label="B"></tct-list-item><tct-list-item label="C"></tct-list-item>',
    );
    const widths = rows(list).map((row) => getComputedStyle(wrapperOf(row)).borderBlockEndWidth);
    expect(widths).toEqual(['1px', '1px', '0px']);
  });

  it('does not add extra DOM elements for dividers and renders none by default', async () => {
    const list = await make();
    expect(rows(list).map((row) => getComputedStyle(wrapperOf(row)).borderBlockEndWidth)).toEqual([
      '0px',
      '0px',
    ]);
    const divided = await make('has-dividers');
    expect(divided.shadowRoot!.querySelectorAll('hr, [role=separator]')).toHaveLength(0);
  });

  it('applies the content radius by default and removes it when has-dividers is set', async () => {
    const plain = await make();
    expect(
      parseFloat(getComputedStyle(paint(rows(plain)[0]!)).borderTopLeftRadius),
    ).toBeGreaterThan(0);
    const divided = await make('has-dividers');
    expect(getComputedStyle(paint(rows(divided)[0]!)).borderTopLeftRadius).toBe('0px');
  });
});

describe('tct-list: markers', () => {
  it('renders bullets for disc and rings for circle, and none for the default', async () => {
    const disc = await make('list-style="disc"');
    expect(rows(disc)[0]!.shadowRoot!.querySelector('.marker .dot')).not.toBeNull();
    const circle = await make('list-style="circle"');
    expect(rows(circle)[0]!.shadowRoot!.querySelector('.marker .ring')).not.toBeNull();
    const none = await make();
    expect(rows(none)[0]!.shadowRoot!.querySelector('[slot="marker"]')).toBeNull();
  });

  /**
   * The counter cannot be read back as text (Chromium's accessibility tree does not resolve
   * counters), so the rows are re-styled to count in upper roman numerals, whose widths differ, and
   * each marker's width is compared with the same text measured on a canvas.
   */
  const numberWidths = (
    list: TctList,
    expected: string[],
  ): {actual: number[]; wanted: number[]} => {
    const context = document.createElement('canvas').getContext('2d')!;
    const actual: number[] = [];
    const wanted: number[] = [];
    rows(list).forEach((row, index) => {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(
        `.number { inline-size: auto !important; display: inline-block !important; font-size: 48px !important; }
         .number::before { content: counter(tct-list, upper-roman) '.' !important; }`,
      );
      row.shadowRoot!.adoptedStyleSheets = [...row.shadowRoot!.adoptedStyleSheets, sheet];
      const number = row.shadowRoot!.querySelector<HTMLElement>('.number')!;
      const style = getComputedStyle(number);
      context.font = `${style.fontWeight} 48px ${style.fontFamily}`;
      actual.push(Math.round(number.getBoundingClientRect().width));
      wanted.push(Math.round(context.measureText(`${expected[index]}.`).width));
    });
    return {actual, wanted};
  };

  it('numbers the rows 1., 2., 3. for decimal', async () => {
    const list = await make(
      'list-style="decimal"',
      '<tct-list-item label="A"></tct-list-item><tct-list-item label="B"></tct-list-item><tct-list-item label="C"></tct-list-item>',
    );
    const {actual, wanted} = numberWidths(list, ['I', 'II', 'III']);
    expect(actual).toEqual(wanted);
    expect(new Set(actual).size).toBe(3);
  });

  it('applies a custom counter start value', async () => {
    const list = await make(
      'list-style="decimal" start="5"',
      '<tct-list-item label="A"></tct-list-item><tct-list-item label="B"></tct-list-item>',
    );
    const {actual, wanted} = numberWidths(list, ['V', 'VI']);
    expect(actual).toEqual(wanted);
  });

  it('renumbers when a row is inserted', async () => {
    const list = await make(
      'list-style="decimal"',
      '<tct-list-item label="A"></tct-list-item><tct-list-item label="B"></tct-list-item>',
    );
    const inserted = document.createElement('tct-list-item');
    inserted.label = 'New';
    list.prepend(inserted);
    await inserted.updateComplete;
    const {actual, wanted} = numberWidths(list, ['I', 'II', 'III']);
    expect(actual).toEqual(wanted);
  });

  it('hides the markers from assistive technology', async () => {
    const list = await make('list-style="disc"');
    expect(rows(list)[0]!.shadowRoot!.querySelector('.marker')!.getAttribute('aria-hidden')).toBe(
      'true',
    );
  });
});

describe('tct-list: edge compensation', () => {
  const styleOf = (list: TctList, side: 'Start' | 'End') =>
    getComputedStyle(wrapperOf(rows(list)[0]!))[`marginInline${side}`];

  it('does not apply inline edge compensation by default', async () => {
    const list = await make();
    expect([styleOf(list, 'Start'), styleOf(list, 'End')]).toEqual(['0px', '0px']);
  });

  it('applies the clamped cancelling margin to each item when edge-compensation is inline', async () => {
    const wrapper = await fixture<HTMLElement>(
      `<div style="--_container-padding-inline-start: 16px; --_container-padding-inline-end: 16px; width: 320px">
         <tct-list edge-compensation="inline"><tct-list-item label="One"></tct-list-item></tct-list>
       </div>`,
    );
    const list = wrapper.querySelector<TctList>('tct-list')!;
    // The balanced inset is 8px (spacing-2); the container offers 16px, so the whole inset cancels.
    expect([styleOf(list, 'Start'), styleOf(list, 'End')]).toEqual(['-8px', '-8px']);
  });

  it('uses the same var-derived cancel for every density', async () => {
    for (const [density, expected] of [
      ['compact', '-8px'],
      ['balanced', '-8px'],
      ['spacious', '-12px'],
    ] as const) {
      const wrapper = await fixture<HTMLElement>(
        `<div style="--_container-padding-inline-start: 16px; --_container-padding-inline-end: 16px; width: 320px">
           <tct-list density="${density}" edge-compensation="inline"><tct-list-item label="One"></tct-list-item></tct-list>
         </div>`,
      );
      expect(styleOf(wrapper.querySelector<TctList>('tct-list')!, 'Start')).toBe(expected);
    }
  });

  it('does not pull the header', async () => {
    const wrapper = await fixture<HTMLElement>(
      `<div style="--_container-padding-inline-start: 16px; --_container-padding-inline-end: 16px; width: 320px">
         <tct-list header="Title" edge-compensation="inline"><tct-list-item label="One"></tct-list-item></tct-list>
       </div>`,
    );
    const list = wrapper.querySelector<TctList>('tct-list')!;
    const header = list.shadowRoot!.querySelector<HTMLElement>('.header')!;
    expect(header.getBoundingClientRect().left).toBe(list.getBoundingClientRect().left);
    expect(getComputedStyle(header).marginInlineStart).toBe('0px');
  });

  it('clamps each inline edge against its own container padding', async () => {
    const wrapper = await fixture<HTMLElement>(
      `<div style="--_container-padding-inline-start: 16px; --_container-padding-inline-end: 4px; width: 320px">
         <tct-list edge-compensation="inline"><tct-list-item label="One"></tct-list-item></tct-list>
       </div>`,
    );
    const list = wrapper.querySelector<TctList>('tct-list')!;
    expect([styleOf(list, 'Start'), styleOf(list, 'End')]).toEqual(['-8px', '-4px']);
  });

  it('leaves the row in place when no container padding is published', async () => {
    const list = await make('edge-compensation="inline"');
    expect([styleOf(list, 'Start'), styleOf(list, 'End')]).toEqual(['0px', '0px']);
  });

  it('mirrors in right-to-left containers (logical margins)', async () => {
    const wrapper = await fixture<HTMLElement>(
      `<div style="--_container-padding-inline-start: 16px; --_container-padding-inline-end: 4px; width: 320px">
         <tct-list edge-compensation="inline"><tct-list-item label="One"></tct-list-item></tct-list>
       </div>`,
      {dir: 'rtl'},
    );
    const list = wrapper.querySelector<TctList>('tct-list')!;
    const style = getComputedStyle(wrapperOf(rows(list)[0]!));
    expect([style.marginRight, style.marginLeft]).toEqual(['-8px', '-4px']);
  });

  it('does not apply the cancelling margin to a list item outside a list', async () => {
    const wrapper = await fixture<HTMLElement>(
      `<div style="--_container-padding-inline-start: 16px"><tct-list-item label="Alone"></tct-list-item></div>`,
    );
    const row = wrapper.querySelector<TctListItem>('tct-list-item')!;
    expect(getComputedStyle(wrapperOf(row)).marginInlineStart).toBe('0px');
  });
});

describe('tct-list-item: interactive rows', () => {
  it('renders an invisible button when pressable', async () => {
    const list = await make('', '<tct-list-item label="Open" pressable></tct-list-item>');
    const button = itemOf(rows(list)[0]!).shadowRoot!.querySelector('button')!;
    expect(button).not.toBeNull();
    expect(await axNode(button)).toMatchObject({role: 'button', name: 'Open'});
  });

  it('fires click once when the invisible button is clicked', async () => {
    const list = await make('', '<tct-list-item label="Open" pressable></tct-list-item>');
    const row = rows(list)[0]!;
    const clicks = recordEvents(row, 'click');
    await userEvent.click(itemOf(row).shadowRoot!.querySelector('button')!);
    expectEventCounts(clicks, {click: 1});
  });

  it('fires click once when the container area is clicked', async () => {
    const list = await make('', '<tct-list-item label="Open" pressable></tct-list-item>');
    const row = rows(list)[0]!;
    const clicks = recordEvents(row, 'click');
    const box = paint(row).getBoundingClientRect();
    await userEvent.click(paint(row), {position: {x: 2, y: box.height / 2}});
    expectEventCounts(clicks, {click: 1});
  });

  it('does not forward a click that lands on nested interactive end content', async () => {
    const list = await make(
      '',
      '<tct-list-item label="Row" pressable><button slot="end" id="inner">More</button></tct-list-item>',
    );
    const row = rows(list)[0]!;
    const seen: string[] = [];
    row.addEventListener('click', (event) => {
      seen.push((event.composedPath()[0] as HTMLElement).id || 'row');
    });
    await userEvent.click(row.querySelector('#inner')!);
    expect(seen).toEqual(['inner']);
  });

  it('the invisible button is focusable by keyboard and Enter and Space activate it', async () => {
    const list = await make('', '<tct-list-item label="Open" pressable></tct-list-item>');
    const row = rows(list)[0]!;
    const clicks = recordEvents(row, 'click');
    await pressKeys('Tab');
    expect(itemOf(row).shadowRoot!.activeElement).toBe(
      itemOf(row).shadowRoot!.querySelector('button'),
    );
    await pressKeys('Enter');
    await pressKeys(' ');
    expectEventCounts(clicks, {click: 2});
  });

  it('renders one tab stop per row and no nested buttons', async () => {
    const list = await make(
      '',
      '<tct-list-item label="A" pressable><span slot="start">S</span></tct-list-item><tct-list-item label="B" pressable></tct-list-item>',
    );
    for (const row of rows(list)) {
      expect(itemOf(row).shadowRoot!.querySelectorAll('button')).toHaveLength(1);
    }
    const stops = await tabSequence(list, {max: 4});
    expect(
      stops.filter(
        (stop) =>
          list.contains(stop) ||
          rows(list).some(
            (row) => row.shadowRoot!.contains(stop) || itemOf(row).shadowRoot!.contains(stop),
          ),
      ),
    ).toHaveLength(2);
  });

  it('renders an invisible anchor for href, with target', async () => {
    const list = await make(
      '',
      '<tct-list-item label="Docs" href="https://example.com" target="_blank"></tct-list-item>',
    );
    const anchor = itemOf(rows(list)[0]!).shadowRoot!.querySelector('a')!;
    expect(anchor.getAttribute('href')).toBe('https://example.com');
    expect(anchor.target).toBe('_blank');
    expect(anchor.rel).toContain('noopener');
    expect(await axNode(anchor)).toMatchObject({role: 'link', name: 'Docs'});
  });

  it('renders neither button nor anchor for static items', async () => {
    const list = await make();
    expect(itemOf(rows(list)[0]!).shadowRoot!.querySelector('button, a')).toBeNull();
  });

  it('sets aria-disabled on the row and disables the invisible button', async () => {
    const list = await make('', '<tct-list-item label="Off" pressable disabled></tct-list-item>');
    const row = rows(list)[0]!;
    expect(await axNode(row)).toMatchObject({role: 'listitem', disabled: 'true'});
    expect(itemOf(row).shadowRoot!.querySelector('button')!.disabled).toBe(true);
  });

  it('does not fire click when a disabled row is clicked', async () => {
    const list = await make('', '<tct-list-item label="Off" pressable disabled></tct-list-item>');
    const row = rows(list)[0]!;
    const clicks = recordEvents(row, 'click');
    await userEvent.click(paint(row), {force: true});
    expectEventCounts(clicks, {click: 0});
  });

  it('conveys selection through aria-current on the row and none when not selected', async () => {
    const list = await make(
      '',
      '<tct-list-item label="On" selected></tct-list-item><tct-list-item label="Off"></tct-list-item>',
    );
    const internals = (row: TctListItem) =>
      (row as unknown as {internals: ElementInternals}).internals;
    expect(internals(rows(list)[0]!).ariaCurrent).toBe('true');
    expect(internals(rows(list)[0]!).ariaSelected).toBeNull();
    expect(internals(rows(list)[1]!).ariaCurrent).toBeNull();
  });

  it('lets a consumer aria-current win', async () => {
    const list = await make(
      '',
      '<tct-list-item aria-current="page" label="On" selected></tct-list-item>',
    );
    const row = rows(list)[0]!;
    expect((row as unknown as {internals: ElementInternals}).internals.ariaCurrent).toBeNull();
  });

  it('renders start content before the label and end content after it', async () => {
    const list = await make(
      '',
      '<tct-list-item label="Row"><span slot="start" id="s">S</span><span slot="end" id="e">E</span></tct-list-item>',
    );
    const row = rows(list)[0]!;
    const label = itemOf(row).shadowRoot!.querySelector('.label')!.getBoundingClientRect();
    expect(row.querySelector('#s')!.getBoundingClientRect().right).toBeLessThanOrEqual(
      label.left + 1,
    );
    expect(row.querySelector('#e')!.getBoundingClientRect().left).toBeGreaterThanOrEqual(
      label.right - 1,
    );
  });

  it('accepts rich content as the label and description', async () => {
    const list = await make(
      '',
      '<tct-list-item><strong slot="label">Rich</strong><em slot="description">desc</em></tct-list-item>',
    );
    const row = rows(list)[0]!;
    expect(row.querySelector('strong')!.getBoundingClientRect().width).toBeGreaterThan(0);
    expect(row.querySelector('em')!.getBoundingClientRect().width).toBeGreaterThan(0);
  });

  it('does not render a description when not provided', async () => {
    const list = await make();
    expect(itemOf(rows(list)[0]!).shadowRoot!.querySelector('.description')).toBeNull();
  });

  it('delegates surface clicks to a nested control (interactive-selector) with no second tab stop', async () => {
    const list = await make(
      '',
      '<tct-list-item label="Row" interactive-selector="input"><input slot="start" type="checkbox" aria-label="Pick" /></tct-list-item>',
    );
    const row = rows(list)[0]!;
    await row.updateComplete;
    await itemOf(row).updateComplete;
    expect(itemOf(row).shadowRoot!.querySelector('button, a')).toBeNull();
    const input = row.querySelector('input')!;
    await userEvent.click(itemOf(row).shadowRoot!.querySelector('.label')!);
    expect(input.checked).toBe(true);
  });

  it('accepts the delegate element as a property', async () => {
    const list = await make(
      '',
      '<tct-list-item label="Row"><input slot="start" type="checkbox" aria-label="Pick" /></tct-list-item>',
    );
    const row = rows(list)[0]!;
    row.interactiveElement = row.querySelector('input');
    await row.updateComplete;
    await itemOf(row).updateComplete;
    await userEvent.click(itemOf(row).shadowRoot!.querySelector('.label')!);
    expect(row.querySelector('input')!.checked).toBe(true);
  });
});

describe('tct-list: RTL and forced colours', () => {
  it('lays rows out from the inline start and mirrors in right-to-left containers', async () => {
    const markup =
      '<tct-list-item label="Row"><span slot="start" id="s">S</span><span slot="end" id="e">E</span></tct-list-item>';
    const ltr = await make('', markup);
    const rtl = await make('', markup, {dir: 'rtl'});
    const rect = (list: TctList, id: string) =>
      list.querySelector(`#${id}`)!.getBoundingClientRect();
    expect(rect(ltr, 's').left).toBeLessThan(rect(ltr, 'e').left);
    expect(rect(rtl, 's').left).toBeGreaterThan(rect(rtl, 'e').left);
  });

  it('keeps markers on the start side in right-to-left containers', async () => {
    const list = await make('list-style="disc"', '<tct-list-item label="Row"></tct-list-item>', {
      dir: 'rtl',
    });
    const row = rows(list)[0]!;
    const marker = row.shadowRoot!.querySelector('.marker')!.getBoundingClientRect();
    const label = itemOf(row).shadowRoot!.querySelector('.label')!.getBoundingClientRect();
    expect(marker.left).toBeGreaterThan(label.left);
  });

  it.skipIf(!isChromium)(
    'keeps dividers and markers in system colours under forced colours',
    async () => {
      await emulateMedia({forcedColors: 'active'});
      const list = await make(
        'has-dividers list-style="disc"',
        '<tct-list-item label="A"></tct-list-item><tct-list-item label="B"></tct-list-item>',
      );
      const row = rows(list)[0]!;
      expect(getComputedStyle(wrapperOf(row)).borderBlockEndStyle).toBe('solid');
      expect(getComputedStyle(row.shadowRoot!.querySelector('.dot')!).backgroundColor).not.toBe(
        'rgba(0, 0, 0, 0)',
      );
    },
  );
});

describe('tct-list-item: keyboard', () => {
  // The table lives in parity.json (read as data; the docs and these tests share it).
  const parity = Object.values(
    import.meta.glob<{entries: Record<string, {keyboard: KeyboardRow[]}>}>('./parity.json', {
      eager: true,
      import: 'default',
    }),
  )[0]!;
  const table = (when: string) =>
    parity.entries['core.list-item']!.keyboard.filter((row) => row.when === when);
  const before = (element: HTMLElement) =>
    element.closest('div')!.querySelector<HTMLElement>('#before')!;
  const shell = (rowMarkup: string) =>
    `<button id="before">before</button><tct-list header="Items">${rowMarkup}</tct-list>`;
  const innerOf = (element: HTMLElement) =>
    (element.shadowRoot!.querySelector('tct-item')!).shadowRoot!;
  const clicks = new WeakMap<Element, number>();

  runKeyboardSuite({
    tag: 'tct-list-item',
    render: () =>
      shell(
        '<tct-list-item label="A" pressable></tct-list-item><tct-list-item label="B" pressable></tct-list-item>',
      ),
    table: table('pressable or href'),
    steps: {
      "Moves focus to the row's button or link, one tab stop per row": {
        focus: before,
        keys: ['Tab', 'Tab'],
        expect: ({element}) => {
          // Two rows, two stops: the second Tab lands on the second row's button.
          const second = element.parentElement!.querySelectorAll('tct-list-item')[1]!;
          expect(innerOf(second as HTMLElement).activeElement).toBe(
            innerOf(second as HTMLElement).querySelector('button'),
          );
        },
      },
    },
  });

  runKeyboardSuite({
    tag: 'tct-list-item',
    render: () => shell('<tct-list-item label="Open" pressable></tct-list-item>'),
    table: table('pressable'),
    steps: {
      'Activates the row button': {
        setup: (element) => {
          element.addEventListener('click', () =>
            clicks.set(element, (clicks.get(element) ?? 0) + 1),
          );
        },
        focus: (element) => innerOf(element).querySelector<HTMLElement>('button'),
        keys: ['Enter', ' '],
        expect: ({element}) => {
          expect(clicks.get(element)).toBe(2);
        },
      },
    },
  });

  runKeyboardSuite({
    tag: 'tct-list-item',
    render: () =>
      shell('<tct-list-item label="Docs" href="#list-keyboard-target"></tct-list-item>'),
    table: table('href'),
    steps: {
      'Follows the row link': {
        focus: (element) => innerOf(element).querySelector<HTMLElement>('a'),
        keys: ['Enter'],
        expect: () => {
          expect(location.hash).toBe('#list-keyboard-target');
          history.replaceState(null, '', location.pathname + location.search);
        },
      },
    },
  });

  runKeyboardSuite({
    tag: 'tct-list-item',
    render: () =>
      shell(
        '<tct-list-item label="Row" interactive-selector="input"><input slot="start" type="checkbox" aria-label="Pick" /></tct-list-item>',
      ),
    table: table('delegating'),
    steps: {
      'Moves focus to the nested control only, never to a second stop on the row': {
        focus: before,
        keys: ['Tab'],
        expect: ({element}) => {
          expect(document.activeElement).toBe(element.querySelector('input'));
        },
      },
    },
  });
});
