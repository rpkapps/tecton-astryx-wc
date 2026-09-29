import type {ReactiveControllerHost} from 'lit';
import {ContextConsumer, createContext} from '@tecton-wc/core/context/protocol.js';

/** Where the shell renders the side navigation right now. */
export type SideNavPlacement = 'inline' | 'drawer' | 'none';

/**
 * The mobile navigation state `tct-app-shell` publishes to everything inside it (upstream
 * `AppShellMobileContext`): the mobile toggle, the mobile drawer, and, from the navigation work package,
 * `tct-side-nav` and `tct-top-nav`, which adapt to it (a side navigation shows as drawer content or as a
 * top bar below the breakpoint; a top navigation collapses to a bar with the toggle).
 *
 * Outside an app shell the context is inert: `isMobile` is `false`, the drawer is closed and disabled and
 * the commands do nothing, so a component that reads it works standalone.
 */
export interface AppShellMobileContextValue {
  /** The viewport is below the mobile breakpoint. */
  readonly isMobile: boolean;
  /** The mobile navigation drawer is open. */
  readonly isMobileNavOpen: boolean;
  /**
   * An id the drawer answers to, unique per shell. It only resolves for a toggle that lives in the
   * same tree as the drawer (see `tct-mobile-nav-toggle`).
   */
  readonly mobileNavId?: string;
  /** Opens or closes the drawer (no event; a component that starts a user action raises `tct-open-change` first). */
  toggleMobileNav(): void;
  openMobileNav(): void;
  closeMobileNav(): void;
  /** Whether the mobile navigation exists at all (not turned off, and there is navigation to show). */
  readonly isMobileNavEnabled: boolean;
  /** Whether the shell places its own toggle (`false` with `no-mobile-toggle`: place a `tct-mobile-nav-toggle` yourself). */
  readonly hasAutoToggle: boolean;
  /** A top navigation is slotted in `top-nav`. */
  readonly hasTopNav: boolean;
  /** A side navigation is slotted in `side-nav`. */
  readonly hasSideNav: boolean;
  /** Where the side navigation renders: `inline` (a panel), `drawer` (inside the mobile drawer) or `none`. */
  readonly sideNavPlacement: SideNavPlacement;
}

export const appShellMobileContext = createContext<AppShellMobileContextValue, symbol>(
  Symbol.for('tct.app-shell-mobile'),
);

const noop = (): void => undefined;

/** What a component outside any shell sees. */
export const INERT_APP_SHELL_MOBILE: AppShellMobileContextValue = Object.freeze({
  isMobile: false,
  isMobileNavOpen: false,
  toggleMobileNav: noop,
  openMobileNav: noop,
  closeMobileNav: noop,
  isMobileNavEnabled: false,
  hasAutoToggle: true,
  hasTopNav: false,
  hasSideNav: false,
  sideNavPlacement: 'none',
});

/**
 * Reads the shell's mobile state from anywhere inside it (upstream `useAppShellMobile`) and re-renders
 * the host when it changes. `value` is never `undefined`: outside a shell it is the inert value.
 *
 * ```ts
 * #shell = new AppShellMobileController(this);
 * render() { return this.#shell.value.isMobile ? html`…` : nothing; }
 * ```
 */
export class AppShellMobileController {
  readonly #consumer: ContextConsumer<typeof appShellMobileContext>;

  constructor(host: ReactiveControllerHost & HTMLElement) {
    this.#consumer = new ContextConsumer(host, {context: appShellMobileContext, subscribe: true});
  }

  get value(): AppShellMobileContextValue {
    return this.#consumer.value ?? INERT_APP_SHELL_MOBILE;
  }

  /** Whether an enclosing app shell answered. */
  get isInShell(): boolean {
    return this.#consumer.value !== undefined;
  }
}
