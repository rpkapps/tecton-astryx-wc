import {TctProviderElement} from '@tecton-wc/core/provider-element.js';

/**
 * The body section of a table in children mode (upstream `TableBody`, a `<tbody>`). Put `tct-table-row`
 * elements holding `tct-table-cell` in it. It is an ARIA `rowgroup`; inside a native `<table>` write
 * `<tbody>` instead. It has no shadow root and draws nothing of its own.
 *
 * @summary The body row group of a table in children mode.
 * @tag tct-table-body
 * @upstream TableBody
 * @slot - `tct-table-row` elements.
 * @cloakDisplay table-row-group
 */
export class TctTableBody extends TctProviderElement {
  static override readonly tagName = 'tct-table-body';

  constructor() {
    super();
    this.internals.role = 'rowgroup';
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-table-body': TctTableBody;
  }
}
