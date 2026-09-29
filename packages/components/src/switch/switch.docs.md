---
title: Switch
folder: switch
category: Form Controls
entries: [Switch]
summary: A switch for an on/off setting that takes effect as soon as it is changed, as a form-associated element with label, description and status.
examples: [basic, label-layout, states, async, in-form]
keywords: [switch, toggle, on, off, setting, boolean, preference, enable, disable, slider-toggle]
dense:
  description: on/off switch (role=switch) with label, description, status and async change action; form-associated
  usage: Use for a setting that applies immediately, such as "Enable notifications" or "Dark mode". It is a native checkbox with role=switch, so it announces as a switch and toggles with Space. Give it a name to submit it. For a choice saved with a form's Save button, prefer a checkbox.
  bestPractices:
    - {do: true, text: 'Use it for settings that take effect immediately, with a label that says what turns on.'}
    - {do: true, text: 'Use changeAction for a change that needs a request: the switch shows a spinner and blocks toggling until it settles.'}
    - {do: true, text: 'Use label-spacing="spread" in settings lists so switches align at the row end.'}
    - {do: false, text: 'Use a switch for a choice that is only applied when a form is saved; use a checkbox.'}
    - {do: false, text: 'Label it with the state ("On"); label the setting and let the switch show the state.'}
    - {do: false, text: 'Wrap a disabled switch in a tooltip to explain why; use disabled-message.'}
  properties:
    label: label text, always rendered for accessibility
    labelHidden: hides the label visually, keeps it for screen readers
    label-hidden: attribute of labelHidden
    description: helper text under the label
    optional: shows an Optional indicator; mutually exclusive with required
    required: constraint (must be on), aria-required and a Required indicator
    disabled: disables the switch (also through fieldset disabled)
    disabledMessage: explains why it is disabled; shows a tooltip and keeps it focusable
    disabled-message: attribute of disabledMessage
    readonly: shows the state at full strength but bars changes
    loading: shows a spinner in the thumb and blocks toggling
    labelTooltip: text of an info button after the label
    label-tooltip: attribute of labelTooltip
    labelIcon: icon name before the label text
    label-icon: attribute of labelIcon
    labelPosition: start or end (default); the side of the track the label sits on
    label-position: attribute of labelPosition
    labelSpacing: hug (default) keeps track and label together, spread pushes them to opposite ends
    label-spacing: attribute of labelSpacing
    statusType: status tone (error, warning, success, info)
    status-type: attribute of statusType
    statusMessage: status text under the switch
    status-message: attribute of statusMessage
    status: object {type, message}; the same as statusType and statusMessage
    size: sm or md (default)
    width: width of the whole field; a number is px, a string a CSS length
    name: form field name
    value: the submitted value while on (default on)
    defaultValue: the value attribute
    checked: current state; the checked attribute is the default that reset restores
    defaultChecked: the checked attribute
    invalid: marks the switch invalid without failing constraint validation
    changeAction: async function (checked, event) run after each toggle; busy while pending, reverts if it rejects
    control: the native input inside (read-only)
    focus: method, focuses the input
    input: native event on every user toggle
    change: native event once per user toggle
---

## Purpose

`tct-switch` is a control for a setting that applies as soon as the user changes it: notifications, dark
mode, a feature flag. It is a native checkbox with `role="switch"` under a Tecton track and thumb: the off
track is an outline, the on track is the violet, and the thumb grows and travels to the end of the track.

## When to use

- A setting that takes effect immediately.
- A setting in a list where each row has its own switch (`label-spacing="spread"`).

## Alternatives

- `tct-checkbox-input` for a choice that is saved with the form.
- `tct-toggle-button` for an on/off action in a toolbar.
- `tct-radio-list` for one choice from several.

## Anatomy

The track (part `track`) with the thumb (part `thumb`) over the native input, the label with its info
button and icon, the description and the detached status. `label-position` puts the label before the track.

## Variants and states

- `size` sm (32x20) or md (40x24); `checked`; `label-hidden`; `label-position`; `label-spacing`.
- `disabled` (with `disabled-message` it stays focusable and explains why), `loading` (a spinner in the
  thumb, blocked) and `required` or `optional`.
- Statuses `error`, `warning`, `success` and `info` show a detached message with an icon.
- `changeAction` makes the switch busy while a request settles and restores the old state if it fails.

## Responsive behaviour

The field fills its container; `width` limits it. On coarse pointers the hit target is at least 24px.
Thumb travel and the label position mirror in right-to-left text.

## Form semantics

Form-associated (`ElementInternals`): it submits `name=value` (`on` unless you set `value`) only while on,
resets to the `checked` attribute, restores on back navigation, joins `<fieldset disabled>`, works with
`form="id"` and an external `<label for>`, and supports `required` (it must be on).

`input` and `change` fire once each per user toggle and never when you set `checked`. To control it, set
`checked` from your `change` handler, or cancel the `click` to veto the toggle. Validation is shown after
the user acted; `form.checkValidity()` shows nothing.

## Screen-reader expectations

- A native checkbox with `role="switch"`: announced as a switch, named by its label, described by the
  description and the status, with its on/off state, `aria-required`, `aria-invalid` and `aria-busy`.
- Busy is announced once ("Loading"); a status message is announced once when it appears.
- A switch with a `disabled-message` stays focusable (`aria-disabled`) so the reason can be reached.

## Localisation

Strings ("Required", "Optional", "Loading", the info button name) come from the locale catalogs and follow
the nearest `lang`; a provider's overrides win. The layout and the thumb travel mirror in right-to-left
text. Labels, descriptions and status text are yours to translate.

## Consumer responsibilities

- Give every switch a `label` and, to submit it, a `name`.
- Do not use it for choices that need a Save button.
- Set the state from your own data with `checked`; the element never writes back on its own.
