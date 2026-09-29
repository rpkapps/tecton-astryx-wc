---
title: Timer
folder: timer
category: Content
entries: [Timer]
summary: A self-updating readout of the time elapsed in an active operation.
examples: [formats, start-time, inline]
keywords: [timer, elapsed, duration, seconds, minutes, hours, stopwatch, waiting, loading, processing]
dense:
  description: standardised elapsed or stopwatch duration that updates itself without re-rendering
  usage: Use for the elapsed time of an active operation. The element writes its own text once per visible change, so a page full of timers stays cheap. Elapsed format updates by the second below an hour and by the minute after it; clock format stays second-precise.
  bestPractices:
    - {do: true, text: 'Use elapsed for compact durations that may span seconds, minutes or hours.'}
    - {do: true, text: 'Use clock for stopwatch surfaces where seconds stay meaningful after an hour.'}
    - {do: true, text: 'Pass startTime when the operation began before the timer connected, so the readout shows the whole wait.'}
    - {do: false, text: 'Use the timer for dates, time zones or relative calendar language; that is a timestamp.'}
    - {do: false, text: 'Add aria-live unless hearing an announcement every tick is appropriate for the task.'}
  properties:
    start-time: operation start as Unix milliseconds (also the startTime property); omit to count from connection
    format: elapsed (compact units) or clock (m:ss, h:mm:ss)
    type: semantic text type of the wrapper (tct-text), default supporting
    size: font size override (tct-text)
    color: text colour (tct-text), default secondary
    weight: font weight override (tct-text)
related: [text, progress-bar]
---

## Purpose

`tct-timer` shows how long something has been running. It renders a native `<time>` element whose text and
ISO 8601 `datetime` it keeps current on its own: no re-render, no application state, one wake-up per
visible change.

## When to use

Use it beside active work whose duration matters to the reader: an upload, a build, a call, a model that
is thinking. Pair it with a `tct-progress-bar` or a status when the task has a result to come.

## Alternatives

- A timestamp element for dates, times of day and relative calendar language ("3 days ago").
- `tct-progress-bar` when the reader needs how much is left rather than how much has passed.
- `tct-text` for a duration that is fixed and does not count.

## Anatomy

- **Wrapper** (`part="text"`): a `tct-text` that carries type, size, colour and weight.
- **Time** (`part="time"`, `timeElement`): the `<time>` holding the reading, in tabular numerals so the
  digits do not jitter as they change.

## Variants and states

`format="elapsed"` (default) reads `34s`, `2m 08s`, then `1h 02m` (the seconds drop after an hour and the
readout changes every minute). `format="clock"` reads `2:08`, then `1:02:33`, and stays second-precise. A start
time in the future reads zero until it arrives. Typography defaults to `supporting` in the secondary text
colour; `type="inherit" color="inherit"` matches the surrounding text.

## Responsive behaviour

The timer is inline text and flows with its line. Numerals are tabular, so the width changes only when a
unit is added (`59s` to `1m 00s`).

## Form semantics

Not applicable.

## Screen-reader expectations

The reading is a native `<time>` in the reading order, with no role and no live region: a screen reader
reads it where it is, and it does not announce every tick. Set `aria-live="polite"` on the element only when a
periodic announcement is what the task needs (for example, at long intervals). The `datetime` value carries
the machine-readable duration.

## Localisation

Digits and unit letters follow the language of the element (`Intl.NumberFormat`): Arabic-Indic digits
for `ar-EG`, the locale's narrow unit symbols in `elapsed`. The `clock` shape uses `:` between the fields.
Changing the page language re-formats the readout at once.

## Consumer responsibilities

- Pass `startTime` for work that began before the element connected.
- Do not put the timer inside a live region unless announcements every second are intended.
- Stop showing the timer (remove it) when the operation ends; it counts for as long as it is connected.
- Keep enough width for the readout to grow by a unit without shifting neighbours.
