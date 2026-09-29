/**
 * Family-private context (WORK-BREAKDOWN §1.6, A§9.4): what `tct-checkbox-list` tells its items. Upstream
 * `CheckboxListContext`, re-expressed for the Context Community Protocol.
 */
import {createContext} from '@tecton-astryx/core/context/protocol.js';

export interface CheckboxListContextValue {
  /** The selected values (collection mode). */
  values: readonly string[];
  /** The whole list is disabled (its own `disabled`, or a disabled fieldset). */
  disabled: boolean;
  /**
   * Disabled *and* explained: the items stay focusable (`aria-disabled`) so the group's reason can be
   * found by keyboard; toggling stays blocked.
   */
  hasDisabledMessage: boolean;
  /** Displays the state at full strength but bars changes. */
  readonly: boolean;
  /** The value of the item with a pending `changeAction`, or `null`: that item shows a spinner and is blocked. */
  loadingValue: string | null;
}

export const checkboxListContext = createContext<CheckboxListContextValue | null, symbol>(
  Symbol.for('tct.checkbox-list'),
);
