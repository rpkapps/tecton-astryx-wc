import {TctEvent} from './tct-event.js';

/**
 * Fired when the user activates "Expand" on a long pasted-text token: the token dissolves into its
 * text in the input. `preventDefault()` keeps the token. Also fired by a standalone
 * `tct-chat-composer-token-element` (an expandable token outside an input), where the owner acts on it.
 *
 * @eventName tct-chat-token-expand
 * @bubbles
 * @composed
 * @cancelable
 */
export class TctChatTokenExpandEvent extends TctEvent {
  static readonly eventName = 'tct-chat-token-expand';
  /** The serialized value of the token that was asked to expand. */
  readonly value: string;

  constructor(value: string) {
    super(TctChatTokenExpandEvent.eventName, {cancelable: true});
    this.value = value;
  }
}

declare global {
  interface GlobalEventHandlersEventMap {
    'tct-chat-token-expand': TctChatTokenExpandEvent;
  }
}
