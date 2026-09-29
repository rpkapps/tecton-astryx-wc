import {property} from 'lit/decorators.js';
import {ContextProvider} from '@tecton-astryx/core/context/protocol.js';
import {linkContext, type LinkContextValue} from '@tecton-astryx/core/context/keys.js';
import {TctProviderElement} from '@tecton-astryx/core/provider-element.js';
import lightStyles from './tct-link-provider.light.css?inline';

/** The router hook of `tct-link-provider`: `(href, event) => boolean`; `true` means "handled". */
export type LinkNavigate = NonNullable<LinkContextValue['navigate']>;

/**
 * Hands unmodified clicks on internal links to your client-side router (upstream `LinkProvider`). Wrap the
 * app, or the part of it that routes on the client; every `tct-link`, link-form `tct-button` and `tct-avatar`
 * link below it offers its clicks to `navigate`. Return `true` when the router handled the navigation and the
 * element cancels the native one; return `false` (or set nothing) and the browser navigates as usual.
 *
 * A link only offers a plain primary click on a same-origin destination that is not external, not a
 * download and has no other `target`; modified and middle clicks, new-tab links and cross-origin destinations
 * stay native, and destinations refused by the URL policy never reach the router. Providers nest: the nearest
 * one wins.
 *
 * It has no shadow root, draws nothing and is `display: contents`, so it never affects layout.
 *
 * Guides: [mwg:custom-elements] (a provider element with no shadow root) [mwg:security] (URL policy stays in
 * the link, before the router).
 *
 * @summary Provides client-side routing to the links below it.
 * @tag tct-link-provider
 * @upstream LinkProvider
 * @slot - The subtree that routes through `navigate`.
 * @cloakDisplay contents
 */
export class TctLinkProvider extends TctProviderElement {
  static override readonly tagName = 'tct-link-provider';
  static override readonly lightStyles = lightStyles;

  /**
   * The router hook: `(href, event) => boolean`. Return `true` when your router handled the navigation.
   * Read at click time, so it can be set or replaced at any moment. Property only.
   */
  @property({attribute: false}) navigate: LinkNavigate | undefined;

  // One stable value: consumers never need re-providing when `navigate` is replaced.
  readonly #value: LinkContextValue = {
    navigate: (href, event) => this.navigate?.(href, event) ?? false,
  };

  constructor() {
    super();
    new ContextProvider(this, {context: linkContext, initialValue: this.#value});
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-link-provider': TctLinkProvider;
  }
}
