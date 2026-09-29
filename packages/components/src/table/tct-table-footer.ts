import {TctProviderElement} from '@tecton-wc/core/provider-element.js';

/**
 * The footer section of a table in children mode (upstream `TableFooter`, a `<tfoot>`): summary or
 * totals rows under the body, on the Tecton footer fill. It is an ARIA `rowgroup`; inside a native
 * `<table>` write `<tfoot>` instead. It has no shadow root and draws nothing of its own.
 *
 * @summary The footer row group of a table in children mode.
 * @tag tct-table-footer
 * @upstream TableFooter
 * @slot - `tct-table-row` elements.
 * @cloakDisplay table-footer-group
 */
export class TctTableFooter extends TctProviderElement {
  static override readonly tagName = 'tct-table-footer';

  constructor() {
    super();
    this.internals.role = 'rowgroup';
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-table-footer': TctTableFooter;
  }
}
