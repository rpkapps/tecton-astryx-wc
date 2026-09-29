import {TctEvent} from './tct-event.js';

/**
 * Fired when the user asks to clear a control (clear button); `preventDefault()` keeps the value.
 *
 * @eventName tct-clear
 * @bubbles
 * @composed
 * @cancelable
 */
export class TctClearEvent extends TctEvent {
  static readonly eventName = 'tct-clear';

  constructor() {
    super(TctClearEvent.eventName, {cancelable: true});
  }
}

declare global {
  interface GlobalEventHandlersEventMap {
    'tct-clear': TctClearEvent;
  }
}
