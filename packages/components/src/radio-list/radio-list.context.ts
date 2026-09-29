/**
 * Family-private context (WORK-BREAKDOWN §1.6, A§9.4): what `tct-radio-list` tells its options. Upstream
 * `RadioListContext`, re-expressed for the Context Community Protocol.
 */
import {createContext} from '@tecton-astryx/core/context/protocol.js';
import type {RadioListSize} from './radio-list.types.js';

export interface RadioListContextValue {
  /** The selected value ('' when nothing is selected). */
  value: string;
  size: RadioListSize;
  /** The whole list is disabled (its own `disabled`, or a disabled fieldset). */
  disabled: boolean;
  /**
   * Disabled *and* explained: the options stay focusable (`aria-disabled`) so the group's reason can be
   * found by keyboard; selecting stays blocked.
   */
  hasDisabledMessage: boolean;
  /** Displays the state at full strength but bars changes. */
  readonly: boolean;
  /** An option asks to become the value. The list decides (disabled, read-only, unchanged) and fires `input` then `change` once. */
  select(item: HTMLElement): void;
}

export const radioListContext = createContext<RadioListContextValue | null, symbol>(
  Symbol.for('tct.radio-list'),
);
