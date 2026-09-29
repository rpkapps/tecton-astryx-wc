/**
 * tct-overflow-list: fit computation, collapse direction, floors and caps, multi-row, the indicator,
 * the collapsed-set notification, resize stability, semantics, RTL (ported from upstream
 * OverflowList.test.tsx).
 */
import {html} from 'lit';
import {describe, expect, it} from 'vitest';
import {axNode, axTree, expectAccessible} from '@tecton-astryx/testing/a11y.js';
import {emulateMedia} from '@tecton-astryx/testing/emulate.js';
import {expectEventFlags, recordEvents} from '@tecton-astryx/testing/events.js';
import {fixture} from '@tecton-astryx/testing/fixture.js';
import {pressKeys} from '@tecton-astryx/testing/keyboard.js';
import {runElementSuite} from '@tecton-astryx/testing/suites/element.js';
import {isChromium} from '@tecton-astryx/testing/tier.js';
import {nextFrame, waitUntil} from '@tecton-astryx/testing/timing.js';
import './define.js';
import type {TctOverflowList} from './tct-overflow-list.js';
import type {OverflowRenderer} from './overflow-list.types.js';

/** Fixed-width items so the fit arithmetic is exact: 5 items of 50px with gap 0. */
const item = (label: string, width = 50): string =>
  `<div data-label="${label}" style="width: ${width}px; height: 20px">${label}</div>`;
const ITEMS = ['A', 'B', 'C', 'D', 'E'].map((label) => item(label)).join('');

interface Options {
  width?: number;
  dir?: 'ltr' | 'rtl';
  lang?: string;
}

const make = async (
  attributes = 'gap="0"',
  items = ITEMS,
  options: Options = {},
): Promise<TctOverflowList> => {
  const wrapper = await fixture<HTMLElement>(
    `<div id="frame" style="width: ${options.width ?? 180}px"><tct-overflow-list ${attributes}>${items}</tct-overflow-list></div>`,
    options,
  );
  const element = wrapper.querySelector<TctOverflowList>('tct-overflow-list')!;
  await settled(element);
  return element;
};

/** Waits for the measurement and the re-render that follows it. */
async function settled(element: TctOverflowList): Promise<void> {
  await element.updateComplete;
  await nextFrame();
  await element.updateComplete;
  await nextFrame();
}

const resize = async (element: TctOverflowList, width: number): Promise<void> => {
  element.parentElement!.style.width = `${width}px`;
  await settled(element);
};

const shown = (element: TctOverflowList): string[] =>
  [...element.children]
    .filter((child) => getComputedStyle(child).display !== 'none')
    .map((child) => (child as HTMLElement).dataset.label ?? child.textContent ?? '');
const collapsed = (element: TctOverflowList): string[] =>
  [...element.children]
    .filter((child) => getComputedStyle(child).display === 'none')
    .map((child) => (child as HTMLElement).dataset.label ?? '');
const indicator = (element: TctOverflowList): HTMLElement | null =>
  element.shadowRoot!.querySelector<HTMLElement>('.list .indicator');
const plus: OverflowRenderer = (overflowItems) =>
  html`<span class="plus">+${overflowItems.length}</span>`;

runElementSuite({
  tag: 'tct-overflow-list',
  render: () =>
    html`<tct-overflow-list gap="0" style="display: block; width: 200px"
      ><div style="width: 50px">A</div>
      <div style="width: 50px">B</div></tct-overflow-list
    >`,
  properties: {
    gap: 4,
    minVisibleItems: 1,
    maxVisibleItems: 3,
    maxRows: 2,
    collapseFrom: 'start',
    behavior: 'observe-parent',
    showCount: true,
  },
  attributes: {
    minVisibleItems: 'min-visible-items',
    maxVisibleItems: 'max-visible-items',
    maxRows: 'max-rows',
    collapseFrom: 'collapse-from',
    behavior: 'behavior',
    showCount: 'show-count',
  },
  events: ['tct-overflow-change'],
});

describe('tct-overflow-list: when all items fit', () => {
  it('renders every item and no indicator', async () => {
    const element = await make('gap="0"', ITEMS, {width: 400});
    element.overflowRenderer = plus;
    await settled(element);
    expect(shown(element)).toEqual(['A', 'B', 'C', 'D', 'E']);
    expect(indicator(element)).toBeNull();
  });

  it('renders nothing extra for an empty child list', async () => {
    const element = await make('gap="0"', '');
    element.overflowRenderer = plus;
    await settled(element);
    expect(indicator(element)).toBeNull();
    expect(element.shadowRoot!.querySelector('.list')).not.toBeNull();
  });
});

describe('tct-overflow-list: collapse-from="end" (default)', () => {
  it('hides trailing items and shows an indicator for them', async () => {
    const element = await make();
    element.overflowRenderer = plus;
    await settled(element);
    // 300px: indicator reserves the widest "+5"; A B C D fit (200) + indicator, E collapses.
    expect(collapsed(element).length).toBeGreaterThan(0);
    expect(shown(element)).toEqual(['A', 'B', 'C', 'D', 'E'].slice(0, shown(element).length));
    expect(indicator(element)!.textContent.trim()).toBe(`+${collapsed(element).length}`);
  });

  it('fits more items as the available width grows, and fewer as it shrinks', async () => {
    const element = await make();
    element.overflowRenderer = plus;
    await settled(element);
    const before = shown(element).length;
    await resize(element, 500);
    expect(shown(element)).toHaveLength(5);
    expect(indicator(element)).toBeNull();
    await resize(element, 100);
    expect(shown(element).length).toBeLessThan(before);
    await resize(element, 180);
    expect(shown(element)).toHaveLength(before); // back where it was: no hysteresis
  });

  it('places the indicator after the visible items', async () => {
    const element = await make();
    element.overflowRenderer = plus;
    await settled(element);
    const last = element.querySelector<HTMLElement>(`[data-label="${shown(element).at(-1)}"]`)!;
    expect(indicator(element)!.getBoundingClientRect().left).toBeGreaterThanOrEqual(
      last.getBoundingClientRect().right - 1,
    );
  });

  it('reserves the widest indicator: it is measured against all items', async () => {
    // Ten 20px items in 190px: the indicator "+10" is wider than "+3", and the row must not overflow.
    const many = Array.from({length: 10}, (_, index) => item(String(index), 20)).join('');
    const element = await make('gap="0"', many, {width: 190});
    element.overflowRenderer = (list) =>
      html`<span style="display: inline-block; width: ${list.length >= 10 ? 60 : 30}px"
        >+${list.length}</span
      >`;
    await settled(element);
    const list = element.shadowRoot!.querySelector<HTMLElement>('.list')!;
    const used = [...list.children, ...element.children]
      .filter((child) => getComputedStyle(child).display !== 'none' && child.tagName !== 'SLOT')
      .reduce((total, child) => total + child.getBoundingClientRect().width, 0);
    expect(used).toBeLessThanOrEqual(190);
    expect(indicator(element)).not.toBeNull();
  });

  it('keeps the measurement copy hidden and inert', async () => {
    const element = await make();
    element.overflowRenderer = plus;
    await settled(element);
    const measure = element.shadowRoot!.querySelector<HTMLElement>('.measure')!;
    expect(measure.hasAttribute('inert')).toBe(true);
    expect(measure.getAttribute('aria-hidden')).toBe('true');
    expect(getComputedStyle(measure).visibility).toBe('hidden');
    expect(measure.getBoundingClientRect().height).toBe(0);
  });
});

describe('tct-overflow-list: collapse-from="start"', () => {
  it('hides leading items and renders the indicator first', async () => {
    const element = await make('gap="0" collapse-from="start"');
    element.overflowRenderer = plus;
    await settled(element);
    const hidden = collapsed(element);
    expect(hidden.length).toBeGreaterThan(0);
    expect(hidden).toEqual(['A', 'B', 'C', 'D', 'E'].slice(0, hidden.length));
    const first = element.querySelector<HTMLElement>(`[data-label="${shown(element)[0]}"]`)!;
    expect(indicator(element)!.getBoundingClientRect().right).toBeLessThanOrEqual(
      first.getBoundingClientRect().left + 1,
    );
  });
});

describe('tct-overflow-list: floors, caps and rows', () => {
  it('min-visible-items keeps at least the requested number visible', async () => {
    const element = await make('gap="0" min-visible-items="3"', ITEMS, {width: 60});
    element.overflowRenderer = plus;
    await settled(element);
    expect(shown(element)).toHaveLength(3);
  });

  it('max-visible-items caps visible items even when they all fit', async () => {
    const element = await make('gap="0" max-visible-items="2"', ITEMS, {width: 500});
    element.overflowRenderer = plus;
    await settled(element);
    expect(shown(element)).toEqual(['A', 'B']);
    expect(indicator(element)!.textContent.trim()).toBe('+3');
    await resize(element, 90);
    expect(shown(element).length).toBeLessThanOrEqual(2);
  });

  it('the floor wins over a smaller cap', async () => {
    const element = await make('gap="0" min-visible-items="3" max-visible-items="1"', ITEMS, {
      width: 500,
    });
    element.overflowRenderer = plus;
    await settled(element);
    expect(shown(element)).toHaveLength(3);
  });

  it('max-rows wraps items onto a bounded number of rows before collapsing the rest', async () => {
    const element = await make('gap="0" max-rows="2"', ITEMS, {width: 130});
    element.overflowRenderer = plus;
    await settled(element);
    const rows = new Set(
      shown(element).map((label) =>
        Math.round(element.querySelector(`[data-label="${label}"]`)!.getBoundingClientRect().top),
      ),
    );
    expect(rows.size).toBeLessThanOrEqual(2);
    expect(collapsed(element).length).toBeGreaterThan(0);
    expect(element.shadowRoot!.querySelector('.list')!.hasAttribute('data-rows')).toBe(true);
    // The container never grows past two rows.
    expect(
      element.shadowRoot!.querySelector('.list')!.getBoundingClientRect().height,
    ).toBeLessThanOrEqual(41);
  });

  it('max-rows="1" keeps the single-line behaviour', async () => {
    const element = await make('gap="0" max-rows="1"');
    expect(element.shadowRoot!.querySelector('.list')!.hasAttribute('data-rows')).toBe(false);
  });

  it('applies the gap step as a spacing token', async () => {
    const element = await make('gap="4"', ITEMS, {width: 600});
    const list = element.shadowRoot!.querySelector<HTMLElement>('.list')!;
    const four = getComputedStyle(list).columnGap;
    const zero = await make('gap="0"', ITEMS, {width: 600});
    expect(getComputedStyle(zero.shadowRoot!.querySelector('.list')!).columnGap).toBe('0px');
    expect(parseFloat(four)).toBeGreaterThan(0);
    const half = await make('gap="0.5"', ITEMS, {width: 600});
    expect(
      parseFloat(getComputedStyle(half.shadowRoot!.querySelector('.list')!).columnGap),
    ).toBeLessThan(parseFloat(four));
  });
});

describe('tct-overflow-list: without an indicator', () => {
  it('drops overflowing items but renders no indicator', async () => {
    const element = await make();
    expect(collapsed(element).length).toBeGreaterThan(0);
    expect(indicator(element)).toBeNull();
    expect(element.shadowRoot!.querySelector('.measure .indicator')).toBeNull();
  });

  it('show-count draws the built-in +N, named "N more" for assistive technology', async () => {
    const element = await make('gap="0" show-count');
    const count = element.shadowRoot!.querySelector<HTMLElement>('.list .count')!;
    const hidden = collapsed(element).length;
    expect(count.textContent.replace(/\s+/g, ' ').trim()).toBe(`+${hidden}${hidden} more`);
    // The visible "+N" is hidden from assistive technology, so the name is spoken once: read the name the
    // chip would have as a control (name from content skips aria-hidden subtrees).
    count.setAttribute('role', 'button');
    expect(await axNode(count)).toMatchObject({name: `${hidden} more`});
  });

  it('the built-in indicator stays named and stable while the row resizes', async () => {
    const element = await make('gap="0" show-count');
    const counts: number[] = [];
    for (const width of [300, 220, 160, 100, 160, 220, 300]) {
      await resize(element, width);
      const hidden = collapsed(element).length;
      counts.push(hidden);
      const text = element.shadowRoot!.querySelector('.list .count')?.textContent ?? '';
      if (hidden > 0) expect(text).toContain(`${hidden} more`);
      else expect(element.shadowRoot!.querySelector('.list .count')).toBeNull();
    }
    // Symmetric sequence, symmetric result: no oscillation, no hysteresis.
    expect(counts).toEqual([...counts].reverse());
    expect(counts[3]!).toBeGreaterThan(counts[0]!);
  });

  it('is stable under a resize sweep: monotonic in the width, never over the width, no loops', async () => {
    const element = await make('gap="0" show-count', ITEMS, {width: 60});
    let previous = 0;
    for (let width = 60; width <= 320; width += 7) {
      await resize(element, width);
      const visible = shown(element).length;
      expect(visible, `at ${width}px`).toBeGreaterThanOrEqual(previous);
      expect(visible).toBeLessThanOrEqual(5);
      const list = element.shadowRoot!.querySelector<HTMLElement>('.list')!;
      const used = visible * 50 + (indicator(element)?.getBoundingClientRect().width ?? 0);
      expect(used, `at ${width}px`).toBeLessThanOrEqual(width + 0.5);
      previous = visible;
      expect(list.getBoundingClientRect().width).toBeLessThanOrEqual(width + 0.5);
    }
    expect(previous).toBe(5);
  });

  it('an overflow renderer wins over show-count', async () => {
    const element = await make('gap="0" show-count');
    element.overflowRenderer = plus;
    await settled(element);
    expect(indicator(element)!.querySelector('.plus')).not.toBeNull();
    expect(indicator(element)!.querySelector('.count')).toBeNull();
  });

  it('accepts a text or node result from the renderer', async () => {
    const element = await make();
    element.overflowRenderer = (list) => `${list.length} hidden`;
    await settled(element);
    expect(indicator(element)!.textContent.trim()).toMatch(/^\d+ hidden$/);
    const node = document.createElement('b');
    node.textContent = 'node';
    element.overflowRenderer = () => document.createElement('b');
    await element.updateComplete;
    expect(indicator(element)!.querySelector('b')).not.toBeNull();
    expect(node.textContent).toBe('node');
  });
});

describe('tct-overflow-list: tct-overflow-change', () => {
  /** Mounts the list under a frame that already listens, so the first measurement is observed. */
  const mountObserved = async (frame: number) => {
    const wrapper = await fixture<HTMLElement>(`<div style="width: ${frame}px"></div>`);
    const events = recordEvents(wrapper, 'tct-overflow-change');
    wrapper.innerHTML = `<tct-overflow-list gap="0">${ITEMS}</tct-overflow-list>`;
    const element = wrapper.querySelector<TctOverflowList>('tct-overflow-list')!;
    await settled(element);
    return {element, events};
  };

  it('stays silent when nothing overflows, including on mount', async () => {
    const {events} = await mountObserved(500);
    expect(events.events).toHaveLength(0);
  });

  it('fires once on mount while overflowing, with the measured set and the right flags', async () => {
    const {element, events} = await mountObserved(180);
    expect(events.events).toHaveLength(1);
    expectEventFlags(events.events[0]!, {bubbles: true, composed: true, cancelable: false});
    const items = (events.events[0] as unknown as {items: {element: HTMLElement; index: number}[]})
      .items;
    expect(items.map(({element: el}) => el.dataset.label)).toEqual(collapsed(element));
  });

  it('reports the collapsed items by original index', async () => {
    const element = await make();
    const events = recordEvents(element, 'tct-overflow-change');
    await resize(element, 100);
    const last = events.events.at(-1) as unknown as {
      items: {element: HTMLElement; index: number}[];
    };
    expect(last.items.map((entry) => entry.index)).toEqual(
      collapsed(element).map((label) => 'ABCDE'.indexOf(label)),
    );
  });

  it('reports an empty set once the row fits everything, and does not re-fire for an unchanged set', async () => {
    const element = await make();
    const events = recordEvents(element, 'tct-overflow-change');
    await resize(element, 100);
    const count = events.events.length;
    await resize(element, 102); // a different width, the same collapsed set
    expect(events.events).toHaveLength(count);
    await resize(element, 500);
    const emptied = events.events.at(-1) as unknown as {items: unknown[]};
    expect(emptied.items).toEqual([]);
    expect(events.events.length).toBe(count + 1);
  });

  it('reports a membership or order change even when the count stays the same', async () => {
    const element = await make('gap="0"', ITEMS, {width: 160});
    const events = recordEvents(element, 'tct-overflow-change');
    const hidden = collapsed(element).length;
    expect(hidden).toBeGreaterThan(0);
    // Reorder: the last child moves to the front, so a different element is collapsed at the same index.
    element.prepend(element.lastElementChild!);
    await settled(element);
    expect(collapsed(element)).toHaveLength(hidden);
    expect(events.events).toHaveLength(1);
  });

  it('re-measures same-count content changes (a wider item pushes another out)', async () => {
    const element = await make('gap="0"', ITEMS, {width: 300});
    element.append(element.firstElementChild!);
    await settled(element);
    element.prepend(element.lastElementChild!);
    await settled(element);
    const before = shown(element);
    (element.children[0] as HTMLElement).style.width = '140px';
    // Children resizing is observed through the content: nudge a measurement with a slotchange.
    element.append(element.firstElementChild!);
    await settled(element);
    expect(shown(element)).not.toEqual(before);
  });

  it('reports the measured set when the number of children changes, and nothing after removal', async () => {
    const element = await make('gap="0"', ITEMS, {width: 180});
    const events = recordEvents(element, 'tct-overflow-change');
    element.insertAdjacentHTML('beforeend', item('F') + item('G'));
    await settled(element);
    expect(events.events.length).toBeGreaterThanOrEqual(1);
    const seen = events.events.length;
    element.remove();
    await nextFrame();
    expect(events.events).toHaveLength(seen);
  });

  it('reports the leading items with collapse-from="start"', async () => {
    const element = await make('gap="0" collapse-from="start"', ITEMS, {width: 180});
    const events = recordEvents(element, 'tct-overflow-change');
    await resize(element, 100);
    const last = events.events.at(-1) as unknown as {items: {index: number}[]};
    expect(last.items.map((entry) => entry.index)).toEqual(
      collapsed(element).map((label) => 'ABCDE'.indexOf(label)),
    );
    expect(last.items[0]!.index).toBe(0);
  });

  it('adds no indicator of its own, so an outside anchor stands alone', async () => {
    const element = await make();
    expect(indicator(element)).toBeNull();
    const events = recordEvents(element, 'tct-overflow-change');
    await resize(element, 100);
    expect(events.events.length).toBeGreaterThan(0);
    expect(indicator(element)).toBeNull();
  });

  it('reports alongside an overflow renderer without disturbing it', async () => {
    const element = await make();
    element.overflowRenderer = plus;
    const events = recordEvents(element, 'tct-overflow-change');
    await resize(element, 100);
    expect(events.events.length).toBeGreaterThan(0);
    expect(indicator(element)!.textContent.trim()).toBe(`+${collapsed(element).length}`);
  });
});

describe('tct-overflow-list: behaviour, semantics and accessibility', () => {
  it('observe-parent measures the parent content width', async () => {
    const wrapper = await fixture<HTMLElement>(
      `<div id="frame" style="width: 200px; padding: 0 10px"><tct-overflow-list gap="0" behavior="observe-parent" style="width: max-content">${ITEMS}</tct-overflow-list></div>`,
    );
    const element = wrapper.querySelector<TctOverflowList>('tct-overflow-list')!;
    element.overflowRenderer = plus;
    await settled(element);
    expect(shown(element).length).toBeGreaterThan(0);
    expect(collapsed(element).length).toBeGreaterThan(0);
    // Content box: 300 - 20 of padding; A B C D fit next to the indicator only if 200 + indicator <= 280.
    await resize(element, 600);
    expect(shown(element)).toHaveLength(5);
  });

  it('collapsed items leave the tab order and the accessibility tree', async () => {
    const buttons = ['A', 'B', 'C', 'D', 'E']
      .map(
        (label) =>
          `<button data-label="${label}" style="width: 50px; height: 20px">${label}</button>`,
      )
      .join('');
    const wrapper = await fixture<HTMLElement>(
      `<div style="width: 140px"><tct-overflow-list gap="0">${buttons}</tct-overflow-list></div>`,
    );
    const element = wrapper.querySelector<TctOverflowList>('tct-overflow-list')!;
    await settled(element);
    const tree = await axTree(element);
    expect(tree.filter((line) => line.startsWith('button'))).toHaveLength(shown(element).length);
    // Tab visits only the visible buttons.
    const visited: string[] = [];
    element.querySelector('button')!.focus();
    for (let i = 0; i < 6; i++) {
      await pressKeys('Tab');
      const active = document.activeElement as HTMLElement | null;
      if (active?.dataset.label) visited.push(active.dataset.label);
    }
    for (const label of visited) expect(collapsed(element)).not.toContain(label);
  });

  it('is accessible with and without overflow', async () => {
    const fits = await make('gap="0"', ITEMS, {width: 500});
    await expectAccessible(fits.parentElement!);
    const overflowing = await make('gap="0" show-count');
    await expectAccessible(overflowing.parentElement!);
  });

  it('the row lays out from the inline start, with the indicator at the inline end, in RTL', async () => {
    const element = await make('gap="0" show-count', ITEMS, {dir: 'rtl'});
    const first = element.querySelector<HTMLElement>('[data-label="A"]')!.getBoundingClientRect();
    const count = element.shadowRoot!.querySelector('.list .count')!.getBoundingClientRect();
    expect(first.right).toBeGreaterThan(count.right);
    expect(collapsed(element).length).toBeGreaterThan(0);
  });

  it('falls back to English for the indicator name in a locale without the message (de-DE)', async () => {
    const element = await make('gap="0" show-count', ITEMS, {lang: 'de-DE'});
    await waitUntil(
      () => element.shadowRoot!.querySelector('.visually-hidden') !== null,
      'indicator',
    );
    expect(element.shadowRoot!.querySelector('.visually-hidden')!.textContent).toMatch(/\d+ more/);
  });

  it.skipIf(!isChromium)(
    'draws the built-in indicator with a system border under forced colours',
    async () => {
      await emulateMedia({forcedColors: 'active'});
      const element = await make('gap="0" show-count');
      const count = element.shadowRoot!.querySelector<HTMLElement>('.count')!;
      expect(getComputedStyle(count).borderTopStyle).toBe('solid');
    },
  );
});
