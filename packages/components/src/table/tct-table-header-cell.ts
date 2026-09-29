import {property} from 'lit/decorators.js';
import type {PropertyValues} from 'lit';
import {TctProviderElement} from '@tecton-wc/core/provider-element.js';
import type {TableContextActions} from './table.types.js';
import type {TableCellScope} from './tct-table-cell.js';

/**
 * A header cell of a table in children mode (upstream `TableHeaderCell`, a `<th>`). It is an ARIA
 * `columnheader` (a `rowheader` with `scope="row"`). Inside a `tct-table` the light stylesheet gives it
 * the density padding, the Tecton header fill, the medium weight and the header divider; header text
 * always stays on one line.
 *
 * @summary A header cell of a table in children mode.
 * @tag tct-table-header-cell
 * @upstream TableHeaderCell
 * @slot - The header content.
 * @cloakDisplay table-cell
 */
export class TctTableHeaderCell extends TctProviderElement {
  static override readonly tagName = 'tct-table-header-cell';

  /** Which cells this header relates to. Default `col`; `row` makes it a row header. */
  @property({reflect: true}) scope: TableCellScope | undefined;

  /**
   * Right-click actions for this header cell, as the plugin protocol defines them (an array, or a
   * getter called when the menu opens). Setting it turns on the table's shared context menu.
   */
  @property({attribute: false}) contextMenuActions: TableContextActions | undefined;

  constructor() {
    super();
    this.internals.role = 'columnheader';
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('scope')) {
      this.internals.role =
        this.scope === 'row' || this.scope === 'rowgroup' ? 'rowheader' : 'columnheader';
    }
    if (changed.has('contextMenuActions') && this.contextMenuActions) {
      (this.closest('tct-table') as {enableContextMenu?: () => void} | null)?.enableContextMenu?.();
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-table-header-cell': TctTableHeaderCell;
  }
}
