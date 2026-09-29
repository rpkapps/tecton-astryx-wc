/**
 * `TableColumnSettingsController` (upstream `useTableColumnSettings`): shows and orders columns. It
 * keeps only the columns whose key is in `activeColumnKeys`, in that order, before any other plugin
 * sees them (it runs first in the canonical order), so sort, tree and selection work on what is shown.
 * The state (which columns, in what order, reset and toggle) lives in the config;
 * `TableColumnSettingsStateController` provides it, and any picker UI (a multi-selector, a checkbox list,
 * drag and drop) can drive it.
 */
import type {TableColumn} from '../table.types.js';
import {TablePluginController} from '../table-plugin.js';

/**
 * A column as the settings UI knows it: the metadata a picker needs, which the table column does not
 * carry.
 */
export interface ColumnSettingsOption<TColumnKey extends string = string> {
  /** The column key; must match `TableColumn.key`. */
  key: TColumnKey;
  /** Label for the settings UI. */
  label: string;
  /** The column cannot be hidden: it is always shown and its toggle is disabled. Default `false`. */
  alwaysVisible?: boolean;
  /** Group heading for organised column lists. */
  group?: string;
}

/** Config of {@link TableColumnSettingsController}, and what the state controller feeds it. */
export interface TableColumnSettingsConfig<TColumnKey extends string = string> {
  /** Every column the user can toggle, with metadata for the settings UI. */
  columns: readonly ColumnSettingsOption<TColumnKey>[];
  /** The columns shown, in display order. */
  activeColumnKeys: readonly TColumnKey[];
  /** Called with the new active keys (a toggle, a reorder). */
  onChangeActiveColumnKeys: (keys: readonly TColumnKey[]) => void;
  /** The set "reset to default" returns to. Default: every column. */
  defaultColumnKeys?: readonly TColumnKey[];
}

export class TableColumnSettingsController<
  T extends Record<string, unknown> = Record<string, unknown>,
  TColumnKey extends string = string,
> extends TablePluginController<T, TableColumnSettingsConfig<TColumnKey>> {
  transformColumns = (columns: TableColumn<T>[]): TableColumn<T>[] => {
    const active = this.config.activeColumnKeys;
    const order = new Map<string, number>(active.map((key, index) => [key, index]));
    return columns
      .filter((column) => order.has(column.key))
      .sort((a, b) => order.get(a.key)! - order.get(b.key)!);
  };
}
