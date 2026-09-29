/**
 * Scroll-position arithmetic of the outline (upstream `useScrollSpy`). One number is shared by the
 * activation line and the scroll landing: the scroll root's top, plus `offset` (a fixed header overlaying
 * the root), plus the heading's own `scroll-margin-top`. A heading therefore activates exactly where
 * navigating to it puts it. The active heading is the LAST one whose top has passed that line, computed
 * from live positions on every scroll, so it is right on load, when scrolling up, and for short final
 * sections: the first item is active above the first heading and the last at the bottom.
 * [mwg:scrollspy] (the `scroll-target-group` route is Chromium-only and cannot see headings in another
 * tree; the guide's own fallback is position-based)
 */
import {flatParent} from '@tecton-wc/core/utils/focus.js';
import type {OutlineItem} from './outline.types.js';

/** How long to wait for a programmatic smooth scroll to settle when `scrollend` never arrives. */
export const SCROLL_SETTLE_TIMEOUT_MS = 1200;

/** Keys that scroll the viewport: a manual scroll intent. */
export const SCROLL_KEYS: ReadonlySet<string> = new Set([
  'ArrowUp',
  'ArrowDown',
  'PageUp',
  'PageDown',
  'Home',
  'End',
  ' ',
  'Spacebar',
]);

/** The nearest scrollable ancestor in the flat tree (crossing shadow roots), or `null` for the viewport. */
export function getScrollableAncestor(element: Element | null): HTMLElement | null {
  let current: Node | null = element ? flatParent(element) : null;
  while (current) {
    if (current instanceof HTMLElement) {
      const overflowY = getComputedStyle(current).overflowY;
      const scrollable =
        (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') &&
        current.scrollHeight > current.clientHeight;
      if (scrollable) return current;
    }
    current = flatParent(current);
  }
  return null;
}

const scrollMarginTop = (element: Element): number =>
  Number.parseFloat(getComputedStyle(element).scrollMarginTop) || 0;

const rootTop = (root: HTMLElement | null): number => (root ? root.getBoundingClientRect().top : 0);

/** Where a heading comes to rest, in viewport coordinates. */
export function getRestingTop(target: Element, root: HTMLElement | null, offset: number): number {
  return rootTop(root) + offset + scrollMarginTop(target);
}

/**
 * Brings `target` to rest at the top of the scroll root, below any fixed header. With no `offset` this is
 * the CSS-native path: `scrollIntoView` already honours `scroll-margin-top` and walks every scrollable
 * ancestor. An `offset` is a header the browser cannot know about, so the landing is computed explicitly.
 */
export function scrollToTarget(
  target: HTMLElement,
  root: HTMLElement | null,
  scroller: HTMLElement | Window,
  offset: number,
  smooth: boolean,
): void {
  const behavior: ScrollBehavior = smooth ? 'smooth' : 'instant';
  if (offset === 0) {
    target.scrollIntoView({behavior, block: 'start'});
    return;
  }
  const delta = target.getBoundingClientRect().top - getRestingTop(target, root, offset);
  scroller.scrollBy({top: delta, behavior});
}

/** The id of the last item whose heading has passed its activation line (see the file comment). */
export function resolveActiveId(
  items: readonly OutlineItem[],
  lookup: (id: string) => HTMLElement | null,
  root: HTMLElement | null,
  offset: number,
): string | undefined {
  if (items.length === 0) return undefined;
  const atBottom = root
    ? root.scrollTop + root.clientHeight >= root.scrollHeight - 2
    : window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
  // A page that does not scroll at all is "at the bottom" of nothing: keep the first item.
  const scrollable = root
    ? root.scrollHeight > root.clientHeight + 2
    : document.documentElement.scrollHeight > window.innerHeight + 2;
  if (atBottom && scrollable) return items[items.length - 1]!.id;

  let active = items[0]!.id;
  for (const item of items) {
    const element = lookup(item.id);
    if (!element) continue;
    // 1px of tolerance absorbs sub-pixel rounding after a scroll lands.
    if (element.getBoundingClientRect().top <= getRestingTop(element, root, offset) + 1)
      active = item.id;
    else break;
  }
  return active;
}
