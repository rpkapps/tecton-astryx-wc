/// <reference types="@vitest/browser-playwright" />
/**
 * Tier-2 emulation (A§1.1, A§15.5). One Chromium run with `TCT_TIER2=1` forces the features listed
 * below off, so layers are positioned by the Floating UI fallback, cross-root ARIA relationships fall
 * back to copied text, and `:state()` is absent. Tests written for Tier 1 semantics guard with
 * `describe.skipIf(isTier2)`; Tier-2-specific tests use `withFeature` explicitly and run everywhere.
 */
import {server} from 'vitest/browser';
import {overrideFeature, type FeatureName} from '@tecton-wc/core/features.js';

/** Features `TCT_TIER2=1` forces off (A§18.5). */
export const TIER2_DISABLED: readonly FeatureName[] = [
  'implicitAnchor',
  'elementReflection',
  'customStates',
];

/** True for the `TCT_TIER2=1` run. */
export const isTier2: boolean = String(import.meta.env.TCT_TIER2 ?? '') === '1';

/** Runs `fn` with a feature forced on or off, restoring afterwards even when `fn` throws. */
export async function withFeature<T>(
  name: FeatureName,
  value: boolean,
  fn: () => T | Promise<T>,
): Promise<T> {
  const restore = overrideFeature(name, value);
  try {
    return await fn();
  } finally {
    restore();
  }
}

/** Forces several features at once; returns one restore function. */
export function forceFeatures(values: Partial<Record<FeatureName, boolean>>): () => void {
  const restores = (Object.entries(values) as [FeatureName, boolean][]).map(([name, value]) =>
    overrideFeature(name, value),
  );
  return () => {
    for (const restore of restores.reverse()) restore();
  };
}

/** The engine this run is on (`chromium`, `firefox`, `webkit`), for tests that need CDP or engine-specific paths. */
export const engine: string = server.browser;

/** True in Chromium, the only engine with CDP (`axNode`, `emulateMedia`). */
export const isChromium: boolean = engine === 'chromium';
