---
title: Chat Layout
folder: chat-layout
category: Chat
entries: [ChatLayout]
summary: "The shell of a full-page chat: the transcript, a composer docked at the bottom behind a frosted layer, a scroll-to-bottom button and stick-to-bottom scrolling."
examples: [basic, empty-state, follow, density, rtl]
keywords: [chat, layout, conversation, transcript, dock, composer, scroll, stick to bottom, auto-scroll, follow, new messages, frosted, blur, empty state, llm, ai]
dense:
  description: full-page chat shell; transcript in the message area, composer docked bottom behind frosted glass, wired scroll-to-bottom button, follows a streaming reply while at the bottom
  usage: Give tct-chat-layout a height (a flex parent or block-size). Put a tct-chat-message-list in the default slot and a tct-chat-composer in slot composer. empty-state shows while there are no messages. The layout scrolls itself; set scroll-target to document or a selector (or scrollTarget) when another element scrolls. scrollToBottom() jumps back to the newest message.
  bestPractices:
    - {do: true, text: 'Put a tct-chat-message-list in the default slot and a tct-chat-composer in the composer slot.'}
    - {do: true, text: 'Provide an empty-state so a new conversation is not blank.'}
    - {do: true, text: 'Give the layout a bounded height (flex parent or block-size) so it can scroll.'}
    - {do: true, text: 'Use scroll-target="document" when the page itself scrolls; the dock then follows the viewport.'}
    - {do: false, text: 'Nest two chat layouts in one scroll container: each owns its scroll position.'}
    - {do: false, text: 'Move focus into new messages yourself while a reply streams: the layout and the list never do.'}
  properties:
    density: compact, balanced (default) or spacious; steps the dock padding, the message column and the blur layer
    scroll-target: which element scrolls the conversation, as text; document or a CSS selector; property scrollTargetSelector
    scrollTarget: property; an element that scrolls the conversation instead of the layout; wins over scroll-target
    no-scroll-button: renders no scroll-to-bottom button
    default: slot for the transcript, typically a tct-chat-message-list
    composer: slot for the composer, docked at the bottom
    empty-state: slot shown, centred, while the default slot is empty
    scroll-button: slot that replaces the default scroll-to-bottom button
    isScrolledUp: read-only; the reader has scrolled away from the bottom
    isFollowing: read-only; the view follows new content
    hasNewMessages: read-only; a message arrived while the reader was away from the bottom
    scrollToBottom: method; scrolls to the bottom and follows again; {instant} jumps
related: [chat-composer, chat-message-list, chat-message, chat-system-message, empty-state]
---

## Purpose

`tct-chat-layout` is the frame of a whole chat screen. The transcript flows in the message area, the composer is
docked at the bottom on a frosted-glass layer that fades into the messages, and a scroll-to-bottom button sits
between them. It wires the scrolling that a growing conversation needs: while you are reading the newest message
it follows a reply as it streams in, when you scroll up it lets go and offers the button (or a "New messages"
hint), and pressing the button takes you back and hands focus to the newest message.

## When to use

- A chat screen or panel where the composer stays at the bottom and messages scroll above it.
- A conversation embedded in a page that scrolls itself: set `scroll-target`.

## Alternatives

- `tct-chat-message-list` alone when you supply your own scroller and composer placement.
- `tct-vstack` with a scrollable stack item for a static log that never streams.
- `tct-app-shell` for the page frame around the chat; the layout fills whatever region it is given.

## Anatomy

- **Layout** (`tct-chat-layout`, `part="base"`): the flex column that scrolls itself.
  - **Message area** (default slot, `part="messages"`): the transcript, in a column that is centred and capped in the
    spacious density.
  - **Empty state** (`slot="empty-state"`, `part="empty"`): centred in the message area while there are no messages.
  - **Dock** (`part="dock"`): sticky at the bottom (fixed when another element or the page scrolls).
    - **Blur layer** (`part="blur"`): the frosted glass, masked so it fades toward the transcript.
    - **Scroll button** (`slot="scroll-button"`, `part="scroll-button"`): a `tct-chat-layout-scroll-button` by default.
    - **Composer** (`slot="composer"`, `part="dock-inner"`): the width-capped column of the composer.

## Variants and states

`density` steps the dock padding, the width of the message column (the spacious column is at most 800px and
centred) and the size of the blur layer, together. The layout is following (at the bottom), scrolled up (the scroll
button shows) or has new messages (the button says so); `isFollowing`, `isScrolledUp` and `hasNewMessages` expose
the state. Following is a spring that becomes a jump under reduced motion, and the reader's own scrolling always
wins. In forced-colours mode the blur layer is removed and the composer's own edge carries the boundary.

## Responsive behaviour

The layout fills the container it is in (`flex: 1`): give that container a height, a flex parent or a `block-size`.
The message area grows into the space the dock leaves and never shrinks below its content, so a short
conversation fills the layout without a scrollbar and a long one scrolls. It is a container for container queries,
so children can respond to the width they are given. With `scroll-target="document"` (or a selector, or the
`scrollTarget` property) another element scrolls, the layout stops scrolling itself and the dock is fixed to the
viewport.

## Form semantics

Not applicable. The layout is a container; the composer inside it holds the draft.

## Screen-reader expectations

- The layout adds no landmark and no name. Give the region a name where it sits (a `role="region"` with a label, or
  the page's `main`).
- The transcript is announced by `tct-chat-message-list`, one finished message at a time; nothing here moves focus
  while a reply streams.
- The scroll button is a real button named "Scroll to bottom" (or "New messages"); activating it moves focus to the
  newest message so a keyboard user continues from there.
- Following the stream does not steal the reader's position: scrolling up stops it at once.

## Localisation

The scroll button's names ("Scroll to bottom", "New messages") are localised (the 30 shipped catalogs). Everything
else is your content. The layout, the dock and the column mirror in right-to-left.

## Consumer responsibilities

- Give the layout a bounded height, and name the region it forms if it is a landmark.
- Put a `tct-chat-message-list` in the default slot; it registers with the layout, which is what makes following
  and the scroll button work. Tell the list when a reply starts and ends (`streaming`).
- Use `scroll-target` when a parent or the page scrolls, and do not nest layouts in one scroll container.
- Provide the empty state and the composer; the layout renders neither by default.
