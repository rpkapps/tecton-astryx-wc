import type {ReactiveControllerHost} from 'lit';
import {ContextConsumer, createContext} from '@tecton-wc/core/context/protocol.js';
import {AppShellMobileController} from '../app-shell/app-shell-mobile.context.js';
import type {SideNavRenderMode} from './side-nav.types.js';

/** What the side navigation publishes about its collapse state (upstream `SideNavCollapseState`). */
export interface SideNavCollapseState {
  /** The navigation is collapsed to the icon rail. */
  readonly isCollapsed: boolean;
  /** Collapse is enabled. */
  readonly isCollapsible: boolean;
  /**
   * Toggles the collapse as the user would: asks with a cancelable `tct-collapse-change` first.
   * `reason` says which input did it.
   */
  toggle(reason?: 'pointer' | 'keyboard'): void;
}

/** What something outside any side navigation sees: expanded and not collapsible. */
export const INERT_SIDE_NAV_COLLAPSE: SideNavCollapseState = Object.freeze({
  isCollapsed: false,
  isCollapsible: false,
  toggle: () => undefined,
});

/** Collapse state of the enclosing `tct-side-nav` (upstream `SideNavCollapseContext`). */
export const sideNavCollapseContext = createContext<SideNavCollapseState, symbol>(
  Symbol.for('tct.side-nav-collapse'),
);

/**
 * Reads the collapse state of the enclosing side navigation (upstream `useSideNavCollapse`) and
 * re-renders the host when it changes. `value` is never `undefined`: outside a side navigation it is
 * the inert value (`isCollapsible: false`).
 *
 * ```ts
 * #collapse = new SideNavCollapseController(this);
 * render() { return this.#collapse.value.isCollapsed ? html`…` : html`…`; }
 * ```
 */
export class SideNavCollapseController {
  readonly #consumer: ContextConsumer<typeof sideNavCollapseContext>;

  constructor(host: ReactiveControllerHost & HTMLElement) {
    this.#consumer = new ContextConsumer(host, {context: sideNavCollapseContext, subscribe: true});
  }

  get value(): SideNavCollapseState {
    return this.#consumer.value ?? INERT_SIDE_NAV_COLLAPSE;
  }

  /** Whether an enclosing side navigation answered. */
  get isInSideNav(): boolean {
    return this.#consumer.value !== undefined;
  }
}

/**
 * The render mode a side navigation publishes to its parts (upstream `SideNavRenderContext`). Provide
 * it yourself around a side navigation (a `tct-side-nav` reads it before it derives a mode from an app
 * shell) to render one in a place the shell does not know about: a top bar, or a drawer of your own.
 */
export const sideNavRenderContext = createContext<SideNavRenderMode, symbol>(
  Symbol.for('tct.side-nav-render'),
);

export interface SideNavRenderModeOptions {
  /**
   * Derive the mode from the enclosing `tct-app-shell` when no `sideNavRenderContext` is provided:
   * `drawer` while the shell shows the side navigation in its mobile drawer, else `default`. The side
   * navigation itself does this; its parts (items, headings) read what the side navigation published.
   */
  derive?: boolean;
}

/**
 * Reads the render mode (upstream `useSideNavRenderMode`): an explicit `sideNavRenderContext` from an
 * ancestor wins, then (with `derive`) the app shell's mobile state, else `default`.
 */
export class SideNavRenderModeController {
  readonly #consumer: ContextConsumer<typeof sideNavRenderContext>;
  readonly #shell: AppShellMobileController | undefined;

  constructor(host: ReactiveControllerHost & HTMLElement, options: SideNavRenderModeOptions = {}) {
    this.#consumer = new ContextConsumer(host, {context: sideNavRenderContext, subscribe: true});
    if (options.derive) this.#shell = new AppShellMobileController(host);
  }

  get value(): SideNavRenderMode {
    const explicit = this.#consumer.value;
    if (explicit) return explicit;
    return this.#shell?.value.sideNavPlacement === 'drawer' ? 'drawer' : 'default';
  }

  /** Whether an ancestor provided the mode explicitly. */
  get isExplicit(): boolean {
    return this.#consumer.value !== undefined;
  }
}
