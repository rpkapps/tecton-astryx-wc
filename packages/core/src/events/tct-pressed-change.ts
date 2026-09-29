import {TctEvent, type ChangeReason} from './tct-event.js';

/**
 * Fired before a toggle button becomes pressed or released because of the user; `preventDefault()`
 * keeps the current state (and skips its pressed-change action). Property and attribute writes never
 * emit it.
 *
 * @eventName tct-pressed-change
 * @bubbles
 * @composed
 * @cancelable
 */
export class TctPressedChangeEvent extends TctEvent {
  static readonly eventName = 'tct-pressed-change';
  /** The requested pressed state. */
  readonly pressed: boolean;
  /** What asked for the change. */
  readonly reason: ChangeReason;

  constructor(pressed: boolean, reason: ChangeReason) {
    super(TctPressedChangeEvent.eventName, {cancelable: true});
    this.pressed = pressed;
    this.reason = reason;
  }
}

declare global {
  interface GlobalEventHandlersEventMap {
    'tct-pressed-change': TctPressedChangeEvent;
  }
}
