/**
 * `ScrollOverflowController` (A§9.18, upstream `useScrollOverflow`): reports whether a horizontally
 * scrollable box overflows at its start edge, its end edge, or both, for carousels and fade edges.
 * It updates on scroll and on resize (through the shared `ResizeObserver`) and re-renders the host
 * only when the answer changes. A tolerance of 1px absorbs sub-pixel rounding.
 *
 * Start and end follow the direction: the start edge is on the left in LTR and on the right in RTL.
 * RTL scroll offsets are negative (or measured from the right) depending on the engine, so the
 * absolute value is used, which is what the standard specifies for `scrollLeft` in RTL boxes.
 *
 * ```ts
 * #overflow = new ScrollOverflowController(this, {target: () => this.renderRoot.querySelector('.track')});
 * render() { return html`<div class="track" ?data-fade-end=${this.#overflow.overflowEnd}>…`; }
 * ```
 * Guides: [mwg:scrollability-affordance-hints] (scroll edge hints), [mwg:css-layout] (overflow tracking)
 */
import type {ReactiveController, ReactiveControllerHost} from 'lit';
import {observeResize} from './resize.js';

export interface ScrollOverflowState {
  /** Content overflows the start edge (left in LTR, right in RTL): the box is scrolled away from it. */
  readonly overflowStart: boolean;
  /** Content overflows the end edge (right in LTR, left in RTL): there is more to scroll to. */
  readonly overflowEnd: boolean;
  /** The box has scrollable overflow at all. */
  readonly hasOverflow: boolean;
}

export interface ScrollOverflowOptions {
  /** The scrolling box; re-read after every host update. */
  target: () => HTMLElement | null | undefined;
  /** Called after the state changed (the host has been asked to update already). */
  onChange?: (state: ScrollOverflowState) => void;
}

/** Sub-pixel tolerance, in CSS px. */
const TOLERANCE = 1;

export function measureScrollOverflow(element: HTMLElement): ScrollOverflowState {
  const {scrollLeft, scrollWidth, clientWidth} = element;
  const maxScroll = scrollWidth - clientWidth;
  return {
    overflowStart: Math.abs(scrollLeft) > TOLERANCE,
    overflowEnd: Math.abs(scrollLeft) < maxScroll - TOLERANCE,
    hasOverflow: scrollWidth > clientWidth + TOLERANCE,
  };
}

export class ScrollOverflowController implements ReactiveController, ScrollOverflowState {
  readonly #host: ReactiveControllerHost;
  readonly #options: ScrollOverflowOptions;
  #target: HTMLElement | null = null;
  #stop: (() => void) | undefined;
  #state: ScrollOverflowState = {overflowStart: false, overflowEnd: false, hasOverflow: false};

  constructor(host: ReactiveControllerHost, options: ScrollOverflowOptions) {
    this.#host = host;
    this.#options = options;
    host.addController(this);
  }

  get overflowStart(): boolean {
    return this.#state.overflowStart;
  }

  get overflowEnd(): boolean {
    return this.#state.overflowEnd;
  }

  get hasOverflow(): boolean {
    return this.#state.hasOverflow;
  }

  /** Measures now (for a host that changed the box's content without resizing it). */
  measure(): void {
    if (!this.#target) return;
    const next = measureScrollOverflow(this.#target);
    const current = this.#state;
    if (
      next.overflowStart === current.overflowStart &&
      next.overflowEnd === current.overflowEnd &&
      next.hasOverflow === current.hasOverflow
    ) {
      return;
    }
    this.#state = next;
    this.#host.requestUpdate();
    this.#options.onChange?.(next);
  }

  hostConnected(): void {
    this.#sync();
  }

  hostUpdated(): void {
    this.#sync();
    // The host may have changed what is inside the box without resizing it (a fixed-size track).
    this.measure();
  }

  hostDisconnected(): void {
    this.#release();
  }

  #sync(): void {
    const target = this.#options.target() ?? null;
    if (target === this.#target) return;
    this.#release();
    this.#target = target;
    if (!target) return;
    target.addEventListener('scroll', this.#onScroll, {passive: true});
    // The platform delivers an initial observation, which is the first measurement.
    this.#stop = observeResize(target, this.#onScroll);
    this.measure();
  }

  #release(): void {
    this.#target?.removeEventListener('scroll', this.#onScroll);
    this.#stop?.();
    this.#stop = undefined;
    this.#target = null;
  }

  readonly #onScroll = (): void => {
    this.measure();
  };
}
