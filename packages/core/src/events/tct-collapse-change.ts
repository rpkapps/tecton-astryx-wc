import {TctEvent} from './tct-event.js';

/**
 * Fired before a resizable region collapses or expands because of the user (a drag past the collapse
 * threshold, Enter or a double click on its handle). `preventDefault()` keeps the current state, which
 * is how a page owns the collapse state itself; `collapse()`, `expand()` and property writes never emit it.
 *
 * @eventName tct-collapse-change
 * @bubbles
 * @composed
 * @cancelable
 */
export class TctCollapseChangeEvent extends TctEvent {
  static readonly eventName = 'tct-collapse-change';
  /** Whether the region is asked to be collapsed (`true`) or expanded (`false`). */
  readonly collapsed: boolean;
  /** What asked for it. */
  readonly reason: 'pointer' | 'keyboard';

  constructor(collapsed: boolean, reason: 'pointer' | 'keyboard') {
    super(TctCollapseChangeEvent.eventName, {cancelable: true});
    this.collapsed = collapsed;
    this.reason = reason;
  }
}

declare global {
  interface GlobalEventHandlersEventMap {
    'tct-collapse-change': TctCollapseChangeEvent;
  }
}
