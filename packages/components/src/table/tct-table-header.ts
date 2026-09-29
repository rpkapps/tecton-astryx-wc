import {TctProviderElement} from '@tecton-wc/core/provider-element.js';

/**
 * The header section of a table in children mode (upstream `TableHeader`, a `<thead>`). Put
 * `tct-table-row` elements holding `tct-table-header-cell` in it. It is an ARIA `rowgroup`; inside a
 * native `<table>` write `<thead>` instead. It has no shadow root and draws nothing of its own: the
 * table's light stylesheet lays it out as a table header group and paints the header fill.
 *
 * @summary The header row group of a table in children mode.
 * @tag tct-table-header
 * @upstream TableHeader
 * @slot - `tct-table-row` elements.
 * @cloakDisplay table-header-group
 */
export class TctTableHeader extends TctProviderElement {
  static override readonly tagName = 'tct-table-header';

  constructor() {
    super();
    this.internals.role = 'rowgroup';
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-table-header': TctTableHeader;
  }
}
