/**
 * Navigation destinations shared by the side and top navigation items (upstream family
 * `navigation-destinations`): the URL policy, and the hand-off of an internal click to the router of
 * the nearest `tct-link-provider`. The same rules as `tct-link`, for the rows that draw their own `<a>`.
 */
import type {LinkContextValue} from '@tecton-wc/core/context/keys.js';
import {safeUrl} from '@tecton-wc/core/utils/safe-url.js';

export interface NavLinkRoute {
  /** The destination as written. */
  href: string | undefined;
  /** Opens elsewhere (a target other than `_self`, a download): never routed. */
  native?: boolean;
}

/** The destination the URL policy accepts, or `null` (a `javascript:`-style value renders no `href`). */
export function safeHref(href: string | undefined | null): string | null {
  if (href === undefined || href === null) return null;
  return safeUrl(href, {allowData: true});
}

/**
 * Hands an unmodified primary click on an internal link to the router (`linkContext`), as `tct-link`
 * does; modified clicks, other targets, downloads and other origins stay native. Prevents the default
 * when the router navigated.
 */
export function routeNavClick(
  event: MouseEvent,
  router: LinkContextValue | null | undefined,
  route: NavLinkRoute,
): void {
  const href = safeHref(route.href);
  if (!router?.navigate || href === null) return;
  if (event.defaultPrevented || event.button !== 0) return;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  if (route.native) return;
  try {
    if (new URL(href, location.href).origin !== location.origin) return;
  } catch {
    return;
  }
  if (router.navigate(href, event)) event.preventDefault();
}
