import {TctEvent} from './tct-event.js';

/**
 * Fired when the user resized a region (dragged its handle or used the keyboard on it): once for every
 * step of a drag. A notification, not cancelable; property writes and `resize()` never emit it.
 *
 * @eventName tct-size-change
 * @bubbles
 * @composed
 */
export class TctSizeChangeEvent extends TctEvent {
  static readonly eventName = 'tct-size-change';
  /** The new size of the region, in CSS px. */
  readonly size: number;
  /** What resized it. */
  readonly reason: 'pointer' | 'keyboard';

  constructor(size: number, reason: 'pointer' | 'keyboard') {
    super(TctSizeChangeEvent.eventName);
    this.size = size;
    this.reason = reason;
  }
}

declare global {
  interface GlobalEventHandlersEventMap {
    'tct-size-change': TctSizeChangeEvent;
  }
}
