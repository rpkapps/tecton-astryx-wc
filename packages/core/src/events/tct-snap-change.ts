import {TctEvent} from './tct-event.js';

/**
 * Fired after the user moved a resizable surface to another resting stop (a bottom sheet dragged,
 * tapped or resized with the keyboard). A notification, not cancelable; property writes and
 * `snapTo()` never emit it.
 *
 * @eventName tct-snap-change
 * @bubbles
 * @composed
 */
export class TctSnapChangeEvent extends TctEvent {
  static readonly eventName = 'tct-snap-change';
  /** Index of the new resting stop; 0 is the tallest. */
  readonly index: number;
  /** Visible height of the surface at the new stop, in CSS px. */
  readonly height: number;
  /** What moved it. */
  readonly reason: 'pointer' | 'keyboard';

  constructor(index: number, height: number, reason: 'pointer' | 'keyboard') {
    super(TctSnapChangeEvent.eventName);
    this.index = index;
    this.height = height;
    this.reason = reason;
  }
}

declare global {
  interface GlobalEventHandlersEventMap {
    'tct-snap-change': TctSnapChangeEvent;
  }
}
