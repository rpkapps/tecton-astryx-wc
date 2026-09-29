import {defineElement} from '@tecton-wc/core/define.js';
import {TctChatComposer} from './tct-chat-composer.js';
import {TctChatComposerDrawer} from './tct-chat-composer-drawer.js';
import {TctChatComposerInput} from './tct-chat-composer-input.js';
import {TctChatComposerTokenElement} from './tct-chat-composer-token-element.js';
import {TctChatDictationButton} from './tct-chat-dictation-button.js';
import {TctChatSendButton} from './tct-chat-send-button.js';

defineElement(TctChatComposerTokenElement);
defineElement(TctChatComposerInput);
defineElement(TctChatSendButton);
defineElement(TctChatComposer);
defineElement(TctChatComposerDrawer);
defineElement(TctChatDictationButton);

export {
  TctChatComposer,
  TctChatComposerDrawer,
  TctChatComposerInput,
  TctChatComposerTokenElement,
  TctChatDictationButton,
  TctChatSendButton,
};
