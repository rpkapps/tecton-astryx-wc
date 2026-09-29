---
title: DateInput
folder: date-input
category: Form Controls
entries: [DateInput]
summary: A date field: type a date in your own language or pick it in a calendar, submitted as YYYY-MM-DD.
examples: [basic, constraints, formats, locale, presentation, status, states, in-form]
keywords: [date, datepicker, calendar, input, birthday, deadline, day, month, year, form, iso, day-first, locale]
dense:
  description: form-associated date field with a typed combobox, a calendar popover (bottom sheet on touch) and ISO YYYY-MM-DD value
  usage: Collects a calendar date. People type in their own format (Jan 25, 25/1/2026, 21 במרץ 2026) or pick it in the calendar; the typed text is a draft that commits when they leave the field or press Enter. It submits YYYY-MM-DD whatever the language, calendar or time zone. Use min, max and dateConstraints for the days that can be chosen; presentation chooses the popover, bottom sheet or native input.
  bestPractices:
    - {do: true, text: 'Set min, max and dateConstraints when only some days are valid; text that rules them out is refused and announced.'}
    - {do: true, text: 'Read the YYYY-MM-DD string from value and keep it as a string; put the time zone in your own data.'}
    - {do: true, text: 'Leave presentation on its default: a popover for a mouse, the browser picker for a coarse pointer.'}
    - {do: false, text: 'Use it for a date and a time; that is tct-date-time-input.'}
    - {do: false, text: 'Parse the displayed text yourself; the element already reads the language.'}
    - {do: false, text: 'Wrap a disabled date input in a tooltip to explain why; use disabled-message.'}
  properties:
    label: label text, always rendered for accessibility
    labelHidden: hides the label visually, keeps it for screen readers
    label-hidden: attribute of labelHidden
    labelIcon: icon name before the label text
    label-icon: attribute of labelIcon
    description: helper text between the label and the field
    optional: shows an Optional indicator; mutually exclusive with required
    required: constraint (a date is needed), aria-required and a Required indicator
    disabled: disables the field (also through fieldset disabled)
    disabledMessage: explains why the field is disabled; shows a tooltip and keeps every part focusable
    disabled-message: attribute of disabledMessage
    readonly: shows the value but bars edits; still submitted and in the tab order
    loading: shows a spinner and aria-busy
    placeholder: hint shown when empty, default Select a date
    labelTooltip: text of an info button after the label
    label-tooltip: attribute of labelTooltip
    statusType: status tone (error, warning, success, info)
    status-type: attribute of statusType
    statusMessage: status text
    status-message: attribute of statusMessage
    status: object {type, message}; the same as statusType and statusMessage
    statusVariant: attached, detached or tooltip (a status button in the box)
    status-variant: attribute of statusVariant
    size: sm, md, lg; unset follows the nearest size provider
    width: width of the field; a number is px, a string a CSS length
    min: earliest date YYYY-MM-DD; a native constraint (rangeUnderflow)
    max: latest date YYYY-MM-DD; a native constraint (rangeOverflow)
    dateConstraints: array of predicates over a local Date; a date is unavailable when any returns false
    hasClear: shows a clear button while there is a value
    has-clear: attribute of hasClear
    numberOfMonths: months the calendar shows side by side, 1 or 2
    number-of-months: attribute of numberOfMonths
    weekStartsOn: first day of the week, 0 to 6 or sun to sat
    week-starts-on: attribute of weekStartsOn
    format: how the committed date shows: date_long, date, date_weekday, system_date, or a function
    presentation: popover, bottom-sheet, native, adaptive-bottom-sheet or adaptive-native (default)
    nativePicker: deprecated; touch, always or never map to adaptive-native, native and adaptive-bottom-sheet
    native-picker: attribute of nativePicker
    open: whether the picker is open; writing it fires no event
    changeAction: async function run after every user change; the field is busy until it settles
    name: form field name
    value: the date YYYY-MM-DD or empty; the value attribute is the default that reset restores
    defaultValue: the value attribute
    invalid: marks the field invalid without failing constraint validation
    select: method, selects the text of the input
    focus: method, focuses the input
    show: method, opens the picker without an intent event
    hide: method, closes the picker without an intent event
    toggle: method, opens or closes the picker without an intent event
    requestClose: method, asks to close the picker as a user would (fires tct-open-change)
    showInvalid: method, displays the current invalidity without submitting
    input: native event when the committed date changes (a pick, a clear, typed text when the entry ends)
    change: native event once after input
    tct-enter: cancelable event when Enter is pressed after the draft was committed; preventDefault stops implicit submission
    tct-clear: cancelable event when the clear button is pressed; preventDefault keeps the value
    tct-open-change: cancelable event before the user opens or closes the picker
    tct-after-open-change: event after the picker opened or closed and settled
related: [calendar, date-range-input, date-time-input, time-input, text-input]
---

## Purpose

`tct-date-input` collects a calendar date: a birthday, a deadline, the first day of a stay. It draws the
Tecton outlined field with its label, description, Required or Optional indicator, validation status, a
calendar toggle button and an optional clear button. People type the date in their own language or pick it in
a calendar under the field; the form gets `YYYY-MM-DD`, so a server never has to parse a locale, a calendar
system or a time zone.

## When to use

- A single calendar date, with or without a window of valid days.
- Dates people know by heart (a birthday) and dates they need a calendar for (a booking).
- Anywhere you would use `<input type="date">` and want the Tecton field, readable typed input and control
  over how the date is shown.

## Alternatives

- `tct-date-range-input` for a start and an end date, `tct-date-time-input` when the time matters, and
  `tct-time-input` for a time of day alone.
- `tct-calendar` for a picker that is not a form field.
- `tct-text-input` for identifiers that only look like dates.

## Anatomy

Label (with an optional icon, indicator and info button), description, the box (part `input`) holding the
calendar toggle button (part `toggle`), the text input (part `control`) or, on the native surface, the
browser's date input with the field's text painted over it, the clear button, the busy spinner and the status
glyph, and the status message. The calendar opens in a popover (parts `picker` and `picker-surface`) with a
close button that is revealed when keyboard focus reaches it, or in a bottom sheet.

## Variants and states

- `format` (how the committed date shows), `size`, `number-of-months`, `week-starts-on` and `has-clear`.
- `presentation`: popover, bottom sheet, the browser's own input, or the adaptive forms that switch with the
  device; the deprecated `native-picker` maps to them.
- Statuses `error`, `warning`, `success` and `info`, `attached`, `detached` or as a `tooltip`.
- `disabled` (with `disabled-message` it stays focusable), `readonly`, `loading`, `required` or `optional`.
- Typing is a draft: while it stands the text is muted and, when it is not an available date, `aria-invalid`
  and announced once. Leaving the field or pressing Enter commits a readable, available date and drops the rest.

## Responsive behaviour

The field fills its container; `width` limits it. The calendar opens under the field and stays inside the
viewport; on a compact touch device (a narrow viewport with a coarse pointer) `adaptive-bottom-sheet` shows a
bottom sheet with one month instead, and the default `adaptive-native` hands the choice to the browser's own
picker. A desktop window narrowed to phone width is still a mouse and keeps its popover.

## Form semantics

Form-associated (`ElementInternals`): it submits `name=YYYY-MM-DD` (an empty string when empty) whatever the
language, calendar or time zone, resets to the `value` attribute, is restored on back navigation, works with
`form="id"` and an external `<label for>`, and joins `<fieldset disabled>`. `required`, `min`, `max`,
`dateConstraints` and text that is not an available date block the submit. The error is shown after the user
acted (a pick, leaving the field after an edit) or a submit attempt; text that is not a date is shown once
typing pauses.

`value` is a string like a native date input's. `input` fires when the committed date changes (a pick, a
clear, typed text when the entry ends) and `change` once after it; neither fires when you set `value`. To
control the field, set `value` from your `change` handler.

## Screen-reader expectations

- The text field is a `role="combobox"` with a dialog popup: named by its label, described by the description
  and the status, `aria-expanded` and `aria-controls` while the calendar is open. Arrow Down opens it.
- The calendar is a labelled dialog ("Choose date"); focus goes into it when the toggle button opened it and
  stays in the input when the input did, and returns to the input when it closes.
- Text that is not a date, or a date the constraints rule out, is announced once, assertively ("Invalid
  date", "This date is not available"), and the field is `aria-invalid` while it stands.
- The toggle is named "Open calendar" and the clear button "Clear Start date". A `disabled-message` field
  stays focusable (`aria-disabled`) so the reason can be reached.

## Localisation

The text is read and shown in the language of the page or the nearest `lang`, always in the Gregorian
calendar: `3/4/2026` is March 4 in en-US and April 3 in en-GB, month names in German, Hebrew and Arabic read
back, and Arabic-Indic digits work. The names of the buttons, the placeholder and the messages come from the
locale catalogs; label, description and status text are yours to translate. Layout and the calendar mirror
in right-to-left.

## Consumer responsibilities

- Give the field a `name` to submit it, a `label` always, and a message with every status.
- Read the date from `value` (a `YYYY-MM-DD` string), never from the text on screen.
- Explain why days are unavailable in the description; the field only marks and refuses them.
- Keep the time zone in your own data: a date names a day, not a moment.
