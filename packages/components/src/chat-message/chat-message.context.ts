import {createContext} from '@tecton-wc/core/context/protocol.js';
import type {ChatDensity, ChatSender} from './chat-message.types.js';

/**
 * Provided by `tct-chat-message` to the bubble, the metadata row and anything else inside it (upstream
 * `ChatMessageContext`, plus the way a bubble tells its message that it shows a sender name row, which
 * upstream reads with `:has(~ * [data-chat-name])`).
 */
export interface ChatMessageContextValue {
  sender: ChatSender;
  density: ChatDensity;
  /** A bubble reports (or, with `false`, withdraws) that it renders a sender name row. */
  reportName(source: Element, hasName: boolean): void;
}

export const chatMessageContext = createContext<ChatMessageContextValue | null, symbol>(
  Symbol.for('tct.chat-message'),
);

/** Provided by `tct-chat-message-list` to its messages (upstream `ChatListContext`). */
export interface ChatListContextValue {
  density: ChatDensity;
}

export const chatListContext = createContext<ChatListContextValue | null, symbol>(
  Symbol.for('tct.chat-list'),
);
