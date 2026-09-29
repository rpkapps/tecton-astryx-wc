import type {ReactiveControllerHost} from 'lit';
import {ContextConsumer, createContext} from '@tecton-wc/core/context/protocol.js';
import {AppShellMobileController} from '../app-shell/app-shell-mobile.context.js';
import type {TopNavRenderMode} from './top-nav.types.js';

/**
 * The render mode a top navigation publishes to its items and menus (upstream `TopNavRenderContext`).
 * The mobile drawer publishes `drawer` around the copy of the items it shows; provide it yourself to
 * render items in a list of your own.
 */
export const topNavRenderContext = createContext<TopNavRenderMode, symbol>(
  Symbol.for('tct.top-nav-render'),
);

export interface TopNavRenderModeOptions {
  /**
   * Derive the mode from the enclosing `tct-app-shell` when no `topNavRenderContext` is provided:
   * `mobile-bar` below the mobile breakpoint while the shell has a mobile navigation, else `default`.
   * The top navigation itself does this; its items read what it published.
   */
  derive?: boolean;
}

/**
 * Reads the render mode (upstream `useTopNavRenderMode`): an explicit `topNavRenderContext` from an
 * ancestor wins, then (with `derive`) the app shell's mobile state, else `default`.
 */
export class TopNavRenderModeController {
  readonly #consumer: ContextConsumer<typeof topNavRenderContext>;
  readonly #shell: AppShellMobileController | undefined;

  constructor(host: ReactiveControllerHost & HTMLElement, options: TopNavRenderModeOptions = {}) {
    this.#consumer = new ContextConsumer(host, {context: topNavRenderContext, subscribe: true});
    if (options.derive) this.#shell = new AppShellMobileController(host);
  }

  get value(): TopNavRenderMode {
    const explicit = this.#consumer.value;
    if (explicit) return explicit;
    const shell = this.#shell?.value;
    return shell?.isMobile === true && shell.isMobileNavEnabled ? 'mobile-bar' : 'default';
  }

  /** Whether an ancestor provided the mode explicitly. */
  get isExplicit(): boolean {
    return this.#consumer.value !== undefined;
  }
}
