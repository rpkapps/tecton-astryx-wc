import {TctEvent} from './tct-event.js';

/**
 * Fired once when an in-page navigation resolves: the smooth scroll settled, a reduced-motion jump
 * landed, or the user interrupted the scroll by scrolling. It fires exactly once for every
 * `tct-navigate-start`, so a "navigating" state can never leak (it does not fire if the element is removed
 * mid-scroll). A notification, not cancelable.
 *
 * @eventName tct-navigate-end
 * @bubbles
 * @composed
 */
export class TctNavigateEndEvent extends TctEvent {
  static readonly eventName = 'tct-navigate-end';
  /** The id of the item (the target heading's `id`). */
  readonly id: string;

  constructor(id: string) {
    super(TctNavigateEndEvent.eventName);
    this.id = id;
  }
}

declare global {
  interface GlobalEventHandlersEventMap {
    'tct-navigate-end': TctNavigateEndEvent;
  }
}
