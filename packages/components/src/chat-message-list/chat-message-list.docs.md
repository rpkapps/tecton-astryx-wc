---
title: Chat Message List
folder: chat-message-list
category: Chat
entries: [ChatMessageList, ChatLayoutScrollButton]
summary: The transcript of a chat: a log of messages that speaks each one once when it is complete, plus the scroll-to-bottom button and the stick-to-bottom scroll controllers.
examples: [basic, align, empty-state, gap, streaming, older-messages, scroll-button, scroll-button-states, rtl]
keywords: [chat, message list, transcript, log, streaming, scroll, stick to bottom, scroll to bottom, new messages, infinite scroll, older messages, aria-live, announce, conversation, density]
dense:
  description: chat transcript log w/ density context, empty state, older-message sentinel; announces each completed message once (never per token); scroll-to-bottom button + stick-to-bottom controllers
  usage: Put tct-chat-message and tct-chat-system-message rows in tct-chat-message-list. Set streaming while a reply streams in (silent, aria-busy), clear it when done (announces once). tct-chat-layout-scroll-button (visible, label) is the floating button; ChatStreamScrollController and ChatNewMessagesController (Lit controllers) follow new content and detect new messages.
  bestPractices:
    - {do: true, text: 'Set streaming for the whole duration of a stream and clear it at the end: the message is then announced once, complete.'}
    - {do: true, text: 'Let the layout (or the scroll controllers) own scrolling; the list never scrolls or moves focus.'}
    - {do: true, text: 'Give the message area of a custom scroller flex: 1 0 auto, so the list grows with its messages.'}
    - {do: true, text: 'Bind the scroll button''s visible to the scroll controller''s isScrolledUp, and set label to "New messages" while unread messages are below.'}
    - {do: false, text: 'Add aria-live to the list or to a message: the list already announces settled messages, and a native live region reads a stream token by token.'}
    - {do: false, text: 'Focus the composer or a message from a stream handler: streaming must never steal focus.'}
    - {do: false, text: 'Use the list as the scroll container; wrap it (the chat layout does).'}
  properties:
    density: compact, balanced (default) or spacious; flows to every message
    gap: spacing-scale step (0 to 10) overriding only the row gap
    align: bottom (default) rests a short list on the composer, top starts at the top
    streaming: set while a reply streams in; aria-busy, silent until it returns to false
    no-announce: turns the list's announcements off
    scrollToTopAction: async action run when the top of the list scrolls into view (older messages); property only
    focusLatestMessage: method that focuses the newest message (else the list), without scrolling
    default: the rows of the transcript
    empty-state: slot shown while there are no rows
    visible: whether the scroll button is shown
    label: text that widens the scroll button pill, e.g. "New messages"
    focusTarget: where focus goes when the button hides while focused; unset, the newest message
    click: native click on the scroll button; scrolling is yours
related: [chat-message, chat-system-message, chat-tool-calls, spinner, button]
---

## Purpose

`tct-chat-message-list` is the transcript of a conversation. It holds the rows (messages, system messages, date
breaks), spaces them by density, rests a short conversation on the composer, shows an empty state, and asks
for older messages when you scroll to the top. It is also where speech happens: the list announces each new message
once, when it is complete, so a screen reader is told about a streamed answer once and never token by token.

`tct-chat-layout-scroll-button` is the floating button that takes the reader back to the newest message, and
`ChatStreamScrollController` / `ChatNewMessagesController` are the controllers that keep a growing conversation
scrolled to the bottom and notice new messages while the reader is away.

## When to use

- The message area of any chat or agent interface, inside a chat layout or a scroll container of your own.
- The scroll button and controllers wherever a conversation grows while people read it.

## Alternatives

- `tct-list` for rows that are not a conversation.
- A plain `tct-vstack` when nothing streams and nothing needs announcing.
- `tct-toast` for a one-off notification that is not part of the record.

## Anatomy

- **List** (the host, a `log`, focusable): the transcript.
  - **Column** (`part="base"`): the padded column of rows.
  - **Loading** (`part="loading"`): a spinner at the top while older messages load.
  - **Empty state** (`slot="empty-state"`, `part="empty"`): shown while there are no rows.
- **Scroll button** (`tct-chat-layout-scroll-button`): a **wrapper** (`part="wrapper"`) that centres and spaces a **pill**
  (`part="pill"`) that holds a ghost **button** (`part="button"`) with an icon, or an icon and a label.

## Variants and states

The list has three densities, two alignments (`bottom` and `top`) and an optional `gap`. It is `busy`
(`aria-busy`, `:state(busy)`) while `streaming` is set or older messages are loading. The scroll button is hidden
or `visible`, and either an icon button or a labelled pill.

## Responsive behaviour

The list fills its container (`flex: 1`, `min-block-size: 0`) and its rows are as wide as it is. It does not
scroll itself: put it in a scroller, in a message area that does not shrink below its content (`flex: 1 0 auto`,
as the chat layout does), so it grows with its messages. A short list rests at the bottom until its messages
overflow; from then on both alignments scroll the same. The scroll button is centred in its row and clips its label to 200 px.

## Form semantics

Not applicable.

## Screen-reader expectations

- The list is a `log` and a tab stop (`tabindex="0"`), so keyboard users can land in the transcript.
- Its native live region is **off**. The list announces each message itself, once, through the shared announcer:
  while `streaming` is set nothing is spoken; when it returns to false the completed message is announced as
  "{name}: {text}" (or "Message from assistant: {text}"). Without the flag a message is announced after it has been
  quiet for half a second.
- Not announced: your own (`user`) messages, rows inserted above the newest one (older history), rows present at load,
  and all but the last of a batch of more than three arriving together. `no-announce` turns it off.
- `aria-busy` marks the log while a stream or an older-messages load is in progress.
- The scroll button is not in the tab order or the accessibility tree while hidden. When it hides while it holds
  focus (after a keyboard activation), focus moves to the newest message, which is where the reader has just
  scrolled to. Nothing moves focus during streaming.

## Localisation

"Scroll to bottom" (the button's name) is localised (30 catalogs); the `label` you pass ("New messages" in the
layout) is yours, as are the messages. Announcements use the message text as you wrote it, introduced by the
message's accessible name. Layout is logical throughout, so a right-to-left page mirrors it.

## Consumer responsibilities

- Set `streaming` for the duration of every stream, or accept the half-second quiet-period fallback.
- Own scrolling (the layout, or the controllers below) and bind the button's `visible` and `label`.
- Never place live regions around the list, and never move focus while streaming.
- Keep the stream text in the messages' own content so it can be announced (custom renderers that draw text
  elsewhere need an `announcementText` property, as tokenized text has).

## Streaming and announcements

```html
<tct-chat-message-list id="chat"></tct-chat-message-list>
```

```js
const list = document.getElementById('chat');
list.streaming = true;                       // silent, aria-busy
const bubble = appendAssistantMessage(list); // the message exists, empty
for await (const token of stream) bubble.append(token);   // 200 tokens, zero announcements
list.streaming = false;                      // one announcement: the finished message
```

## Scroll controllers

The controllers are Lit reactive controllers, the equivalents of `useChatStreamScroll` and `useChatNewMessages`.
Together with the scroll button they are what a chat layout is built from:

```ts
import {ChatNewMessagesController, ChatStreamScrollController} from '@tecton-wc/components/chat-message-list';

class MyChat extends LitElement {
  scroll = new ChatStreamScrollController(this, {
    scroller: () => this.renderRoot.querySelector('.scroller'),
  });
  news = new ChatNewMessagesController(this, {
    isLocked: () => this.scroll.isLocked,
    onResize: () => this.scroll.scrollIfLocked(),   // follow a message that grows while it streams
  });
  // The message list finds `chatLayoutContext` and hands over its content element to `news.contentRef`.
  render() {
    return html`
      <div class="scroller"><slot></slot></div>
      <tct-chat-layout-scroll-button
        ?visible=${this.scroll.isScrolledUp || this.news.hasNewMessages}
        label=${this.news.hasNewMessages ? 'New messages' : nothing}
        @click=${() => { this.news.dismiss(); this.scroll.scrollToBottom(); }}
      ></tct-chat-layout-scroll-button>`;
  }
}
```

- **Following**: locked by default. While locked, `scrollIfLocked()` (called on every content resize) springs to the
  bottom, or jumps in one frame under `prefers-reduced-motion`. The first fill positions instantly.
- **Letting go**: any scroll that lands above the last position the controller set or saw is the reader (wheel,
  touch, scrollbar, keyboard), so it unlocks at once. It locks again when a scroll settles within `lockThreshold`
  (10 px) of the bottom. `isScrolledUp` turns true beyond `buttonThreshold` (100 px).
- **Methods**: `scrollToBottom({behavior: 'spring' | 'instant'})`, `scrollToMessage(el)`, `scrollToLastMessage()`,
  `lock()`, `unlock()`, `scrollIfLocked()`.
- **New messages**: `hasNewMessages` turns true when a different last message appears while the view is not
  following; `dismiss()` clears it.
- Neither controller moves focus or announces anything.
