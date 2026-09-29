/**
 * Top-layer persistence (A§9.9, A§9.16, `[mwg:persistent-top-layer-ui]`).
 *
 * `showModal()` makes everything outside the dialog inert, top layer or not: a toast action would be
 * unclickable and a live region silent. UI that must stay usable while a modal is open (the
 * announcer's regions, a toaster) registers here; whenever the top-most modal changes it is moved
 * into that modal's surface, and back to its home when the last modal closes.
 *
 * Moves use `moveBefore()` when the engine has it (state, focus and open popovers survive); the
 * fallback appends and re-shows a popover that was open, because a plain move closes it.
 */
import {features} from '../features.js';

interface Persistent {
  readonly element: HTMLElement;
  /** Where the element lives when no modal is open. */
  readonly home: () => ParentNode | null;
}

const persistent = new Set<Persistent>();
/** Modal surfaces in the order they entered the top layer (last = top-most). */
const modals: HTMLElement[] = [];

function moveInto(element: HTMLElement, target: ParentNode): void {
  if (element.parentNode === target) return;
  if (features.moveBefore) {
    try {
      (target as Element).moveBefore(element, null);
      return;
    } catch {
      // Not movable atomically (disconnected target, different document): fall back.
    }
  }
  const reshow =
    features.popover && element.hasAttribute('popover') && element.matches(':popover-open');
  target.append(element);
  if (reshow) {
    try {
      element.showPopover();
    } catch {
      // Already open again or not connected: nothing to restore.
    }
  }
}

/** Moves every registered element to the top-most modal, or home when there is none. */
export function syncTopLayerHost(): void {
  const modal = modals[modals.length - 1];
  for (const {element, home} of persistent) {
    const target = modal ?? home();
    if (target) moveInto(element, target);
  }
}

/**
 * Keeps `element` reachable while a modal is open. `home` is where it lives otherwise (default
 * `document.body`). Returns the unregister function; the element stays where it is.
 */
export function registerTopLayerPersistent(
  element: HTMLElement,
  options: {home?: () => ParentNode | null} = {},
): () => void {
  const entry: Persistent = {element, home: options.home ?? (() => document.body)};
  persistent.add(entry);
  syncTopLayerHost();
  return () => {
    persistent.delete(entry);
  };
}

/** Called by `LayerController` right after a modal surface enters the top layer. */
export function noteModalShown(surface: HTMLElement): void {
  const index = modals.indexOf(surface);
  if (index !== -1) modals.splice(index, 1);
  modals.push(surface);
  syncTopLayerHost();
}

/** Called by `LayerController` after a modal surface left the top layer. */
export function noteModalHidden(surface: HTMLElement): void {
  const index = modals.indexOf(surface);
  if (index !== -1) modals.splice(index, 1);
  syncTopLayerHost();
}

/** The surface persistent UI currently lives in, or `null` when no modal is open. */
export function topmostModalSurface(): HTMLElement | null {
  return modals[modals.length - 1] ?? null;
}

/** Clears modals and registrations. Test-only. */
export function resetTopLayerHost(): void {
  modals.length = 0;
  persistent.clear();
}
