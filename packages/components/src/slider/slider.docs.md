---
title: Slider
folder: slider
category: Form Controls
entries: [Slider]
summary: A slider for choosing a number or a range of two by dragging or with the keyboard, with marks, a value bubble and localised value text, as a form-associated element.
examples: [basic, range, marks, value-display, vertical, states, in-form]
keywords: [slider, range, thumb, track, volume, price range, min, max, step, marks, ticks, drag, numeric, form]
dense:
  description: form-associated slider for a number or a range; keyboard (arrows, Page, Home/End), marks, value bubble or text, localised aria-valuetext
  usage: Chooses a value in a known range where the approximate position matters more than the exact number, such as volume, brightness or a price range. Set min, max and step; add range for two thumbs. It submits the value under name (a range submits the start and the end). input fires while the value changes and change when a drag ends or a key changed it.
  bestPractices:
    - {do: true, text: 'Use it when a range and a rough position are the point; pair it with a number input when people also need to type an exact value.'}
    - {do: true, text: 'Show the value: a bubble over the thumb (default), or text after the track, and use format-value for units.'}
    - {do: true, text: 'Add marks with labels for the ends or the meaningful steps so the range is readable at a glance.'}
    - {do: true, text: 'Give a range a label that names the pair ("Price range"); the thumbs are named "Minimum value" and "Maximum value".'}
    - {do: false, text: 'Use it for a value people must type exactly, or a range of thousands of steps; use a number input.'}
    - {do: false, text: 'Use a slider for a choice between a few named options; use radio buttons or a segmented control.'}
    - {do: false, text: 'Wrap a disabled slider in a tooltip to explain why; use disabled-message.'}
  properties:
    label: label text, always rendered for accessibility
    labelHidden: hides the label visually, keeps it for screen readers
    label-hidden: attribute of labelHidden
    description: helper text under the label
    optional: shows an Optional indicator; mutually exclusive with required
    required: conveys the field as required with a hidden Required text and an indicator; it is not a constraint
    disabled: disables the slider (also through fieldset disabled)
    disabledMessage: explains why it is disabled; shows a tooltip and keeps the thumbs focusable
    disabled-message: attribute of disabledMessage
    readonly: shows the value but bars changes
    loading: blocks changes and sets aria-busy
    labelTooltip: text of an info button after the label
    label-tooltip: attribute of labelTooltip
    statusType: status tone (error, warning, success, info)
    status-type: attribute of statusType
    statusMessage: status text under the slider
    status-message: attribute of statusMessage
    status: object {type, message}; the same as statusType and statusMessage
    width: width of the field; a number is px, a string a CSS length
    min: smallest value, default 0
    max: largest value, default 100
    step: amount a key press or a snap moves by, default 1
    orientation: horizontal (default) or vertical, where the minimum is at the bottom
    range: two thumbs; the value is a start and an end
    minStepsBetweenThumbs: with range, the least number of steps between the thumbs
    min-steps-between-thumbs: attribute of minStepsBetweenThumbs
    valueDisplay: tooltip (a bubble over the thumb, default), text (after the track) or none
    value-display: attribute of valueDisplay
    formatValue: function (number) => string for the bubble, the text and aria-valuetext
    marks: array of {value, label} ticks; also a JSON attribute
    name: form field name
    value: the value as text, "50" or with range "20,80"; the value attribute is the default that reset restores
    values: the value as an array of numbers
    valueAsNumber: the first value as a number
    defaultValue: the value attribute
    invalid: marks the slider invalid without failing constraint validation
    focus: method, focuses the first thumb
    showInvalid: method, displays the current invalidity without submitting
    input: native event on every change while dragging and with every key
    change: native event when a drag ends with a different value and with every key that changed it
---

## Purpose

`tct-slider` chooses a number, or a range of two, on a track by dragging a thumb, pressing the track, or
with the keyboard. It draws the Tecton track and thumb with the label, description and status around it.
It is a form-associated element that submits the value, and a range submits two entries.

## When to use

- A value in a known range where position matters more than the exact number: volume, brightness,
  opacity, a price range.
- A range between two values (`range`).

## Alternatives

- `tct-number-input` when people need to type an exact value (or next to a slider for both).
- Radio buttons or a segmented control for a choice between a few named options.

## Anatomy

Label, description, the track (part `control`) holding the rail (part `track`), the fill (part `fill`),
optional ticks with labels (parts `mark` and `mark-label`) and one or two thumbs (part `thumb`) with a
value bubble (part `bubble`); the value text after the track (part `value`); and a detached status message.

## Variants and states

- `range` with two thumbs, `orientation` horizontal or vertical, `min`, `max`, `step` and
  `min-steps-between-thumbs`.
- `value-display`: a `tooltip` bubble over the thumb (on hover, focus and while dragging), `text` after the
  track, or `none`; `format-value` for units.
- `marks` ticks with optional labels; a press on a tick snaps to it.
- `disabled` (with `disabled-message` the thumbs stay focusable and explain why), `readonly`, `loading`,
  `required` or `optional`, and statuses `error`, `warning`, `success` and `info`.
- `:state(dragging)` while a thumb is dragged.

## Responsive behaviour

The field fills its container; `width` limits it. The track is the tap target and is at least 24px tall on
touch pointers. The thumb stays inside the track at both ends, and the layout and the pointer mapping
mirror in right-to-left text.

## Form semantics

Form-associated (`ElementInternals`): it submits `name=value`; a range submits two entries, the start and
then the end. It resets to the `value` attribute, is restored on back navigation, works with `form="id"`,
and joins `<fieldset disabled>`. A slider always has a value, so there is no constraint to fail.

`input` fires on every change while dragging and with every key; `change` fires when a drag ends with a
different value and with every key that changed it. Neither fires when you set `value`, which is how you
control the slider.

## Screen-reader expectations

- Each thumb is a `slider` with `aria-valuemin`, `aria-valuemax`, `aria-valuenow` and, when the localised
  or formatted text differs from the number, `aria-valuetext`.
- A single thumb is named by the label and described by the description and the status. A range is a group
  named by the label, and its thumbs are "Minimum value" and "Maximum value"; a thumb cannot pass its
  sibling and its `aria-valuemin` or `aria-valuemax` say so.
- The value bubble is hidden from assistive technology, so the value is announced once.
- A required slider is described by a hidden "Required" text; a `disabled-message` slider stays focusable.

## Localisation

The value is written in the language of the page or the nearest `lang` (`1.234,5` in German) unless you
give `format-value`. "Minimum value", "Maximum value", "Required" and "Optional" come from the locale
catalogs. In right-to-left text the minimum is at the right and Left increases the value, as on a native
range. Labels, descriptions, mark labels and status text are yours to translate.

## Consumer responsibilities

- Give the slider a `label` and, to submit it, a `name`.
- Show the value (the bubble is the default) and use `format-value` for units.
- Read the value from `value`, `values` or the form's data; set `value` from your own state to control it.
