import {TctEvent} from './tct-event.js';

/**
 * Fired before the composer input inserts pasted plain text (upstream `onPaste`, which gets first
 * refusal). `preventDefault()` means you handled the paste: no paste-as-token conversion and no
 * insertion follow, and the input publishes the change only if your handling did not already (insert
 * through `insertText()` or `insertToken()`). Not fired for file pastes (`tct-chat-files`).
 *
 * @eventName tct-chat-paste
 * @bubbles
 * @composed
 * @cancelable
 */
export class TctChatPasteEvent extends TctEvent {
  static readonly eventName = 'tct-chat-paste';
  /** The plain text on the clipboard. */
  readonly text: string;

  constructor(text: string) {
    super(TctChatPasteEvent.eventName, {cancelable: true});
    this.text = text;
  }
}

declare global {
  interface GlobalEventHandlersEventMap {
    'tct-chat-paste': TctChatPasteEvent;
  }
}
