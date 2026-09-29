---
title: NumberInput
folder: number-input
category: Form Controls
entries: [NumberInput]
summary: A locale-aware number field with a label, description, validation status, steppers, units and a clear button, as a form-associated element.
examples: [basic, locale, steppers, units-and-format, status, states, in-form]
keywords: [number, numeric, quantity, price, amount, stepper, spinbutton, locale, units, currency, integer, range, form]
dense:
  description: form-associated number field; reads locale-formatted and pasted numbers, commits on blur or Enter, steps by key, wheel and buttons, submits a plain number
  usage: Collects a quantity, price or measurement. People type in their own format (1.234,5 in German, full-width digits, spreadsheet text); the text is a draft that commits one number when they leave the field or press Enter, clamped to min and max. It submits the number in plain form (1234.5) whatever the text shows. Use min, max and step for the range, units for a suffix, and formatValue for display formatting.
  bestPractices:
    - {do: true, text: 'Set min and max when the number has a real range; an entry outside it is clamped when committed.'}
    - {do: true, text: 'Use units for a suffix such as % or kg instead of putting it in the label; it is read as part of the description.'}
    - {do: true, text: 'Use integer-only for counts, so a fraction is not accepted and touch keyboards show digits.'}
    - {do: true, text: 'Read valueAsNumber (or the plain value string) in your change handler; it is not the text on screen.'}
    - {do: false, text: 'Use it for identifiers, phone numbers or zip codes that only look like numbers; use a text input.'}
    - {do: false, text: 'Parse the displayed text yourself; the element already reads the locale.'}
    - {do: false, text: 'Wrap a disabled number input in a tooltip to explain why; use disabled-message.'}
  properties:
    label: label text, always rendered for accessibility
    labelHidden: hides the label visually, keeps it for screen readers
    label-hidden: attribute of labelHidden
    labelIcon: icon name before the label text
    label-icon: attribute of labelIcon
    description: helper text between the label and the field
    optional: shows an Optional indicator; mutually exclusive with required
    required: constraint (a value is needed), aria-required and a Required indicator
    disabled: disables the field (also through fieldset disabled)
    disabledMessage: explains why the field is disabled; shows a tooltip and keeps it focusable
    disabled-message: attribute of disabledMessage
    readonly: shows the value but bars edits and stepping; still submitted and in the tab order
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
    min: smallest value; a smaller entry commits as this
    max: largest value; a larger entry commits as this
    step: amount a step changes the value by, default 1
    integerOnly: whole numbers only
    integer-only: attribute of integerOnly
    units: text after the number, such as % or kg
    hasClear: shows a clear button while there is a value; an empty entry then clears
    has-clear: attribute of hasClear
    hasSteppers: shows increment and decrement buttons at the end
    has-steppers: attribute of hasSteppers
    noWheel: turns off stepping with the mouse wheel over the focused field
    no-wheel: attribute of noWheel
    formatValue: function (number) => string that formats the text at rest
    autocomplete: native autocomplete token
    name: form field name
    value: the value as a plain number string, or empty; the value attribute is the default that reset restores
    valueAsNumber: the value as a number, NaN when empty
    defaultValue: the value attribute
    invalid: marks the field invalid without failing constraint validation
    select: method, selects the text of the field
    focus: method, focuses the field
    showInvalid: method, displays the current invalidity without submitting
    input: native event when the committed value changes by a commit, step or clear
    change: native event once after input
    tct-enter: cancelable event when Enter is pressed after the draft was committed; preventDefault stops implicit submission
    tct-clear: cancelable event when the clear button is pressed; preventDefault keeps the value
---

## Purpose

`tct-number-input` collects a number: a quantity, a price, a measurement. It draws the Tecton outlined
field (border, hover, focus ring) with its label, description, Required or Optional indicator, validation
status, units, optional stepper buttons and a clear button. It is a form-associated element that submits the
number in a plain form, so a server never has to parse a locale.

## When to use

- A count, an amount or a measurement, with or without a range.
- Values people paste from spreadsheets.
- Anywhere you would use `<input type="number">` and want the Tecton field, locale-aware text and control
  over how the number is shown.

## Alternatives

- `tct-text-input` for identifiers that only look like numbers (phone, postal code, account number).
- A slider for a value where the range matters more than the exact number.

## Anatomy

Label (with an optional icon, indicator and info button), description, the box (part `input`) holding the
start icon, the text field (part `control`), the units, the clear button, the busy spinner, the status
glyph and the stepper column (part `steppers`), and the status message.

## Variants and states

- `size` sm, md or lg; `min`, `max` and `step`; `integer-only`; `units`; a `formatValue` display.
- Statuses `error`, `warning`, `success` and `info`, shown `attached` under the box, `detached` with an
  icon, or as a `tooltip` behind a focusable status button inside the box.
- `disabled` (with `disabled-message` it stays focusable and explains why), `readonly` (no editing and no
  stepping), `loading` and `required` or `optional`.
- Typing is a draft: while it stands the text is muted and, when it is not a number, `aria-invalid`. Leaving
  the field or pressing Enter commits it: out-of-range entries are clamped, unreadable text returns to the
  last value.

## Responsive behaviour

The field fills its container; `width` limits it. The stepper buttons span the height of the box and are
not tab stops, so keyboard users step with the arrow keys. Touch keyboards show the numeric keypad
(`integer-only`) or the decimal keypad.

## Form semantics

Form-associated (`ElementInternals`): it submits `name=number` in the plain form (`1234.5`) whatever the
text shows, resets to the `value` attribute, is restored on back navigation, works with `form="id"` and an
external `<label for>`, and joins `<fieldset disabled>`. `required`, `min` and `max` are constraints; text
that cannot be read as a number blocks the submit while it stands.

`value` is a string like a native number input's and `valueAsNumber` is the number (`NaN` when empty).
`input` and then `change` fire when the committed value changes: by a commit, a step or a clear. Typing
alone fires nothing, and neither fires when you set `value`. To control the field, set `value` from your
`change` handler.

## Screen-reader expectations

- A text field with `role="spinbutton"`: named by its label, described by the description, the units and
  the status, with `aria-valuenow`, `aria-valuemin` and `aria-valuemax` (and `aria-valuetext` with
  `formatValue`).
- Text that is not a number is announced once, assertively ("Invalid number"), and the field is
  `aria-invalid` while it stands.
- The stepper buttons are named "Increment Quantity" and "Decrement Quantity"; the clear button "Clear
  Quantity".
- A `disabled-message` field stays focusable (`aria-disabled`) so the reason can be reached.

## Localisation

The text is read and shown in the language of the page or the nearest `lang`: German `1.234,5`, French
`1 234,5`, Arabic and Devanagari digits and full-width digits all read back correctly. The button names,
"Optional" and "Required" and "Invalid number" come from the locale catalogs. Label, description,
placeholder, units and status text are yours to translate. Layout and the stepper column mirror in
right-to-left.

## Consumer responsibilities

- Give the field a `name` to submit it, a `label` always, and a message with every status.
- Read the number from `value` or `valueAsNumber`, never from the text on screen.
- Do not use it for values that are not quantities.
