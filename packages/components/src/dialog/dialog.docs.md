---
title: Dialog
folder: dialog
category: Overlay
entries: [Dialog, DialogHeader]
summary: A modal dialog on the native dialog element, with dismissal purposes, nested layers, focus return and an imperative API.
examples: [basic, invokers, purposes, nested, variants-and-position, composed-header]
keywords: [dialog, modal, popup, overlay, lightbox, alert, confirm, prompt, backdrop, focus trap, imperative, header, alertdialog]
dense:
  description: modal overlay on native dialog that blocks page interaction until the user responds; purposes, nesting, focus return, openDialog()
  usage: Displays a modal that blocks the page. Use it for delete confirmations, edit forms and terms acceptance. Give it a heading (or compose tct-dialog-header), open it with the open attribute, show(), a native button with commandfor and command="--show", or openDialog() without markup. Listen to tct-open-change to veto or handle a close request.
  bestPractices:
    - {do: true, text: 'Choose the right purpose: info for dismissable content, form to prevent accidental backdrop dismissal, required when the user must respond.'}
    - {do: true, text: 'Include a clear heading so users immediately understand what the dialog asks.'}
    - {do: true, text: 'Use purpose="form" for dialogs with inputs so a click on the backdrop cannot lose data.'}
    - {do: true, text: 'Keep dialogs focused on a single task; consider a full page when content grows.'}
    - {do: false, text: 'Use a dialog for simple messages that could be inline or a toast.'}
    - {do: false, text: 'Nest dialogs to build a flow; restructure it into steps in one dialog (nesting works, one Escape per layer, but it is a last resort).'}
    - {do: false, text: 'Use the fullscreen variant for simple confirmations; it is for editors and long forms.'}
    - {do: false, text: 'Use the inline attribute in an application; it is for documentation previews.'}
  properties:
    open: whether the dialog is open; the attribute opens it initially; writing it never emits an event
    inline: renders the content in place without a dialog, backdrop or modal behaviour; previews only
    width: width of a standard dialog; a number is px, a string a CSS length; default 400, clamped to the viewport
    maxHeight: maximum height of a standard dialog; default 75dvh
    max-height: attribute of maxHeight
    position: object {top, bottom, start, end} that places a standard dialog; start and end mirror in RTL; property only
    variant: standard or fullscreen
    purpose: what may dismiss it (required nothing, form Escape only, info Escape and the backdrop); default info
    padding: content padding as a spacing step (0, 0.5, 1, 1.5, 2, 3, 4, 5, 6, 8, 10)
    heading: title; shorthand for a tct-dialog-header; names the dialog and takes focus on open
    subtitle: text under the heading
    noCloseButton: hides the close button of the heading shorthand
    no-close-button: attribute of noCloseButton
    isOpen: read-only, whether the dialog is on the layer stack now
    show: method, opens it programmatically (no tct-open-change)
    hide: method, closes it programmatically (no tct-open-change)
    toggle: method, opens or closes it programmatically
    requestClose: method, asks to close like the user does (cancelable tct-open-change)
    tct-open-change: cancelable intent event with open and reason (escape, outside, close-button, close-watcher, request, trigger); preventDefault keeps the dialog as it is
    tct-after-open-change: event after the entry or exit animation settled; detail open
    default: slot for the content
    "slot:heading": your own heading element instead of the heading text
    title: slot of tct-dialog-header for your own heading element
    start: slot of tct-dialog-header for content before the title
    end: slot of tct-dialog-header for content after the title
    closeLabel: accessible name and tooltip of the close button; defaults to a localised Close
    close-label: attribute of closeLabel
    endContentEdgeCompensation: which edges of the end content are pulled in to align with the title (inline, block, all)
    end-content-edge-compensation: attribute of endContentEdgeCompensation
    hasDivider: draws a rule under the header; default off
    has-divider: attribute of hasDivider
    headingElement: read-only, the heading element that names the dialog
---

## Purpose

`tct-dialog` is a modal: it blocks the page until the user answers. It uses the native `<dialog>` with
`showModal()`, so the browser supplies the top layer, the inert page behind it, the backdrop, and the
right focus behaviour, with no portal, z-index or focus-trap code. The heading names the dialog and
receives focus when it opens (it is not a tab stop); when the dialog closes, focus returns to the
element that opened it.

`tct-dialog-header` is the title row: heading, subtitle, start and end content and the close button.

## When to use

- A decision the user must make before going on: delete confirmations, unsaved changes.
- A short form that should not lose its context: rename, invite, edit details.
- Terms or notices that must be acknowledged (`purpose="required"`).

## Alternatives

- Inline content, a banner or a toast for messages that do not need an answer.
- A full page for long flows.
- A popover for small, non-modal choices anchored to a control.

## Anatomy

The `<dialog>` surface (part `dialog`) holds a content box (part `content`) with the header (the
`heading` shorthand, or your own `tct-dialog-header`) followed by your content. The header has a start
area, a title block (heading and subtitle), and an end area with your end content and the close button.

## Variants and states

- `variant` `standard` (centred, `width` and `max-height`, optional `position`) or `fullscreen`.
- `purpose`: `info` (Escape and the backdrop close it), `form` (Escape only, so a stray click cannot lose
  input), `required` (nothing does, it is an `alertdialog`, and it has no close button).
- `padding` as a step of the spacing scale, or `--dialog-padding`.
- Closing asks first: the close button, Escape, the backdrop and `requestClose()` fire a cancelable
  `tct-open-change` with a `reason`; `preventDefault()` keeps it open. `tct-after-open-change` follows
  once the animation ended. Setting `open`, `show()` or `hide()` never asks.
- Nested dialogs close one per Escape press, innermost first; a tooltip closes before the dialog around it.
- `open` can also be driven by a native button with `commandfor` and `command="--show"`, `--hide` or
  `--toggle`, and `openDialog()` opens one without markup.

## Responsive behaviour

A standard dialog keeps its width but never exceeds the viewport minus a gutter; taller content scrolls
inside it. Page scroll is locked while a modal is open, without the page shifting. Fullscreen fills the
viewport and keeps content clear of device cut-outs.

## Form semantics

Not a form control. A `<form method="dialog">` in the content closes the dialog when submitted (a
user-equivalent request, so `tct-open-change` fires), and form controls inside submit with their own
form as usual.

## Screen-reader expectations

- The `<dialog>` has role `dialog` (`alertdialog` for `purpose="required"`), `aria-modal`, and is named
  by the heading. An `aria-label` or `aria-labelledby` on the host wins; a dialog without any name warns
  once in development.
- The heading takes focus on open, so the user hears where they are; an element of yours with `autofocus`
  wins.
- The close button is named "Close" (localised) and has a tooltip.
- The page behind is inert; toast-like announcements are still spoken, because the announcer moves its
  live regions into the open modal.

## Localisation

The close button's name comes from the locale catalogs and follows the page language or the nearest
`lang`; `close-label` overrides it. Start and end offsets and the header mirror in right-to-left.

## Consumer responsibilities

- Give every dialog a name: a `heading`, a header, or an `aria-label`.
- Decide the `purpose`; do not rely on the default `info` for a form.
- Handle `tct-open-change` if closing must be confirmed, and set `open` yourself after `preventDefault()`.
- Opening from script: call `show()` from a user action so focus can return to it. Without markup,
  `openDialog(content, options)` from `@tecton-astryx/components/dialog/dialog.api.js` returns a handle
  (`element`, `isOpen`, `hide()`, `closed`) and removes the dialog when it has closed.
