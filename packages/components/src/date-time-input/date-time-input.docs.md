---
title: DateTimeInput
folder: date-time-input
category: Form Controls
entries: [DateTimeInput]
summary: A date and a time under one label, submitted as one ISO date-time, with a calendar popover and optional preset times.
examples: [basic, min-max, time-options, seconds-and-24h, presentation, states, locale, in-form]
keywords: [datetime, date time, date-time, appointment, meeting, schedule, timestamp input, calendar, time, iso, form]
dense:
  description: form-associated date and time field with typed parts, a calendar popover, optional preset times and a Date/Time tabbed bottom sheet on touch; ISO YYYY-MM-DDTHH:MM value
  usage: Collects a wall-clock date and time (a meeting, a deadline). The date part types and picks like tct-date-input and the time part types and steps like tct-time-input; time-option-interval lists times to choose from. It submits one YYYY-MM-DDTHH:MM (with seconds when has-seconds) and names no time zone; keep the zone in your own data. Choosing a date on an empty field takes the current time; a time chosen first is kept until the date is. min and max bound both parts.
  bestPractices:
    - {do: true, text: 'Use time-option-interval when people choose from a few slots (every 15 or 30 minutes); typing any time still works.'}
    - {do: true, text: 'Set min and max as date-times: their time of day bounds the time part on their own day.'}
    - {do: true, text: 'Store the value as the string it is and keep the time zone in your own data.'}
    - {do: false, text: 'Treat the value as an instant; it is a wall-clock reading with no zone.'}
    - {do: false, text: 'Use it for a date or a time alone; use tct-date-input or tct-time-input.'}
  properties:
    label: label text, always rendered for accessibility
    labelHidden: hides the label visually, keeps it for screen readers
    label-hidden: attribute of labelHidden
    labelIcon: icon name before the label text
    label-icon: attribute of labelIcon
    description: helper text between the label and the field
    optional: shows an Optional indicator; mutually exclusive with required
    required: constraint (a date and a time are needed), aria-required and a Required indicator
    disabled: disables the field (also through fieldset disabled)
    disabledMessage: explains why the field is disabled; shows a tooltip and keeps both parts focusable
    disabled-message: attribute of disabledMessage
    readonly: shows the value but bars edits; still submitted and in the tab order
    loading: shows a spinner and aria-busy
    placeholder: hint of the date part, default Select a date
    timePlaceholder: hint of the time part, default Select a time
    time-placeholder: attribute of timePlaceholder
    timeLabel: accessible name of the time part, default label time
    time-label: attribute of timeLabel
    labelTooltip: text of an info button after the label
    label-tooltip: attribute of labelTooltip
    statusType: status tone (error, warning, success, info)
    status-type: attribute of statusType
    statusMessage: status text
    status-message: attribute of statusMessage
    status: object {type, message}; the message is always the detached box
    size: sm, md, lg; unset follows the nearest size provider
    width: width of the field; a number is px, a string a CSS length
    min: earliest date-time YYYY-MM-DDTHH:MM; its date bounds the calendar, its time bounds the time on its own day
    max: latest date-time; a native constraint (rangeOverflow)
    dateConstraints: array of predicates over a local Date; a day is unavailable when any returns false
    hasSeconds: adds seconds to the time part and the value
    has-seconds: attribute of hasSeconds
    hourFormat: 12h (default) or 24h
    hour-format: attribute of hourFormat
    timeIncrement: minutes the arrow keys step by, 1 5 10 15 or 30
    time-increment: attribute of timeIncrement
    timeOptionInterval: 5 10 15 30 or 60 minutes; turns the time part into a combobox of preset times
    time-option-interval: attribute of timeOptionInterval
    hasClear: shows a clear button while there is a value; it clears both parts
    has-clear: attribute of hasClear
    numberOfMonths: months the calendar shows side by side, 1 or 2
    number-of-months: attribute of numberOfMonths
    weekStartsOn: first day of the week, 0 to 6 or sun to sat
    week-starts-on: attribute of weekStartsOn
    presentation: popover, bottom-sheet, native, adaptive-bottom-sheet or adaptive-native (default)
    nativePicker: deprecated; touch, always or never map to adaptive-native, native and adaptive-bottom-sheet
    native-picker: attribute of nativePicker
    open: whether the calendar popover or the bottom sheet is open; writing it fires no event
    changeAction: async function run after every user change; the field is busy until it settles
    name: form field name
    value: the date-time YYYY-MM-DDTHH:MM (or with seconds) or empty; the value attribute is the default that reset restores
    defaultValue: the value attribute
    invalid: marks the field invalid without failing constraint validation
    focus: method, focuses the date part
    show: method, opens the calendar popover or the sheet without an intent event
    hide: method, closes it without an intent event
    toggle: method, opens or closes it without an intent event
    requestClose: method, asks to close it as a user would (fires tct-open-change)
    showInvalid: method, displays the current invalidity without submitting
    input: native event when the combined value changes
    change: native event once after input
    tct-enter: cancelable event when Enter is pressed in a part after its text was committed; preventDefault stops implicit submission
    tct-clear: cancelable event when the clear button is pressed; preventDefault keeps the value
    tct-open-change: cancelable event before the user opens or closes the calendar popover or the sheet
    tct-after-open-change: event after it opened or closed and settled
related: [date-input, time-input, calendar, segmented-control]
---

## Purpose

`tct-date-time-input` collects a date and a time of day that belong together: a meeting, a deadline, a
reminder. Two outlined boxes share one label and one row: the date part with its calendar toggle, and the time
part with a clock. The form gets one string, `YYYY-MM-DDTHH:MM` (`YYYY-MM-DDTHH:MM:SS` with seconds), whatever
the language, calendar or time zone. The value is a wall-clock reading and names no zone: keep the zone in
your own data, or store an instant separately.

## When to use

- A date and a time that are one answer: an event start, a deadline, an appointment slot.
- Slots at a fixed cadence (`time-option-interval`), where a list of times saves typing.
- Anywhere you would use `<input type="datetime-local">` and want the Tecton fields and readable typed input.

## Alternatives

- `tct-date-input` for a date alone and `tct-time-input` for a time of day alone.
- `tct-date-range-input` for a period.
- `tct-timestamp` to display a moment that is already known.

## Anatomy

Label (with an optional icon, indicator and info button), description, a row (part `row`) with the date box
(the calendar toggle, the date input, the clear button, the busy spinner) and the time box (a clock and the time
input, part `time-control`), and the detached status message. The calendar opens in a popover (parts
`picker` and `picker-surface`); with `time-option-interval` the time part is a combobox whose listbox (parts
`time-listbox` and `time-option`) opens under the time box. On a compact touch device a bottom sheet holds Date
and Time tabs.

## Variants and states

- `has-seconds`, `hour-format`, `time-increment`, `time-option-interval`, `size`, `number-of-months`,
  `week-starts-on` and `has-clear`.
- `presentation`: popover with typed parts, the bottom sheet, the browser's own inputs, or the adaptive forms;
  the deprecated `native-picker` maps to them. The browser's time input cannot show seconds, step by an
  increment or list times, so a coarse pointer keeps the typed time part then.
- Statuses `error`, `warning`, `success` and `info`, always as the detached message.
- `disabled` (with `disabled-message` both parts stay focusable), `readonly`, `loading`, `required` or `optional`.
- Typing in either part is a draft that commits when the part is left or Enter is pressed; text that is not a
  date or a time is `aria-invalid` and announced once after typing pauses.

## Responsive behaviour

The two boxes share a row (the date box is wider) and wrap onto two lines when the field is narrow. The
calendar opens under the date box. On a compact touch device (`adaptive-bottom-sheet`) a bottom sheet holds a
Date tab with a one-month calendar and a Time tab with hour, minute and AM/PM columns; "Save date" moves to the
time and "Save" closes it.

## Form semantics

Form-associated (`ElementInternals`): it submits `name=2026-03-21T14:30` (an empty string when empty) whatever
the language, calendar or time zone, resets to the `value` attribute, is restored on back navigation, works
with `form="id"` and an external `<label for>`, and joins `<fieldset disabled>`. A date without a time (or the
reverse) is not a value, so `required` stays unmet. `min`, `max` (as date-times), `dateConstraints` and text
that is not a date or a time block the submit; the error is shown after the user acted or a submit attempt.

`input` and then `change` fire when the combined value changes: typed text when its part is left or Enter is
pressed, a pick, a step or a clear. Nothing fires when you set `value`.

## Screen-reader expectations

- The date part is a `role="combobox"` with a dialog popup, named by the label; the time part is a text field
  named "{label} time" (`time-label` renames it), or with `time-option-interval` a combobox with a listbox
  popup, `aria-activedescendant` naming the highlighted time while focus stays in the input.
- Stepping the time with the arrow keys is announced, because a rewritten text field is not spoken.
- Text that is not a date or a time is announced once, assertively, and its part is `aria-invalid`.
- The calendar and the sheet are labelled dialogs; the sheet's tabs are a segmented control named "Date/time
  section".

## Localisation

Both parts read and show the language of the page or the nearest `lang`, in the Gregorian calendar, with the
language's digits and AM/PM markers; the value always uses ASCII digits. The names of the buttons, the
placeholders and the messages come from the locale catalogs; label, description and status text are yours to
translate. The row, the calendar and the columns mirror in right-to-left.

## Consumer responsibilities

- Give the field a `name` to submit it and a `label` always.
- Keep the time zone in your own data, or convert the wall-clock value to an instant where you know the zone.
- Explain why days and times are unavailable in the description; the field only marks and refuses them.
