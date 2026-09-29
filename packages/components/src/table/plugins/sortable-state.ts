/**
 * `TableSortableStateController` (upstream `useTableSortableState`): owns the sort state (or follows a
 * controlled one), applies it to the data, and is the config of `TableSortableController`, so the
 * pair is `new TableSortableController(host, state)`. It sorts a copy: your data is never mutated.
 *
 * Columns without a comparator compare by value: numbers numerically, everything else by an
 * `Intl.Collator` with numeric collation for the element's locale, and missing values (null,
 * undefined, NaN) always sort last. Sorting decorates each row with its keys once, so a comparison is
 * two array reads plus (for text) one collator call: ten thousand rows sort in a few tens of
 * milliseconds.
 *
 * Above {@link TABLE_ASYNC_SORT_ROWS} rows the sort runs in slices of a few milliseconds with a yield to
 * the main thread between them (a merge sort over sorted runs), so a click on a header paints its new
 * sort state at once instead of waiting for the sort. While it runs, `sortedData` keeps returning the
 * previous order (the raw rows if the data itself changed), `sorting` is true, and the state notifies
 * when the sorted rows are ready; `settled()` resolves then. [mwg:break-up-long-tasks]
 */
import type {ReactiveControllerHost} from 'lit';
import {yieldToMain} from '../table-scheduler.js';
import {TableStateController, type TableConfigSource} from '../table-plugin.js';
import type {TableSortableConfig, TableSortState} from './sortable.js';

/**
 * Comparator of one sort key over two rows. Return ascending order; the direction is applied for you.
 */
export type TableSortComparator<T> = (a: T, b: T) => number;

/** Options of {@link TableSortableStateController}. */
export interface TableSortableStateOptions<
  T extends Record<string, unknown>,
  TSortKey extends string = string,
> {
  /** The rows to sort. */
  data?: T[];
  /** Initial sort for uncontrolled use; ignored when `sort` is given. Default: unsorted. */
  defaultSort?: TableSortState<TSortKey>;
  /** Controlled sort state; pair it with `onSortChange`. */
  sort?: TableSortState<TSortKey>;
  /** Called with the new state when the user changes the sort. */
  onSortChange?: (sort: TableSortState<TSortKey>) => void;
  /** Comparators by sort key, for values the default comparison does not order the way you want. */
  comparators?: Partial<Record<TSortKey, TableSortComparator<T>>>;
  /** Passed to the plugin config: allow returning to the unsorted state. Default `true`. */
  allowUnsortedState?: boolean;
  /** Passed to the plugin config: Shift+click adds secondary sort keys. Default `false`. */
  multiSort?: boolean;
  /** The collator for the default comparison. Default: numeric collation for the nearest `lang`. */
  collator?: () => Intl.Collator;
  /** The element whose `lang` picks the locale of the default comparison. Default: the Lit host, else the document. */
  element?: Element;
}

/** Datasets larger than this sort in yielding slices instead of one synchronous call. */
export const TABLE_ASYNC_SORT_ROWS = 2000;
/** Rows of a run that one slice sorts. */
const RUN_ROWS = 1024;
/** Time one slice of an asynchronous sort may take before it yields (ms). */
const SLICE_MS = 8;

const MISSING = Symbol('missing');
type SortValue = number | string | typeof MISSING;

function toSortValue(value: unknown): SortValue {
  if (value == null || (typeof value === 'number' && Number.isNaN(value))) return MISSING;
  if (typeof value === 'number') return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  if (typeof value === 'boolean' || typeof value === 'bigint') return String(value);
  return '';
}

/** The nearest `lang` of the host (crossing shadow roots), else the document's. */
function nearestLang(host: unknown): string | undefined {
  if (typeof Element === 'undefined') return undefined;
  if (host instanceof Element) {
    for (let node: Node | null = host; node; node = node.parentNode ?? (node as ShadowRoot).host) {
      const lang = node instanceof Element ? node.getAttribute('lang') : null;
      if (lang) return lang;
    }
  }
  return document.documentElement.lang || undefined;
}

export class TableSortableStateController<
  T extends Record<string, unknown> = Record<string, unknown>,
  TSortKey extends string = string,
> extends TableStateController {
  #data: T[];
  #sort: TableSortState<TSortKey>;
  #controlled: boolean;
  #comparators: Partial<Record<TSortKey, TableSortComparator<T>>> | undefined;
  readonly #options: TableSortableStateOptions<T, TSortKey>;
  readonly #hostElement: unknown;
  #cache:
    {data: T[]; sort: TableSortState<TSortKey>; comparators: unknown; result: T[]} | undefined;
  #running: {data: T[]; sort: TableSortState<TSortKey>; comparators: unknown} | undefined;
  #waiters: (() => void)[] = [];

  constructor(
    host: ReactiveControllerHost | null,
    options: TableSortableStateOptions<T, TSortKey> = {},
  ) {
    super(host);
    this.#hostElement = host;
    this.#options = options;
    this.#data = options.data ?? [];
    this.#controlled = options.sort !== undefined;
    this.#sort = options.sort ?? options.defaultSort ?? [];
    this.#comparators = options.comparators;
    // Read live by the plugin: every field is a getter over the current state.
    // eslint-disable-next-line @typescript-eslint/no-this-alias -- the getters below read this controller
    const state = this;
    this.#config = {
      get sort() {
        return state.#sort;
      },
      get allowUnsortedState() {
        return state.#options.allowUnsortedState;
      },
      get multiSort() {
        return state.#options.multiSort;
      },
      onSortChange: (next) => {
        if (!state.#controlled) state.#sort = next;
        state.#options.onSortChange?.(next);
        state.notify();
      },
      subscribe: (listener) => state.subscribe(listener),
    };
  }

  readonly #config: TableSortableConfig<TSortKey> & TableConfigSource;

  /** The rows to sort. Assigning a new array (or the same one after editing) re-sorts on the next read. */
  get data(): T[] {
    return this.#data;
  }
  set data(value: T[]) {
    this.#data = value;
    this.notify();
  }

  /** The current sort state. Writing it changes the state without calling `onSortChange`. */
  get sort(): TableSortState<TSortKey> {
    return this.#sort;
  }
  set sort(value: TableSortState<TSortKey>) {
    this.#sort = value;
    this.notify();
  }

  /** Comparators by sort key. */
  get comparators(): Partial<Record<TSortKey, TableSortComparator<T>>> | undefined {
    return this.#comparators;
  }
  set comparators(value: Partial<Record<TSortKey, TableSortComparator<T>>> | undefined) {
    this.#comparators = value;
    this.notify();
  }

  /**
   * The sorted copy of `data`; the same array while `data`, the sort and the comparators are unchanged.
   * A large dataset sorts asynchronously: until it is done this is the previous order (or the raw rows,
   * when the data changed) and `sorting` is true.
   */
  get sortedData(): T[] {
    const cache = this.#cache;
    const data = this.#data;
    const sort = this.#sort;
    const comparators = this.#comparators;
    if (cache?.data === data && cache.sort === sort && cache.comparators === comparators) {
      return cache.result;
    }
    if (sort.length === 0 || data.length <= TABLE_ASYNC_SORT_ROWS) {
      this.#running = undefined;
      const result = this.applySort(data);
      this.#cache = {data, sort, comparators, result};
      this.#release();
      return result;
    }
    const running = this.#running;
    if (running?.data !== data || running.sort !== sort || running.comparators !== comparators) {
      this.#run(data, sort, comparators);
    }
    return cache?.data === data ? cache.result : data;
  }

  /** Whether a sort is still running in the background (large datasets only). */
  get sorting(): boolean {
    return this.#running !== undefined;
  }

  /** Resolves when no sort is running, that is, when `sortedData` is the sorted rows. */
  settled(): Promise<void> {
    if (!this.#running) return Promise.resolve();
    return new Promise((resolve) => {
      this.#waiters.push(resolve);
    });
  }

  #run(data: T[], sort: TableSortState<TSortKey>, comparators: unknown): void {
    const job = {data, sort, comparators};
    this.#running = job;
    const current = (): boolean => this.#running === job;
    void sortRowsSliced(data, sort, this.#comparators, this.#collator(), current).then((result) => {
      if (!result || !current()) return;
      this.#running = undefined;
      this.#cache = {data, sort, comparators, result};
      this.#release();
      this.notify();
    });
  }

  #release(): void {
    for (const resolve of this.#waiters.splice(0)) resolve();
  }

  /**
   * The config to give `TableSortableController` (upstream `sortConfig`): a live view of this state, so
   * `new TableSortableController(host, state.sortConfig)` follows every change.
   */
  get sortConfig(): TableSortableConfig<TSortKey> {
    return this.#config;
  }

  /** Applies the current sort to any rows, for several data sources or a subset. */
  applySort(data: T[]): T[] {
    return sortRows(data, this.#sort, this.#comparators, this.#collator());
  }

  #collator(): Intl.Collator {
    return (
      this.#options.collator?.() ??
      new Intl.Collator(nearestLang(this.#options.element ?? this.#hostElement) ?? undefined, {
        numeric: true,
      })
    );
  }
}

/** The two-index comparator of a sort over decorated keys. */
function indexComparator<T extends Record<string, unknown>, TSortKey extends string>(
  data: T[],
  sort: TableSortState<TSortKey>,
  comparators: Partial<Record<TSortKey, TableSortComparator<T>>> | undefined,
  collator: Intl.Collator,
): (a: number, b: number) => number {
  const count = data.length;
  const keys = sort.map((entry) => {
    const custom = comparators?.[entry.sortKey];
    if (custom) return {custom, sign: entry.direction === 'ascending' ? 1 : -1, values: null};
    const values = new Array<SortValue>(count);
    for (let i = 0; i < count; i++) values[i] = toSortValue(data[i]![entry.sortKey]);
    return {custom: null, sign: entry.direction === 'ascending' ? 1 : -1, values};
  });
  return (a, b) => {
    for (const key of keys) {
      let result: number;
      if (key.custom) {
        result = key.custom(data[a]!, data[b]!);
      } else {
        const x = key.values![a]!;
        const y = key.values![b]!;
        // Missing values sort last in either direction.
        if (x === MISSING || y === MISSING) {
          if (x === y) continue;
          return x === MISSING ? 1 : -1;
        }
        result =
          typeof x === 'number' && typeof y === 'number'
            ? x - y
            : collator.compare(String(x), String(y));
      }
      if (result !== 0) return key.sign * result;
    }
    return 0;
  };
}

/**
 * Sorts a copy of `data` by `sort`. Default-compared keys are decorated once per row; a custom
 * comparator runs on the rows themselves. The sort is stable, so equal rows keep their order.
 */
export function sortRows<T extends Record<string, unknown>, TSortKey extends string>(
  data: T[],
  sort: TableSortState<TSortKey>,
  comparators: Partial<Record<TSortKey, TableSortComparator<T>>> | undefined,
  collator: Intl.Collator,
): T[] {
  if (sort.length === 0) return data;
  const count = data.length;
  const compare = indexComparator(data, sort, comparators, collator);
  const order = new Array<number>(count);
  for (let i = 0; i < count; i++) order[i] = i;
  order.sort(compare);
  const sorted = new Array<T>(count);
  for (let i = 0; i < count; i++) sorted[i] = data[order[i]!]!;
  return sorted;
}

/** Merges two sorted runs of row indices; equal rows keep the left run first, so the sort is stable. */
function mergeRuns(
  left: number[],
  right: number[],
  compare: (a: number, b: number) => number,
): number[] {
  const merged = new Array<number>(left.length + right.length);
  let i = 0;
  let j = 0;
  let k = 0;
  while (i < left.length && j < right.length) {
    merged[k++] = compare(left[i]!, right[j]!) <= 0 ? left[i++]! : right[j++]!;
  }
  while (i < left.length) merged[k++] = left[i++]!;
  while (j < right.length) merged[k++] = right[j++]!;
  return merged;
}

/**
 * The same result as {@link sortRows}, computed in slices: sorted runs of `RUN_ROWS` rows, then merged
 * pairwise, yielding to the main thread whenever a slice has used its time. Resolves `null` as soon as
 * `isCurrent()` turns false (the sort was superseded), without finishing.
 */
export async function sortRowsSliced<T extends Record<string, unknown>, TSortKey extends string>(
  data: T[],
  sort: TableSortState<TSortKey>,
  comparators: Partial<Record<TSortKey, TableSortComparator<T>>> | undefined,
  collator: Intl.Collator,
  isCurrent: () => boolean = () => true,
): Promise<T[] | null> {
  if (sort.length === 0) return data;
  const count = data.length;
  let deadline = performance.now() + SLICE_MS;
  const keepGoing = async (): Promise<boolean> => {
    if (performance.now() < deadline) return true;
    await yieldToMain();
    deadline = performance.now() + SLICE_MS;
    return isCurrent();
  };
  // Let the click that started the sort paint before the first slice.
  await yieldToMain();
  if (!isCurrent()) return null;
  deadline = performance.now() + SLICE_MS;
  const compare = indexComparator(data, sort, comparators, collator);
  let runs: number[][] = [];
  for (let start = 0; start < count; start += RUN_ROWS) {
    const run = new Array<number>(Math.min(RUN_ROWS, count - start));
    for (let i = 0; i < run.length; i++) run[i] = start + i;
    run.sort(compare);
    runs.push(run);
    if (!(await keepGoing())) return null;
  }
  while (runs.length > 1) {
    const next: number[][] = [];
    for (let i = 0; i < runs.length; i += 2) {
      next.push(i + 1 < runs.length ? mergeRuns(runs[i]!, runs[i + 1]!, compare) : runs[i]!);
      if (!(await keepGoing())) return null;
    }
    runs = next;
  }
  const order = runs[0] ?? [];
  const sorted = new Array<T>(count);
  for (let i = 0; i < count; i++) sorted[i] = data[order[i]!]!;
  return sorted;
}
