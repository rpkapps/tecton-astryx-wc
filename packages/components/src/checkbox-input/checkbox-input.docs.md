---
title: CheckboxInput
folder: checkbox-input
category: Form Controls
entries: [CheckboxInput, CheckboxList, CheckboxListItem]
summary: A checkbox for a single on/off choice or a partial state, and a labelled group of checkbox options that submits every checked value.
examples: [basic, states, indeterminate, in-form, list, list-rows, list-async, disabled-with-reason]
keywords: [checkbox, check, toggle, tick, indeterminate, boolean, tristate, checkboxlist, multi, multiple, options, select-all, terms, opt-in]
dense:
  description: single on/off checkbox with label, description, mixed state and status; checkbox list for several choices
  usage: CheckboxInput toggles a single value such as terms acceptance or an opt-in; give it a name to submit it. CheckboxList groups several options under one label and submits one entry for each checked value. Both are form-associated, reset to their checked attributes and show validation only after the user acted.
  bestPractices:
    - {do: true, text: 'Always provide a visible label so people know what they are toggling; use label-hidden only when the surrounding context makes it obvious.'}
    - {do: true, text: 'Add a description for choices that need context, such as what "Share usage data" shares.'}
    - {do: true, text: 'Use indeterminate for a select-all box when only some items of a group are selected.'}
    - {do: true, text: 'Use tct-checkbox-list for several related choices: one label, one status, one submitted list of values.'}
    - {do: false, text: 'Use a checkbox for mutually exclusive choices; use a radio list.'}
    - {do: false, text: 'Use a checkbox for an action that takes effect immediately; use a switch or a button.'}
    - {do: false, text: 'Wrap a disabled checkbox in a tooltip to explain why; use disabled-message.'}
  properties:
    label: label text, always rendered for accessibility
    labelHidden: hides the label visually, keeps it for screen readers
    label-hidden: attribute of labelHidden
    description: helper text next to the label
    optional: shows an Optional indicator; mutually exclusive with required
    required: constraint (must be checked), aria-required and a Required indicator
    disabled: disables the control (also through fieldset disabled)
    disabledMessage: explains why it is disabled; shows a tooltip and keeps it focusable
    disabled-message: attribute of disabledMessage
    readonly: shows the state at full strength but bars changes; still submitted
    loading: shows a spinner in the box and blocks toggling
    labelTooltip: text of an info button after the label
    label-tooltip: attribute of labelTooltip
    labelIcon: icon name before the label text
    label-icon: attribute of labelIcon
    statusType: status tone (error, warning, success, info)
    status-type: attribute of statusType
    statusMessage: status text under the control
    status-message: attribute of statusMessage
    status: object {type, message}; the same as statusType and statusMessage
    size: sm or md (default)
    width: width of the whole field; a number is px, a string a CSS length
    name: form field name
    value: the submitted value while checked (default on)
    defaultValue: the value attribute
    checked: current state; the checked attribute is the default that reset restores
    defaultChecked: the checked attribute
    indeterminate: shows the mixed state; a user click makes it checked
    invalid: marks the control invalid without failing constraint validation
    changeAction: async function (checked, event) run after each toggle; busy while pending, reverts if it rejects
    control: the native input inside (read-only)
    focus: method, focuses the input
    input: native event on every user toggle
    change: native event once per user toggle
    values: array of the checked option values of a checkbox list; the checked attributes are the default
    density: row spacing of a checkbox list (compact, balanced, spacious)
    has-dividers: attribute of hasDividers
    hasDividers: shows dividers between the options of a list
    "slot:default": the options of a checkbox list
    aria-label: names the checkbox of a list item (not the row); use it when a rich label has no text
    "slot:end": slot of a list item for content after the label
    "slot:label": rich label of a list item
    "slot:description": rich description of a list item
    isDisabled: read-only, whether a list item is disabled by itself or by its list
    isBusy: read-only, whether a list item is loading or has a pending action
---

## Purpose

`tct-checkbox-input` is a checkbox for one on/off value: accepting terms, opting in, choosing an
option. It draws the Tecton chip (a bright box, a dark check mark), and everything around it: label with
an optional icon, description, Required or Optional indicator, a detached status and a reason for being
disabled. `tct-checkbox-list` groups several checkboxes under one label; each `tct-checkbox-list-item` is a
list row with a checkbox at its start.

## When to use

- A single yes/no choice that is saved with the form.
- "Select all" with the mixed state, above a group of checkboxes.
- Several independent choices in one group: `tct-checkbox-list`.

## Alternatives

- `tct-radio-list` when only one option can be chosen.
- `tct-switch` for a setting that takes effect immediately.
- `tct-toggle-button` for an on/off action in a toolbar.

## Anatomy

Checkbox: the box (`tct-checkbox-indicator`, exported as parts `checkbox-indicator`,
`checkbox-indicator-check` and `checkbox-indicator-dash`) over the native input, the label with its info
button and icon, the description, and the detached status. The list adds the group label, description and
status, and the options as rows.

## Variants and states

- `size` sm or md; `checked`, `indeterminate`; `label-hidden`.
- `disabled` (with `disabled-message` it stays focusable and explains why), `readonly` (full-strength
  state, no changes), `loading` (a spinner in the box, blocked) and `required` or `optional`.
- Statuses `error`, `warning`, `success` and `info` show a detached message with an icon.
- A list has `density`, `has-dividers`, a group-level `disabled-message` and `changeAction`, which shows a
  spinner only on the toggled option.

## Responsive behaviour

The field fills its container; `width` limits it. On coarse pointers the hit target is at least 24px.
List rows use the list's density; long labels wrap or truncate like any row.

## Form semantics

Both are form-associated (`ElementInternals`). A checkbox submits `name=value` (`on` unless you set
`value`) only while checked; a list submits one `name=value` entry for each checked option. They reset to
the `checked` attributes, restore on back navigation, join `<fieldset disabled>`, work with `form="id"` and
an external `<label for>`, and support `required` (a checkbox must be checked; a list needs one option).

`input` and `change` fire once each per user toggle and never when you set `checked` or `values`. The
`checked` attribute is the default; the property is the current state. To control a checkbox, set `checked`
from your `change` handler, or cancel the `click` to veto the toggle. Validation is shown after the user
acted (a change, leaving after an edit, a submit attempt); `form.checkValidity()` shows nothing.

## Screen-reader expectations

- A checkbox is a native `checkbox` named by its label, described by the description and status, with
  `aria-checked` mixed when indeterminate, `aria-required`, `aria-readonly` and `aria-invalid` as they apply.
- A list is a `group` named by its label; each option is one tab stop, named by its label (a rich label
  through `aria-labelledby`, or your `aria-label`) and described by its description.
- A status message is announced once when it appears; the browser's required message is shown after the
  user acted.
- A control with a `disabled-message` stays focusable (`aria-disabled`) so the reason can be reached.

## Localisation

Strings ("Required", "Optional", the info button name, the hidden name of a rich-label option) come from
the locale catalogs and follow the nearest `lang`; a provider's overrides win. The layout mirrors in
right-to-left. Labels, descriptions and status text are yours to translate.

## Consumer responsibilities

- Give every checkbox a `label`, and a `name` to submit it; give every option a `value`.
- Give a rich-label option an `aria-label` when its label has no text.
- Do not put focusable content that toggles the option in `end`; a click on a link or button there keeps its
  own meaning and does not toggle.
