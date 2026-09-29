import {html} from 'lit';
import {beforeAll, describe, expect, it} from 'vitest';
import {axNode, expectAccessible} from '@tecton-wc/testing/a11y.js';
import {fixture} from '@tecton-wc/testing/fixture.js';
import {runElementSuite} from '@tecton-wc/testing/suites/element.js';
import {aTimeout, nextFrame} from '@tecton-wc/testing/timing.js';
import './define.js';
import {
  PEOPLE,
  PERSON_COLUMNS,
  bodyText,
  headerText,
  useLayeredPreflight,
  type Person,
} from './table-test-helpers.js';
import {type TctTable} from './tct-table.js';
import {pixel, proportional} from './table.utils.js';
import type {TableColumn} from './table.types.js';

beforeAll(useLayeredPreflight);

const make = async (
  properties: Record<string, unknown> = {},
  attributes = '',
): Promise<TctTable<Person>> => {
  const table = await fixture<TctTable<Person>>(`<tct-table ${attributes}></tct-table>`);
  Object.assign(table, {data: PEOPLE, columns: PERSON_COLUMNS, ...properties});
  await table.updateComplete;
  return table;
};

runElementSuite({
  tag: 'tct-table',
  shadow: false,
  render: () => `<tct-table></tct-table>`,
  properties: {
    density: 'compact',
    dividers: 'grid',
    striped: true,
    hasHover: true,
    textOverflow: 'truncate',
  },
  attributes: {
    density: 'density',
    dividers: 'dividers',
    striped: 'striped',
    hasHover: 'has-hover',
    textOverflow: 'text-overflow',
  },
});

describe('tct-table: static data-driven table (Table.test.tsx)', () => {
  it('renders a native table: table, header row, body rows and cells', async () => {
    const table = await make();
    const native = table.querySelector('table')!;
    expect(native).toBeInstanceOf(HTMLTableElement);
    expect(headerText(table)).toEqual(['Name', 'Role', 'Age']);
    expect(bodyText(table)).toEqual(PEOPLE.map((p) => [p.name, p.role, String(p.age)]));
    expect(native.tHead!.rows).toHaveLength(1);
    expect(native.tBodies).toHaveLength(1);
    expect(native.querySelector('tfoot')).toBeNull();
  });

  it('exposes native table semantics and never a grid role', async () => {
    const table = await make();
    expect(table.querySelector('[role="grid"], [role="treegrid"]')).toBeNull();
    expect(table.hasAttribute('role')).toBe(false);
    expect((await axNode(table.querySelector('table')!)).role).toBe('table');
    expect((await axNode(table.querySelector('thead th')!)).role).toBe('columnheader');
    expect((await axNode(table.querySelector('tbody td')!)).role).toBe('cell');
    expect((await axNode(table.querySelector('tbody tr')!)).role).toBe('row');
  });

  it('gives every header cell scope="col" and its column key', async () => {
    const table = await make();
    const headers = [...table.querySelectorAll('thead th')];
    expect(headers.map((th) => th.getAttribute('scope'))).toEqual(['col', 'col', 'col']);
    expect(headers.map((th) => th.getAttribute('data-column-key'))).toEqual([
      'name',
      'role',
      'age',
    ]);
  });

  it('wraps the table in a named scroll region', async () => {
    const table = await make();
    const region = table.querySelector('.tct-table-scroll')!;
    expect(region.getAttribute('role')).toBe('group');
    expect(region.getAttribute('aria-label')).toBe('Table');
    expect(region.contains(table.querySelector('table'))).toBe(true);
    table.label = 'People';
    await table.updateComplete;
    expect(region.getAttribute('aria-label')).toBe('People');
  });

  it('generates columns from the data keys when none are given', async () => {
    const table = await make({columns: undefined, data: [{name: 'Alice', city: 'Oslo'}]});
    expect(headerText(table)).toEqual(['Name', 'City']);
    expect(bodyText(table)).toEqual([['Alice', 'Oslo']]);
  });

  it('renders custom cells (text is never HTML) and null values as empty', async () => {
    const columns: TableColumn<Person>[] = [
      {key: 'name', header: 'Name', renderCell: (p) => html`<strong>${p.name}</strong>`},
      {key: 'role', header: 'Role', renderCell: () => '<b>not bold</b>'},
      {key: 'missing', header: 'Missing'},
    ];
    const table = await make({columns});
    const first = table.querySelector<HTMLTableRowElement>('tbody tr')!;
    expect(first.querySelector('strong')!.textContent).toBe('Alice Chen');
    expect(first.cells[1]!.querySelector('b')).toBeNull();
    expect(first.cells[1]!.textContent).toBe('<b>not bold</b>');
    expect(first.cells[2]!.textContent).toBe('');
  });

  it('applies the declared column widths: pixel, proportional and a table minimum width', async () => {
    const columns: TableColumn<Person>[] = [
      {key: 'name', header: 'Name', width: proportional(2, {minWidth: 150})},
      {key: 'role', header: 'Role', width: proportional(1, {minWidth: 100})},
      {key: 'age', header: 'Age', width: pixel(80)},
    ];
    const table = await make({columns});
    const [name, role, age] = [...table.querySelectorAll<HTMLElement>('thead th')];
    expect(age!.style.width).toBe('80px');
    expect(age!.style.minWidth).toBe('80px');
    expect(name!.style.minWidth).toBe('150px');
    expect(role!.style.minWidth).toBe('100px');
    expect(table.querySelector('table')!.style.minWidth).toBe('380px');
  });

  it('aligns columns logically: start, center and end', async () => {
    const columns: TableColumn<Person>[] = [
      {key: 'name', header: 'Name'},
      {key: 'role', header: 'Role', align: 'center'},
      {key: 'age', header: 'Age', align: 'end'},
    ];
    const table = await make({columns});
    const cells = [...table.querySelector('tbody tr')!.querySelectorAll('td')];
    expect(cells.map((cell) => getComputedStyle(cell).textAlign)).toEqual([
      'start',
      'center',
      'end',
    ]);
    expect(getComputedStyle(table.querySelectorAll('thead th')[2]!).textAlign).toBe('end');
  });

  it('keys rows by idKey so a row keeps its element when the data reorders', async () => {
    const table = await make({idKey: 'id'});
    const [a, b] = [...table.querySelectorAll('tbody tr')];
    table.data = [...PEOPLE].reverse();
    await table.updateComplete;
    const rows = [...table.querySelectorAll('tbody tr')];
    expect(rows[3]).toBe(a);
    expect(rows[2]).toBe(b);
    expect(bodyText(table)[0]![0]).toBe('Dmitri Volkov');
  });

  it('accepts idKey as a function and as the id-key attribute', async () => {
    const byFunction = await make({idKey: (p: Person) => p.id});
    expect(bodyText(byFunction)).toHaveLength(4);
    const byAttribute = await make({}, 'id-key="id"');
    expect(byAttribute.idKey).toBe('id');
    const [first] = [...byAttribute.querySelectorAll('tbody tr')];
    byAttribute.data = [...PEOPLE].reverse();
    await byAttribute.updateComplete;
    expect([...byAttribute.querySelectorAll('tbody tr')].at(-1)).toBe(first);
  });

  it('does not rebuild rows whose item did not change', async () => {
    let calls = 0;
    const columns: TableColumn<Person>[] = [
      {key: 'name', header: 'Name', renderCell: (p) => ((calls += 1), p.name)},
    ];
    const table = await make({columns, idKey: 'id'});
    expect(calls).toBe(4);
    table.data = [...PEOPLE.slice(0, 3), {...PEOPLE[3]!, name: 'Dmitri V.'}];
    await table.updateComplete;
    expect(calls).toBe(5);
    expect(bodyText(table)[3]![0]).toBe('Dmitri V.');
  });

  describe('appearance attributes', () => {
    it('reflects density, dividers, striped and has-hover and falls back for invalid values', async () => {
      const table = await make({
        density: 'spacious',
        dividers: 'grid',
        striped: true,
        hasHover: true,
      });
      expect(table.getAttribute('density')).toBe('spacious');
      expect(table.getAttribute('dividers')).toBe('grid');
      expect(table.hasAttribute('striped')).toBe(true);
      expect(table.hasAttribute('has-hover')).toBe(true);
      table.density = 'huge' as never;
      table.dividers = 'diagonal' as never;
      await table.updateComplete;
      expect(table.density).toBe('balanced');
      expect(table.dividers).toBe('rows');
    });

    it('pads cells by density: compact < balanced < spacious', async () => {
      const table = await make();
      const padding = async (density: 'compact' | 'balanced' | 'spacious'): Promise<number> => {
        table.density = density;
        await table.updateComplete;
        return parseFloat(
          getComputedStyle(table.querySelector('tbody td:nth-child(2)')!).paddingBlockStart,
        );
      };
      const [compact, balanced, spacious] = [
        await padding('compact'),
        await padding('balanced'),
        await padding('spacious'),
      ];
      expect(compact).toBeGreaterThan(0);
      expect(compact).toBeLessThan(balanced);
      expect(balanced).toBeLessThan(spacious);
    });

    it('draws row dividers between body rows but not after the last, and column dividers with grid', async () => {
      const table = await make({dividers: 'rows'});
      const width = (row: number, cell = 0): string =>
        getComputedStyle(table.querySelectorAll('tbody tr')[row]!.querySelectorAll('td')[cell]!)
          .borderBlockEndWidth;
      expect(width(0)).toBe('1px');
      expect(width(3)).toBe('0px');
      const endBorder = (): string =>
        getComputedStyle(table.querySelectorAll('tbody tr')[0]!.querySelectorAll('td')[0]!)
          .borderInlineEndWidth;
      expect(endBorder()).toBe('0px');
      table.dividers = 'grid';
      await table.updateComplete;
      expect(endBorder()).toBe('1px');
      table.dividers = 'none';
      await table.updateComplete;
      expect(width(0)).toBe('0px');
      expect(endBorder()).toBe('0px');
    });

    it('stripes the even body rows only when striped', async () => {
      const table = await make();
      const fill = (row: number): string =>
        getComputedStyle(table.querySelectorAll('tbody tr')[row]!).backgroundColor;
      const plain = fill(1);
      table.striped = true;
      await table.updateComplete;
      expect(fill(1)).not.toBe(plain);
      expect(fill(0)).toBe(plain);
    });

    it('aligns body cells vertically', async () => {
      const table = await make({verticalAlign: 'top'});
      expect(getComputedStyle(table.querySelector('tbody td')!).verticalAlign).toBe('top');
      table.verticalAlign = 'bottom';
      await table.updateComplete;
      expect(getComputedStyle(table.querySelector('tbody td')!).verticalAlign).toBe('bottom');
    });

    it('wraps text by default and truncates (with tct-text) in truncate mode', async () => {
      const table = await make();
      expect(table.querySelector('tbody td tct-text')).toBeNull();
      expect(getComputedStyle(table.querySelector('tbody td')!).whiteSpace).not.toBe('nowrap');
      table.textOverflow = 'truncate';
      await table.updateComplete;
      const text = table.querySelector('tbody td tct-text')!;
      expect(text.getAttribute('max-lines')).toBe('1');
      expect(text.textContent).toBe('Alice Chen');
      expect(getComputedStyle(table.querySelector('tbody td')!).whiteSpace).toBe('nowrap');
    });
  });

  describe('empty state', () => {
    it('shows the compact default empty state for an empty data array', async () => {
      const table = await make({data: []});
      const row = table.querySelector('tbody tr')!;
      expect(row.querySelector('td')!.colSpan).toBe(3);
      const empty = row.querySelector('tct-empty-state')!;
      expect(empty.getAttribute('heading')).toBe('No data');
      expect(empty.hasAttribute('compact')).toBe(true);
      expect(table.querySelectorAll('thead th')).toHaveLength(3);
    });

    it('takes a custom empty state, a custom label, or none', async () => {
      const table = await make({data: [], emptyLabel: 'No results'});
      expect(table.querySelector('tct-empty-state')!.getAttribute('heading')).toBe('No results');
      table.emptyState = html`<p id="custom">Try another filter.</p>`;
      await table.updateComplete;
      expect(table.querySelector('#custom')!.textContent).toBe('Try another filter.');
      expect(table.querySelector('tct-empty-state')).toBeNull();
      table.emptyState = false;
      await table.updateComplete;
      expect(table.querySelectorAll('tbody tr')).toHaveLength(0);
      table.emptyState = undefined;
      table.noEmptyState = true;
      await table.updateComplete;
      expect(table.querySelectorAll('tbody tr')).toHaveLength(0);
    });

    it('shows no empty state before any data is given', async () => {
      const table = await make({data: undefined, columns: PERSON_COLUMNS});
      expect(table.querySelectorAll('tbody tr')).toHaveLength(0);
      expect(table.querySelector('tct-empty-state')).toBeNull();
    });

    it('passes axe with an empty state', async () => {
      const table = await make({data: []});
      await expectAccessible(table);
    });
  });

  describe('aria-rowindex and aria-rowcount', () => {
    it('emits neither by default (native table semantics)', async () => {
      const table = await make();
      expect(table.querySelector('table')!.hasAttribute('aria-rowcount')).toBe(false);
      expect(table.querySelector('tbody tr')!.hasAttribute('aria-rowindex')).toBe(false);
    });

    it('numbers the rows from row-index-start and reports the full row count', async () => {
      const table = await make({rowIndexStart: 11, rowCount: 40});
      expect(table.querySelector('table')!.getAttribute('aria-rowcount')).toBe('40');
      expect(
        [...table.querySelectorAll('tbody tr')].map((row) => row.getAttribute('aria-rowindex')),
      ).toEqual(['11', '12', '13', '14']);
    });

    it('reports -1 (unknown) when only row-index-start is set', async () => {
      const table = await make({rowIndexStart: 1});
      expect(table.querySelector('table')!.getAttribute('aria-rowcount')).toBe('-1');
    });
  });

  it('passes axe for the default render and for every appearance', async () => {
    const table = await make();
    await expectAccessible(table);
    for (const density of ['compact', 'spacious'] as const) {
      table.density = density;
      table.striped = true;
      table.hasHover = true;
      table.dividers = 'grid';
      await table.updateComplete;
      await expectAccessible(table);
    }
  });
});

describe('tct-table: scroll region', () => {
  it('is keyboard reachable only while the columns overflow', async () => {
    const wide: TableColumn<Person>[] = PERSON_COLUMNS.map((column) => ({
      ...column,
      width: pixel(600),
    }));
    const root = await fixture<HTMLElement>(
      `<div style="inline-size: 320px"><tct-table></tct-table></div>`,
    );
    const table = root.querySelector<TctTable<Person>>('tct-table')!;
    Object.assign(table, {data: PEOPLE, columns: wide});
    await table.updateComplete;
    await aTimeout(50);
    await table.updateComplete;
    const region = table.querySelector<HTMLElement>('.tct-table-scroll')!;
    expect(table.scrollable).toBe(true);
    expect(region.getAttribute('tabindex')).toBe('0');
    expect(getComputedStyle(region).overscrollBehaviorX).toBe('contain');
    expect(table.matches(':state(scrollable)')).toBe(true);
    await expectAccessible(table);

    table.columns = PERSON_COLUMNS.map((column) => ({...column, width: pixel(40)}));
    await table.updateComplete;
    await aTimeout(50);
    await table.updateComplete;
    expect(table.scrollable).toBe(false);
    expect(region.hasAttribute('tabindex')).toBe(false);
    expect(getComputedStyle(region).overscrollBehaviorX).toBe('auto');
  });
});

describe('tct-table: children mode', () => {
  it('styles an authored native table and names the host region', async () => {
    const table = await fixture<TctTable>(
      html`<tct-table density="compact" dividers="grid" striped>
        <table>
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Role</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Alice</td>
              <td>Engineer</td>
            </tr>
            <tr>
              <td>Bob</td>
              <td>Designer</td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td>Total</td>
              <td>2</td>
            </tr>
          </tfoot>
        </table>
      </tct-table>`,
    );
    expect(table.hasAttribute('data-children')).toBe(true);
    expect((await axNode(table)).role).toBe('group');
    expect((await axNode(table)).name).toBe('Table');
    expect((await axNode(table.querySelector('table')!)).role).toBe('table');
    const header = table.querySelector('th')!;
    expect(getComputedStyle(header).fontWeight).toBe('500');
    const foot = table.querySelector('tfoot td')!;
    expect(getComputedStyle(foot).backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
    const padding = parseFloat(
      getComputedStyle(table.querySelector('tbody td')!).paddingBlockStart,
    );
    expect(padding).toBeGreaterThan(0);
    await expectAccessible(table);
  });

  it('lays out tct-table-* elements as table parts with ARIA table semantics', async () => {
    const table = await fixture<TctTable>(
      html`<tct-table label="Team">
        <tct-table-header>
          <tct-table-row header-row>
            <tct-table-header-cell>Name</tct-table-header-cell>
            <tct-table-header-cell>Role</tct-table-header-cell>
          </tct-table-row>
        </tct-table-header>
        <tct-table-body>
          <tct-table-row>
            <tct-table-header-cell scope="row">Alice</tct-table-header-cell>
            <tct-table-cell>Engineer</tct-table-cell>
          </tct-table-row>
          <tct-table-row>
            <tct-table-cell>Bob</tct-table-cell>
            <tct-table-cell col-span="1">Designer</tct-table-cell>
          </tct-table-row>
        </tct-table-body>
        <tct-table-footer>
          <tct-table-row
            ><tct-table-cell>Total</tct-table-cell><tct-table-cell>2</tct-table-cell></tct-table-row
          >
        </tct-table-footer>
      </tct-table>`,
    );
    await nextFrame();
    expect(getComputedStyle(table).display).toBe('table');
    expect(getComputedStyle(table.querySelector('tct-table-header')!).display).toBe(
      'table-header-group',
    );
    expect(getComputedStyle(table.querySelector('tct-table-body')!).display).toBe(
      'table-row-group',
    );
    expect(getComputedStyle(table.querySelector('tct-table-footer')!).display).toBe(
      'table-footer-group',
    );
    expect(getComputedStyle(table.querySelector('tct-table-row')!).display).toBe('table-row');
    expect(getComputedStyle(table.querySelector('tct-table-cell')!).display).toBe('table-cell');
    expect((await axNode(table)).role).toBe('table');
    expect((await axNode(table)).name).toBe('Team');
    expect((await axNode(table.querySelector('tct-table-header')!)).role).toBe('rowgroup');
    expect((await axNode(table.querySelector('tct-table-row')!)).role).toBe('row');
    expect((await axNode(table.querySelector('tct-table-header-cell')!)).role).toBe('columnheader');
    expect((await axNode(table.querySelector('tct-table-header-cell[scope="row"]')!)).role).toBe(
      'rowheader',
    );
    expect((await axNode(table.querySelector('tct-table-cell')!)).role).toBe('cell');
    const headerCell = table.querySelector('tct-table-header-cell')!;
    expect(getComputedStyle(headerCell).fontWeight).toBe('500');
    await expectAccessible(table);
  });

  it('renders nothing until data or columns are given', async () => {
    const table = await fixture<TctTable>(html`<tct-table></tct-table>`);
    expect(table.hasAttribute('data-children')).toBe(false);
    expect(table.querySelector('table')).toBeNull();
  });
});
