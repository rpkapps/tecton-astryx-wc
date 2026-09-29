---
title: Toast
folder: toast
category: Overlay
entries: [Toast, LayerProvider]
summary: Brief, non-blocking notifications raised with toast(), stacked in a top-layer viewport hosted by tct-layer-provider.
examples: [basic, with-action, unique-id, custom-content, provider, standalone, rtl]
keywords: [toast, notification, snackbar, alert, message, feedback, status, layer provider]
dense:
  description: transient status notification (info or error) raised imperatively with toast(); stacked in a top-layer viewport; auto-hide with pause, close button, swipe dismiss
  usage: Toast shows a brief, non-blocking notification to confirm an action or present temporary information. Call toast({body, type, endContent, uniqueId}) from @tecton-astryx/components/toast/toast.api.js; it returns a dismiss function. Wrap the app in tct-layer-provider to set position, max visible and inset; without it a fallback viewport is created on document.body.
  bestPractices:
    - {do: true, text: 'Use toasts to confirm an action or report a result that needs no decision.'}
    - {do: true, text: 'Keep the message short. Error toasts persist until dismissed; give info toasts with actions a longer duration.'}
    - {do: true, text: 'Put a short action (Undo, View) in endContent instead of asking for a decision the user can lose.'}
    - {do: true, text: 'Use uniqueId so repeated events replace one toast instead of stacking.'}
    - {do: false, text: 'Use a toast for information the user must not miss or must act on; use an inline message or a dialog.'}
    - {do: false, text: 'Rely on the swipe gesture: the close button is always there, and auto-hiding content must satisfy WCAG 2.2.1 (timing).'}
  properties:
    type: colour and urgency (info default, error); error is announced assertively and persists by default
    autoHideDuration: ms before it dismisses itself, 0 keeps it until dismissed; default 5000 for info, 0 for error; attribute auto-hide-duration
    exiting: the toast is on its way out (set by dismiss)
    swipeEdge: block edge a swipe dismisses towards (end default, start for top stacks); attribute swipe-edge
    dismissLabel: label of the close button (default localized "Dismiss notification"); attribute dismiss-label
    renderContent: replaces the card layout; the renderer owns every control
    autoHide: whether it dismisses itself (resolved from type and autoHideDuration)
    dismiss: dismisses it (cancelable tct-toast-dismiss, then tct-toast-hide, once)
    default: slot for the message
    end: slot for trailing content such as an action
    tct-toast-dismiss: the toast wants to go (reason auto or manual); cancelable
    tct-toast-hide: the toast started to hide; once per toast
    toastPosition: position of the toast stack on tct-layer-provider (bottom-end default); attribute toast-position
    toastMaxVisible: maximum visible toasts (default 5); attribute toast-max-visible
    toastInset: inset of the stack from the screen edges in px
    toast: the whole toast configuration as one object
    viewport: the toast viewport this provider hosts
    nested: whether this provider sits inside another (then it does nothing)
related: [popover, dialog, alert-dialog, banner]
---

## Purpose

A toast is a short message that appears, is read, and goes away, without taking the user's place or
asking for anything. `toast()` raises one from anywhere in your code, and `tct-layer-provider` decides where
the stack lives. The toasts are stacked in the top layer, so they sit above the page and above popovers, and
they stay usable when a modal dialog is open.

## When to use

- Confirming that something happened: saved, copied, sent, deleted (with Undo).
- Reporting a result that is not part of the current task's flow.
- Background outcomes: an export finished, a sync failed.

## Alternatives

- A message that belongs next to its subject (a field, a section): an inline message or `tct-banner`.
- A choice or a confirmation the user must make: `tct-alert-dialog` or `tct-dialog`.
- Content the user asked for and can interact with: `tct-popover`.

## Anatomy

- `toast(options)` adds a toast to the **viewport**: an internal top-layer container that holds up to
  five visible toasts (`toast-max-visible`), the newest nearest the screen edge, eight pixels apart.
- The **toast** (`tct-toast`, part `toast`) is an inverted card: the message (default slot), optional trailing
  content (`end` slot) and a close button (part `dismiss-button`). `renderContent` replaces that layout.
- `tct-layer-provider` hosts the viewport and carries its configuration. It has no shadow root and no box, and
  is optional: without one, a viewport is created on `document.body` on first use (a development warning says so).
  A provider inside another provider does nothing.
- Options of `toast()`: `body`, `type`, `autoHide`, `autoHideDuration`, `endContent`, `renderContent`,
  `uniqueId`, `collisionBehavior`, `onHide`. `body` and `endContent` take text, a DOM node or a Lit template;
  a string is always text, never HTML. `toast(options, {from})` scopes the toast to the provider around an element.

## Variants and states

- `type`: `info` (default) hides itself after `auto-hide-duration` (5 s); `error` stays until dismissed and is
  announced assertively. `autoHide: false` or `auto-hide-duration="0"` keeps any toast; an explicit duration
  makes an error toast hide too.
- The timer pauses while the pointer or focus is on the toast and while the window is blurred, and never
  resumes with less than a second left.
- `uniqueId` de-duplicates: a new toast replaces the showing one in place (`overwrite`, default) or is dropped
  (`collisionBehavior: 'ignore'`).
- Positions: `bottom-end` (default), `bottom-start`, `top-end`, `top-start`; `start` and `end` are logical.
  A dismissed toast collapses before it is removed.
- A `tct-toast` can sit in markup on its own: it fires the cancelable `tct-toast-dismiss`, then `tct-toast-hide`
  and the `exiting` state, and never removes itself.

## Responsive behaviour

The toast is at most 400px wide and never wider than the viewport minus the safe-area gutters (16px, or the
device inset if larger); `toast-inset` moves the stack from the edges. On touch devices a toast can be swiped
towards its edge to dismiss it.

## Form semantics

Not applicable.

## Screen-reader expectations

- The viewport speaks each new toast once through the shared announcer (politely; assertively for `error`). The
  toast itself is a `status` (`alert` for errors) and deliberately not a live region, so nothing is read twice.
- While at least one toast is showing, the viewport is a `region` named "Notifications" (localized); an empty
  viewport is not a landmark.
- F6 moves focus into the newest toast (first its action, then the close button). Dismissing a focused toast
  moves focus to a remaining toast, or back to where it was; never to the page body.
- The close button is always there and is at least 24 by 24 CSS px: swiping is only a shortcut (WCAG 2.5.7).
- Auto-hiding content must satisfy WCAG 2.2.1: pause on hover and focus is built in; give toasts with
  actions or long messages a longer `autoHideDuration`, or keep them.

## Localisation

The close button ("Dismiss notification") and the region name ("Notifications") are localized in all 30
shipped locales; `dismiss-label` overrides the first. Write the message in the user's language. Positions
mirror in right-to-left contexts.

## Consumer responsibilities

- Do not put essential information or the only route to an action in a toast that hides itself.
- Style trailing actions yourself (a `tct-button` in `endContent`, with its colours inverted for the card).
- Wrap the application in `tct-layer-provider` when you need a position other than the default, or when the app
  lives inside a theme island whose tokens the toasts should inherit.
- Keep messages short; a toast is not the place for detail.
