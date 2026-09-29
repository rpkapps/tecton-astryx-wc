/**
 * The imperative toast API (upstream `useToast`): `toast()` raises a toast and returns its dismiss
 * function; `dismissToast()` and `dismissAllToasts()` close toasts by `uniqueId` or all at once.
 *
 * Toasts appear in the viewport of the outermost connected `tct-layer-provider`, or, when there is
 * none, in a viewport that is created lazily on `document.body` (a dev warning says so once). The
 * first call registers the toast elements (`defineElement`, idempotent); importing this module has no
 * side effect.
 */
import {html, render} from 'lit';
import {createRef, ref} from 'lit/directives/ref.js';
import {defineElement} from '@tecton-astryx/core/define.js';
import {devWarn} from '@tecton-astryx/core/utils/dev.js';
import {TctLayerProvider} from './tct-layer-provider.js';
import {TctToastViewport, type ToastEntry} from './tct-toast-viewport.js';
import {providerViewport} from './toaster.js';
import type {ToastDismissFn, ToastOptions} from './toast.types.js';

let fallback: TctToastViewport | null = null;
let counter = 0;

function fallbackViewport(): TctToastViewport {
  if (fallback?.isConnected) return fallback;
  defineElement(TctToastViewport);
  devWarn(
    'toast:fallback',
    'No <tct-layer-provider> found: toasts use a fallback viewport on document.body. Wrap your app in <tct-layer-provider> for control over position and stacking.',
  );
  const container = document.createElement('div');
  container.dataset.tctToastFallback = '';
  container.style.display = 'contents';
  document.body.append(container);
  // A reference, not a query: with a modal open the viewport moves into it as soon as it connects.
  const viewport = createRef<TctToastViewport>();
  render(html`<tct-toast-viewport ${ref(viewport)}></tct-toast-viewport>`, container);
  fallback = viewport.value!;
  return fallback;
}

/** The viewport a toast raised now would use. `from` picks the nearest provider around that element. */
export function toastViewport(from?: Element): TctToastViewport {
  defineElement(TctLayerProvider);
  const scoped = from?.closest<TctLayerProvider>('tct-layer-provider')?.viewport;
  return scoped ?? providerViewport() ?? fallbackViewport();
}

/**
 * Shows a toast and returns a function that dismisses it (reason `manual`). Safe to call before
 * anything is on the page; a no-op returning a no-op on the server. `from` scopes the toast to the
 * nearest `tct-layer-provider` around that element (a theme island with its own provider).
 */
export function toast(options: ToastOptions, settings: {from?: Element} = {}): ToastDismissFn {
  if (typeof document === 'undefined') return () => undefined;
  const viewport = toastViewport(settings.from);
  const entry: ToastEntry = {id: `tct-toast-${++counter}`, options, createdAt: Date.now()};
  viewport.addToast(entry);
  return () => {
    viewport.removeToast(entry.id, 'manual');
  };
}

/** Dismisses the toast with this `uniqueId`, if it is showing. */
export function dismissToast(uniqueId: string, settings: {from?: Element} = {}): void {
  if (typeof document === 'undefined') return;
  const viewport = toastViewport(settings.from);
  const entry = viewport.findByUniqueId(uniqueId);
  if (entry) viewport.removeToast(entry.id, 'manual');
}

/** Dismisses every toast of the viewport a new toast would use. */
export function dismissAllToasts(settings: {from?: Element} = {}): void {
  if (typeof document === 'undefined') return;
  const viewport = toastViewport(settings.from);
  for (const entry of viewport.entries) viewport.removeToast(entry.id, 'manual');
}

/** Removes the fallback viewport. Test-only. */
export function resetToastFallback(): void {
  fallback?.parentElement?.remove();
  fallback = null;
  counter = 0;
}
