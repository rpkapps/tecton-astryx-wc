/**
 * Family-private context (WORK-BREAKDOWN §1.6, A§9.4): what `tct-toggle-button-group` tells the toggle
 * buttons below it. Upstream `ToggleButtonGroupContext` (`useToggleButtonGroup`).
 */
import {createContext} from '@tecton-wc/core/context/protocol.js';
import type {ElementSize} from '@tecton-wc/core/context/keys.js';

export interface ToggleButtonGroupContextValue {
  /** Whether the toggle button with this `value` is pressed. */
  isPressed(value: string): boolean;
  /** A user activated the button with this `value`; the group decides, updates and fires `tct-value-change`. */
  toggle(value: string, event?: Event): void;
  /** The group's resolved size: the default of its members (a member's own `size` wins). */
  size: ElementSize;
  /** The whole group is disabled. A disabled group cannot be re-enabled by a member. */
  disabled: boolean;
}

export const toggleButtonGroupContext = createContext<ToggleButtonGroupContextValue | null, symbol>(
  Symbol.for('tct.toggle-button-group'),
);
