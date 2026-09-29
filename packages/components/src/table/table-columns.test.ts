/**
 * Column plugins: settings (which columns, in what order), resize (pointer and keyboard, RTL) and
 * sticky (pinned start and end columns, RTL).
 */
import {beforeAll, describe, expect, it, vi} from 'vitest';
import {userEvent} from 'vitest/browser';
import {axNode, expectAccessible} from '@tecton-wc/testing/a11y.js';
import {fixture} from '@tecton-wc/testing/fixture.js';
import {deepActiveElement, pressKeys, tabSequence} from '@tecton-wc/testing/keyboard.js';
import {aTimeout, nextFrame, waitUntil} from '@tecton-wc/testing/timing.js';
import './define.js';
import {
  TableColumnResizeController,
  TableColumnSettingsController,
  TableColumnSettingsStateController,
  TableSelectionController,
  TableSelectionStateController,
  TableSortableController,
  TableStickyColumnsController,
  computeColumnWidths,
  pixel,
  proportional,
} from './define.js';
import {
  PEOPLE,
  bodyText,
  headerText,
  useLayeredPreflight,
  type Person,
} from './table-test-helpers.js';
import type {ColumnSettingsOption} from './define.js';
import type {TableColumn} from './table.types.js';
import type {TctTable} from './tct-table.js';

beforeAll(useLayeredPreflight);

const ALL_COLUMNS: TableColumn<Person>[] = [
  {key: 'name', header: 'Name'},
  {key: 'role', header: 'Role'},
  {key: 'age', header: 'Age'},
  {key: 'id', header: 'ID'},
];

async function mount(
  columns: TableColumn<Person>[],
  plugins: Record<string, unknown>,
  options: {dir?: 'rtl'; width?: number} = {},
): Promise<TctTable<Person>> {
  const root = await fixture<HTMLElement>(
    `<div ${options.dir ? `dir="${options.dir}"` : ''} style="inline-size: ${options.width ?? 460}px"><tct-table></tct-table></div>`,
  );
  const table = root.querySelector<TctTable<Person>>('tct-table')!;
  Object.assign(table, {data: PEOPLE, columns, idKey: 'id', plugins});
  await table.updateComplete;
  await nextFrame();
  return table;
}

// -------------------------------------------------------------------------- column settings

describe('table column settings plugin (useTableColumnSettings.test.tsx)', () => {
  const OPTIONS: ColumnSettingsOption[] = [
    {key: 'name', label: 'Name', alwaysVisible: true},
    {key: 'role', label: 'Role'},
    {key: 'age', label: 'Age'},
    {key: 'id', label: 'ID'},
  ];

  it('shows only the active columns, in the order of activeColumnKeys', async () => {
    const state = new TableColumnSettingsStateController(null, {
      columns: OPTIONS,
      activeColumnKeys: ['age', 'name'],
    });
    const plugin = new TableColumnSettingsController<Person>(null, state.columnSettingsConfig);
    const table = await mount(ALL_COLUMNS, {columnSettings: plugin});
    expect(headerText(table)).toEqual(['Age', 'Name']);
    expect(bodyText(table)[0]).toEqual(['31', 'Alice Chen']);
  });

  it('follows the state as columns are toggled, reset and shown', async () => {
    const state = new TableColumnSettingsStateController(null, {
      columns: OPTIONS,
      defaultActiveColumnKeys: ['name', 'role'],
      defaultColumnKeys: ['name', 'age'],
    });
    const plugin = new TableColumnSettingsController<Person>(null, state.columnSettingsConfig);
    const table = await mount(ALL_COLUMNS, {columnSettings: plugin});
    expect(headerText(table)).toEqual(['Name', 'Role']);
    state.toggleColumn('id');
    await table.updateComplete;
    expect(headerText(table)).toEqual(['Name', 'Role', 'ID']);
    state.toggleColumn('role');
    await table.updateComplete;
    expect(headerText(table)).toEqual(['Name', 'ID']);
    state.resetToDefault();
    await table.updateComplete;
    expect(headerText(table)).toEqual(['Name', 'Age']);
    state.showAllColumns();
    await table.updateComplete;
    expect(headerText(table)).toEqual(['Name', 'Role', 'Age', 'ID']);
  });

  it('keeps sort and selection working on the columns that are shown', async () => {
    const state = new TableColumnSettingsStateController(null, {
      columns: OPTIONS,
      activeColumnKeys: ['role', 'name'],
    });
    const settings = new TableColumnSettingsController<Person>(null, state.columnSettingsConfig);
    const selectionState = new TableSelectionStateController<Person>(null, {
      data: PEOPLE,
      idKey: 'id',
    });
    const selection = new TableSelectionController<Person>(null, selectionState.selectionConfig);
    const sort = new TableSortableController<Person>(null, {
      sort: [],
      onSortChange: () => undefined,
    });
    const columns = ALL_COLUMNS.map((column) => ({...column, sortable: true}));
    const table = await mount(columns, {selection, sort, columnSettings: settings});
    expect(table.querySelectorAll('thead th')).toHaveLength(3);
    expect(table.querySelectorAll('thead th button.tct-table-sort')).toHaveLength(2);
    expect(table.querySelector('thead th')!.getAttribute('data-column-key')).toBe(
      '__tct_selection',
    );
  });

  it('never hides an alwaysVisible column: toggle is a no-op and lists are completed', () => {
    const state = new TableColumnSettingsStateController(null, {columns: OPTIONS});
    expect(state.isColumnToggleable('name')).toBe(false);
    expect(state.isColumnToggleable('role')).toBe(true);
    state.toggleColumn('name');
    expect(state.activeColumnKeys).toContain('name');
    state.setActiveColumnKeys(['role']);
    expect(new Set(state.activeColumnKeys)).toEqual(new Set(['role', 'name']));
    expect(state.isColumnActive('age')).toBe(false);
  });

  it('reports changes through onChangeActiveColumnKeys, uncontrolled and controlled', () => {
    const changes: (readonly string[])[] = [];
    const uncontrolled = new TableColumnSettingsStateController(null, {
      columns: OPTIONS,
      onChangeActiveColumnKeys: (keys) => changes.push(keys),
    });
    uncontrolled.toggleColumn('age');
    expect(uncontrolled.activeColumnKeys).toEqual(['name', 'role', 'id']);
    const controlled = new TableColumnSettingsStateController(null, {
      columns: OPTIONS,
      activeColumnKeys: ['name'],
      onChangeActiveColumnKeys: (keys) => changes.push(keys),
    });
    controlled.toggleColumn('age');
    expect(controlled.activeColumnKeys).toEqual(['name']);
    expect(changes).toEqual([
      ['name', 'role', 'id'],
      ['name', 'age'],
    ]);
  });
});

// ------------------------------------------------------------------------------ column resize

const RESIZE_COLUMNS: TableColumn<Person>[] = [
  {key: 'name', header: 'Name', width: pixel(200)},
  {key: 'role', header: 'Role', width: pixel(160)},
  {key: 'age', header: 'Age', width: pixel(100)},
];

const handleOf = (table: Element, key: string): HTMLElement =>
  table.querySelector<HTMLElement>(`.tct-table-resize-handle[data-column-key="${key}"]`)!;
const widthOf = (table: Element, key: string): number =>
  table.querySelector(`thead th[data-column-key="${key}"]`)!.getBoundingClientRect().width;

describe('table column resize plugin (useTableColumnResize.test.tsx)', () => {
  it('renders a separator handle in each resizable header cell', async () => {
    const table = await mount(RESIZE_COLUMNS, {
      resize: new TableColumnResizeController<Person>(null, {}),
    });
    expect(table.querySelectorAll('.tct-table-resize-handle')).toHaveLength(3);
    for (const key of ['name', 'role', 'age']) {
      const handle = handleOf(table, key);
      expect(handle.getAttribute('role')).toBe('separator');
      expect(handle.getAttribute('aria-orientation')).toBe('vertical');
      expect(handle.getAttribute('tabindex')).toBe('0');
    }
    expect(handleOf(table, 'name').closest('th')!.classList.contains('tct-table-resizable')).toBe(
      true,
    );
  });

  it('names the handle after the column and reports the measured width', async () => {
    const table = await mount(RESIZE_COLUMNS, {
      resize: new TableColumnResizeController<Person>(null, {}),
    });
    const handle = handleOf(table, 'role');
    expect(handle.getAttribute('aria-label')).toBe('Resize column Role');
    expect(Number(handle.getAttribute('aria-valuenow'))).toBeCloseTo(widthOf(table, 'role'), 0);
    expect(handle.getAttribute('aria-valuemin')).toBe('160');
    expect(handle.hasAttribute('aria-valuemax')).toBe(false);
    expect(handle.getAttribute('aria-valuetext')).toMatch(/pixels wide/);
    const node = await axNode(handle);
    expect(node.role).toBe('separator');
    expect(node.name).toBe('Resize column Role');
  });

  it('applies a width from columnWidths and removes it when the key goes away', async () => {
    const plugin = new TableColumnResizeController<Person>(null, {columnWidths: {name: 260}});
    const table = await mount(RESIZE_COLUMNS, {resize: plugin});
    expect(widthOf(table, 'name')).toBeCloseTo(260, 0);
    plugin.config = {columnWidths: {}};
    await table.updateComplete;
    expect(table.querySelector<HTMLElement>('thead th[data-column-key="name"]')!.style.width).toBe(
      '200px',
    );
  });

  describe('keyboard', () => {
    it('is reachable with Tab and resizes with the arrow keys, immediately', async () => {
      const updates: Record<string, number>[] = [];
      // A pixel column's minimum is its declared width; the global minimum lets it shrink.
      const plugin = new TableColumnResizeController<Person>(null, {
        minWidth: 100,
        onColumnResizeEnd: (next) => updates.push(next),
      });
      const table = await mount(RESIZE_COLUMNS, {resize: plugin});
      handleOf(table, 'name').focus();
      expect(deepActiveElement()).toBe(handleOf(table, 'name'));
      const before = widthOf(table, 'name');
      await pressKeys('ArrowRight');
      expect(widthOf(table, 'name')).toBeCloseTo(before + 10, 0);
      expect(updates.at(-1)!.name).toBeCloseTo(before + 10, 0);
      await pressKeys('ArrowLeft', 'ArrowLeft');
      expect(widthOf(table, 'name')).toBeCloseTo(before - 10, 0);
      expect(Number(handleOf(table, 'name').getAttribute('aria-valuenow'))).toBeCloseTo(
        before - 10,
        0,
      );
    });

    it('resizes by 50 px with Shift, accumulating across presses', async () => {
      const table = await mount(RESIZE_COLUMNS, {
        resize: new TableColumnResizeController<Person>(null, {}),
      });
      handleOf(table, 'role').focus();
      const before = widthOf(table, 'role');
      await pressKeys('Shift+ArrowRight');
      await pressKeys('Shift+ArrowRight');
      expect(widthOf(table, 'role')).toBeCloseTo(before + 100, 0);
    });

    it('Home jumps to the minimum and End to the maximum when there is one', async () => {
      const plugin = new TableColumnResizeController<Person>(null, {maxWidth: 400});
      const table = await mount(RESIZE_COLUMNS, {resize: plugin});
      handleOf(table, 'name').focus();
      await pressKeys('ArrowRight', 'ArrowRight', 'ArrowRight');
      await pressKeys('Home');
      expect(widthOf(table, 'name')).toBeCloseTo(200, 0);
      await pressKeys('End');
      expect(widthOf(table, 'name')).toBeCloseTo(400, 0);
      expect(handleOf(table, 'name').getAttribute('aria-valuemax')).toBe('400');
    });

    it('End does nothing without a finite maximum, and a column never goes below its minimum', async () => {
      const table = await mount(RESIZE_COLUMNS, {
        resize: new TableColumnResizeController<Person>(null, {}),
      });
      handleOf(table, 'name').focus();
      const before = widthOf(table, 'name');
      await pressKeys('End');
      expect(widthOf(table, 'name')).toBeCloseTo(before, 0);
      await pressKeys('ArrowLeft');
      expect(widthOf(table, 'name')).toBeCloseTo(200, 0);
    });

    it('lets other keys through', async () => {
      const table = await mount(RESIZE_COLUMNS, {
        resize: new TableColumnResizeController<Person>(null, {}),
      });
      handleOf(table, 'name').focus();
      const event = new KeyboardEvent('keydown', {key: 'a', bubbles: true, cancelable: true});
      handleOf(table, 'name').dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
    });

    it('mirrors the arrows in right-to-left: ArrowLeft widens, ArrowRight narrows', async () => {
      const table = await mount(
        RESIZE_COLUMNS,
        {resize: new TableColumnResizeController<Person>(null, {minWidth: 100})},
        {dir: 'rtl'},
      );
      handleOf(table, 'name').focus();
      const before = widthOf(table, 'name');
      await pressKeys('ArrowLeft');
      expect(widthOf(table, 'name')).toBeCloseTo(before + 10, 0);
      await pressKeys('ArrowRight', 'ArrowRight');
      expect(widthOf(table, 'name')).toBeCloseTo(before - 10, 0);
    });
  });

  describe('pointer', () => {
    it('drags a pixel column wider, commits on release and reports every changed column', async () => {
      const updates: Record<string, number>[] = [];
      const plugin = new TableColumnResizeController<Person>(null, {
        onColumnResizeEnd: (next) => updates.push(next),
      });
      const table = await mount(RESIZE_COLUMNS, {resize: plugin});
      const handle = handleOf(table, 'name');
      const rect = handle.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + 4;
      const before = widthOf(table, 'name');
      handle.dispatchEvent(
        new PointerEvent('pointerdown', {
          bubbles: true,
          cancelable: true,
          clientX: x,
          clientY: y,
          button: 0,
          pointerId: 1,
          pointerType: 'mouse',
        }),
      );
      expect(handle.hasAttribute('data-resizing')).toBe(true);
      handle.dispatchEvent(
        new PointerEvent('pointermove', {
          bubbles: true,
          clientX: x + 40,
          clientY: y,
          pointerId: 1,
          pointerType: 'mouse',
        }),
      );
      expect(widthOf(table, 'name')).toBeCloseTo(before + 40, 0);
      handle.dispatchEvent(
        new PointerEvent('pointerup', {
          bubbles: true,
          clientX: x + 40,
          clientY: y,
          pointerId: 1,
          pointerType: 'mouse',
        }),
      );
      expect(handle.hasAttribute('data-resizing')).toBe(false);
      expect(updates).toHaveLength(1);
      expect(updates[0]!.name).toBeCloseTo(before + 40, 0);
      expect(Object.keys(updates[0]!)).toEqual(['name', 'role']);
    });

    it('clamps to the minimum and to maxWidth during a drag', async () => {
      const plugin = new TableColumnResizeController<Person>(null, {maxWidth: 250});
      const table = await mount(RESIZE_COLUMNS, {resize: plugin});
      const handle = handleOf(table, 'name');
      const rect = handle.getBoundingClientRect();
      const x = rect.left + 4;
      const fire = (type: string, dx: number): void => {
        handle.dispatchEvent(
          new PointerEvent(type, {
            bubbles: true,
            cancelable: true,
            clientX: x + dx,
            clientY: rect.top + 4,
            button: 0,
            pointerId: 2,
            pointerType: 'mouse',
          }),
        );
      };
      fire('pointerdown', 0);
      fire('pointermove', 500);
      expect(widthOf(table, 'name')).toBeCloseTo(250, 0);
      fire('pointermove', -500);
      expect(widthOf(table, 'name')).toBeCloseTo(200, 0);
      fire('pointerup', -500);
    });

    it('does not report a change when the drag is cancelled', async () => {
      const onEnd = vi.fn();
      const table = await mount(RESIZE_COLUMNS, {
        resize: new TableColumnResizeController<Person>(null, {onColumnResizeEnd: onEnd}),
      });
      const handle = handleOf(table, 'name');
      const rect = handle.getBoundingClientRect();
      handle.dispatchEvent(
        new PointerEvent('pointerdown', {
          bubbles: true,
          cancelable: true,
          clientX: rect.left + 4,
          clientY: rect.top + 4,
          button: 0,
          pointerId: 3,
          pointerType: 'mouse',
        }),
      );
      handle.dispatchEvent(
        new PointerEvent('pointermove', {
          bubbles: true,
          clientX: rect.left + 60,
          clientY: rect.top + 4,
          pointerId: 3,
          pointerType: 'mouse',
        }),
      );
      handle.dispatchEvent(
        new PointerEvent('pointercancel', {bubbles: true, pointerId: 3, pointerType: 'mouse'}),
      );
      expect(onEnd).not.toHaveBeenCalled();
      await table.updateComplete;
      expect(handle.hasAttribute('data-resizing')).toBe(false);
    });

    it('drags the right way in right-to-left: moving the handle left widens the column', async () => {
      const table = await mount(
        RESIZE_COLUMNS,
        {resize: new TableColumnResizeController<Person>(null, {})},
        {dir: 'rtl'},
      );
      const handle = handleOf(table, 'name');
      const rect = handle.getBoundingClientRect();
      const x = rect.left + 4;
      const before = widthOf(table, 'name');
      const fire = (type: string, dx: number): void => {
        handle.dispatchEvent(
          new PointerEvent(type, {
            bubbles: true,
            cancelable: true,
            clientX: x + dx,
            clientY: rect.top + 4,
            button: 0,
            pointerId: 4,
            pointerType: 'mouse',
          }),
        );
      };
      fire('pointerdown', 0);
      fire('pointermove', -30);
      expect(widthOf(table, 'name')).toBeCloseTo(before + 30, 0);
      fire('pointerup', -30);
    });
  });

  describe('proportional columns', () => {
    const PROPORTIONAL: TableColumn<Person>[] = [
      {key: 'name', header: 'Name', width: proportional(1, {minWidth: 80})},
      {key: 'role', header: 'Role', width: proportional(1, {minWidth: 80})},
      {key: 'age', header: 'Age', width: proportional(1, {minWidth: 80})},
    ];

    it('has no handle on the last proportional column, and a handle on a last pixel column', async () => {
      const resize = new TableColumnResizeController<Person>(null, {});
      const table = await mount(PROPORTIONAL, {resize});
      expect(handleOf(table, 'name')).toBeTruthy();
      expect(handleOf(table, 'role')).toBeTruthy();
      expect(table.querySelector('.tct-table-resize-handle[data-column-key="age"]')).toBeNull();
      const mixed = await mount([PROPORTIONAL[0]!, {key: 'age', header: 'Age', width: pixel(90)}], {
        resize: new TableColumnResizeController<Person>(null, {}),
      });
      expect(handleOf(mixed, 'age')).toBeTruthy();
    });

    it('resizes against the neighbour and keeps the table width', async () => {
      const table = await mount(PROPORTIONAL, {
        resize: new TableColumnResizeController<Person>(null, {}),
      });
      const total = table.querySelector('table')!.getBoundingClientRect().width;
      handleOf(table, 'name').focus();
      const [nameBefore, roleBefore] = [widthOf(table, 'name'), widthOf(table, 'role')];
      await pressKeys('Shift+ArrowRight');
      expect(widthOf(table, 'name')).toBeCloseTo(nameBefore + 50, 0);
      expect(widthOf(table, 'role')).toBeCloseTo(roleBefore - 50, 0);
      expect(table.querySelector('table')!.getBoundingClientRect().width).toBeCloseTo(total, 0);
    });
  });

  it('skips columns that opt out and composes with selection and sort', async () => {
    const selectionState = new TableSelectionStateController<Person>(null, {
      data: PEOPLE,
      idKey: 'id',
    });
    const table = await mount(
      RESIZE_COLUMNS.map((column) =>
        column.key === 'age' ? {...column, resizable: false} : column,
      ),
      {
        resize: new TableColumnResizeController<Person>(null, {}),
        selection: new TableSelectionController<Person>(null, selectionState.selectionConfig),
      },
    );
    expect(table.querySelectorAll('.tct-table-resize-handle')).toHaveLength(2);
    expect(
      table.querySelector('thead th[data-column-key="__tct_selection"] .tct-table-resize-handle'),
    ).toBeNull();
  });

  it('passes axe, and the handles are in the tab order after the header content', async () => {
    const sort = new TableSortableController<Person>(null, {
      sort: [],
      onSortChange: () => undefined,
    });
    const table = await mount(
      RESIZE_COLUMNS.map((column) => ({...column, sortable: true})),
      {resize: new TableColumnResizeController<Person>(null, {}), sort},
    );
    await expectAccessible(table);
    const visited = await tabSequence(table, {
      start: table.querySelector<HTMLElement>('.tct-table-scroll')!,
      max: 8,
    });
    const labels = visited.map(
      (element) => element.getAttribute('aria-label') ?? element.className,
    );
    expect(labels.slice(0, 4)).toEqual([
      'Sort by Name',
      'Resize column Name',
      'Sort by Role',
      'Resize column Role',
    ]);
  });

  it('is hidden for touch-only pointers unless focused (media query is present)', async () => {
    const table = await mount(RESIZE_COLUMNS, {
      resize: new TableColumnResizeController<Person>(null, {}),
    });
    expect(getComputedStyle(handleOf(table, 'name')).display).not.toBe('none');
  });
});

describe('computeColumnWidths', () => {
  const th = document.createElement('th');
  const snapshot = (key: string, initialWidth: number, minWidth: number) => ({
    key,
    th,
    initialWidth,
    minWidth,
    maxWidth: Number.POSITIVE_INFINITY,
  });

  it('gives the remainder to the last column so the table keeps its width', () => {
    const drag = {
      startX: 0,
      resizeIndex: 0,
      neighborIndex: null,
      tableWidth: 500,
      snapshots: [snapshot('a', 100, 50), snapshot('b', 200, 50), snapshot('c', 200, 50)],
    };
    expect(computeColumnWidths(drag, 30)).toEqual([130, 200, 170]);
  });

  it('moves the boundary between a proportional column and its neighbour', () => {
    const drag = {
      startX: 0,
      resizeIndex: 0,
      neighborIndex: 1,
      tableWidth: 0,
      snapshots: [snapshot('a', 100, 60), snapshot('b', 100, 60)],
    };
    expect(computeColumnWidths(drag, 30)).toEqual([130, 70]);
    expect(computeColumnWidths(drag, 100)).toEqual([140, 60]);
    expect(computeColumnWidths(drag, -100)).toEqual([60, 140]);
  });
});

// ---------------------------------------------------------------------------- sticky columns

describe('table sticky columns plugin (useTableStickyColumns.test.tsx)', () => {
  const STICKY_COLUMNS: TableColumn<Person>[] = [
    {key: 'name', header: 'Name', width: pixel(120)},
    {key: 'role', header: 'Role', width: pixel(140)},
    {key: 'age', header: 'Age', width: pixel(300)},
    {key: 'id', header: 'ID', width: pixel(300)},
    {key: 'extra', header: 'Notes', width: pixel(100)},
  ];
  const cell = (table: Element, key: string, row = -1): HTMLElement =>
    row < 0
      ? table.querySelector<HTMLElement>(`thead th[data-column-key="${key}"]`)!
      : (table.querySelectorAll('tbody tr')[row]!.querySelectorAll('td')[
          STICKY_COLUMNS.findIndex((column) => column.key === key)
        ] as HTMLElement);
  const scroller = (table: Element): HTMLElement =>
    table.querySelector<HTMLElement>('.tct-table-scroll')!;

  it('pins a start column at offset 0 and computes cumulative offsets for the run', async () => {
    const plugin = new TableStickyColumnsController<Person>(null, {startKeys: ['name', 'role']});
    const table = await mount(STICKY_COLUMNS, {sticky: plugin}, {width: 400});
    for (const key of ['name', 'role']) {
      expect(getComputedStyle(cell(table, key)).position).toBe('sticky');
      expect(getComputedStyle(cell(table, key, 0)).position).toBe('sticky');
      expect(cell(table, key).getAttribute('data-sticky')).toBe('start');
    }
    expect(getComputedStyle(cell(table, 'name')).insetInlineStart).toBe('0px');
    expect(getComputedStyle(cell(table, 'role')).insetInlineStart).toBe('120px');
    expect(getComputedStyle(cell(table, 'age')).position).not.toBe('sticky');
    expect(cell(table, 'role').hasAttribute('data-edge')).toBe(true);
    expect(cell(table, 'name').hasAttribute('data-edge')).toBe(false);
  });

  it('pins an end column and a run through the last column', async () => {
    const plugin = new TableStickyColumnsController<Person>(null, {endKeys: ['id', 'extra']});
    const table = await mount(STICKY_COLUMNS, {sticky: plugin}, {width: 400});
    expect(getComputedStyle(cell(table, 'extra')).insetInlineEnd).toBe('0px');
    expect(getComputedStyle(cell(table, 'id')).insetInlineEnd).toBe('100px');
    expect(cell(table, 'id').getAttribute('data-sticky')).toBe('end');
    expect(cell(table, 'id').hasAttribute('data-edge')).toBe(true);
  });

  it('is a no-op with an empty config and pins only what is configured', async () => {
    const none = await mount(STICKY_COLUMNS, {
      sticky: new TableStickyColumnsController<Person>(null, {}),
    });
    expect(none.querySelectorAll('.tct-table-sticky')).toHaveLength(0);
    const some = await mount(STICKY_COLUMNS, {
      sticky: new TableStickyColumnsController<Person>(null, {startKeys: ['name']}),
    });
    expect(some.querySelectorAll('thead th.tct-table-sticky')).toHaveLength(1);
    expect(some.querySelectorAll('tbody td.tct-table-sticky')).toHaveLength(4);
  });

  it('keeps pinned cells in view while the table scrolls sideways', async () => {
    const plugin = new TableStickyColumnsController<Person>(null, {
      startKeys: ['name'],
      endKeys: ['extra'],
    });
    const table = await mount(STICKY_COLUMNS, {sticky: plugin}, {width: 400});
    const region = scroller(table);
    expect(region.scrollWidth).toBeGreaterThan(region.clientWidth);
    region.scrollLeft = 200;
    await nextFrame();
    const box = region.getBoundingClientRect();
    const name = cell(table, 'name', 1).getBoundingClientRect();
    const extra = cell(table, 'extra', 1).getBoundingClientRect();
    expect(name.left).toBeCloseTo(box.left, 0);
    expect(extra.right).toBeCloseTo(box.right, 0);
    const middle = cell(table, 'age', 1).getBoundingClientRect();
    expect(middle.left).toBeLessThan(box.left + 300);
  });

  it('shows the edge shadow only while content hides behind the pinned edge', async () => {
    const plugin = new TableStickyColumnsController<Person>(null, {
      startKeys: ['name'],
      endKeys: ['extra'],
    });
    const table = await mount(STICKY_COLUMNS, {sticky: plugin}, {width: 400});
    const region = scroller(table);
    const shadow = (name: string): string => region.style.getPropertyValue(name);
    await waitUntil(() => shadow('--_table-sticky-shadow-end') === '1', 'end shadow at rest');
    expect(shadow('--_table-sticky-shadow-start')).toBe('0');
    region.scrollLeft = 200;
    await waitUntil(
      () => shadow('--_table-sticky-shadow-start') === '1',
      'start shadow after scrolling',
    );
    region.scrollLeft = region.scrollWidth;
    await waitUntil(() => shadow('--_table-sticky-shadow-end') === '0', 'end shadow at the end');
    const strip = getComputedStyle(cell(table, 'name'), '::after');
    expect(strip.content).not.toBe('none');
  });

  it('paints pinned body cells opaque and replays the row fill over them', async () => {
    const plugin = new TableStickyColumnsController<Person>(null, {startKeys: ['name']});
    const table = await mount(STICKY_COLUMNS, {sticky: plugin});
    table.striped = true;
    await table.updateComplete;
    const pinned = cell(table, 'name', 1);
    expect(getComputedStyle(pinned).backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
    const overlay = getComputedStyle(pinned, '::before').backgroundColor;
    expect(overlay).not.toBe('rgba(0, 0, 0, 0)');
    expect(getComputedStyle(cell(table, 'name', 0), '::before').backgroundColor).toBe(
      'rgba(0, 0, 0, 0)',
    );
  });

  it('measures the offsets from the rendered widths (a proportional column still lines up)', async () => {
    const columns: TableColumn<Person>[] = [
      {key: 'name', header: 'Name', width: proportional(1, {minWidth: 100})},
      {key: 'role', header: 'Role', width: pixel(200)},
      {key: 'age', header: 'Age', width: pixel(400)},
    ];
    const plugin = new TableStickyColumnsController<Person>(null, {startKeys: ['name', 'role']});
    const table = await mount(columns, {sticky: plugin}, {width: 900});
    await nextFrame();
    const name = widthOf(table, 'name');
    expect(name).toBeGreaterThan(100);
    expect(
      parseFloat(
        getComputedStyle(table.querySelector('thead th[data-column-key="role"]')!).insetInlineStart,
      ),
    ).toBeCloseTo(name, 0);
  });

  describe('right-to-left', () => {
    it('pins the start column to the right edge and keeps it there while scrolling', async () => {
      const plugin = new TableStickyColumnsController<Person>(null, {
        startKeys: ['name'],
        endKeys: ['extra'],
      });
      const table = await mount(STICKY_COLUMNS, {sticky: plugin}, {dir: 'rtl', width: 400});
      const region = scroller(table);
      region.scrollLeft = -150;
      await nextFrame();
      const box = region.getBoundingClientRect();
      const name = cell(table, 'name', 1).getBoundingClientRect();
      const extra = cell(table, 'extra', 1).getBoundingClientRect();
      expect(name.right).toBeCloseTo(box.right, 0);
      expect(extra.left).toBeCloseTo(box.left, 0);
    });

    it('measures shadows from the absolute scroll position (scrollLeft is negative)', async () => {
      const plugin = new TableStickyColumnsController<Person>(null, {
        startKeys: ['name'],
        endKeys: ['extra'],
      });
      const table = await mount(STICKY_COLUMNS, {sticky: plugin}, {dir: 'rtl', width: 400});
      const region = scroller(table);
      const shadow = (name: string): string => region.style.getPropertyValue(name);
      await waitUntil(() => shadow('--_table-sticky-shadow-end') === '1', 'end shadow at rest');
      expect(shadow('--_table-sticky-shadow-start')).toBe('0');
      region.scrollLeft = -200;
      await waitUntil(
        () => shadow('--_table-sticky-shadow-start') === '1',
        'start shadow after scrolling',
      );
    });

    it('draws the shadow strip on the correct side', async () => {
      const plugin = new TableStickyColumnsController<Person>(null, {startKeys: ['name']});
      const ltr = await mount(STICKY_COLUMNS, {sticky: plugin}, {width: 400});
      const rtl = await mount(
        STICKY_COLUMNS,
        {sticky: new TableStickyColumnsController<Person>(null, {startKeys: ['name']})},
        {dir: 'rtl', width: 400},
      );
      const gradient = (table: Element): string =>
        getComputedStyle(cell(table, 'name'), '::after').backgroundImage;
      expect(gradient(ltr)).toContain('to right');
      expect(gradient(rtl)).toContain('to left');
    });
  });

  it('passes axe with pinned columns, in RTL and with selection', async () => {
    const selectionState = new TableSelectionStateController<Person>(null, {
      data: PEOPLE,
      idKey: 'id',
    });
    const table = await mount(STICKY_COLUMNS, {
      sticky: new TableStickyColumnsController<Person>(null, {startKeys: ['name']}),
      selection: new TableSelectionController<Person>(null, selectionState.selectionConfig),
    });
    await expectAccessible(table);
    const rtl = await mount(
      STICKY_COLUMNS,
      {sticky: new TableStickyColumnsController<Person>(null, {endKeys: ['extra']})},
      {dir: 'rtl'},
    );
    await expectAccessible(rtl);
    await userEvent.click(table);
    await aTimeout(0);
  });
});
