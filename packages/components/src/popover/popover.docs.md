---
title: Popover
folder: popover
category: Overlay
entries: [Popover]
summary: A click-triggered surface for interactive content, anchored to a trigger, with dialog semantics, contained focus and light dismiss.
examples: [basic, placements, sibling-anchor, explicit-dismiss, neutral-menu, scrolling, controlled, rtl]
keywords: [popover, popup, dropdown, tooltip, overlay, flyout, callout, popper, anchor, floating, bubble]
dense:
  description: click-triggered popover for interactive content anchored to a trigger; button + dialog ARIA pattern, focus contained, Escape and outside press dismiss
  usage: A click-triggered overlay anchored to a button or trigger element. Use it for secondary actions, inline confirmations, or supplementary information that does not warrant a full dialog. Put the trigger button in the default slot and the content in slot="content". For hover previews use tct-hover-card, for brief helper text use tct-tooltip.
  bestPractices:
    - {do: true, text: 'Keep popover content focused on a single task or piece of information.'}
    - {do: true, text: 'Provide a clear way to close: clicking outside, Escape, or an explicit control inside the content.'}
    - {do: true, text: 'Give the dialog an accessible name with `label`, or set popup-role="none" when slotted menu or listbox content owns its role.'}
    - {do: true, text: 'Style the painted surface through ::part(popover); the trigger and content are yours.'}
    - {do: false, text: 'Nest popovers inside other popovers; it creates confusing focus and navigation.'}
    - {do: false, text: 'Assume input complexity alone decides the presentation; weigh the task focus, space and interaction needs.'}
    - {do: false, text: 'Assume scrolling alone means Popover is the wrong component; a bounded popover may scroll.'}
  properties:
    open: whether the popover is open; reflects; property and attribute writes never emit events
    placement: side of the trigger (above, below, start, end); start/end are logical
    alignment: alignment along the placement axis (start, center, end)
    disabled: trigger interactions are ignored
    width: surface width; a bare number is px, otherwise a CSS length; default auto (at least the trigger width)
    label: accessible name of the dialog surface
    popupRole: dialog (default) or none when slotted content owns its role (attribute popup-role)
    nonModal: drops aria-modal from the dialog (attribute non-modal)
    noCloseButton: removes the fallback close button (attribute no-close-button)
    closeLabel: label of the fallback close button (attribute close-label); default localized "Close popover"
    noAutoFocus: do not move focus into the popover on open (attribute no-auto-focus)
    noLightDismiss: outside presses do not dismiss (attribute no-light-dismiss)
    noEscapeDismiss: Escape does not dismiss and falls through to the layer below (attribute no-escape-dismiss)
    anchor: id of an element in the same tree to anchor to instead of wrapping a trigger
    anchorElement: element to anchor to instead of wrapping a trigger; wins over anchor
    show: opens without an intent event; resolves once settled
    hide: closes without an intent event; resolves once hidden
    toggle: opens or closes (force picks the state) without an intent event
    requestClose: closes as the user would (cancelable tct-open-change)
    default: slot for the trigger button
    content: slot for the surface content
    tct-open-change: cancelable intent event before a user-driven open or close (open, reason)
    tct-after-open-change: an open or close settled (open); every actual change
related: [hover-card, tooltip, dialog, bottom-sheet, dropdown-menu]
---

## Purpose

`tct-popover` shows interactive content in a floating surface anchored to a trigger, and dismisses it
without a page change. It implements the button plus dialog pattern: the trigger announces that it opens
a dialog and whether it is open, the surface is a labelled `role="dialog"`, focus moves into it and stays
inside while it is open, and closing returns focus to the trigger.

## When to use

- Secondary actions, inline confirmations or small forms that do not warrant a full dialog.
- Supplementary information the user must be able to interact with (links, controls, a filter form).
- A custom popup for a control that renders its own list or menu (`popup-role="none"`).

## Alternatives

- Hover or focus previews: `tct-hover-card`. Brief helper text: `tct-tooltip`.
- A task that needs the user's full attention, or content that must block the page: `tct-dialog`.
- A menu of actions: `tct-dropdown-menu`.
- On touch devices, content that needs the room: `tct-bottom-sheet`.

## Anatomy

- The default slot holds the **trigger**, a button, a `role="button"` element, or a library element that
  renders one. It sits in a stable inline wrapper (part `anchor`) that is the positioning anchor, so a
  pressed-state transform on the trigger never moves the surface.
- The **surface** (part `popover`) is a `role="dialog"` inside a top-layer `popover="manual"` layer. It
  paints the border and the recessed Tecton popover fill, with no drop shadow.
- The `content` slot holds what the surface shows.
- A **fallback close button** (part `close-button`) at the end of the focus order. It is visually hidden
  and appears below the surface when keyboard focus reaches it.

## Variants and states

- `placement` (`above`, `below`, `start`, `end`) and `alignment` (`start`, `center`, `end`) are logical: in
  right-to-left contexts `start` and `end` mirror. The browser flips the surface when it does not fit.
- `width` fixes the surface width; without it the surface is at least as wide as the trigger. The surface
  never exceeds the viewport minus a gutter, and scrolls internally only when its content does not fit.
- `open` reflects, and `:state(open)` matches while it is open.
- `disabled` ignores the trigger. `non-modal` drops `aria-modal`. `popup-role="none"` removes the dialog
  role for menu or listbox content.
- Dismissal is configurable: `no-light-dismiss` ignores outside presses, `no-escape-dismiss` ignores
  Escape. Set both for a surface that stays until explicitly closed, such as a coachmark.

## Responsive behaviour

The surface is clamped to the viewport with a 16px gutter and scrolls inside when it must. It follows the
trigger when the page scrolls or resizes. For narrow, touch-first layouts consider `tct-bottom-sheet`,
which the adaptive presentation policy can pick for you.

## Form semantics

Not applicable. `tct-popover` is not a form control. A form placed in the content submits like any other
form; its controls are in the light DOM.

## Screen-reader expectations

- The trigger exposes `aria-haspopup="dialog"` (`true` with `popup-role="none"`) and `aria-expanded`.
- The surface is a `dialog` named by `label` (`aria-modal="true"` unless `non-modal`). A dialog with no
  name is reported in development.
- The trigger carries no `aria-controls`: the surface lives in the popover's shadow root and an ID
  reference cannot cross that boundary.
- Initial focus goes to the first control in the content, or to the surface itself when there is none.
  The generated close button is never the initial target.
- Escape closes the top-most layer only, and focus returns to the trigger unless the user moved it.

## Localisation

The close button label is localized ("Close popover") in all 30 shipped
locales; `close-label` overrides it. Write `label` in the user's language. Placement mirrors in
right-to-left contexts.

## Consumer responsibilities

- Provide a trigger that is, or contains, a button, and give the dialog a `label`.
- Keep the content focused; do not open another popover from inside it.
- Do not put `tabindex` or `aria-*` for the popup on the trigger yourself: the element manages them.
- Listen for `tct-open-change` and call `preventDefault()` to veto a user-driven change; set `open` to
  drive it yourself.
