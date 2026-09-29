/**
 * Family contexts (WORK-BREAKDOWN §1.6, A§9.4). `navHeadingCloseContext` is provided by the popover of a
 * navigation heading (`tct-side-nav-heading`, `tct-top-nav-heading`) so a menu can dismiss it;
 * `navHeadingMenuContext` is provided by `tct-nav-heading-menu` to its items. Upstream
 * `NavHeadingCloseContext`, `useNavHeadingCloseContext`, `NavHeadingMenuContext` and
 * `useNavHeadingMenuContext`, re-expressed for the Context Community Protocol.
 */
import {createContext} from '@tecton-wc/core/context/protocol.js';
import type {NavHeadingMenuSize} from './nav-heading-menu.types.js';

/** Close callback provided by the nav heading popover. */
export interface NavHeadingCloseContextValue {
  /** Dismisses the popover the menu is in (on item selection and on Escape). */
  readonly closeMenu: () => void;
}

/** Upstream `NavHeadingCloseContext`. `null` outside a heading popover: the menu then closes nothing. */
export const navHeadingCloseContext = createContext<NavHeadingCloseContextValue | null, symbol>(
  Symbol.for('tct.nav-heading-close'),
);

/** Size and close callback a menu gives its items. */
export interface NavHeadingMenuContextValue {
  readonly size: NavHeadingMenuSize;
  readonly closeMenu: () => void;
}

/** Upstream `NavHeadingMenuContext`. `null` outside a menu: an item still renders at the default size. */
export const navHeadingMenuContext = createContext<NavHeadingMenuContextValue | null, symbol>(
  Symbol.for('tct.nav-heading-menu'),
);
