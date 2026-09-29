/**
 * Selection (useTableSelection, useTableSelectionState): the checkbox column, select-all and the
 * indeterminate state, row highlight and aria-selected, and the state controller's rules for disabled,
 * non-selectable and filtered rows.
 */
import {beforeAll, describe, expect, it, vi} from 'vitest';
import {userEvent} from 'vitest/browser';
import {axNode, expectAccessible} from '@tecton-wc/testing/a11y.js';
import {fixture} from '@tecton-wc/testing/fixture.js';
import {deepActiveElement, pressKeys} from '@tecton-wc/testing/keyboard.js';
import {waitUntil} from '@tecton-wc/testing/timing.js';
import './define.js';
import {TableSelectionController, TableSelectionStateController} from './define.js';
import {
  PEOPLE,
  PERSON_COLUMNS,
  bodyText,
  useLayeredPreflight,
  type Person,
} from './table-test-helpers.js';
import type {TctTable} from './tct-table.js';

beforeAll(useLayeredPreflight);

interface Harness {
  table: TctTable<Person>;
  state: TableSelectionStateController<Person>;
  plugin: TableSelectionController<Person>;
  changes: Set<string>[];
}

async function make(
  options: {
    data?: Person[];
    selected?: string[];
    disabled?: string[];
    unselectable?: string[];
    controlled?: boolean;
    noRowHighlight?: boolean;
    named?: boolean;
    dir?: 'rtl';
    lang?: string;
  } = {},
): Promise<Harness> {
  const root = await fixture<HTMLElement>(
    `<div ${options.dir ? `dir="${options.dir}"` : ''} ${options.lang ? `lang="${options.lang}"` : ''}><tct-table></tct-table></div>`,
  );
  const table = root.querySelector<TctTable<Person>>('tct-table')!;
  const changes: Set<string>[] = [];
  const data = options.data ?? PEOPLE;
  const state = new TableSelectionStateController<Person>(table, {
    data,
    idKey: 'id',
    ...(options.controlled
      ? {selectedKeys: new Set(options.selected ?? [])}
      : {defaultSelectedKeys: options.selected ?? []}),
    getIsItemEnabled: (item) => !options.disabled?.includes(item.id),
    getIsItemSelectable: (item) => !options.unselectable?.includes(item.id),
    getRowLabel: options.named ? (item) => item.name : undefined,
    noRowHighlight: options.noRowHighlight,
    onSelectedKeysChange: (next) => {
      changes.push(next);
      if (options.controlled) state.selectedKeys = next;
    },
  });
  const plugin = new TableSelectionController<Person>(table, state.selectionConfig);
  Object.assign(table, {data, columns: PERSON_COLUMNS, idKey: 'id', plugins: {selection: plugin}});
  await table.updateComplete;
  return {table, state, plugin, changes};
}

const rowBoxes = (table: Element): HTMLElement[] => [
  ...table.querySelectorAll<HTMLElement>('tbody tct-checkbox-input'),
];
const headerBox = (table: Element): HTMLElement =>
  table.querySelector<HTMLElement>('thead tct-checkbox-input')!;
const input = (box: HTMLElement): HTMLInputElement =>
  box.shadowRoot!.querySelector<HTMLInputElement>('input')!;
const checked = (box: HTMLElement): boolean => (box as unknown as {checked: boolean}).checked;
const selectedRows = (table: Element): string[] =>
  [...table.querySelectorAll('tbody tr[aria-selected="true"]')].map((row) =>
    row.querySelectorAll('td')[1]!.textContent.trim(),
  );

describe('table selection plugin (useTableSelection.test.tsx)', () => {
  it('renders a selection checkbox in the header and in every body row', async () => {
    const {table} = await make();
    expect(table.querySelectorAll('thead tct-checkbox-input')).toHaveLength(1);
    expect(rowBoxes(table)).toHaveLength(4);
    expect(table.querySelectorAll('thead th')).toHaveLength(4);
    expect(table.querySelector('tbody tr')!.querySelectorAll('td')).toHaveLength(4);
    expect(table.querySelector('thead th')!.getAttribute('data-column-key')).toBe(
      '__tct_selection',
    );
  });

  it('names the header checkbox "Select all rows" and the rows "Select row"', async () => {
    const {table} = await make();
    expect(headerBox(table).getAttribute('label')).toBe('Select all rows');
    expect(rowBoxes(table).map((box) => box.getAttribute('label'))).toEqual(
      Array<string>(4).fill('Select row'),
    );
    expect((await axNode(input(rowBoxes(table)[0]!))).name).toBe('Select row');
  });

  it('derives per-row names from getRowLabel and keeps the header name', async () => {
    const {table} = await make({named: true});
    expect(rowBoxes(table).map((box) => box.getAttribute('label'))).toEqual([
      'Select Alice Chen',
      'Select Bob Smith',
      'Select Carol Wu',
      'Select Dmitri Volkov',
    ]);
    expect(headerBox(table).getAttribute('label')).toBe('Select all rows');
  });

  it('toggles a row on and off from its checkbox', async () => {
    const {table, changes} = await make();
    await userEvent.click(rowBoxes(table)[1]!);
    await table.updateComplete;
    expect([...changes.at(-1)!]).toEqual(['p2']);
    expect(checked(rowBoxes(table)[1]!)).toBe(true);
    expect(selectedRows(table)).toEqual(['Bob Smith']);
    await userEvent.click(rowBoxes(table)[1]!);
    await table.updateComplete;
    expect(changes.at(-1)!.size).toBe(0);
    expect(selectedRows(table)).toEqual([]);
  });

  it('selects and deselects every row from the header checkbox', async () => {
    const {table, changes} = await make();
    await userEvent.click(headerBox(table));
    await table.updateComplete;
    expect(changes.at(-1)!.size).toBe(4);
    expect(rowBoxes(table).every(checked)).toBe(true);
    expect(checked(headerBox(table))).toBe(true);
    await userEvent.click(headerBox(table));
    await table.updateComplete;
    expect(changes.at(-1)!.size).toBe(0);
    expect(rowBoxes(table).some(checked)).toBe(false);
  });

  it('shows the header checkbox indeterminate when some rows are selected', async () => {
    const {table, state} = await make();
    expect((headerBox(table) as unknown as {indeterminate: boolean}).indeterminate).toBe(false);
    await userEvent.click(rowBoxes(table)[0]!);
    await table.updateComplete;
    expect((headerBox(table) as unknown as {indeterminate: boolean}).indeterminate).toBe(true);
    expect(checked(headerBox(table))).toBe(false);
    expect(input(headerBox(table)).indeterminate).toBe(true);
    expect((await axNode(input(headerBox(table)))).checked).toBe('mixed');
    state.selectAll();
    await table.updateComplete;
    expect((headerBox(table) as unknown as {indeterminate: boolean}).indeterminate).toBe(false);
    expect(checked(headerBox(table))).toBe(true);
    expect((await axNode(input(headerBox(table)))).checked).toBe('true');
  });

  it('hides the checkbox of non-selectable rows and disables the checkbox of disabled rows', async () => {
    const {table} = await make({unselectable: ['p2'], disabled: ['p3']});
    const rows = [...table.querySelectorAll('tbody tr')];
    expect(rows[1]!.querySelector('tct-checkbox-input')).toBeNull();
    expect(rows[2]!.querySelector('tct-checkbox-input')!.hasAttribute('disabled')).toBe(true);
    expect(rows[0]!.querySelector('tct-checkbox-input')!.hasAttribute('disabled')).toBe(false);
  });

  describe('row state', () => {
    it('sets aria-selected and the selected fill on checked rows only', async () => {
      const {table} = await make({selected: ['p1', 'p3']});
      const rows = [...table.querySelectorAll('tbody tr')];
      expect(rows.map((row) => row.getAttribute('aria-selected'))).toEqual([
        'true',
        null,
        'true',
        null,
      ]);
      const fill = (row: Element): string => getComputedStyle(row).backgroundColor;
      expect(fill(rows[0]!)).not.toBe(fill(rows[1]!));
      expect(fill(rows[0]!)).toBe(fill(rows[2]!));
    });

    it('keeps aria-selected but drops the fill with noRowHighlight, and returns it when turned off', async () => {
      const {table, plugin} = await make({selected: ['p1'], noRowHighlight: true});
      const row = table.querySelector('tbody tr')!;
      expect(row.getAttribute('aria-selected')).toBe('true');
      expect(row.classList.contains('tct-table-selected')).toBe(false);
      plugin.config = {
        ...plugin.config,
        get noRowHighlight() {
          return false;
        },
      };
      await table.updateComplete;
      expect(table.querySelector('tbody tr')!.classList.contains('tct-table-selected')).toBe(true);
    });

    it('never paints unchecked rows and publishes the row overlay for pinned cells', async () => {
      const {table} = await make({selected: ['p2']});
      const rows = [...table.querySelectorAll('tbody tr')];
      expect(rows[0]!.classList.contains('tct-table-selected')).toBe(false);
      expect(getComputedStyle(rows[1]!).getPropertyValue('--_table-row-overlay').trim()).not.toBe(
        '',
      );
      expect(getComputedStyle(rows[0]!).getPropertyValue('--_table-row-overlay').trim()).toBe('');
    });
  });

  it('rebuilds only the rows whose selection changed', async () => {
    let calls = 0;
    const {table} = await make();
    table.columns = PERSON_COLUMNS.map((column, index) =>
      index === 0 ? {...column, renderCell: (item: Person) => ((calls += 1), item.name)} : column,
    );
    await table.updateComplete;
    const initial = calls;
    expect(initial).toBe(4);
    await userEvent.click(rowBoxes(table)[2]!);
    await table.updateComplete;
    expect(calls - initial).toBe(1);
  });

  it('is operable from the keyboard: Space toggles the focused checkbox', async () => {
    const {table, changes} = await make();
    input(rowBoxes(table)[0]!).focus();
    await pressKeys(' ');
    await table.updateComplete;
    expect([...changes.at(-1)!]).toEqual(['p1']);
    expect(deepActiveElement()).toBe(input(rowBoxes(table)[0]!));
  });

  it('keeps focus on the checkbox through the re-render', async () => {
    const {table} = await make();
    input(rowBoxes(table)[1]!).focus();
    await pressKeys(' ');
    await table.updateComplete;
    expect(deepActiveElement()).toBe(input(rowBoxes(table)[1]!));
  });

  it('passes axe unselected, partly selected, all selected, with disabled rows and in RTL', async () => {
    const {table, state} = await make({named: true, disabled: ['p4'], unselectable: ['p3']});
    await expectAccessible(table);
    await userEvent.click(rowBoxes(table)[0]!);
    await table.updateComplete;
    await expectAccessible(table);
    state.selectAll();
    await table.updateComplete;
    await expectAccessible(table);
    const rtl = await make({dir: 'rtl', selected: ['p1']});
    await expectAccessible(rtl.table);
  });

  it('localises the checkbox names in de-DE', async () => {
    const {table} = await make({lang: 'de-DE'});
    await waitUntil(
      () => headerBox(table).getAttribute('label') === 'Alle Zeilen auswählen',
      'de-DE catalog',
    );
    expect(rowBoxes(table)[0]!.getAttribute('label')).toBe('Zeile auswählen');
  });

  it('sits first in RTL too (inline-start) and keeps rows in order', async () => {
    const {table} = await make({dir: 'rtl'});
    const header = table.querySelector('thead th')!.getBoundingClientRect();
    const second = table.querySelectorAll('thead th')[1]!.getBoundingClientRect();
    expect(header.left).toBeGreaterThan(second.left);
    expect(bodyText(table).map((row) => row[1])).toEqual(PEOPLE.map((p) => p.name));
  });
});

describe('TableSelectionStateController (useTableSelectionState.test.tsx)', () => {
  const rows: Person[] = [
    {id: 'a', name: 'A', role: '', age: 1},
    {id: 'b', name: 'B', role: '', age: 2},
    {id: 'c', name: 'C', role: '', age: 3},
    {id: 'd', name: 'D', role: '', age: 4},
  ];

  it('select-all selects only enabled items and never disabled ones', () => {
    const state = new TableSelectionStateController<Person>(null, {
      data: rows,
      idKey: 'id',
      getIsItemEnabled: (item) => item.id !== 'b',
    });
    state.selectionConfig.onSelectAll({isAllSelected: true});
    expect([...state.selectedKeys].sort()).toEqual(['a', 'c', 'd']);
  });

  it('select-all keeps a disabled-but-selected item, and deselect-all does too', () => {
    const state = new TableSelectionStateController<Person>(null, {
      data: rows,
      idKey: 'id',
      defaultSelectedKeys: ['b'],
      getIsItemEnabled: (item) => item.id !== 'b',
    });
    state.selectionConfig.onSelectAll({isAllSelected: true});
    expect([...state.selectedKeys].sort()).toEqual(['a', 'b', 'c', 'd']);
    state.selectionConfig.onSelectAll({isAllSelected: false});
    expect([...state.selectedKeys]).toEqual(['b']);
  });

  it('leaves non-selectable items out of select-all and deselect-all', () => {
    const state = new TableSelectionStateController<Person>(null, {
      data: rows,
      idKey: 'id',
      defaultSelectedKeys: ['c'],
      getIsItemSelectable: (item) => item.id !== 'c',
    });
    state.selectionConfig.onSelectAll({isAllSelected: true});
    expect([...state.selectedKeys].sort()).toEqual(['a', 'b', 'c', 'd']);
    state.selectionConfig.onSelectAll({isAllSelected: false});
    expect([...state.selectedKeys]).toEqual(['c']);
  });

  it('reports all-selected and indeterminate for the header', () => {
    const state = new TableSelectionStateController<Person>(null, {data: rows, idKey: 'id'});
    const config = state.selectionConfig;
    expect(config.getIsAllSelected()).toBe(false);
    expect(config.getIsIndeterminate!()).toBe(false);
    config.onSelectItem({item: rows[0]!, isSelected: true});
    expect(config.getIsIndeterminate!()).toBe(true);
    expect(config.getIsAllSelected()).toBe(false);
    config.onSelectAll({isAllSelected: true});
    expect(config.getIsAllSelected()).toBe(true);
    expect(config.getIsIndeterminate!()).toBe(false);
  });

  describe('with filtered data (#3591)', () => {
    it('select-all only selects the visible rows and keeps selections made elsewhere', () => {
      const state = new TableSelectionStateController<Person>(null, {
        data: rows,
        idKey: 'id',
        defaultSelectedKeys: ['a'],
      });
      state.data = rows.slice(2);
      state.selectionConfig.onSelectAll({isAllSelected: true});
      expect([...state.selectedKeys].sort()).toEqual(['a', 'c', 'd']);
      state.selectionConfig.onSelectAll({isAllSelected: false});
      expect([...state.selectedKeys]).toEqual(['a']);
    });

    it('is not all-selected when the filter matches nothing, whatever the selection', () => {
      const state = new TableSelectionStateController<Person>(null, {
        data: rows,
        idKey: 'id',
        defaultSelectedKeys: ['a', 'b'],
      });
      state.data = [];
      expect(state.selectionConfig.getIsAllSelected()).toBe(false);
      expect(state.selectionConfig.getIsIndeterminate!()).toBe(false);
    });

    it('restores the selections of every view when the filter is cleared', () => {
      const state = new TableSelectionStateController<Person>(null, {
        data: rows.slice(2),
        idKey: 'id',
        defaultSelectedKeys: ['a', 'c'],
      });
      state.data = rows;
      expect([...state.selectedKeys].sort()).toEqual(['a', 'c']);
      expect(state.selectionConfig.getIsItemSelected(rows[0]!)).toBe(true);
    });
  });

  it('owns the selection uncontrolled, follows a controlled one, and calls onSelectedKeysChange', () => {
    const onChange = vi.fn();
    const uncontrolled = new TableSelectionStateController<Person>(null, {
      data: rows,
      idKey: (item) => item.id,
      onSelectedKeysChange: onChange,
    });
    uncontrolled.selectionConfig.onSelectItem({item: rows[1]!, isSelected: true});
    expect([...uncontrolled.selectedKeys]).toEqual(['b']);
    expect(onChange).toHaveBeenCalledTimes(1);
    const controlled = new TableSelectionStateController<Person>(null, {
      data: rows,
      idKey: 'id',
      selectedKeys: new Set(),
      onSelectedKeysChange: onChange,
    });
    controlled.selectionConfig.onSelectItem({item: rows[1]!, isSelected: true});
    expect(controlled.selectedKeys.size).toBe(0);
    expect(onChange).toHaveBeenCalledTimes(2);
    expect([...onChange.mock.calls[1]![0]]).toEqual(['b']);
  });

  it('notifies subscribers and hosts on every change, and never mutates the previous set', () => {
    const state = new TableSelectionStateController<Person>(null, {data: rows, idKey: 'id'});
    const listener = vi.fn();
    state.subscribe(listener);
    const before = state.selectedKeys;
    state.selectionConfig.onSelectItem({item: rows[0]!, isSelected: true});
    expect(listener).toHaveBeenCalledTimes(1);
    expect(before.size).toBe(0);
    state.clear();
    expect(state.selectedKeys.size).toBe(0);
  });
});
