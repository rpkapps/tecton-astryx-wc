---
title: Calendar
folder: calendar
category: Form Controls
entries: [Calendar]
summary: A month grid for picking a date or a date range, with the APG date-grid keyboard model.
examples: [basic, range, constraints, months-and-weeks, locale, rtl, navigation]
keywords: [calendar, date, datepicker, month, grid, range, week, day, picker, availability, unavailable]
dense:
  description: month grid for one date or a range; keyboard-complete date grid, constraints, week numbers, two months, any locale
  usage: The picker surface behind the date fields, usable on its own for scheduling and availability views. It holds its own selection (value), fires tct-value-change before a user pick and then input and change, and never fires for a property write. Dates are calendar dates (YYYY-MM-DD), never instants, and display in the Gregorian calendar with the language's month names and digits.
  bestPractices:
    - {do: true, text: 'Set min, max, dateConstraints and the range-span limits so unavailable days are visible but cannot be picked.'}
    - {do: true, text: 'Read the value from the change event; in range mode it is {start, end}.'}
    - {do: true, text: 'Use navigateTo() to show a month you know is relevant, for example the month of an existing booking.'}
    - {do: false, text: 'Use it as a form field on its own; tct-date-input, tct-date-range-input and tct-date-time-input own the form value.'}
    - {do: false, text: 'Store a picked date as a Date or an instant; keep the YYYY-MM-DD string and put the time zone in your own data.'}
  properties:
    mode: single (one date) or range (a start and an end)
    value: the selected date YYYY-MM-DD, or in range mode {start, end} as a property or the attribute start/end (an ISO interval); never fires an event
    numberOfMonths: 1 or 2 panes side by side
    number-of-months: attribute of numberOfMonths
    min: earliest selectable date
    max: latest selectable date
    dateConstraints: array of predicates over a local Date; a day is unavailable when any returns false
    maxRangeSpan: most days a range may span, both endpoints counted; later days are disabled once the start is picked
    max-range-span: attribute of maxRangeSpan
    minRangeSpan: fewest days a range may span; the start itself stays selectable
    min-range-span: attribute of minRangeSpan
    focusDate: the visible month (and the day that is the tab stop) as YYYY-MM-DD; follows the page the user turns to
    focus-date: attribute of focusDate
    noOutsideDays: hides the days of the neighbouring months
    no-outside-days: attribute of noOutsideDays
    hasWeekNumbers: shows the ISO week number of each row
    has-week-numbers: attribute of hasWeekNumbers
    hasVariableRowCount: months take as many week rows as they need instead of six
    has-variable-row-count: attribute of hasVariableRowCount
    weekStartsOn: 0 (Sunday) to 6, or sun to sat
    week-starts-on: attribute of weekStartsOn
    navigateTo: method, shows the month of a date and makes it the tab stop, without an event
    focus: method, focuses the tab stop of the grid
    input: native event after a user pick changed the value
    change: native event once after input
    tct-value-change: cancelable event before a user pick changes the value; the first click of a range does not fire it
    tct-focus-date-change: cancelable event before the user moves the visible month; carries focusDate and reason
related: [date-input, date-range-input, date-time-input, icon-button]
---

## Purpose

`tct-calendar` shows a month (or two) as a grid of days and lets people pick one date or a range. It is the
surface behind `tct-date-input`, `tct-date-range-input` and `tct-date-time-input`, and it works on its own
for a booking view or an availability picker. It follows the APG date-grid keyboard model and is the same in
every language and in right-to-left scripts.

## When to use

- Picking a date or a range where seeing the month helps: bookings, reports, availability.
- Showing which days are available, with the unavailable ones staying visible.
- Anywhere a date field would ask people to type a date they cannot see in context.

## Alternatives

- `tct-date-input` when a form needs a date field: it types, validates and submits the date.
- `tct-date-range-input` for a range field with presets, and `tct-date-time-input` when the time matters.
- A plain `<input type="date">` when the browser's own picker is enough.

## Anatomy

A header (the previous and next month buttons and the visible month or months), one grid per month (the weekday
names, optional week numbers and the days), and the day buttons. A day can be selected, in a range, today, from
a neighbouring month (`data-outside`) or unavailable. The parts are `calendar`, `header`, `nav`, `month-year`,
`months`, `grid`, `day-name`, `week-number` and `day`.

## Variants and states

- `mode` single or range; `number-of-months` 1 or 2; `week-starts-on`; `has-week-numbers`;
  `has-variable-row-count`; `no-outside-days`.
- `min`, `max`, `dateConstraints`, `max-range-span` and `min-range-span` make days unavailable: they keep
  their place, are `aria-disabled` and use the disabled text role.
- Hover, keyboard focus, selected, in range, today and unavailable days each have their own colours; the
  selected day uses the primary action fill with its own text roles, and forced colours use the system
  highlight.

## Responsive behaviour

The calendar has the width of its content (about 18rem per month) and never shrinks below it. Put it in a
container that can hold two months before asking for `number-of-months="2"`; the date fields show one month in
a bottom sheet on a compact touch device.

## Form semantics

Not form-associated: it is a picker surface. The value is a date `YYYY-MM-DD` in single mode and `{start, end}`
in range mode (the attribute is an ISO interval `2026-03-01/2026-03-07`). The element holds its own selection:
setting `value` never fires an event, and a user pick fires the cancelable `tct-value-change`, then `input` and
`change`. In range mode the first click of a range fires nothing.

## Screen-reader expectations

- Each month is a `role="grid"` with column headers; days are buttons named with the full date ("Wednesday,
  March 18, 2026"), selected days are `aria-selected`, today is marked, unavailable days are `aria-disabled`.
- Turning the page announces the new month; picking the start of a range announces that the end is next.
- The previous and next buttons stay focusable when a limit disables them, so the reason can be found.
- One tab stop per month grid: the selected day, else today, else the first available day.

## Localisation

Month and weekday names, digits and the label of the visible month follow the nearest `lang` (German, Hebrew,
Arabic and Japanese all work), always in the Gregorian calendar. In right-to-left the grid mirrors: ArrowLeft
moves to the next day and the header buttons swap sides. The button and status texts come from the locale
catalogs; the `week-starts-on` choice is yours.

## Consumer responsibilities

- Keep the picked date as the `YYYY-MM-DD` string; never convert it to a `Date` at midnight.
- Tell people why days are unavailable (in the surrounding text); the calendar only marks them.
- Provide the surrounding label: the calendar is a grid, not a labelled field.
