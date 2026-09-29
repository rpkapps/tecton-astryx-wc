import {createContext} from '@tecton-astryx/core/context/protocol.js';

/**
 * What the chat layout (`tct-chat-layout`) provides to the message list inside it (upstream
 * `ChatLayoutContext`). The key lives here, next to its only consumer, so the layout can be built
 * later without a dependency in the other direction.
 */
export interface ChatLayoutContextValue {
  /** The element that scrolls the conversation: the observation root of the older-messages sentinel. */
  scrollContainer(): HTMLElement | null;
  /**
   * The message list registers the element whose size changes when a message arrives or grows (the
   * layout observes it to keep the view at the bottom), and withdraws it with `null` when it goes.
   */
  contentRef(element: HTMLElement | null): void;
}

export const chatLayoutContext = createContext<ChatLayoutContextValue | null, symbol>(
  Symbol.for('tct.chat-layout'),
);
