/**
 * Hover intent for navigation flyouts and menus (upstream `useMenuHover`): the collapsed side navigation
 * item, the heading menus and the top navigation menus open on hover as a progressive enhancement over
 * their click and keyboard behaviour. It is not `HoverIntentController`, which is the tooltip policy
 * (a press dismisses, focus opens): a navigation layer opened by hover is *transient*, and a click
 * either confirms (pins) it or dismisses it.
 *
 *  - a fine pointer entering the trigger opens after `showDelay`; leaving the trigger (and not reaching the
 *    surface) closes a transient layer after `hideDelay`; the surface is hoverable (WCAG 1.4.13);
 *  - a layer opened by anything else (a click, the keyboard) is pinned: hover never closes it;
 *  - the owner asks `confirmsHover(guardMs)` on a click: within the guard of a hover-open, the click means
 *    "yes, this one" and pins the layer instead of closing it (upstream #3121);
 *  - touch has no hover: a tap, and a coarse pointer, never open by hover.
 */
import type {ReactiveController, ReactiveControllerHost} from 'lit';

export interface NavHoverOptions {
  trigger: () => HTMLElement | null;
  /** Elements that count as the layer: hovering them keeps a transient layer open. */
  surface: () => HTMLElement | null;
  isOpen: () => boolean;
  /** Called when hover asks to open. The owner opens the layer and (for a hover open) leaves it transient. */
  onOpen: () => void;
  /** Called when hover asks to close a transient layer. */
  onClose: () => void;
  /** Delay before opening on hover (ms). */
  showDelay?: () => number;
  /** Delay before closing after the pointer left (ms). */
  hideDelay?: () => number;
  /** Listeners stay attached but do nothing while this returns false. */
  enabled?: () => boolean;
}

export class NavHoverController implements ReactiveController {
  readonly #options: NavHoverOptions;
  #trigger: HTMLElement | null = null;
  #surface: HTMLElement | null = null;
  #openTimer: ReturnType<typeof setTimeout> | undefined;
  #closeTimer: ReturnType<typeof setTimeout> | undefined;
  #touch = false;
  #transient = false;
  #openedAt = 0;

  constructor(host: ReactiveControllerHost & HTMLElement, options: NavHoverOptions) {
    this.#options = options;
    host.addController(this);
  }

  /** Whether the open layer was opened by hover and is still waiting for a confirming click. */
  get transient(): boolean {
    return this.#transient && this.#options.isOpen();
  }

  /** Records that the layer was just opened by hover (call from the owner's `onOpen`). */
  markHoverOpened(): void {
    this.#transient = true;
    this.#openedAt = performance.now();
  }

  /** The layer is now the user's: hover no longer closes it. */
  pin(): void {
    this.#transient = false;
    this.cancel();
  }

  /**
   * Whether a click on the trigger is the confirmation of a hover-open: it happened within `guardMs`
   * of it. The owner pins the layer instead of closing it.
   */
  confirmsHover(guardMs: number): boolean {
    return this.transient && performance.now() - this.#openedAt < guardMs;
  }

  /** Cancels pending open and close timers. */
  cancel(): void {
    clearTimeout(this.#openTimer);
    clearTimeout(this.#closeTimer);
    this.#openTimer = undefined;
    this.#closeTimer = undefined;
  }

  hostConnected(): void {
    this.#attach();
  }

  hostUpdated(): void {
    this.#attach();
    if (!this.#options.isOpen()) this.#transient = false;
  }

  hostDisconnected(): void {
    this.cancel();
    this.#detach();
  }

  #live(): boolean {
    return !this.#touch && (this.#options.enabled?.() ?? true);
  }

  #attach(): void {
    const trigger = this.#options.trigger();
    const surface = this.#options.surface();
    if (trigger === this.#trigger && surface === this.#surface) return;
    this.#detach();
    this.#trigger = trigger;
    this.#surface = surface;
    trigger?.addEventListener('pointerenter', this.#onPointerEnter);
    trigger?.addEventListener('mouseenter', this.#onEnter);
    trigger?.addEventListener('mouseleave', this.#onLeave);
    surface?.addEventListener('mouseenter', this.#onSurfaceEnter);
    surface?.addEventListener('mouseleave', this.#onLeave);
  }

  #detach(): void {
    this.#trigger?.removeEventListener('pointerenter', this.#onPointerEnter);
    this.#trigger?.removeEventListener('mouseenter', this.#onEnter);
    this.#trigger?.removeEventListener('mouseleave', this.#onLeave);
    this.#surface?.removeEventListener('mouseenter', this.#onSurfaceEnter);
    this.#surface?.removeEventListener('mouseleave', this.#onLeave);
    this.#trigger = null;
    this.#surface = null;
  }

  readonly #onPointerEnter = (event: PointerEvent): void => {
    // A tap synthesises mouseenter after the pointer events; only a finger is hoverless on arrival.
    this.#touch = event.pointerType === 'touch';
  };

  readonly #onEnter = (): void => {
    if (!this.#live()) return;
    clearTimeout(this.#closeTimer);
    this.#closeTimer = undefined;
    if (this.#options.isOpen() || this.#openTimer !== undefined) return;
    this.#openTimer = setTimeout(() => {
      this.#openTimer = undefined;
      if (this.#live() && !this.#options.isOpen()) this.#options.onOpen();
    }, this.#options.showDelay?.() ?? 150);
  };

  readonly #onSurfaceEnter = (): void => {
    clearTimeout(this.#closeTimer);
    this.#closeTimer = undefined;
  };

  readonly #onLeave = (): void => {
    if (this.#touch) return;
    clearTimeout(this.#openTimer);
    this.#openTimer = undefined;
    if (!this.transient) return;
    clearTimeout(this.#closeTimer);
    this.#closeTimer = setTimeout(() => {
      this.#closeTimer = undefined;
      if (this.transient) this.#options.onClose();
    }, this.#options.hideDelay?.() ?? 200);
  };
}
