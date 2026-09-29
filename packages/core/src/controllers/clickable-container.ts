/**
 * Whole-surface click for cards (A§9.18, port of upstream `useClickableContainer`) that contain their
 * own interactive children. The card has one real action (an `<a>`/`<button>` rendered in its shadow
 * root, usually visually hidden); a click on the card surface is proxied to it, so modifier and
 * middle clicks, new-tab and router navigation all behave like the real link. A click that lands on
 * or inside a nested interactive element (a button in the footer) belongs to that element and is
 * never proxied, and a text selection is never a click.
 *
 * Every navigation exit checks the URL policy (`safeUrl`): a blocked `href` does not navigate by any
 * activation method.
 */
import type {ReactiveController, ReactiveControllerHost} from 'lit';
import {isSafeUrl} from '../utils/safe-url.js';

/**
 * Canonical list of interactive selectors: native controls plus role-based ones. Clicks on these (or
 * their descendants) never proxy to a clickable container. This is about "do not bubble a click",
 * not focus eligibility: callers needing focusables must also exclude disabled/`tabindex="-1"`.
 */
export const INTERACTIVE_SELECTORS = [
  'button',
  'a',
  'input',
  'select',
  'textarea',
  '[role="button"]',
  '[role="link"]',
  '[role="checkbox"]',
  '[role="radio"]',
  '[role="switch"]',
  '[role="tab"]',
  '[role="menuitem"]',
  '[role="option"]',
  '[role="combobox"]',
  '[role="listbox"]',
  '[role="slider"]',
  '[role="spinbutton"]',
  '[data-pressable-container]',
].join(',');

const NON_INTERACTIVE_SELECTORS = '[aria-readonly="true"]';

export interface ClickableContainerOptions {
  /** The primary interactive element inside (link or button), usually in the shadow root. */
  action: () => HTMLElement | null;
  /** Skip everything while true. */
  disabled?: () => boolean;
}

export class ClickableContainerController implements ReactiveController {
  readonly #host: ReactiveControllerHost & HTMLElement;
  readonly #options: ClickableContainerOptions;
  #proxying = false;

  constructor(host: ReactiveControllerHost & HTMLElement, options: ClickableContainerOptions) {
    this.#host = host;
    this.#options = options;
    host.addController(this);
  }

  hostConnected(): void {
    this.#host.setAttribute('data-pressable-container', 'true');
    // Capture: the original click is swallowed before author listeners on the host see it, so
    // the proxied click from the real action is the only one they receive (one click per activation).
    this.#host.addEventListener('click', this.#onClick, true);
    this.#host.addEventListener('mouseup', this.#onMouseUp);
  }

  hostDisconnected(): void {
    this.#host.removeEventListener('click', this.#onClick, true);
    this.#host.removeEventListener('mouseup', this.#onMouseUp);
  }

  /** Whether the event target is on or inside something interactive between it and the host. */
  #insideInteractive(event: Event, action: HTMLElement | null): boolean {
    for (const node of event.composedPath()) {
      if (node === this.#host) return false;
      if (!(node instanceof Element)) continue;
      // Anything inside the real action is the action's own click: never proxy it again.
      if (node === action) return true;
      if (node.matches(INTERACTIVE_SELECTORS) && !node.matches(NON_INTERACTIVE_SELECTORS))
        return true;
    }
    return false;
  }

  #hasTextSelection(): boolean {
    const selection = this.#host.ownerDocument.getSelection();
    if (!selection || selection.isCollapsed) return false;
    return selection.anchorNode !== null && this.#host.contains(selection.anchorNode);
  }

  readonly #onClick = (event: MouseEvent): void => {
    if (this.#proxying || event.defaultPrevented || this.#options.disabled?.()) return;
    const action = this.#options.action();
    if (!action || this.#insideInteractive(event, action) || this.#hasTextSelection()) return;
    if (action instanceof HTMLAnchorElement && !isSafeUrl(action.getAttribute('href') ?? ''))
      return;

    // A synthetic click on an anchor runs its activation behaviour, with the user's modifier keys
    // (Ctrl/Cmd-click opens a tab); a real `click()` would lose them.
    this.#proxying = true;
    try {
      action.dispatchEvent(
        new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          composed: true,
          ctrlKey: event.ctrlKey,
          metaKey: event.metaKey,
          shiftKey: event.shiftKey,
          altKey: event.altKey,
          button: event.button,
        }),
      );
    } finally {
      this.#proxying = false;
    }
    event.stopImmediatePropagation();
  };

  /** Middle click opens the link in a new tab, like a real anchor. */
  readonly #onMouseUp = (event: MouseEvent): void => {
    if (event.button !== 1 || this.#options.disabled?.()) return;
    const action = this.#options.action();
    if (!(action instanceof HTMLAnchorElement) || this.#insideInteractive(event, action)) return;
    const href = action.href;
    if (isSafeUrl(href)) window.open(href, '_blank', 'noopener');
  };
}
