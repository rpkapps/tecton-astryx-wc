/**
 * Ten thousand rows: first paint, sorting, selecting and scrolling stay inside the interaction budget
 * (INP <= 200 ms) and never produce a task that blocks the main thread for long. The table windows
 * large datasets: only the rows near the viewport are in the DOM, so the cost of an interaction does not
 * grow with the dataset [mwg:defer-rendering-heavy-content] [mwg:break-up-long-tasks]
 * [mwg:identify-inp-causes].
 *
 * Interaction to Next Paint is read from the Event Timing API (`event` entries: input to the next
 * paint) for a real, trusted click; long tasks from the Long Tasks API. Numbers are printed so a
 * regression is easy to see; the assertions carry headroom for slower CI machines.
 */
import {beforeAll, describe, expect, it} from 'vitest';
import {userEvent} from 'vitest/browser';
import {fixture} from '@tecton-wc/testing/fixture.js';
import {aTimeout, nextFrame, waitUntil} from '@tecton-wc/testing/timing.js';
import './define.js';
import {
  TableSelectionController,
  TableSelectionStateController,
  TableSortableController,
  TableSortableStateController,
} from './define.js';
import {useLayeredPreflight} from './table-test-helpers.js';
import type {TableColumn} from './table.types.js';
import type {TctTable} from './tct-table.js';

beforeAll(useLayeredPreflight);

interface Employee extends Record<string, unknown> {
  id: string;
  name: string;
  dept: string;
  age: number;
  score: number;
}

const DEPTS = ['Engineering', 'Design', 'Operations', 'Finance', 'Legal', 'Support'];

function makeRows(count: number): Employee[] {
  // A deterministic pseudo-random sequence: the same rows in every run and engine.
  let seed = 42;
  const next = (): number => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  return Array.from({length: count}, (_, i) => ({
    id: `e${i}`,
    name: `Person ${Math.floor(next() * 1e6)
      .toString(36)
      .padStart(5, 'a')} ${i}`,
    dept: DEPTS[Math.floor(next() * DEPTS.length)]!,
    age: 20 + Math.floor(next() * 45),
    score: Math.round(next() * 10000) / 100,
  }));
}

const COLUMNS: TableColumn<Employee>[] = [
  {key: 'name', header: 'Name', sortable: true},
  {key: 'dept', header: 'Department', sortable: true},
  {key: 'age', header: 'Age', sortable: true, align: 'end'},
  {key: 'score', header: 'Score', sortable: true, align: 'end'},
];

interface Measurement {
  /** Longest event duration (input to next paint) of the interaction; 0 when it was under 16 ms. */
  inp: number;
  /** Longest single task on the main thread from the pointer going down until the table settled. */
  longestTask: number;
  /** Milliseconds from the interaction until the table had settled. */
  complete: number;
}

/** Runs `interact` and reports INP, the longest task and the time until `done` resolves. */
async function measure(
  interact: () => unknown,
  done: () => Promise<unknown>,
): Promise<Measurement> {
  const events: PerformanceEventTiming[] = [];
  const tasks: PerformanceEntry[] = [];
  const eventObserver = new PerformanceObserver((list) => {
    events.push(...(list.getEntries() as PerformanceEventTiming[]));
  });
  eventObserver.observe({
    type: 'event',
    durationThreshold: 16,
    buffered: false,
  } as PerformanceObserverInit);
  let taskObserver: PerformanceObserver | undefined;
  try {
    taskObserver = new PerformanceObserver((list) => tasks.push(...list.getEntries()));
    taskObserver.observe({type: 'longtask', buffered: false});
  } catch {
    // Long Tasks is Chromium-only; the INP assertion still runs elsewhere.
  }
  // The test runner's own work before the pointer goes down (scrolling the target into view, hit
  // tests) is not the table's: only tasks that overlap the interaction or follow it count.
  let pointerDown = Number.POSITIVE_INFINITY;
  const onPointerDown = (): void => {
    pointerDown = Math.min(pointerDown, performance.now());
  };
  document.addEventListener('pointerdown', onPointerDown, {capture: true});
  const started = performance.now();
  await interact();
  await done();
  const complete = performance.now() - started;
  await aTimeout(100); // entries are delivered asynchronously
  eventObserver.disconnect();
  taskObserver?.disconnect();
  document.removeEventListener('pointerdown', onPointerDown, {capture: true});
  const inp = events.reduce((max, entry) => Math.max(max, entry.duration), 0);
  // Without a pointer (first render) everything since the start counts.
  const from = Number.isFinite(pointerDown) ? pointerDown : started;
  const longestTask = tasks
    .filter((entry) => entry.startTime + entry.duration > from)
    .reduce((max, entry) => Math.max(max, entry.duration), 0);
  return {inp, longestTask, complete: Math.round(complete)};
}

const sortButton = (table: Element, key: string): HTMLButtonElement =>
  table.querySelector<HTMLButtonElement>(
    `thead th[data-column-key="${key}"] button.tct-table-sort`,
  )!;

const rowsInDom = (table: Element): HTMLTableRowElement[] => [
  ...table.querySelectorAll<HTMLTableRowElement>('tbody > tr:not(.tct-table-spacer)'),
];
const firstIndex = (table: Element): number =>
  Number(rowsInDom(table)[0]!.getAttribute('aria-rowindex'));
const lastIndex = (table: Element): number =>
  Number(rowsInDom(table).at(-1)!.getAttribute('aria-rowindex'));

interface Setup {
  root: HTMLElement;
  table: TctTable<Employee>;
  state: TableSortableStateController<Employee>;
  rows: Employee[];
}

async function setup(
  count: number,
  extra: Record<string, unknown> = {},
  mountNow = true,
): Promise<Setup & {mount: () => void}> {
  const rows = makeRows(count);
  const root = await fixture<HTMLElement>(
    `<div style="block-size: 480px; overflow: auto"><tct-table></tct-table></div>`,
  );
  const table = root.querySelector<TctTable<Employee>>('tct-table')!;
  const state = new TableSortableStateController<Employee>(table, {data: rows});
  const plugin = new TableSortableController<Employee>(table, state.sortConfig);
  state.subscribe(() => {
    table.data = state.sortedData;
  });
  const mount = (): void => {
    Object.assign(table, {
      data: state.sortedData,
      columns: COLUMNS,
      idKey: 'id',
      plugins: {sort: plugin},
      ...extra,
    });
  };
  if (mountNow) mount();
  return {root, table, state, rows, mount};
}

describe('table performance: ten thousand rows (Table.perf.test.tsx, INP <= 200 ms)', () => {
  it('renders 10,000 rows as a window of a few dozen and describes the whole set', async () => {
    const {table, mount} = await setup(10_000, {}, false);
    const initial = await measure(
      () => {
        mount();
      },
      async () => {
        await table.updateComplete;
        await nextFrame();
      },
    );
    console.log('10k initial render (ms):', JSON.stringify(initial));
    expect(table.hasAttribute('data-windowed')).toBe(true);
    expect(rowsInDom(table).length).toBeGreaterThanOrEqual(40);
    expect(rowsInDom(table).length).toBeLessThan(150);
    expect(table.renderedRowCount).toBe(rowsInDom(table).length);
    expect(table.querySelector('table')!.getAttribute('aria-rowcount')).toBe('10000');
    expect(firstIndex(table)).toBe(1);
    expect(lastIndex(table)).toBe(rowsInDom(table).length);
    expect(
      [...table.querySelectorAll('tbody > tr.tct-table-spacer')].every(
        (row) => row.getAttribute('aria-hidden') === 'true',
      ),
    ).toBe(true);
    expect(initial.inp).toBeLessThanOrEqual(200);
    expect(initial.longestTask).toBeLessThan(200);
  });

  it('keeps the scroll height true and follows the scroll position from top to bottom', async () => {
    const {root, table} = await setup(10_000);
    await table.updateComplete;
    const rowSize = rowsInDom(table)[0]!.getBoundingClientRect().height;
    const height = root.scrollHeight;
    expect(height).toBeGreaterThan(rowSize * 10_000 * 0.98);
    expect(height).toBeLessThan(rowSize * 10_000 * 1.02 + 200);

    root.scrollTop = Math.floor(5000 * rowSize);
    await waitUntil(() => firstIndex(table) > 4900, 'window follows the scroll to the middle');
    await table.updateComplete;
    const middle = rowsInDom(table);
    expect(middle.length).toBeLessThan(150);
    const rootBox = root.getBoundingClientRect();
    const visible = middle.filter((row) => {
      const box = row.getBoundingClientRect();
      return box.bottom > rootBox.top && box.top < rootBox.bottom;
    });
    expect(visible.length).toBeGreaterThan(5);
    // Rows that are on screen are the ones the scroll position asks for.
    const at = Number(visible[0]!.getAttribute('aria-rowindex'));
    expect(Math.abs(at - 5000)).toBeLessThan(6);
    expect(visible[0]!.textContent).toContain(` ${at - 1}`);
    expect(root.scrollHeight).toBeGreaterThan(height * 0.99);

    root.scrollTop = root.scrollHeight;
    await waitUntil(() => lastIndex(table) === 10_000, 'window reaches the last row');
    await table.updateComplete;
    expect(rowsInDom(table).at(-1)!.textContent).toContain('9999');
    expect(table.querySelectorAll('tr.tct-table-spacer').length).toBe(1);

    root.scrollTop = 0;
    await waitUntil(() => firstIndex(table) === 1, 'window returns to the top');
  });

  it('sorts 10,000 rows within the interaction budget', async () => {
    const {table, rows, state} = await setup(10_000);
    await table.updateComplete;
    const timings: Record<string, Measurement> = {};
    for (const [label, key] of [
      ['name', 'name'],
      ['age', 'age'],
      ['name descending', 'name'],
      ['score', 'score'],
    ] as const) {
      timings[label] = await measure(
        async () => {
          await userEvent.click(sortButton(table, key));
        },
        async () => {
          await state.settled();
          await table.updateComplete;
        },
      );
    }
    console.log('10k sort timings (ms):', JSON.stringify(timings));

    // The sorted result is right: the last click sorted by score, ascending.
    const scores = rowsInDom(table)
      .slice(0, 30)
      .map((row) => Number(row.cells[3]!.textContent));
    expect(scores).toEqual([...scores].sort((a, b) => a - b));
    const lowest = Math.min(...rows.map((row) => row.score));
    expect(scores[0]).toBe(lowest);
    expect(table.querySelector('table')!.getAttribute('aria-rowcount')).toBe('10000');

    for (const [label, timing] of Object.entries(timings)) {
      expect(timing.inp, `${label}: INP`).toBeLessThanOrEqual(200);
      expect(timing.longestTask, `${label}: longest task`).toBeLessThan(120);
    }
  });

  it('selects one row and then every row within the interaction budget', async () => {
    const {table, rows} = await setup(10_000);
    const selection = new TableSelectionStateController<Employee>(table, {data: rows, idKey: 'id'});
    const plugin = new TableSelectionController<Employee>(table, selection.selectionConfig);
    table.plugins = {...table.plugins, selection: plugin};
    await table.updateComplete;
    const box = table.querySelector<HTMLElement>('tbody tct-checkbox-input')!;
    const single = await measure(
      async () => {
        await userEvent.click(box);
      },
      () => table.updateComplete,
    );
    console.log('10k single selection (ms):', JSON.stringify(single));
    expect(selection.selectedKeys.size).toBe(1);
    expect(single.inp).toBeLessThanOrEqual(200);
    expect(single.longestTask).toBeLessThan(120);

    const all = table.querySelector<HTMLElement>('thead tct-checkbox-input')!;
    const selectAll = await measure(
      async () => {
        await userEvent.click(all);
      },
      () => table.updateComplete,
    );
    console.log('10k select all (ms):', JSON.stringify(selectAll));
    expect(selection.selectedKeys.size).toBe(10_000);
    expect(selectAll.inp).toBeLessThanOrEqual(200);
  });

  describe('when the page itself scrolls', () => {
    it('follows the document scroll position when no ancestor clips the table', async () => {
      const rows = makeRows(3000);
      const root = await fixture<HTMLElement>('<div><tct-table></tct-table></div>');
      const table = root.querySelector<TctTable<Employee>>('tct-table')!;
      Object.assign(table, {data: rows, columns: COLUMNS, idKey: 'id'});
      await table.updateComplete;
      try {
        expect(table.hasAttribute('data-windowed')).toBe(true);
        expect(rowsInDom(table).length).toBeLessThan(150);
        const size = rowsInDom(table)[0]!.getBoundingClientRect().height;
        const top = table.getBoundingClientRect().top + window.scrollY;
        window.scrollTo(0, top + Math.floor(1500 * size));
        await waitUntil(() => firstIndex(table) > 1400, 'window follows the page scroll');
        await table.updateComplete;
        const near = rowsInDom(table).filter((row) => {
          const box = row.getBoundingClientRect();
          return box.top >= 0 && box.bottom <= window.innerHeight;
        });
        expect(near.length).toBeGreaterThan(3);
        expect(Math.abs(Number(near[0]!.getAttribute('aria-rowindex')) - 1500)).toBeLessThan(6);
      } finally {
        window.scrollTo(0, 0);
      }
    });
  });

  describe('when the table windows', () => {
    it('windows above 200 rows only, and never with windowing="off"', async () => {
      const small = await setup(200);
      await small.table.updateComplete;
      expect(small.table.hasAttribute('data-windowed')).toBe(false);
      expect(rowsInDom(small.table)).toHaveLength(200);
      expect(small.table.querySelector('table')!.hasAttribute('aria-rowcount')).toBe(false);

      const large = await setup(201);
      await large.table.updateComplete;
      expect(large.table.hasAttribute('data-windowed')).toBe(true);
      expect(rowsInDom(large.table).length).toBeLessThan(201);

      const off = await setup(1000, {windowing: 'off'});
      await off.table.updateComplete;
      expect(rowsInDom(off.table)).toHaveLength(1000);
      expect(off.table.hasAttribute('data-windowed')).toBe(false);
    });

    it('stops windowing when the data shrinks below the threshold and starts again when it grows', async () => {
      const {table, rows} = await setup(500);
      await table.updateComplete;
      expect(rowsInDom(table).length).toBeLessThan(500);
      table.data = rows.slice(0, 50);
      await table.updateComplete;
      expect(rowsInDom(table)).toHaveLength(50);
      expect(table.querySelectorAll('tr.tct-table-spacer')).toHaveLength(0);
      table.data = rows;
      await table.updateComplete;
      expect(rowsInDom(table).length).toBeLessThan(500);
    });

    it('keeps the stripes in step while the window moves', async () => {
      const {root, table} = await setup(2000, {striped: true});
      await table.updateComplete;
      const fill = (row: Element): string => getComputedStyle(row).backgroundColor;
      const rowsNow = (): HTMLTableRowElement[] => rowsInDom(table);
      const byParity = (parity: number): HTMLTableRowElement[] =>
        rowsNow().filter((row) => Number(row.getAttribute('aria-rowindex')) % 2 === parity);
      const check = (): void => {
        expect(new Set(byParity(0).map(fill)).size).toBe(1);
        expect(new Set(byParity(1).map(fill)).size).toBe(1);
        expect(fill(byParity(0)[0]!)).not.toBe(fill(byParity(1)[0]!));
      };
      check();
      const size = rowsNow()[0]!.getBoundingClientRect().height;
      root.scrollTop = Math.floor(900 * size);
      await waitUntil(() => firstIndex(table) > 800, 'window moved');
      await table.updateComplete;
      check();
      // Row 2 (an even, striped row) is the one the plain non-windowed table stripes.
      root.scrollTop = 0;
      await waitUntil(() => firstIndex(table) === 1, 'window back at the top');
      await table.updateComplete;
      expect(fill(rowsNow()[1]!)).not.toBe(fill(rowsNow()[0]!));
    });
  });
});
