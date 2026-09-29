import {defineElement} from '@tecton-wc/core/define.js';
import {TctChatMessage} from './tct-chat-message.js';
import {TctChatMessageBubble} from './tct-chat-message-bubble.js';
import {TctChatMessageMetadata} from './tct-chat-message-metadata.js';
import {TctChatTokenizedText} from './tct-chat-tokenized-text.js';

defineElement(TctChatMessage);
defineElement(TctChatMessageBubble);
defineElement(TctChatMessageMetadata);
defineElement(TctChatTokenizedText);

export {TctChatMessage, TctChatMessageBubble, TctChatMessageMetadata, TctChatTokenizedText};
