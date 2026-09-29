import {TctEvent} from './tct-event.js';

/** Why a toast is being dismissed: its auto-hide timer ran out, or the user (or code) closed it. */
export type ToastDismissReason = 'auto' | 'manual';

/**
 * Fired when a toast wants to go away (the auto-hide timer ended, the close button, a swipe, or
 * `dismiss()`); `preventDefault()` keeps it. Upstream `onDismiss`.
 *
 * @eventName tct-toast-dismiss
 * @bubbles
 * @composed
 * @cancelable
 */
export class TctToastDismissEvent extends TctEvent {
  static readonly eventName = 'tct-toast-dismiss';
  /** What asked for the dismissal. */
  readonly reason: ToastDismissReason;

  constructor(reason: ToastDismissReason) {
    super(TctToastDismissEvent.eventName, {cancelable: true});
    this.reason = reason;
  }
}

declare global {
  interface GlobalEventHandlersEventMap {
    'tct-toast-dismiss': TctToastDismissEvent;
  }
}
