import {TctEvent, type ChangeReason} from './tct-event.js';

/**
 * Fired before a calendar moves the visible month because of the user (the previous and next buttons, the
 * arrow keys past the edge of a month, PageUp and PageDown). `preventDefault()` keeps the visible month:
 * a host that drives `focus-date` itself listens for it, checks `focusDate`, and sets the property.
 *
 * @eventName tct-focus-date-change
 * @bubbles
 * @composed
 * @cancelable
 */
export class TctFocusDateChangeEvent extends TctEvent {
  static readonly eventName = 'tct-focus-date-change';
  /** The date the calendar is about to show the month of, as `YYYY-MM-DD` (the first of the month for a button). */
  readonly focusDate: string;
  /** What asked for the change. */
  readonly reason: ChangeReason;

  constructor(focusDate: string, reason: ChangeReason) {
    super(TctFocusDateChangeEvent.eventName, {cancelable: true});
    this.focusDate = focusDate;
    this.reason = reason;
  }
}

declare global {
  interface GlobalEventHandlersEventMap {
    'tct-focus-date-change': TctFocusDateChangeEvent;
  }
}
