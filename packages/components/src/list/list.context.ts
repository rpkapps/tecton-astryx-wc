import {createContext} from '@tecton-wc/core/context/protocol.js';
import type {ListContextValue} from './list.types.js';

/** Provided by `tct-list` (upstream `ListContext`); `null` for a `tct-list-item` outside a list. */
export const listContext = createContext<ListContextValue | null, symbol>(Symbol.for('tct.list'));
