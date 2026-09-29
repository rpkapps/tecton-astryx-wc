import {TctEvent} from './tct-event.js';

/** What made an in-page navigation's active item change. */
export type ActiveChangeReason = 'scroll' | 'click' | 'keyboard';

/**
 * Fired after the active item of an in-page navigation (an outline) changed because the page scrolled to
 * another section or the user chose an item. A notification, not cancelable: the active item follows the
 * document. Property and attribute writes never emit it.
 *
 * @eventName tct-active-change
 * @bubbles
 * @composed
 */
export class TctActiveChangeEvent extends TctEvent {
  static readonly eventName = 'tct-active-change';
  /** The id of the item that is now active. */
  readonly id: string;
  /** What changed it. */
  readonly reason: ActiveChangeReason;

  constructor(id: string, reason: ActiveChangeReason) {
    super(TctActiveChangeEvent.eventName);
    this.id = id;
    this.reason = reason;
  }
}

declare global {
  interface GlobalEventHandlersEventMap {
    'tct-active-change': TctActiveChangeEvent;
  }
}
