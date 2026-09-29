import {html, type CSSResultGroup, type PropertyValues} from 'lit';
import {property} from 'lit/decorators.js';
import {INTERACTIVE_SELECTORS} from '@tecton-wc/core/controllers/clickable-container.js';
import {
  TctToastDismissEvent,
  type ToastDismissReason,
} from '@tecton-wc/core/events/tct-toast-dismiss.js';
import {TctToastHideEvent} from '@tecton-wc/core/events/tct-toast-hide.js';
import {LocaleController} from '@tecton-wc/core/i18n/locale-controller.js';
import {TctElement} from '@tecton-wc/core/tct-element.js';
import defaultMessages from '@tecton-wc/locales/en/toast.js';
import {TctIcon} from '../icon/tct-icon.js';
import base from '../styles/base.styles.css';
import focusRing from '../styles/focus-ring.styles.css';
import motion from '../styles/motion.styles.css';
import styles from './tct-toast.styles.css';
import {ToastGestureController} from './toast-gesture.js';
import {
  TOAST_SWIPE_EDGES,
  TOAST_TYPES,
  type ToastContentRenderFn,
  type ToastSwipeEdge,
  type ToastType,
} from './toast.types.js';

/** Default auto-hide time of an `info` toast, in ms. */
const DEFAULT_AUTO_HIDE_MS = 5000;
/** A paused timer never resumes with less than this left, so the user gets time to read (upstream). */
const MIN_RESUME_MS = 1000;

const SWIPE_IGNORED = `${INTERACTIVE_SELECTORS},[tabindex],[contenteditable]:not([contenteditable="false"])`;

/**
 * A brief, non-blocking notification: a status message with an optional trailing action and a close
 * button. `info` toasts hide themselves after `auto-hide-duration` (5 s); `error` toasts stay until
 * dismissed and are announced assertively. The timer pauses while the pointer or focus is on the toast
 * and while the window is blurred. Swiping a toast towards its screen edge (touch or pen) dismisses it;
 * the close button is the always-available alternative.
 *
 * Toasts are normally raised with `toast()` (see `tct-layer-provider`), which stacks them in a
 * top-layer viewport. A `tct-toast` can also sit in markup on its own: it fires the cancelable
 * `tct-toast-dismiss` when it wants to go, then `tct-toast-hide` and the `exiting` state when it does
 * (its owner removes it), and never removes itself.
 *
 * The toast is a status (`info`) or alert (`error`) but not a live region of its own: the viewport
 * speaks it once through the announcer, so it is never read twice.
 *
 * @summary A brief, non-blocking notification with auto-hide, pause and swipe dismissal.
 * @tag tct-toast
 * @upstream Toast
 * @slot - The message.
 * @slot end - Trailing content such as an Undo button or a link. Keep action labels short.
 * @csspart toast - The painted card.
 * @csspart content - The message area.
 * @csspart end - The trailing area (the `end` slot and the close button).
 * @csspart dismiss-button - The close button.
 * @cssstate exiting - The toast is on its way out.
 * @fires {TctToastDismissEvent} tct-toast-dismiss - The toast wants to go (timer, close button, swipe, `dismiss()`); cancelable.
 * @fires {TctToastHideEvent} tct-toast-hide - The toast started to hide; once per toast.
 * @cloakDisplay block
 */
export class TctToast extends TctElement {
  static override readonly tagName = 'tct-toast';
  static override readonly dependencies = [TctIcon];
  static override styles: CSSResultGroup = [base, focusRing, motion, styles];

  /** Colour and urgency: `info` (default) or `error`. */
  @property({reflect: true}) type: ToastType = 'info';
  /**
   * Milliseconds before the toast dismisses itself; `0` keeps it until dismissed. Default: 5000 for
   * `info`, `0` for `error` (upstream `isAutoHide` and `autoHideDuration` in one property).
   */
  @property({type: Number, attribute: 'auto-hide-duration'}) autoHideDuration: number | undefined;
  /** The toast is on its way out (set by `dismiss()`, or by an owner that removes it). */
  @property({type: Boolean, reflect: true}) exiting = false;
  /** The block edge a swipe dismisses towards: `end` (default, bottom stacks) or `start` (top stacks). */
  @property({attribute: 'swipe-edge'}) swipeEdge: ToastSwipeEdge = 'end';
  /** Label of the close button. Default: the localized "Dismiss notification". */
  @property({attribute: 'dismiss-label'}) dismissLabel: string | undefined;
  /** Replaces the layout of the card; the card, semantics and auto-hide stay. The renderer owns every control (no close button is added). */
  @property({attribute: false}) renderContent: ToastContentRenderFn | undefined;

  /** Whether this toast dismisses itself (resolved from `type` and `auto-hide-duration`). */
  get autoHide(): boolean {
    return this.#duration > 0;
  }

  /**
   * Dismisses the toast: fires the cancelable `tct-toast-dismiss`; unless prevented the toast starts
   * to exit and `tct-toast-hide` fires, once. Repeated calls during the exit do nothing.
   */
  dismiss(reason: ToastDismissReason = 'manual'): void {
    if (this.exiting || this.#hidden) return;
    if (!this.dispatch(new TctToastDismissEvent(reason))) return;
    this.#hidden = true;
    this.#clearTimer();
    this.exiting = true;
    this.dispatch(new TctToastHideEvent(reason));
  }

  // -------------------------------------------------------------------------------- internals

  readonly #locale: LocaleController = new LocaleController(this, {
    namespace: 'toast',
    defaults: defaultMessages,
  });
  #timer: ReturnType<typeof setTimeout> | undefined;
  #paused = false;
  #remaining = DEFAULT_AUTO_HIDE_MS;
  #startedAt: number | undefined;
  #hidden = false;
  #armedFor = -1;

  constructor() {
    super();
    this.addEventListener('mouseenter', this.#pause);
    this.addEventListener('mouseleave', this.#resume);
    this.addEventListener('focusin', this.#pause);
    this.addEventListener('focusout', this.#onFocusOut);
    new ToastGestureController(this, {
      root: () => this.renderRoot.querySelector<HTMLElement>('.card'),
      direction: () => (this.swipeEdge === 'start' ? -1 : 1),
      enabled: () => !this.exiting,
      canPauseTimer: () => this.autoHide,
      isTimerPaused: () => this.#paused,
      pauseTimer: this.#pause,
      resumeTimer: this.#resume,
      dismiss: () => {
        this.dismiss('manual');
      },
      shouldIgnoreTarget: (event, root) => {
        for (const node of event.composedPath()) {
          if (node === root) return false;
          if (node instanceof Element && node.matches(SWIPE_IGNORED)) return true;
        }
        return false;
      },
    });
  }

  get #duration(): number {
    if (this.autoHideDuration !== undefined && Number.isFinite(this.autoHideDuration)) {
      return Math.max(0, this.autoHideDuration);
    }
    return this.type === 'error' ? 0 : DEFAULT_AUTO_HIDE_MS;
  }

  /** (Re)starts the countdown from the resolved duration. */
  #arm(): void {
    this.#armedFor = this.#duration;
    this.#remaining = this.#armedFor;
    this.#paused = false;
    this.#clearTimer();
    this.#start();
  }

  #clearTimer(): void {
    clearTimeout(this.#timer);
    this.#timer = undefined;
  }

  #start(): void {
    if (!this.autoHide || this.#paused || this.exiting) return;
    this.#clearTimer();
    this.#startedAt = Date.now();
    this.#timer = setTimeout(() => {
      this.dismiss('auto');
    }, this.#remaining);
  }

  readonly #pause = (): void => {
    if (!this.autoHide || this.#paused) return;
    this.#paused = true;
    this.#clearTimer();
    if (this.#startedAt !== undefined) {
      this.#remaining = Math.max(this.#remaining - (Date.now() - this.#startedAt), MIN_RESUME_MS);
    }
  };

  readonly #resume = (): void => {
    if (!this.autoHide || !this.#paused) return;
    this.#paused = false;
    this.#start();
  };

  readonly #onFocusOut = (event: FocusEvent): void => {
    // Focus moving between controls inside the toast keeps it paused.
    if (event.relatedTarget instanceof Node && this.contains(event.relatedTarget)) return;
    this.#resume();
  };

  readonly #onWindowBlur = (): void => {
    this.#pause();
  };

  readonly #onWindowFocus = (): void => {
    // A pointer or focus that is still on the toast keeps it paused.
    if (this.matches(':hover') || this.matches(':focus-within')) return;
    this.#resume();
  };

  // ------------------------------------------------------------------------------ lifecycle

  override connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener('blur', this.#onWindowBlur);
    window.addEventListener('focus', this.#onWindowFocus);
    this.#arm();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener('blur', this.#onWindowBlur);
    window.removeEventListener('focus', this.#onWindowFocus);
    this.#clearTimer();
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    const error = this.type === 'error';
    // Status and alert semantics without a live region of its own: the viewport announces once.
    this.internals.role = error ? 'alert' : 'status';
    this.internals.ariaLive = 'off';
    this.internals.ariaAtomic = 'true';
    if (changed.has('type') && !TOAST_TYPES.includes(this.type)) this.type = 'info';
    if (changed.has('swipeEdge') && !TOAST_SWIPE_EDGES.includes(this.swipeEdge))
      this.swipeEdge = 'end';
  }

  protected override updated(changed: PropertyValues<this>): void {
    this.toggleState('exiting', this.exiting);
    if (this.isConnected && this.#duration !== this.#armedFor) this.#arm();
    if (changed.has('exiting') && this.exiting) this.#clearTimer();
  }

  // --------------------------------------------------------------------------------- render

  override render() {
    const props = {
      body: undefined,
      endContent: undefined,
      type: this.type,
      autoHide: this.autoHide,
      autoHideDuration: this.#duration,
      dismiss: () => {
        this.dismiss('manual');
      },
    };
    return html`<div class="card" part="toast" data-type=${this.type}>
      ${
        this.renderContent
          ? this.renderContent(props)
          : html`<div class="inner">
              <div class="content" part="content"><slot></slot></div>
              <div class="end" part="end">
                <slot name="end"></slot>
                <button
                  class="dismiss focus-ring"
                  part="dismiss-button"
                  type="button"
                  data-focus-ring="double"
                  aria-label=${this.dismissLabel ?? this.#locale.t('dismiss', undefined, 'dismiss-label')}
                  @click=${() => {
                    this.dismiss('manual');
                  }}
                >
                  <tct-icon name="close" size="sm"></tct-icon>
                </button>
              </div>
            </div>`
      }
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-toast': TctToast;
  }
}
