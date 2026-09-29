/**
 * Tab containment for NON-dialog containers (A§9.18, upstream `useFocusTrap` parity): a popover that
 * behaves as a dialog, a date-picker panel. Native modal `<dialog>` needs none (`showModal()` makes
 * the rest of the page inert, `[mwg:light-dismiss-a-dialog]`), so never use this inside one. Escape
 * is not its job: the layer stack owns it (D7).
 *
 * While `active()` is true and focus is inside `container()`, Tab from the last tabbable wraps to the
 * first and Shift+Tab from the first to the last, following slots and shadow roots (flat tree). With
 * nothing tabbable inside, Tab is swallowed so focus cannot leave.
 */
import type {ReactiveController, ReactiveControllerHost} from 'lit';
import {containsFlat, deepActiveElement, getTabbables} from '../utils/focus.js';

export interface FocusTrapOptions {
  container: () => HTMLElement | null | undefined;
  active: () => boolean;
}

export class FocusTrapController implements ReactiveController {
  readonly #options: FocusTrapOptions;

  constructor(host: ReactiveControllerHost, options: FocusTrapOptions) {
    this.#options = options;
    host.addController(this);
  }

  hostConnected(): void {
    document.addEventListener('keydown', this.#onKeyDown, true);
  }

  hostDisconnected(): void {
    document.removeEventListener('keydown', this.#onKeyDown, true);
  }

  readonly #onKeyDown = (event: KeyboardEvent): void => {
    if (
      event.key !== 'Tab' ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.defaultPrevented
    ) {
      return;
    }
    if (!this.#options.active()) return;
    const container = this.#options.container();
    if (!container) return;
    const active = deepActiveElement();
    if (!containsFlat(container, active)) return;

    const tabbables = getTabbables(container);
    if (tabbables.length === 0) {
      event.preventDefault();
      return;
    }
    const first = tabbables[0]!;
    const last = tabbables[tabbables.length - 1]!;
    const index = tabbables.findIndex((item) => item === active || containsFlat(item, active));
    if (event.shiftKey && index <= 0) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (index === -1 || index === tabbables.length - 1)) {
      event.preventDefault();
      first.focus();
    }
  };
}
