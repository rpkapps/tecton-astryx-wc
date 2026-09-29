---
title: Hover Card
folder: hover-card
category: Overlay
entries: [HoverCard]
summary: A richer, larger overlay shown when the user hovers or focuses a trigger, for previews, profile cards and inline definitions.
examples: [basic, text-trigger, placements, focus-and-touch, default-open, rtl]
keywords: [hovercard, hover card, popover, tooltip, preview card, flyout, overlay, hover popup]
dense:
  description: hover/focus-triggered overlay for rich content anchored to a trigger; default slot is the trigger (element or text), slot="content" is the card
  usage: HoverCard shows additional info on hover or keyboard focus of a trigger. Use it for profile cards, link summaries and inline definitions. The card stays open while the pointer or focus is inside it. Put the trigger in the default slot and the card in slot="content". Prefer tct-tooltip for a single line of helper text and tct-popover for content the user must interact with.
  bestPractices:
    - {do: true, text: 'Keep content supplementary; a hover card should enhance understanding without blocking the primary workflow.'}
    - {do: true, text: 'Give text triggers the dashed underline (the default) so users know they are hoverable.'}
    - {do: true, text: 'Leave touch-trigger on auto so a tap opens the card on triggers that do nothing else and stays out of the way on triggers that act.'}
    - {do: true, text: 'Set `label` when the card is interactive or substantial: it becomes a named dialog and the trigger advertises it.'}
    - {do: false, text: 'Place critical actions or required information in a hover card; content that appears on hover can be missed.'}
    - {do: false, text: 'Use a hover card when a simple tooltip or popover would do.'}
    - {do: false, text: 'Use it for content the user must interact with; it disappears when the pointer and focus leave.'}
  properties:
    open: whether the card is open; reflects; also the default-open state; property and attribute writes never emit events
    placement: side of the trigger (above, below, start, end); start/end are logical
    alignment: alignment along the placement axis (start, center, end)
    delay: show delay in ms (default 300)
    hideDelay: hide delay in ms (default 200); attribute hide-delay
    focusTrigger: when keyboard focus opens the card (auto = only focusable triggers, always, never); attribute focus-trigger
    touchTrigger: what a tap does (auto = opens unless the trigger acts, tap = always opens, none); attribute touch-trigger
    disabled: disables the hover and focus triggers
    label: accessible name; with it the card is a role=dialog, without it a role=group
    hoverIndication: dashed underline on the trigger (auto = text triggers, always, never); attribute hover-indication
    show: opens without an intent event, bypassing the delay
    hide: closes without an intent event
    toggle: opens or closes (force picks the state) without an intent event
    requestClose: closes as the user would (cancelable tct-open-change)
    default: slot for the trigger (an element or plain text)
    content: slot for the card content
    tct-open-change: cancelable intent event before hover, focus, tap, Escape or an outside press changes the state (open, reason)
    tct-after-open-change: an open or close settled (open); every actual change
related: [tooltip, popover, avatar, link]
---

## Purpose

`tct-hover-card` shows supporting detail about something, a person, a link target, a term, without a
click and without leaving the page. It opens after a short delay on hover, at once on keyboard focus, and
on a tap where there is no hover. It stays open while the pointer or focus is inside it, so its content
can be read, selected and, when needed, operated.

## When to use

- Profile or entity previews on an avatar, a mention or a name.
- A summary of a link's destination.
- An inline definition of a term in running text.

## Alternatives

- One line of helper text or an icon-button name: `tct-tooltip`.
- Content the user must act on, opened by a click: `tct-popover`.
- Information the user must not miss: put it on the page, not in a hover card.

## Anatomy

- The **trigger** is the default slot: an element (button, link, avatar) that keeps its own box, or plain
  text, which becomes an inline, focusable, dashed-underlined trigger (part `trigger`).
- The **card** (part `hover-card`) is a top-layer surface anchored to the trigger, with a border on the
  recessed Tecton popover fill and no drop shadow. It holds the `content` slot.

## Variants and states

- `placement` (`above` default, `below`, `start`, `end`) and `alignment` (`center` default, `start`, `end`)
  are logical and mirror in RTL. The browser flips the card when it does not fit.
- `delay` (300 ms) and `hide-delay` (200 ms) tune the timing. The card is hoverable: moving the pointer
  onto it cancels the hide.
- `focus-trigger`: `auto` opens on keyboard focus only for focusable triggers, `always` for any trigger,
  `never` for composite widgets that manage focus themselves. Focus from a tap or a dialog's autofocus
  never opens it.
- `touch-trigger`: `auto`, `tap`, `none`. A tap-opened card closes on a tap outside it or a second tap of
  the trigger.
- `open` (reflects, `:state(open)`) is also the default-open state. `disabled` turns the triggers off.
- `hover-indication`: `auto` underlines text triggers only, `always`, `never`.

## Responsive behaviour

The card is clamped to the viewport with a gutter and scrolls inside when it must. On touch devices with
no hover it opens on tap (see `touch-trigger`); for touch-first flows that need interaction, use a popover
or a bottom sheet.

## Form semantics

Not applicable. `tct-hover-card` is not a form control.

## Screen-reader expectations

- With `label` the card is a named `dialog`. The trigger exposes `aria-haspopup="dialog"` and, when its
  role allows it (buttons, links, role=button and similar), `aria-expanded`. A trigger that does not
  support `aria-expanded` (a plain span, a role-less text trigger) gets none.
- Without `label` the card is a `group`. A text trigger is described by it (`aria-describedby`); an
  element trigger receives a copy of the card's text as `aria-description`, because an ID reference cannot
  cross into the card's shadow root. Your own `aria-describedby` on the trigger is kept.
- Keyboard focus on a focusable trigger opens the card. Tab moves into interactive card content and keeps
  it open; leaving the card closes it. Escape closes the top-most layer only and returns focus to the
  trigger when it was inside the card, without reopening.
- Attributes you put on the trigger (`aria-haspopup`, `aria-controls`, `aria-expanded`) are merged or
  preserved and restored when the trigger changes.

## Localisation

No built-in strings. Write `label` and the card content in the user's language. Placement mirrors in RTL.

## Consumer responsibilities

- Do not hide essential information or the only way to perform an action inside a hover card.
- Provide a trigger that is reachable by keyboard (a native control, a link, or a text trigger).
- Name interactive cards with `label`.
- Listen for `tct-open-change` and call `preventDefault()` to veto a user-driven change.
