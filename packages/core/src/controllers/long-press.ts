/**
 * Touch long-press (A§9.18, port of upstream `useLongPress`): a single finger held still on the host
 * for `delayMs` calls `onLongPress` with the press point. Moving past `moveCancelPx` (a scroll or a
 * drag), lifting, a second finger and the browser taking the gesture over (`pointercancel`) all cancel
 * it, and a pending press is dropped when the host disconnects.
 *
 * Why it exists: iOS Safari never synthesises a `contextmenu` event on a long press, so a long press
 * is the only touch route to cursor-positioned surfaces (a context menu). Chromium on Android does fire
 * `contextmenu`; an owner that handles both must ignore a second request while its surface is open.
 *
 * Built on Pointer Events (`pointerType === 'touch'`) rather than Touch Events: one code path for the
 * cancel cases, and `pointercancel` reports the browser's own scroll and callout takeovers. Pens and
 * mice are left to `contextmenu`.
 *
 * ```ts
 * new LongPressController(this, {
 *   onLongPress: (point) => this.openAt(point.x, point.y),
 *   disabled: () => this.disabled,
 * });
 * ```
 * Guides: [mwg:resilient-context-menus-and-nested-dropdowns]
 */
import type {ReactiveController, ReactiveControllerHost} from 'lit';

/** Default hold duration (ms), the upstream value. */
export const LONG_PRESS_DEFAULT_DELAY_MS = 500;
/** Default movement (px, either axis) that turns a press into a scroll or drag, the upstream value. */
export const LONG_PRESS_DEFAULT_MOVE_CANCEL_PX = 10;

export interface LongPressPoint {
  /** Viewport (client) coordinates of the touch that started the press. */
  x: number;
  y: number;
}

export interface LongPressOptions {
  /** Fired once the press was held for `delayMs`, with the point where the finger went down. */
  onLongPress: (point: LongPressPoint, event: PointerEvent) => void;
  /** The element that receives touches. Default: the host. */
  target?: () => EventTarget | null;
  /** While true the controller ignores touches. */
  disabled?: () => boolean;
  /** Hold duration in ms. Default 500. */
  delayMs?: number | (() => number);
  /** Movement past this distance (px, either axis) cancels the press. Default 10. */
  moveCancelPx?: number | (() => number);
}

export class LongPressController implements ReactiveController {
  readonly #host: ReactiveControllerHost & HTMLElement;
  readonly #options: LongPressOptions;
  #target: EventTarget | null = null;
  #timer: ReturnType<typeof setTimeout> | undefined;
  #start: (LongPressPoint & {readonly pointerId: number}) | undefined;
  /** Touch pointers currently down on the target: a second finger is not a long press. */
  readonly #touches = new Set<number>();

  constructor(host: ReactiveControllerHost & HTMLElement, options: LongPressOptions) {
    this.#host = host;
    this.#options = options;
    host.addController(this);
  }

  /** Whether a press is being timed right now. */
  get pending(): boolean {
    return this.#start !== undefined;
  }

  /** Cancels a pending press. */
  cancel(): void {
    clearTimeout(this.#timer);
    this.#timer = undefined;
    this.#start = undefined;
  }

  hostConnected(): void {
    this.#attach();
  }

  hostUpdated(): void {
    // The target may render after the first connect (an element inside the shadow root).
    this.#attach();
  }

  hostDisconnected(): void {
    this.cancel();
    this.#touches.clear();
    this.#detach();
  }

  // ---------------------------------------------------------------------------------- internals

  #attach(): void {
    const target = this.#options.target?.() ?? this.#host;
    if (target === this.#target) return;
    this.#detach();
    this.#target = target;
    target.addEventListener('pointerdown', this.#onDown as EventListener);
    target.addEventListener('pointermove', this.#onMove as EventListener);
    target.addEventListener('pointerup', this.#onEnd as EventListener);
    target.addEventListener('pointercancel', this.#onEnd as EventListener);
  }

  #detach(): void {
    const target = this.#target;
    if (!target) return;
    target.removeEventListener('pointerdown', this.#onDown as EventListener);
    target.removeEventListener('pointermove', this.#onMove as EventListener);
    target.removeEventListener('pointerup', this.#onEnd as EventListener);
    target.removeEventListener('pointercancel', this.#onEnd as EventListener);
    this.#target = null;
  }

  #read(value: number | (() => number) | undefined, fallback: number): number {
    const resolved = typeof value === 'function' ? value() : value;
    return typeof resolved === 'number' && Number.isFinite(resolved) ? resolved : fallback;
  }

  readonly #onDown = (event: PointerEvent): void => {
    if (event.pointerType !== 'touch') return;
    this.#touches.add(event.pointerId);
    if (this.#options.disabled?.()) return;
    // Clear a stale timer first, then record the start: `cancel()` also forgets the start point.
    this.cancel();
    if (this.#touches.size !== 1) return; // multi-touch is not a long press
    this.#start = {x: event.clientX, y: event.clientY, pointerId: event.pointerId};
    this.#timer = setTimeout(
      () => {
        const start = this.#start;
        this.#timer = undefined;
        this.#start = undefined;
        if (start) this.#options.onLongPress({x: start.x, y: start.y}, event);
      },
      this.#read(this.#options.delayMs, LONG_PRESS_DEFAULT_DELAY_MS),
    );
  };

  readonly #onMove = (event: PointerEvent): void => {
    const start = this.#start;
    if (start?.pointerId !== event.pointerId) return;
    const limit = this.#read(this.#options.moveCancelPx, LONG_PRESS_DEFAULT_MOVE_CANCEL_PX);
    // Treated as a scroll or drag, not a long press.
    if (Math.abs(event.clientX - start.x) > limit || Math.abs(event.clientY - start.y) > limit) {
      this.cancel();
    }
  };

  readonly #onEnd = (event: PointerEvent): void => {
    if (event.pointerType !== 'touch') return;
    this.#touches.delete(event.pointerId);
    this.cancel();
  };
}
