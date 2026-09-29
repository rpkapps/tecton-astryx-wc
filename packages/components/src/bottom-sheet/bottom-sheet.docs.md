---
title: Bottom Sheet
folder: bottom-sheet
category: Overlay
entries: [BottomSheet, BottomSheetSwitcher]
summary: A mobile touch sheet that rises from the bottom edge, with a grab handle, snap points, mobile-keyboard handling and purpose-controlled dismissal; a switcher shows one sheet at a time for multi-step flows.
examples: [basic, snap-points, heights, mobile-keyboard, no-scrim, form-purpose, switcher, rtl]
keywords: [bottom sheet, sheet, mobile, touch, drag, swipe, snap point, detent, resize, dismiss, grab handle, dialog, overlay, modal, form, mobile keyboard, visual viewport, switcher, multi-step]
dense:
  description: mobile touch sheet rising from the bottom edge (native dialog): grab handle, opt-in drag-to-resize snap points with keyboard and single-pointer alternatives, purpose-gated dismissal (info, form, required), swipe to dismiss, fully expanded tall sheets keyboard-aware, modal (default) or non-modal (no-scrim); a switcher shows one of several sheets in one shared dialog
  usage: A bottom sheet presents filters, actions, forms and detail views on touch devices. Standalone it owns a native dialog (open, label, height, snap-points, purpose, no-scrim); inside tct-bottom-sheet-switcher, given a sheet-id, it is one panel of the switcher's shared dialog (set active-sheet). A sheet with snap points has a resizable handle that is a slider (Arrow keys, Home, End, tap to cycle), so nothing needs a drag. Use tct-popover or tct-dialog on desktop; a component can adapt between them with AdaptivePresentationController.
  bestPractices:
    - {do: true, text: 'Use it for mobile-first surfaces (filters, share sheets, quick actions) that should rise from the bottom edge.'}
    - {do: true, text: 'Pick the height that fits the content: hug for short bounded content, capped for lists, tall for forms and streaming content.'}
    - {do: true, text: 'Use purpose="form" to protect entered data from scrim presses and swipes while keeping Escape; reserve purpose="required" for flows that must end through an explicit action.'}
    - {do: true, text: 'Give a no-scrim sheet a close control of your own: a press on the page does not close it.'}
    - {do: false, text: 'Make the content very long: break it into steps with tct-bottom-sheet-switcher.'}
    - {do: false, text: 'Rely on the drag alone: the handle is also a slider and a tap cycles the stops.'}
  properties:
    open: whether a standalone sheet is open; attribute and property writes never emit events
    label: accessible name of the sheet (required); on the switcher the name of the shared dialog (default the label of the showing sheet)
    height: hug, capped (default), tall, a number (px) or a CSS length
    snapPoints: extra resting heights, each a viewport fraction (0.5), a percentage or a px length; attribute snap-points takes them separated by spaces or commas
    purpose: implicit dismissal, info (default), form or required
    noScrim: opens non-modally with no scrim and an interactive page behind; attribute no-scrim
    finalFocus: id of the element that gets focus after it closes; attribute final-focus
    finalFocusElement: the element that gets focus after it closes
    sheetId: unique id inside a switcher; attribute sheet-id
    handleLabel: accessible name of the resize handle (default localized "Resize handle"); attribute handle-label
    show: opens without an intent event; resolves once the entry animation settled
    hide: closes without an intent event; resolves once hidden
    toggle: opens or closes (force picks the state) without an intent event
    requestClose: closes as the user would (cancelable tct-open-change)
    snapTo: moves to the stop at an index (0 is the tallest) without an event
    snapIndex: index of the resting stop
    snapCount: number of stops, 1 without snap points
    visibleHeight: visible height at the resting stop in px
    default: slot for the content of the scrolling area
    tct-open-change: Escape, a scrim press, a swipe or requestClose asks to close (open false, reason escape, outside, pointer or request); cancelable
    tct-after-open-change: an open or close settled after the animation; every actual change
    tct-snap-change: the user moved it to another stop (index, height, reason pointer or keyboard)
    activeSheet: sheet-id of the interactive sheet in a switcher; no attribute closes the flow; attribute active-sheet
related: [popover, dialog, alert-dialog, toast]
---

## Purpose

A bottom sheet is the touch device's answer to a popover or a dialog: a panel that rises from the bottom edge,
where a thumb can reach it, holding filters, quick actions, a short form or a detail view. It is a native
`<dialog>`, so a modal sheet gets the top layer, an inert page behind it, a scrim and focus containment from the
platform. Several sheets in one flow share one dialog through `tct-bottom-sheet-switcher`.

## When to use

- Filters, share and quick-action menus, pickers and short forms on a touch device.
- A detail view over a map or a list that the user may resize (`snap-points`).
- A multi-step flow of two or three short sheets (`tct-bottom-sheet-switcher`).

## Alternatives

- Anchored content on a pointer device: `tct-popover`.
- A centred decision or a form on desktop: `tct-dialog`.
- A destructive confirmation: `tct-alert-dialog`.
- Content that adapts by device: render a popover on a fine pointer and a bottom sheet on a compact touch device
  with the core `AdaptivePresentationController` (`(max-width: 768px) and (pointer: coarse)`).

## Anatomy

- The **sheet** (`part="sheet"`) is the painted panel, at most 640px wide and centred.
- The **handle** (`part="handle"`) floats at the top edge over the content: a 24px-tall drag region with a pill. With
  snap points it is a slider.
- The **body** (`part="body"`) is the scrolling area for your content (the default slot).
- A standalone sheet has a **dialog** (`part="dialog"`), a zero-height strip along the bottom edge whose backdrop is the
  **scrim**. Inside a switcher the switcher owns that dialog and the sheets are its panels.

## Variants and states

- `height`: `hug` fits the content up to 92% of the viewport, `capped` (default) is a scrolling panel of about 62%,
  `tall` is a pinned panel of about 92%; a number is px and anything else a CSS length.
- `snap-points`: extra resting heights the handle can move the sheet to, each the **visible** height: `0.5` (a fraction of
  the viewport), `50%` or `320px`. The sheet's own height is always the tallest stop; stops within 48px of another
  collapse into one. A stop of a quarter of the sheet or less is a **peek**: it thins the scrim (never clears it) and the
  sheet slides instead of giving up height.
- `purpose`: `info` (default) allows Escape, a scrim press and a swipe; `form` allows Escape only; `required` allows none
  and makes the sheet an `alertdialog`. Explicit controls of your own can always set `open`.
- `no-scrim`: opens the dialog non-modally: no scrim, the page stays interactive and scrollable, nothing is inert and focus
  is not taken (unless a child has `data-autofocus`).
- Dragging: a slow drag settles at the nearest stop in its direction, a fast flick down closes the sheet (when the purpose
  allows), a fast flick up expands it, and pulling up past fully open rubber-bands and springs back. On touch, a pull at
  the top or bottom edge of the scrolling body hands over to the sheet.
- A switcher: `active-sheet` shows one sheet; changing it enters the new sheet above the previous one, which moves down to
  meet it when the new sheet is shorter and fades when both motions are over.

## Responsive behaviour

The panel is as wide as the viewport up to 640px and is anchored to the bottom edge, inset by the device's safe area.
Heights are viewport fractions (`dvh`), so the sheet follows rotation and the collapsing browser chrome; snap points are
re-resolved against the new viewport without animating. Only a fully expanded `tall` sheet is keyboard-aware: it stays
put when the on-screen keyboard opens, the body ends with a spacer as tall as the keyboard, and the focused field is
scrolled above it.

## Form semantics

Not form-associated. A sheet with a form should use `purpose="form"` so a stray scrim press or swipe does not lose the
input, and `height="tall"` when a text field may open the mobile keyboard.

## Screen-reader expectations

- A modal sheet is a `dialog` (an `alertdialog` for `purpose="required"`) named by `label`, with `aria-modal`; the page
  behind is inert. Focus goes to the sheet (or to a child with `data-autofocus`) and back to the opener when it closes, or to
  `final-focus`.
- With snap points the handle is a vertical `slider` named "Resize handle" (localized), with `aria-valuemin`/`max`/`now`
  over the stops (higher is taller) and `aria-valuetext` the visible share of the viewport ("50%"). Without snap points the
  handle is decorative and hidden from assistive technology.
- Every drag has an alternative that needs no dragging (WCAG 2.5.7): Arrow Up and Page Up move to the next taller stop,
  Arrow Down and Page Down to the next shorter, End to the tallest, Home to the shortest, Enter and Space cycle, and a tap
  on the handle cycles. `tct-snap-change` reports each change.
- A body that scrolls and holds nothing focusable is a named tab stop so keyboard users can scroll it.
- Escape closes one layer per press: a popover or tooltip inside the sheet closes first.

## Localisation

The handle name is localized in all 30 shipped locales (`handle-label` overrides it) and its value is a percentage
formatted for the locale. Write `label` in the user's language. The sheet uses logical properties and the block-axis keys do
not mirror in right-to-left contexts.

## Consumer responsibilities

- Give every sheet a `label`: it has no heading to derive a name from.
- Close a sheet from your own controls by setting `open` to false (or `active-sheet` to nothing); `tct-open-change` only
  reports what the user asked for and you may `preventDefault()` it.
- Give a `no-scrim` sheet a close control of your own, and a sheet without snap points a visible way to close it on
  purpose `required`.
- In a switcher give every sheet a unique `sheet-id` and choose the next `active-sheet` yourself.
- Keep the content short; long content belongs in a multi-step flow.
