---
title: TextInput
folder: text-input
category: Form Controls
entries: [TextInput]
summary: A single-line text field with a label, description, validation status, clear button and adornments, as a form-associated element.
examples: [basic, sizes, types, status, clear-and-icons, states, in-form, slotted-input]
keywords: [textinput, textfield, input, search, clearable, prefix, suffix, adornment, validation, email, password, form]
dense:
  description: form-associated text input w/ label, description, validation status, required/optional indicators, clear button, adornments; also wraps your own native input
  usage: Collects short-form text like names, emails or search queries. It submits, resets, validates and joins fieldset disabled like a native input, and Enter submits the form once (never while an IME composes). Validation shows only after the user acted. For sign-in and address fields put your own <input slot="input"> inside so password managers and autofill see a native field.
  bestPractices:
    - {do: true, text: 'Always provide a visible label; hide it (label-hidden) only when context makes the purpose obvious, such as a search bar with a magnifier.'}
    - {do: true, text: 'Use status-type with a message that says what to fix: "Email must include an @" beats a red border.'}
    - {do: true, text: 'Size the input to the expected content: sm for a zip code, md for a name, lg for a URL.'}
    - {do: true, text: 'Add has-clear to search and filter inputs.'}
    - {do: true, text: 'Use the slotted-input mode for sign-in and address fields so autofill and password managers work.'}
    - {do: false, text: 'Use a placeholder instead of a label; it disappears on focus and is not reliably read.'}
    - {do: false, text: 'Use it for multi-line content; use a text area instead.'}
    - {do: false, text: 'Mark every field required; flag only the mandatory ones.'}
    - {do: false, text: 'Wrap a disabled text input in a tooltip to explain why; use disabled-message.'}
  properties:
    type: input type (text, password, email, search, tel, url); default text
    label: label text, always rendered for accessibility
    labelHidden: hides the label visually, keeps it for screen readers
    label-hidden: attribute of labelHidden
    description: helper text between the label and the input
    optional: shows an Optional indicator; mutually exclusive with required
    required: constraint, aria-required and a Required indicator
    disabled: disables the input (also through fieldset disabled)
    disabledMessage: explains why the input is disabled; shows a tooltip and keeps it focusable
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
    hasClear: shows a clear button while there is an editable value
    has-clear: attribute of hasClear
    width: width of the field; a number is px, a string a CSS length
    autocomplete: native autocomplete token
    minlength: minimum length constraint
    maxlength: maximum length constraint
    pattern: pattern constraint
    name: form field name
    value: current value; the value attribute is the default that reset restores
    defaultValue: the value attribute
    invalid: marks the field invalid without failing constraint validation
    changeAction: async function (value, event) run after each user edit; busy while its promise is pending
    select: method, selects the text of the input
    focus: method, focuses the input
    input: native event on every edit
    change: native event when the user commits an edit
    tct-enter: cancelable event when Enter is pressed (not while an IME composes); preventDefault stops implicit submission
    tct-clear: cancelable event when the clear button is pressed; preventDefault keeps the value
    "slot:input": your own native input; switches to slotted-input mode
    start: slot for an adornment at the start
    end: slot for an adornment at the end
    "slot:label": the label element created in slotted-input mode; do not fill
    "slot:description": the description element created in slotted-input mode; do not fill
    "slot:status": the status element created in slotted-input mode; do not fill
---

## Purpose

`tct-text-input` collects short single-line text: names, emails, search queries, codes. It draws the
Tecton outlined field (border, hover, hot-pink focus ring) and everything around it: label, description,
Required or Optional indicator, validation status, a clear button and a start icon or adornments. It is a
form-associated element, so it behaves like a native `<input>` in a form.

## When to use

- Short text values in a form, a filter or a search bar.
- Anywhere you would use `<input type="text|email|password|search|tel|url">` and want the Tecton field
  with its chrome.
- Sign-in and address forms, using the slotted-input mode so browsers and password managers see a native
  field.

## Alternatives

- A text area for multi-line content.
- `tct-field` around a native input, when you need a different control in the same chrome.
- A number, date or select control for structured values.

## Anatomy

Label (with an optional icon, indicator and info button), description, the box (part `input`) holding
the start icon or `start` adornment, the native input (part `control`), the busy spinner, the clear button,
the status glyph and the `end` adornment, and the status message. In slotted-input mode, your `<input
slot="input">` replaces the native input in the box, and label, description and status become elements
in the light DOM next to it.

## Variants and states

- `size` sm, md or lg; `type` text, password, email, search, tel or url.
- Statuses `error`, `warning`, `success` and `info`, shown `attached` under the box, `detached` with an
  icon, or as a `tooltip` behind a focusable status button inside the box.
- `disabled` (optionally with `disabled-message`, which keeps the field focusable and explains why),
  `readonly`, `loading` and `required` or `optional`.
- Validation is shown after the user acted: a change, leaving the field after an edit, or a submit
  attempt. `:state(user-invalid)` and `aria-invalid` appear together, and the browser's message is
  shown as the status. `form.checkValidity()` shows nothing.
- `:state(busy)` while `loading` is set or a `changeAction` is pending.

## Responsive behaviour

The field fills its container; `width` limits it. Adornments never grow taller than the field, and the
clear button's hit area grows on coarse pointers (24px).

## Form semantics

Form-associated (`ElementInternals`): it submits `name=value`, resets to the `value` attribute, is
restored on back navigation, works with `form="id"` and an external `<label for>`, joins
`<fieldset disabled>`, and supports the constraints `required`, `minlength`, `maxlength` and `pattern`.
Enter submits the form once, unless `tct-enter` is prevented, and never while an IME is composing.
`input` fires on every edit, `change` once when the edit is committed. Neither fires when you set `value`.

In slotted-input mode your `<input>` is the participant: it submits itself and the element adds no entry
of its own.

## Screen-reader expectations

- Name from the label, description and status from `aria-describedby`; `aria-required` and
  `aria-invalid` follow the required and displayed-invalid state.
- Status messages are announced once when they appear or change; the browser's message is frozen
  while the user types.
- The clear button is named "Clear <label>", restores focus to the input and fires `input` and `change`.
- The tooltip status button and the label info button are focusable buttons with names.
- A `disabled-message` field stays focusable (`aria-disabled`) so the reason can be reached.

## Localisation

Strings ("Clear Name", the status button names, "Optional", "Required") come from the locale catalogs
and follow the page language or the nearest `lang`; a provider's overrides win. Layout mirrors in
right-to-left. Label, description, placeholder and status text are yours to translate.

## Consumer responsibilities

- Give the field a `name` to submit it, a `label` always, and a message with every status.
- Set `autocomplete` (or use the slotted input) on sign-in and address fields.
- In slotted-input mode the author's input owns `name`, `value`, `type`, `required`, `disabled` and
  `autocomplete`; the host attributes are not forwarded.
- Do not slot elements named label, description or status.
