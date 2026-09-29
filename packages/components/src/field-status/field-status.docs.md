---
title: FieldStatus
folder: field-status
category: Form Controls
entries: [FieldStatus]
summary: Validation feedback for a field or custom control: an error, warning, success or info message that is announced when it appears.
examples: [types, variants, rich-message]
keywords: [fieldstatus, status, validation, error, warning, success, info, message, feedback, helper, live region, announce]
dense:
  description: validation feedback message for fields and custom controls; error, warning, success, info; attached or detached; announced when it appears
  usage: Shows a validation message tied to a control. tct-field and tct-text-input render it for you from status-type and status-message; use <tct-field-status> directly next to a control that has no field chrome. Link it to the control with aria-describedby (give it an id). Errors are announced assertively, every other type politely.
  bestPractices:
    - {do: true, text: 'Use attached status below bordered inputs when the message belongs to that input.'}
    - {do: true, text: 'Use detached status for checkboxes, switches and custom controls where the message would overlap or crowd the control.'}
    - {do: true, text: 'Say what is wrong and how to fix it; the colour is not the message.'}
    - {do: false, text: 'Use it for general alerts or page-level notices; use a banner or toast instead.'}
    - {do: false, text: 'Add role="alert" yourself; the element announces through the shared announcer.'}
  properties:
    type: status tone (error, warning, success, info); default error
    message: visible validation text
    variant: attached sits under the control, detached adds a leading icon and a gap
    default: slot for a message that needs richer content than the message attribute
---

## Purpose

`tct-field-status` is the message under a field: what is wrong (or fine) and what to do about it. The
Tecton field draws it as coloured text on the page with no box behind it. When it appears or its text
changes it is announced once through the page's live regions: an error assertively, everything else
politely.

## When to use

- Under a custom control or a native input that has no field chrome, next to its `aria-describedby`.
- Anywhere a validation message has to be placed by hand.

Inside `tct-field` and `tct-text-input` you do not create it: set `status-type` and `status-message` (or
the `status` property) and the component renders and announces it.

## Alternatives

- `tct-field` or `tct-text-input` with `status-type`, when the control is theirs.
- A banner or toast for page-level messages.
- A tooltip status button (`status-variant="tooltip"` on `tct-text-input`) when the layout leaves no room.

## Anatomy

The message box (part `status`): the message text or the default slot, and for `detached` a leading
status icon (part `icon`).

## Variants and states

- `type`: `error`, `warning`, `success` or `info`, each with its Tecton status text colour.
- `variant`: `attached` (text directly under the control) or `detached` (a gap above, and a leading icon).
- A message fades in when it appears; nothing moves, so reduced motion needs no special case.

## Responsive behaviour

The message wraps and breaks long words; it never truncates.

## Form semantics

Not applicable. The element is not form-associated; the control it describes is.

## Screen-reader expectations

- The message is announced when it appears or changes: `assertive` for `error`, `polite` for the rest.
- Reference it from the control with `aria-describedby`; `tct-field` and `tct-text-input` do this for you.
- An error also needs `aria-invalid` on the control; the component sets it, a native control needs it from you.
- The type is conveyed by colour and, for `detached`, an icon. Write the message so it makes sense alone.

## Localisation

Write the message in the user's language. The element has no strings of its own.

## Consumer responsibilities

- Link the message to its control with `aria-describedby` when you use the element on its own.
- Remove the element (or clear the message) when the problem is fixed, so nothing stale is announced.
- Use `type="error"` only for something the user must fix.
