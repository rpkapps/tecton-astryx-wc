import {createContext} from '@tecton-astryx/core/context/protocol.js';
import type {ChangeReason} from '@tecton-astryx/core/events/tct-event.js';
import type {MenuSize} from './dropdown-menu.types.js';

/**
 * What a menu publishes to its rows (upstream `DropdownMenuContext` / `useDropdownMenuContext`).
 * Provided by `tct-dropdown-menu`, `tct-context-menu` and by every `tct-dropdown-menu-sub-menu`, which
 * re-provides it so a row of any depth ends the whole menu, not just its own flyout.
 */
export interface DropdownMenuContextValue {
  /** Row size, from the trigger button size (`md` by default). */
  readonly size: MenuSize;
  /** Whether the root menu is open. A submenu closes with it. */
  readonly open: boolean;
  /**
   * Ends the whole menu because a row was chosen (or Tab left it). Depth is irrelevant: each level
   * closes its flyout and asks its parent, up to the root, which dispatches the cancelable
   * `tct-open-change` and closes. Focus returns to {@link returnFocusTarget}.
   */
  close(reason?: ChangeReason): void;
  /** Where focus goes when the whole menu closes: the trigger (or the element focused before a context menu opened). */
  returnFocusTarget(): HTMLElement | null;
}

/** Upstream `DropdownMenuContext`. `null` outside a menu: rows still render and simply do not close anything. */
export const dropdownMenuContext = createContext<DropdownMenuContextValue | null, symbol>(
  Symbol.for('tct.dropdown-menu'),
);

/** What a radio group publishes to its radio items (upstream `DropdownMenuRadioGroupContext`). */
export interface DropdownMenuRadioGroupContextValue {
  /** The selected value of the group; `undefined` when nothing is selected. */
  readonly value: string | undefined;
  /** Asks the group to select `value` (a user activation): dispatches the intent event first. */
  select(value: string, reason: ChangeReason): void;
  /** Whether choosing a value also closes the menu. */
  readonly closeOnSelect: boolean;
}

export const dropdownMenuRadioGroupContext = createContext<
  DropdownMenuRadioGroupContextValue | null,
  symbol
>(Symbol.for('tct.dropdown-menu-radio-group'));
