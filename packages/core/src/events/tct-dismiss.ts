import {TctEvent, type ChangeReason} from './tct-event.js';

/**
 * Fired before a dismissible element (a banner) removes itself because the user dismissed it;
 * `preventDefault()` keeps it. Not emitted for programmatic removal.
 *
 * @eventName tct-dismiss
 * @bubbles
 * @composed
 * @cancelable
 */
export class TctDismissEvent extends TctEvent {
  static readonly eventName = 'tct-dismiss';
  /** What asked for the dismissal (`close-button` for the dismiss control). */
  readonly reason: ChangeReason;

  constructor(reason: ChangeReason = 'close-button') {
    super(TctDismissEvent.eventName, {cancelable: true});
    this.reason = reason;
  }
}

declare global {
  interface GlobalEventHandlersEventMap {
    'tct-dismiss': TctDismissEvent;
  }
}
