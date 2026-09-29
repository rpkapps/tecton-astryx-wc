/**
 * `TableSortableStateController` (upstream `useTableSortableState`): owns the sort state (or follows a
 * controlled one), applies it to the data, and is the config of `TableSortableController`, so the
 * pair is `new TableSortableController(host, state)`. It sorts a copy: your data is never mutated.
 *
 * Columns without a comparator compare by value: numbers numerically, everything else by an
 * `Intl.Collator` with numeric collation for the element's locale, and missing values (null,
 * undefined, NaN) always sort last. Sorting decorates each row with its keys once, so a comparison is
 * two array reads plus (for text) one collator call: ten thousand rows sort in a few tens of
 * milliseconds. [mwg:break-up-long-tasks]
 */
import type {ReactiveControllerHost} from 'lit';
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

  /** The sorted copy of `data`; the same array while `data`, the sort and the comparators are unchanged. */
  get sortedData(): T[] {
    const cache = this.#cache;
    if (
      cache?.data === this.#data &&
      cache.sort === this.#sort &&
      cache.comparators === this.#comparators
    ) {
      return cache.result;
    }
    const result = this.applySort(this.#data);
    this.#cache = {data: this.#data, sort: this.#sort, comparators: this.#comparators, result};
    return result;
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
  const keys = sort.map((entry) => {
    const custom = comparators?.[entry.sortKey];
    if (custom) return {custom, sign: entry.direction === 'ascending' ? 1 : -1, values: null};
    const values = new Array<SortValue>(count);
    for (let i = 0; i < count; i++) values[i] = toSortValue(data[i]![entry.sortKey]);
    return {custom: null, sign: entry.direction === 'ascending' ? 1 : -1, values};
  });

  const order = new Array<number>(count);
  for (let i = 0; i < count; i++) order[i] = i;
  order.sort((a, b) => {
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
  });
  const sorted = new Array<T>(count);
  for (let i = 0; i < count; i++) sorted[i] = data[order[i]!]!;
  return sorted;
}
