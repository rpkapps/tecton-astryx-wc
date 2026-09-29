/**
 * Sorting large datasets in slices: the sliced sort gives exactly the synchronous result, the state
 * controller keeps the previous order while it runs and says when it is done, and a newer sort
 * supersedes an older one [mwg:break-up-long-tasks].
 */
import {describe, expect, it, vi} from 'vitest';
import {
  TABLE_ASYNC_SORT_ROWS,
  TableSortableStateController,
  sortRows,
  sortRowsSliced,
} from './define.js';

interface Row extends Record<string, unknown> {
  id: number;
  name: string | null;
  group: number;
  score: number | undefined;
}

function makeRows(count: number): Row[] {
  let seed = 7;
  const next = (): number => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  return Array.from({length: count}, (_, id) => ({
    id,
    name: next() < 0.05 ? null : `Row ${Math.floor(next() * 500)} ${id % 7}`,
    group: Math.floor(next() * 12),
    score: next() < 0.05 ? undefined : Math.round(next() * 1000) / 10,
  }));
}

const collator = new Intl.Collator('en', {numeric: true});

describe('sortRowsSliced', () => {
  it('gives exactly the synchronous result, including stability and missing values last', async () => {
    const rows = makeRows(5000);
    for (const sort of [
      [{sortKey: 'name', direction: 'ascending'}],
      [{sortKey: 'score', direction: 'descending'}],
      [
        {sortKey: 'group', direction: 'ascending'},
        {sortKey: 'name', direction: 'descending'},
      ],
    ] as const) {
      const expected = sortRows(rows, [...sort], undefined, collator);
      const actual = await sortRowsSliced(rows, [...sort], undefined, collator);
      expect(actual!.map((row) => row.id)).toEqual(expected.map((row) => row.id));
    }
  });

  it('supports a custom comparator and does not touch the input', async () => {
    const rows = makeRows(3000);
    const before = rows.map((row) => row.id);
    const comparators = {group: (a: Row, b: Row) => b.group - a.group};
    const sorted = await sortRowsSliced(
      rows,
      [{sortKey: 'group', direction: 'ascending'}],
      comparators,
      collator,
    );
    expect(sorted![0]!.group).toBe(11);
    expect(rows.map((row) => row.id)).toEqual(before);
  });

  it('yields between slices instead of holding the thread', async () => {
    const rows = makeRows(10_000);
    let longest = 0;
    let last = performance.now();
    const timer = setInterval(() => {
      const now = performance.now();
      longest = Math.max(longest, now - last);
      last = now;
    }, 0);
    await sortRowsSliced(rows, [{sortKey: 'name', direction: 'ascending'}], undefined, collator);
    clearInterval(timer);
    // A single 10k sort is ~30 ms warm; sliced, the main thread was free again within a slice or two.
    expect(longest).toBeLessThan(60);
  });

  it('stops and resolves null once it is superseded', async () => {
    const rows = makeRows(10_000);
    let current = true;
    const promise = sortRowsSliced(
      rows,
      [{sortKey: 'name', direction: 'ascending'}],
      undefined,
      collator,
      () => current,
    );
    current = false;
    expect(await promise).toBeNull();
  });
});

describe('TableSortableStateController on large data', () => {
  const rows = (count: number): Row[] => makeRows(count);

  it('sorts a small dataset synchronously', () => {
    const state = new TableSortableStateController<Row>(null, {
      data: rows(TABLE_ASYNC_SORT_ROWS),
      defaultSort: [{sortKey: 'group', direction: 'ascending'}],
    });
    expect(state.sortedData[0]!.group).toBe(0);
    expect(state.sorting).toBe(false);
  });

  it('keeps the previous order while a large sort runs, then notifies with the sorted rows', async () => {
    const data = rows(TABLE_ASYNC_SORT_ROWS + 3000);
    const state = new TableSortableStateController<Row>(null, {data});
    const listener = vi.fn();
    state.subscribe(listener);
    expect(state.sortedData).toBe(data);

    state.sortConfig.onSortChange([{sortKey: 'group', direction: 'descending'}]);
    listener.mockClear();
    // Not sorted yet: the same rows, and the state says so.
    expect(state.sortedData).toBe(data);
    expect(state.sorting).toBe(true);
    await state.settled();
    expect(state.sorting).toBe(false);
    expect(listener).toHaveBeenCalledTimes(1);
    const sorted = state.sortedData;
    expect(sorted).not.toBe(data);
    expect(sorted[0]!.group).toBe(11);
    expect(sorted).toBe(state.sortedData);

    // A second sort shows the first result until the new one is ready.
    state.sortConfig.onSortChange([{sortKey: 'group', direction: 'ascending'}]);
    expect(state.sortedData).toBe(sorted);
    await state.settled();
    expect(state.sortedData[0]!.group).toBe(0);
  });

  it('lets a newer sort supersede an older one', async () => {
    const state = new TableSortableStateController<Row>(null, {
      data: rows(TABLE_ASYNC_SORT_ROWS + 3000),
    });
    state.sortConfig.onSortChange([{sortKey: 'group', direction: 'descending'}]);
    void state.sortedData;
    state.sortConfig.onSortChange([{sortKey: 'group', direction: 'ascending'}]);
    void state.sortedData;
    await state.settled();
    expect(state.sortedData[0]!.group).toBe(0);
    expect(state.sortedData.at(-1)!.group).toBe(11);
  });

  it('shows the new rows unsorted, not stale ones, when the data itself changes', async () => {
    const state = new TableSortableStateController<Row>(null, {
      data: rows(TABLE_ASYNC_SORT_ROWS + 500),
      defaultSort: [{sortKey: 'group', direction: 'ascending'}],
    });
    void state.sortedData;
    await state.settled();
    const fresh = rows(TABLE_ASYNC_SORT_ROWS + 800);
    state.data = fresh;
    expect(state.sortedData).toBe(fresh);
    await state.settled();
    expect(state.sortedData).toHaveLength(fresh.length);
    expect(state.sortedData[0]!.group).toBe(0);
  });

  it('resolves settled() at once when nothing is running', async () => {
    const state = new TableSortableStateController<Row>(null, {data: rows(10)});
    await state.settled();
    expect(state.sorting).toBe(false);
  });
});
