/**
 * `TableSelectionStateController` (upstream `useTableSelectionState`): the selection set and the rules
 * around it, as the config of `TableSelectionController`. Select-all works on the rows that are both
 * selectable and enabled (the "actionable" ones): it adds them and never touches a disabled row, and
 * deselect-all removes them and keeps a disabled row that was already selected. The header checkbox is
 * "all selected" only when there is at least one actionable row, so a filter with no matches cannot show
 * a checked header over an empty table.
 *
 * ```ts
 * const state = new TableSelectionStateController(host, {data: rows, idKey: 'id'});
 * const selection = new TableSelectionController(host, state.selectionConfig);
 * ```
 */
import type {ReactiveControllerHost} from 'lit';
import {TableStateController, type TableConfigSource} from '../table-plugin.js';
import type {TableSelectionConfig} from './selection.js';

/** Options of {@link TableSelectionStateController}. */
export interface TableSelectionStateOptions<T extends Record<string, unknown>> {
  /**
   * The rows currently rendered. Pass the filtered, visible rows, not the whole dataset: select-all
   * operates on this array, so unfiltered data would select rows the user cannot see.
   */
  data?: T[];
  /** The unique id of a row: a property name or a function. */
  idKey: (keyof T & string) | ((item: T) => string);
  /** Does this row show a checkbox? Rows without one are left out of select-all. Default: all do. */
  getIsItemSelectable?: (item: T) => boolean;
  /** Is this row's checkbox operable? A disabled row is frozen: select-all neither adds nor removes it. */
  getIsItemEnabled?: (item: T) => boolean;
  /** A human-readable identity for a row's checkbox name ("Select Alice"). */
  getRowLabel?: (item: T) => string;
  /** Selected row ids for controlled use; pair it with `onSelectedKeysChange`. */
  selectedKeys?: ReadonlySet<string>;
  /** Initial selection for uncontrolled use; ignored when `selectedKeys` is given. */
  defaultSelectedKeys?: Iterable<string>;
  /** Called with the next set (a new Set, never a mutation) when the user changes the selection. */
  onSelectedKeysChange?: (selectedKeys: Set<string>) => void;
  /** Keep the selected fill off checked rows (passed to the plugin config). */
  noRowHighlight?: boolean;
}

interface Derived {
  data: readonly unknown[];
  selectedKeys: ReadonlySet<string>;
  actionable: Set<string>;
  frozen: Set<string>;
  union: Set<string>;
  actionableSelected: number;
}

export class TableSelectionStateController<
  T extends Record<string, unknown> = Record<string, unknown>,
> extends TableStateController {
  #data: T[];
  #selectedKeys: ReadonlySet<string>;
  #controlled: boolean;
  readonly #options: TableSelectionStateOptions<T>;
  readonly #config: TableSelectionConfig<T> & TableConfigSource;
  #derived: Derived | undefined;

  constructor(host: ReactiveControllerHost | null, options: TableSelectionStateOptions<T>) {
    super(host);
    this.#options = options;
    this.#data = options.data ?? [];
    this.#controlled = options.selectedKeys !== undefined;
    this.#selectedKeys = options.selectedKeys ?? new Set(options.defaultSelectedKeys);
    // eslint-disable-next-line @typescript-eslint/no-this-alias -- the config reads this controller live
    const state = this;
    this.#config = {
      getIsItemSelected: (item) => state.#selectedKeys.has(state.#id(item)),
      onSelectItem: ({item, isSelected}) => {
        const next = new Set(state.#selectedKeys);
        const id = state.#id(item);
        if (isSelected) next.add(id);
        else next.delete(id);
        state.#commit(next);
      },
      onSelectAll: ({isAllSelected}) => {
        const derived = state.#derive();
        state.#commit(new Set(isAllSelected ? derived.union : derived.frozen));
      },
      getIsAllSelected: () => {
        const derived = state.#derive();
        // At least one actionable row: with none visible, a non-empty selection must not read as "all".
        return derived.actionable.size > 0 && derived.union.size === state.#selectedKeys.size;
      },
      getIsIndeterminate: () => {
        const derived = state.#derive();
        return (
          derived.actionableSelected > 0 && derived.actionableSelected < derived.actionable.size
        );
      },
      getIsItemSelectable: options.getIsItemSelectable,
      getIsItemEnabled: options.getIsItemEnabled,
      getRowLabel: options.getRowLabel,
      get noRowHighlight() {
        return options.noRowHighlight;
      },
      subscribe: (listener) => state.subscribe(listener),
    };
  }

  /** The rows select-all operates on. */
  get data(): T[] {
    return this.#data;
  }
  set data(value: T[]) {
    this.#data = value;
    this.notify();
  }

  /** The selected row ids. Writing it changes the selection without calling `onSelectedKeysChange`. */
  get selectedKeys(): ReadonlySet<string> {
    return this.#selectedKeys;
  }
  set selectedKeys(value: ReadonlySet<string>) {
    this.#selectedKeys = value;
    this.notify();
  }

  /** The config to give `TableSelectionController` (upstream `selectionConfig`): a live view of this state. */
  get selectionConfig(): TableSelectionConfig<T> {
    return this.#config;
  }

  /** Selects every actionable row (programmatic: `onSelectedKeysChange` is not called). */
  selectAll(): void {
    this.#selectedKeys = new Set(this.#derive().union);
    this.notify();
  }

  /** Deselects every actionable row and keeps the frozen ones (programmatic). */
  clear(): void {
    this.#selectedKeys = new Set(this.#derive().frozen);
    this.notify();
  }

  #id(item: T): string {
    const idKey = this.#options.idKey;
    return typeof idKey === 'function' ? idKey(item) : String(item[idKey]);
  }

  #commit(next: Set<string>): void {
    if (!this.#controlled) this.#selectedKeys = next;
    this.#options.onSelectedKeysChange?.(next);
    this.notify();
  }

  /** The sets select-all and the header state need, computed once per (data, selection) pair. */
  #derive(): Derived {
    const cached = this.#derived;
    if (cached?.data === this.#data && cached.selectedKeys === this.#selectedKeys) return cached;
    const {getIsItemSelectable, getIsItemEnabled} = this.#options;
    const actionable = new Set<string>();
    for (const item of this.#data) {
      if ((getIsItemSelectable?.(item) ?? true) && (getIsItemEnabled?.(item) ?? true)) {
        actionable.add(this.#id(item));
      }
    }
    const frozen = new Set<string>();
    let actionableSelected = 0;
    for (const id of this.#selectedKeys) {
      if (actionable.has(id)) actionableSelected += 1;
      else frozen.add(id);
    }
    const union = new Set<string>([...this.#selectedKeys, ...actionable]);
    this.#derived = {
      data: this.#data,
      selectedKeys: this.#selectedKeys,
      actionable,
      frozen,
      union,
      actionableSelected,
    };
    return this.#derived;
  }
}
