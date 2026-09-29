---
title: RadioList
folder: radio-list
category: Form Controls
entries: [RadioList, RadioListItem]
summary: A labelled group of radio options where exactly one can be chosen, as a form-associated radio group with one tab stop.
examples: [basic, rows, orientation, states, in-form, disabled-with-reason]
keywords: [radio, radiolist, radiogroup, options, single, choice, one, exclusive, select]
dense:
  description: labelled radio group; one option chosen; form-associated; roving tabindex with arrow keys
  usage: Use for a single choice from a small set of visible options. Give the list a label and a name, and each option a value. It is one tab stop; arrow keys move and choose. Required blocks the submit while nothing is chosen and focuses the first option.
  bestPractices:
    - {do: true, text: 'Use it when people choose one of two to seven options that should all be visible.'}
    - {do: true, text: 'Give every option a specific label; add a description for options that need context.'}
    - {do: true, text: 'Preselect the safest or most common option with the value attribute when there is one.'}
    - {do: false, text: 'Use it for a long list; use a selector.'}
    - {do: false, text: 'Use it when several options can be chosen; use a checkbox list.'}
    - {do: false, text: 'Use one for a single yes/no choice; use a checkbox or a switch.'}
  properties:
    label: label of the group, always rendered for accessibility
    labelHidden: hides the label visually, keeps it for screen readers
    label-hidden: attribute of labelHidden
    description: helper text under the label
    optional: shows an Optional indicator; mutually exclusive with required
    required: constraint (an option must be chosen), aria-required and a Required indicator
    disabled: disables the list (also through fieldset disabled)
    disabledMessage: explains why it is disabled; shows a tooltip and keeps the options focusable
    disabled-message: attribute of disabledMessage
    readonly: shows the choice at full strength but bars changes
    orientation: vertical (default) or horizontal
    size: sm or md (default)
    labelTooltip: text of an info button after the label
    label-tooltip: attribute of labelTooltip
    statusType: status tone (error, warning, success, info)
    status-type: attribute of statusType
    statusMessage: status text under the group
    status-message: attribute of statusMessage
    status: object {type, message}; the same as statusType and statusMessage
    width: width of the whole field; a number is px, a string a CSS length
    name: form field name
    value: the chosen option's value; the value attribute is the default that reset restores
    defaultValue: the value attribute
    invalid: marks the list invalid without failing constraint validation
    focus: method, focuses the chosen option, else the first enabled one
    input: native event when the user chooses another option
    change: native event once after input
    "slot:default": the options
    checked: read-only, whether an option is the list's value
    isDisabled: read-only, whether an option is disabled by itself or by its list
    focusTarget: read-only, the radio element of an option that takes focus
    aria-label: names the radio of an option (not the row); use it when a rich label has no text
    "slot:label": rich label of an option
    "slot:description": rich description of an option
    "slot:start": content after the radio and before the label
    "slot:end": content after the label area
---

## Purpose

`tct-radio-list` is a group of radio options where one can be chosen: a size, a plan, a delivery method.
It draws the Tecton radio (no accent: an empty ring, and a dot in the chip colour when chosen), the group's
label and description, a detached status and a reason for being disabled. It is one tab stop, and the
arrow keys move and choose.

## When to use

- One choice from a small set of options that should all be visible.
- A setting where seeing the alternatives helps the choice.

## Alternatives

- `tct-checkbox-list` when several options can be chosen.
- A selector for a long list, or when space is short.
- `tct-segmented-control` for a compact choice that changes what is shown.

## Anatomy

The group label with its Required or Optional indicator and info button, the description, the options
(each: a radio, an optional start content, the label, a description and end content) and the detached
status. The radio is a `role="radio"` element inside each option; its circle is the shared radio indicator.

## Variants and states

- `orientation` vertical or horizontal; `size` sm or md; `label-hidden`.
- Options take a `description`, a rich label, and `start` and `end` content; an option can be `disabled`.
- The list can be `disabled` (with `disabled-message` the options stay focusable and the group explains
  why), `readonly`, `required` or `optional`.
- Statuses `error`, `warning`, `success` and `info` show a detached message with an icon.

## Responsive behaviour

The group fills its container; `width` limits it, and a horizontal group wraps. On coarse pointers each
radio's hit target is at least 24px, and a click anywhere on an option's row chooses it.

## Form semantics

Form-associated on the group (`ElementInternals`): it submits `name=value` of the chosen option (nothing
while none is chosen), resets to the `value` attribute, restores on back navigation, joins `<fieldset
disabled>`, works with `form="id"` and an external `<label for>`, and supports `required`: a blocked submit
focuses the first enabled option and shows the error.

`input` and `change` fire once each when the user chooses another option, and never when you set `value`.
`value` is the current choice and the `value` attribute its default. To control it, set `value` from your
`change` handler. Validation is shown after the user acted; `form.checkValidity()` shows nothing.

## Screen-reader expectations

- A `radiogroup` named by its label and described by the description and status, with `aria-required`,
  `aria-readonly` and `aria-invalid` as they apply; each option is a `radio` named by its label (a rich
  label through `aria-labelledby`, or your `aria-label`), described by its description, and `aria-checked`.
- One tab stop for the whole group; arrow keys move focus and choose. Links and buttons inside an option
  stay reachable with Tab.
- A status message is announced once when it appears.
- A list with a `disabled-message` keeps its options focusable (`aria-disabled`) so the reason can be found.

## Localisation

Strings ("Required", "Optional", the info button name) come from the locale catalogs and follow the nearest
`lang`; a provider's overrides win. The layout and the arrow keys mirror in right-to-left text. Labels,
descriptions and status text are yours to translate.

## Consumer responsibilities

- Give the list a `label` (and a `name` to submit it) and every option a unique, non-empty `value` and a
  `label`.
- Give a rich-label option an `aria-label` when its label has no text.
- Do not put controls that choose the option in `end`; a click on a link or button there keeps its own meaning.
