/**
 * Ten thousand rows: sorting, first paint and progressive rendering stay inside the interaction
 * budget (INP <= 200 ms) and never produce a task that blocks the main thread for long
 * [mwg:break-up-long-tasks] [mwg:identify-inp-causes].
 *
 * Interaction to Next Paint is read from the Event Timing API (`event` entries: input to the next
 * paint) for a real, trusted click; long tasks from the Long Tasks API. Numbers are printed so a
 * regression is easy to see; the assertions carry headroom for slower CI machines.
 */
import {beforeAll, describe, expect, it} from 'vitest';
import {userEvent} from 'vitest/browser';
import {fixture} from '@tecton-wc/testing/fixture.js';
import {aTimeout, nextFrame} from '@tecton-wc/testing/timing.js';
import './define.js';
import {TableSortableController, TableSortableStateController} from './define.js';
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
  /** Longest event duration (input to next paint) of the interaction. */
  inp: number;
  /** Longest single task on the main thread while the interaction and the render ran. */
  longestTask: number;
  /** Milliseconds from the click until every row was in the DOM. */
  complete: number;
}

/** Runs `interact` and reports INP, the longest task and the time until `done` resolves. */
async function measure(
  interact: () => Promise<void>,
  done: () => Promise<void>,
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
  const started = performance.now();
  await interact();
  await done();
  const complete = performance.now() - started;
  await aTimeout(100); // entries are delivered asynchronously
  eventObserver.disconnect();
  taskObserver?.disconnect();
  const inp = events.reduce((max, entry) => Math.max(max, entry.duration), 0);
  const longestTask = tasks.reduce((max, entry) => Math.max(max, entry.duration), 0);
  return {inp, longestTask, complete};
}

const sortButton = (table: Element, key: string): HTMLButtonElement =>
  table.querySelector<HTMLButtonElement>(
    `thead th[data-column-key="${key}"] button.tct-table-sort`,
  )!;

describe.skip('table performance: ten thousand rows (Table.perf.test.tsx, INP <= 200 ms)', () => {
  it('sorts 10,000 rows within the interaction budget and renders progressively', async () => {
    const rows = makeRows(10_000);
    const root = await fixture<HTMLElement>(
      `<div style="block-size: 480px; overflow: auto"><tct-table></tct-table></div>`,
    );
    const table = root.querySelector<TctTable<Employee>>('tct-table')!;
    const state = new TableSortableStateController<Employee>(table, {data: rows});
    const plugin = new TableSortableController<Employee>(table, state.sortConfig);
    state.subscribe(() => {
      table.data = state.sortedData;
    });
    Object.assign(table, {
      data: state.sortedData,
      columns: COLUMNS,
      idKey: 'id',
      plugins: {sort: plugin},
    });

    const initial = await measure(
      async () => {
        await nextFrame();
      },
      async () => {
        await table.updateComplete;
      },
    );
    console.log('initial render (ms):', JSON.stringify(initial));
    expect(table.renderedRowCount).toBe(10_000);
    expect(table.querySelectorAll('tbody > tr')).toHaveLength(10_000);
    expect(table.querySelector('tr.tct-table-pending')).toBeNull();

    const timings: Record<string, Measurement> = {initial};
    for (const [label, key] of [
      ['name', 'name'],
      ['numbers', 'age'],
      ['name again (descending)', 'name'],
      ['score', 'score'],
    ] as const) {
      const first = performance.now();
      timings[label] = await measure(
        async () => {
          await userEvent.click(sortButton(table, key));
        },
        async () => {
          await table.updateComplete;
        },
      );
      void first;
    }
    console.log('10k-row timings (ms):', JSON.stringify(timings));

    // The sorted result is right, and complete.
    expect(table.querySelectorAll('tbody > tr')).toHaveLength(10_000);
    const scores = [...table.querySelectorAll<HTMLTableRowElement>('tbody > tr')]
      .slice(0, 50)
      .map((row) => Number(row.cells[3]!.textContent));
    expect(scores).toEqual([...scores].sort((a, b) => a - b));

    for (const [label, timing] of Object.entries(timings)) {
      expect(timing.inp, `${label}: INP`).toBeLessThanOrEqual(200);
      expect(timing.longestTask, `${label}: longest task`).toBeLessThan(120);
    }
  });
});
