/**
 * `TableContext` (upstream `TableContext`): what `tct-table` tells its subcomponents (`tct-table-row`,
 * `-cell`, `-header-cell`). Re-expressed for the Context Community Protocol; the styling itself flows
 * through the light stylesheet's attribute selectors on `tct-table`, so the context is for consumers
 * that render their own table parts and need the same appearance decisions.
 */
import {createContext} from '@tecton-wc/core/context/protocol.js';
import type {TableContextValue} from './table.types.js';

export type {TableContextValue} from './table.types.js';

/** Provided by `tct-table`. */
export const tableContext = createContext<TableContextValue | null, symbol>(
  Symbol.for('tct.table'),
);

/** The context under its upstream name (`TableContext`). */
export const TableContext = tableContext;
