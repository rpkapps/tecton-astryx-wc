/**
 * Which toast viewport a `toast()` call reaches: the viewport of a connected `tct-layer-provider`
 * (the outermost one wins), else a lazily created fallback on `document.body`. Kept apart from the
 * elements so the provider and the module API do not import each other.
 */
import type {TctToastViewport} from './tct-toast-viewport.js';

/** Anything that can hand out a viewport (the provider element). */
export interface ToastViewportSource {
  readonly isConnected: boolean;
  readonly viewport: TctToastViewport | null;
}

const providers = new Set<ToastViewportSource>();

/** Registers a connected provider; returns the unregister function. */
export function registerToastProvider(provider: ToastViewportSource): () => void {
  providers.add(provider);
  return () => {
    providers.delete(provider);
  };
}

/** The first connected provider viewport (registration order = the outermost provider), if any. */
export function providerViewport(): TctToastViewport | null {
  for (const provider of providers) {
    const viewport = provider.viewport;
    if (provider.isConnected && viewport) return viewport;
  }
  return null;
}

/** Forgets every provider. Test-only. */
export function resetToastProviders(): void {
  providers.clear();
}
