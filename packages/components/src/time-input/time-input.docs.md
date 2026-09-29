---
title: TimeInput
folder: time-input
category: Form Controls
entries: [TimeInput]
summary: A time-of-day field: type a time or step it with the arrow keys, submitted as HH:MM.
examples: [basic, stepping, formats, presentation, states, locale, in-form]
keywords: [time, clock, hour, minute, seconds, timepicker, input, 12-hour, 24-hour, am pm, form, stepper]
dense:
  description: form-associated time-of-day field with a typed input, arrow-key stepping, a native or bottom-sheet picker on touch and HH:MM value
  usage: Collects a wall-clock time of day. People type in their own format (2:30 PM, 14:30, 1430, 2pm); the typed text is a draft that commits when they leave the field or press Enter, and Arrow Up and Down step it by increment minutes. It submits HH:MM (HH:MM:SS with has-seconds) whatever the language and names no date or time zone. hour-format chooses how the committed time is shown.
  bestPractices:
    - {do: true, text: 'Set min and max for opening hours or shifts; typed and stepped times outside them are refused.'}
    - {do: true, text: 'Use increment for the step people expect (15 minutes for appointments).'}
    - {do: true, text: 'Keep the value as the HH:MM string and pair it with a date and a time zone in your own data.'}
    - {do: false, text: 'Use it for durations or countdowns; a time of day is a point on the clock.'}
    - {do: false, text: 'Use it for a date and a time; use tct-date-time-input.'}
  properties:
    label: label text, always rendered for accessibility
    labelHidden: hides the label visually, keeps it for screen readers
    label-hidden: attribute of labelHidden
    labelIcon: icon name before the label text
    label-icon: attribute of labelIcon
    description: helper text between the label and the field
    optional: shows an Optional indicator; mutually exclusive with required
    required: constraint (a time is needed), aria-required and a Required indicator
    disabled: disables the field (also through fieldset disabled)
    disabledMessage: explains why the field is disabled; shows a tooltip and keeps it focusable
    disabled-message: attribute of disabledMessage
    readonly: shows the value but bars edits and stepping; still submitted and in the tab order
    loading: shows a spinner and aria-busy
    placeholder: hint shown when empty, default Select a time
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
    min: earliest time HH:MM; typed and stepped times before it are refused; a native constraint (rangeUnderflow)
    max: latest time HH:MM; a native constraint (rangeOverflow)
    hasSeconds: adds seconds to the field and the value
    has-seconds: attribute of hasSeconds
    hourFormat: 12h (default, 2:30 PM) or 24h (14:30)
    hour-format: attribute of hourFormat
    increment: minutes the arrow keys step by, default 1
    hasClear: shows a clear button while there is a value
    has-clear: attribute of hasClear
    presentation: text-input, popover (the typed field), bottom-sheet, native, adaptive-bottom-sheet or adaptive-native (default)
    nativePicker: deprecated; touch, always or never map to adaptive-native, native and text-input
    native-picker: attribute of nativePicker
    open: whether the bottom sheet is open; writing it fires no event
    changeAction: async function run after every user change; the field is busy until it settles
    autofocus: focuses the field once it has rendered
    name: form field name
    value: the time HH:MM (or with seconds) or empty; the value attribute is the default that reset restores
    defaultValue: the value attribute
    invalid: marks the field invalid without failing constraint validation
    select: method, selects the text of the input
    focus: method, focuses the input
    show: method, opens the bottom sheet without an intent event
    hide: method, closes it without an intent event
    toggle: method, opens or closes it without an intent event
    requestClose: method, asks to close it as a user would (fires tct-open-change)
    showInvalid: method, displays the current invalidity without submitting
    input: native event when the committed time changes (a step, a pick, a clear, typed text when the entry ends)
    change: native event once after input
    tct-enter: cancelable event when Enter is pressed after the draft was committed; preventDefault stops implicit submission
    tct-clear: cancelable event when the clear button is pressed; preventDefault keeps the value
    tct-open-change: cancelable event before the user opens or closes the bottom sheet
    tct-after-open-change: event after the bottom sheet opened or closed and settled
related: [date-input, date-time-input, text-input, number-input]
---

## Purpose

`tct-time-input` collects a time of day: an opening hour, a reminder, the start of a shift. It draws the Tecton
outlined field with a clock, its label, description, Required or Optional indicator and validation status. The
form gets `HH:MM` (or `HH:MM:SS`), whatever the language; the value names no date and no time zone.

## When to use

- A time of day with or without bounds: opening hours, appointment times, alarms.
- People who know the time they want and would rather type it than scroll for it.
- Anywhere you would use `<input type="time">` and want readable typed input, stepping and the Tecton field.

## Alternatives

- `tct-date-time-input` when the date matters too.
- `tct-number-input` for durations and other quantities.
- A native `<input type="time">` when the browser's own control is enough (`presentation="native"` gives it in
  the Tecton field).

## Anatomy

Label (with an optional icon, indicator and info button), description, the box (part `input`) holding a clock,
the text input (part `control`) or, on the native surface, the browser's time input with the field's text painted
over it, the clear button, the busy spinner and the status glyph, and the status message. The bottom-sheet
presentation replaces the clock with a button (part `toggle`), makes the input read-only, and opens a sheet with
hour, minute, second and AM/PM columns (part `panel`).

## Variants and states

- `hour-format` 12h or 24h, `has-seconds`, `increment`, `size` and `has-clear`.
- `presentation`: the typed field (`text-input`, and `popover`, which for a time is the same), a bottom sheet, the
  browser's own input, or the adaptive forms; the deprecated `native-picker` maps to them. The browser's time
  input cannot show seconds or step by an increment, so a coarse pointer keeps the typed field then; an explicit
  `presentation="native"` never falls back.
- Statuses `error`, `warning`, `success` and `info`, `attached`, `detached` or as a `tooltip`.
- `disabled` (with `disabled-message` it stays focusable), `readonly` (no editing and no stepping), `loading`,
  `required` or `optional`.
- Typing is a draft: while it stands the text is muted and, when it is not a time, `aria-invalid` and
  announced once. Leaving the field or pressing Enter commits a readable time inside `min` and `max`.

## Responsive behaviour

The field fills its container; `width` limits it. With a coarse pointer the default hands the choice to the
browser's own time picker; `adaptive-bottom-sheet` shows a bottom sheet on a compact touch device instead.
The sheet's columns scroll and stay reachable at any viewport height.

## Form semantics

Form-associated (`ElementInternals`): it submits `name=HH:MM` (an empty string when empty) whatever the
language, resets to the `value` attribute, is restored on back navigation, works with `form="id"` and an
external `<label for>`, and joins `<fieldset disabled>`. `required`, `min`, `max` and text that is not a time
block the submit. The error is shown after the user acted or a submit attempt; text that is not a time is shown
once typing pauses.

`value` is a string like a native time input's. `input` fires when the committed time changes (a step, a
pick, a clear, typed text when the entry ends) and `change` once after it; neither fires when you set `value`.

## Screen-reader expectations

- A text field named by its label and described by the description and the status; `aria-required` and
  `aria-invalid` follow the constraints and the text.
- Arrow Up and Down step the time and the new time is announced ("2:31 PM"), because a rewritten text field is
  not spoken by itself.
- Text that is not a time is announced once, assertively ("Invalid time").
- The bottom sheet's field is a read-only combobox that opens a labelled dialog; each column is a listbox
  ("Hour", "Minute", "AM/PM") with the picked option selected and unavailable options disabled.

## Localisation

The text is read and shown in the language of the page or the nearest `lang`, with that language's digits and
AM/PM markers (`٢:٣٠ م`, `下午2:30`); the value always uses ASCII digits. The names of the buttons, the
placeholder, the format hint and the messages come from the locale catalogs; label, description and status
text are yours to translate. Layout and the sheet's columns mirror in right-to-left.

## Consumer responsibilities

- Give the field a `name` to submit it and a `label` always.
- Read the time from `value`, never from the text on screen.
- Pair a time with a date and a time zone in your own data: a time of day is not a moment.
