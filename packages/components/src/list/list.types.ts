import type {ItemDensity} from '../item/item.types.js';

/** Row spacing of every item in the list. */
export const LIST_DENSITIES = ['compact', 'balanced', 'spacious'] as const;
export type ListDensity = ItemDensity;

/** Marker style. `decimal` numbers the rows and exposes an ordered list. */
export const LIST_STYLES = ['none', 'disc', 'decimal', 'circle'] as const;
export type ListStyle = (typeof LIST_STYLES)[number];

/** Compensation for the rows' own inline inset. */
export const LIST_EDGE_COMPENSATIONS = ['inline'] as const;
export type ListEdgeCompensation = (typeof LIST_EDGE_COMPENSATIONS)[number];

/** What a `tct-list` publishes to its `tct-list-item` rows (upstream `ListContext`). */
export interface ListContextValue {
  density: ListDensity;
  hasDividers: boolean;
  listStyle: ListStyle;
  edgeCompensation: ListEdgeCompensation | undefined;
}
