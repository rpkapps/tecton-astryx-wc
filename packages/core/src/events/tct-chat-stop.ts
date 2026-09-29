import {TctEvent} from './tct-event.js';

/**
 * Fired when the user activates the send button in its stop state, to abort a running response
 * (upstream `onStop`). A notification: the owner stops the work and clears `stop-shown`.
 *
 * @eventName tct-chat-stop
 * @bubbles
 * @composed
 */
export class TctChatStopEvent extends TctEvent {
  static readonly eventName = 'tct-chat-stop';

  constructor() {
    super(TctChatStopEvent.eventName);
  }
}

declare global {
  interface GlobalEventHandlersEventMap {
    'tct-chat-stop': TctChatStopEvent;
  }
}
