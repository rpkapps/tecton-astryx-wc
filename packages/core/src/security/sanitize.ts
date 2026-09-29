/**
 * Consumer-markup sanitising boundary (A§13, D-007, `[mwg:sanitize-untrusted-html]`,
 * `[mwg:trusted-types]`). The only module that references `dompurify`, and only through a dynamic
 * `import()`. Library code has no HTML-string sinks; markup strings that a consumer supplies (a raw
 * SVG icon, an extension editor's content) come through here and are returned as a `DocumentFragment`
 * whose nodes the caller moves into the page, never re-serialised (avoids mutation XSS).
 *
 * Native path: `Element#setHTML()` (the Sanitizer API), whose default configuration removes every
 * XSS-unsafe element and attribute. Fallback: DOMPurify (Apache-2.0 election, D-007a), loaded on
 * first need. Under `require-trusted-types-for 'script'` the CSP must allow the `dompurify` policy.
 *
 * Signature note: `sanitizeHtml` is asynchronous because the fallback is a lazy import;
 * {@link sanitizeHtmlSync} covers the native path and an already loaded fallback.
 */
import type DomPurifyDefault from 'dompurify';
import {features} from '../features.js';
import {devWarn} from '../utils/dev.js';

export interface SanitizeOptions {
  /** Treat `html` as SVG markup (parsed in an SVG context, SVG profile). */
  svg?: boolean;
}

type DomPurify = typeof DomPurifyDefault;

let loading: Promise<DomPurify> | undefined;
let loaded: DomPurify | undefined;

function loadDomPurify(): Promise<DomPurify> {
  loading ??= import('dompurify').then((module) => {
    loaded = module.default;
    return loaded;
  });
  return loading;
}

/** Loads the fallback sanitizer now (no-op when the native one exists). */
export async function preloadSanitizer(): Promise<void> {
  if (!features.sanitizer) await loadDomPurify();
}

/** Whether {@link sanitizeHtmlSync} can answer right now. */
export function isSanitizerReady(): boolean {
  return features.sanitizer || loaded !== undefined;
}

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

function sanitizeNative(html: string, options: SanitizeOptions): DocumentFragment {
  const context: Element = options.svg
    ? document.createElementNS(SVG_NAMESPACE, 'svg')
    : document.createElement('div');
  (context as Element & {setHTML(html: string): void}).setHTML(html);
  const fragment = document.createDocumentFragment();
  fragment.append(...context.childNodes);
  return fragment;
}

function sanitizeWithDomPurify(
  purify: DomPurify,
  html: string,
  options: SanitizeOptions,
): DocumentFragment {
  return purify.sanitize(
    html,
    options.svg
      ? {
          USE_PROFILES: {svg: true},
          FORBID_TAGS: ['style', 'script', 'foreignObject'],
          FORBID_ATTR: ['style'],
          RETURN_DOM_FRAGMENT: true,
        }
      : {USE_PROFILES: {html: true}, RETURN_DOM_FRAGMENT: true},
  );
}

/**
 * Sanitises `html` and returns the nodes as a fragment. Uses the native Sanitizer when present,
 * otherwise loads DOMPurify on first use.
 */
export async function sanitizeHtml(
  html: string,
  options: SanitizeOptions = {},
): Promise<DocumentFragment> {
  if (features.sanitizer) return sanitizeNative(html, options);
  return sanitizeWithDomPurify(await loadDomPurify(), html, options);
}

/**
 * Synchronous variant: the native Sanitizer, or DOMPurify once loaded (`preloadSanitizer()`).
 * Returns `null` when neither is available yet; it never returns unsanitised markup.
 */
export function sanitizeHtmlSync(
  html: string,
  options: SanitizeOptions = {},
): DocumentFragment | null {
  if (features.sanitizer) return sanitizeNative(html, options);
  if (loaded) return sanitizeWithDomPurify(loaded, html, options);
  devWarn(
    'sanitize:not-ready',
    'sanitizeHtmlSync() called before the fallback sanitizer loaded; await preloadSanitizer().',
  );
  return null;
}

/** Forgets the loaded fallback. Test-only. */
export function resetSanitizer(): void {
  loading = undefined;
  loaded = undefined;
}
