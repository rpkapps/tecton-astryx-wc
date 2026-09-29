/**
 * `TableColumnSettingsStateController` (upstream `useTableColumnSettingsState`): which columns are
 * shown, and the operations on that set (toggle, show all, reset, set from a list) with the rule that
 * an `alwaysVisible` column can never be hidden. It is renderer-agnostic: pair it with any column
 * picker, and give `columnSettingsConfig` to `TableColumnSettingsController`.
 */
import type {ReactiveControllerHost} from 'lit';
import {TableStateController, type TableConfigSource} from '../table-plugin.js';
import type {ColumnSettingsOption, TableColumnSettingsConfig} from './column-settings.js';

/** Options of {@link TableColumnSettingsStateController}. */
export interface TableColumnSettingsStateOptions<TColumnKey extends string = string> {
  /** Every column the user can toggle. */
  columns: readonly ColumnSettingsOption<TColumnKey>[];
  /** Controlled active keys, in display order; pair it with `onChangeActiveColumnKeys`. */
  activeColumnKeys?: readonly TColumnKey[];
  /** Initial active keys for uncontrolled use. Default: every column. */
  defaultActiveColumnKeys?: readonly TColumnKey[];
  /** Called with the new active keys when they change through the operations below. */
  onChangeActiveColumnKeys?: (keys: readonly TColumnKey[]) => void;
  /** What "reset to default" returns to. Default: every column. */
  defaultColumnKeys?: readonly TColumnKey[];
}

export class TableColumnSettingsStateController<
  TColumnKey extends string = string,
> extends TableStateController {
  #active: readonly TColumnKey[];
  #controlled: boolean;
  readonly #options: TableColumnSettingsStateOptions<TColumnKey>;
  readonly #config: TableColumnSettingsConfig<TColumnKey> & TableConfigSource;

  constructor(
    host: ReactiveControllerHost | null,
    options: TableColumnSettingsStateOptions<TColumnKey>,
  ) {
    super(host);
    this.#options = options;
    this.#controlled = options.activeColumnKeys !== undefined;
    this.#active =
      options.activeColumnKeys ??
      options.defaultActiveColumnKeys ??
      options.columns.map((column) => column.key);
    // eslint-disable-next-line @typescript-eslint/no-this-alias -- the config reads this controller live
    const state = this;
    this.#config = {
      get columns() {
        return state.#options.columns;
      },
      get activeColumnKeys() {
        return state.#active;
      },
      get defaultColumnKeys() {
        return state.#options.defaultColumnKeys;
      },
      onChangeActiveColumnKeys: (keys) => {
        state.#commit(keys);
      },
      subscribe: (listener) => state.subscribe(listener),
    };
  }

  /** The columns shown, in display order. Writing it changes them without calling the callback. */
  get activeColumnKeys(): readonly TColumnKey[] {
    return this.#active;
  }
  set activeColumnKeys(value: readonly TColumnKey[]) {
    this.#active = value;
    this.notify();
  }

  /** The config to give `TableColumnSettingsController` (upstream `columnSettingsConfig`): a live view of this state. */
  get columnSettingsConfig(): TableColumnSettingsConfig<TColumnKey> {
    return this.#config;
  }

  /** Whether a column is shown. */
  isColumnActive(key: TColumnKey): boolean {
    return this.#active.includes(key);
  }

  /** Whether a column can be toggled: false for `alwaysVisible` columns. */
  isColumnToggleable(key: TColumnKey): boolean {
    return !this.#options.columns.some((column) => column.key === key && column.alwaysVisible);
  }

  /** Shows a hidden column (at the end) or hides a shown one; a no-op for `alwaysVisible` columns. */
  toggleColumn(key: TColumnKey): void {
    if (!this.isColumnToggleable(key)) return;
    this.#commit(
      this.#active.includes(key) ? this.#active.filter((k) => k !== key) : [...this.#active, key],
    );
  }

  /** Shows every column. */
  showAllColumns(): void {
    this.#commit(this.#options.columns.map((column) => column.key));
  }

  /** Returns to `defaultColumnKeys`, or shows every column when none is given. */
  resetToDefault(): void {
    this.#commit(
      this.#options.defaultColumnKeys
        ? [...this.#options.defaultColumnKeys]
        : this.#options.columns.map((column) => column.key),
    );
  }

  /**
   * Sets the active keys from a list (an `onChange` handler of any list-based picker). Always-visible
   * columns that the list left out are added back.
   */
  setActiveColumnKeys(keys: readonly string[]): void {
    const next = new Set<string>(keys);
    for (const column of this.#options.columns) if (column.alwaysVisible) next.add(column.key);
    this.#commit([...next] as TColumnKey[]);
  }

  #commit(keys: readonly TColumnKey[]): void {
    if (!this.#controlled) this.#active = keys;
    this.#options.onChangeActiveColumnKeys?.(keys);
    this.notify();
  }
}
