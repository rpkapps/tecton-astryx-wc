/**
 * The keyboard table of tct-table (`parity.json` `keyboard`), one step per row: the table adds no
 * arrow-key grid model (upstream has none), so every key works on a real control inside a cell (sort
 * button, checkbox, expander, resize handle), on the scroll region, or through the context menu keys.
 */
import {beforeAll, expect} from 'vitest';
import {deepActiveElement} from '@tecton-wc/testing/keyboard.js';
import {
  runKeyboardSuite,
  type KeyboardRow,
  type KeyboardStep,
} from '@tecton-wc/testing/suites/keyboard.js';
import {aTimeout, waitUntil} from '@tecton-wc/testing/timing.js';
import './define.js';
import '../context-menu/define.js';
import {
  TableColumnResizeController,
  TableRowExpansionController,
  TableSelectionController,
  TableSelectionStateController,
  TableSortableController,
  TableSortableStateController,
  pixel,
} from './define.js';
import {PEOPLE, useLayeredPreflight, type Person} from './table-test-helpers.js';
import type {TableColumn} from './table.types.js';
import type {TctTable} from './tct-table.js';

beforeAll(useLayeredPreflight);

const parity = Object.values(
  import.meta.glob<{entries: Record<string, {keyboard: KeyboardRow[]}>}>('./parity.json', {
    eager: true,
    import: 'default',
  }),
)[0]!;

const COLUMNS: TableColumn<Person>[] = [
  {key: 'name', header: 'Name', sortable: true, width: pixel(200)},
  {key: 'role', header: 'Role', sortable: true, width: pixel(160)},
  {key: 'age', header: 'Age', width: pixel(100)},
];

interface Kitchen {
  table: TctTable<Person>;
  sort: TableSortableStateController<Person>;
  selection: TableSelectionStateController<Person>;
  expanded: Set<string>;
  expansion: TableRowExpansionController<Person>;
}

const kitchens = new WeakMap<HTMLElement, Kitchen>();

/** A table with sorting, selection, row expansion and column resizing: every keyboard-operable part. */
async function configure(element: HTMLElement, options: {narrow?: boolean} = {}): Promise<Kitchen> {
  const table = element as TctTable<Person>;
  const sort = new TableSortableStateController<Person>(table, {data: PEOPLE});
  const selection = new TableSelectionStateController<Person>(table, {data: PEOPLE, idKey: 'id'});
  const expanded = new Set<string>();
  const expansion: TableRowExpansionController<Person> = new TableRowExpansionController<Person>(
    table,
    {
      get expandedKeys() {
        return expanded;
      },
      onToggle: (key) => {
        if (!expanded.delete(key)) expanded.add(key);
        expansion.refresh();
      },
      getRowKey: (item) => item.id,
      renderExpanded: (item) => `Details ${item.name}`,
    },
  );
  sort.subscribe(() => {
    table.data = sort.sortedData;
  });
  Object.assign(table, {
    data: sort.sortedData,
    columns: options.narrow ? COLUMNS.map((column) => ({...column, width: pixel(400)})) : COLUMNS,
    idKey: 'id',
    plugins: {
      sort: new TableSortableController<Person>(table, sort.sortConfig),
      selection: new TableSelectionController<Person>(table, selection.selectionConfig),
      expansion,
      resize: new TableColumnResizeController<Person>(table, {minWidth: 100}),
    },
  });
  const kitchen = {table, sort, selection, expanded, expansion};
  kitchens.set(element, kitchen);
  await table.updateComplete;
  return kitchen;
}

const sortButton = (table: Element, key: string): HTMLButtonElement =>
  table.querySelector<HTMLButtonElement>(
    `thead th[data-column-key="${key}"] button.tct-table-sort`,
  )!;
const handle = (table: Element, key: string): HTMLElement =>
  table.querySelector<HTMLElement>(`.tct-table-resize-handle[data-column-key="${key}"]`)!;
const widthOf = (table: Element, key: string): number =>
  table.querySelector(`thead th[data-column-key="${key}"]`)!.getBoundingClientRect().width;

const sortStep = (keys: string): KeyboardStep => ({
  setup: async (element) => {
    await configure(element);
  },
  focus: (element) => sortButton(element, 'name'),
  keys: [keys],
  expect: ({element}) => {
    expect(kitchens.get(element)!.sort.sort).toEqual([{sortKey: 'name', direction: 'ascending'}]);
    expect(
      element.querySelector('thead th[data-column-key="name"]')!.getAttribute('aria-sort'),
    ).toBe('ascending');
  },
});

const resizeStep = (
  keys: string,
  rtlKeys: string,
  expected: (before: number, after: number) => void,
): KeyboardStep => ({
  setup: async (element) => {
    await configure(element);
    await (element as TctTable<Person>).updateComplete;
    (element as TctTable<Person>).dataset.before = String(widthOf(element, 'role'));
  },
  focus: (element) => handle(element, 'role'),
  keys: [keys],
  expect: async ({element}) => {
    await (element as TctTable<Person>).updateComplete;
    expected(Number(element.dataset.before), widthOf(element, 'role'));
  },
  rtl: {keys: [rtlKeys]},
});

runKeyboardSuite({
  tag: 'tct-table',
  render: () => '<tct-table></tct-table>',
  table: parity.entries['core.table']!.keyboard,
  steps: {
    'Moves focus to the next control in the table (sort buttons, checkboxes, expanders, resize handles) in reading order; the table itself has no arrow-key grid model':
      {
        setup: async (element) => {
          await configure(element);
        },
        focus: (element) => sortButton(element, 'name'),
        keys: ['Tab'],
        expect: ({element}) => {
          // The resize handle of the name column follows its sort button in the same header cell.
          expect(deepActiveElement()).toBe(handle(element, 'name'));
        },
      },
    'Moves focus back to the previous control': {
      setup: async (element) => {
        await configure(element);
      },
      focus: (element) => handle(element, 'name'),
      keys: ['Shift+Tab'],
      expect: ({element}) => {
        expect(deepActiveElement()).toBe(sortButton(element, 'name'));
      },
    },
    'Sorts by the column of the focused sort button: ascending, then descending, then unsorted (when unsorted is allowed)':
      sortStep('Enter'),
    'Sorts like Enter': sortStep('Space'),
    "Toggles the focused row's checkbox (the header checkbox selects or clears every row)": {
      setup: async (element) => {
        await configure(element);
      },
      focus: (element) =>
        element
          .querySelector('tbody tct-checkbox-input')!
          .shadowRoot!.querySelector<HTMLElement>('input'),
      keys: ['Space'],
      expect: ({element}) => {
        expect(kitchens.get(element)!.selection.selectedKeys.size).toBe(1);
      },
    },
    'Expands or collapses the row, group or tree branch of the focused chevron button': {
      setup: async (element) => {
        await configure(element);
      },
      focus: (element) => element.querySelector<HTMLElement>('tbody button.tct-table-expander'),
      keys: ['Enter'],
      expect: async ({element}) => {
        await (element as TctTable<Person>).updateComplete;
        expect(kitchens.get(element)!.expanded.size).toBe(1);
        expect(element.querySelectorAll('tr.tct-table-detail-row')).toHaveLength(1);
      },
    },
    'Expands or collapses like Enter': {
      setup: async (element) => {
        await configure(element);
      },
      focus: (element) => element.querySelector<HTMLElement>('tbody button.tct-table-expander'),
      keys: ['Space'],
      expect: async ({element}) => {
        await (element as TctTable<Person>).updateComplete;
        expect(kitchens.get(element)!.expanded.size).toBe(1);
      },
    },
    'Widens the column by 10 px (visual direction: narrows in right-to-left)': resizeStep(
      'ArrowRight',
      'ArrowLeft',
      (before, after) => {
        expect(after).toBeCloseTo(before + 10, 0);
      },
    ),
    'Narrows the column by 10 px (visual direction: widens in right-to-left)': resizeStep(
      'ArrowLeft',
      'ArrowRight',
      (before, after) => {
        expect(after).toBeCloseTo(before - 10, 0);
      },
    ),
    'Changes the width by 50 px': resizeStep(
      'Shift+ArrowRight',
      'Shift+ArrowLeft',
      (before, after) => {
        expect(after).toBeCloseTo(before + 50, 0);
      },
    ),
    'Sets the column to its minimum width': {
      setup: async (element) => {
        await configure(element);
        await (element as TctTable<Person>).updateComplete;
      },
      focus: (element) => handle(element, 'role'),
      keys: ['Home'],
      expect: ({element}) => {
        expect(widthOf(element, 'role')).toBeCloseTo(100, 0);
      },
    },
    'Opens the row or cell actions (context menu) at the focused control': {
      setup: async (element) => {
        await configure(element);
      },
      focus: (element) => element.querySelector<HTMLElement>('tbody button.tct-table-expander'),
      keys: ['ContextMenu'],
      expect: async ({element}) => {
        const menu = element.querySelector('tct-context-menu')!;
        await waitUntil(() => menu.open, 'context menu opens from the keyboard');
        await aTimeout(50);
        expect(
          menu.shadowRoot!.querySelector('tct-dropdown-menu-item')!.getAttribute('label'),
        ).toBe('Expand row');
      },
    },
    'Opens the row or cell actions like ContextMenu': {
      setup: async (element) => {
        await configure(element);
      },
      focus: (element) => element.querySelector<HTMLElement>('tbody button.tct-table-expander'),
      keys: ['Shift+F10'],
      expect: async ({element}) => {
        const menu = element.querySelector('tct-context-menu')!;
        await waitUntil(() => menu.open, 'context menu opens from Shift+F10');
      },
    },
    'Scrolls the region sideways while the columns overflow (the region is a tab stop only then)': {
      setup: async (element) => {
        element.style.display = 'block';
        element.style.inlineSize = '420px';
        await configure(element, {narrow: true});
        await (element as TctTable<Person>).updateComplete;
        await waitUntil(() => (element as TctTable<Person>).scrollable, 'columns overflow');
      },
      focus: (element) => (element as TctTable<Person>).scrollRegion,
      keys: ['ArrowRight'],
      expect: ({element}) => {
        expect(Math.abs((element as TctTable<Person>).scrollRegion!.scrollLeft)).toBeGreaterThan(0);
      },
      // Scroll offsets are negative in a right-to-left region, and the visual arrows are unchanged.
      rtl: {keys: ['ArrowLeft']},
    },
  },
});
