import {TctEvent} from './tct-event.js';

/**
 * Fired when the user activates the confirming action of a surface that asks for a decision (the
 * action button of an alert dialog). A notification, not cancelable: the surface never closes on its
 * own after an action, the owner decides when the work is done and closes it.
 *
 * @eventName tct-action
 * @bubbles
 * @composed
 */
export class TctActionEvent extends TctEvent {
  static readonly eventName = 'tct-action';

  constructor() {
    super(TctActionEvent.eventName);
  }
}

declare global {
  interface GlobalEventHandlersEventMap {
    'tct-action': TctActionEvent;
  }
}
