import {TctEvent} from './tct-event.js';
import type {ToastDismissReason} from './tct-toast-dismiss.js';

/**
 * Fired once when a toast starts to hide (its dismissal was not prevented and the exit began), so an
 * owner can remove it after the exit animation. Upstream `onHide`. Not cancelable, and exactly one per
 * toast however often it is dismissed during the exit.
 *
 * @eventName tct-toast-hide
 * @bubbles
 * @composed
 */
export class TctToastHideEvent extends TctEvent {
  static readonly eventName = 'tct-toast-hide';
  /** How the toast was dismissed. */
  readonly reason: ToastDismissReason;

  constructor(reason: ToastDismissReason) {
    super(TctToastHideEvent.eventName);
    this.reason = reason;
  }
}

declare global {
  interface GlobalEventHandlersEventMap {
    'tct-toast-hide': TctToastHideEvent;
  }
}
