/**
 * tct-grid and tct-grid-span: fixed and responsive columns, gaps, alignment, spans (ported from
 * upstream Grid.test.tsx), RTL, forced colours.
 */
import {html} from 'lit';
import {describe, expect, it} from 'vitest';
import {expectAccessible} from '@tecton-astryx/testing/a11y.js';
import {emulateMedia} from '@tecton-astryx/testing/emulate.js';
import {fixture} from '@tecton-astryx/testing/fixture.js';
import {runElementSuite} from '@tecton-astryx/testing/suites/element.js';
import {isChromium} from '@tecton-astryx/testing/tier.js';
import {buildGridTemplateColumns} from './grid.types.js';
import './define.js';
import type {TctGrid} from './tct-grid.js';
import type {TctGridSpan} from './tct-grid-span.js';

const baseOf = (element: Element): HTMLElement =>
  element.shadowRoot!.querySelector<HTMLElement>('[part~="base"]')!;
const css = (element: Element) => getComputedStyle(baseOf(element));
/** The resolved track sizes of the grid, in px. */
const tracks = (element: Element): number[] =>
  css(element)
    .gridTemplateColumns.split(' ')
    .filter((track) => track !== 'none')
    .map(parseFloat);

const items = (count: number, style = '') =>
  Array.from({length: count}, (_, i) => `<div style="${style}">Item ${i + 1}</div>`).join('');

/** Mounts a grid in a container of `width` px. */
async function grid(attributes = '', content = items(4), width = 400) {
  const root = await fixture<HTMLElement>(
    `<div style="inline-size: ${width}px"><tct-grid ${attributes}>${content}</tct-grid></div>`,
  );
  return root.querySelector<TctGrid>('tct-grid')!;
}

runElementSuite({
  tag: 'tct-grid',
  render: () =>
    html`<tct-grid columns="2" gap="2"
      ><div>a</div>
      <div>b</div></tct-grid
    >`,
  properties: {
    columns: 3,
    columnMinWidth: 120,
    gap: 4,
    rowGap: 2,
    columnGap: 1,
    rowHeight: 60,
    alignment: 'center',
    justify: 'end',
  },
  attributes: {columns: 'columns', gap: 'gap', alignment: 'alignment', justify: 'justify'},
});

runElementSuite({
  tag: 'tct-grid-span',
  render: () => html`<tct-grid-span columns="2"><div>a</div></tct-grid-span>`,
  properties: {columns: 3, rows: 2},
  attributes: {columns: 'columns', rows: 'rows'},
});

describe('buildGridTemplateColumns (Grid.test.tsx track templates)', () => {
  it('renders fixed columns as repeat(n, 1fr)', () => {
    expect(buildGridTemplateColumns(3)).toBe('repeat(3, 1fr)');
  });

  it('defaults to one column when nothing is specified, or for zero and negative counts', () => {
    expect(buildGridTemplateColumns(undefined)).toBe('1fr');
    expect(buildGridTemplateColumns(0)).toBe('1fr');
    expect(buildGridTemplateColumns(-2)).toBe('1fr');
  });

  it('renders columns {minWidth} with auto-fill by default', () => {
    expect(buildGridTemplateColumns({minWidth: 250})).toBe('repeat(auto-fill, minmax(250px, 1fr))');
  });

  it('honours repeat "fit" and "fill"', () => {
    expect(buildGridTemplateColumns({minWidth: 200, repeat: 'fit'})).toBe(
      'repeat(auto-fit, minmax(200px, 1fr))',
    );
    expect(buildGridTemplateColumns({minWidth: 200, repeat: 'fill'})).toBe(
      'repeat(auto-fill, minmax(200px, 1fr))',
    );
  });

  it('caps the count on the track minimum and keeps the track maximum at 1fr', () => {
    expect(buildGridTemplateColumns({minWidth: 250, max: 3}, 4)).toBe(
      'repeat(auto-fill, minmax(min(100%, max(250px, calc((100% - 2 * var(--spacing-4)) / 3))), 1fr))',
    );
    expect(buildGridTemplateColumns({minWidth: 360, max: 2}, 4)).toBe(
      'repeat(auto-fill, minmax(min(100%, max(360px, calc((100% - 1 * var(--spacing-4)) / 2))), 1fr))',
    );
    expect(buildGridTemplateColumns({minWidth: 200, max: 3, repeat: 'fit'}, undefined, 6)).toBe(
      'repeat(auto-fit, minmax(min(100%, max(200px, calc((100% - 2 * var(--spacing-6)) / 3))), 1fr))',
    );
  });

  it('uses columnGap, then gap, then none, for the per-column floor', () => {
    expect(buildGridTemplateColumns({minWidth: 200, max: 3}, 2, 6)).toBe(
      'repeat(auto-fill, minmax(min(100%, max(200px, calc((100% - 2 * var(--spacing-6)) / 3))), 1fr))',
    );
    expect(buildGridTemplateColumns({minWidth: 150, max: 2}, 3)).toBe(
      'repeat(auto-fill, minmax(min(100%, max(150px, calc((100% - 1 * var(--spacing-3)) / 2))), 1fr))',
    );
    expect(buildGridTemplateColumns({minWidth: 100, max: 3})).toBe(
      'repeat(auto-fill, minmax(min(100%, max(100px, calc(100% / 3))), 1fr))',
    );
  });

  it('spells fractional steps as dashed tokens', () => {
    expect(buildGridTemplateColumns({minWidth: 100, max: 2}, 0.5)).toContain('var(--spacing-0-5)');
  });
});

describe('tct-grid: columns', () => {
  it('renders with fixed columns', async () => {
    const element = await grid('columns="3"');
    const sizes = tracks(element);
    expect(sizes).toHaveLength(3);
    expect(sizes[0]).toBeCloseTo(400 / 3, 1);
  });

  it('defaults to one column, and falls back to one for zero and negative counts', async () => {
    expect(tracks(await grid())).toEqual([400]);
    expect(tracks(await grid('columns="0"'))).toEqual([400]);
    expect(tracks(await grid('columns="-2"'))).toEqual([400]);
    expect(tracks(await grid('columns="many"'))).toEqual([400]);
  });

  it('lets the tracks come from a class-level declaration a consumer rule can win', async () => {
    const element = await grid('columns="3"');
    const sheet = new CSSStyleSheet();
    sheet.replaceSync('tct-grid::part(base) { grid-template-columns: 1fr 3fr; }');
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
    try {
      expect(tracks(element)).toHaveLength(2);
      expect(baseOf(element).style.gridTemplateColumns).toBe('');
    } finally {
      document.adoptedStyleSheets = document.adoptedStyleSheets.filter((s) => s !== sheet);
    }
  });

  it('renders with the columns object, auto-fill by default', async () => {
    const element = await grid('', items(4), 600);
    element.columns = {minWidth: 250};
    await element.updateComplete;
    expect(tracks(element)).toHaveLength(2);
    expect(tracks(element)[0]).toBeCloseTo(300, 0);
  });

  it('renders the responsive form from attributes', async () => {
    const element = await grid('column-min-width="150"', items(4), 620);
    expect(tracks(element)).toHaveLength(4);
    const narrow = await grid('column-min-width="250"', items(4), 400);
    expect(tracks(narrow)).toHaveLength(1);
  });

  it('caps the column count with column-max, and the tracks still fill the row', async () => {
    const element = await grid('column-min-width="100" column-max="3" gap="4"', items(6), 600);
    const sizes = tracks(element);
    expect(sizes).toHaveLength(3);
    expect(sizes.reduce((sum, size) => sum + size, 0) + 2 * 16).toBeCloseTo(600, 0);
  });

  it('keeps a lone column filling the row when fewer than max fit (#3391)', async () => {
    const element = await grid('column-min-width="360" column-max="2" gap="4"', items(2), 400);
    expect(tracks(element)).toEqual([400]);
  });

  it('repeat "fill" keeps empty tracks, "fit" collapses them so items stretch', async () => {
    const fill = await grid('column-min-width="100"', items(2), 600);
    expect(tracks(fill)).toHaveLength(6);
    const fit = await grid('column-min-width="100" column-repeat="fit"', items(2), 600);
    // Collapsed tracks stay in the resolved list at 0px.
    expect(tracks(fit).filter((size) => size > 0)).toHaveLength(2);
    expect(tracks(fit)[0]).toBeCloseTo(300, 0);
  });

  it('the columns object wins over the attributes', async () => {
    const element = await grid('column-min-width="100" columns="2"', items(4), 600);
    expect(tracks(element)).toHaveLength(6);
    element.columns = {minWidth: 300};
    await element.updateComplete;
    expect(tracks(element)).toHaveLength(2);
  });
});

describe('tct-grid: gaps, rows, alignment, sizes', () => {
  it('applies gap to rows and columns', async () => {
    const element = await grid('columns="2" gap="4"');
    expect(css(element).rowGap).toBe('16px');
    expect(css(element).columnGap).toBe('16px');
  });

  it('applies row-gap and column-gap separately, over gap', async () => {
    const element = await grid('columns="2" gap="4" row-gap="2" column-gap="6"');
    expect(css(element).rowGap).toBe('8px');
    expect(css(element).columnGap).toBe('24px');
    const only = await grid('columns="2" row-gap="3"');
    expect(css(only).rowGap).toBe('12px');
    expect(css(only).columnGap).toBe('0px');
  });

  it('ignores a gap that is not a spacing step', async () => {
    expect(css(await grid('columns="2" gap="7"')).rowGap).toBe('0px');
  });

  it('applies row-height as fixed implicit rows', async () => {
    const element = await grid('columns="2" row-height="80"');
    expect(css(element).gridAutoRows).toBe('80px');
    const first = element.querySelector('div')!.getBoundingClientRect();
    expect(first.height).toBe(80);
  });

  it.each(['start', 'center', 'end', 'stretch'])(
    'applies alignment="%s" and justify="%s"',
    async (value) => {
      const element = await grid(`columns="2" alignment="${value}" justify="${value}"`);
      expect(css(element).alignItems).toBe(value);
      expect(css(element).justifyItems).toBe(value);
    },
  );

  it('aligns items inside their cell', async () => {
    const element = await grid(
      'columns="2" row-height="100" alignment="center" justify="end"',
      items(2, 'inline-size: 40px; block-size: 20px'),
    );
    const cell = element.getBoundingClientRect();
    const item = element.querySelector('div')!.getBoundingClientRect();
    expect(Math.round(item.top + item.height / 2 - cell.top)).toBe(50);
    expect(Math.round(item.right - cell.left)).toBe(200);
  });

  it('applies numeric and string sizes', async () => {
    const element = await grid('columns="2" width="300" height="120"');
    expect(element.getBoundingClientRect().width).toBe(300);
    expect(element.getBoundingClientRect().height).toBe(120);
    const strings = await grid('columns="2" width="50%" height="50vh"');
    expect(strings.getBoundingClientRect().width).toBe(200);
    expect(strings.getBoundingClientRect().height).toBeCloseTo(window.innerHeight / 2, 0);
  });

  it('renders the children as grid items, in order', async () => {
    const element = await grid('columns="2"', '<b>a</b><i>b</i><u>c</u>');
    const assigned = element.shadowRoot!.querySelector('slot')!.assignedElements();
    expect(assigned.map((child) => child.localName)).toEqual(['b', 'i', 'u']);
    expect(baseOf(element).contains(element.shadowRoot!.querySelector('slot'))).toBe(true);
  });

  it('carries padding through the box props', async () => {
    const element = await grid('columns="2" padding="2"');
    expect(css(element).paddingInlineStart).toBe('8px');
    expect(tracks(element)[0]).toBeCloseTo((400 - 16) / 2, 0);
  });
});

describe('tct-grid-span (GridSpan tests)', () => {
  const four = async (spanAttributes: string, gridAttributes = 'columns="4" gap="0"') => {
    const root = await fixture<HTMLElement>(
      `<div style="inline-size: 400px"><tct-grid ${gridAttributes} row-height="50">
        <tct-grid-span id="s" ${spanAttributes}><div id="c">span</div></tct-grid-span>
        <div>b</div><div>c</div><div>d</div><div>e</div><div>f</div><div>g</div>
      </tct-grid></div>`,
    );
    return {
      span: root.querySelector<TctGridSpan>('#s')!,
      grid: root.querySelector<TctGrid>('tct-grid')!,
      child: root.querySelector<HTMLElement>('#c')!,
    };
  };

  it('spans the requested number of columns', async () => {
    const {span} = await four('columns="2"');
    expect(span.getBoundingClientRect().width).toBe(200);
    expect(getComputedStyle(span).gridColumnStart).toBe('span 2');
  });

  it('spans the full width with columns="full"', async () => {
    const {span} = await four('columns="full"');
    expect(span.getBoundingClientRect().width).toBe(400);
    expect(getComputedStyle(span).gridColumnStart).toBe('1');
    expect(getComputedStyle(span).gridColumnEnd).toBe('-1');
  });

  it('spans the requested number of rows', async () => {
    const {span} = await four('rows="2"');
    expect(span.getBoundingClientRect().height).toBe(100);
  });

  it('spans columns and rows together', async () => {
    const {span} = await four('columns="2" rows="2"');
    expect(span.getBoundingClientRect().width).toBe(200);
    expect(span.getBoundingClientRect().height).toBe(100);
  });

  it('spans a single cell without span props, and stretches its content to the cell', async () => {
    const {span, child} = await four('');
    expect(span.getBoundingClientRect().width).toBe(100);
    expect(span.getBoundingClientRect().height).toBe(50);
    expect(child.getBoundingClientRect().height).toBe(50);
  });

  it('follows property writes and reflects them', async () => {
    const {span} = await four('');
    span.columns = 3;
    await span.updateComplete;
    expect(span.getAttribute('columns')).toBe('3');
    expect(span.getBoundingClientRect().width).toBe(300);
    span.columns = 'full';
    await span.updateComplete;
    expect(span.getAttribute('columns')).toBe('full');
    span.columns = undefined;
    await span.updateComplete;
    expect(span.hasAttribute('columns')).toBe(false);
    expect(span.getBoundingClientRect().width).toBe(100);
  });

  it('spans beyond the static rules through a per-instance sheet, and drops it again', async () => {
    const {span, grid: host} = await four('columns="14"', 'columns="16" gap="0"');
    expect(getComputedStyle(span).gridColumnStart).toBe('span 14');
    expect(host.getBoundingClientRect().width).toBe(400);
    span.columns = 2;
    span.rows = 13;
    await span.updateComplete;
    expect(getComputedStyle(span).gridColumnStart).toBe('span 2');
    expect(getComputedStyle(span).gridRowStart).toBe('span 13');
    span.rows = undefined;
    await span.updateComplete;
    expect(getComputedStyle(span).gridRowStart).toBe('auto');
  });

  it('ignores a span that is not a positive whole number', async () => {
    const {span} = await four('columns="0" rows="-1"');
    expect(span.columns).toBeUndefined();
    expect(span.rows).toBeUndefined();
    expect(span.getBoundingClientRect().width).toBe(100);
  });

  it('a consumer rule on the span host wins over the span', async () => {
    const {span} = await four('columns="2"');
    span.style.gridColumn = '1 / -1';
    expect(span.getBoundingClientRect().width).toBe(400);
  });

  it('renders children correctly', async () => {
    const {span} = await four('columns="2"');
    expect(span.textContent).toBe('span');
    expect(span.shadowRoot!.querySelector('slot')!.assignedElements()).toHaveLength(1);
  });
});

describe('tct-grid: accessibility, RTL, forced colours', () => {
  it('adds no semantics and passes axe', async () => {
    const element = await grid(
      'columns="2" gap="2" padding="2"',
      '<p>One</p><p>Two</p><button type="button">Go</button>',
    );
    await expectAccessible(element);
  });

  it('places the first item at the inline start, and column-gap is symmetric', async () => {
    const root = await fixture<HTMLElement>(
      `<div style="inline-size: 400px"><tct-grid columns="2" column-gap="2"><div id="a">a</div><div id="b">b</div></tct-grid></div>`,
      {dir: 'rtl'},
    );
    const a = root.querySelector('#a')!.getBoundingClientRect();
    const b = root.querySelector('#b')!.getBoundingClientRect();
    expect(a.left).toBeGreaterThan(b.left);
    const host = root.querySelector('tct-grid')!.getBoundingClientRect();
    expect(Math.round(host.right - a.right)).toBe(0);
  });

  it('a span with columns="2" starts at the right edge in RTL', async () => {
    const root = await fixture<HTMLElement>(
      `<div style="inline-size: 400px"><tct-grid columns="4"><tct-grid-span id="s" columns="2">s</tct-grid-span><div>b</div></tct-grid></div>`,
      {dir: 'rtl'},
    );
    const span = root.querySelector('#s')!.getBoundingClientRect();
    expect(Math.round(root.getBoundingClientRect().right - span.right)).toBe(0);
    expect(span.width).toBe(200);
  });

  it.skipIf(!isChromium)('renders the same layout in forced-colors mode', async () => {
    await emulateMedia({forcedColors: 'active'});
    const element = await grid('columns="3" gap="2"');
    expect(tracks(element)).toHaveLength(3);
    await expectAccessible(element);
  });
});
