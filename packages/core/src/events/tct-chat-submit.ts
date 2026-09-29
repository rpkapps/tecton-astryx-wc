import {TctEvent} from './tct-event.js';

/**
 * Fired when the user submits a chat draft: Enter without Shift in the composer input (never the Enter
 * that commits an IME conversion), or the send button. `value` is the trimmed serialized draft, never
 * empty. Not fired for `submit()` calls with an empty draft.
 *
 * Cancelable: `preventDefault()` keeps the draft (the input is not cleared). When the Enter key
 * raised it, a prevented event also leaves the key to the editor, so Enter inserts a newline: the way to
 * make Enter a newline on a touch keyboard.
 *
 * @eventName tct-chat-submit
 * @bubbles
 * @composed
 * @cancelable
 */
export class TctChatSubmitEvent extends TctEvent {
  static readonly eventName = 'tct-chat-submit';
  /** The trimmed serialized draft: tokens contribute their `value`. */
  readonly value: string;

  constructor(value: string) {
    super(TctChatSubmitEvent.eventName, {cancelable: true});
    this.value = value;
  }
}

declare global {
  interface GlobalEventHandlersEventMap {
    'tct-chat-submit': TctChatSubmitEvent;
  }
}
