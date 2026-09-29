import type {TemplateResult} from 'lit';
import type {BadgeVariant} from '../badge/badge.types.js';

/** Who a message is from: it decides alignment and colour (upstream `ChatMessageSender`). */
export const CHAT_SENDERS = ['user', 'assistant', 'system'] as const;
export type ChatSender = (typeof CHAT_SENDERS)[number];

/** Row spacing and bubble padding (upstream `ChatDensity`). */
export const CHAT_DENSITIES = ['compact', 'balanced', 'spacious'] as const;
export type ChatDensity = (typeof CHAT_DENSITIES)[number];

/** `filled` paints the bubble; `ghost` keeps the padding and drops the fill. */
export const CHAT_BUBBLE_VARIANTS = ['filled', 'ghost'] as const;
export type ChatBubbleVariant = (typeof CHAT_BUBBLE_VARIANTS)[number];

/** Position in a run of consecutive bubbles; it tightens the sender-side corners. */
export const CHAT_BUBBLE_GROUPS = ['first', 'middle', 'last'] as const;
export type ChatBubbleGroup = (typeof CHAT_BUBBLE_GROUPS)[number];

/** Delivery status of an outgoing message (upstream `ChatMessageStatus`). */
export const CHAT_MESSAGE_STATUSES = ['sending', 'sent', 'delivered', 'read', 'error'] as const;
export type ChatMessageStatus = (typeof CHAT_MESSAGE_STATUSES)[number];

/**
 * A structured token: `value` is the serialized text it replaces, `label`/`variant`/`icon` become a
 * badge. `icon` is a registered icon name. Structurally the upstream `ChatComposerTokenBadge`.
 */
export interface ChatTokenBadge {
  /** The serialized text this token stands for; matched literally. */
  value: string;
  /** Text of the badge. */
  label?: string;
  /** Badge variant. */
  variant?: BadgeVariant;
  /** Registered icon name shown before the label. */
  icon?: string;
}

/**
 * A custom token: `render` returns what to show. A string is text, never HTML; markup goes through a
 * Lit template or a DOM node the caller built. Structurally the upstream `ChatComposerTokenCustom`.
 */
export interface ChatTokenCustom {
  /** The serialized text this token stands for; matched literally. */
  value: string;
  /** Called once per match; the result replaces the matched text. */
  render: () => TemplateResult | Node | string;
}

/** Token definition shared by the composer input (when it lands) and `tct-chat-tokenized-text`. */
export type ChatToken = ChatTokenBadge | ChatTokenCustom;
