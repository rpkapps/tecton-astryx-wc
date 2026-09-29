---
title: FormLayout
folder: form-layout
category: Layout
entries: [FormLayout]
summary: A layout container that arranges form fields vertically, side by side, or with labels beside their controls, and shares that layout with the fields inside.
examples: [vertical, horizontal, horizontal-labels, nested, default-optionality]
keywords: [formlayout, form layout, form, fieldset, formgroup, formcontainer, fields, vertical, horizontal, labels, optional, required]
dense:
  description: layout container for form fields with consistent spacing and direction; shares direction and default optionality with the fields inside
  usage: A layout container that arranges form fields with consistent spacing and direction. FormLayout handles where fields go, not state or submission. Wrap it in a form for that. Supports vertical (default), horizontal and horizontal-labels directions, and can be nested to mix them.
  bestPractices:
    - {do: true, text: 'Stack fields vertically for most forms; it is the easiest to scan top to bottom.'}
    - {do: true, text: 'Nest a horizontal layout inside a vertical one when fields naturally pair up, like First name + Last name or City + State + ZIP.'}
    - {do: true, text: 'Use horizontal-labels for settings pages where labels sit beside their inputs.'}
    - {do: true, text: 'Set default-optionality so only the exception is marked (only optional fields carry a mark when the form is required by default).'}
    - {do: false, text: 'Use it for form state or submission; it is only layout. Wrap it in a <form> for that.'}
    - {do: false, text: 'Put unrelated fields side by side in a horizontal layout; keep it for fields that belong together.'}
    - {do: false, text: 'Nest horizontal-labels inside another form layout; it uses a grid and needs to be the outermost container.'}
  properties:
    direction: vertical (default) stacks fields, horizontal puts them side by side in equal columns, horizontal-labels puts labels left of controls (collapses at 480px and below)
    default-optionality: the state the form treats as default (optional or required) so only the exception is marked; unset keeps each control's own behaviour
    default: the form fields to arrange
related: [stack, grid, section, card]
---

## Purpose

`tct-form-layout` arranges the fields of a form with consistent spacing and direction, and tells the
fields inside it how to lay themselves out. It is layout only: it holds no state and does not submit.
Wrap it in a `<form>` (or a `tct-form`-style container of your own) for that.

The direction and the default optionality are published to the fields through the `formLayoutContext`
context. `tct-field`, `tct-text-input` and the other controls read it: with `horizontal-labels` a
control puts its label in the first column and itself in the second; with `default-optionality` it marks
only the exception.

## When to use

- The fields of a form or a dialog: `vertical` (default).
- Fields that belong together on one row: nest a `horizontal` layout in a vertical one (first name and
  last name, city and state and ZIP).
- Settings pages where the labels sit to the left of the controls: `horizontal-labels`.
- Marking only the exception: `default-optionality`.

## Alternatives

- A free-form column or row of arbitrary content: `tct-vstack`, `tct-hstack` or `tct-stack`.
- A grid of tiles: `tct-grid`.
- A boxed group of fields with a heading: `tct-section` or `tct-card`, which can contain a form
  layout.

## Anatomy

An inner container (part `base`) that holds the slotted fields. In `vertical` it is a column with a
`--spacing-4` gap; `horizontal` is a grid with equal columns; `horizontal-labels` is a two-column grid
(`auto 1fr`) in which each field renders with `display: contents` so that its label and its control are
the grid items.

## Variants and states

- `direction`: `vertical` (default), `horizontal`, `horizontal-labels`.
- `default-optionality`: `optional` (only required fields show an indicator) or `required` (only optional
  fields do, and unmarked controls also expose `aria-required`). Unset, each control keeps its own
  behaviour.
- Nesting: an inner layout overrides the outer one for its own children, so a horizontal row can sit in
  a vertical form. Do not nest `horizontal-labels` in another layout.

## Responsive behaviour

`horizontal-labels` collapses to a single column when the viewport is 480px wide or narrower (the upstream
breakpoint), so the labels sit above their controls on phones. `vertical` and `horizontal` have no
breakpoints of their own: a `horizontal` layout keeps its columns, so use it for short rows of fields.

## Form semantics

Not a form control and not a form: the fields inside keep their own names, values and validation, and
associate with the nearest `<form>` as usual. The layout only shares its direction and default
optionality with them; under `default-optionality="required"` an unmarked control exposes
`aria-required` (and not the native `required` attribute).

## Screen-reader expectations

The layout adds no role or name of its own. Group related fields with a `<fieldset>` and `<legend>` (or
`role="group"` with a name) around the layout if the group needs a name. The reading order is the source
order, whatever the layout: `horizontal-labels` does not reorder anything.

## Localisation

Not applicable: no strings. Column order follows the direction of the page, so `horizontal-labels` puts
the labels on the right in RTL.

## Consumer responsibilities

- Wrap the layout in a `<form>` for submission, and give each field a label.
- Name a group of fields with a `<fieldset>` and `<legend>` when the group has meaning.
- Keep `horizontal-labels` as the outermost layout and `horizontal` for short rows.
- Style the container through `::part(base)` if you need a different gap.
