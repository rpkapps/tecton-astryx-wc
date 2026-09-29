---
title: Chat Message
folder: chat-message
category: Chat
entries: [ChatMessage, ChatMessageBubble, ChatMessageMetadata, ChatTokenizedText]
summary: One message in a conversation: the sender, avatar, name, bubbles, metadata and delivery status, aligned by who sent it.
examples: [conversation, senders, avatars-and-names, bubbles, grouping, metadata, delivery-status, tokenized-text, density, rtl]
keywords: [chat, message, bubble, conversation, assistant, user, sender, avatar, timestamp, status, delivery, read receipt, mention, token, tag, llm, ai]
dense:
  description: sender-aligned chat message w/ avatar, name, bubbles, metadata row, delivery status, tokenized text
  usage: Put tct-chat-message (sender user|assistant|system) in a tct-chat-message-list. Its body is tct-chat-message-bubble elements (or any content). name goes on the first bubble, metadata on the last (a tct-chat-message-metadata with timestamp, footer, status). tct-chat-tokenized-text turns @mention/#tag values in stored text into badges.
  bestPractices:
    - {do: true, text: 'Use bubbles the same way for every message on one side; use variant="ghost" for content that needs the same alignment without a boundary (add width="100%" to span the column).'}
    - {do: true, text: 'Put name on the first bubble and metadata on the last. Without bubbles, use the message''s own name and metadata slot.'}
    - {do: true, text: 'Give a run of bubbles from one sender group="first|middle|last".'}
    - {do: true, text: 'Reuse the same token definitions for the composer and for tct-chat-tokenized-text.'}
    - {do: false, text: 'Put the same metadata on both a bubble and its message.'}
    - {do: false, text: 'Put footer actions in the metadata row without their own accessible names: the row does not own them.'}
    - {do: false, text: 'Use a message for a notice nobody sent (a date, a join); use tct-chat-system-message.'}
    - {do: false, text: 'Let a token label replace the surrounding sentence: the message must read on its own.'}
  properties:
    sender: user (end-aligned), assistant (start-aligned, default) or system (centred)
    density: compact, balanced or spacious; unset follows the enclosing list
    name: plain-text sender name above the body; names the article
    accessibleName: read-only accessible name of the message (sender name, else "Message from {sender}")
    default: the message body (bubbles, tool calls, any content); on a bubble, the bubble content
    avatar: slot for a tct-avatar beside the message
    metadata: slot for the metadata row under the body; on a bubble, plain-text metadata attribute
    variant: bubble variant, filled (default) or ghost (no fill, same padding)
    group: bubble position in a run, first, middle or last
    width: bubble width, a number of px or a CSS length; replaces the max(80%, 280px) cap
    timestamp: plain-text timestamp of the metadata row; also its slot
    footer: plain-text footer of the metadata row; also its slot
    status: delivery status, sending, sent, delivered, read or error
    text: message text with serialized token values; else the element's own text
    announcementText: read-only text as displayed, tokens shown by their labels; what the message list announces
    tokens: token definitions (property only), badge {value, label, variant, icon} or custom {value, render}
related: [chat-message-list, chat-system-message, chat-tool-calls, avatar, badge]
---

## Purpose

A chat message is one turn of a conversation. `tct-chat-message` knows who sent it and lays out its parts
accordingly: the avatar, the sender name, the body and the metadata, with the user's messages at the end of the
line and the assistant's at the start. `tct-chat-message-bubble` is the rounded container the words live in.
`tct-chat-message-metadata` is the small line under it (a time, a model name, a delivery status), and
`tct-chat-tokenized-text` shows `@mentions`, `#tags` and `/commands` in stored text as badges.

## When to use

- Every turn of a human or AI conversation, inside a `tct-chat-message-list`.
- Bubbles for the words; `ghost` bubbles, or no bubble at all, for cards, attachments and tool calls that
  belong to the same turn.
- Tokenized text wherever the composer inserted tokens: the stored string keeps the serialized value and the
  message shows the badge.

## Alternatives

- `tct-chat-system-message` for something no participant said: a date break, "Ana joined", a status change.
- `tct-chat-tool-calls` inside an assistant message for what the agent did.
- Plain `tct-text` in a `tct-card` when the content is not a conversation.

## Anatomy

- **Message** (`tct-chat-message`, `part="base"`): an `article` that owns the row.
  - **Avatar** (`slot="avatar"`, `part="avatar"`): beside the column, first for the assistant and last for the user.
  - **Name** (`name` attribute or `slot="name"`, `part="name"`): above the body, for content that is not a bubble.
  - **Body** (default slot, `part="body"`): bubbles or any content, spaced by density.
  - **Metadata** (`slot="metadata"`, `part="metadata"`): under the body, for content that is not a bubble.
- **Bubble** (`tct-chat-message-bubble`, `part="bubble"`), with its own `name` row above (`part="name"`) and `metadata` row below
  (`part="metadata"`), both lined up with the bubble's text.
- **Metadata row** (`tct-chat-message-metadata`, `part="base"`): `timestamp`, `footer` and `status`, separated by dots.
- **Tokenized text** (`tct-chat-tokenized-text`, `part="base"` and `part="token"`): the text with a badge for each matched token.

## Variants and states

`sender` chooses alignment and the colour of a bubble; both senders use the neutral fill. `density` (`compact`,
`balanced`, `spacious`) sets the gap between blocks and the bubble padding and radius; it comes from the list and
can be overridden on a message. A bubble is `filled` or `ghost`, and takes `group` for the corners of a run of
consecutive bubbles. The metadata status is one of `sending` (pulses unless motion is reduced), `sent`,
`delivered`, `read` and `error` (drawn in the error ink, worded "Failed").

## Responsive behaviour

A bubble is at most 80% of the message column and never narrower than 280 px before it has to shrink; long words
break instead of overflowing. Set `width` on a bubble to replace that cap (`100%` with a ghost bubble makes custom
content span the column). Everything is laid out with logical properties, so the user's messages sit at the left
edge in a right-to-left page, the avatar swaps sides and the corner of a grouped bubble follows the reading
direction.

## Form semantics

Not applicable. Chat messages are read-only content; the composer that sends them is a separate component.

## Screen-reader expectations

- A message is an `article`, named by its sender name, or "Message from {sender}" when there is none.
- A bubble has no role: it is text in the reading order.
- A delivery status is an image named "Message sent" (and so on) with the status word as its tooltip; the dots
  between the metadata items are hidden from assistive technology.
- Tokenized text reads the unmatched text and the token labels in order. Keep the message understandable without
  the badge styling.
- Speech for new messages is the message list's job: it announces each completed message once. Nothing here
  moves focus.

## Localisation

The accessible name pattern "Message from {sender}" and the five delivery status words are localised (the 30
shipped catalogs, plus a `lang` on the page or a provider). Everything else, names, timestamps, footers and token
labels, is yours: format times with `Intl` in the reader's locale. Long translations wrap inside the bubble; the
metadata row wraps its items rather than clipping them.

## Consumer responsibilities

- Name the sender: a `name`, a bubble `name`, or accept "Message from {sender}".
- Give footer actions (copy, react) their own accessible names; the metadata row does not own them.
- Provide unique, non-empty serialized values for tokens, and reuse the composer's token definitions.
- Do not put the same metadata on a bubble and on its message.
- Render a stream by updating the bubble's text; tell the message list when the stream starts and ends (`streaming`).
