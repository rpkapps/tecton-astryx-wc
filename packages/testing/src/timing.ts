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
  // `getAnimations({subtree: true})` stays in one tree: animations inside shadow roots (a status that
  // fades in inside a field inside a selector) were missed, and axe then read a half-faded colour.
  // Collect through every shadow root, and repeat while finishing animations start new ones.
  for (let round = 0; round < 10; round++) {
    await nextFrame();
    // Endless animations (spinners, skeleton shimmer) never finish: wait only for the ones that end.
    const running = deepAnimations(element).filter(
      (animation) =>
        animation.playState === 'running' &&
        animation.effect?.getComputedTiming().iterations !== Infinity,
    );
    if (running.length === 0) return;
    await Promise.allSettled(running.map((animation) => animation.finished));
  }
}

/** Animations on `root` and everything under it, shadow roots included. */
export function deepAnimations(root: Element): Animation[] {
  const animations = [...root.getAnimations({subtree: true})];
  const visit = (node: Element | ShadowRoot): void => {
    for (const child of node.querySelectorAll('*')) {
      if (child.shadowRoot) {
        for (const inner of child.shadowRoot.children)
          animations.push(...inner.getAnimations({subtree: true}));
        visit(child.shadowRoot);
      }
    }
  };
  if (root.shadowRoot) {
    for (const inner of root.shadowRoot.children)
      animations.push(...inner.getAnimations({subtree: true}));
    visit(root.shadowRoot);
  }
  visit(root);
  return [...new Set(animations)];
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
