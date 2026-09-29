---
title: Chat Composer
folder: chat-composer
category: Chat
entries: [ChatComposer, ChatComposerInput, ChatComposerDrawer, ChatComposerTokenElement, ChatSendButton, ChatDictationButton]
summary: "The message-entry surface of a chat: a multi-line input with inline tokens, trigger menus, history and paste handling, a send/stop button, an attachments drawer and voice dictation."
examples: [basic, actions, mentions, paste, attachments-drawer, stop, dictation, rtl]
keywords: [chat, composer, input, message, prompt, textarea, send, stop, submit, token, chip, mention, "@", command, "/", autocomplete, suggestions, attachment, drawer, paste, dictation, voice, speech, microphone, ime, llm, ai]
dense:
  description: chat message-entry shell; multi-line contenteditable input w/ inline tokens, @ and / trigger menus, history, paste-as-token, file paste/drop; send/stop button; attachments drawer; feature-detected voice dictation
  usage: Use tct-chat-composer (it is complete on its own). Listen for tct-chat-submit (detail value; cancelable), tct-chat-stop and input. Set stop-shown while a reply streams. Slots - drawer, header-actions, header-context, input, footer-actions, send-actions, send-button. Configure @ / / menus on tct-chat-composer-input with the triggers property; dictation needs a ChatDictationController passed to tct-chat-dictation-button.
  bestPractices:
    - {do: true, text: 'Handle tct-chat-submit and clear nothing yourself: the composer clears the draft unless you call preventDefault().'}
    - {do: true, text: 'Set stop-shown while a response streams so the send button becomes Stop; the Stop action stays operable even when the composer is disabled.'}
    - {do: true, text: 'Reuse the same token definitions (value, label, variant) for the composer and for tct-chat-tokenized-text.'}
    - {do: true, text: 'Give icon-only buttons in the header and footer slots an accessible label; size them sm (header) or md (footer and send-actions).'}
    - {do: true, text: 'Put a tct-chat-composer inside tct-chat-layout (composer slot) for a full-page chat.'}
    - {do: false, text: 'Submit on Enter yourself with a keydown listener: an IME candidate confirmation would send half a word. Use tct-chat-submit.'}
    - {do: false, text: 'Put HTML or a render function that returns HTML in a token or a menu item: strings are text.'}
    - {do: false, text: 'Rely on dictation being available: it needs the Web Speech API (not in Firefox); the button hides itself where it is missing.'}
    - {do: false, text: 'Wrap the composer in a form and expect the draft to post: it is not a form control.'}
  properties:
    value: the draft (text as typed, tokens as their serialized value); the attribute is the initial draft; property writes never fire events
    placeholder: placeholder while the draft is empty; default "Type a message…" (localised)
    disabled: disables editing (the input stays a focus stop) and the send action; Stop stays operable
    stop-shown: shows Stop instead of Send; property stopShown
    density: compact, balanced or spacious spacing
    elevation: low (default, raised) or none (flat, bordered)
    status-type: error or warning strip; property statusType
    status-message: text of the status strip, announced once; property statusMessage
    status-position: top or bottom (default) side of the status strip; property statusPosition
    drawer: slot for a tct-chat-composer-drawer above the body
    header-actions: slot for icon-only size sm buttons at the header start
    header-context: slot for contextual information at the header end
    input: slot that replaces the default tct-chat-composer-input; also the native input event of the draft (retargeted), fired after every edit and never for property writes
    footer-actions: slot for size md actions at the footer start
    send-actions: slot for actions before the send button, for example a dictation button
    send-button: slot that replaces the default tct-chat-send-button
    tct-chat-submit: cancelable event with the trimmed draft in value; fired by Enter and the send button; the draft is cleared unless prevented
    tct-chat-stop: event fired when Stop is activated
    enterkeyhint: soft-keyboard Enter label of the input; default send
    max-rows: rows the input grows to before it scrolls; default 8
    debounce-ms: debounce of async trigger searches in ms; default 150
    no-history: turns off ArrowUp/ArrowDown recall of sent drafts
    label: accessible name of the input; default "Message input"
    triggers: property only; [{character, searchSource, onSelect, deserialize?, renderItem?, menuLabel?, emptySearchResultsText?, loadingText?}]
    pasteAsToken: property; a ChatPasteAsTokenController (threshold, toToken) or false
    no-paste-as-token: attribute form of pasteAsToken = false
    insertToken: method; inserts a token {value, label?, variant?, icon?} or {value, render} at the caret; returns its id
    expandToken: method; replaces the token with the given id by its text
    insertText: method; inserts plain text at the caret
    getValue: method; the serialized draft
    submit: method; submits the draft as Enter does
    focus: method; focuses the input keeping the caret
    setInterimText: method; shows ghost text at the end of the draft (dictation)
    clearInterimText: method; removes the ghost text
    tct-chat-paste: cancelable event before pasted text is inserted; detail text
    tct-chat-files: event when files are pasted or dropped; detail files and source (paste or drop)
    count: total item count of the drawer, shown in the collapsed badge; without it the drawer does not collapse
    collapsed: whether the drawer is collapsed; the attribute is the initial state
    default: slot with the drawer content
    collapsed-summary: slot replacing the collapsed badge and label
    tct-collapse-change: cancelable event before the user's toggle collapses or expands the drawer
    token: property; the token to show, {value, label?, variant?, icon?} or {value, render}
    variant: badge variant of a token
    icon: icon name of a token
    expandable: marks a pasted-text token that can expand back into text
    accessibleName: read-only name of the token chip
    tct-chat-token-expand: cancelable event when Expand is activated on an expandable token
    size: sm or md (default) for the send and dictation buttons
    send-icon: slot replacing the send arrow
    stop-icon: slot replacing the stop square
    tct-chat-send: cancelable event when the send state is activated; its default action submits
    click: native click of the send button
    dictation: property; a ChatDictationController (or anything with isSupported, isListening, volume, bands, toggle())
    show-unsupported: keeps the dictation button visible (disabled) where speech recognition is missing; default hides it
related: [chat-layout, chat-message, chat-message-list, chat-tokenized-text, icon-button, button, badge]
---

## Purpose

`tct-chat-composer` is where a chat message is written. On its own it is a complete composer: a growing
multi-line input and a send button in one raised, rounded surface. It arranges optional parts around them (a
drawer of attachments above, header actions and context, footer actions, the actions beside the send button and a
status strip) and owns the draft they share. `tct-chat-composer-input` is the editing surface: plain text with
inline tokens, suggestion menus at trigger characters, recall of earlier drafts, paste handling and file drops.
`tct-chat-send-button` sends, and turns into Stop while a reply streams; `tct-chat-dictation-button` starts voice
dictation; `tct-chat-composer-drawer` holds attachments; `tct-chat-composer-token-element` is one inline chip.

## When to use

- The message box of any conversation with a person or an assistant, alone or in a `tct-chat-layout`.
- Mentions, slash commands and other references that should read as one unit in the draft (tokens) and be sent as a
  short stored value.
- Prompts where long text is often pasted: the paste becomes a chip that can be previewed and expanded.

## Alternatives

- `tct-text-area` for a plain, form-associated multi-line field; it has no tokens, menus or send action.
- `tct-text-input` for one short line that is part of a form.
- A search or command field belongs in a typeahead, not in a composer.

## Anatomy

- **Composer** (`tct-chat-composer`, `part="base"`): the frame that holds the drawer, the body and the status strip.
  - **Drawer** (`slot="drawer"`): a `tct-chat-composer-drawer` tucked behind the body.
  - **Body** (`part="body"`): the raised or bordered surface.
    - **Header** (`part="header"`): `header-actions` at the start, `header-context` at the end.
    - **Input** (`slot="input"`, `part="input"`): a `tct-chat-composer-input` by default.
    - **Footer** (`part="footer"`): `footer-actions` at the start; `send-actions` and the send button at the end.
  - **Status** (`part="status"`): the error or warning strip.
- **Input** (`part="editable"`): a `textbox`, or a `combobox` while triggers are configured, with a `placeholder`
  part and the `trigger-menu` popup.
- **Token** (`tct-chat-composer-token-element`): a badge chip (`part="chip"`), with a preview card for pasted text.
- **Send button** and **dictation button**: icon buttons; the dictation button shows a live equalizer while listening.

## Variants and states

`density` (`compact`, `balanced`, `spacious`) steps the padding; `elevation` is `low` (raised, the default) or
`none` (flat with a border). While the editor has keyboard focus the whole body draws the focus ring; pointer focus
draws none. `disabled` dims the body and blocks editing, but the input stays a focus stop so focus is not lost when
a send disables the composer while a reply streams. `stop-shown` turns Send into Stop, which stays enabled.
`status-type` shows a warning or error strip above or below the body. A send button is disabled while there is
nothing to send. The drawer collapses when it has a `count`. The dictation button is idle, listening (with an
equalizer that turns toward the error colour as the voice clips) or, where speech recognition is missing, hidden or
disabled.

## Responsive behaviour

The composer fills the width it is given and the input grows one row at a time up to `max-rows` before it scrolls.
Long words and pasted lines wrap. On iOS WebKit with a coarse pointer the text is raised to 16px so the page does
not zoom on focus. Everything is laid out with logical properties, so the send button is at the left in a
right-to-left page and text, tokens and the placeholder start at the right.

## Form semantics

Not applicable as a form control: the composer is not form-associated, and the draft is sent as a `tct-chat-submit`
event, not posted with a form. Read `composer.value` (or the event's `value`) to send it yourself; put a hidden
input in a form if the draft has to post.

## Screen-reader expectations

- The input is a multi-line `textbox` named "Message input" (or your `label`); with triggers it is a `combobox`
  with `aria-expanded`, `aria-controls` and `aria-activedescendant` for the highlighted suggestion, and the popup is
  a named `listbox` of options.
- A token is read as one unit where it sits in the draft: a badge chip is an image named by its label (else its
  value), and a pasted-text chip by how many lines and characters it holds. Backspace or Delete next to a token
  removes it whole. To expand a pasted-text chip with the keyboard, select it (Shift+Arrow) and press Enter; the
  hover card is only a pointer convenience.
- Enter never sends while an input method editor is composing text (Japanese, Chinese, Korean): the Enter that
  confirms a candidate belongs to the IME. Shift+Enter inserts a new line. The soft keyboard's Enter key is
  labelled "send" (`enterkeyhint`).
- A status message is announced once when it appears or changes (assertively for an error) through the shared
  announcer, never through a live region that would repeat it.
- The send button is named "Send", and "Stop" while a reply streams; the dictation button is named "Start dictation"
  or "Stop dictation". The equalizer is decoration. Dictated text reaches the draft through the input, so it is read
  as typed text. The ghost text of the phrase being spoken is hidden from assistive technology.
- The drawer toggle is a button named "Collapse Attachments" or "Expand Attachments" (from its `label`) with
  `aria-expanded`; collapsed content is removed from the tab order and the accessibility tree.

## Localisation

The default input label and placeholder, the trigger menu's "Searching…" and "No results", the token chip counts
("2 lines, 111 chars"), the send, stop and dictation names and the drawer's toggle are localised (the 30 shipped
catalogs, following the page's `lang` or a provider). Everything you pass in is yours to translate: the `label`,
`placeholder`, menu labels, token labels and the status message. The composer, its parts and its slots mirror in
right-to-left, and input-method composition is supported.

## Consumer responsibilities

- Handle `tct-chat-submit`, and `tct-chat-stop` if you show Stop. To keep the draft (validation failed), call
  `preventDefault()` on `tct-chat-submit`.
- Store what you send: `value` carries each token as its serialized value (`@a-12`); show it later with
  `tct-chat-tokenized-text` and the same token definitions.
- Give every icon-only button in the slots an accessible `label`, and size them `sm` (header) or `md` (footer and
  send actions).
- Provide unique, non-empty serialized values for tokens, and text (never HTML) for labels and menu items.
- Search sources must return items with a unique `id` and a `label`; make an asynchronous `search` cancelable.
- Treat dictation as an enhancement: create one `ChatDictationController` per composer, pass it to the dictation
  button and expect no button where the browser has no speech recognition. Nothing is recorded or sent by the
  component; the browser handles the microphone permission and the speech service.
- Files pasted or dropped into the input are reported with `tct-chat-files`; uploading and showing them (in the
  drawer) is yours.
