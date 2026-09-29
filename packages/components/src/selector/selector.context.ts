import {createContext} from '@tecton-wc/core/context/protocol.js';
import type {SelectorRowLayout} from './selector.types.js';

/**
 * The row layout a host imposes on the options it draws (upstream `SelectorRowLayoutContext`). A trigger
 * inside an input group is pinned to one line by the group, so the rows the library draws itself fold
 * their label and description onto that line instead of being cut off. Provided by `tct-selector-value`
 * around the closed trigger's value; `tct-selector-option` reads it. `stacked` outside such a host.
 */
export const selectorRowLayoutContext = createContext<SelectorRowLayout, symbol>(
  Symbol.for('tct.selector-row-layout'),
);
