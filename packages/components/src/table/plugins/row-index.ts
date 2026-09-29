/**
 * `TableRowIndexController` (upstream `useTableRowIndex`): a leading, end-aligned, monospaced row-number
 * column. The numbers follow the order of the rendered `data`, so they reflect the current sort, filter
 * and page. (For `aria-rowindex` on the full dataset use the table's `row-index-start`; this column is the
 * visible ordinal only.)
 *
 * The plugin needs the rendered `data` because a cell renderer receives only its row: it derives each row's
 * ordinal from a lookup over that array, built once per array. Pass `getRowKey` when rows have no stable
 * identity by reference; it must return a unique string per row.
 */
import {html} from 'lit';
import type {TableColumn, TableContent} from '../table.types.js';
import {pixel} from '../table.utils.js';
import {TablePluginController} from '../table-plugin.js';

/** Key of the synthetic row-index column. */
export const TABLE_ROW_INDEX_COLUMN_KEY = '__tct_rowIndex';

/** Config of {@link TableRowIndexController}. */
export interface TableRowIndexConfig<T extends Record<string, unknown>> {
  /** The rows the table renders (after sort, filter and paging): the numbering follows this order. */
  data: T[];
  /** A unique string per row, when rows are not the same objects across renders. Default: the row object. */
  getRowKey?: (item: T) => string;
  /** Header text of the index column. Default `#`. */
  label?: TableContent;
  /** The first number. Default 1. */
  startFrom?: number;
}

export class TableRowIndexController<
  T extends Record<string, unknown> = Record<string, unknown>,
> extends TablePluginController<T, TableRowIndexConfig<T>> {
  #lookup: {data: T[]; getRowKey: unknown; map: Map<unknown, number>} | undefined;
  #column: {label: TableContent; column: TableColumn<T>} | undefined;

  /** The ordinal (0-based position in `data`) of a row, or undefined. */
  #position(item: T): number | undefined {
    const {data, getRowKey} = this.config;
    let lookup = this.#lookup;
    if (lookup?.data !== data || lookup.getRowKey !== getRowKey) {
      const map = new Map<unknown, number>();
      data.forEach((row, index) => map.set(getRowKey ? getRowKey(row) : row, index));
      lookup = {data, getRowKey, map};
      this.#lookup = lookup;
    }
    return lookup.map.get(getRowKey ? getRowKey(item) : item);
  }

  // A stable column while the label is: rows keep their identity.
  transformColumns = (columns: TableColumn<T>[]): TableColumn<T>[] => {
    const label = this.config.label ?? '#';
    if (this.#column?.label !== label) {
      this.#column = {
        label,
        column: {
          key: TABLE_ROW_INDEX_COLUMN_KEY,
          header: label,
          width: pixel(48),
          align: 'end',
          resizable: false,
          renderCell: (item) => {
            const position = this.#position(item);
            return position === undefined
              ? null
              : html`<span class="tct-table-row-index"
                  >${position + (this.config.startFrom ?? 1)}</span
                >`;
          },
        },
      };
    }
    return [this.#column.column, ...columns];
  };

  /** A row's number depends on where it is in the data. */
  rowSignature = (item: T): number => (this.#position(item) ?? -1) + (this.config.startFrom ?? 1);
}
