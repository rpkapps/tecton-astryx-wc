---
title: DateRangeInput
folder: date-range-input
category: Form Controls
entries: [DateRangeInput]
summary: A date range field: a button that opens a two-month calendar with optional presets, submitted as an ISO interval.
examples: [basic, presets, span-limits, locale, states, in-form]
keywords: [date range, daterange, range, period, interval, reporting, booking, stay, presets, calendar, start, end]
dense:
  description: form-associated date range field, a trigger button with a two-month range calendar, presets and span limits; ISO interval value
  usage: Collects a start and an end date. The trigger shows the range ("Jan 5 – Jan 9"); the calendar picks the start with the first click and the end with the second, or a preset applies at once. It submits an ISO 8601 interval (2026-01-05/2026-01-09); range reads it as {start, end}. Use min, max and dateConstraints for the days that can be chosen and max-range-span and min-range-span for the length.
  bestPractices:
    - {do: true, text: 'Offer presets for the ranges people pick most (last 7 days, this month); getRange runs each time the picker renders.'}
    - {do: true, text: 'Use max-range-span for rolling windows and min and max for fixed calendar bounds.'}
    - {do: true, text: 'Read value or range in your change handler; keep the dates as YYYY-MM-DD strings.'}
    - {do: false, text: 'Use it for a single date; that is tct-date-input.'}
    - {do: false, text: 'Expect span limits to rewrite an existing value; flag a value that is too long with a status.'}
  properties:
    label: label text, always rendered for accessibility
    labelHidden: hides the label visually, keeps it for screen readers
    label-hidden: attribute of labelHidden
    labelIcon: icon name before the label text
    label-icon: attribute of labelIcon
    description: helper text between the label and the field
    optional: shows an Optional indicator; mutually exclusive with required
    required: constraint (a range is needed) and a Required indicator
    disabled: disables the field (also through fieldset disabled)
    disabledMessage: explains why the field is disabled; shows a tooltip and keeps the trigger focusable
    disabled-message: attribute of disabledMessage
    readonly: shows the range but bars edits; still submitted and in the tab order
    loading: shows a spinner and aria-busy
    placeholder: hint shown when empty, default Select date range
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
    min: earliest day; a range starting earlier is rangeUnderflow
    max: latest day; a range ending later is rangeOverflow
    dateConstraints: array of predicates over a local Date; a day is unavailable when any returns false
    maxRangeSpan: most days a picked range may span, both endpoints counted; never rewrites a longer value
    max-range-span: attribute of maxRangeSpan
    minRangeSpan: fewest days a picked range may span; the start itself stays selectable
    min-range-span: attribute of minRangeSpan
    presets: array of {label, getRange} quick-select ranges beside the calendar
    noClear: hides the clear button, which shows by default while there is a range
    no-clear: attribute of noClear
    numberOfMonths: months side by side, 2 (default) or 1; a bottom sheet always shows one
    number-of-months: attribute of numberOfMonths
    weekStartsOn: first day of the week, 0 to 6 or sun to sat
    week-starts-on: attribute of weekStartsOn
    presentation: popover, bottom-sheet or adaptive-bottom-sheet (default); there is no native range control
    open: whether the picker is open; writing it fires no event
    changeAction: async function run after every user change; the field is busy until it settles
    name: form field name
    value: the range as an ISO interval start/end or empty; the value attribute is the default that reset restores
    range: the range as {start, end} or null; writing it fires no event
    defaultValue: the value attribute
    invalid: marks the field invalid without failing constraint validation
    focus: method, focuses the trigger button
    show: method, opens the picker without an intent event
    hide: method, closes the picker without an intent event
    toggle: method, opens or closes the picker without an intent event
    requestClose: method, asks to close the picker as a user would (fires tct-open-change)
    showInvalid: method, displays the current invalidity without submitting
    input: native event when a user picked a range, applied a preset or cleared it
    change: native event right after input
    tct-clear: cancelable event when the clear button is pressed; preventDefault keeps the value
    tct-open-change: cancelable event before the user opens or closes the picker
    tct-after-open-change: event after the picker opened or closed and settled
related: [calendar, date-input, date-time-input]
---

## Purpose

`tct-date-range-input` collects a period: a reporting window, a stay, a campaign. A button shows the chosen
range and opens a calendar of two months, with optional presets beside it. The form gets an ISO 8601 interval,
`2026-01-05/2026-01-09`, whatever the language, calendar or time zone.

## When to use

- A start and an end date that belong together, where seeing both in one calendar helps.
- Reports and dashboards, where presets ("Last 30 days") do most of the work.
- Bookings with a minimum or maximum length.

## Alternatives

- Two `tct-date-input` fields when the start and the end are separate questions.
- `tct-date-input` for a single date, and `tct-calendar` in range mode for a picker that is not a form field.

## Anatomy

Label (with an optional icon, indicator and info button), description, the box (part `input`) holding a
decorative calendar icon, the trigger button that shows the range (part `control`), the clear button, the busy
spinner and the status glyph, and the status message. The picker (parts `picker` and `picker-surface`) holds a
group of preset buttons (part `presets`) and the range calendar (part `calendar`), or on a compact touch device a
bottom sheet with one month.

## Variants and states

- `number-of-months` 2 (default) or 1, `week-starts-on`, `size`, and `no-clear` to remove the clear button.
- `presets`, `min`, `max`, `dateConstraints`, `max-range-span` and `min-range-span`. A preset that breaks a
  bound or a span is disabled but stays visible; the preset that matches the value has `aria-current`.
- Statuses `error`, `warning`, `success` and `info`, `attached`, `detached` or as a `tooltip`.
- `disabled` (with `disabled-message` it stays focusable), `readonly`, `loading`, `required` or `optional`.

## Responsive behaviour

The field fills its container; `width` limits it. The two-month picker opens under the field. On a compact
touch device (`adaptive-bottom-sheet`, the default) it becomes a bottom sheet with one month and the presets as
a wrapping row above it; a desktop window narrowed to phone width is still a mouse and keeps its popover.

## Form semantics

Form-associated (`ElementInternals`): it submits `name=start/end` (an empty string when empty), resets to the
`value` attribute, is restored on back navigation, works with `form="id"` and an external `<label for>`, and
joins `<fieldset disabled>`. `required`, `min`, `max` and `dateConstraints` are constraints on the value; the
span limits only constrain the pick. The error is shown after the user acted or a submit attempt.

`value` is the interval string; `range` reads and writes `{start, end}` (or `null`). `input` and then `change`
fire when a user picks a range, applies a preset or clears it; nothing fires when you set `value` or `range`.

## Screen-reader expectations

- The trigger is a button named "Reporting period: Jan 5 – Jan 9" (or the placeholder), with
  `aria-haspopup="dialog"` and `aria-expanded`; Enter or Space opens the picker with focus in the calendar.
- The picker is a labelled dialog ("Choose date range"); the presets are a labelled group of buttons, the
  applied one marked `aria-current`, and the calendar announces that the end date is next after the start.
- The trigger stays focusable while busy or with a `disabled-message` (`aria-disabled`).

## Localisation

The range reads in the language of the page or the nearest `lang`, in the Gregorian calendar, with the year
added when the range is not inside the current year. The names of the buttons and the placeholder come from
the locale catalogs; the preset labels are yours to translate. The picker and the presets mirror in
right-to-left.

## Consumer responsibilities

- Give the field a `name` to submit it and a `label` always.
- Read the interval from `value` (or `range`); keep the dates as `YYYY-MM-DD` strings and the time zone in
  your own data.
- Translate your preset labels and keep `getRange` cheap: it runs on every render of the picker.
