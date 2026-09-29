/**
 * Swipe-to-dismiss for a toast (port of upstream `useToastGesture`). A one-finger touch or a pen drag
 * towards the toast's block edge dismisses it; native page scrolling keeps working until the touch
 * intent matches the dismiss edge. Touch uses touch events (a pointer event stream would be cancelled
 * by the browser's own panning), pen uses pointer events; a mouse never swipes. This is the
 * single-pointer *alternative* to the always-visible dismiss button, never the only way (WCAG 2.5.7).
 *
 * The live drag is written to private custom properties on the card (`--_toast-swipe-*`), which the
 * component CSS turns into a translate, a fade and a slight scale.
 */
import type {ReactiveController, ReactiveControllerHost} from 'lit';

const DRAG_PROMOTION_SLOP = 8;
const SWIPE_DISMISS_RATIO = 0.4;
const FLICK_MIN_DISTANCE = 48;
const FLICK_VELOCITY = 1.2;
const VERTICAL_INTENT_RATIO = 1.2;
const SWIPE_EXIT_DISTANCE = '120%';
const SWIPE_ACTIVE_FADE_MAX = 0.4;
const SWIPE_ACTIVE_SCALE_MAX = 0.02;

/** 1: dismisses downwards (bottom edge), -1: upwards (top edge). */
export type ToastGestureDirection = 1 | -1;

interface GesturePoint {
  source: 'touch' | 'pen';
  pointerId: number;
  clientX: number;
  clientY: number;
}

interface GestureState {
  source: GesturePoint['source'];
  pointerId: number;
  startX: number;
  startY: number;
  startTime: number;
  direction: ToastGestureDirection;
  intent: 'pending' | 'vertical' | 'opposite';
  pausedTimer: boolean;
  surfaceSize: number;
  dismissThreshold: number;
}

export interface ToastGestureOptions {
  /** The card the drag transforms and listens on. */
  root: () => HTMLElement | null;
  direction: () => ToastGestureDirection;
  enabled: () => boolean;
  canPauseTimer: () => boolean;
  isTimerPaused: () => boolean;
  pauseTimer: () => void;
  resumeTimer: () => void;
  dismiss: () => void;
  /** Presses on interactive descendants belong to them and never start a swipe. */
  shouldIgnoreTarget: (event: Event, root: HTMLElement) => boolean;
}

function clearTransientStyles(root: HTMLElement): void {
  root.style.removeProperty('transition-duration');
  root.style.removeProperty('--_toast-swipe-y');
  root.style.removeProperty('--_toast-swipe-exit-y');
  root.style.removeProperty('--_toast-swipe-opacity');
  root.style.removeProperty('--_toast-swipe-scale');
}

export class ToastGestureController implements ReactiveController {
  readonly #options: ToastGestureOptions;
  #state: GestureState | null = null;
  #attachedTo: HTMLElement | null = null;

  constructor(host: ReactiveControllerHost, options: ToastGestureOptions) {
    this.#options = options;
    host.addController(this);
  }

  hostUpdated(): void {
    this.#attach();
  }

  hostDisconnected(): void {
    this.#detach();
    this.#state = null;
  }

  // ---------------------------------------------------------------------------------- wiring

  #attach(): void {
    const root = this.#options.root();
    if (root === this.#attachedTo) return;
    this.#detach();
    if (!root) return;
    this.#attachedTo = root;
    root.addEventListener('touchstart', this.#onTouchStart, {passive: true});
    root.addEventListener('touchmove', this.#onTouchMove, {passive: false});
    root.addEventListener('touchend', this.#onTouchEnd, {passive: true});
    root.addEventListener('touchcancel', this.#onTouchCancel, {passive: true});
    root.addEventListener('pointerdown', this.#onPointerDown);
    root.addEventListener('pointermove', this.#onPointerMove);
    root.addEventListener('pointerup', this.#onPointerUp);
    root.addEventListener('pointercancel', this.#onPointerCancel);
    root.addEventListener('lostpointercapture', this.#onPointerCancel);
  }

  #detach(): void {
    const root = this.#attachedTo;
    if (!root) return;
    root.removeEventListener('touchstart', this.#onTouchStart);
    root.removeEventListener('touchmove', this.#onTouchMove);
    root.removeEventListener('touchend', this.#onTouchEnd);
    root.removeEventListener('touchcancel', this.#onTouchCancel);
    root.removeEventListener('pointerdown', this.#onPointerDown);
    root.removeEventListener('pointermove', this.#onPointerMove);
    root.removeEventListener('pointerup', this.#onPointerUp);
    root.removeEventListener('pointercancel', this.#onPointerCancel);
    root.removeEventListener('lostpointercapture', this.#onPointerCancel);
    this.#attachedTo = null;
  }

  // ---------------------------------------------------------------------------------- gesture

  #reset(shouldResume: boolean): void {
    const root = this.#options.root();
    const state = this.#state;
    this.#state = null;
    if (root) clearTransientStyles(root);
    if (shouldResume && state?.pausedTimer) this.#options.resumeTimer();
  }

  #begin(point: GesturePoint, event: Event): boolean {
    const root = this.#options.root();
    if (
      !root ||
      !this.#options.enabled() ||
      this.#state !== null ||
      this.#options.shouldIgnoreTarget(event, root)
    ) {
      return false;
    }
    const pausedTimer = this.#options.canPauseTimer() && !this.#options.isTimerPaused();
    if (pausedTimer) this.#options.pauseTimer();
    const surfaceSize = Math.max(root.getBoundingClientRect().height, 1);
    this.#state = {
      source: point.source,
      pointerId: point.pointerId,
      startX: point.clientX,
      startY: point.clientY,
      startTime: Date.now(),
      direction: this.#options.direction(),
      intent: 'pending',
      pausedTimer,
      surfaceSize,
      dismissThreshold: Math.max(surfaceSize * SWIPE_DISMISS_RATIO, FLICK_MIN_DISTANCE),
    };
    return true;
  }

  #move(point: GesturePoint, preventDefault: () => void, releaseCapture?: () => void): void {
    const state = this.#state;
    const root = this.#options.root();
    if (!state || !root || point.source !== state.source || point.pointerId !== state.pointerId)
      return;
    const deltaX = point.clientX - state.startX;
    const deltaY = point.clientY - state.startY;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);
    if (state.intent === 'pending') {
      // Horizontal intent: hand the gesture back to the browser (page pan).
      if (absX > DRAG_PROMOTION_SLOP && absX > absY) {
        releaseCapture?.();
        this.#reset(true);
        return;
      }
      if (absY <= DRAG_PROMOTION_SLOP || absY <= absX * VERTICAL_INTENT_RATIO) return;
      state.intent = deltaY * state.direction > 0 ? 'vertical' : 'opposite';
      if (state.intent === 'opposite') {
        releaseCapture?.();
        this.#reset(true);
        return;
      }
      root.style.setProperty('transition-duration', '0s');
    }
    preventDefault();
    const travel = Math.max(0, deltaY * state.direction);
    const progress = Math.min(Math.max(travel / state.surfaceSize, 0), 1);
    root.style.setProperty('--_toast-swipe-y', `${travel * state.direction}px`);
    root.style.setProperty(
      '--_toast-swipe-opacity',
      (1 - progress * SWIPE_ACTIVE_FADE_MAX).toFixed(3),
    );
    root.style.setProperty(
      '--_toast-swipe-scale',
      (1 - progress * SWIPE_ACTIVE_SCALE_MAX).toFixed(3),
    );
  }

  #end(point: GesturePoint): void {
    const state = this.#state;
    const root = this.#options.root();
    if (!state || !root || point.source !== state.source || point.pointerId !== state.pointerId)
      return;
    const travel = Math.max(0, (point.clientY - state.startY) * state.direction);
    const elapsed = Math.max(1, Date.now() - state.startTime);
    const dismissed =
      state.intent === 'vertical' &&
      (travel >= state.dismissThreshold ||
        (travel >= FLICK_MIN_DISTANCE && travel / elapsed > FLICK_VELOCITY));

    this.#state = null;
    root.style.removeProperty('transition-duration');
    clearTransientStyles(root);
    if (dismissed) {
      // The exit animation owns the final throw: a vertical fling with no horizontal drift.
      root.style.setProperty(
        '--_toast-swipe-exit-y',
        state.direction === 1 ? SWIPE_EXIT_DISTANCE : `calc(-1 * ${SWIPE_EXIT_DISTANCE})`,
      );
      this.#options.dismiss();
      return;
    }
    if (state.pausedTimer) this.#options.resumeTimer();
  }

  // ------------------------------------------------------------------------------------ touch

  readonly #touchPoint = (touch: Touch): GesturePoint => ({
    source: 'touch',
    pointerId: touch.identifier,
    clientX: touch.clientX,
    clientY: touch.clientY,
  });

  #trackedTouch(event: TouchEvent): Touch | undefined {
    const state = this.#state;
    if (state?.source !== 'touch') return undefined;
    return [...event.changedTouches].find((touch) => touch.identifier === state.pointerId);
  }

  readonly #onTouchStart = (event: TouchEvent): void => {
    if (event.touches.length !== 1) {
      // A second contact means pinch zoom or a two-finger scroll: abandon any accepted swipe.
      this.#reset(true);
      return;
    }
    const touch = event.changedTouches[0];
    if (touch) this.#begin(this.#touchPoint(touch), event);
  };

  readonly #onTouchMove = (event: TouchEvent): void => {
    if (event.touches.length !== 1) {
      this.#reset(true);
      return;
    }
    const touch = this.#trackedTouch(event);
    if (!touch) return;
    this.#move(this.#touchPoint(touch), () => {
      if (event.cancelable) event.preventDefault();
    });
  };

  readonly #onTouchEnd = (event: TouchEvent): void => {
    if (event.touches.length > 0) {
      this.#reset(true);
      return;
    }
    const touch = this.#trackedTouch(event);
    if (touch) this.#end(this.#touchPoint(touch));
    else this.#reset(true);
  };

  readonly #onTouchCancel = (): void => {
    this.#reset(true);
  };

  // ------------------------------------------------------------------------------------- pen

  readonly #penPoint = (event: PointerEvent): GesturePoint => ({
    source: 'pen',
    pointerId: event.pointerId,
    clientX: event.clientX,
    clientY: event.clientY,
  });

  #release(pointerId: number): void {
    try {
      this.#options.root()?.releasePointerCapture(pointerId);
    } catch {
      // Not captured (synthetic events): nothing to release.
    }
  }

  readonly #onPointerDown = (event: PointerEvent): void => {
    if (event.pointerType !== 'pen' || event.button > 0) return;
    if (this.#begin(this.#penPoint(event), event)) {
      try {
        this.#options.root()?.setPointerCapture(event.pointerId);
      } catch {
        // No active pointer with this id (synthetic events): the swipe still works without capture.
      }
    }
  };

  readonly #onPointerMove = (event: PointerEvent): void => {
    if (event.pointerType !== 'pen') return;
    this.#move(
      this.#penPoint(event),
      () => {
        event.preventDefault();
      },
      () => {
        this.#release(event.pointerId);
      },
    );
  };

  readonly #onPointerUp = (event: PointerEvent): void => {
    if (event.pointerType !== 'pen') return;
    this.#release(event.pointerId);
    this.#end(this.#penPoint(event));
  };

  readonly #onPointerCancel = (event: PointerEvent): void => {
    if (
      event.pointerType === 'pen' &&
      this.#state?.source === 'pen' &&
      this.#state.pointerId === event.pointerId
    ) {
      this.#reset(true);
    }
  };
}
