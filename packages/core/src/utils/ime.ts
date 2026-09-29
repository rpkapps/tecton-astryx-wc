/**
 * IME safety (A§9.14, port of upstream `isImeKeyEvent`, IME_GUARD_DESIGN). While an input method
 * editor is composing (Japanese, Chinese, Korean), Enter commits the candidate and Escape cancels it;
 * both keydowns arrive before `compositionend` and must never run application commands. Every
 * keydown command handler checks {@link isImeKeyEvent} first [mwg:ime-safe-enter-submit].
 */
import type {ReactiveController, ReactiveControllerHost} from 'lit';

/** The keyCode browsers report for a key event processed by an IME (legacy, still load-bearing). */
const IME_PROCESSING_KEY_CODE = 229;

/**
 * `event.isComposing === true || event.keyCode === 229`. The 229 fallback catches Safari's
 * confirming Enter, which arrives after `compositionend` reset `isComposing`. Structurally typed so
 * synthetic events and plain objects work.
 */
export function isImeKeyEvent(event: {isComposing?: boolean; keyCode?: number}): boolean {
  return event.isComposing === true || event.keyCode === IME_PROCESSING_KEY_CODE;
}

/**
 * Tracks `compositionstart`/`compositionend` on a target so code that has no keydown to inspect (a
 * close request, a blur handler, a value normaliser) can ask whether text is mid-composition.
 * Composition state survives re-renders; it is cleared on blur so a lost `compositionend` cannot
 * leave the flag stuck.
 */
export class ImeGuard implements ReactiveController {
  readonly #target: () => EventTarget | null;
  #attached: EventTarget | null = null;
  #composing = false;

  constructor(host: ReactiveControllerHost, target: () => EventTarget | null) {
    this.#target = target;
    host.addController(this);
  }

  /** True between `compositionstart` and `compositionend` on the target. */
  get composing(): boolean {
    return this.#composing;
  }

  hostConnected(): void {
    this.attach();
  }

  hostUpdated(): void {
    // The target (an inner input) exists only after the first render and may be replaced.
    this.attach();
  }

  hostDisconnected(): void {
    this.detach();
  }

  /** Re-resolves the target and moves the listeners; called by the lifecycle hooks. */
  attach(): void {
    const target = this.#target();
    if (target === this.#attached) return;
    this.detach();
    if (!target) return;
    target.addEventListener('compositionstart', this.#start);
    target.addEventListener('compositionend', this.#end);
    target.addEventListener('blur', this.#end);
    this.#attached = target;
  }

  detach(): void {
    const target = this.#attached;
    if (target) {
      target.removeEventListener('compositionstart', this.#start);
      target.removeEventListener('compositionend', this.#end);
      target.removeEventListener('blur', this.#end);
    }
    this.#attached = null;
    this.#composing = false;
  }

  readonly #start = (): void => {
    this.#composing = true;
  };

  readonly #end = (): void => {
    this.#composing = false;
  };
}
