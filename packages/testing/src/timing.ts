/** Timing helpers (A§15.2). Prefer awaiting a condition over sleeping. */

/** Resolves on the next animation frame. */
export function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

/** Resolves after `ms` milliseconds (default: next macrotask). */
export function aTimeout(ms = 0): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Resolves when the CSS/WAAPI animations running on `element` and its subtree (an overlay's enter
 * motion) have finished. Measure positions or run axe (colour contrast) only after that.
 */
export async function animationsFinished(element: Element): Promise<void> {
  await nextFrame();
  const running = element.getAnimations({subtree: true});
  await Promise.allSettled(running.map((animation) => animation.finished));
}

/** Polls `predicate` every frame until it returns truthy; fails after `timeout` ms. */
export async function waitUntil(
  predicate: () => unknown,
  message = 'condition',
  timeout = 2000,
): Promise<void> {
  const start = performance.now();
  while (!predicate()) {
    if (performance.now() - start > timeout) throw new Error(`waitUntil timed out: ${message}`);
    await nextFrame();
  }
}
