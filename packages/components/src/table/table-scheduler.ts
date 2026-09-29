/**
 * Yielding to the main thread between chunks of work [mwg:break-up-long-tasks]. `scheduler.yield()`
 * where it exists (Chrome 129, Firefox 142): the continuation keeps its place in the queue but the
 * browser can handle input and paint first. Elsewhere `setTimeout(0)`.
 */

interface SchedulerLike {
  yield?: () => Promise<void>;
}

/** Resolves after the browser had a chance to handle input and render. */
export function yieldToMain(): Promise<void> {
  const scheduler = (globalThis as {scheduler?: SchedulerLike}).scheduler;
  if (typeof scheduler?.yield === 'function') return scheduler.yield();
  return new Promise((resolve) => setTimeout(resolve, 0));
}
