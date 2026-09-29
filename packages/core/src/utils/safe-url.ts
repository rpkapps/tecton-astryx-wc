/**
 * URL policy for links and embedded resources (A§13, port of upstream `utils/safeUrl.ts` and
 * `Markdown/url.ts`). Browsers ignore control characters inside a scheme (`java\tscript:`), so every
 * decision is made on the normalised string. Accepted input is never rewritten beyond that
 * normalisation.
 */

const CONTROL_CHARACTERS = /[\x00-\x1f\x7f]/g;

function normalizeUrl(url: string): string {
  return url.replace(CONTROL_CHARACTERS, '').trim();
}

/** Navigation policy: blocks `javascript:`, `vbscript:` and `data:text/html`. Returns the normalised URL. */
export function sanitizeUrl(url: string): string | null {
  const normalized = normalizeUrl(url);
  const lower = normalized.toLowerCase();
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('vbscript:') ||
    lower.startsWith('data:text/html')
  ) {
    return null;
  }
  return normalized;
}

/** True when the navigation policy accepts the string. */
export function isSafeUrl(url: string): boolean {
  return sanitizeUrl(url) !== null;
}

export interface SafeUrlOptions {
  /**
   * Permit `data:` URLs that are not HTML (`data:image/png;base64,…`). Default `false`, which is the
   * embedded-resource policy (images, media): every `data:` URL is refused. Navigation contexts that
   * follow upstream pass `true`. `data:text/html` is never allowed.
   */
  allowData?: boolean;
}

/**
 * The library's one URL gate. Returns the normalised URL, or `null` for anything a link or an
 * embedded resource must not load, including the empty string.
 */
export function safeUrl(url: string, options: SafeUrlOptions = {}): string | null {
  const navigable = sanitizeUrl(url);
  if (navigable === null || navigable === '') return null;
  if (!options.allowData && /^data:/i.test(navigable)) return null;
  return navigable;
}

/**
 * Checks router-style destinations (a path string, a Next.js URL object, a `URL`) without
 * serialising or replacing the object handed to the router. Query and hash are route-relative data,
 * not schemes. Absent destinations stay absent (accepted).
 */
export function isSafeDestination(destination: unknown): boolean {
  if (destination === null || destination === undefined) return true;
  if (typeof destination === 'string') return isSafeUrl(destination);
  if (typeof destination !== 'object') return false;

  const {pathname, href, protocol, host, hostname} = destination as Record<string, unknown>;
  for (const field of [pathname, href, protocol, host, hostname]) {
    if (field !== null && field !== undefined && typeof field !== 'string') return false;
  }
  if (typeof pathname === 'string' && !isSafeUrl(pathname)) return false;
  if (typeof href === 'string' && !isSafeUrl(href)) return false;
  if (typeof protocol === 'string' && protocol !== '') {
    // URL-object formatters accept a protocol with or without its colon and can assemble a data
    // media type from the host and pathname fields.
    const normalizedProtocol = normalizeUrl(protocol);
    const prefix = normalizedProtocol.endsWith(':') ? normalizedProtocol : `${normalizedProtocol}:`;
    if (!isSafeUrl(prefix)) return false;
    const body =
      (typeof host === 'string' && host) || (typeof hostname === 'string' && hostname) || '';
    const path = typeof pathname === 'string' ? pathname : '';
    if (!isSafeUrl(`${prefix}${body}${path}`)) return false;
  }
  return true;
}
