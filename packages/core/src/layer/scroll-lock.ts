/**
 * Ref-counted page scroll lock for modal layers (A§9.9, A§9.18). `overflow: hidden` plus
 * `scrollbar-gutter: stable` on `<html>`, so hiding the scrollbar does not shift the page. Nested
 * modals share one lock; it is released when the last owner unlocks. Inline styles are restored to
 * what the page had, not cleared.
 */

let count = 0;
let saved: {overflow: string; gutter: string} | undefined;

/** Locks page scrolling; call the returned function once to release this holder's lock. */
export function lockScroll(): () => void {
  const root = document.documentElement;
  if (count === 0) {
    saved = {
      overflow: root.style.getPropertyValue('overflow'),
      gutter: root.style.getPropertyValue('scrollbar-gutter'),
    };
    root.style.setProperty('overflow', 'hidden');
    root.style.setProperty('scrollbar-gutter', 'stable');
  }
  count += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    count -= 1;
    if (count === 0) restore();
  };
}

function restore(): void {
  const root = document.documentElement;
  if (saved) {
    for (const [property, value] of [
      ['overflow', saved.overflow],
      ['scrollbar-gutter', saved.gutter],
    ] as const) {
      if (value) root.style.setProperty(property, value);
      else root.style.removeProperty(property);
    }
  }
  saved = undefined;
}

/** Whether any holder currently locks scrolling. */
export function isScrollLocked(): boolean {
  return count > 0;
}

/** Releases every lock. Test-only. */
export function resetScrollLock(): void {
  count = 0;
  if (typeof document !== 'undefined') restore();
}
