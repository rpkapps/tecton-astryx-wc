/**
 * Forced colors (Windows high contrast): selection, focus, the resize handle, status markers and pinned
 * cells stay visible when author colours are replaced by the system palette.
 */
import {afterEach, beforeAll, describe, expect, it} from 'vitest';
import {emulateMedia} from '@tecton-wc/testing/emulate.js';
import {expectAccessible} from '@tecton-wc/testing/a11y.js';
import {fixture} from '@tecton-wc/testing/fixture.js';
import './define.js';
import {
  TableColumnResizeController,
  TableRowStatusController,
  TableSelectionController,
  TableSelectionStateController,
  TableStickyColumnsController,
  pixel,
} from './define.js';
import {PEOPLE, useLayeredPreflight, type Person} from './table-test-helpers.js';
import type {TctTable} from './tct-table.js';

beforeAll(useLayeredPreflight);

let restore: (() => Promise<void>) | undefined;
afterEach(async () => {
  await restore?.();
  restore = undefined;
});

async function mount(): Promise<TctTable<Person>> {
  restore = await emulateMedia({forcedColors: 'active'});
  const root = await fixture<HTMLElement>(
    '<div style="inline-size: 420px"><tct-table></tct-table></div>',
  );
  const table = root.querySelector<TctTable<Person>>('tct-table')!;
  const selection = new TableSelectionStateController<Person>(table, {
    data: PEOPLE,
    idKey: 'id',
    defaultSelectedKeys: ['p2'],
  });
  Object.assign(table, {
    data: PEOPLE,
    idKey: 'id',
    columns: [
      {key: 'name', header: 'Name', width: pixel(200)},
      {key: 'role', header: 'Role', width: pixel(160)},
      {key: 'age', header: 'Age', width: pixel(100)},
    ],
    plugins: {
      selection: new TableSelectionController<Person>(table, selection.selectionConfig),
      resize: new TableColumnResizeController<Person>(table, {}),
      sticky: new TableStickyColumnsController<Person>(table, {startKeys: ['name']}),
      status: new TableRowStatusController<Person>(table, {
        getStatus: () => ({color: 'blue', label: 'Custom'}),
      }),
    },
  });
  await table.updateComplete;
  return table;
}

describe('table in forced colors', () => {
  it('outlines the selected row with the system highlight', async () => {
    const table = await mount();
    const row = table.querySelector('tbody tr.tct-table-selected')!;
    const style = getComputedStyle(row);
    expect(style.outlineStyle).toBe('solid');
    expect(parseFloat(style.outlineWidth)).toBeGreaterThanOrEqual(2);
  });

  it('draws the status dot and the cell borders in a system colour', async () => {
    const table = await mount();
    const dot = table.querySelector('.tct-table-status-dot')!;
    expect(getComputedStyle(dot).backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
    expect(getComputedStyle(table.querySelector('tbody td')!).borderBottomStyle).toBe('solid');
  });

  it('shows the resize handle line only while it has focus', async () => {
    const table = await mount();
    const handle = table.querySelector<HTMLElement>('.tct-table-resize-handle')!;
    expect(getComputedStyle(handle, '::after').opacity).toBe('0');
    handle.focus();
    expect(getComputedStyle(handle, '::after').opacity).toBe('1');
  });

  it('gives pinned cells an opaque system background so scrolled content does not show through', async () => {
    const table = await mount();
    const pinned = table.querySelector('tbody td.tct-table-sticky')!;
    expect(getComputedStyle(pinned).backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
  });

  it('has no accessibility violations', async () => {
    const table = await mount();
    await expectAccessible(table);
  });
});
