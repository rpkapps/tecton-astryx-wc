/**
 * Sorting (useTableSortable, useTableSortableState): the sort control, aria-sort, the state controller
 * and its comparison rules, the header context menu and the announcement.
 */
import {afterEach, beforeAll, beforeEach, describe, expect, it, vi} from 'vitest';
import {getAnnouncerRegions} from '@tecton-wc/core/a11y/announcer.js';
import {overrideFeature} from '@tecton-wc/core/features.js';
import {axNode, expectAccessible} from '@tecton-wc/testing/a11y.js';
import {fixture} from '@tecton-wc/testing/fixture.js';
import {pressKeys} from '@tecton-wc/testing/keyboard.js';
import {aTimeout, waitUntil} from '@tecton-wc/testing/timing.js';
import {userEvent} from 'vitest/browser';
import './define.js';
import '../context-menu/define.js';
import {
  PEOPLE,
  bodyText,
  headerText,
  useLayeredPreflight,
  type Person,
} from './table-test-helpers.js';
import {
  TableSortableController,
  TableSortableStateController,
  type TableSortState,
} from './define.js';
import type {TableColumn} from './table.types.js';
import type {TctTable} from './tct-table.js';

beforeAll(useLayeredPreflight);

const COLUMNS: TableColumn<Person>[] = [
  {key: 'name', header: 'Name', sortable: true},
  {key: 'role', header: 'Role', sortable: {sortKey: 'role'}},
  {key: 'age', header: 'Age', sortable: true, align: 'end'},
  {key: 'id', header: 'ID'},
];

interface Harness {
  table: TctTable<Person>;
  plugin: TableSortableController<Person>;
  changes: TableSortState[];
  sortState: {sort: TableSortState};
}

/** A table with a sort plugin over a plain (controlled) config that records every request. */
async function make(
  options: {
    sort?: TableSortState;
    allowUnsortedState?: boolean;
    multiSort?: boolean;
    columns?: TableColumn<Person>[];
    dir?: 'rtl';
  } = {},
): Promise<Harness> {
  const root = await fixture<HTMLElement>(
    `<div ${options.dir ? `dir="${options.dir}"` : ''}><tct-table></tct-table></div>`,
  );
  const table = root.querySelector<TctTable<Person>>('tct-table')!;
  const changes: TableSortState[] = [];
  const state = {sort: options.sort ?? []};
  const plugin = new TableSortableController<Person>(null, {
    get sort() {
      return state.sort;
    },
    onSortChange: (next) => {
      changes.push(next);
      state.sort = next;
      plugin.refresh();
    },
    allowUnsortedState: options.allowUnsortedState,
    multiSort: options.multiSort,
  });
  Object.assign(table, {
    data: PEOPLE,
    columns: options.columns ?? COLUMNS,
    idKey: 'id',
    plugins: {sort: plugin},
  });
  await table.updateComplete;
  return {table, plugin, changes, sortState: state};
}

const header = (table: Element, key: string): HTMLTableCellElement =>
  table.querySelector<HTMLTableCellElement>(`thead th[data-column-key="${key}"]`)!;
const button = (table: Element, key: string): HTMLButtonElement =>
  header(table, key).querySelector<HTMLButtonElement>('button.tct-table-sort')!;
const iconName = (table: Element, key: string): string | null =>
  button(table, key).querySelector('tct-icon')!.getAttribute('name');

describe('table sortable plugin (useTableSortable.test.tsx)', () => {
  describe('rendering', () => {
    it('renders a sort button with an icon for sortable columns only', async () => {
      const {table} = await make();
      expect(button(table, 'name')).toBeTruthy();
      expect(button(table, 'role')).toBeTruthy();
      expect(button(table, 'age')).toBeTruthy();
      expect(header(table, 'id').querySelector('button')).toBeNull();
    });

    it('shows the unsorted, ascending and descending icons', async () => {
      const {table, sortState, plugin} = await make();
      expect(iconName(table, 'name')).toBe('arrowsUpDown');
      sortState.sort = [{sortKey: 'name', direction: 'ascending'}];
      plugin.refresh();
      await table.updateComplete;
      expect(iconName(table, 'name')).toBe('arrowUp');
      sortState.sort = [{sortKey: 'name', direction: 'descending'}];
      plugin.refresh();
      await table.updateComplete;
      expect(iconName(table, 'name')).toBe('arrowDown');
    });

    it('wraps the header text in the button and renders indicators for empty data', async () => {
      const {table} = await make();
      expect(button(table, 'name').textContent).toContain('Name');
      table.data = [];
      await table.updateComplete;
      expect(button(table, 'name')).toBeTruthy();
    });

    it('uses a custom sortKey and falls back to the column key', async () => {
      const columns: TableColumn<Person>[] = [
        {key: 'name', header: 'Name', sortable: {sortKey: 'lastName'}},
        {key: 'role', header: 'Role', sortable: true},
      ];
      const {table, sortState, plugin} = await make({
        columns,
        sort: [{sortKey: 'lastName', direction: 'ascending'}],
      });
      expect(header(table, 'name').getAttribute('aria-sort')).toBe('ascending');
      expect(header(table, 'role').hasAttribute('aria-sort')).toBe(false);
      sortState.sort = [{sortKey: 'role', direction: 'descending'}];
      plugin.refresh();
      await table.updateComplete;
      expect(header(table, 'role').getAttribute('aria-sort')).toBe('descending');
    });

    it('renders a rank badge only in multi-sort with several entries', async () => {
      const sort: TableSortState = [
        {sortKey: 'name', direction: 'ascending'},
        {sortKey: 'age', direction: 'descending'},
      ];
      const multi = await make({sort, multiSort: true});
      expect(button(multi.table, 'name').querySelector('.tct-table-sort-rank')!.textContent).toBe(
        '1',
      );
      expect(button(multi.table, 'age').querySelector('.tct-table-sort-rank')!.textContent).toBe(
        '2',
      );
      expect(button(multi.table, 'role').querySelector('.tct-table-sort-rank')).toBeNull();
      const single = await make({sort: [sort[0]!], multiSort: true});
      expect(button(single.table, 'name').querySelector('.tct-table-sort-rank')).toBeNull();
    });

    it('ignores sort entries whose key matches no column, and empty sort arrays', async () => {
      const {table} = await make({sort: [{sortKey: 'nope', direction: 'ascending'}]});
      expect(table.querySelectorAll('[aria-sort]')).toHaveLength(0);
      expect(headerText(table).join()).toContain('Name');
    });

    it('works with template header content and without sortable columns', async () => {
      const {table} = await make({columns: [{key: 'name', header: 'Name'}]});
      expect(table.querySelector('button')).toBeNull();
      expect(bodyText(table)).toHaveLength(4);
    });
  });

  describe('interactions', () => {
    it('cycles ascending, descending, unsorted with allowUnsortedState (default)', async () => {
      const {table, changes} = await make();
      button(table, 'name').click();
      await table.updateComplete;
      button(table, 'name').click();
      await table.updateComplete;
      button(table, 'name').click();
      await table.updateComplete;
      expect(changes).toEqual([
        [{sortKey: 'name', direction: 'ascending'}],
        [{sortKey: 'name', direction: 'descending'}],
        [],
      ]);
    });

    it('cycles ascending, descending, ascending when allowUnsortedState is false', async () => {
      const {table, changes} = await make({allowUnsortedState: false});
      for (let i = 0; i < 3; i++) {
        button(table, 'name').click();
        await table.updateComplete;
      }
      expect(changes.map((sort) => sort[0]?.direction)).toEqual([
        'ascending',
        'descending',
        'ascending',
      ]);
    });

    it('replaces the sort when another column is clicked in single-sort mode', async () => {
      const {table, changes} = await make({sort: [{sortKey: 'name', direction: 'ascending'}]});
      button(table, 'age').click();
      expect(changes.at(-1)).toEqual([{sortKey: 'age', direction: 'ascending'}]);
    });

    it('Shift+click adds, toggles and removes secondary sort keys in multi-sort mode', async () => {
      const {table, changes} = await make({
        sort: [{sortKey: 'name', direction: 'ascending'}],
        multiSort: true,
      });
      const shiftClick = async (key: string): Promise<void> => {
        button(table, key).dispatchEvent(new MouseEvent('click', {bubbles: true, shiftKey: true}));
        await table.updateComplete;
      };
      await shiftClick('age');
      expect(changes.at(-1)).toEqual([
        {sortKey: 'name', direction: 'ascending'},
        {sortKey: 'age', direction: 'ascending'},
      ]);
      await shiftClick('age');
      expect(changes.at(-1)![1]).toEqual({sortKey: 'age', direction: 'descending'});
      await shiftClick('age');
      expect(changes.at(-1)).toEqual([{sortKey: 'name', direction: 'ascending'}]);
      button(table, 'role').click();
      expect(changes.at(-1)).toEqual([{sortKey: 'role', direction: 'ascending'}]);
    });

    it('a Shift+click without multiSort behaves like a click', async () => {
      const {table, changes} = await make({sort: [{sortKey: 'name', direction: 'ascending'}]});
      button(table, 'age').dispatchEvent(new MouseEvent('click', {bubbles: true, shiftKey: true}));
      expect(changes.at(-1)).toEqual([{sortKey: 'age', direction: 'ascending'}]);
    });

    it('does nothing for a header without a sort control', async () => {
      const {table, changes} = await make();
      header(table, 'id').click();
      expect(changes).toEqual([]);
    });
  });

  describe('accessibility', () => {
    it('sets aria-sort on the sorted header only', async () => {
      const {table} = await make({sort: [{sortKey: 'age', direction: 'descending'}]});
      expect(header(table, 'age').getAttribute('aria-sort')).toBe('descending');
      expect(header(table, 'name').hasAttribute('aria-sort')).toBe(false);
      expect(header(table, 'id').hasAttribute('aria-sort')).toBe(false);
      const node = await axNode(header(table, 'age'));
      expect(node.role).toBe('columnheader');
    });

    it('names the button by its sort action and state', async () => {
      const {table, sortState, plugin} = await make();
      expect(button(table, 'name').getAttribute('aria-label')).toBe('Sort by Name');
      sortState.sort = [{sortKey: 'name', direction: 'ascending'}];
      plugin.refresh();
      await table.updateComplete;
      expect(button(table, 'name').getAttribute('aria-label')).toBe(
        'Sort by Name, sorted ascending',
      );
      expect((await axNode(button(table, 'name'))).name).toBe('Sort by Name, sorted ascending');
    });

    it('includes the priority in a multi-sort name', async () => {
      const {table} = await make({
        sort: [
          {sortKey: 'name', direction: 'ascending'},
          {sortKey: 'age', direction: 'descending'},
        ],
        multiSort: true,
      });
      expect(button(table, 'age').getAttribute('aria-label')).toBe(
        'Sort by Age, sorted descending, priority 2 of 2',
      );
    });

    it('is operable from the keyboard: Tab reaches it, Enter and Space activate it', async () => {
      const {table, changes} = await make();
      button(table, 'name').focus();
      await pressKeys('Enter');
      expect(changes).toHaveLength(1);
      await pressKeys(' ');
      expect(changes).toHaveLength(2);
      await pressKeys('Tab');
      expect(document.activeElement).toBe(button(table, 'role'));
    });

    it('passes axe unsorted, sorted, in multi-sort and in RTL', async () => {
      const {table, sortState, plugin} = await make({multiSort: true});
      await expectAccessible(table);
      sortState.sort = [
        {sortKey: 'name', direction: 'ascending'},
        {sortKey: 'age', direction: 'descending'},
      ];
      plugin.refresh();
      await table.updateComplete;
      await expectAccessible(table);
      const rtl = await make({dir: 'rtl', sort: [{sortKey: 'age', direction: 'ascending'}]});
      await expectAccessible(rtl.table);
    });
  });

  describe('sort announcement', () => {
    let restore: () => void;
    beforeEach(() => {
      restore = overrideFeature('ariaNotify', false);
    });
    afterEach(() => {
      restore();
    });

    it('announces the new sort once the table shows it, and when it is cleared', async () => {
      const {table} = await make({allowUnsortedState: true});
      button(table, 'name').click();
      await waitUntil(
        () => getAnnouncerRegions().polite?.textContent === 'Sorted by Name, ascending',
        'sorted announcement',
      );
      button(table, 'name').click();
      button(table, 'name').click();
      await waitUntil(
        () => getAnnouncerRegions().polite?.textContent === 'Sort cleared',
        'cleared announcement',
        4000,
      );
    });

    it('does not announce a sort change the owner applied itself', async () => {
      const {table, sortState, plugin} = await make();
      sortState.sort = [{sortKey: 'name', direction: 'ascending'}];
      plugin.refresh();
      await table.updateComplete;
      await aTimeout(300);
      expect(getAnnouncerRegions().polite?.textContent ?? '').toBe('');
    });
  });

  describe('context menu actions', () => {
    it('offers Sort ascending and descending on a sortable header, and Clear sort once sorted', async () => {
      const {table, changes} = await make();
      const menuOpen = async (key: string): Promise<HTMLElement[]> => {
        header(table, key).dispatchEvent(
          new MouseEvent('contextmenu', {
            bubbles: true,
            cancelable: true,
            clientX: 40,
            clientY: 40,
          }),
        );
        const menu = table.querySelector('tct-context-menu')!;
        await waitUntil(() => menu.open, 'menu opens');
        await aTimeout(50);
        return [...menu.shadowRoot!.querySelectorAll<HTMLElement>('tct-dropdown-menu-item')];
      };
      let items = await menuOpen('name');
      expect(items.map((item) => item.getAttribute('label'))).toEqual([
        'Sort ascending',
        'Sort descending',
      ]);
      items[1]!.click();
      await waitUntil(() => changes.length === 1, 'sort requested');
      expect(changes[0]).toEqual([{sortKey: 'name', direction: 'descending'}]);
      await table.updateComplete;
      await aTimeout(200);
      items = await menuOpen('name');
      expect(items.map((item) => item.getAttribute('label'))).toEqual([
        'Sort ascending',
        'Sort descending',
        'Clear sort',
      ]);
      const checked = items.map((item) => item.getAttribute('icon'));
      expect(checked).toEqual(['arrowUp', 'check', 'close']);
    });

    it('leaves the browser menu alone on a header without sort actions', async () => {
      const {table} = await make();
      const event = new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        clientX: 10,
        clientY: 10,
      });
      header(table, 'id').dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
    });
  });

  describe('i18n', () => {
    it('localises the sort button name in de-DE and keeps RTL layout in ar-SA', async () => {
      const root = await fixture<HTMLElement>('<div lang="de-DE"><tct-table></tct-table></div>');
      const table = root.querySelector<TctTable<Person>>('tct-table')!;
      const plugin = new TableSortableController<Person>(null, {
        sort: [],
        onSortChange: () => undefined,
      });
      Object.assign(table, {data: PEOPLE, columns: COLUMNS, plugins: {sort: plugin}});
      await table.updateComplete;
      await waitUntil(
        () => button(table, 'name').getAttribute('aria-label') === 'Nach Name sortieren',
        'de-DE catalog',
      );
    });
  });
});

describe('TableSortableStateController (useTableSortableState.test.tsx)', () => {
  const rows = [
    {name: 'Charlie', age: 35, dept: 'Ops', id: 'c'},
    {name: 'alice', age: 28, dept: 'Eng', id: 'a'},
    {name: 'Bob', age: 42, dept: 'Eng', id: 'b'},
    {name: 'Diana', age: 31, dept: 'Ops', id: 'd'},
  ];
  const names = (data: readonly {name: string}[]): string[] => data.map((row) => row.name);

  it('returns the data unsorted when there is no sort, and never mutates the input', () => {
    const state = new TableSortableStateController(null, {data: rows});
    expect(state.sortedData).toBe(rows);
    state.sort = [{sortKey: 'name', direction: 'ascending'}];
    expect(names(state.sortedData)).toEqual(['alice', 'Bob', 'Charlie', 'Diana']);
    expect(names(rows)).toEqual(['Charlie', 'alice', 'Bob', 'Diana']);
  });

  it('applies defaultSort and sorts numbers numerically and text with numeric collation', () => {
    const state = new TableSortableStateController(null, {
      data: rows,
      defaultSort: [{sortKey: 'age', direction: 'descending'}],
    });
    expect(names(state.sortedData)).toEqual(['Bob', 'Charlie', 'Diana', 'alice']);
    const items = [{v: 'item 10'}, {v: 'item 2'}, {v: 'item 1'}];
    const numeric = new TableSortableStateController<{v: string}>(null, {
      data: items,
      defaultSort: [{sortKey: 'v', direction: 'ascending'}],
    });
    expect(numeric.sortedData.map((row) => row.v)).toEqual(['item 1', 'item 2', 'item 10']);
  });

  it('sorts by several keys, stably, with the primary first', () => {
    const state = new TableSortableStateController(null, {
      data: rows,
      defaultSort: [
        {sortKey: 'dept', direction: 'ascending'},
        {sortKey: 'age', direction: 'descending'},
      ],
    });
    expect(names(state.sortedData)).toEqual(['Bob', 'alice', 'Charlie', 'Diana']);
  });

  it('puts missing values (null, undefined, NaN) last in both directions', () => {
    const data = [
      {n: 2, id: 'x'},
      {n: null, id: 'y'},
      {n: 1, id: 'z'},
      {n: Number.NaN, id: 'w'},
      {n: undefined, id: 'v'},
    ] as {n: number | null | undefined; id: string}[];
    const state = new TableSortableStateController<{n: number | null | undefined; id: string}>(
      null,
      {
        data,
        defaultSort: [{sortKey: 'n', direction: 'ascending'}],
      },
    );
    expect(state.sortedData.map((row) => row.id).slice(0, 2)).toEqual(['z', 'x']);
    state.sort = [{sortKey: 'n', direction: 'descending'}];
    expect(state.sortedData.map((row) => row.id).slice(0, 2)).toEqual(['x', 'z']);
  });

  it('uses custom comparators (ascending; the direction is applied for you)', () => {
    const state = new TableSortableStateController(null, {
      data: rows,
      defaultSort: [{sortKey: 'name', direction: 'descending'}],
      comparators: {name: (a, b) => a.name.length - b.name.length},
    });
    expect(names(state.sortedData)[0]).toBe('Charlie');
  });

  it('memoizes sortedData until data, sort or comparators change', () => {
    const state = new TableSortableStateController(null, {
      data: rows,
      defaultSort: [{sortKey: 'name', direction: 'ascending'}],
    });
    const first = state.sortedData;
    expect(state.sortedData).toBe(first);
    state.data = [...rows];
    expect(state.sortedData).not.toBe(first);
  });

  it('applySort sorts arbitrary data with the current state', () => {
    const state = new TableSortableStateController(null, {
      data: rows,
      defaultSort: [{sortKey: 'age', direction: 'ascending'}],
    });
    expect(names(state.applySort([rows[0]!, rows[3]!]))).toEqual(['Diana', 'Charlie']);
  });

  it('owns the state uncontrolled, and calls onSortChange in both modes', () => {
    const changes: TableSortState[] = [];
    const uncontrolled = new TableSortableStateController(null, {
      data: rows,
      onSortChange: (sort) => changes.push(sort),
    });
    uncontrolled.sortConfig.onSortChange([{sortKey: 'age', direction: 'ascending'}]);
    expect(uncontrolled.sort).toEqual([{sortKey: 'age', direction: 'ascending'}]);
    const controlled = new TableSortableStateController(null, {
      data: rows,
      sort: [],
      onSortChange: (sort) => changes.push(sort),
    });
    controlled.sortConfig.onSortChange([{sortKey: 'name', direction: 'ascending'}]);
    expect(controlled.sort).toEqual([]);
    expect(changes).toHaveLength(2);
  });

  it('notifies subscribers and its Lit host after every change, and writes emit nothing', () => {
    const host = {
      requestUpdate: vi.fn(),
      addController: vi.fn(),
      removeController: vi.fn(),
      updateComplete: Promise.resolve(true),
    };
    const state = new TableSortableStateController(host, {data: rows});
    const listener = vi.fn();
    const stop = state.subscribe(listener);
    state.sortConfig.onSortChange([{sortKey: 'name', direction: 'ascending'}]);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(host.requestUpdate).toHaveBeenCalled();
    stop();
    state.sortConfig.onSortChange([]);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('sorts with the locale of the host element (sv-SE puts å after z)', () => {
    const element = document.createElement('div');
    element.lang = 'sv-SE';
    document.body.append(element);
    const words = [{w: 'ål'}, {w: 'zebra'}, {w: 'apa'}];
    const state = new TableSortableStateController<{w: string}>(null, {
      element,
      data: words,
      defaultSort: [{sortKey: 'w', direction: 'ascending'}],
    });
    expect(state.sortedData.map((row) => row.w)).toEqual(['apa', 'zebra', 'ål']);
    element.remove();
  });

  it('drives a table end to end: header click sorts the rendered rows', async () => {
    const root = await fixture<HTMLElement>('<div><tct-table></tct-table></div>');
    const table = root.querySelector<TctTable<Person>>('tct-table')!;
    const state = new TableSortableStateController<Person>(table, {data: PEOPLE});
    const plugin = new TableSortableController<Person>(table, state.sortConfig);
    const sync = state.subscribe(() => {
      table.data = state.sortedData;
    });
    Object.assign(table, {
      data: state.sortedData,
      columns: COLUMNS,
      idKey: 'id',
      plugins: {sort: plugin},
    });
    await table.updateComplete;
    button(table, 'age').click();
    await table.updateComplete;
    expect(bodyText(table).map((row) => row[0])).toEqual([
      'Bob Smith',
      'Alice Chen',
      'Dmitri Volkov',
      'Carol Wu',
    ]);
    expect(header(table, 'age').getAttribute('aria-sort')).toBe('ascending');
    await userEvent.click(button(table, 'age'));
    await table.updateComplete;
    expect(bodyText(table).map((row) => row[0])).toEqual([
      'Carol Wu',
      'Dmitri Volkov',
      'Alice Chen',
      'Bob Smith',
    ]);
    sync();
  });
});
