import {TctEvent} from './tct-event.js';

/**
 * Fired once an open/close change has settled (after animations), for every actual change including
 * programmatic ones; a notification like native `toggle`, not cancelable.
 *
 * @eventName tct-after-open-change
 * @bubbles
 * @composed
 */
export class TctAfterOpenChangeEvent extends TctEvent {
  static readonly eventName = 'tct-after-open-change';
  /** The settled state. */
  readonly open: boolean;

  constructor(open: boolean) {
    super(TctAfterOpenChangeEvent.eventName);
    this.open = open;
  }
}

declare global {
  interface GlobalEventHandlersEventMap {
    'tct-after-open-change': TctAfterOpenChangeEvent;
  }
}
