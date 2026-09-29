---
title: Timestamp
folder: timestamp
category: Content
entries: [Timestamp]
summary: A moment in time as text: relative, absolute or machine-readable, with a card that reads it in other zones.
examples: [formats, relative, tooltip-entries, values, typography, locale]
keywords: [timestamp, time, date, relative, ago, datetime, time zone, timezone, utc, unix, iso, copy, live]
dense:
  description: semantic time element in tct-text with relative, absolute and machine formats, live updates and a lazily loaded card of zones with copy buttons
  usage: Shows a moment that is already known: a last-edited time, an event, a log line. The reading is in the viewer's own zone and language and the datetime attribute is always UTC. Relative readings ("2 hours ago") have a card with the full date (copyable) on hover and keyboard focus; tooltipEntries lists more lines in other zones and formats. auto is relative for the last week; live keeps a relative reading current.
  bestPractices:
    - {do: true, text: 'Use relative or auto for recent activity and keep the full date one hover away (the card).'}
    - {do: true, text: 'Use system_date_time or unix_seconds for logs and identifiers people copy.'}
    - {do: true, text: 'Name the zones your readers work in with tooltipEntries, preferring regions such as America/New_York over EST.'}
    - {do: false, text: 'Use it to collect a date or a time; that is tct-date-time-input.'}
    - {do: false, text: 'Use it for durations; that is tct-timer.'}
  properties:
    value: the moment as an ISO 8601 string or Unix time (a number: seconds, or milliseconds from 10^12 on); a numeric attribute reads as a number; a value that is not a date renders nothing
    format: relative, relative_short, auto (default), date, date_long, date_weekday, date_time, time, system_date, system_date_time, system_time or unix_seconds
    autoThreshold: seconds after which auto stops being relative, default 604800 (seven days)
    auto-threshold: attribute of autoThreshold
    noTooltip: turns the hover card off; it is on for relative readings and for any reading with tooltipEntries
    no-tooltip: attribute of noTooltip
    tooltipEntries: array of {timezoneID, format, label, isCopyable}, one card line each, in order; timezoneID is an IANA zone or local; an empty array counts as none
    timezoneShown: appends the zone abbreviation to date_time and time (never to the system formats); visible text only
    timezone-shown: attribute of timezoneShown
    live: updates a relative reading as time passes
    type: semantic text type of the wrapper (tct-text), default supporting
    size: font size override (tct-text)
    color: text colour (tct-text), default secondary
    weight: font weight override (tct-text)
    timeElement: the inner time element (the upstream ref)
related: [timer, text, hover-card, date-time-input]
---

## Purpose

`tct-timestamp` shows a moment as text inside a semantic `<time>` element with an ISO 8601 `datetime`. The
reading is in the viewer's own time zone and language: "2 hours ago", "Mar 21, 2026, 2:51 PM", or a machine
shape such as `2026-03-21 14:51:53`. Relative readings and readings with `tooltipEntries` have a card that opens
on hover and on keyboard focus with the full date, in as many zones and formats as you list, each optionally
copyable.

## When to use

- Last-edited times, activity feeds, audit logs, order dates.
- Events that people in several time zones must coordinate: list the zones on the card.
- Machine-readable timestamps people copy (`system_date_time`, `unix_seconds`).

## Alternatives

- `tct-timer` for the time elapsed in an operation that is in progress.
- `tct-date-time-input` to collect a date and a time.
- Plain text for a date that is not a moment (a birthday is a calendar date, not an instant).

## Anatomy

A `tct-text` wrapper (part `text`, carrying type, size, colour and weight) around the `<time>` (part `time`).
With a card, the wrapper is the trigger of a hover card (part `card`) whose content is a definition list (part
`details`): optional labels (part `label`), values (part `value`) and a trailing column of copy buttons (parts
`action` and `copy-button`) that exists only when a line is copyable.

## Variants and states

- `format`: relative, relative_short, auto, date, date_long, date_weekday, date_time, time, system_date,
  system_date_time, system_time or unix_seconds; `auto-threshold`; `timezone-shown`; `live`.
- `type`, `size`, `color` and `weight` as `tct-text`: supporting and secondary by default, `inherit` to match the
  surrounding text.
- The card is on for relative readings and for any reading with `tooltipEntries`; `no-tooltip` turns it off. The
  `<time>` is a tab stop only while a card is attached, and a dashed underline marks it as interactive.

## Responsive behaviour

The reading is inline text and wraps with its surroundings. The card opens above it, stays inside the viewport
and stays open while the pointer or focus is inside it; on touch a tap opens it.

## Form semantics

Not applicable: it displays a moment, it does not collect one. To collect a date and a time use
`tct-date-time-input`. `value` is the instant itself: an ISO string with an offset (or `Z`) or Unix time; an ISO
string without an offset reads in the viewer's zone. The `datetime` attribute is always UTC.

## Screen-reader expectations

- The `<time>` is read as text; a relative reading is named by the full date with the zone spelled out ("March
  21, 2026 at 2:51:53 PM Coordinated Universal Time") because an abbreviation such as "PST" reads as an initialism.
- With a card, the `<time>` is a tab stop; focus opens the card, a labelled dialog ("Timestamp details") that
  stays open while focus is inside it, and Escape closes it.
- A copy button is named "Copy 2026-03-21 14:51:53" and, after copying, "Copied"; the copy is announced politely.
- A value that names no moment renders nothing.

## Localisation

Wording, word order and plural rules of relative readings come from `Intl.RelativeTimeFormat`; month names, digits,
AM/PM markers and the zone abbreviations from `Intl.DateTimeFormat`, always in the Gregorian calendar. The names
of the card and the copy button come from the locale catalogs; the labels of `tooltipEntries` are yours to
translate. The card mirrors in right-to-left.

## Consumer responsibilities

- Pass an instant (an offset or `Z` in the string, or Unix time), not a wall-clock string, unless the viewer's
  zone is what you mean.
- Translate the labels of `tooltipEntries`, and prefer region zones (`America/New_York`) to abbreviations
  (`EST`), which never observe daylight saving.
- Do not rely on a card alone for information people need: it appears on hover and focus.
