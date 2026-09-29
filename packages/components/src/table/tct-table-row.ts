import {property} from 'lit/decorators.js';
import type {PropertyValues} from 'lit';
import {TctProviderElement} from '@tecton-wc/core/provider-element.js';
import type {TableContextActions} from './table.types.js';

/**
 * A row of a table in children mode (upstream `TableRow`, a `<tr>`). It is an ARIA `row`; put
 * `tct-table-cell` and `tct-table-header-cell` in it, and the row itself in `tct-table-header`,
 * `tct-table-body` or `tct-table-footer`. Inside a `tct-table` the light stylesheet gives body rows the
 * striped, hover and selected fills the table asks for; `header-row` keeps a row out of them.
 * The class `tct-table-selected` shows the selected fill and `aria-disabled="true"` suppresses hover.
 *
 * @summary A row of a table in children mode.
 * @tag tct-table-row
 * @upstream TableRow
 * @slot - `tct-table-cell` and `tct-table-header-cell` elements.
 * @cloakDisplay table-row
 */
export class TctTableRow extends TctProviderElement {
  static override readonly tagName = 'tct-table-row';

  /** Marks a header row: it skips the striped and hover fills, which are for body rows. */
  @property({type: Boolean, reflect: true, attribute: 'header-row'}) headerRow = false;

  /**
   * Right-click actions for the whole row, as the plugin protocol defines them (an array, or a getter
   * called when the menu opens). Setting it turns on the table's shared context menu.
   */
  @property({attribute: false}) contextMenuActions: TableContextActions | undefined;

  constructor() {
    super();
    this.internals.role = 'row';
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('contextMenuActions') && this.contextMenuActions) {
      (this.closest('tct-table') as {enableContextMenu?: () => void} | null)?.enableContextMenu?.();
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-table-row': TctTableRow;
  }
}
