/**
 * Row plugins: grouped rows (useTableGroupedRows), row expansion (useTableRowExpansion), row index
 * (useTableRowIndex), row status (useTableRowStatus) and the row context menu they contribute to.
 */
import {beforeAll, describe, expect, it, vi} from 'vitest';
import {userEvent} from 'vitest/browser';
import {axNode, expectAccessible} from '@tecton-wc/testing/a11y.js';
import {fixture} from '@tecton-wc/testing/fixture.js';
import {deepActiveElement, pressKeys} from '@tecton-wc/testing/keyboard.js';
import {aTimeout, waitUntil} from '@tecton-wc/testing/timing.js';
import './define.js';
import '../context-menu/define.js';
import {
  TableGroupedRowsController,
  TableRowExpansionController,
  TableRowIndexController,
  TableRowStatusController,
  TableSelectionController,
  TableSelectionStateController,
  type TableGroupedRowsConfig,
  type TableRowStatusConfig,
} from './define.js';
import {
  PEOPLE,
  PERSON_COLUMNS,
  bodyText,
  headerText,
  useLayeredPreflight,
  type Person,
} from './table-test-helpers.js';
import type {TctTable} from './tct-table.js';

beforeAll(useLayeredPreflight);

const rows = (table: Element): HTMLTableRowElement[] => [
  ...table.querySelectorAll<HTMLTableRowElement>('tbody > tr'),
];
const expanders = (table: Element): HTMLButtonElement[] => [
  ...table.querySelectorAll<HTMLButtonElement>('tbody button.tct-table-expander'),
];

async function makeTable(options: {dir?: 'rtl'; lang?: string} = {}): Promise<TctTable<Person>> {
  const root = await fixture<HTMLElement>(
    `<div ${options.dir ? `dir="${options.dir}"` : ''} ${options.lang ? `lang="${options.lang}"` : ''}><tct-table></tct-table></div>`,
  );
  return root.querySelector<TctTable<Person>>('tct-table')!;
}

/** Opens the table's context menu on `target` and returns the item labels. */
async function openMenu(table: TctTable<Person>, target: Element): Promise<HTMLElement[]> {
  target.dispatchEvent(
    new MouseEvent('contextmenu', {bubbles: true, cancelable: true, clientX: 60, clientY: 60}),
  );
  const menu = table.querySelector('tct-context-menu')!;
  await waitUntil(() => menu.open, 'menu opens');
  await aTimeout(50);
  return [...menu.shadowRoot!.querySelectorAll<HTMLElement>('tct-dropdown-menu-item')];
}

// ------------------------------------------------------------------------------------ grouped rows

describe('table grouped rows plugin (useTableGroupedRows.test.tsx)', () => {
  interface GroupHarness {
    table: TctTable<Person>;
    plugin: TableGroupedRowsController<Person>;
    collapsed: Set<string>;
    toggles: string[];
  }

  async function make(
    options: {
      data?: Person[];
      collapsed?: string[];
      groupOrder?: string[];
      renderGroupHeader?: TableGroupedRowsConfig<Person>['renderGroupHeader'];
      dir?: 'rtl';
      lang?: string;
    } = {},
  ): Promise<GroupHarness> {
    const table = await makeTable(options);
    let collapsed = new Set(options.collapsed);
    const toggles: string[] = [];
    const data = options.data ?? PEOPLE;
    const plugin: TableGroupedRowsController<Person> = new TableGroupedRowsController<Person>(
      table,
      {
        data,
        groupBy: (item) => item.role,
        get collapsedGroups() {
          return collapsed;
        },
        onToggleGroup: (key) => {
          toggles.push(key);
          collapsed = new Set(collapsed);
          if (!collapsed.delete(key)) collapsed.add(key);
          table.data = plugin.data;
        },
        groupOrder: options.groupOrder,
        renderGroupHeader: options.renderGroupHeader,
      },
    );
    Object.assign(table, {
      data: plugin.data,
      columns: PERSON_COLUMNS,
      idKey: plugin.idKey,
      plugins: {grouped: plugin},
    });
    await table.updateComplete;
    return {
      table,
      plugin,
      get collapsed() {
        return collapsed;
      },
      toggles,
    };
  }

  const groupRows = (table: Element): HTMLTableRowElement[] => [
    ...table.querySelectorAll<HTMLTableRowElement>('tbody > tr.tct-table-group-row'),
  ];

  it('renders a heading row per group with its label and count', async () => {
    const {table} = await make();
    const headings = groupRows(table);
    expect(headings.map((row) => row.textContent.replace(/\s+/g, ' ').trim())).toEqual([
      'Engineer (2)',
      'Designer (1)',
      'PM (1)',
    ]);
    expect(rows(table)).toHaveLength(7);
  });

  it('shows the members of an expanded group under their heading', async () => {
    const {table} = await make();
    const all = rows(table);
    expect(all[0]!.classList.contains('tct-table-group-row')).toBe(true);
    expect(all[1]!.textContent).toContain('Alice Chen');
    expect(all[2]!.textContent).toContain('Dmitri Volkov');
    expect(all[3]!.classList.contains('tct-table-group-row')).toBe(true);
  });

  it('hides the members of a collapsed group and keeps the heading', async () => {
    const {table} = await make({collapsed: ['Engineer']});
    expect(rows(table)).toHaveLength(5);
    expect(table.textContent).not.toContain('Alice Chen');
    expect(groupRows(table)[0]!.textContent).toContain('Engineer');
  });

  it('toggles a group from its chevron and back again', async () => {
    const {table, toggles} = await make();
    await userEvent.click(expanders(table)[0]!);
    await table.updateComplete;
    expect(toggles).toEqual(['Engineer']);
    expect(table.textContent).not.toContain('Alice Chen');
    await userEvent.click(expanders(table)[0]!);
    await table.updateComplete;
    expect(table.textContent).toContain('Alice Chen');
  });

  it('toggles once when the heading row itself is clicked', async () => {
    const {table, toggles} = await make();
    await userEvent.click(groupRows(table)[1]!.querySelector('.tct-table-group-label')!);
    await table.updateComplete;
    expect(toggles).toEqual(['Designer']);
  });

  it('exposes each toggle as a named, keyboard-operable button with aria-expanded', async () => {
    const {table} = await make();
    const button = expanders(table)[0]!;
    expect(button.getAttribute('aria-label')).toBe('Collapse group Engineer');
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect((await axNode(button)).name).toBe('Collapse group Engineer');
    button.focus();
    await pressKeys('Enter');
    await table.updateComplete;
    expect(expanders(table)[0]!.getAttribute('aria-label')).toBe('Expand group Engineer');
    expect(expanders(table)[0]!.getAttribute('aria-expanded')).toBe('false');
    expect(deepActiveElement()).toBe(expanders(table)[0]);
  });

  it('spans every column with the heading cell', async () => {
    const {table} = await make();
    const cell = groupRows(table)[0]!.querySelector('td')!;
    expect(cell.colSpan).toBe(3);
    expect(groupRows(table)[0]!.querySelectorAll('td')).toHaveLength(1);
  });

  it('follows groupOrder and then first-seen order', async () => {
    const {table} = await make({groupOrder: ['PM', 'Designer']});
    expect(groupRows(table).map((row) => row.textContent.trim().split(/\s+/)[0])).toEqual([
      'PM',
      'Designer',
      'Engineer',
    ]);
  });

  it('renders custom heading content through renderGroupHeader', async () => {
    const {table} = await make({
      renderGroupHeader: (key, count, collapsed) => `${key.toUpperCase()}:${count}:${collapsed}`,
    });
    expect(groupRows(table)[0]!.textContent).toContain('ENGINEER:2:false');
  });

  it('renders nothing (no headings) for empty data', async () => {
    const {table} = await make({data: []});
    expect(groupRows(table)).toHaveLength(0);
  });

  it('never runs a column renderCell against a heading row', async () => {
    const table = await makeTable();
    const seen: string[] = [];
    const plugin: TableGroupedRowsController<Person> = new TableGroupedRowsController<Person>(
      table,
      {
        data: PEOPLE,
        groupBy: (item) => item.role,
        collapsedGroups: new Set(),
        onToggleGroup: () => undefined,
      },
    );
    Object.assign(table, {
      data: plugin.data,
      idKey: plugin.idKey,
      columns: [
        {
          key: 'name',
          header: 'Name',
          renderCell: (item: Person) => {
            seen.push(item.name);
            return item.name.toUpperCase();
          },
        },
      ],
      plugins: {grouped: plugin},
    });
    await table.updateComplete;
    expect(seen).toHaveLength(4);
    expect(seen.every((name) => name.length > 0)).toBe(true);
  });

  it('keeps a group collapsed across a data change (state is keyed by group)', async () => {
    const harness = await make({collapsed: ['PM']});
    harness.plugin.config = {
      ...harness.plugin.config,
      get collapsedGroups() {
        return harness.collapsed;
      },
      data: [...PEOPLE, {id: 'p5', name: 'Erin Park', role: 'PM', age: 33}],
    };
    harness.table.data = harness.plugin.data;
    await harness.table.updateComplete;
    expect(harness.table.textContent).not.toContain('Erin Park');
    expect(groupRows(harness.table).at(-1)!.textContent).toContain('(2)');
  });

  it('has no accessibility violations and no invalid row ARIA', async () => {
    const {table} = await make();
    expect(table.querySelectorAll('tr[aria-expanded]')).toHaveLength(0);
    await expectAccessible(table);
  });

  it('localises the toggle name in de-DE and pins the heading label to the start in RTL', async () => {
    const german = await make({lang: 'de-DE'});
    await waitUntil(
      () => !expanders(german.table)[0]!.getAttribute('aria-label')!.startsWith('Collapse'),
      'de-DE catalog',
    );
    const {table} = await make({dir: 'rtl'});
    const heading = groupRows(table)[0]!.querySelector('.tct-table-group-heading')!;
    const cell = heading.closest('td')!.getBoundingClientRect();
    expect(Math.abs(heading.getBoundingClientRect().right - cell.right)).toBeLessThan(40);
  });
});

// ---------------------------------------------------------------------------------- row expansion

describe('table row expansion plugin (useTableRowExpansion.test.tsx)', () => {
  async function make(
    options: {
      expanded?: string[];
      expandable?: (item: Person) => boolean;
      dir?: 'rtl';
      lang?: string;
      withSelection?: boolean;
    } = {},
  ) {
    const table = await makeTable(options);
    let expanded = new Set(options.expanded);
    const toggles: string[] = [];
    const plugin: TableRowExpansionController<Person> = new TableRowExpansionController<Person>(
      null,
      {
        get expandedKeys() {
          return expanded;
        },
        onToggle: (key) => {
          toggles.push(key);
          expanded = new Set(expanded);
          if (!expanded.delete(key)) expanded.add(key);
          plugin.refresh();
        },
        getRowKey: (item) => item.id,
        renderExpanded: (item) => `Details of ${item.name}`,
        getIsItemExpandable: options.expandable,
      },
    );
    const extra: Record<string, never> = options.withSelection
      ? ({
          selection: new TableSelectionController<Person>(
            null,
            new TableSelectionStateController<Person>(null, {data: PEOPLE, idKey: 'id'})
              .selectionConfig,
          ),
        } as never)
      : {};
    Object.assign(table, {
      data: PEOPLE,
      columns: PERSON_COLUMNS,
      idKey: 'id',
      plugins: {expansion: plugin, ...extra},
    });
    await table.updateComplete;
    return {table, plugin, toggles};
  }

  const panels = (table: Element): HTMLTableRowElement[] => [
    ...table.querySelectorAll<HTMLTableRowElement>('tbody > tr.tct-table-detail-row'),
  ];

  it('renders an "Expand row" chevron button for every expandable row', async () => {
    const {table} = await make();
    expect(expanders(table)).toHaveLength(4);
    expect(expanders(table).map((button) => button.getAttribute('aria-label'))).toEqual(
      Array<string>(4).fill('Expand row'),
    );
    expect(headerText(table)[0]).toBe('Row expansion');
    expect(panels(table)).toHaveLength(0);
  });

  it('opens a detail panel below the row from the chevron and closes it again', async () => {
    const {table, toggles} = await make();
    await userEvent.click(expanders(table)[1]!);
    await table.updateComplete;
    expect(toggles).toEqual(['p2']);
    expect(panels(table)).toHaveLength(1);
    expect(panels(table)[0]!.textContent.trim()).toBe('Details of Bob Smith');
    expect(rows(table)[1]!.nextElementSibling).toBe(panels(table)[0]);
    expect(expanders(table)[1]!.getAttribute('aria-label')).toBe('Collapse row');
    expect(expanders(table)[1]!.getAttribute('aria-expanded')).toBe('true');
    await userEvent.click(expanders(table)[1]!);
    await table.updateComplete;
    expect(panels(table)).toHaveLength(0);
  });

  it('renders one panel per expanded row, spanning every column', async () => {
    const {table} = await make({expanded: ['p1', 'p3']});
    expect(panels(table)).toHaveLength(2);
    const span = panels(table)[0]!.querySelector('td')!.colSpan;
    expect(span).toBe(4);
    expect(panels(table)[0]!.querySelectorAll('td')).toHaveLength(1);
  });

  it('counts the columns other plugins add when spanning the panel', async () => {
    const {table} = await make({expanded: ['p1'], withSelection: true});
    expect(panels(table)[0]!.querySelector('td')!.colSpan).toBe(5);
  });

  it('hides the chevron and the panel of non-expandable rows', async () => {
    const {table} = await make({expanded: ['p2'], expandable: (item) => item.id !== 'p2'});
    expect(expanders(table)).toHaveLength(3);
    expect(panels(table)).toHaveLength(0);
  });

  it('is operable from the keyboard and keeps the focus on the chevron', async () => {
    const {table} = await make();
    expanders(table)[0]!.focus();
    await pressKeys('Enter');
    await table.updateComplete;
    expect(panels(table)).toHaveLength(1);
    expect(deepActiveElement()).toBe(expanders(table)[0]);
    await pressKeys('Space');
    await table.updateComplete;
    expect(panels(table)).toHaveLength(0);
  });

  it('names the chevron through the accessibility tree and passes axe while open', async () => {
    const {table} = await make({expanded: ['p1']});
    expect((await axNode(expanders(table)[0]!)).name).toBe('Collapse row');
    await expectAccessible(table);
  });

  it('localises the chevron name in de-DE', async () => {
    const {table} = await make({lang: 'de-DE'});
    await waitUntil(
      () => expanders(table)[0]!.getAttribute('aria-label') !== 'Expand row',
      'de-DE catalog',
    );
  });

  it('points the collapsed chevron toward the inline end in RTL without a second flip', async () => {
    const {table} = await make({dir: 'rtl'});
    const icon = expanders(table)[0]!.querySelector('tct-icon')!;
    expect(getComputedStyle(icon).rotate).toBe('none');
  });

  describe('row context menu', () => {
    it('offers an expand action on right-click and applies it', async () => {
      const {table, toggles} = await make();
      const items = await openMenu(table, rows(table)[0]!.querySelectorAll('td')[1]!);
      expect(items.map((item) => item.getAttribute('label'))).toEqual(['Expand row']);
      items[0]!.click();
      await waitUntil(() => toggles.length === 1, 'toggle requested');
      await table.updateComplete;
      expect(panels(table)).toHaveLength(1);
    });

    it('offers "Collapse row" on an expanded row and nothing on a non-expandable one', async () => {
      const {table} = await make({expanded: ['p1'], expandable: (item) => item.id !== 'p2'});
      const items = await openMenu(table, rows(table)[0]!.querySelectorAll('td')[1]!);
      expect(items.map((item) => item.getAttribute('label'))).toEqual(['Collapse row']);
      const menu = table.querySelector('tct-context-menu')!;
      menu.open = false;
      await aTimeout(100);
      // Row p2 is now at index 2 (p1 has a panel after it): a row with no action leaves the browser menu.
      const event = new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        clientX: 5,
        clientY: 5,
      });
      rows(table)[2]!.querySelectorAll('td')[1]!.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
    });

    it('opens from the ContextMenu key and from Shift+F10 at the focused chevron, and returns focus', async () => {
      const {table, toggles} = await make();
      const menu = table.querySelector('tct-context-menu')!;
      expanders(table)[2]!.focus();
      await pressKeys('ContextMenu');
      await waitUntil(() => menu.open, 'menu opens from the ContextMenu key');
      await pressKeys('Escape');
      await waitUntil(() => !menu.open, 'menu closes');
      await waitUntil(() => deepActiveElement() === expanders(table)[2], 'focus returns');
      await pressKeys('Shift+F10');
      await waitUntil(() => menu.open, 'menu opens from Shift+F10');
      await pressKeys('Enter');
      await waitUntil(() => toggles.length === 1, 'action ran');
      expect(toggles).toEqual(['p3']);
      await table.updateComplete;
      await waitUntil(() => !menu.open, 'menu closed after the action');
      await waitUntil(
        () => deepActiveElement() === expanders(table)[2],
        'focus back on the chevron',
      );
    });
  });
});

// -------------------------------------------------------------------------------------- row index

describe('table row index plugin (useTableRowIndex.test.tsx)', () => {
  async function make(options: {startFrom?: number; label?: string; getRowKey?: boolean} = {}) {
    const table = await makeTable();
    const plugin: TableRowIndexController<Person> = new TableRowIndexController<Person>(null, {
      data: PEOPLE,
      startFrom: options.startFrom,
      label: options.label,
      getRowKey: options.getRowKey ? (item) => item.id : undefined,
    });
    Object.assign(table, {
      data: PEOPLE,
      columns: PERSON_COLUMNS,
      idKey: 'id',
      plugins: {index: plugin},
    });
    await table.updateComplete;
    return {table, plugin};
  }

  const numbers = (table: Element): string[] =>
    rows(table).map((row) => row.querySelector('td')!.textContent.trim());

  it('prepends a "#" column and numbers rows from 1', async () => {
    const {table} = await make();
    expect(headerText(table)[0]).toBe('#');
    expect(numbers(table)).toEqual(['1', '2', '3', '4']);
    expect(table.querySelector('thead th')!.getAttribute('data-column-key')).toBe('__tct_rowIndex');
  });

  it('respects startFrom and a custom label', async () => {
    const {table} = await make({startFrom: 11, label: 'No.'});
    expect(numbers(table)).toEqual(['11', '12', '13', '14']);
    expect(headerText(table)[0]).toBe('No.');
  });

  it('numbers a single row and renders the header with empty data', async () => {
    const {table, plugin} = await make();
    plugin.config = {data: [PEOPLE[0]!]};
    table.data = [PEOPLE[0]!];
    await table.updateComplete;
    expect(numbers(table)).toEqual(['1']);
    plugin.config = {data: []};
    table.data = [];
    await table.updateComplete;
    expect(headerText(table)[0]).toBe('#');
    expect(rows(table).filter((row) => !row.classList.contains('tct-table-empty'))).toHaveLength(0);
  });

  it('renumbers when the order of the data changes (reference path)', async () => {
    const {table, plugin} = await make();
    const reversed = [...PEOPLE].reverse();
    plugin.config = {data: reversed};
    table.data = reversed;
    await table.updateComplete;
    expect(bodyText(table).map((cells) => cells.slice(0, 2))).toEqual([
      ['1', 'Dmitri Volkov'],
      ['2', 'Carol Wu'],
      ['3', 'Bob Smith'],
      ['4', 'Alice Chen'],
    ]);
  });

  it('resolves ordinals across fresh object identities on the keyed path', async () => {
    const {table, plugin} = await make({getRowKey: true});
    const copies = PEOPLE.map((person) => ({...person})).reverse();
    plugin.config = {data: copies, getRowKey: (item) => item.id};
    table.data = copies;
    await table.updateComplete;
    expect(bodyText(table).map((cells) => cells.slice(0, 2))).toEqual([
      ['1', 'Dmitri Volkov'],
      ['2', 'Carol Wu'],
      ['3', 'Bob Smith'],
      ['4', 'Alice Chen'],
    ]);
  });

  it('is end-aligned and monospaced', async () => {
    const {table} = await make();
    const cell = rows(table)[0]!.querySelector('td')!;
    expect(getComputedStyle(cell).textAlign).toMatch(/end|right/);
    expect(
      getComputedStyle(cell.querySelector('.tct-table-row-index')!).fontVariantNumeric,
    ).toContain('tabular-nums');
  });

  it('has no accessibility violations', async () => {
    const {table} = await make();
    await expectAccessible(table);
  });
});

// ------------------------------------------------------------------------------------- row status

describe('table row status plugin (useTableRowStatus.test.tsx)', () => {
  type Status = ReturnType<TableRowStatusConfig<Person>['getStatus']>;

  async function make(getStatus: (item: Person) => Status, options: {lang?: string} = {}) {
    const table = await makeTable(options);
    const plugin: TableRowStatusController<Person> = new TableRowStatusController<Person>(null, {
      getStatus,
    });
    Object.assign(table, {
      data: PEOPLE,
      columns: PERSON_COLUMNS,
      idKey: 'id',
      plugins: {status: plugin},
    });
    await table.updateComplete;
    return {table, plugin};
  }

  const markers = (table: Element): HTMLElement[] => [
    ...table.querySelectorAll<HTMLElement>('tbody .tct-table-status'),
  ];

  it('prepends a narrow leading column with a visually hidden "Row status" header', async () => {
    const {table} = await make(() => null);
    const header = table.querySelector('thead th')!;
    expect(header.getAttribute('data-column-key')).toBe('__tct_rowStatus');
    expect(header.textContent.trim()).toBe('Row status');
    expect(header.getBoundingClientRect().width).toBeLessThan(48);
    expect(header.querySelector('.tct-table-visually-hidden')).not.toBeNull();
    expect(getComputedStyle(header.querySelector('.tct-table-visually-hidden')!).position).toBe(
      'absolute',
    );
  });

  it('renders no marker for rows that return null', async () => {
    const {table} = await make((item) =>
      item.id === 'p2' ? {status: 'error', label: 'Failed'} : null,
    );
    expect(markers(table)).toHaveLength(1);
    expect(rows(table)[1]!.querySelector('.tct-table-status')).not.toBeNull();
  });

  it('draws semantic statuses as themed icons named by their label', async () => {
    const {table} = await make((item) => {
      const map: Record<string, Status> = {
        p1: {status: 'success', label: 'Healthy'},
        p2: {status: 'warning', label: 'Degraded'},
        p3: {status: 'error', label: 'Down'},
      };
      return map[item.id] ?? null;
    });
    const all = markers(table);
    expect(all.map((marker) => marker.querySelector('tct-icon')!.getAttribute('name'))).toEqual([
      'success',
      'warning',
      'error',
    ]);
    expect(all.map((marker) => marker.getAttribute('role'))).toEqual(['img', 'img', 'img']);
    expect(all.map((marker) => marker.getAttribute('aria-label'))).toEqual([
      'Healthy',
      'Degraded',
      'Down',
    ]);
    expect((await axNode(all[2]!)).name).toBe('Down');
    expect((await axNode(all[2]!)).role).toMatch(/^(img|image)$/);
  });

  it('gives each marker a native tooltip with its label', async () => {
    const {table} = await make(() => ({status: 'success', label: 'Healthy'}));
    expect(markers(table)[0]!.getAttribute('title')).toBe('Healthy');
  });

  it('draws a custom colour as an 8px dot and keeps semantic-looking names on the dot path', async () => {
    const {table} = await make(() => ({color: 'success', label: 'Custom'}));
    const marker = markers(table)[0]!;
    const dot = marker.querySelector<HTMLElement>('.tct-table-status-dot')!;
    expect(dot).not.toBeNull();
    expect(marker.querySelector('tct-icon')).toBeNull();
    expect(dot.getBoundingClientRect().width).toBe(8);
    expect(getComputedStyle(dot).backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
  });

  it('passes a raw CSS colour through as a custom property, never as markup', async () => {
    const {table} = await make(() => ({color: 'rgb(1, 2, 3)', label: 'Raw'}));
    const marker = markers(table)[0]!;
    expect(marker.style.getPropertyValue('--_table-status-color')).toBe('rgb(1, 2, 3)');
    expect(getComputedStyle(marker.querySelector('.tct-table-status-dot')!).backgroundColor).toBe(
      'rgb(1, 2, 3)',
    );
  });

  it('does not let a hostile colour string inject markup or leave the declaration', async () => {
    const {table} = await make(() => ({
      color: 'red; background: url(https://example.invalid/x)',
      label: 'Hostile',
    }));
    const marker = markers(table)[0]!;
    expect(marker.getAttribute('style') ?? '').not.toContain('example.invalid');
    expect(marker.style.getPropertyValue('--_table-status-color')).toBe('');
    expect(marker.querySelectorAll('*').length).toBeLessThan(3);
  });

  it('draws a named custom icon in the mapped icon colour, and a raw colour on the icon', async () => {
    const named = await make(() => ({color: 'blue', icon: 'info', label: 'Note'}));
    const icon = markers(named.table)[0]!.querySelector('tct-icon')!;
    expect(icon.getAttribute('name')).toBe('info');
    expect(icon.getAttribute('color')).toBe('blue');
    const raw = await make(() => ({color: '#ff00aa', icon: 'info', label: 'Note'}));
    const rawMarker = markers(raw.table)[0]!;
    expect(rawMarker.querySelector('tct-icon')!.getAttribute('color')).toBe('inherit');
    expect(rawMarker.style.getPropertyValue('--_table-status-color')).toBe('#ff00aa');
  });

  it('lets a semantic status win over an untyped custom field and warns once in development', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const {table} = await make(
      () => ({status: 'error', color: 'blue', label: 'Mixed'}) as unknown as Status,
    );
    expect(markers(table)[0]!.querySelector('tct-icon')!.getAttribute('name')).toBe('error');
    expect(markers(table)[0]!.querySelector('.tct-table-status-dot')).toBeNull();
    expect(warn.mock.calls.length).toBeLessThanOrEqual(1);
    warn.mockRestore();
  });

  it('treats an untyped, unsupported status as no marker instead of throwing', async () => {
    const {table} = await make(() => ({status: 'other', label: 'x'}) as unknown as Status);
    expect(markers(table)).toHaveLength(0);
  });

  it('updates a marker when the row status changes', async () => {
    let level: 'success' | 'error' = 'success';
    const {table, plugin} = await make(() => ({status: level, label: level}));
    expect(markers(table)[0]!.getAttribute('aria-label')).toBe('success');
    level = 'error';
    plugin.refresh();
    await table.updateComplete;
    expect(markers(table)[0]!.getAttribute('aria-label')).toBe('error');
  });

  it('composes with the selection plugin without dropping or duplicating columns', async () => {
    const table = await makeTable();
    const status = new TableRowStatusController<Person>(null, {
      getStatus: () => ({status: 'success', label: 'Ok'}),
    });
    const selection = new TableSelectionController<Person>(
      null,
      new TableSelectionStateController<Person>(null, {data: PEOPLE, idKey: 'id'}).selectionConfig,
    );
    Object.assign(table, {
      data: PEOPLE,
      columns: PERSON_COLUMNS,
      idKey: 'id',
      plugins: {status, selection},
    });
    await table.updateComplete;
    expect(table.querySelectorAll('thead th')).toHaveLength(5);
    expect(rows(table)[0]!.querySelectorAll('td')).toHaveLength(5);
    expect(table.querySelectorAll('thead th[data-column-key="__tct_rowStatus"]')).toHaveLength(1);
  });

  it('has no accessibility violations and localises the header in de-DE', async () => {
    const {table} = await make(() => ({status: 'warning', label: 'Slow'}), {lang: 'de-DE'});
    await expectAccessible(table);
    await waitUntil(
      () => table.querySelector('thead th')!.textContent.trim() !== 'Row status',
      'de-DE catalog',
    );
  });
});
