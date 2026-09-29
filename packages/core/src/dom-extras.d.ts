/**
 * Ambient declarations for platform features that are progressive enhancements (A§1.2 rule 3) and
 * not yet in the TypeScript DOM library. Every use is guarded by `features` (A§9.5).
 */

interface AriaNotifyOptions {
  priority?: 'normal' | 'high';
  interrupt?: 'all' | 'pending' | 'none';
}

interface Element {
  /** Native announcement API (Safari 27); absent elsewhere, see `features.ariaNotify`. */
  ariaNotify?(announcement: string, options?: AriaNotifyOptions): void;
}

interface CloseWatcherOptions {
  signal?: AbortSignal;
}

/** Platform close requests (Android back, Escape). Chromium; see `features.closeWatcher`. */
interface CloseWatcher extends EventTarget {
  oncancel: ((event: Event) => void) | null;
  onclose: ((event: Event) => void) | null;
  requestClose(): void;
  close(): void;
  destroy(): void;
}

// eslint-disable-next-line no-var -- ambient global constructor declaration
declare var CloseWatcher: {
  prototype: CloseWatcher;
  new (options?: CloseWatcherOptions): CloseWatcher;
};
