/**
 * Tree data (useTableTreeData, useTableTreeState): the expander, row-click expansion, row ARIA, the flat
 * no-op, indentation, treeColumnKey, lazy loading, the expand-all control, composition with selection and
 * sorting, and the state controller's flattening, controlled mode and hostile-data rules.
 */
import {beforeAll, describe, expect, it, vi} from 'vitest';
import {userEvent} from 'vitest/browser';
import {axNode, expectAccessible} from '@tecton-wc/testing/a11y.js';
import {fixture} from '@tecton-wc/testing/fixture.js';
import {pressKeys} from '@tecton-wc/testing/keyboard.js';
import {waitUntil} from '@tecton-wc/testing/timing.js';
import './define.js';
import {
  TableSelectionController,
  TableSelectionStateController,
  TableSortableController,
  TableSortableStateController,
  TableTreeDataController,
  TableTreeStateController,
  type TableTreeStateOptions,
} from './define.js';
import {bodyText, useLayeredPreflight} from './table-test-helpers.js';
import type {TableColumn} from './table.types.js';
import type {TctTable} from './tct-table.js';

beforeAll(useLayeredPreflight);

interface Node extends Record<string, unknown> {
  id: string;
  name: string;
  size: number;
  children?: Node[];
}

const TREE = (): Node[] => [
  {
    id: 'a',
    name: 'Alpha',
    size: 3,
    children: [
      {id: 'a1', name: 'Alpha 1', size: 2, children: [{id: 'a1x', name: 'Alpha 1x', size: 1}]},
      {id: 'a2', name: 'Alpha 2', size: 1},
    ],
  },
  {id: 'b', name: 'Bravo', size: 5},
  {id: 'c', name: 'Charlie', size: 4, children: [{id: 'c1', name: 'Charlie 1', size: 4}]},
];

const FLAT = (): Node[] => [
  {id: 'x', name: 'X', size: 1},
  {id: 'y', name: 'Y', size: 2},
];

const COLUMNS: TableColumn<Node>[] = [
  {key: 'name', header: 'Name'},
  {key: 'size', header: 'Size', align: 'end'},
];

interface Harness {
  table: TctTable<Node>;
  state: TableTreeStateController<Node>;
  plugin: TableTreeDataController<Node>;
  changes: ReadonlySet<string>[];
}

interface MakeOptions extends Partial<TableTreeStateOptions<Node>> {
  columns?: TableColumn<Node>[];
  dir?: 'rtl';
  lang?: string;
  plugins?: (state: TableTreeStateController<Node>) => Record<string, never>;
}

async function make(options: MakeOptions = {}): Promise<Harness> {
  const {columns, plugins, dir, lang, ...stateOptions} = options;
  const root = await fixture<HTMLElement>(
    `<div ${dir ? `dir="${dir}"` : ''} ${lang ? `lang="${lang}"` : ''}><tct-table></tct-table></div>`,
  );
  const table = root.querySelector<TctTable<Node>>('tct-table')!;
  const changes: ReadonlySet<string>[] = [];
  const state: TableTreeStateController<Node> = new TableTreeStateController<Node>(table, {
    data: TREE(),
    idKey: 'id',
    ...stateOptions,
    onExpandedIdsChange: (next) => {
      changes.push(next);
      stateOptions.onExpandedIdsChange?.(next);
      if (stateOptions.expandedIds) state.expandedIds = next;
    },
  });
  const plugin: TableTreeDataController<Node> = new TableTreeDataController<Node>(
    table,
    state.treeConfig,
  );
  state.subscribe(() => {
    table.data = state.visibleData;
  });
  Object.assign(table, {
    data: state.visibleData,
    columns: columns ?? COLUMNS,
    idKey: 'id',
    plugins: {tree: plugin, ...plugins?.(state)},
  });
  await table.updateComplete;
  return {table, state, plugin, changes};
}

const rows = (table: Element): HTMLTableRowElement[] => [
  ...table.querySelectorAll<HTMLTableRowElement>('tbody > tr'),
];
const names = (table: Element): string[] => bodyText(table).map((cells) => cells[0]!);
const expander = (row: Element): HTMLButtonElement | null =>
  row.querySelector<HTMLButtonElement>('button.tct-table-expander');
const settled = async (table: TctTable<Node>): Promise<void> => {
  await table.updateComplete;
};
const treeLevel = (row: Element): string =>
  row.querySelector<HTMLElement>('.tct-table-tree-cell')!.style.getPropertyValue('--_tree-level');

describe('table tree data plugin (useTableTreeData.test.tsx)', () => {
  describe('expander', () => {
    it('renders an "Expand row" button on collapsed expandable rows only', async () => {
      const {table} = await make();
      const buttons = rows(table).map(expander);
      expect(buttons.map((button) => button?.getAttribute('aria-label') ?? null)).toEqual([
        'Expand row',
        null,
        'Expand row',
      ]);
      expect(names(table)).toEqual(['Alpha', 'Bravo', 'Charlie']);
    });

    it('expands children on click and relabels the button "Collapse row"', async () => {
      const {table, changes} = await make();
      await userEvent.click(expander(rows(table)[0]!)!);
      await settled(table);
      expect(names(table)).toEqual(['Alpha', 'Alpha 1', 'Alpha 2', 'Bravo', 'Charlie']);
      expect(expander(rows(table)[0]!)!.getAttribute('aria-label')).toBe('Collapse row');
      expect([...changes.at(-1)!]).toEqual(['a']);
    });

    it('collapses an expanded row on click, unmounting the subtree', async () => {
      const {table} = await make({defaultExpandedIds: ['a', 'a1']});
      expect(names(table)).toEqual(['Alpha', 'Alpha 1', 'Alpha 1x', 'Alpha 2', 'Bravo', 'Charlie']);
      await userEvent.click(expander(rows(table)[0]!)!);
      await settled(table);
      expect(names(table)).toEqual(['Alpha', 'Bravo', 'Charlie']);
      expect(table.textContent).not.toContain('Alpha 1x');
    });

    it('sets aria-expanded on the expander button and names it through the accessibility tree', async () => {
      const {table} = await make();
      const button = expander(rows(table)[0]!)!;
      expect(button.getAttribute('aria-expanded')).toBe('false');
      expect((await axNode(button)).name).toBe('Expand row');
      button.click();
      await settled(table);
      expect(expander(rows(table)[0]!)!.getAttribute('aria-expanded')).toBe('true');
    });

    it('is a real button that Enter and Space operate', async () => {
      const {table} = await make();
      expander(rows(table)[0]!)!.focus();
      await pressKeys('Enter');
      await settled(table);
      expect(names(table)).toContain('Alpha 1');
      expander(rows(table)[0]!)!.focus();
      await pressKeys('Space');
      await settled(table);
      expect(names(table)).not.toContain('Alpha 1');
    });

    it('keeps the focus on the expander across the re-render', async () => {
      const {table} = await make();
      expander(rows(table)[0]!)!.focus();
      await pressKeys('Enter');
      await settled(table);
      expect(document.activeElement).toBe(expander(rows(table)[0]!));
    });
  });

  describe('row-click expansion', () => {
    it('does not toggle on a row click when rowClickExpansion is unset', async () => {
      const {table} = await make();
      await userEvent.click(rows(table)[0]!.querySelectorAll('td')[1]!);
      await settled(table);
      expect(names(table)).toEqual(['Alpha', 'Bravo', 'Charlie']);
    });

    it('expands and collapses an expandable row when its body is clicked', async () => {
      const {table} = await make({rowClickExpansion: true});
      await userEvent.click(rows(table)[0]!.querySelectorAll('td')[1]!);
      await settled(table);
      expect(names(table)).toEqual(['Alpha', 'Alpha 1', 'Alpha 2', 'Bravo', 'Charlie']);
      await userEvent.click(rows(table)[0]!.querySelectorAll('td')[1]!);
      await settled(table);
      expect(names(table)).toEqual(['Alpha', 'Bravo', 'Charlie']);
    });

    it('does not toggle when a leaf row is clicked', async () => {
      const {table, changes} = await make({rowClickExpansion: true});
      await userEvent.click(rows(table)[1]!.querySelectorAll('td')[1]!);
      await settled(table);
      expect(changes).toHaveLength(0);
    });

    it('toggles once when the chevron is clicked (no double toggle through the row)', async () => {
      const {table, changes} = await make({rowClickExpansion: true});
      await userEvent.click(expander(rows(table)[0]!)!);
      await settled(table);
      expect(changes).toHaveLength(1);
      expect(names(table)).toContain('Alpha 1');
    });

    it('does not toggle when a control inside the row is clicked', async () => {
      const {table, changes} = await make({
        rowClickExpansion: true,
        columns: [
          {key: 'name', header: 'Name'},
          {
            key: 'size',
            header: 'Action',
            renderCell: (item) => {
              const button = document.createElement('button');
              button.textContent = `Open ${item.name}`;
              return button;
            },
          },
        ],
      });
      await userEvent.click(
        rows(table)[0]!.querySelector<HTMLElement>('td button:not(.tct-table-expander)')!,
      );
      await settled(table);
      expect(changes).toHaveLength(0);
    });

    it('does not toggle when the click ends a text selection', async () => {
      const {table, changes} = await make({rowClickExpansion: true});
      const cell = rows(table)[0]!.querySelectorAll('td')[1]!;
      const range = document.createRange();
      range.selectNodeContents(cell);
      getSelection()!.removeAllRanges();
      getSelection()!.addRange(range);
      cell.dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true}));
      getSelection()!.removeAllRanges();
      await settled(table);
      expect(changes).toHaveLength(0);
    });

    it('is a no-op on flat data even when rowClickExpansion is set', async () => {
      const {table, changes} = await make({data: FLAT(), rowClickExpansion: true});
      await userEvent.click(rows(table)[0]!.querySelector('td')!);
      expect(changes).toHaveLength(0);
      expect(rows(table)[0]!.classList.contains('tct-table-row-clickable')).toBe(false);
    });
  });

  describe('row state', () => {
    it('sets a 1-based data-tree-level on every body row and no invalid row ARIA', async () => {
      const {table} = await make({defaultExpandedIds: ['a', 'a1']});
      expect(rows(table).map((row) => row.getAttribute('data-tree-level'))).toEqual([
        '1',
        '2',
        '3',
        '2',
        '1',
        '1',
      ]);
      expect(table.querySelectorAll('tr[aria-level], tr[aria-expanded]')).toHaveLength(0);
    });

    it('marks expandable rows with data-tree-expanded and omits it on leaves', async () => {
      const {table} = await make({defaultExpandedIds: ['a']});
      expect(rows(table).map((row) => row.getAttribute('data-tree-expanded'))).toEqual([
        'true',
        'false',
        null,
        null,
        'false',
      ]);
    });

    it('has no accessibility violations while expanded', async () => {
      const {table} = await make({defaultExpandedIds: ['a']});
      await expectAccessible(table);
    });
  });

  describe('flat data is a no-op', () => {
    it('renders no expanders, spacers or tree ARIA for flat data', async () => {
      const {table} = await make({data: FLAT()});
      expect(table.querySelectorAll('.tct-table-expander, .tct-table-tree-spacer')).toHaveLength(0);
      expect(table.querySelectorAll('tr[data-tree-level], tr[data-tree-expanded]')).toHaveLength(0);
      expect(table.querySelector('.tct-table-tree-cell')).toBeNull();
    });

    it('renders the first-column content identically to a table without the plugin', async () => {
      const {table} = await make({data: FLAT()});
      const other = await fixture<TctTable<Node>>('<tct-table></tct-table>');
      Object.assign(other, {data: FLAT(), columns: COLUMNS, idKey: 'id'});
      await other.updateComplete;
      const clean = (element: Element): string =>
        element.querySelector('tbody')!.innerHTML.replace(/<!--.*?-->/g, '');
      expect(clean(table)).toBe(clean(other));
    });

    it('adds the tree affordance when flat data becomes nested, and removes it again', async () => {
      const {table, state} = await make({data: FLAT()});
      const original = table.querySelector('tbody');
      state.data = TREE();
      await settled(table);
      expect(table.querySelector('tbody')).toBe(original);
      expect(table.querySelectorAll('tr[data-tree-level]').length).toBeGreaterThan(0);
      expect(table.querySelector('.tct-table-expander')).not.toBeNull();
      state.data = FLAT();
      await settled(table);
      expect(table.querySelectorAll('tr[data-tree-level], tr[data-tree-expanded]')).toHaveLength(0);
      expect(table.querySelector('.tct-table-expander')).toBeNull();
    });
  });

  describe('indentation', () => {
    const padding = (row: Element): number =>
      parseFloat(getComputedStyle(row.querySelector('.tct-table-tree-cell')!).paddingInlineStart);

    it('indents nested rows by level and leaves roots unindented', async () => {
      const {table} = await make({defaultExpandedIds: ['a', 'a1']});
      expect(rows(table).map(treeLevel)).toEqual(['0', '1', '2', '1', '0', '0']);
      const all = rows(table);
      expect(padding(all[0]!)).toBe(0);
      expect(padding(all[1]!)).toBeGreaterThan(0);
      expect(padding(all[2]!)).toBeCloseTo(padding(all[1]!) * 2, 1);
    });

    it('respects the indent size', async () => {
      const small = await make({defaultExpandedIds: ['a'], indent: 'sm'});
      const large = await make({defaultExpandedIds: ['a'], indent: 'lg'});
      expect(padding(rows(large.table)[1]!)).toBeGreaterThan(padding(rows(small.table)[1]!));
    });

    it('indents from the inline start in RTL', async () => {
      const {table} = await make({defaultExpandedIds: ['a'], dir: 'rtl'});
      const cell = rows(table)[1]!.querySelector('.tct-table-tree-cell')!;
      expect(getComputedStyle(cell).paddingRight).not.toBe('0px');
      expect(getComputedStyle(cell).paddingLeft).toBe('0px');
    });

    it('supports deep nesting with no depth cap', async () => {
      let node: Node = {id: 'leaf', name: 'Leaf', size: 0};
      for (let depth = 24; depth >= 0; depth--) {
        node = {id: `n${depth}`, name: `Node ${depth}`, size: depth, children: [node]};
      }
      const {table, state} = await make({data: [node]});
      state.expandAll();
      await settled(table);
      expect(rows(table)).toHaveLength(26);
      expect(rows(table).at(-1)!.getAttribute('data-tree-level')).toBe('26');
      expect(treeLevel(rows(table).at(-1)!)).toBe('25');
    });
  });

  describe('treeColumnKey', () => {
    it('moves the expander into the configured column', async () => {
      const {table} = await make({treeColumnKey: 'size'});
      expect(table.querySelector('tbody tr td:first-child .tct-table-expander')).toBeNull();
      expect(table.querySelector('tbody tr td:nth-child(2) .tct-table-expander')).not.toBeNull();
    });

    it('falls back to the first column when the configured column is absent', async () => {
      const {table} = await make({treeColumnKey: 'missing'});
      expect(table.querySelector('tbody tr td:first-child .tct-table-expander')).not.toBeNull();
    });
  });

  describe('lazy loading', () => {
    it('shows an expander before children exist and reveals them once loaded', async () => {
      const data: Node[] = [{id: 'lazy', name: 'Lazy', size: 1}];
      const {table, state} = await make({data, isItemExpandable: (item) => item.id === 'lazy'});
      const button = expander(rows(table)[0]!)!;
      expect(button).not.toBeNull();
      button.click();
      await settled(table);
      expect(state.expandedIds.has('lazy')).toBe(true);
      expect(rows(table)).toHaveLength(1);
      data[0]!.children = [{id: 'l1', name: 'Loaded', size: 2}];
      state.data = [...data];
      await settled(table);
      expect(names(table)).toEqual(['Lazy', 'Loaded']);
    });
  });

  describe('degenerate configurations', () => {
    it('renders without crashing when the table has zero columns', async () => {
      const {table} = await make({columns: []});
      expect(table.querySelector('table')).not.toBeNull();
    });

    it('updates the level in place when a row is reparented deeper', async () => {
      const data: Node[] = [
        {id: 'p', name: 'P', size: 1, children: [{id: 'q', name: 'Q', size: 2}]},
        {id: 'r', name: 'R', size: 3},
      ];
      const {table, state} = await make({data, defaultExpandedIds: ['p']});
      expect(rows(table).map((row) => row.getAttribute('data-tree-level'))).toEqual([
        '1',
        '2',
        '1',
      ]);
      state.data = [
        {
          id: 'p',
          name: 'P',
          size: 1,
          children: [{id: 'q', name: 'Q', size: 2, children: [{id: 'r', name: 'R', size: 3}]}],
        },
      ];
      state.expandedIds = new Set(['p', 'q']);
      await settled(table);
      expect(rows(table).map((row) => row.getAttribute('data-tree-level'))).toEqual([
        '1',
        '2',
        '3',
      ]);
    });
  });

  describe('composition', () => {
    it('prepends the selection checkbox column before the tree column', async () => {
      const {table} = await make({
        defaultExpandedIds: ['a'],
        plugins: () => {
          const selection = new TableSelectionStateController<Node>(null, {
            data: TREE(),
            idKey: 'id',
          });
          return {
            selection: new TableSelectionController<Node>(null, selection.selectionConfig),
          } as never;
        },
      });
      const cells = [...rows(table)[0]!.querySelectorAll('td')];
      expect(cells[0]!.querySelector('tct-checkbox-input')).not.toBeNull();
      expect(cells[1]!.querySelector('.tct-table-expander')).not.toBeNull();
      expect(table.querySelectorAll('thead th')).toHaveLength(3);
    });

    it('sorts sibling groups through sortSiblings without interleaving levels', async () => {
      const sort = new TableSortableStateController<Node>(null, {
        data: [],
        defaultSort: [{sortKey: 'size', direction: 'ascending'}],
      });
      const {table, state} = await make({
        defaultExpandedIds: ['a'],
        sortSiblings: (siblings) => sort.applySort(siblings),
        plugins: () => ({sort: new TableSortableController<Node>(null, sort.sortConfig)}) as never,
      });
      sort.subscribe(() => {
        state.invalidate();
      });
      state.invalidate();
      await settled(table);
      // Roots by size: Alpha 3, Charlie 4, Bravo 5; Alpha's children by size: Alpha 2 (1), Alpha 1 (2).
      expect(names(table)).toEqual(['Alpha', 'Alpha 2', 'Alpha 1', 'Charlie', 'Bravo']);
    });
  });

  describe('expand-all header control', () => {
    const toggle = (table: Element): HTMLButtonElement | null =>
      table.querySelector<HTMLButtonElement>('thead button.tct-table-expander');

    it('renders no expand-all control by default', async () => {
      const {table} = await make();
      expect(toggle(table)).toBeNull();
    });

    it('renders an "Expand all rows" toggle in the tree column header when enabled', async () => {
      const {table} = await make({expandAllControl: true});
      expect(toggle(table)!.getAttribute('aria-label')).toBe('Expand all rows');
      expect(toggle(table)!.closest('th')!.getAttribute('data-column-key')).toBe('name');
      expect((await axNode(toggle(table)!)).name).toBe('Expand all rows');
    });

    it('expands every row when the collapsed toggle is clicked, then relabels it', async () => {
      const {table} = await make({expandAllControl: true});
      await userEvent.click(toggle(table)!);
      await settled(table);
      expect(names(table)).toEqual([
        'Alpha',
        'Alpha 1',
        'Alpha 1x',
        'Alpha 2',
        'Bravo',
        'Charlie',
        'Charlie 1',
      ]);
      expect(toggle(table)!.getAttribute('aria-label')).toBe('Collapse all rows');
      expect(toggle(table)!.getAttribute('aria-expanded')).toBe('true');
    });

    it('collapses back to the roots when the expanded toggle is clicked', async () => {
      const {table} = await make({expandAllControl: true, defaultExpandedIds: ['a', 'a1', 'c']});
      await userEvent.click(toggle(table)!);
      await settled(table);
      expect(names(table)).toEqual(['Alpha', 'Bravo', 'Charlie']);
    });

    it('is not "expanded" in the partial state', async () => {
      const {table} = await make({expandAllControl: true, defaultExpandedIds: ['a']});
      expect(toggle(table)!.getAttribute('aria-expanded')).toBe('false');
      expect(toggle(table)!.getAttribute('aria-label')).toBe('Expand all rows');
    });

    it('does not render for flat data even when enabled', async () => {
      const {table} = await make({data: FLAT(), expandAllControl: true});
      expect(toggle(table)).toBeNull();
    });

    it('sits inline with the header label, not stacked above it', async () => {
      const {table} = await make({expandAllControl: true});
      const button = toggle(table)!.getBoundingClientRect();
      const header = table.querySelector('thead .tct-table-tree-header')!;
      const range = document.createRange();
      range.selectNodeContents(header.lastChild!);
      const label = range.getBoundingClientRect();
      expect(header.textContent).toContain('Name');
      expect(
        Math.abs(button.top + button.height / 2 - (label.top + label.height / 2)),
      ).toBeLessThan(button.height);
    });
  });

  describe('locale and direction', () => {
    it('localises the expander name in de-DE', async () => {
      const {table} = await make({lang: 'de-DE'});
      await waitUntil(
        () => expander(rows(table)[0]!)!.getAttribute('aria-label') !== 'Expand row',
        'de-DE catalog',
      );
    });

    it('does not add a second flip to the chevron in RTL (the icon mirrors itself)', async () => {
      const {table} = await make({dir: 'rtl'});
      const icon = expander(rows(table)[0]!)!.querySelector('tct-icon')!;
      expect(icon.getAttribute('name')).toBe('chevronRight');
      expect(getComputedStyle(icon).rotate).toBe('none');
    });
  });
});

describe('table tree state controller (useTableTreeState.test.tsx)', () => {
  const state = (
    options: Partial<TableTreeStateOptions<Node>> = {},
  ): TableTreeStateController<Node> =>
    new TableTreeStateController<Node>(null, {data: TREE(), idKey: 'id', ...options});
  const ids = (controller: TableTreeStateController<Node>): string[] =>
    controller.visibleData.map((row) => row.id);

  describe('flattening', () => {
    it('emits only the roots when nothing is expanded', () => {
      expect(ids(state())).toEqual(['a', 'b', 'c']);
    });

    it('reveals the children of the default expanded ids depth first', () => {
      expect(ids(state({defaultExpandedIds: ['a', 'a1']}))).toEqual([
        'a',
        'a1',
        'a1x',
        'a2',
        'b',
        'c',
      ]);
    });

    it('keeps a collapsed subtree unmounted even when its descendants are in the expanded set', () => {
      expect(ids(state({defaultExpandedIds: ['a1']}))).toEqual(['a', 'b', 'c']);
    });
  });

  describe('toggling and the controlled mode', () => {
    it('expands and collapses through treeConfig.onToggleItem', () => {
      const controller = state();
      controller.treeConfig.onToggleItem(TREE()[0]!);
      expect(ids(controller)).toEqual(['a', 'a1', 'a2', 'b', 'c']);
      controller.treeConfig.onToggleItem(TREE()[0]!);
      expect(ids(controller)).toEqual(['a', 'b', 'c']);
    });

    it('derives visibility from the controlled set and reports toggles without changing it', () => {
      const onChange = vi.fn();
      const controller = state({expandedIds: new Set(['a']), onExpandedIdsChange: onChange});
      expect(ids(controller)).toEqual(['a', 'a1', 'a2', 'b', 'c']);
      controller.treeConfig.onToggleItem(TREE()[2]!);
      expect(ids(controller)).toEqual(['a', 'a1', 'a2', 'b', 'c']);
      expect([...(onChange.mock.calls[0]![0] as Set<string>)].sort()).toEqual(['a', 'c']);
    });

    it('calls onExpandedIdsChange in the uncontrolled mode too', () => {
      const onChange = vi.fn();
      const controller = state({onExpandedIdsChange: onChange});
      controller.treeConfig.onToggleItem(TREE()[0]!);
      expect(onChange).toHaveBeenCalledTimes(1);
    });

    it('applies two toggles landing in the same task', () => {
      const controller = state();
      controller.treeConfig.onToggleItem(TREE()[0]!);
      controller.treeConfig.onToggleItem(TREE()[2]!);
      expect(ids(controller)).toEqual(['a', 'a1', 'a2', 'b', 'c', 'c1']);
    });

    it('ignores defaultExpandedIds when expandedIds is controlled', () => {
      expect(ids(state({expandedIds: new Set(), defaultExpandedIds: ['a']}))).toEqual([
        'a',
        'b',
        'c',
      ]);
    });

    it('never marks a leaf expanded when it is toggled', () => {
      const controller = state();
      controller.treeConfig.onToggleItem(TREE()[1]!);
      expect(ids(controller)).toEqual(['a', 'b', 'c']);
      expect(controller.treeConfig.getRowMeta(TREE()[1]!)!.isExpanded).toBe(false);
    });
  });

  describe('expandAll and collapseAll', () => {
    it('expands every level', () => {
      const controller = state();
      controller.expandAll();
      expect(ids(controller)).toEqual(['a', 'a1', 'a1x', 'a2', 'b', 'c', 'c1']);
    });

    it('collapses to the roots', () => {
      const controller = state({defaultExpandedIds: ['a', 'c']});
      controller.collapseAll();
      expect(ids(controller)).toEqual(['a', 'b', 'c']);
      expect(controller.expandedIds.size).toBe(0);
    });
  });

  describe('row meta', () => {
    it('reports level, hasChildren and isExpanded per row', () => {
      const controller = state({defaultExpandedIds: ['a']});
      const meta = (id: string) => controller.treeConfig.getRowMeta({id} as Node);
      expect(meta('a')).toEqual({id: 'a', level: 0, hasChildren: true, isExpanded: true});
      expect(meta('a1')).toEqual({id: 'a1', level: 1, hasChildren: true, isExpanded: false});
      expect(meta('a2')).toEqual({id: 'a2', level: 1, hasChildren: false, isExpanded: false});
      expect(meta('a1x')).toBeUndefined();
    });

    it('treats an empty children array as a leaf', () => {
      const controller = state({data: [{id: 'e', name: 'E', size: 0, children: []}]});
      expect(controller.treeConfig.hasExpandableRows).toBe(false);
    });

    it('flags hasExpandableRows for flat and for nested data', () => {
      expect(state({data: FLAT()}).treeConfig.hasExpandableRows).toBe(false);
      expect(state().treeConfig.hasExpandableRows).toBe(true);
    });
  });

  describe('isItemExpandable', () => {
    it('forces an expander on rows whose children have not loaded, and expandAll includes them', () => {
      const controller = state({
        data: [{id: 'l', name: 'Lazy', size: 0}],
        isItemExpandable: () => true,
      });
      expect(controller.treeConfig.getRowMeta({id: 'l'} as Node)!.hasChildren).toBe(true);
      controller.expandAll();
      expect(controller.expandedIds.has('l')).toBe(true);
    });
  });

  describe('sortSiblings', () => {
    it('sorts within sibling groups, never across levels, and never mutates the data', () => {
      const data = TREE();
      const snapshot = JSON.stringify(data);
      const controller = state({
        data,
        defaultExpandedIds: ['a'],
        sortSiblings: (siblings) => siblings.sort((left, right) => right.size - left.size),
      });
      expect(ids(controller)).toEqual(['b', 'c', 'a', 'a1', 'a2']);
      expect(JSON.stringify(data)).toBe(snapshot);
    });
  });

  describe('accessors', () => {
    it('supports a custom childrenKey and a function idKey returning numbers', () => {
      const controller = new TableTreeStateController<Record<string, unknown>>(null, {
        data: [{n: 1, kids: [{n: 2}]}],
        idKey: (item) => item.n as number,
        childrenKey: 'kids',
        defaultExpandedIds: ['1'],
      });
      expect(controller.visibleData.map((row) => row.n)).toEqual([1, 2]);
    });

    it('passes indent, treeColumnKey, expandAllControl and rowClickExpansion through the config', () => {
      const controller = state({
        indent: 'lg',
        treeColumnKey: 'size',
        expandAllControl: true,
        rowClickExpansion: true,
      });
      expect(controller.treeConfig.indent).toBe('lg');
      expect(controller.treeConfig.treeColumnKey).toBe('size');
      expect(controller.treeConfig.expandAllControl).toBe(true);
      expect(controller.treeConfig.rowClickExpansion).toBe(true);
    });
  });

  describe('hostile data', () => {
    it('does not recurse forever on a self-referencing row', () => {
      const cyclic: Node = {id: 'z', name: 'Z', size: 0};
      cyclic.children = [cyclic];
      const controller = state({data: [cyclic], defaultExpandedIds: ['z']});
      expect(ids(controller)).toEqual(['z']);
      controller.expandAll();
      expect(ids(controller)).toEqual(['z']);
    });

    it('does not recurse forever when a descendant points back at an ancestor', () => {
      const top: Node = {id: 't', name: 'T', size: 0};
      const mid: Node = {id: 'm', name: 'M', size: 0, children: [top]};
      top.children = [mid];
      const controller = state({data: [top], defaultExpandedIds: ['t', 'm']});
      expect(ids(controller)).toEqual(['t', 'm']);
    });

    it('shares one expansion state between duplicate ids in different subtrees', () => {
      const branch = (): Node => ({
        id: 'dup',
        name: 'D',
        size: 0,
        children: [{id: 'k', name: 'K', size: 0}],
      });
      const controller = state({
        data: [
          {id: 'r1', name: 'R1', size: 0, children: [branch()]},
          {id: 'r2', name: 'R2', size: 0, children: [branch()]},
        ],
        defaultExpandedIds: ['r1', 'r2', 'dup'],
      });
      expect(ids(controller)).toEqual(['r1', 'dup', 'k', 'r2', 'dup', 'k']);
    });

    it('ignores expanded ids that match no row, and handles empty data', () => {
      expect(ids(state({defaultExpandedIds: ['nope']}))).toEqual(['a', 'b', 'c']);
      expect(state({data: []}).visibleData).toEqual([]);
      expect(state({data: []}).isAllExpanded).toBe(false);
    });
  });

  describe('isAllExpanded', () => {
    it('is false when nothing is expanded and for flat data', () => {
      expect(state().isAllExpanded).toBe(false);
      expect(state({data: FLAT()}).isAllExpanded).toBe(false);
    });

    it('is true only when every expandable row is expanded', () => {
      expect(state({defaultExpandedIds: ['a', 'a1', 'c']}).isAllExpanded).toBe(true);
      expect(state({defaultExpandedIds: ['a', 'a1']}).isAllExpanded).toBe('indeterminate');
    });

    it('returns to false after collapseAll and ignores ids matching no expandable row', () => {
      const controller = state({defaultExpandedIds: ['a', 'b', 'nope']});
      expect(controller.isAllExpanded).toBe('indeterminate');
      controller.collapseAll();
      expect(controller.isAllExpanded).toBe(false);
    });

    it('exposes the aggregate and the handlers through treeConfig', () => {
      const controller = state();
      expect(controller.treeConfig.isAllExpanded).toBe(false);
      controller.treeConfig.onExpandAll!();
      expect(controller.treeConfig.isAllExpanded).toBe(true);
      controller.treeConfig.onCollapseAll!();
      expect(controller.treeConfig.isAllExpanded).toBe(false);
    });
  });
});
