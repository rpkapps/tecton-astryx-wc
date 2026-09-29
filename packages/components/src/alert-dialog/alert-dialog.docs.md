---
title: Alert Dialog
folder: alert-dialog
category: Overlay
entries: [AlertDialog]
summary: A modal confirmation dialog for destructive or irreversible actions, with Cancel as the initial focus and no backdrop dismissal.
examples: [basic, loading, imperative, custom-labels, inline, rtl]
keywords: [alert dialog, alertdialog, confirm, confirmation, destructive, delete, modal, dialog, imperative, discard]
dense:
  description: modal confirmation for destructive or irreversible actions (delete, revoke access, discard changes); alertdialog role, title and consequence, Cancel first and focused, no dismissal by a backdrop press, Escape cancels
  usage: AlertDialog asks the user to confirm a destructive or irreversible action before it happens. It implements the WAI-ARIA alert dialog pattern; Escape and Cancel ask to close it (cancelable tct-open-change), the action button raises tct-action and the dialog stays open until you close it. At 640px and below the destructive action is above Cancel and both fill the width. Without markup use openAlertDialog() from @tecton-wc/components/alert-dialog/alert-dialog.api.js.
  bestPractices:
    - {do: true, text: 'Make the action label specific: "Delete project", not "OK" or "Confirm".'}
    - {do: true, text: 'Say in the description what will happen, so the user knows the consequence before confirming.'}
    - {do: true, text: 'Keep Cancel as the initial focus; on narrow screens the destructive action is above it but Cancel is still focused first.'}
    - {do: true, text: 'Hold the dialog open with action-loading while the work runs and close it when the work settles.'}
    - {do: false, text: 'Use it for non-destructive questions; use a standard dialog.'}
    - {do: false, text: 'Rely on colour alone to signal danger: the label itself must say what will happen.'}
    - {do: false, text: 'Close the dialog from the action handler before the work has finished.'}
  properties:
    open: whether the dialog is open; attribute and property writes never emit events
    inline: renders the content in the page without the modal behaviour, as a named group (documentation previews)
    heading: the question, rendered as a level-2 heading that names the dialog
    description: what will happen if the user confirms; describes the dialog
    cancelLabel: label of the Cancel button (default localized "Cancel"); attribute cancel-label
    actionLabel: label of the action button; attribute action-label
    actionVariant: button variant of the action (destructive default); attribute action-variant
    actionLoading: shows the spinner on the action button and blocks it; attribute action-loading
    width: preferred width, a number is px (default 400), clamped to the viewport
    show: opens without an intent event; resolves once the entry animation settled
    hide: closes without an intent event; resolves once hidden
    toggle: opens or closes (force picks the state) without an intent event
    requestClose: closes as the user would (cancelable tct-open-change)
    default: slot for optional extra content under the description
    tct-open-change: Escape or Cancel asks to close (open false, reason escape or close-button); cancelable
    tct-after-open-change: an open or close settled after the animation; every actual change
    tct-action: the user activated the action button; the dialog stays open
related: [dialog, popover, toast, banner]
---

## Purpose

An alert dialog interrupts the user to confirm something they cannot easily take back: deleting content,
revoking access, discarding unsaved changes. It says what is being asked (the heading) and what will happen
(the description), and offers two choices: back out, or go ahead. It is a modal on the native `<dialog>`:
the page behind it is inert, focus stays inside, and it cannot be dismissed by a press on the backdrop.

## When to use

- Deleting, removing or revoking something that cannot be undone.
- Discarding work that has not been saved.
- Any action whose consequence the user must read before it happens.

## Alternatives

- A choice or a form that is not destructive: `tct-dialog`.
- A destructive action that can be undone: do it and offer Undo in a `toast()`.
- A message that needs no decision: `tct-banner` or a toast.

## Anatomy

- The **dialog surface**, backdrop and motion come from `tct-dialog` (purpose `required`).
- The **heading** (level 2, `part="content"`) names the dialog; the **description** describes it, so a
  screen reader announces both when it opens.
- An optional **extra content** slot sits under the description.
- The **footer** (`part="footer"`) holds **Cancel** (ghost, the initial focus) and the **action**
  (destructive by default). The action shows a spinner while `action-loading` is set.
- `openAlertDialog(options)` renders an alert dialog into the page, opens it and removes it when it closes.

## Variants and states

- `action-variant`: `destructive` (default), or any button variant (`primary` for a discard question where
  red would overstate it).
- `action-loading`: the spinner shows and the action is blocked; Cancel stays available.
- `inline`: the content in the page, as a named `group`, for documentation; no modal behaviour.
- Purpose: an alert dialog is never light-dismissable. Escape and Cancel ask to close it; a cancelled
  `tct-open-change` keeps it open.

## Responsive behaviour

Above 640px the actions sit side by side and complete buttons wrap to another row when a label is long. At
640px and below the destructive action is above Cancel, both fill the footer, and the DOM and tab order
follow what is seen; Cancel still takes the initial focus. The breakpoint follows the available width, not the
pointer or hover capability. The width is clamped to the viewport and the body scrolls when the height is short.

## Form semantics

Not applicable. A `<form method="dialog">` in the extra content closes it through `requestClose()`.

## Screen-reader expectations

- `role="alertdialog"` with `aria-modal="true"`, named by the heading and described by the description.
- Focus moves to Cancel when it opens (the least destructive choice), and returns to the element that opened it.
- Escape cancels, one layer per press: a tooltip or nested layer above it closes first.
- The action's label is the accessible name of its button; a loading action is announced as busy.

## Localisation

"Cancel" is localized in all 30 shipped locales; `cancel-label` overrides it. Write the heading, description and
action label in the user's language. The actions align to the inline end and mirror in right-to-left contexts.

## Consumer responsibilities

- Close the dialog yourself when the action's work has finished (`open = false`, or `handle.hide()`); `tct-action` never closes it.
- Give the action a specific label and describe the consequence.
- Do not use it for questions that are not destructive.
- When you cancel `tct-open-change`, tell the user why the dialog stayed open.
