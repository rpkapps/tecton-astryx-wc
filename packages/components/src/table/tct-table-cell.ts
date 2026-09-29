import {property} from 'lit/decorators.js';
import type {PropertyValues} from 'lit';
import {TctProviderElement} from '@tecton-wc/core/provider-element.js';
import type {TableContextActions} from './table.types.js';

/** `scope` values of a cell. */
export const TABLE_CELL_SCOPES = ['col', 'row', 'colgroup', 'rowgroup'] as const;
export type TableCellScope = (typeof TABLE_CELL_SCOPES)[number];

/**
 * A body cell of a table in children mode (upstream `TableCell`, a `<td>`). It is an ARIA `cell`, or a
 * `rowheader` / `columnheader` when `scope` says it heads a row or column. Inside a `tct-table` the
 * light stylesheet gives it the density padding, body text size, vertical alignment, dividers and the
 * overflow behaviour the table asks for.
 *
 * `col-span` and `row-span` are reported to assistive technology (`aria-colspan`, `aria-rowspan`) but CSS
 * cannot make a cell span columns, so a cell that must visibly span belongs in native `<table>` markup.
 *
 * @summary A cell of a table in children mode.
 * @tag tct-table-cell
 * @upstream TableCell
 * @slot - The cell content.
 * @cloakDisplay table-cell
 */
export class TctTableCell extends TctProviderElement {
  static override readonly tagName = 'tct-table-cell';

  /** Which cells this one relates to; `row` or `col` make it a row or column header. */
  @property({reflect: true}) scope: TableCellScope | undefined;

  /** Space-separated ids of the header cells that describe this cell. Kept as an attribute for native-table parity; ARIA has no equivalent. */
  @property() headers: string | undefined;

  /** Number of columns the cell spans, reported as `aria-colspan`. */
  @property({type: Number, attribute: 'col-span'}) colSpan: number | undefined;

  /** Number of rows the cell spans, reported as `aria-rowspan`. */
  @property({type: Number, attribute: 'row-span'}) rowSpan: number | undefined;

  /**
   * Right-click actions for this cell, as the plugin protocol defines them (an array, or a getter
   * called when the menu opens). Setting it turns on the table's shared context menu.
   */
  @property({attribute: false}) contextMenuActions: TableContextActions | undefined;

  constructor() {
    super();
    this.internals.role = 'cell';
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('scope')) {
      this.internals.role =
        this.scope === 'row' || this.scope === 'rowgroup'
          ? 'rowheader'
          : this.scope === 'col' || this.scope === 'colgroup'
            ? 'columnheader'
            : 'cell';
    }
    if (changed.has('colSpan')) {
      this.internals.ariaColSpan = this.colSpan && this.colSpan > 1 ? String(this.colSpan) : null;
    }
    if (changed.has('rowSpan')) {
      this.internals.ariaRowSpan = this.rowSpan && this.rowSpan > 1 ? String(this.rowSpan) : null;
    }
    if (changed.has('contextMenuActions') && this.contextMenuActions) {
      (this.closest('tct-table') as {enableContextMenu?: () => void} | null)?.enableContextMenu?.();
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-table-cell': TctTableCell;
  }
}
