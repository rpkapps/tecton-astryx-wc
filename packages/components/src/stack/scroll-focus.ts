import type {ReactiveController, ReactiveControllerHost} from 'lit';
import {observeResize} from '@tecton-wc/core/controllers/resize.js';
import {getTabbables} from '@tecton-wc/core/utils/focus.js';

/**
 * Keeps a scrolling box reachable from the keyboard (WCAG 2.1.1). A scroll container whose content
 * has nothing focusable cannot be scrolled with the keyboard in every engine (Chromium 130 and
 * Firefox make such scrollers focusable themselves; Safari does not), so while the box really
 * overflows and nothing inside it is tabbable, the box gets `tabindex="0"`. It is removed again when
 * the content fits, when the box stops scrolling, or when the content brings its own tab stop, so a
 * non-overflowing container never adds a tab stop.
 *
 * The box is the inner `part="base"` element; give it the shared `focus-ring` class so the ring is
 * drawn while it has focus. [mwg:accessibility] (keyboard access to scrollable regions)
 */
export class ScrollFocusController implements ReactiveController {
  readonly #host: ReactiveControllerHost & {renderRoot: HTMLElement | DocumentFragment};
  readonly #selector: string;
  #target: HTMLElement | null = null;
  #stops: (() => void)[] = [];
  #slot: HTMLSlotElement | null = null;
  #applied = false;

  constructor(
    host: ReactiveControllerHost & {renderRoot: HTMLElement | DocumentFragment},
    selector = '.base',
  ) {
    this.#host = host;
    this.#selector = selector;
    host.addController(this);
  }

  /** Registers a controller on `host` (nothing to keep a reference to). */
  static attach(host: ReactiveControllerHost & {renderRoot: HTMLElement | DocumentFragment}): void {
    new ScrollFocusController(host);
  }

  hostConnected(): void {
    // A reconnected host does not update, so it picks its box up again here (the first connection
    // has nothing rendered yet: `hostUpdated` finds the box).
    const root = this.#host.renderRoot as HTMLElement | DocumentFragment | undefined;
    if (root && this.#target === null) this.#watch(root.querySelector<HTMLElement>(this.#selector));
  }

  hostUpdated(): void {
    const target = this.#host.renderRoot.querySelector<HTMLElement>(this.#selector);
    if (target !== this.#target) this.#watch(target);
    else this.#evaluate();
  }

  hostDisconnected(): void {
    this.#unwatch();
  }

  #watch(target: HTMLElement | null): void {
    this.#unwatch();
    this.#target = target;
    if (!target) return;
    this.#stops.push(observeResize(target, this.#evaluate));
    this.#slot = target.querySelector('slot');
    this.#slot?.addEventListener('slotchange', this.#onSlotChange);
    this.#observeContent();
    this.#evaluate();
  }

  #unwatch(): void {
    for (const stop of this.#stops) stop();
    this.#stops = [];
    this.#slot?.removeEventListener('slotchange', this.#onSlotChange);
    this.#slot = null;
    if (this.#target && this.#applied) this.#target.removeAttribute('tabindex');
    this.#applied = false;
    this.#target = null;
  }

  /** The content grows and shrinks on its own: watch what is slotted as well as the box. */
  #observeContent(): void {
    for (const child of this.#slot?.assignedElements({flatten: true}) ?? []) {
      this.#stops.push(observeResize(child, this.#evaluate));
    }
  }

  readonly #onSlotChange = (): void => {
    // Drop the content observers (the first stop is the box), then observe the new content.
    for (const stop of this.#stops.splice(1)) stop();
    this.#observeContent();
    this.#evaluate();
  };

  readonly #evaluate = (): void => {
    const target = this.#target;
    if (!target) return;
    const style = getComputedStyle(target);
    const scrolls = /auto|scroll/.test(`${style.overflowX} ${style.overflowY}`);
    const overflows =
      target.scrollHeight > target.clientHeight + 1 || target.scrollWidth > target.clientWidth + 1;
    const ownStop = getTabbables(target).some((element) => element !== target);
    const wanted = scrolls && overflows && !ownStop;
    if (wanted && !this.#applied) {
      if (!target.hasAttribute('tabindex')) {
        target.setAttribute('tabindex', '0');
        this.#applied = true;
      }
    } else if (!wanted && this.#applied) {
      target.removeAttribute('tabindex');
      this.#applied = false;
    }
  };
}
