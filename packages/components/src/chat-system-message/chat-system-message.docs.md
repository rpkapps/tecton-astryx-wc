---
title: Chat System Message
folder: chat-system-message
category: Chat
entries: [ChatSystemMessage]
summary: A centred notice in a conversation that nobody sent: a date break, a join, a status change.
examples: [default, divider, with-icon, in-conversation, rtl]
keywords: [chat, system message, notice, status, date separator, divider, join, leave, event, banner, timeline]
dense:
  description: centred non-sender notice; divider variant for date/section breaks, default for status lines
  usage: Use tct-chat-system-message for concise non-sender content in a chat: "Conversation started", "Ana joined", a date. default is a factual status line; divider sets the text between two rules. Put it among the rows of a tct-chat-message-list; the list speaks it once.
  bestPractices:
    - {do: true, text: 'Keep the text short and complete on its own, so it reads without the icon.'}
    - {do: true, text: 'Use divider for temporal or section boundaries and default for factual notices.'}
    - {do: false, text: 'Use it for sender-authored content; use tct-chat-message and tct-chat-message-bubble.'}
    - {do: false, text: 'Rely on the icon as the only carrier of meaning.'}
  properties:
    variant: default (plain centred text) or divider (text between two rules)
    default: the message, factual text or inline content such as a date
    icon: slot for an icon before the text (default variant only)
related: [chat-message, chat-message-list, divider]
---

## Purpose

`tct-chat-system-message` is the chat's status line: a centred, muted piece of text that belongs to the
conversation but to none of its participants. It has no avatar, no bubble and no alignment, so it never looks like
something a person said.

## When to use

- Date and section breaks ("Today", "2 unread messages"), with `variant="divider"`.
- Membership and state changes: "Conversation started", "Ana joined", "Assigned to the night shift".
- Confirmations the system itself produces, such as "Work order created", with a status icon.

## Alternatives

- `tct-chat-message` with a `system` sender when a system row needs the message layout (a centred bubble).
- `tct-banner` for a message that needs an action or that must stay visible outside the transcript.
- `tct-toast` for a transient confirmation that is not part of the record.

## Anatomy

- **Row** (`part="base"`): the centred line that carries the theme target. In the `divider` variant the whole row
  is a `tct-divider` (`part="divider"`).
- **Icon** (`slot="icon"`, `part="icon"`): optional, before the text, default variant only.
- **Text** (default slot, `part="content"`): the notice.

## Variants and states

`default` is centred, muted supporting text that wraps within the available width. `divider` puts the text between
two rules across the full width. There are no interactive states. The `icon` slot is drawn only in the default
variant, as upstream: put an icon you need in the divider text itself.

## Responsive behaviour

The default variant wraps long text at the row's width and stays centred. The divider keeps its rules on either
side of the text and lets a long label wrap between them.

## Form semantics

Not applicable.

## Screen-reader expectations

The host is a `status`. The divider variant contains a separator named by the message text, so it is announced
with its text when a reader browses to it. When the row is added to a `tct-chat-message-list`, the list announces
its text once, politely; the row itself never moves focus. The optional icon is decoration: the text has to say
everything.

## Localisation

The component has no strings of its own; the text is yours to translate and to format (use `Intl.DateTimeFormat`
for date breaks). The layout is direction-neutral: the icon comes first at the inline start, in a right-to-left
page too.

## Consumer responsibilities

- Keep the text factual, short and understandable without the icon.
- Localise and format dates and names yourself.
- Do not use a system message for something a participant said.
