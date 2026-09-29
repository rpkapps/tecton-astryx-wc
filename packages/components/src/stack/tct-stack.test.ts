/**
 * tct-stack and tct-stack-item: layout (ported from upstream Stack.test.tsx and StackItem.test.tsx),
 * alignment resolution, `as` semantics, padding precedence, sizing, scrolling, RTL, forced colours.
 */
import {html} from 'lit';
import {describe, expect, it} from 'vitest';
import {axNode, expectAccessible} from '@tecton-wc/testing/a11y.js';
import {emulateMedia} from '@tecton-wc/testing/emulate.js';
import {fixture} from '@tecton-wc/testing/fixture.js';
import {runElementSuite} from '@tecton-wc/testing/suites/element.js';
import {pressKeys} from '@tecton-wc/testing/keyboard.js';
import {isChromium} from '@tecton-wc/testing/tier.js';
import {waitUntil} from '@tecton-wc/testing/timing.js';
import {resolveStackAlignment} from './stack.types.js';
import './define.js';
import type {TctStack} from './tct-stack.js';
import type {TctStackItem} from './tct-stack-item.js';

/** Spacing-scale steps in CSS px (Tecton tokens). */
const PX: Record<string, number> = {
  '0': 0,
  '0.5': 2,
  '1': 4,
  '1.5': 6,
  '2': 8,
  '3': 12,
  '4': 16,
  '5': 20,
  '6': 24,
  '8': 32,
  '10': 40,
};

const baseOf = (element: Element): HTMLElement =>
  element.shadowRoot!.querySelector<HTMLElement>('[part~="base"]')!;
const css = (element: Element) => getComputedStyle(baseOf(element));

/** Mounts markup in a 400px wide container and returns the first `tct-stack`. */
async function stack(attributes = '', content = '<span>a</span><span>b</span><span>c</span>') {
  const root = await fixture<HTMLElement>(
    `<div style="inline-size: 400px"><tct-stack ${attributes}>${content}</tct-stack></div>`,
  );
  return root.querySelector<TctStack>('tct-stack')!;
}

runElementSuite({
  tag: 'tct-stack',
  render: () => html`<tct-stack gap="2"><span>one</span><span>two</span></tct-stack>`,
  properties: {direction: 'horizontal', gap: 4, wrap: 'wrap', scrollable: true, hAlign: 'center'},
  attributes: {direction: 'direction', gap: 'gap', wrap: 'wrap'},
});

runElementSuite({
  tag: 'tct-stack-item',
  render: () => html`<tct-stack-item>item</tct-stack-item>`,
  properties: {size: 'fill', crossAlignSelf: 'center', scrollable: true},
  attributes: {size: 'size', crossAlignSelf: 'cross-align-self'},
});

describe('tct-stack: structure (Stack.test.tsx)', () => {
  it('defaults to vertical direction', async () => {
    const element = await stack();
    expect(element.direction).toBe('vertical');
    expect(css(element).display).toBe('flex');
    expect(css(element).flexDirection).toBe('column');
  });

  it('renders the children as flex items of the base box, in order', async () => {
    const element = await stack('', '<b>first</b><i>second</i>');
    const slot = element.shadowRoot!.querySelector('slot')!;
    expect(slot.assignedElements().map((child) => child.localName)).toEqual(['b', 'i']);
    expect(baseOf(element).contains(slot)).toBe(true);
    const [first, second] = slot.assignedElements() as [HTMLElement, HTMLElement];
    // Column: the second child sits below the first.
    expect(second.getBoundingClientRect().top).toBeGreaterThanOrEqual(
      first.getBoundingClientRect().bottom - 1,
    );
  });

  it('renders as a div by default', async () => {
    const element = await stack();
    expect(baseOf(element).localName).toBe('div');
  });

  it('renders with horizontal direction', async () => {
    const element = await stack('direction="horizontal"');
    expect(css(element).flexDirection).toBe('row');
    const [a, b] = [...element.querySelectorAll('span')] as [HTMLElement, HTMLElement];
    expect(b.getBoundingClientRect().left).toBeGreaterThan(a.getBoundingClientRect().left);
    expect(b.getBoundingClientRect().top).toBeCloseTo(a.getBoundingClientRect().top, 0);
  });

  it('renders with vertical direction', async () => {
    const element = await stack('direction="vertical"');
    expect(css(element).flexDirection).toBe('column');
  });

  it('reflects the direction and ignores an unknown value', async () => {
    const element = await stack();
    expect(element.getAttribute('direction')).toBe('vertical');
    element.direction = 'horizontal';
    await element.updateComplete;
    expect(element.getAttribute('direction')).toBe('horizontal');
    (element as unknown as {direction: string}).direction = 'row';
    await element.updateComplete;
    expect(css(element).flexDirection).toBe('column');
  });

  it('renders with polymorphic as prop (nav)', async () => {
    const element = await stack('as="nav"');
    expect(baseOf(element).localName).toBe('nav');
  });

  it('renders with polymorphic as section', async () => {
    const element = await stack('as="section"');
    expect(baseOf(element).localName).toBe('section');
  });

  it('falls back to a div for an unsupported as value', async () => {
    const element = await stack('as="script"');
    expect(baseOf(element).localName).toBe('div');
  });

  it('switches the element when as changes, keeping the children', async () => {
    const element = await stack('as="section"');
    element.as = 'aside';
    await element.updateComplete;
    expect(baseOf(element).localName).toBe('aside');
    expect(element.querySelectorAll('span')).toHaveLength(3);
    expect(element.shadowRoot!.querySelector('slot')!.assignedElements()).toHaveLength(3);
  });
});

describe('tct-stack: gap, alignment, wrapping', () => {
  it.each(Object.keys(PX))('gap="%s" is the matching spacing token', async (step) => {
    const element = await stack(`gap="${step}"`);
    expect(css(element).rowGap).toBe(step === '0' ? '0px' : `${PX[step]}px`);
    expect(css(element).columnGap).toBe(step === '0' ? '0px' : `${PX[step]}px`);
  });

  it('has no gap by default, and a value off the scale is ignored', async () => {
    const element = await stack('gap="7"');
    expect(css(element).rowGap).toBe('0px');
  });

  it('renders with h-align (vertical: cross axis)', async () => {
    const element = await stack('h-align="center"');
    expect(css(element).alignItems).toBe('center');
  });

  it('renders with v-align (vertical: main axis)', async () => {
    const element = await stack('v-align="between"');
    expect(css(element).justifyContent).toBe('space-between');
  });

  it('renders horizontal with h-align (main) and v-align (cross)', async () => {
    const element = await stack('direction="horizontal" h-align="end" v-align="center"');
    expect(css(element).justifyContent).toBe('flex-end');
    expect(css(element).alignItems).toBe('center');
  });

  it('renders vertical with h-align (cross) and v-align (main)', async () => {
    const element = await stack('direction="vertical" h-align="end" v-align="around"');
    expect(css(element).alignItems).toBe('flex-end');
    expect(css(element).justifyContent).toBe('space-around');
  });

  it.each([
    ['start', 'flex-start'],
    ['center', 'center'],
    ['end', 'flex-end'],
    ['between', 'space-between'],
    ['around', 'space-around'],
    ['evenly', 'space-evenly'],
  ])('main-axis value %s is justify-content: %s', async (value, expected) => {
    const element = await stack(`direction="horizontal" h-align="${value}"`);
    expect(css(element).justifyContent).toBe(expected);
  });

  it('ignores an alignment value that does not belong to its axis', async () => {
    const element = await stack('direction="horizontal" h-align="stretch"');
    expect(css(element).justifyContent).toBe('normal');
    const other = await stack('direction="horizontal" v-align="between"');
    expect(css(other).alignItems).toBe('normal');
  });

  it('renders with wrap', async () => {
    const element = await stack('wrap="wrap"');
    expect(css(element).flexWrap).toBe('wrap');
    element.wrap = 'wrap-reverse';
    await element.updateComplete;
    expect(css(element).flexWrap).toBe('wrap-reverse');
    element.wrap = 'nowrap';
    await element.updateComplete;
    expect(css(element).flexWrap).toBe('nowrap');
  });

  it('actually wraps the items onto a second line', async () => {
    const wide = '<div style="inline-size: 150px">x</div>'.repeat(3);
    const element = await stack('direction="horizontal" wrap="wrap"', wide);
    const tops = [...element.querySelectorAll('div')].map(
      (item) => item.getBoundingClientRect().top,
    );
    expect(new Set(tops).size).toBeGreaterThan(1);
  });

  it('accepts justify as the main-axis alias (horizontal)', async () => {
    const element = await stack('direction="horizontal" justify="between"');
    expect(css(element).justifyContent).toBe('space-between');
  });

  it('accepts alignment as the cross-axis alias (horizontal)', async () => {
    const element = await stack('direction="horizontal" alignment="end"');
    expect(css(element).alignItems).toBe('flex-end');
  });

  it('accepts justify as the main-axis alias (vertical)', async () => {
    const element = await stack('direction="vertical" justify="center"');
    expect(css(element).justifyContent).toBe('center');
  });

  it('accepts alignment as the cross-axis alias (vertical)', async () => {
    const element = await stack('direction="vertical" alignment="center"');
    expect(css(element).alignItems).toBe('center');
  });

  it('prefers explicit h-align/v-align over aliases', async () => {
    const element = await stack('direction="horizontal" h-align="end" justify="start"');
    expect(css(element).justifyContent).toBe('flex-end');
    const vertical = await stack('direction="vertical" v-align="end" justify="start"');
    expect(css(vertical).justifyContent).toBe('flex-end');
  });

  it('resolveStackAlignment maps hAlign/vAlign/justify/alignment like upstream', () => {
    expect(
      resolveStackAlignment({direction: 'horizontal', hAlign: 'between', vAlign: 'stretch'}),
    ).toEqual({main: 'between', cross: 'stretch'});
    expect(
      resolveStackAlignment({direction: 'vertical', hAlign: 'center', vAlign: 'evenly'}),
    ).toEqual({
      main: 'evenly',
      cross: 'center',
    });
    expect(
      resolveStackAlignment({direction: 'vertical', justify: 'end', alignment: 'start'}),
    ).toEqual({
      main: 'end',
      cross: 'start',
    });
  });
});

describe('tct-stack: padding, sizes, scrolling', () => {
  const paddings = (element: Element) => {
    const style = css(element);
    return [
      style.paddingInlineStart,
      style.paddingInlineEnd,
      style.paddingBlockStart,
      style.paddingBlockEnd,
    ].map(parseFloat);
  };

  it('has no padding by default', async () => {
    expect(paddings(await stack())).toEqual([0, 0, 0, 0]);
  });

  it('applies padding on all sides, zero included', async () => {
    expect(paddings(await stack('padding="3"'))).toEqual([12, 12, 12, 12]);
    expect(paddings(await stack('padding="0"'))).toEqual([0, 0, 0, 0]);
  });

  it('lets padding-inline/padding-block override padding on their axis', async () => {
    expect(paddings(await stack('padding="1" padding-inline="4" padding-block="2"'))).toEqual([
      16, 16, 8, 8,
    ]);
  });

  it('lets an edge override only its own edge, and give edges precedence over the axis', async () => {
    expect(
      paddings(await stack('padding="1" padding-block-start="8" padding-inline-end="6"')),
    ).toEqual([4, 24, 32, 4]);
    expect(paddings(await stack('padding-block="2" padding-block-end="5"'))).toEqual([0, 0, 8, 20]);
    expect(paddings(await stack('padding-inline="2" padding-inline-start="10"'))).toEqual([
      40, 8, 0, 0,
    ]);
  });

  it('resolves all four edges independently', async () => {
    expect(
      paddings(
        await stack(
          'padding-inline-start="1" padding-inline-end="2" padding-block-start="3" padding-block-end="4"',
        ),
      ),
    ).toEqual([4, 8, 12, 16]);
  });

  it('a nested stack does not inherit its parent padding', async () => {
    const root = await fixture<HTMLElement>(
      '<div style="inline-size: 400px"><tct-stack padding="4" width="300"><tct-stack id="inner">x</tct-stack></tct-stack></div>',
    );
    const inner = root.querySelector<TctStack>('#inner')!;
    expect(paddingOf(inner)).toBe(0);
    expect(inner.getBoundingClientRect().width).toBe(300 - 32);
  });

  it('applies numeric width and height as pixels, and strings as written', async () => {
    const element = await stack('width="200" height="120"');
    expect(element.getBoundingClientRect().width).toBe(200);
    expect(element.getBoundingClientRect().height).toBe(120);
    expect(baseOf(element).getBoundingClientRect().width).toBe(200);
    const percent = await stack('width="50%" height="5rem"');
    expect(percent.getBoundingClientRect().width).toBe(200);
    expect(percent.getBoundingClientRect().height).toBe(80);
  });

  it('applies max-width and min-height', async () => {
    const element = await stack('max-width="150" min-height="90"');
    expect(element.getBoundingClientRect().width).toBe(150);
    expect(element.getBoundingClientRect().height).toBeGreaterThanOrEqual(90);
  });

  it('a percentage height resolves against the stack parent', async () => {
    const root = await fixture<HTMLElement>(
      '<div style="block-size: 300px; display: block"><tct-stack height="100%">x</tct-stack></div>',
    );
    const element = root.querySelector<TctStack>('tct-stack')!;
    expect(element.getBoundingClientRect().height).toBe(300);
    expect(baseOf(element).getBoundingClientRect().height).toBe(300);
  });

  it('min-height stretches the base so v-align centres content in the extra space', async () => {
    const element = await stack(
      'min-height="200" v-align="center"',
      '<div style="block-size: 20px">x</div>',
    );
    const child = element.querySelector('div')!;
    const box = element.getBoundingClientRect();
    const mid = child.getBoundingClientRect().top + 10 - box.top;
    expect(mid).toBeCloseTo(100, 0);
  });

  it('applies overflow auto when scrollable is set, and not otherwise', async () => {
    expect(css(await stack('scrollable')).overflowY).toBe('auto');
    expect(css(await stack()).overflowY).toBe('visible');
  });

  it('scrolls its own content when it has a fixed height', async () => {
    const tall = '<div style="block-size: 300px; flex: none">tall</div>';
    const element = await stack('scrollable height="100"', tall);
    const box = baseOf(element);
    expect(box.scrollHeight).toBeGreaterThan(box.clientHeight);
    expect(box.clientHeight).toBe(100);
  });

  it('does not write the base values as reflected attributes', async () => {
    const element = await stack();
    element.padding = 4;
    element.width = 100;
    await element.updateComplete;
    expect(element.hasAttribute('padding')).toBe(false);
    expect(element.hasAttribute('width')).toBe(false);
  });
});

function paddingOf(element: Element): number {
  return parseFloat(getComputedStyle(baseOf(element)).paddingInlineStart);
}

describe('tct-stack-item (StackItem.test.tsx)', () => {
  const row = async (itemAttributes: string, direction = 'horizontal') => {
    const root = await fixture<HTMLElement>(
      `<div style="inline-size: 400px; block-size: 200px; display: flex; flex-direction: column">
        <tct-stack direction="${direction}" height="100%" ${direction === 'horizontal' ? '' : 'style="min-block-size: 0"'}>
          <tct-stack-item id="a" ${itemAttributes}>a</tct-stack-item>
          <tct-stack-item id="b">b</tct-stack-item>
        </tct-stack>
      </div>`,
    );
    return {
      a: root.querySelector<TctStackItem>('#a')!,
      b: root.querySelector<TctStackItem>('#b')!,
      stack: root.querySelector<TctStack>('tct-stack')!,
    };
  };

  it('renders children correctly', async () => {
    const {a} = await row('');
    expect(a.textContent).toBe('a');
    expect(a.shadowRoot!.querySelector('slot')!.assignedNodes().length).toBe(1);
  });

  it('renders as div by default, and with polymorphic as', async () => {
    const {a} = await row('');
    expect(baseOf(a).localName).toBe('div');
    a.as = 'li';
    await a.updateComplete;
    expect(baseOf(a).localName).toBe('li');
  });

  it('defaults to static size and reflects it', async () => {
    const {a} = await row('');
    expect(a.size).toBe('static');
    expect(a.getAttribute('size')).toBe('static');
    expect(getComputedStyle(a).flexGrow).toBe('0');
    expect(getComputedStyle(a).flexShrink).toBe('0');
  });

  it('size="fill" grows to fill the remaining space', async () => {
    const {a, b, stack: container} = await row('size="fill"');
    expect(getComputedStyle(a).flexGrow).toBe('1');
    const total = container.getBoundingClientRect().width;
    expect(a.getBoundingClientRect().width + b.getBoundingClientRect().width).toBeCloseTo(total, 0);
    expect(b.getBoundingClientRect().width).toBeLessThan(total / 2);
  });

  it('items that fill share the space evenly', async () => {
    const root = await fixture<HTMLElement>(
      `<div style="inline-size: 400px"><tct-stack direction="horizontal" gap="0">
        <tct-stack-item size="fill" id="a">a</tct-stack-item><tct-stack-item size="fill" id="b">b</tct-stack-item>
      </tct-stack></div>`,
    );
    expect(root.querySelector('#a')!.getBoundingClientRect().width).toBeCloseTo(200, 0);
    expect(root.querySelector('#b')!.getBoundingClientRect().width).toBeCloseTo(200, 0);
  });

  it.each([
    ['start', 'flex-start'],
    ['center', 'center'],
    ['end', 'flex-end'],
    ['stretch', 'stretch'],
  ])('cross-align-self="%s" is align-self: %s', async (value, expected) => {
    const {a} = await row(`cross-align-self="${value}"`);
    expect(getComputedStyle(a).alignSelf).toBe(expected);
  });

  it('cross-align-self overrides the stack cross alignment for that item only', async () => {
    const root = await fixture<HTMLElement>(
      `<div style="inline-size: 400px"><tct-stack direction="horizontal" v-align="start" style="min-block-size: 100px">
        <tct-stack-item id="a" cross-align-self="end">a</tct-stack-item><tct-stack-item id="b">b</tct-stack-item>
      </tct-stack></div>`,
    );
    const a = root.querySelector('#a')!.getBoundingClientRect();
    const b = root.querySelector('#b')!.getBoundingClientRect();
    expect(a.top).toBeGreaterThan(b.top);
  });

  it('is a complete scroll region with size="fill" scrollable', async () => {
    const root = await fixture<HTMLElement>(
      `<div style="block-size: 200px; inline-size: 300px; display: flex">
        <tct-stack height="100%" style="flex: 1">
          <tct-stack-item>header</tct-stack-item>
          <tct-stack-item id="scroller" size="fill" scrollable><div style="block-size: 800px">long</div></tct-stack-item>
        </tct-stack>
      </div>`,
    );
    const item = root.querySelector<TctStackItem>('#scroller')!;
    const box = baseOf(item);
    expect(getComputedStyle(box).overflowY).toBe('auto');
    expect(box.scrollHeight).toBeGreaterThan(box.clientHeight);
    expect(item.getBoundingClientRect().height).toBeLessThan(200);
  });

  it('applies an overflow class only when scrollable is set', async () => {
    const {a} = await row('');
    expect(getComputedStyle(baseOf(a)).overflowY).toBe('visible');
    a.scrollable = true;
    await a.updateComplete;
    expect(getComputedStyle(baseOf(a)).overflowY).toBe('auto');
  });

  it('keeps the flex min-size reset so long content shrinks instead of overflowing', async () => {
    const root = await fixture<HTMLElement>(
      `<div style="inline-size: 200px"><tct-stack direction="horizontal">
        <tct-stack-item size="fill"><div style="inline-size: 900px">wide</div></tct-stack-item>
      </tct-stack></div>`,
    );
    const item = root.querySelector('tct-stack-item')!;
    expect(item.getBoundingClientRect().width).toBeLessThanOrEqual(200);
  });
});

describe('tct-stack: accessibility', () => {
  it('a plain stack adds no semantics: the children keep theirs', async () => {
    const element = await stack('', '<p>Hello</p><button type="button">Go</button>');
    await expectAccessible(element);
    if (isChromium) {
      expect(await axNode(element.querySelector('button')!)).toMatchObject({
        role: 'button',
        name: 'Go',
      });
    }
  });

  it('as="nav" is a navigation landmark named by aria-label on the host', async () => {
    const element = await stack(
      'as="nav" aria-label="Main"',
      '<a href="#a">A</a><a href="#b">B</a>',
    );
    await expectAccessible(element);
    if (isChromium) {
      expect(await axNode(baseOf(element))).toMatchObject({role: 'navigation', name: 'Main'});
    }
  });

  it('as="ul" around native li children is a real, named list', async () => {
    const element = await stack('as="ul" aria-label="Steps" gap="2"', '<li>One</li><li>Two</li>');
    await expectAccessible(element);
    expect(baseOf(element).getAttribute('role')).toBe('list');
    if (isChromium) {
      expect(await axNode(baseOf(element))).toMatchObject({role: 'list', name: 'Steps'});
      expect(await axNode(element.querySelector('li')!)).toMatchObject({role: 'listitem'});
    }
  });

  it.skipIf(!isChromium)(
    'tct-stack-item as="li" is a listitem in the accessibility tree',
    async () => {
      // axe's `list` rule wants native <li> children, so this composition is checked in the browser's
      // own tree only; the docs recommend native <li> children of a `ul` stack.
      const root = await fixture<HTMLElement>(
        `<tct-stack as="ul" aria-label="Steps" gap="2">
        <tct-stack-item as="li">One</tct-stack-item>
        <tct-stack-item as="li">Two</tct-stack-item>
      </tct-stack>`,
      );
      expect(await axNode(baseOf(root))).toMatchObject({role: 'list', name: 'Steps'});
      const items = [...root.querySelectorAll('tct-stack-item')];
      expect(await axNode(baseOf(items[0]!))).toMatchObject({role: 'listitem'});
    },
  );

  it('passes axe in every layout state', async () => {
    for (const attributes of [
      'direction="horizontal" gap="3" wrap="wrap"',
      'padding="4" h-align="center" v-align="between" min-height="120"',
      'scrollable height="60"',
      'as="section" aria-label="Region" gap="1"',
    ]) {
      await expectAccessible(await stack(attributes, '<p>one</p><p>two</p><p>three</p>'));
    }
  });
});

describe('tct-stack: right-to-left and forced colours', () => {
  it('padding-inline-start and the flow follow the direction', async () => {
    const root = await fixture<HTMLElement>(
      `<div style="inline-size: 400px"><tct-stack direction="horizontal" padding-inline-start="8" width="300">
        <span id="a">a</span><span id="b">b</span></tct-stack></div>`,
      {dir: 'rtl'},
    );
    const element = root.querySelector<TctStack>('tct-stack')!;
    const box = baseOf(element);
    expect(getComputedStyle(box).paddingRight).toBe('32px');
    expect(getComputedStyle(box).paddingLeft).toBe('0px');
    const a = root.querySelector('#a')!.getBoundingClientRect();
    const b = root.querySelector('#b')!.getBoundingClientRect();
    expect(a.left).toBeGreaterThan(b.left);
  });

  it('start alignment means the right edge in RTL', async () => {
    const root = await fixture<HTMLElement>(
      `<div style="inline-size: 400px"><tct-stack direction="horizontal" h-align="start" width="300"><span id="a">a</span></tct-stack></div>`,
      {dir: 'rtl'},
    );
    const element = root.querySelector('tct-stack')!.getBoundingClientRect();
    const a = root.querySelector('#a')!.getBoundingClientRect();
    expect(a.right).toBeCloseTo(element.right, 0);
  });

  it.skipIf(!isChromium)('renders the same layout in forced-colors mode', async () => {
    await emulateMedia({forcedColors: 'active'});
    const element = await stack('direction="horizontal" gap="2"');
    expect(css(element).display).toBe('flex');
    expect(css(element).flexDirection).toBe('row');
    expect(css(element).columnGap).toBe('8px');
    await expectAccessible(element);
  });
});

describe('tct-stack: keyboard access to a scrolling box', () => {
  // flex: none, or the column would shrink the child to fit the fixed height instead of overflowing
  const tall = '<div style="block-size: 600px; flex: none">tall</div>';

  it('makes an overflowing scroll region focusable, and scrolls it from the keyboard', async () => {
    const element = await stack('scrollable height="100"', tall);
    await waitUntil(() => baseOf(element).getAttribute('tabindex') === '0', 'tabindex applied');
    baseOf(element).focus();
    expect(element.shadowRoot!.activeElement).toBe(baseOf(element));
    await pressKeys('ArrowDown', 'ArrowDown', 'ArrowDown');
    expect(baseOf(element).scrollTop).toBeGreaterThan(0);
  });

  it('gives no tab stop when the content fits, or the box does not scroll', async () => {
    const fits = await stack('scrollable height="200"', '<span>short</span>');
    expect(baseOf(fits).hasAttribute('tabindex')).toBe(false);
    const visible = await stack('height="100"', tall);
    expect(baseOf(visible).hasAttribute('tabindex')).toBe(false);
  });

  it('leaves the tab stop to focusable content inside it', async () => {
    const element = await stack('scrollable height="100"', `${tall}<a href="#end">end</a>`);
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(baseOf(element).hasAttribute('tabindex')).toBe(false);
  });

  it('follows the content: the stop appears when it grows and goes when it shrinks', async () => {
    const element = await stack(
      'scrollable height="100"',
      '<div id="c" style="block-size: 20px; flex: none">x</div>',
    );
    expect(baseOf(element).hasAttribute('tabindex')).toBe(false);
    const content = element.querySelector<HTMLElement>('#c')!;
    content.style.blockSize = '600px';
    await waitUntil(() => baseOf(element).getAttribute('tabindex') === '0', 'grown');
    content.style.blockSize = '20px';
    await waitUntil(() => !baseOf(element).hasAttribute('tabindex'), 'shrunk');
  });

  it('follows slotted children being added and removed', async () => {
    const element = await stack('scrollable height="100"', '<span>one</span>');
    const extra = document.createElement('div');
    extra.style.blockSize = '600px';
    extra.style.flex = 'none';
    element.append(extra);
    await waitUntil(() => baseOf(element).getAttribute('tabindex') === '0', 'child added');
    extra.remove();
    await waitUntil(() => !baseOf(element).hasAttribute('tabindex'), 'child removed');
  });

  it('makes tct-stack-item scrollable regions reachable too', async () => {
    const root = await fixture<HTMLElement>(
      `<div style="block-size: 120px; display: flex"><tct-stack height="120"><tct-stack-item id="i" size="fill" scrollable>${tall}</tct-stack-item></tct-stack></div>`,
    );
    const item = root.querySelector<TctStackItem>('#i')!;
    await waitUntil(() => baseOf(item).getAttribute('tabindex') === '0', 'item tab stop');
  });

  it('draws the shared focus ring on the focused box', async () => {
    const element = await stack('scrollable height="100"', tall);
    await waitUntil(() => baseOf(element).getAttribute('tabindex') === '0', 'tabindex applied');
    await pressKeys('Tab');
    expect(element.shadowRoot!.activeElement).toBe(baseOf(element));
    expect(css(element).outlineStyle).toBe('solid');
    expect(css(element).outlineWidth).toBe('2px');
  });

  it('passes axe for a scrolling region with only static text', async () => {
    const element = await stack('scrollable height="100" width="200"', tall);
    await waitUntil(() => baseOf(element).getAttribute('tabindex') === '0', 'tabindex applied');
    await expectAccessible(element.parentElement!);
  });

  it('drops the tab stop when the element is disconnected', async () => {
    const element = await stack('scrollable height="100"', tall);
    await waitUntil(() => baseOf(element).getAttribute('tabindex') === '0', 'tabindex applied');
    const parent = element.parentElement!;
    element.remove();
    expect(baseOf(element).hasAttribute('tabindex')).toBe(false);
    parent.append(element);
    await waitUntil(() => baseOf(element).getAttribute('tabindex') === '0', 're-applied');
  });
});
