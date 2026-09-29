import {TctEvent} from './tct-event.js';

/**
 * Fired when the user activates the send button in its send state (upstream `onSend`). Its default
 * action inside a composer is to submit the draft (`tct-chat-submit`); `preventDefault()` replaces that
 * with your own handling, as passing `onSend` does upstream.
 *
 * @eventName tct-chat-send
 * @bubbles
 * @composed
 * @cancelable
 */
export class TctChatSendEvent extends TctEvent {
  static readonly eventName = 'tct-chat-send';

  constructor() {
    super(TctChatSendEvent.eventName, {cancelable: true});
  }
}

declare global {
  interface GlobalEventHandlersEventMap {
    'tct-chat-send': TctChatSendEvent;
  }
}
