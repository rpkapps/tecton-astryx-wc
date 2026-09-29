---
title: Progress Bar
folder: progress-bar
category: Feedback & Status
entries: [ProgressBar]
summary: Shows the completion progress of a task, determinate or indeterminate.
examples: [basic, variants, indeterminate, custom-format, marks, states]
keywords: [progressbar, progress, loader, loading, linear, determinate, indeterminate, meter]
dense:
  description: progress bar for determinate or indeterminate progress
  usage: A horizontal bar showing the completion progress of a task. Use it for operations where the duration is known, or as an animated indicator when progress cannot be calculated. Supports semantic colour variants, value labels, custom formatting and target marks.
  bestPractices:
    - {do: true, text: 'Use a determinate bar when the total amount of work is known, and indeterminate when it is not.'}
    - {do: true, text: 'Choose a colour variant that matches the context: accent for general progress, success for completion, warning or error for alerts.'}
    - {do: true, text: 'Always provide a label, even if hidden; screen readers need it to announce what is loading.'}
    - {do: false, text: 'Place icons or labels inside the bar; compose them alongside it using layout elements.'}
    - {do: false, text: 'Use a progress bar for instant actions; it is meant for operations that take noticeable time.'}
    - {do: false, text: 'Stack several progress bars for the same operation; use one bar with a value label instead.'}
  properties:
    label: accessible label (required); shown above the bar unless label-hidden
    value: current value, clamped to 0..max (ignored when indeterminate)
    max: maximum value, default 100
    label-hidden: hides the label visually, it stays available to assistive technology
    has-value-label: shows the formatted value beside the label
    formatValueLabel: (value, max) => string, property only; replaces the localised percentage
    variant: accent, success, warning, error or neutral
    indeterminate: animated indicator for unknown progress
    marks: property only; [{value, label}] target ticks on the track, each labelled
    disabled: greyed fill and text for cancelled or inactive operations
related: [skeleton, empty-state]
---

## Purpose

`tct-progress-bar` shows how far along a task is. The bar is determinate when the amount of work is
known and indeterminate (a sliding segment) when it is not. It carries the `progressbar` role, named by
its label, with `aria-valuenow`, `aria-valuemin`, `aria-valuemax` and `aria-valuetext`.

## When to use

Use it for an operation that takes noticeable time: an upload, an import, a multi-step job. Pick the
determinate form as soon as you can compute a fraction, and the indeterminate form for the wait before
that. A goal line or threshold on a determinate bar is a `mark`.

## Alternatives

- `tct-skeleton` for content that is loading into a known layout rather than a task with progress.
- A spinner-style indicator (the `spinner` guide) for short waits with no measurable progress.
- `tct-badge` or `tct-status-dot` for a settled state ("Done", "Failed") instead of a running task.

## Anatomy

- **Base** (`part="base"`): the column holding the label row and the track.
- **Label** (`part="label"`): text naming the operation; visually hidden with `label-hidden`.
- **Value label** (`part="value-label"`): the formatted value, shown with `has-value-label`.
- **Track** (`part="track"`): the rail that carries the progressbar semantics.
- **Fill** (`part="fill"`): the painted segment; carries `data-variant`.
- **Mark** (`part="mark"`): an optional labelled target tick positioned by value; carries
  `data-placement` (`fill` when it sits on the fill, `track` on the bare rail) and `data-variant`. Hovering
  or focusing it reveals its label in a tooltip (`part="tooltip"` inside the mark).

## Variants and states

Five fill colours: `accent` (the Tecton progress colour), `success`, `warning`, `error` (the filled
status roles) and `neutral`. `disabled` greys the fill and the text for cancelled work. A mark takes the
on-colour of the fill when it sits on the fill and the primary text colour when it sits on the bare
track. Indeterminate mode drops the value semantics and animates a segment across the track; under
`prefers-reduced-motion` the slide is slowed down rather than stopped, so activity stays visible.

## Responsive behaviour

The host is a block that fills its container (minimum 48px). The label row wraps neither the label nor
the value: the value is pushed to the end of the row. Marks are positioned in percent of the track, so
they follow the width. In right-to-left contexts the fill grows from the right and the indeterminate
segment slides in the reading direction.

## Form semantics

Not applicable. Progress Bar is not a form control and submits nothing. For a measured quantity that is
not a task (disk use, a rating) the same markup applies but the label should say what is measured.

## Screen-reader expectations

The track is a `progressbar` named by the label (always present, even when hidden). Determinate bars
announce `aria-valuetext`, the localised percentage or your `formatValueLabel` output; a non-finite
value or maximum counts as empty progress and never reads "NaN". Indeterminate bars expose no value.
Marks are kept beside the progressbar, not inside it, as focusable images named by their label, so
they can be reached by keyboard without changing what the progressbar announces. A live announcement of
progress changes is not added: announce completion yourself (for example with a status message) when
the task ends.

## Localisation

The percentage is formatted with `Intl.NumberFormat` for the element's language, so `ar` and `fa` use
their own digits and `tr` places the sign before the number. There are no other built-in strings: the
label and the mark labels are yours to translate. `formatValueLabel` receives the clamped value and the
maximum and should localise its own output.

## Consumer responsibilities

- Provide a `label` for every bar, hiding it visually with `label-hidden` when the surroundings already
  name the task.
- Keep `value` within `0..max` (out-of-range values are clamped for display, not rejected).
- Announce task completion or failure; the bar does not.
- Label every mark; a mark without a label has no accessible name.
- Compose extra text or icons beside the bar with layout elements, not inside it.
