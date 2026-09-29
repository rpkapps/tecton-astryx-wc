import {createContext} from '@tecton-wc/core/context/protocol.js';
import type {ItemDescription} from './item.types.js';

/**
 * The description an item renders, for a control in one of its slots (upstream
 * `ItemDescriptionContext`). `null` when the row renders no description, so a consumer adds no dangling
 * `aria-describedby`. Provided by `tct-item`; consumed by the checkbox and radio rows (WP-7).
 */
export const itemDescriptionContext = createContext<ItemDescription | null, symbol>(
  Symbol.for('tct.item-description'),
);
