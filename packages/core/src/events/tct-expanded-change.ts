import {TctEvent, type ChangeReason} from './tct-event.js';

/**
 * Fired before a disclosure that is called "expanded" (the group of `tct-chat-tool-calls`) expands
 * or collapses because of the user. `preventDefault()` keeps the current state, which is how a
 * controlled host takes over: listen, decide, then set `expanded` itself. Property and attribute
 * writes never emit it.
 *
 * @eventName tct-expanded-change
 * @bubbles
 * @composed
 * @cancelable
 */
export class TctExpandedChangeEvent extends TctEvent {
  static readonly eventName = 'tct-expanded-change';
  /** The requested state. */
  readonly expanded: boolean;
  /** What asked for the change. */
  readonly reason: ChangeReason;

  constructor(expanded: boolean, reason: ChangeReason) {
    super(TctExpandedChangeEvent.eventName, {cancelable: true});
    this.expanded = expanded;
    this.reason = reason;
  }
}

declare global {
  interface GlobalEventHandlersEventMap {
    'tct-expanded-change': TctExpandedChangeEvent;
  }
}
