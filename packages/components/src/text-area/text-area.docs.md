---
title: TextArea
folder: text-area
category: Form Controls
entries: [TextArea]
summary: A multi-line text field with a label, description, validation status, character counter and auto-grow, as a form-associated element.
examples: [basic, sizes, counter, auto-grow, status, states, in-form, slotted-textarea]
keywords: [textarea, multiline, comment, message, notes, description, counter, maxlength, auto-grow, resize, form]
dense:
  description: form-associated multi-line text field w/ label, description, validation status, character counter, auto-grow; also wraps your own native textarea
  usage: Collects free-form text such as comments, messages or notes. It submits, resets, validates and joins fieldset disabled like a native textarea; Enter adds a line and never submits. Set rows for the visible height, auto-grow to follow the text, and maxlength to show a counter of characters. Validation shows only after the user acted.
  bestPractices:
    - {do: true, text: 'Always provide a visible label; hide it (label-hidden) only when context makes the purpose obvious.'}
    - {do: true, text: 'Set rows to the height the typical answer needs, or use auto-grow so short answers stay compact and long ones stay readable.'}
    - {do: true, text: 'Use maxlength with a counter when the value has a real limit, and say the limit in the description.'}
    - {do: true, text: 'Use status-type with a message that says what to fix.'}
    - {do: false, text: 'Use a placeholder instead of a label; it disappears on focus and is not reliably read.'}
    - {do: false, text: 'Use it for a single line; use a text input instead.'}
    - {do: false, text: 'Rely on maxlength to truncate; it is soft, so pasted text is kept and the field is marked invalid.'}
    - {do: false, text: 'Wrap a disabled text area in a tooltip to explain why; use disabled-message.'}
  properties:
    label: label text, always rendered for accessibility
    labelHidden: hides the label visually, keeps it for screen readers
    label-hidden: attribute of labelHidden
    labelIcon: icon name before the label text
    label-icon: attribute of labelIcon
    description: helper text between the label and the field
    optional: shows an Optional indicator; mutually exclusive with required
    required: constraint, aria-required and a Required indicator
    disabled: disables the field (also through fieldset disabled)
    disabledMessage: explains why the field is disabled; shows a tooltip and keeps it focusable
    disabled-message: attribute of disabledMessage
    readonly: not editable but submitted and in the tab order
    loading: shows a spinner and aria-busy
    placeholder: hint shown when empty
    labelTooltip: text of an info button after the label
    label-tooltip: attribute of labelTooltip
    startIcon: icon name at the start of the field
    start-icon: attribute of startIcon
    statusType: status tone (error, warning, success, info)
    status-type: attribute of statusType
    statusMessage: status text
    status-message: attribute of statusMessage
    status: object {type, message}; the same as statusType and statusMessage
    statusVariant: attached, detached or tooltip (a status button in the box)
    status-variant: attribute of statusVariant
    size: sm, md, lg; unset follows the nearest size provider
    width: width of the field; a number is px, a string a CSS length
    rows: visible lines, default 3; the minimum with auto-grow
    autoGrow: the field grows with its text; uses field-sizing where available
    auto-grow: attribute of autoGrow
    maxRows: with auto-grow, the number of lines after which the field scrolls
    max-rows: attribute of maxRows
    maxlength: soft character limit; shows a counter and marks the field invalid past it
    autocomplete: native autocomplete token
    name: form field name
    value: current value; the value attribute is the default that reset restores
    defaultValue: the value attribute
    invalid: marks the field invalid without failing constraint validation
    changeAction: async function (value, event) run after each user edit; busy while its promise is pending
    select: method, selects the text of the field
    focus: method, focuses the field
    showInvalid: method, displays the current invalidity without submitting
    input: native event on every edit
    change: native event when the user commits an edit
    paste: native event when content is pasted
    "slot:input": your own native textarea; switches to slotted-textarea mode
    "slot:label": the label element created in slotted-textarea mode; do not fill
    "slot:description": the description element created in slotted-textarea mode; do not fill
    "slot:status": the status element created in slotted-textarea mode; do not fill
---

## Purpose

`tct-text-area` collects multi-line text: comments, messages, notes, descriptions. It draws the Tecton
outlined field (border, hover, focus ring) and everything around it: label, description, Required or
Optional indicator, validation status, a character counter and a start icon. It is a form-associated
element, so it behaves like a native `<textarea>` in a form.

## When to use

- Free-form text that can run to several lines.
- A limit that the user should see while typing (`maxlength`).
- Text that should grow with what is written (`auto-grow`).

## Alternatives

- `tct-text-input` for a single line.
- A rich text editor for formatted content.

## Anatomy

Label (with an optional icon, indicator and info button), description, the box (part `input`) holding the
start icon, the native textarea (part `control`), the busy spinner and status glyph, the counter, and the
status message. In slotted-textarea mode your `<textarea slot="input">` replaces the native one, and
label, description and status become elements in the light DOM next to it.

## Variants and states

- `size` sm, md or lg; `rows` for the visible height; `auto-grow` with `max-rows`.
- `maxlength` shows the counter: it turns to the error colour with a warning glyph past the limit.
- Statuses `error`, `warning`, `success` and `info`, shown `attached` under the box, `detached` with an
  icon, or as a `tooltip` behind a focusable status button inside the box.
- `disabled` (optionally with `disabled-message`, which keeps the field focusable and explains why),
  `readonly`, `loading` and `required` or `optional`.
- Validation is shown after the user acted; `:state(user-invalid)` and `aria-invalid` appear together and
  the browser's message is shown as the status. `form.checkValidity()` shows nothing.
- `:state(busy)` while `loading` is set or a `changeAction` is pending.

## Responsive behaviour

The field fills its container; `width` limits it. Without `auto-grow` the user can resize it vertically.
With `auto-grow` the height follows the text between `rows` and `max-rows`, and re-measures when the width
changes and the text re-wraps.

## Form semantics

Form-associated (`ElementInternals`): it submits `name=value`, resets to the `value` attribute, is restored
on back navigation, works with `form="id"` and an external `<label for>`, joins `<fieldset disabled>`, and
supports `required` and `maxlength`. Enter adds a line and never submits the form. `input` fires on every
edit, `change` once when the edit is committed; neither fires when you set `value`.

`maxlength` is soft: the counter counts characters as a person sees them (an emoji is one), nothing is cut,
and past the limit the field is invalid (`validity.tooLong`) and the form will not submit.

In slotted-textarea mode your `<textarea>` is the participant: it submits itself and the element adds no
entry of its own.

## Screen-reader expectations

- Name from the label, description and status from `aria-describedby`; `aria-required` and `aria-invalid`
  follow the required and displayed-invalid state.
- The counter speaks twice at most: politely once when the count reaches 80% of the limit ("2 characters
  remaining") and assertively once when it is passed ("1 character over the limit").
- Status messages are announced once when they appear or change.
- A `disabled-message` field stays focusable (`aria-disabled`) so the reason can be reached.

## Localisation

Strings ("Optional", "Required", the counter announcements, the status button names) come from the locale
catalogs and follow the page language or the nearest `lang`; a provider's overrides win. Layout mirrors in
right-to-left. Label, description, placeholder and status text are yours to translate.

## Consumer responsibilities

- Give the field a `name` to submit it, a `label` always, and a message with every status.
- In slotted-textarea mode the author's textarea owns `name`, `value`, `required`, `disabled`, `rows` and
  `autocomplete`; the host attributes are not forwarded.
- Do not slot elements named label, description or status.
