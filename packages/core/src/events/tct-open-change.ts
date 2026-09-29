import {TctEvent, type ChangeReason} from './tct-event.js';

/**
 * Fired before an element opens or closes because of the user (or `requestClose()`);
 * `preventDefault()` keeps the current state. Property and attribute writes never emit it.
 *
 * @eventName tct-open-change
 * @bubbles
 * @composed
 * @cancelable
 */
export class TctOpenChangeEvent extends TctEvent {
  static readonly eventName = 'tct-open-change';
  /** The requested state. */
  readonly open: boolean;
  /** What asked for the change. */
  readonly reason: ChangeReason;

  constructor(open: boolean, reason: ChangeReason) {
    super(TctOpenChangeEvent.eventName, {cancelable: true});
    this.open = open;
    this.reason = reason;
  }
}

declare global {
  interface GlobalEventHandlersEventMap {
    'tct-open-change': TctOpenChangeEvent;
  }
}
