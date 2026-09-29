/**
 * Drag, snap and resize machinery of the bottom sheet: a port of upstream `useSheetGestures` as a
 * Lit controller. Drag places, swipe closes: a slow drag settles at the nearest snap detent, a fast
 * flick down dismisses, a fast flick up expands to the tallest detent.
 *
 * What differs from upstream (see `parity.json` BOTTOMSHEET-03):
 * - A detent is always a compositor `translate` (`--_sheet-offset` on the sheet); upstream splits it
 *   into a layout height plus a transform. Content that would fall below the fold at a lower detent
 *   stays reachable because the scrolling body gives up that offset as block-end margin (`--_sheet-inset`).
 * - Every gesture has a non-drag equivalent (WCAG 2.5.7): `step()`, `first()`, `last()`, `snapToIndex()`
 *   and `cycle()` are what the slider handle's keys and taps call.
 * - The controller writes to the DOM directly (custom properties and data attributes) instead of
 *   re-rendering per frame; the host is asked to re-render only when the settled detent changes.
 *
 * Touch on the scrolling body hands over to the sheet at a scroll edge (non-passive `touchmove`):
 * a finger that lands on an edge and pulls away from it promotes at once by cancelling the first,
 * still-cancelable move; a finger that scrolls INTO the end of the content mid-gesture cannot be
 * cancelled any more, and instead anchors where the content ran out and drives the sheet from the
 * travel beyond it. [mwg:swipe-to-remove] [mwg:navigation-drawer]
 */
import type {ReactiveController, ReactiveControllerHost} from 'lit';
import {OVERSCROLL_PADDING} from './bottom-sheet.types.js';
import {
  computeDetentOffsets,
  peekOffsetFor,
  resolveSettleOffset,
  scrimOpacityForOffset,
} from './snap-offsets.js';

/** A fast throw dismisses (down) or expands (up) regardless of where it ends: a speed and a distance floor. */
export const FLICK_VELOCITY = 1.2; // px/ms
export const FLICK_MIN_DISTANCE = 48; // px
/** A slow drag below the shortest detent dismisses once past it by this share of that detent's height. */
export const DISMISS_OVERSHOOT_RATIO = 0.4;
/** Within this many px of a detent the live drag is eased toward it so it "clicks" into place. */
export const MAGNET_RANGE = 40;
/** Rubber band for dragging up past fully open, capped at the reserved band. */
export const OVERSCROLL_RESISTANCE = 0.35;
/** Travel past the point where a scroll ran out of content before the sheet gets the rest of the pull. */
export const CONTENT_END_HANDOFF_SLOP = 4;
/** How far a finger resting on the body must travel before the pull is a sheet drag rather than a tap. */
export const DRAG_PROMOTION_SLOP = 8;

const TRANSITION_BACKSTOP_BUFFER_MS = 50;

/** Where a detent change came from; only user sources raise `tct-snap-change`. */
export type SheetMoveSource = 'pointer' | 'keyboard' | 'programmatic';

export interface SheetDetents {
  /** Resting offsets from fully open, ascending; `offsets[0]` is always 0. */
  offsets: number[];
  /** The offset of the peek stop, or `null` when the sheet has none. */
  peekOffset: number | null;
  /** Full border-box height of the sheet (including the reserved bottom band). */
  height: number;
  /** Height of the sheet that is visible when fully open. */
  visibleHeight: number;
}

export interface SheetGestureOptions {
  /** The sliding panel (`translate` is written on it). */
  sheet: () => HTMLElement | null;
  /** The scrolling body (touch handoff, scroll reach). */
  body: () => HTMLElement | null;
  /** Resolved visible heights (px) of the extra stops, against the current viewport. */
  snapHeights: () => number[];
  /** Whether a swipe may dismiss. When false a gesture past the floor settles at the shortest stop. */
  canDismiss: () => boolean;
  /** A swipe wants to dismiss. Return `true` when the owner accepted (it then closes the sheet). */
  onDismiss: () => boolean;
  /** The resting detent changed. */
  onSnap: (change: {index: number; visibleHeight: number; source: SheetMoveSource}) => void;
  /** The scrim opacity the owner should paint (1 = full, 0 = none). */
  onScrim: (opacity: number) => void;
  /** The sheet started to travel under a finger or pointer (a field's keyboard should go away). */
  onTravel?: () => void;
}

interface Drag {
  kind: 'pointer' | 'touch';
  id: number;
  startY: number;
  lastY: number;
  lastTime: number;
  velocity: number;
  detents: SheetDetents;
  base: number;
  current: number;
  traveled: boolean;
}

interface TouchTrack {
  id: number;
  startY: number;
  top: boolean;
  bottom: boolean;
  contentEndY: number | null;
  promotedAtContentEnd: boolean;
}

/** Pulls `value` toward the nearest of `targets` inside `MAGNET_RANGE`, easing the last stretch. */
export function magnetize(value: number, targets: readonly number[]): number {
  let nearest = targets[0] ?? 0;
  let nearestDistance = Math.abs(value - nearest);
  for (const target of targets) {
    const distance = Math.abs(value - target);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = target;
    }
  }
  if (nearestDistance >= MAGNET_RANGE) return value;
  // Ease-in over the range: the pull grows as you approach (t squared), so the click feels magnetic
  // near the detent but does not fight a deliberate drag-through.
  const t = nearestDistance / MAGNET_RANGE;
  return value + (nearest - value) * (1 - t * t);
}

const reducedMotion = (): boolean =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** A short haptic tick where supported (not iOS Safari); skipped under reduced motion. */
function hapticTick(): void {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  if (reducedMotion()) return;
  navigator.vibrate(8);
}

function parseTime(value: string): number | null {
  const text = value.trim();
  if (!/^-?(?:\d+|\d*\.\d+)(?:ms|s)$/.test(text)) return null;
  const time = Number.parseFloat(text);
  return text.endsWith('ms') ? time : time * 1000;
}

/**
 * Calls `complete` once the `property` transition of `element` is over: on `transitionend`, at once
 * when there is none (reduced motion, a zero duration), or after a backstop timer. Returns a cancel function.
 */
export function whenTransitionSettled(
  element: HTMLElement,
  property: 'translate' | 'opacity',
  complete: () => void,
): () => void {
  const state: {done: boolean; timer: ReturnType<typeof setTimeout> | undefined} = {
    done: false,
    timer: undefined,
  };
  const finish = (): void => {
    if (state.done) return;
    state.done = true;
    if (state.timer !== undefined) clearTimeout(state.timer);
    element.removeEventListener('transitionend', onEnd);
    element.removeEventListener('transitioncancel', onEnd);
    complete();
  };
  const onEnd = (event: Event): void => {
    if (event.target === element && (event as TransitionEvent).propertyName === property) {
      finish();
    }
  };
  element.addEventListener('transitionend', onEnd);
  element.addEventListener('transitioncancel', onEnd);
  const style = getComputedStyle(element);
  const properties = style.transitionProperty.split(',').map((value) => value.trim());
  const durations = style.transitionDuration.split(',').map(parseTime);
  const delays = style.transitionDelay.split(',').map(parseTime);
  let total = 0;
  properties.forEach((name, index) => {
    if (name !== property && name !== 'all') return;
    const duration = durations[index % durations.length] ?? 0;
    const delay = delays[index % delays.length] ?? 0;
    total = Math.max(total, duration + delay);
  });
  if (total <= 0) {
    finish();
    return () => undefined;
  }
  state.timer = setTimeout(finish, total + TRANSITION_BACKSTOP_BUFFER_MS);
  return () => {
    state.done = true;
    if (state.timer !== undefined) clearTimeout(state.timer);
    element.removeEventListener('transitionend', onEnd);
    element.removeEventListener('transitioncancel', onEnd);
  };
}

export class SheetGestureController implements ReactiveController {
  readonly #host: ReactiveControllerHost;
  readonly #o: SheetGestureOptions;

  /** Index of the resting detent into the resolved offsets (survives viewport changes). */
  #index = 0;
  #offset = 0;
  #drag: Drag | null = null;
  #armed: {id: number; startY: number; scroller: HTMLElement} | null = null;
  #touch: TouchTrack | null = null;
  #touchBody: HTMLElement | null = null;
  #cancelSettle: (() => void) | undefined;
  #observer: ResizeObserver | undefined;
  #observed: HTMLElement | null = null;
  #dismissing = false;
  #active = false;
  #lastHeight = 0;
  #reanchorFrame = 0;
  /** Whether the press that started the current handle drag has travelled (else it is a tap). */
  #moved = false;
  #tap: (() => void) | undefined;

  constructor(host: ReactiveControllerHost, options: SheetGestureOptions) {
    this.#host = host;
    this.#o = options;
    host.addController(this);
  }

  // ----------------------------------------------------------------------------------- state

  /** Index of the resting detent (0 = tallest). */
  get index(): number {
    return this.#index;
  }

  /** Where the sheet is drawn: the drag position while dragging, else the resting offset. */
  get offset(): number {
    return this.#offset;
  }

  get isDragging(): boolean {
    return this.#drag !== null;
  }

  /** The current detents (measured now). */
  get detents(): SheetDetents {
    return this.#resolve();
  }

  /** Number of resting detents, including the tallest one. */
  get count(): number {
    return this.#resolve().offsets.length;
  }

  /** Visible height of the sheet at the resting detent, in px. */
  get visibleHeight(): number {
    const detents = this.#resolve();
    return Math.max(0, detents.visibleHeight - (detents.offsets[this.#index] ?? 0));
  }

  // -------------------------------------------------------------------------------- lifecycle

  hostConnected(): void {
    window.addEventListener('blur', this.#onWindowBlur);
    document.addEventListener('visibilitychange', this.#onVisibility);
  }

  hostDisconnected(): void {
    window.removeEventListener('blur', this.#onWindowBlur);
    document.removeEventListener('visibilitychange', this.#onVisibility);
    this.deactivate();
  }

  /** The sheet is open: watch the viewport and the sheet's own height. (`reset()` is the owner's call, before it shows.) */
  activate(): void {
    this.#active = true;
    window.addEventListener('resize', this.#onViewport);
    window.addEventListener('orientationchange', this.#onViewport);
    this.#observe();
  }

  /** The sheet closed. */
  deactivate(): void {
    this.#active = false;
    window.removeEventListener('resize', this.#onViewport);
    window.removeEventListener('orientationchange', this.#onViewport);
    this.#observer?.disconnect();
    this.#observer = undefined;
    this.#observed = null;
    this.#cancelSettle?.();
    this.#cancelSettle = undefined;
    cancelAnimationFrame(this.#reanchorFrame);
    this.#reanchorFrame = 0;
    this.#drag = null;
    this.#armed = null;
    this.#touch = null;
  }

  /** Back to the tallest detent, no animation (a sheet re-opens fully open). */
  reset(): void {
    this.#cancelSettle?.();
    this.#cancelSettle = undefined;
    this.#drag = null;
    this.#armed = null;
    this.#touch = null;
    this.#dismissing = false;
    this.#index = 0;
    this.#offset = 0;
    const sheet = this.#o.sheet();
    if (sheet) {
      sheet.removeAttribute('data-dragging');
      sheet.removeAttribute('data-dismissing');
      sheet.style.removeProperty('--_sheet-offset');
      sheet.style.removeProperty('--_sheet-inset');
      sheet.style.removeProperty('--_sheet-pinned');
      sheet.removeAttribute('data-pinned');
    }
    this.#o.onScrim(1);
  }

  #observe(): void {
    const sheet = this.#o.sheet();
    if (!sheet || sheet === this.#observed) return;
    this.#observer?.disconnect();
    this.#observed = sheet;
    this.#lastHeight = sheet.getBoundingClientRect().height;
    this.#observer = new ResizeObserver(() => {
      const height = sheet.getBoundingClientRect().height;
      // The exit slide and the drag move the sheet, they never change its height.
      if (Math.abs(height - this.#lastHeight) < 0.5) return;
      this.#lastHeight = height;
      this.#scheduleReanchor();
    });
    this.#observer.observe(sheet);
  }

  readonly #onViewport = (): void => {
    this.reanchor();
  };

  #scheduleReanchor(): void {
    if (this.#reanchorFrame) return;
    this.#reanchorFrame = requestAnimationFrame(() => {
      this.#reanchorFrame = 0;
      this.reanchor();
    });
  }

  // ---------------------------------------------------------------------------------- geometry

  #resolve(): SheetDetents {
    const sheet = this.#o.sheet();
    const height = sheet ? sheet.getBoundingClientRect().height : 0;
    const visibleHeight = Math.max(0, height - OVERSCROLL_PADDING);
    const offsets = computeDetentOffsets(visibleHeight, this.#o.snapHeights());
    return {offsets, peekOffset: peekOffsetFor(offsets, visibleHeight), height, visibleHeight};
  }

  /** Offset past which a released drag dismisses. */
  #dismissOffset(detents: SheetDetents): number {
    const floor = detents.offsets[detents.offsets.length - 1] ?? 0;
    return floor + Math.max(0, detents.visibleHeight - floor) * DISMISS_OVERSHOOT_RATIO;
  }

  #scrimFor(offset: number, detents: SheetDetents): number {
    return scrimOpacityForOffset(
      offset,
      detents.offsets,
      this.#dismissOffset(detents),
      detents.peekOffset,
    );
  }

  /** Draws the sheet at `offset` (px from fully open). */
  #apply(offset: number): void {
    this.#offset = offset;
    this.#o.sheet()?.style.setProperty('--_sheet-offset', `${offset}px`);
  }

  /**
   * Content below the fold at a lower detent stays reachable: the scrolling body gives up the resting
   * offset as block-end margin (`--_sheet-inset`), and the sheet is pinned to its measured height so a
   * hugging sheet does not shrink with it. A peek keeps the full body and slides instead. The swap is
   * invisible (the geometry on screen is identical): it happens when a slide down is over, and at once
   * when the sheet is going up, so revealed content is never blank.
   */
  #insetFor(target: number, detents: SheetDetents): number {
    return target === detents.peekOffset ? 0 : Math.max(0, target);
  }

  #writeInset(inset: number, height: number): void {
    const sheet = this.#o.sheet();
    if (!sheet) return;
    if (inset > 0) {
      sheet.style.setProperty('--_sheet-inset', `${inset}px`);
      sheet.style.setProperty('--_sheet-pinned', `${height}px`);
      sheet.setAttribute('data-pinned', '');
    } else {
      sheet.style.removeProperty('--_sheet-inset');
      sheet.style.removeProperty('--_sheet-pinned');
      sheet.removeAttribute('data-pinned');
    }
  }

  #setInset(target: number, detents: SheetDetents, mode: 'now' | 'settle'): void {
    const sheet = this.#o.sheet();
    if (!sheet) return;
    const inset = this.#insetFor(target, detents);
    const current = Number.parseFloat(sheet.style.getPropertyValue('--_sheet-inset')) || 0;
    this.#cancelSettle?.();
    this.#cancelSettle = undefined;
    if (mode === 'now' || inset <= current) {
      this.#writeInset(inset, detents.height);
      return;
    }
    this.#cancelSettle = whenTransitionSettled(sheet, 'translate', () => {
      this.#cancelSettle = undefined;
      this.#writeInset(inset, detents.height);
    });
  }

  // ------------------------------------------------------------------------------------ settle

  /** Settles at `target` (one of the offsets) with the transition, and reports the detent. */
  #settleAt(target: number, detents: SheetDetents, source: SheetMoveSource): void {
    const index = Math.max(0, detents.offsets.indexOf(target));
    const changed = index !== this.#index;
    this.#index = index;
    this.#o.sheet()?.removeAttribute('data-dragging');
    this.#apply(target);
    this.#setInset(target, detents, 'settle');
    this.#o.onScrim(this.#scrimFor(target, detents));
    if (changed && source !== 'programmatic') hapticTick();
    this.#o.onSnap({index, visibleHeight: Math.max(0, detents.visibleHeight - target), source});
    this.#host.requestUpdate();
  }

  /** Moves to detent `index` (clamped). Programmatic calls raise no `tct-snap-change` at the host. */
  snapToIndex(index: number, source: SheetMoveSource = 'programmatic'): void {
    const detents = this.#resolve();
    const clamped = Math.min(Math.max(0, Math.round(index)), detents.offsets.length - 1);
    this.#settleAt(detents.offsets[clamped] ?? 0, detents, source);
  }

  /** One detent taller (`-1`) or shorter (`1`). Returns whether the detent changed. */
  step(direction: -1 | 1, source: SheetMoveSource = 'keyboard'): boolean {
    const {offsets} = this.#resolve();
    const next = Math.min(Math.max(0, this.#index + direction), offsets.length - 1);
    if (next === this.#index) return false;
    this.snapToIndex(next, source);
    return true;
  }

  /** The tallest detent. */
  first(source: SheetMoveSource = 'keyboard'): boolean {
    if (this.#index === 0) return false;
    this.snapToIndex(0, source);
    return true;
  }

  /** The shortest detent. */
  last(source: SheetMoveSource = 'keyboard'): boolean {
    const last = this.#resolve().offsets.length - 1;
    if (this.#index === last) return false;
    this.snapToIndex(last, source);
    return true;
  }

  /**
   * The single-pointer, non-drag way to resize (WCAG 2.5.7): one detent taller, and from the tallest
   * back to the shortest, so repeated taps reach every stop.
   */
  cycle(source: SheetMoveSource = 'pointer'): boolean {
    const {offsets} = this.#resolve();
    if (offsets.length < 2) return false;
    this.snapToIndex(this.#index === 0 ? offsets.length - 1 : this.#index - 1, source);
    return true;
  }

  /**
   * Re-resolves the same detent index against the current geometry (rotation, a resized window, new
   * snap points, content that changed the sheet's height) without animating: the geometry moved,
   * not the user's finger.
   */
  reanchor(): void {
    if (!this.#active || this.#drag || this.#dismissing) return;
    const sheet = this.#o.sheet();
    if (!sheet) return;
    const detents = this.#resolve();
    if (detents.height <= 0) return;
    const index = Math.min(this.#index, detents.offsets.length - 1);
    const target = detents.offsets[index] ?? 0;
    if (index === this.#index && Math.abs(target - this.#offset) <= 0.5) {
      this.#o.onScrim(this.#scrimFor(target, detents));
      this.#host.requestUpdate();
      return;
    }
    this.#cancelSettle?.();
    this.#cancelSettle = undefined;
    this.#index = index;
    sheet.setAttribute('data-dragging', ''); // suppresses the transition for this one write
    this.#apply(target);
    this.#setInset(target, detents, 'now');
    void sheet.offsetHeight;
    sheet.removeAttribute('data-dragging');
    this.#o.onScrim(this.#scrimFor(target, detents));
    this.#host.requestUpdate();
  }

  /** The exit slide starts from where the sheet is now: hold the drawn position instead of settling. */
  markDismissing(): void {
    this.#dismissing = true;
    this.#o.sheet()?.setAttribute('data-dismissing', '');
  }

  // ------------------------------------------------------------------------------------- drag

  #begin(kind: Drag['kind'], id: number, y: number, time: number, startY: number = y): void {
    const detents = this.#resolve();
    this.#cancelSettle?.();
    this.#cancelSettle = undefined;
    const sheet = this.#o.sheet();
    const base = this.#index < detents.offsets.length ? (detents.offsets[this.#index] ?? 0) : 0;
    this.#drag = {
      kind,
      id,
      startY,
      lastY: y,
      lastTime: time,
      velocity: 0,
      detents,
      base,
      current: base,
      traveled: false,
    };
    this.#setInset(base, detents, 'now');
    sheet?.setAttribute('data-dragging', '');
    this.#apply(base);
  }

  #move(y: number, time: number): void {
    const drag = this.#drag;
    if (!drag) return;
    const dt = time - drag.lastTime;
    if (dt > 0) {
      drag.velocity = (y - drag.lastY) / dt;
      drag.lastY = y;
      drag.lastTime = time;
    }
    const {offsets} = drag.detents;
    const raw = drag.base + (y - drag.startY);
    const floor = offsets[offsets.length - 1] ?? 0;
    let next: number;
    if (raw < 0) {
      // Up past fully open: damped and capped rubber band; springs back on release.
      next = Math.max(-OVERSCROLL_PADDING, raw * OVERSCROLL_RESISTANCE);
    } else if (raw > floor) {
      // The dismiss zone: no magnet, so it does not fight a drag-to-close.
      next = raw;
    } else {
      next = magnetize(raw, offsets);
    }
    drag.current = next;
    // Above the resting stop the body takes its full height back, so revealed content is never blank.
    this.#setInset(next < drag.base ? 0 : drag.base, drag.detents, 'now');
    if (!drag.traveled && Math.abs(next - drag.base) >= 1) {
      drag.traveled = true;
      this.#o.onTravel?.();
    }
    this.#apply(next);
    this.#o.onScrim(this.#scrimFor(next, drag.detents));
  }

  #end(y: number): void {
    const drag = this.#drag;
    if (!drag) return;
    this.#drag = null;
    const delta = y - drag.startY;
    const offset = Math.max(0, drag.base + delta);
    const direction = delta === 0 ? 0 : delta > 0 ? 1 : -1;
    this.#settleFromDrag(drag, offset, direction, Math.abs(delta));
  }

  #settleFromDrag(drag: Drag, offset: number, direction: number, travel: number): void {
    const {detents, base} = drag;
    const {offsets} = detents;
    const floor = offsets[offsets.length - 1] ?? 0;
    const isFlick = Math.abs(drag.velocity) > FLICK_VELOCITY && travel > FLICK_MIN_DISTANCE;
    const dismiss = (): void => {
      if (!this.#o.canDismiss()) {
        this.#settleAt(floor, detents, 'pointer');
        return;
      }
      // Hold the drawn position for the exit slide; a cancelled request settles back where it was.
      const sheet = this.#o.sheet();
      sheet?.removeAttribute('data-dragging');
      this.markDismissing();
      if (this.#o.onDismiss()) return;
      this.#dismissing = false;
      sheet?.removeAttribute('data-dismissing');
      this.#settleAt(base, detents, 'pointer');
    };
    if (direction > 0 && isFlick) {
      dismiss();
      return;
    }
    if (direction < 0 && isFlick) {
      // A fast upward flick expands to the sheet's full height.
      this.#settleAt(0, detents, 'pointer');
      return;
    }
    if (offset > this.#dismissOffset(detents)) {
      dismiss();
      return;
    }
    this.#settleAt(resolveSettleOffset(offset, offsets, direction, base), detents, 'pointer');
  }

  #cancel(): void {
    const drag = this.#drag;
    if (!drag) return;
    this.#drag = null;
    // An interrupted drag returns to its previous resting detent, and so does the scrim.
    this.#settleAt(drag.base, drag.detents, 'programmatic');
  }

  // ------------------------------------------------------------------------- handle (pointer)

  readonly handlePointerDown = (event: PointerEvent): void => {
    if (event.button !== 0 || !event.isPrimary) return;
    // The handle has no native focus action here: a press must not pull focus off a field.
    event.preventDefault();
    const target = event.currentTarget as HTMLElement;
    try {
      target.setPointerCapture(event.pointerId);
    } catch {
      // Synthetic pointer ids have no active pointer to capture.
    }
    this.#begin('pointer', event.pointerId, event.clientY, event.timeStamp);
    this.#moved = false;
  };

  readonly handlePointerMove = (event: PointerEvent): void => {
    const drag = this.#drag;
    if (drag?.kind !== 'pointer' || drag.id !== event.pointerId) return;
    if (Math.abs(event.clientY - drag.startY) > 3) this.#moved = true;
    this.#move(event.clientY, event.timeStamp);
  };

  readonly handlePointerUp = (event: PointerEvent): void => {
    const drag = this.#drag;
    if (drag?.kind !== 'pointer' || drag.id !== event.pointerId) return;
    try {
      (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
    } catch {
      // Already released.
    }
    if (!this.#moved) {
      // A press without travel is a tap, not a drag: the single-pointer alternative resizes.
      this.#drag = null;
      this.#o.sheet()?.removeAttribute('data-dragging');
      this.#apply(drag.base);
      this.#tap?.();
      return;
    }
    this.#end(event.clientY);
  };

  readonly handlePointerCancel = (event: PointerEvent): void => {
    const drag = this.#drag;
    if (drag?.kind !== 'pointer' || drag.id !== event.pointerId) return;
    this.#cancel();
  };

  readonly handleLostCapture = (event: PointerEvent): void => {
    const drag = this.#drag;
    if (drag?.kind === 'pointer' && drag.id === event.pointerId) this.#cancel();
  };

  readonly handleContextMenu = (event: Event): void => {
    if (!this.#drag) return;
    event.preventDefault();
    this.#cancel();
  };

  /** Called for a press on the handle that never moved: the owner cycles the detent. */
  setTapHandler(callback: (() => void) | undefined): void {
    this.#tap = callback;
  }

  // -------------------------------------------------------------------------- body (pointer)

  /** Mouse and pen pull-down at the top of the body (touch uses the touch path below). */
  readonly bodyPointerDown = (event: PointerEvent): void => {
    if (event.pointerType === 'touch' || event.button !== 0 || !event.isPrimary) return;
    const scroller = event.currentTarget as HTMLElement;
    if (scroller.scrollTop > 0) {
      this.#armed = null;
      return;
    }
    this.#armed = {id: event.pointerId, startY: event.clientY, scroller};
  };

  readonly bodyPointerMove = (event: PointerEvent): void => {
    if (event.pointerType === 'touch') return;
    if (this.#drag) {
      if (this.#drag.kind === 'pointer' && this.#drag.id === event.pointerId) {
        this.#move(event.clientY, event.timeStamp);
      }
      return;
    }
    const armed = this.#armed;
    if (armed?.id !== event.pointerId) return;
    const delta = event.clientY - armed.startY;
    if (delta > DRAG_PROMOTION_SLOP && armed.scroller.scrollTop <= 0) {
      // A downward pull at the top promotes to a sheet drag, anchored at the pointer-down position
      // so the pull distance carries over.
      this.#armed = null;
      try {
        armed.scroller.setPointerCapture(event.pointerId);
      } catch {
        // Synthetic pointer ids have no active pointer to capture.
      }
      this.#begin('pointer', event.pointerId, event.clientY, event.timeStamp, armed.startY);
      this.#moved = true;
      this.#move(event.clientY, event.timeStamp);
    } else if (delta < 0) {
      // Upward movement is the user scrolling: do not hijack it.
      this.#armed = null;
    }
  };

  readonly bodyPointerEnd = (event: PointerEvent): void => {
    if (event.pointerType === 'touch') return;
    this.#armed = null;
    const drag = this.#drag;
    if (drag?.kind !== 'pointer' || drag.id !== event.pointerId) return;
    try {
      (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
    } catch {
      // Already released.
    }
    if (event.type === 'pointercancel') this.#cancel();
    else this.#end(event.clientY);
  };

  // ---------------------------------------------------------------------------- body (touch)

  /**
   * Attaches the non-passive touch listeners to the scrolling body. Call again with the current
   * body after each render; a different node replaces the previous one.
   */
  attachBody(body: HTMLElement | null): void {
    if (body === this.#touchBody) return;
    const previous = this.#touchBody;
    if (previous) {
      previous.removeEventListener('touchstart', this.#onTouchStart);
      previous.removeEventListener('touchmove', this.#onTouchMove);
      previous.removeEventListener('touchend', this.#onTouchEnd);
      previous.removeEventListener('touchcancel', this.#onTouchEnd);
    }
    this.#touchBody = body;
    if (!body) return;
    body.addEventListener('touchstart', this.#onTouchStart, {passive: true});
    body.addEventListener('touchmove', this.#onTouchMove, {passive: false});
    body.addEventListener('touchend', this.#onTouchEnd, {passive: true});
    body.addEventListener('touchcancel', this.#onTouchEnd, {passive: true});
  }

  static readonly #atTop = (element: HTMLElement): boolean => element.scrollTop <= 0;
  static readonly #atBottom = (element: HTMLElement): boolean =>
    element.scrollTop + element.clientHeight >= element.scrollHeight - 1;

  readonly #onTouchStart = (event: TouchEvent): void => {
    const scroller = event.currentTarget as HTMLElement;
    const touch = event.changedTouches[0];
    if (!touch) {
      this.#touch = null;
      return;
    }
    // At the top a pull down hands off (collapse); at the bottom a pull up hands off (expand), but
    // only when a taller detent exists: at the tallest a pull up belongs to the content. A gesture
    // that starts mid-content is tracked all the same: it may run out of content while the finger is down.
    this.#touch = {
      id: touch.identifier,
      startY: touch.clientY,
      top: SheetGestureController.#atTop(scroller),
      bottom: SheetGestureController.#atBottom(scroller) && this.#offset > 0,
      contentEndY: null,
      promotedAtContentEnd: false,
    };
  };

  readonly #onTouchMove = (event: TouchEvent): void => {
    const scroller = event.currentTarget as HTMLElement;
    const armed = this.#touch;
    const drag = this.#drag;
    const time = event.timeStamp;
    if (drag?.kind === 'touch') {
      const t = [...event.changedTouches].find((touch) => touch.identifier === drag.id);
      if (!t) return;
      if (armed?.promotedAtContentEnd && armed.contentEndY != null) {
        if (t.clientY >= armed.contentEndY) {
          // Back at the point where the content ran out. This drag never cancelled the native
          // scroll (it could not: the events were no longer cancelable), so the scroller is about
          // to move again. Hand the gesture back rather than driving both.
          armed.contentEndY = null;
          armed.promotedAtContentEnd = false;
          this.#cancel();
          return;
        }
        // Deliberately not preventDefault()ed: the scroller is clamped at its end.
        this.#move(t.clientY, time);
        return;
      }
      event.preventDefault();
      this.#move(t.clientY, time);
      return;
    }
    if (!armed) return;
    const t = [...event.changedTouches].find((touch) => touch.identifier === armed.id);
    if (!t) return;
    const delta = t.clientY - armed.startY;
    const pullDownAtTop =
      armed.top && delta > DRAG_PROMOTION_SLOP && SheetGestureController.#atTop(scroller);
    const pullUpAtBottom =
      armed.bottom && delta < -DRAG_PROMOTION_SLOP && SheetGestureController.#atBottom(scroller);
    if (pullDownAtTop || pullUpAtBottom) {
      event.preventDefault();
      this.#touch = null;
      this.#begin('touch', t.identifier, t.clientY, time, armed.startY);
      this.#move(t.clientY, time);
      return;
    }
    if ((armed.top && delta < 0) || (armed.bottom && delta > 0)) {
      // Scrolling away from the armed edge: hand back to native scroll. The touch stays tracked,
      // this is the swipe that may reach the far edge.
      armed.top = false;
      armed.bottom = false;
    }
    // Reaching the end of the content mid-gesture: anchor where it ran out and give the sheet
    // everything past that point.
    if (this.#offset > 0 && SheetGestureController.#atBottom(scroller)) {
      if (armed.contentEndY == null) {
        armed.contentEndY = t.clientY;
      } else if (armed.contentEndY - t.clientY >= CONTENT_END_HANDOFF_SLOP) {
        armed.promotedAtContentEnd = true;
        this.#begin('touch', t.identifier, t.clientY, time, armed.contentEndY);
        this.#move(t.clientY, time);
      }
    } else {
      armed.contentEndY = null;
    }
  };

  readonly #onTouchEnd = (event: TouchEvent): void => {
    this.#touch = null;
    const drag = this.#drag;
    if (drag?.kind !== 'touch') return;
    const t = [...event.changedTouches].find((touch) => touch.identifier === drag.id);
    if (t) {
      if (event.type === 'touchcancel') this.#cancel();
      else this.#end(t.clientY);
    } else if (event.touches.length === 0) {
      // Some interrupted multi-touch sequences omit the active touch: the drag cannot finish later.
      this.#cancel();
    }
  };

  // ---------------------------------------------------------------------------- interruptions

  readonly #onWindowBlur = (): void => {
    this.#cancel();
  };

  readonly #onVisibility = (): void => {
    if (document.visibilityState === 'hidden') this.#cancel();
  };
}
