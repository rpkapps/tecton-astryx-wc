/**
 * The one document-level layer stack (A§9.9, A-08). Port of upstream `layerStack.ts` and the
 * dismissal rules of `useLayerDismissal`, re-expressed for DOM containment.
 *
 * Why one stack: every overlay that owned its own Escape listener made one press dismiss every open
 * layer. Overlays register here and say what they want done; the stack owns ONE `keydown` listener
 * (bubble phase, so content can claim the press with `preventDefault()`/`stopPropagation()`), ONE
 * capture `pointerdown` listener (outside press) and ONE capture `focusin` listener (focus-out).
 *
 *  - Order: a layer nested inside another (its host is inside the other's surface/host in the flat
 *    tree, or `parent` says so) is above it; otherwise later registration is on top. Modality is not
 *    a key, so a tooltip shown inside a modal still gets the press.
 *  - Escape reaches the top-most present layer only; `'block'` consumes it without closing, `'none'`
 *    makes the layer invisible to Escape. A composing Escape (IME) is claimed and ignored.
 *  - Outside press closes every layer above the innermost layer containing the target and never
 *    closes a parent because of a press in its child.
 *  - The stack, not the browser, decides: handled presses call `preventDefault()`, which suppresses
 *    native `<dialog>` `cancel` and popover close requests, so there is one code path everywhere.
 * Guides: [mwg:platform-controls-dismiss-dialog] [mwg:resilient-context-menus-and-nested-dropdowns]
 */
import type {ChangeReason} from '../events/tct-event.js';
import {containsFlat} from '../utils/focus.js';
import {isImeKeyEvent} from '../utils/ime.js';
import {noteGestureEvent} from './gesture.js';
import type {EscapeBehavior, LayerKind} from './layer-controller.js';

export interface LayerEntry {
  /** Identity for removal and top-most checks (the `LayerController`). */
  readonly token: object;
  readonly kind: LayerKind;
  /** The element that owns the layer (its subtree contains nested layers' hosts). */
  host(): Element | null;
  /** The `<dialog>` or `[popover]` surface. */
  surface(): HTMLElement | null;
  /** The invoker; a press on it is inside the layer (its click toggles). */
  trigger(): HTMLElement | null;
  /** Extra elements that count as inside the layer. */
  inside(): (EventTarget | null | undefined)[];
  escape(): EscapeBehavior;
  /** Resolved outside-press policy for one press. */
  outsidePress(event: PointerEvent): boolean;
  readonly focusOut: boolean;
  /** Token of the enclosing layer, when known from context. */
  parent(): object | null;
  /** Whether the layer is really on screen right now, asked at press time. */
  isPresent(): boolean;
  dismiss(reason: ChangeReason, event?: Event): void;
}

interface StoredEntry extends LayerEntry {
  readonly seq: number;
}

/** Read-only view of a registered layer (tests and diagnostics). */
export interface LayerSnapshot {
  readonly token: object;
  readonly kind: LayerKind;
  readonly host: Element | null;
  readonly surface: HTMLElement | null;
  readonly isTopmost: boolean;
}

const entries: StoredEntry[] = [];
// A layer keeps its first place for as long as its identity lives: re-registering (a behaviour
// change while open) must not promote it above the layers opened over it.
let seqByToken = new WeakMap<object, number>();
let nextSeq = 0;
let listening = false;
let composing = false;

function seqFor(token: object): number {
  const existing = seqByToken.get(token);
  if (existing !== undefined) return existing;
  const seq = nextSeq++;
  seqByToken.set(token, seq);
  return seq;
}

// ------------------------------------------------------------------------------------- ordering

function contains(outer: StoredEntry, node: Node | null): boolean {
  if (!node) return false;
  return containsFlat(outer.surface(), node) || containsFlat(outer.host(), node);
}

/** Layers above which `entry` is nested: explicit `parent` chain plus flat-tree containment. */
function depthOf(entry: StoredEntry, present: readonly StoredEntry[]): number {
  const ancestors = new Set<StoredEntry>();
  const byToken = new Map(present.map((candidate) => [candidate.token, candidate]));
  for (let token = entry.parent(); token;) {
    const outer = byToken.get(token);
    if (!outer || ancestors.has(outer)) break;
    ancestors.add(outer);
    token = outer.parent();
  }
  const host = entry.host();
  for (const other of present) {
    if (other !== entry && contains(other, host)) ancestors.add(other);
  }
  return ancestors.size;
}

function presentEntries(): StoredEntry[] {
  return entries.filter((entry) => entry.isPresent());
}

/** Present layers, top-most first (depth, then registration order). */
function orderedTopFirst(list: readonly StoredEntry[] = presentEntries()): StoredEntry[] {
  const depths = new Map(list.map((entry) => [entry, depthOf(entry, list)]));
  return [...list].sort((a, b) => depths.get(b)! - depths.get(a)! || b.seq - a.seq);
}

function topmostPresent(): StoredEntry | null {
  return orderedTopFirst()[0] ?? null;
}

/** Whether `token` is the top-most present layer. */
export function isTopmostLayer(token: object): boolean {
  return topmostPresent()?.token === token;
}

/**
 * Whether a close request the browser raised on its own (dialog `cancel`, `CloseWatcher`, Android
 * back) should dismiss the layer: it must be top-most and no IME composition may be running.
 */
export function shouldDismissOnCloseRequest(token: object): boolean {
  return !composing && isTopmostLayer(token);
}

/** Whether a text composition is running anywhere on the page (tracked while layers exist). */
export function isTextComposing(): boolean {
  return composing;
}

/** Bottom-to-top view of the present layers. */
export function getLayerStack(): LayerSnapshot[] {
  const top = topmostPresent();
  return orderedTopFirst()
    .reverse()
    .map((entry) => ({
      token: entry.token,
      kind: entry.kind,
      host: entry.host(),
      surface: entry.surface(),
      isTopmost: entry === top,
    }));
}

// ------------------------------------------------------------------------------------- Escape

function onKeyDown(event: KeyboardEvent): void {
  if (event.key !== 'Escape') return;
  const participants = orderedTopFirst(presentEntries().filter((e) => e.escape() !== 'none'));
  const top = participants[0];
  // An IME user pressing Escape is cancelling a composition, not dismissing a layer. Claim the
  // press anyway: left unclaimed the browser raises its own close request, which reaches the
  // layer's `cancel` handler and dismisses it on the same keypress.
  if (isImeKeyEvent(event)) {
    if (top) event.preventDefault();
    return;
  }
  // Content inside a layer already claimed this press.
  if (event.defaultPrevented || !top) return;
  if (top.escape() === 'close') top.dismiss('escape', event);
  // Both 'close' and 'block' consume the press: suppresses the browser's own close request.
  event.preventDefault();
}

// ------------------------------------------------------------------------------ outside press

/** Whether a press at (x, y) hit the dialog's box rather than its backdrop. */
function withinBox(surface: HTMLElement, event: PointerEvent): boolean {
  const box = surface.getBoundingClientRect();
  return (
    event.clientX >= box.left &&
    event.clientX <= box.right &&
    event.clientY >= box.top &&
    event.clientY <= box.bottom
  );
}

/** The elements that count as inside a layer: its surface, its trigger and the owner's extras. */
function insideTargets(entry: StoredEntry, surface: HTMLElement | null): EventTarget[] {
  return [surface, entry.trigger(), ...entry.inside()].filter(
    (target): target is EventTarget => target !== null && target !== undefined,
  );
}

function isInsidePress(
  entry: StoredEntry,
  path: readonly EventTarget[],
  event: PointerEvent,
): boolean {
  const surface = entry.surface();
  if (!insideTargets(entry, surface).some((target) => path.includes(target))) return false;
  // The backdrop of a modal <dialog> dispatches events to the dialog itself; a press there is
  // outside the visible box [mwg:light-dismiss-a-dialog].
  if (entry.kind === 'modal' && surface && path[0] === surface && !withinBox(surface, event)) {
    return false;
  }
  return true;
}

function onPointerDown(event: PointerEvent): void {
  noteGestureEvent(event);
  const ordered = orderedTopFirst();
  const path = event.composedPath();
  const innermost = ordered.findIndex((entry) => isInsidePress(entry, path, event));
  const above = innermost === -1 ? ordered : ordered.slice(0, innermost);
  for (const entry of above) {
    if (entry.outsidePress(event)) entry.dismiss('outside', event);
  }
}

function onFocusIn(event: FocusEvent): void {
  const path = event.composedPath();
  for (const entry of orderedTopFirst()) {
    if (!entry.focusOut) continue;
    if (!insideTargets(entry, entry.surface()).some((target) => path.includes(target))) {
      entry.dismiss('focus-out', event);
    }
  }
}

// -------------------------------------------------------------------------------- composition

const onCompositionStart = (): void => {
  composing = true;
};
// Focus leaving the field ends the composition too, so a lost `compositionend` cannot leave the
// flag stuck on and swallow every later close request.
const onCompositionEnd = (): void => {
  composing = false;
};

function startListening(): void {
  if (listening || typeof document === 'undefined') return;
  listening = true;
  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('pointerdown', onPointerDown, true);
  document.addEventListener('focusin', onFocusIn, true);
  document.addEventListener('compositionstart', onCompositionStart, true);
  document.addEventListener('compositionend', onCompositionEnd, true);
  document.addEventListener('blur', onCompositionEnd, true);
}

function stopListening(): void {
  if (!listening || typeof document === 'undefined') return;
  listening = false;
  composing = false;
  document.removeEventListener('keydown', onKeyDown);
  document.removeEventListener('pointerdown', onPointerDown, true);
  document.removeEventListener('focusin', onFocusIn, true);
  document.removeEventListener('compositionstart', onCompositionStart, true);
  document.removeEventListener('compositionend', onCompositionEnd, true);
  document.removeEventListener('blur', onCompositionEnd, true);
}

/** Adds a layer to the stack for as long as it is open; returns the unregister function. */
export function registerLayer(entry: LayerEntry): () => void {
  const stored: StoredEntry = {...entry, seq: seqFor(entry.token)};
  entries.push(stored);
  startListening();
  return () => {
    const index = entries.indexOf(stored);
    if (index !== -1) entries.splice(index, 1);
    if (entries.length === 0) stopListening();
  };
}

/** Drops every layer and detaches the listeners. Test-only. */
export function resetLayerStack(): void {
  entries.length = 0;
  seqByToken = new WeakMap();
  nextSeq = 0;
  stopListening();
}
