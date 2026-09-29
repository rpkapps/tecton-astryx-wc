/**
 * Dev-mode diagnostics (A§7.3, A§9.18). Warnings are builder guardrails: they only print while
 * `globalThis.tctDevMode === true`, at most once per id, so production consoles stay quiet and a
 * warning inside `render()` does not repeat on every update.
 */

declare global {
  // Set by applications (or the docs site) to turn on library warnings.
  var tctDevMode: boolean | undefined;
}

const warned = new Set<string>();

/** Whether dev warnings are on (`globalThis.tctDevMode === true`). */
export function isDevMode(): boolean {
  return globalThis.tctDevMode === true;
}

/** Warns once per `id` while dev mode is on. `id` is also the deduplication key. */
export function devWarn(id: string, message: string, ...details: unknown[]): void {
  if (!isDevMode() || warned.has(id)) return;
  warned.add(id);
  console.warn(`[tecton] ${message}`, ...details);
}

/** Like {@link devWarn} but always reports (real runtime failures), once per `id`. */
export function devError(id: string, message: string, ...details: unknown[]): void {
  if (warned.has(id)) return;
  warned.add(id);
  console.error(`[tecton] ${message}`, ...details);
}

/** Forgets which ids already warned. Test-only. */
export function resetDevWarnings(): void {
  warned.clear();
}
