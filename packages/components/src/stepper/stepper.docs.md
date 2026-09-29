---
title: Stepper
folder: stepper
category: Navigation
entries: [Stepper, Step]
summary: An ordered list of steps that shows progress through a sequence; steps can be clickable and long steppers collapse.
examples: [basic, navigable, vertical, on-track, status-and-indicators, density, collapsed, rtl]
keywords: [stepper, step, steps, wizard, progress, sequence, workflow, progress-tracker, multi-step, checkout, onboarding]
dense:
  description: ordered list of steps with progress bar, indicators, status; clickable when navigable; collapses when narrow
  usage: A tct-stepper with tct-step children and an active-step index (zero-based). Steps before it are completed, the active one is current (aria-current=step), the rest are not started. Add navigable to make enabled steps buttons (a click asks to activate through tct-value-change). Steps take a label, description, status, an indicator, optional and content below.
  bestPractices:
    - {do: true, text: 'Use for a multi-step flow where people need to see the sequence and where they are in it.'}
    - {do: true, text: 'Keep step labels short; put detail in description or the step content.'}
    - {do: true, text: 'Use status success, warning or error to report the outcome of a step, not its progress; the word is announced too.'}
    - {do: true, text: 'Add navigable only for non-linear flows where any completed or upcoming step may be visited.'}
    - {do: false, text: 'Use a stepper for switching between views; use tct-tab-list.'}
    - {do: false, text: 'Use a stepper as a progress bar for a single task; use tct-progress-bar.'}
  properties:
    active-step: zero-based index of the active step (attribute active-step)
    activeStep: zero-based index of the active step (attribute active-step)
    orientation: horizontal (default) or vertical
    navigable: enabled steps are buttons; a click or compact control asks to activate a step (non-linear flows)
    label: accessible name of the list (default "Progress"); a host aria-label wins
    density: compact, balanced (default) or spacious vertical padding of every step
    indicator-position: separated (default) puts the indicator in the label row; on-track puts a node on the connector line
    indicatorPosition: separated (default) puts the indicator in the label row; on-track puts a node on the connector line
    minimum-step-width: horizontal only; width in px each step needs before the stepper collapses (default 112)
    minimumStepWidth: horizontal only; width in px each step needs before the stepper collapses (default 112)
    collapsed-variant: horizontal only; with-label-and-controls (default), with-label or hidden-label
    collapsedVariant: horizontal only; with-label-and-controls (default), with-label or hidden-label
    default: tct-step children (stepper) or the step content below the label (step)
    tct-value-change: cancelable, before a user activates a step (value is the requested index)
    step: zero-based index of the step; unset, its position among the siblings
    description: supporting text under the label
    status: accent, success, warning or error; recolours the indicator, swaps in a glyph on non-current steps, announced as a word
    indicator: auto (default), number or none; slot your own into indicator
    disabled: the step cannot be clicked
    optional: appends "Optional" after the label
    end: slot for trailing content in the label row
    index: the step index in use (read-only getter)
    active: this is the active step (read-only getter)
related: [tab-list, breadcrumbs, progress-bar]
---

## Purpose

`tct-stepper` communicates progress through a sequence: the steps of a checkout, an onboarding, an import. Each
`tct-step` shows whether it is completed, in progress or not started against the stepper's `active-step`, with
a progress segment, an indicator (a number, a check once completed, a status glyph or your own), a label, an
optional description and content below. It is a labelled list, not a landmark, and the active step is
`aria-current="step"`.

## When to use

- A multi-step flow where the sequence and the current position matter.
- A non-linear flow (`navigable`) where people may go back or jump ahead.
- A vertical flow where each step reveals its own fields (step content).

## Alternatives

- Switching between views of one thing: `tct-tab-list`.
- A single task's progress: `tct-progress-bar`.
- The place in a hierarchy: `tct-breadcrumbs`.

## Anatomy

- **Frame** (part `frame`) around the **list** (part `list`) and, when collapsed, the **summary** (part `summary`).
- **Step** (part `step` of each `tct-step`): a progress **bar** (part `bar`, or **connectors** in the on-track
  arrangement), an **indicator**, a **label**, an optional **description**, "Optional", end content and content.
- **Compact controls**: previous and next buttons around the summary in a navigable, collapsed stepper.

## Variants and states

- Orientation `horizontal` or `vertical`; `density` `compact`, `balanced`, `spacious`; a step may override it.
- `indicator-position="separated"` (indicator in the label row) or `on-track` (a node on the connector).
- Progress: completed, in progress (current ring), not started (number). Status: `accent`, `success`, `warning`,
  `error` recolours the indicator and, on non-current steps, swaps in a glyph. The step exposes `:state(active)`,
  `:state(completed)` and `:state(disabled)`.
- Clickable (navigable): hover, keyboard focus and pressed fills, each paired with its own text role. A disabled
  step is plain text.
- Connector fill: advancing one step grows the line along the track; every other change lands at once.

## Responsive behaviour

A horizontal stepper measures its own width. When each step gets less than `minimum-step-width` (112px) it
collapses: the steps shrink to their track segment, a summary of the active step shows below it (with previous
and next buttons in a navigable stepper, `collapsed-variant`), and step content stays mounted but hidden so its
state survives. A vertical stepper never collapses. The more steps, the wider the container needed.

## Form semantics

Not applicable: a stepper shows progress, it holds no value. Put the form inside the step content or beside the
stepper, and drive `active-step` from your flow.

## Screen-reader expectations

The list announces as a list named "Progress" (or your `label`); each step is a list item and the active one is
announced as the current step. Indicators are decorative: the status reaches assistive technology as a word next
to the label ("completed", "warning", "error"). A clickable step is a button named "Go to step 2: Payment,
completed". When collapsed, every step keeps its name and status in the accessibility tree and the visual
summary is hidden so the current step is not announced twice.

## Localisation

The built-in strings are the list name, the button names ("Go to step N: label", with a status), "Optional",
the status words and the compact controls' names ("Previous step", "Next step"), from the shared catalogs in
every shipped locale. Labels and descriptions are yours to translate. In right-to-left the bar fills from the
right and the control arrows mirror.

## Consumer responsibilities

- Keep step indexes unique and consecutive (or leave `step` unset and let the position decide).
- Drive `active-step` from your flow; with `navigable`, either accept the requested step or `preventDefault()` the
  `tct-value-change` and set `active-step` yourself.
- Validate before you advance: the stepper only shows the sequence.
- Use status for outcomes (a failed step), not for progress.
