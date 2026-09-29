/**
 * `TableTreeStateController` (upstream `useTableTreeState`): owns the expanded set (or follows a
 * controlled one) and flattens the nested data into the rows that are visible. Children mount only when
 * their parent is expanded, so a collapsed subtree is not in the DOM. It also produces the config of
 * `TableTreeDataController` (`treeConfig`).
 *
 * The walk is depth-first and guards against cycles: an edge back to an ancestor is skipped instead of
 * recursing forever. Sibling arrays are copied before `sortSiblings`, so an in-place sorter cannot
 * reorder your data. Duplicate ids in different subtrees share one expansion state.
 */
import type {ReactiveControllerHost} from 'lit';
import {TableStateController, type TableConfigSource} from '../table-plugin.js';
import type {TableTreeDataConfig, TableTreeIndent, TableTreeRowMeta} from './tree.js';

/** Options of {@link TableTreeStateController}. */
export interface TableTreeStateOptions<T extends Record<string, unknown>> {
  /** The nested data: rows may carry child rows under `childrenKey`. */
  data?: T[];
  /** The row id: a property name or a function returning a unique id. */
  idKey: (keyof T & string) | ((item: T) => string | number);
  /** The property holding a row's children. Default `children`. */
  childrenKey?: string;
  /** Initial expanded ids for uncontrolled use; ignored when `expandedIds` is given. */
  defaultExpandedIds?: Iterable<string>;
  /** Controlled expanded ids; pair it with `onExpandedIdsChange`. */
  expandedIds?: ReadonlySet<string>;
  /** Called with the next expanded set on every user change. */
  onExpandedIdsChange?: (ids: ReadonlySet<string>) => void;
  /**
   * Does this row show an expander? Overrides "has a non-empty children array": use it for lazy loading,
   * where a row expands before its children are fetched.
   */
  isItemExpandable?: (item: T) => boolean;
  /**
   * Sorts each sibling group independently while flattening; children always stay under their parent.
   * Pass `applySort` of a sort state controller to compose with column sorting.
   */
  sortSiblings?: (siblings: T[]) => T[];
  /** Indent step (forwarded to the plugin config). */
  indent?: TableTreeIndent;
  /** The tree column (forwarded to the plugin config). */
  treeColumnKey?: string;
  /** Show the expand-all toggle in the tree column header (forwarded to the plugin config). */
  expandAllControl?: boolean;
  /** Toggle a row on a click anywhere on it (forwarded to the plugin config). */
  rowClickExpansion?: boolean;
}

interface Flattened<T> {
  rows: T[];
  meta: Map<string, TableTreeRowMeta>;
}

export class TableTreeStateController<
  T extends Record<string, unknown> = Record<string, unknown>,
> extends TableStateController {
  #data: T[];
  #expanded: ReadonlySet<string>;
  #controlled: boolean;
  readonly #options: TableTreeStateOptions<T>;
  readonly #config: TableTreeDataConfig<T> & TableConfigSource;
  #flattened:
    {source: T[]; expanded: ReadonlySet<string>; stamp: number; value: Flattened<T>} | undefined;
  #stamp = 0;
  #expandable: {source: T[]; ids: string[]} | undefined;

  constructor(host: ReactiveControllerHost | null, options: TableTreeStateOptions<T>) {
    super(host);
    this.#options = options;
    this.#data = options.data ?? [];
    this.#controlled = options.expandedIds !== undefined;
    this.#expanded = options.expandedIds ?? new Set(options.defaultExpandedIds);
    // eslint-disable-next-line @typescript-eslint/no-this-alias -- the config reads this controller live
    const state = this;
    this.#config = {
      getRowMeta: (item) => state.#flatten().meta.get(state.#id(item)),
      onToggleItem: (item) => {
        state.#toggle(item);
      },
      get hasExpandableRows() {
        return state.#expandableIds().length > 0;
      },
      get isAllExpanded() {
        return state.isAllExpanded;
      },
      onExpandAll: () => {
        state.expandAll();
      },
      onCollapseAll: () => {
        state.collapseAll();
      },
      get expandAllControl() {
        return state.#options.expandAllControl;
      },
      get indent() {
        return state.#options.indent;
      },
      get treeColumnKey() {
        return state.#options.treeColumnKey;
      },
      get rowClickExpansion() {
        return state.#options.rowClickExpansion;
      },
      subscribe: (listener) => state.subscribe(listener),
    };
  }

  /** The nested data. Assigning it re-flattens. */
  get data(): T[] {
    return this.#data;
  }
  set data(value: T[]) {
    this.#data = value;
    this.notify();
  }

  /** The expanded row ids. Writing it changes the state without calling `onExpandedIdsChange`. */
  get expandedIds(): ReadonlySet<string> {
    return this.#expanded;
  }
  set expandedIds(value: ReadonlySet<string>) {
    this.#expanded = value;
    this.notify();
  }

  /** The flattened, currently visible rows. Give this to the table's `data`. */
  get visibleData(): T[] {
    return this.#flatten().rows;
  }

  /** The config to give `TableTreeDataController` (upstream `treeConfig`): a live view of this state. */
  get treeConfig(): TableTreeDataConfig<T> {
    return this.#config;
  }

  /**
   * Aggregate state across every expandable row: `true` when all are expanded, `false` when none are,
   * `'indeterminate'` when some are. `false` for flat data.
   */
  get isAllExpanded(): boolean | 'indeterminate' {
    const ids = this.#expandableIds();
    if (ids.length === 0) return false;
    const open = ids.filter((id) => this.#expanded.has(id)).length;
    if (open === 0) return false;
    return open === ids.length ? true : 'indeterminate';
  }

  /**
   * Re-flattens on the next read. Call it when something `sortSiblings` depends on changed without the
   * data changing (a sort state): `sort.subscribe(() => tree.invalidate())`.
   */
  invalidate(): void {
    this.#stamp += 1;
    this.notify();
  }

  /** Expands every expandable row in the tree. */
  expandAll(): void {
    this.#commit(new Set(this.#expandableIds()));
  }

  /** Collapses every row. */
  collapseAll(): void {
    this.#commit(new Set());
  }

  // ------------------------------------------------------------------------------- internals

  #id(item: T): string {
    const idKey = this.#options.idKey;
    return typeof idKey === 'function' ? String(idKey(item)) : String(item[idKey]);
  }

  #children(item: T): T[] {
    const children = item[this.#options.childrenKey ?? 'children'];
    return Array.isArray(children) ? (children as T[]) : [];
  }

  #isExpandable(item: T): boolean {
    const custom = this.#options.isItemExpandable;
    return custom ? custom(item) : this.#children(item).length > 0;
  }

  #commit(next: ReadonlySet<string>): void {
    if (!this.#controlled) this.#expanded = next;
    this.#options.onExpandedIdsChange?.(next);
    this.notify();
  }

  #toggle(item: T): void {
    // Built on the state as it is now, so two toggles in one task both land.
    const next = new Set(this.#expanded);
    const id = this.#id(item);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.#commit(next);
  }

  /** Depth-first: emits only visible rows and collects their meta in the same pass. */
  #flatten(): Flattened<T> {
    const cached = this.#flattened;
    if (
      cached?.source === this.#data &&
      cached.expanded === this.#expanded &&
      cached.stamp === this.#stamp
    ) {
      return cached.value;
    }
    const rows: T[] = [];
    const meta = new Map<string, TableTreeRowMeta>();
    const path = new Set<string>();
    const sortSiblings = this.#options.sortSiblings;
    const walk = (items: T[], level: number): void => {
      const siblings = sortSiblings ? sortSiblings([...items]) : items;
      for (const item of siblings) {
        const id = this.#id(item);
        if (path.has(id)) continue; // a cyclic edge: this row is its own ancestor
        const hasChildren = this.#isExpandable(item);
        const isExpanded = hasChildren && this.#expanded.has(id);
        rows.push(item);
        meta.set(id, {id, level, hasChildren, isExpanded});
        if (isExpanded) {
          path.add(id);
          walk(this.#children(item), level + 1);
          path.delete(id);
        }
      }
    };
    walk(this.#data, 0);
    const value = {rows, meta};
    this.#flattened = {source: this.#data, expanded: this.#expanded, stamp: this.#stamp, value};
    return value;
  }

  /** Every expandable row id in the whole tree, collapsed subtrees included. */
  #expandableIds(): string[] {
    const cached = this.#expandable;
    if (cached?.source === this.#data) return cached.ids;
    const ids: string[] = [];
    const path = new Set<string>();
    const walk = (items: T[]): void => {
      for (const item of items) {
        const id = this.#id(item);
        if (path.has(id)) continue;
        if (this.#isExpandable(item)) ids.push(id);
        path.add(id);
        walk(this.#children(item));
        path.delete(id);
      }
    };
    walk(this.#data);
    this.#expandable = {source: this.#data, ids};
    return ids;
  }
}
