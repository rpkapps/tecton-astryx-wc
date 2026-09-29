import {TctEvent} from './tct-event.js';

/**
 * Fired when an in-page navigation to a heading begins (an outline item was activated), before the scroll
 * starts. Pair it with `tct-navigate-end` to drive an arrival effect (a flash or ring on the target). A
 * notification, not cancelable.
 *
 * @eventName tct-navigate-start
 * @bubbles
 * @composed
 */
export class TctNavigateStartEvent extends TctEvent {
  static readonly eventName = 'tct-navigate-start';
  /** The id of the item (the target heading's `id`). */
  readonly id: string;

  constructor(id: string) {
    super(TctNavigateStartEvent.eventName);
    this.id = id;
  }
}

declare global {
  interface GlobalEventHandlersEventMap {
    'tct-navigate-start': TctNavigateStartEvent;
  }
}
