/**
 * `ChatStreamScrollController`: stick-to-bottom scrolling for a conversation that grows while you
 * read it (upstream `useChatStreamScroll`). It follows the newest content while the reader is at the
 * bottom and lets go the moment they scroll up.
 *
 * - **Locked** (initially): content growth scrolls to the bottom (`scrollIfLocked()`, called from a
 *   resize observer on the content) with a spring, or in one jump under `prefers-reduced-motion`.
 * - **Unlocked**: any scroll that lands above the last position this controller set or saw is the
 *   reader (wheel, touch, scrollbar drag, keyboard: it reads position, not input devices), so it
 *   unlocks immediately. It re-locks when a scroll settles within `lockThreshold` of the bottom.
 * - The first fill positions instantly (content present at connect, or arriving later); only later
 *   growth springs.
 * - While following, the controller owns the position: scroll anchoring is switched off on the
 *   container (an adopted `[data-tct-chat-following]` rule, so the consumer's own `overflow-anchor`
 *   is never read or written), leaving the browser's own only move to be the clamp onto a new bottom.
 *
 * It never moves focus, and it does not announce anything: it is scrolling only.
 *
 * ```ts
 * #scroll = new ChatStreamScrollController(this, {scroller: () => this.renderRoot.querySelector('.scroller')});
 * // in a ResizeObserver on the content:  this.#scroll.scrollIfLocked();
 * // the scroll button:                    this.#scroll.scrollToBottom();
 * ```
 *
 * Guides: [mwg:defer-work-until-scroll-ends] (settle detection: `scrollend` where the engine fires it,
 * plus the guide's debounced-scroll fallback for Safari < 26.2), [mwg:scroll-position-aware-elements]
 * (scroll-state container queries are Chrome-only, so the button state is JS), [mwg:scroll-target-on-load].
 */
import type {ReactiveController, ReactiveControllerHost} from 'lit';
import {prefersReducedMotion} from '@tecton-astryx/core/features.js';
import {adoptLightDomStyles} from '@tecton-astryx/core/styles/light-dom.js';
import type {ChatScrollToBottomOptions} from './chat-message-list.types.js';
import {findLastMessage} from './chat-messages.js';

const FOLLOWING_ATTR = 'data-tct-chat-following';
const SIXTY_FPS_MS = 1000 / 60;
/** No `scroll` event for this long means the scroll settled (fallback for engines without `scrollend`). */
const SETTLE_MS = 120;

let followingSheet: CSSStyleSheet | undefined;

/** Adopts the rule that turns scroll anchoring off on a following container, once per root. */
function ensureFollowingStyle(element: Element): void {
  if (!followingSheet) {
    followingSheet = new CSSStyleSheet();
    // `!important` so an inline `overflow-anchor: auto` cannot switch anchoring back on under a
    // following container.
    followingSheet.replaceSync(`[${FOLLOWING_ATTR}]{overflow-anchor:none !important}`);
  }
  adoptLightDomStyles(element, followingSheet);
}

export interface ChatStreamScrollOptions {
  /** The scrollable element; read after every host update, so it may not exist at construction. */
  scroller: () => HTMLElement | null | undefined;
  /** Whether scroll behaviour is on. Default: always. */
  enabled?: () => boolean;
  /** Distance from the bottom, in px, within which a settled scroll re-locks. Default 10. */
  lockThreshold?: number;
  /** Distance from the bottom, in px, beyond which `isScrolledUp` becomes true (the button shows). Default 100. */
  buttonThreshold?: number;
  /** Spring damping: how quickly the animation settles. Default 0.7. */
  damping?: number;
  /** Spring stiffness: how fast it accelerates. Default 0.05. */
  stiffness?: number;
  /** Spring mass: higher is slower. Default 1.25. */
  mass?: number;
  /** CSS selector of a message, for `scrollToLastMessage()`. Default `tct-chat-message`. */
  messageSelector?: string;
}

export class ChatStreamScrollController implements ReactiveController {
  readonly #host: ReactiveControllerHost;
  readonly #options: ChatStreamScrollOptions;
  #element: HTMLElement | null = null;
  #locked = true;
  #scrolledUp = false;
  /** True until the first fill has been positioned. */
  #initialFillPending = true;
  #velocity = 0;
  #animating = false;
  #lastTick: number | undefined;
  #frame = 0;
  #initialFrame = 0;
  #settleTimer: ReturnType<typeof setTimeout> | undefined;
  /**
   * The last position this controller set or saw. Updated by every write of ours and by every scroll
   * event, so a reader's move between two spring frames still shows as "above where we put it".
   */
  #lastScrollTop = 0;

  constructor(host: ReactiveControllerHost, options: ChatStreamScrollOptions) {
    this.#host = host;
    this.#options = options;
    host.addController(this);
  }

  /** Whether the reader has scrolled up past `buttonThreshold`: show the scroll-to-bottom button. */
  get isScrolledUp(): boolean {
    return this.#scrolledUp;
  }

  /** Whether the view is following new content. */
  get isLocked(): boolean {
    return this.#locked;
  }

  // ----------------------------------------------------------------------------- lifecycle

  hostConnected(): void {
    this.#sync();
  }

  hostUpdated(): void {
    this.#sync();
  }

  hostDisconnected(): void {
    this.#detach();
  }

  // ------------------------------------------------------------------------------ public API

  /** Scrolls to the bottom and follows again. */
  scrollToBottom(options?: ChatScrollToBottomOptions): void {
    this.#setLocked(true);
    this.#setScrolledUp(false);
    this.#initialFillPending = false;
    if (options?.behavior === 'instant') {
      this.#jump();
      return;
    }
    this.#startAnimation();
  }

  /** Scrolls so `element` is at the top of the view. Does not change the lock. */
  scrollToMessage(element: HTMLElement): void {
    const container = this.#element;
    if (!container) return;
    const offset =
      element.getBoundingClientRect().top -
      container.getBoundingClientRect().top +
      container.scrollTop;
    container.scrollTo({top: offset, behavior: 'instant'});
    this.#lastScrollTop = container.scrollTop;
  }

  /** Scrolls to the last message in the container. */
  scrollToLastMessage(): void {
    const container = this.#element;
    const last = container
      ? findLastMessage(container, this.#options.messageSelector ?? 'tct-chat-message')
      : null;
    if (last instanceof HTMLElement) this.scrollToMessage(last);
  }

  /** Follows again and scrolls to the bottom. */
  lock(): void {
    this.#setLocked(true);
    this.#setScrolledUp(false);
    this.#startAnimation();
  }

  /** Stops following. */
  unlock(): void {
    this.#setLocked(false);
    this.#animating = false;
  }

  /** Scrolls to the bottom when following. Call it when the content resizes. */
  scrollIfLocked(): void {
    if (!this.#enabled || !this.#locked) return;
    if (this.#readerMoved()) return;
    // First fill: content that appears for the first time (an async-loaded conversation) is placed
    // in one frame instead of flying in from the top. It stays pending through empty or loading
    // resizes until the container actually scrolls.
    const element = this.#element;
    if (this.#initialFillPending && element && element.scrollHeight > element.clientHeight) {
      this.#initialFillPending = false;
      this.#jump();
      return;
    }
    this.#startAnimation();
  }

  // ---------------------------------------------------------------------------------- internals

  get #enabled(): boolean {
    return this.#options.enabled?.() ?? true;
  }

  #sync(): void {
    const next = this.#enabled ? (this.#options.scroller() ?? null) : null;
    if (next === this.#element) return;
    this.#detach();
    if (next) this.#attach(next);
  }

  #attach(element: HTMLElement): void {
    this.#element = element;
    this.#lastScrollTop = element.scrollTop;
    ensureFollowingStyle(element);
    element.toggleAttribute(FOLLOWING_ATTR, this.#locked);
    element.addEventListener('scroll', this.#onScroll, {passive: true});
    element.addEventListener('scrollend', this.#onScrollEnd);
    // Content already present when the controller attaches: land at the bottom.
    this.#initialFrame = requestAnimationFrame(() => {
      if (element.scrollHeight > element.clientHeight) {
        element.scrollTop = element.scrollHeight - element.clientHeight;
        this.#lastScrollTop = element.scrollTop;
        this.#initialFillPending = false;
      }
    });
  }

  #detach(): void {
    const element = this.#element;
    if (!element) return;
    element.removeEventListener('scroll', this.#onScroll);
    element.removeEventListener('scrollend', this.#onScrollEnd);
    element.removeAttribute(FOLLOWING_ATTR);
    cancelAnimationFrame(this.#frame);
    cancelAnimationFrame(this.#initialFrame);
    clearTimeout(this.#settleTimer);
    this.#animating = false;
    this.#velocity = 0;
    this.#lastTick = undefined;
    this.#element = null;
  }

  // While following, this controller is the only thing that should move the container: scroll
  // anchoring is off, so the browser's one remaining move is the clamp onto a smaller bottom, and every
  // other upward move is the reader. Unlocked, the element's own anchoring applies again: a reader up
  // in the history wants it when content above them changes.
  #setLocked(locked: boolean): void {
    const changed = locked !== this.#locked;
    this.#locked = locked;
    this.#element?.toggleAttribute(FOLLOWING_ATTR, locked);
    if (changed) this.#host.requestUpdate();
  }

  /**
   * A reader's move up that has not produced its `scroll` event yet: the event is delivered a frame
   * later, and a write of ours in between (a resize callback, a spring frame, the reduced-motion jump)
   * would put the position back before it is ever seen. Reading the position first lets the reader win.
   * Returns true when the reader moved (and following stopped).
   */
  #readerMoved(): boolean {
    const element = this.#element;
    if (!element || element.scrollTop >= this.#lastScrollTop) return false;
    this.#onScroll();
    return !this.#locked;
  }

  #setScrolledUp(scrolledUp: boolean): void {
    if (scrolledUp === this.#scrolledUp) return;
    this.#scrolledUp = scrolledUp;
    this.#host.requestUpdate();
  }

  readonly #onScroll = (): void => {
    const element = this.#element;
    if (!element) return;
    const {scrollTop, scrollHeight, offsetHeight} = element;
    const distance = scrollHeight - scrollTop - offsetHeight;
    this.#setScrolledUp(distance > (this.#options.buttonThreshold ?? 100));

    const scrollingUp = scrollTop < this.#lastScrollTop;
    this.#lastScrollTop = scrollTop;
    // With anchoring off the browser only ever moves a following container up to clamp it onto a new,
    // smaller bottom, and a reader scrolling up never lands there. (`clientHeight`, not `distance`:
    // `offsetHeight` includes borders and a horizontal scrollbar.)
    const landedAtBottom = scrollHeight - scrollTop - element.clientHeight < 1;
    if (scrollingUp && !landedAtBottom && this.#locked) {
      this.#setLocked(false);
      this.#animating = false;
    }
    // Settle detection for engines that never fire `scrollend` (Safari < 26.2); where it fires, the
    // native event runs the same idempotent handler first.
    clearTimeout(this.#settleTimer);
    this.#settleTimer = setTimeout(this.#onScrollEnd, SETTLE_MS);
  };

  readonly #onScrollEnd = (): void => {
    const element = this.#element;
    if (!element) return;
    const distance = element.scrollHeight - element.scrollTop - element.offsetHeight;
    if (distance <= (this.#options.lockThreshold ?? 10)) this.#setLocked(true);
  };

  // ------------------------------------------------------------------------------ the spring

  #animate = (): void => {
    const element = this.#element;
    if (!element || !this.#locked || element.scrollHeight <= element.clientHeight) {
      this.#stopAnimation();
      return;
    }
    if (this.#readerMoved()) {
      this.#stopAnimation();
      return;
    }
    const target = element.scrollHeight - element.clientHeight;
    const difference = target - element.scrollTop;
    // The last pixel: a fractional scroll position rounds to a device pixel, so a tiny velocity would
    // stall one or two pixels short of the bottom for ever; land on it instead.
    if (Math.abs(difference) < 1.5) {
      element.scrollTo({top: target, behavior: 'instant'});
      this.#lastScrollTop = element.scrollTop;
      this.#stopAnimation();
      return;
    }
    const now = performance.now();
    const tick = this.#lastTick ? (now - this.#lastTick) / SIXTY_FPS_MS : 1;
    this.#lastTick = now;
    const {damping = 0.7, stiffness = 0.05, mass = 1.25} = this.#options;
    this.#velocity = (damping * this.#velocity + stiffness * difference) / mass;
    // `instant`: a container with `scroll-behavior: smooth` must not fight the spring.
    element.scrollTo({top: element.scrollTop + this.#velocity * tick, behavior: 'instant'});
    this.#lastScrollTop = element.scrollTop;
    this.#frame = requestAnimationFrame(this.#animate);
  };

  #stopAnimation(): void {
    this.#animating = false;
    this.#lastTick = undefined;
    this.#velocity = 0;
  }

  /** Jumps to the bottom in one frame, cancelling a spring in flight so a later tick cannot fight it. */
  #jump(): void {
    const element = this.#element;
    if (!element) return;
    cancelAnimationFrame(this.#frame);
    this.#stopAnimation();
    element.scrollTo({top: element.scrollHeight - element.clientHeight, behavior: 'instant'});
    this.#lastScrollTop = element.scrollTop;
  }

  /** Every spring entry point funnels through here, so this one branch covers reduced motion. */
  #startAnimation(): void {
    if (!this.#locked) return;
    if (prefersReducedMotion()) {
      this.#jump();
      return;
    }
    if (!this.#animating) {
      this.#animating = true;
      this.#lastTick = undefined;
      this.#frame = requestAnimationFrame(this.#animate);
    }
  }
}
