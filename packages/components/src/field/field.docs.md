---
title: Field
folder: field
category: Form Controls
entries: [Field, FieldLabel, InputClearButton]
summary: Wraps any control with a label, a description, a required or optional indicator and a validation status, wired for assistive technology.
examples: [basic, indicators, status, group-label, label-options, disabled]
keywords: [field, formfield, formgroup, formcontrol, label, input, required, optional, helpertext, hint, description, status, validation, clear]
dense:
  description: low-level field shell that adds label, description, indicator and status to a native or custom control
  usage: Field wraps custom, native or third-party controls that lack field chrome. Use tct-text-input (or another tct-* control) directly when it already has label, description and status. The label, description and status are elements the field creates next to your control, and it wires aria-labelledby, aria-describedby and the label click for you.
  bestPractices:
    - {do: true, text: 'Wrap custom controls and native inputs that need a label, helper text, a Required or Optional indicator, or a validation status.'}
    - {do: true, text: 'Always provide a label; hide it visually (label-hidden) only when the context makes the control obvious.'}
    - {do: true, text: 'Use group-label to label a group of controls such as a radio group.'}
    - {do: true, text: 'Use status-variant="detached" on checkboxes, switches and sliders so the message does not crowd the control.'}
    - {do: false, text: 'Wrap a control that has its own field chrome (tct-text-input); labels and status would be drawn twice.'}
    - {do: false, text: 'Set both optional and required on one field.'}
    - {do: false, text: 'Slot your own elements named label, description or status; the field owns them.'}
  properties:
    label: label text (required for a11y)
    labelHidden: hides the label visually, keeps it for assistive technology
    label-hidden: attribute of labelHidden
    description: helper text between the label and the control
    inputId: id of the control the label points at; found automatically when omitted
    input-id: attribute of inputId
    labelId: id of the label element the field creates
    label-id: attribute of labelId
    descriptionId: id of the description element
    description-id: attribute of descriptionId
    statusId: id of the status element
    status-id: attribute of statusId
    groupLabel: labels a group of controls (role group with aria-labelledby) instead of a single control
    group-label: attribute of groupLabel
    optional: shows an Optional indicator; mutually exclusive with required
    required: shows a Required indicator (the control's own required attribute still matters)
    disabled: dims the label and stops label clicks focusing the control
    labelIcon: icon name shown before the label text
    label-icon: attribute of labelIcon
    labelTooltip: text of an info button shown after the label
    label-tooltip: attribute of labelTooltip
    statusType: status tone (error, warning, success, info)
    status-type: attribute of statusType
    statusMessage: status text
    status-message: attribute of statusMessage
    status: object {type, message, messageID}; the same as statusType and statusMessage
    statusVariant: attached, detached
    status-variant: attribute of statusVariant
    width: width of the field; a number is px, a string a CSS length
    invalid: read-only, whether the field shows an error
    controlChanged: internal callback for wrapped tct-* controls
    default: slot for the control or group of controls
    "slot:label": the label element the field creates; do not fill
    "slot:description": the description element the field creates; do not fill
    "slot:status": the status element the field creates; do not fill
    indicator: internal text of the Required or Optional indicator on the label element
    click: native click of the clear button, retargeted from the inner button
---

## Purpose

`tct-field` is the shell that turns a control into a form field. It adds a label, an optional
description, a Required or Optional indicator and a validation status, and connects them to the control:
`aria-labelledby` and `aria-describedby` point at the label, description and status the field creates,
and a click on the label or description focuses the control. The chrome is light-DOM elements next to
your control, so every id relationship lives in one tree and works in every supported browser.

`tct-field-label` and `tct-input-clear-button` are the field's parts, documented here because
`tct-text-input` uses them too.

## When to use

- A native `<input>`, `<select>` or `<textarea>` that needs label chrome.
- A custom or third-party control, or a group of controls (radio buttons, a set of checkboxes).
- Anywhere the label, description and status should look and behave exactly like a `tct-text-input`.

## Alternatives

- `tct-text-input`: a text field with the same chrome built in.
- A bare `<label>` and `<input>`, when you need neither description, indicator nor status.
- `tct-field-status` on its own, next to a control that keeps its own label.

## Anatomy

The field box (part `field`) around: the label with an optional icon, indicator and info-tip button; the
description; your control; and the status. Each of label, description and status is an owned element in
the light DOM (`slot="label"`, `slot="description"`, `slot="status"`, marked `data-tct-owned`).
`tct-input-clear-button` is the small close button drawn inside inputs, with the tooltip that names it.

## Variants and states

- `status-type` error, warning, success or info, with `status-variant` `attached` (under the control) or
  `detached` (icon and gap, for controls that would be crowded).
- `required` or `optional` add a text indicator after the label; a form layout that makes one the
  default only shows the other.
- `label-hidden` removes the label visually but keeps it for screen readers.
- `disabled` dims the label. In a horizontal-labels form layout the host steps aside so the parent grid
  can place label and control.
- An error on a wrapped `tct-*` control marks it invalid (`aria-invalid`, `:state(user-invalid)`) without
  waiting for a submit.

## Responsive behaviour

The field is a block that fills its container; `width` limits it. Long labels and messages wrap.

## Form semantics

`tct-field` is not form-associated: the wrapped control keeps its own name, value and validity, and
submits itself. A status set on the field is display only; it does not make the control invalid unless
the control is a `tct-*` element, which receives the error state.

## Screen-reader expectations

- A single control is named by its label (`aria-labelledby`; a click on it
  focuses the control) and described by the description and status (`aria-describedby`).
- `group-label` gives the group `role="group"` (or keeps its own role, such as `radiogroup`) named by the label.
- The status is announced once when it appears or changes, politely.
- The Required and Optional indicator is text after a separator that assistive technology skips, so the
  label reads "Email, Required".
- The label's info-tip is a focusable button named "More information".

## Localisation

The field's strings ("Required", "Optional", "More information") come from the locale catalogs and follow
the page language, or the nearest `lang`. Label, description and status text are yours to translate.
Chrome mirrors in right-to-left.

## Consumer responsibilities

- Give the wrapped control a `name` and, for a native control, mark it `required` yourself when it is;
  the `required` attribute on the field is the indicator.
- Wrap one control or one group. Do not slot elements named label, description or status.
- Put your own error state on native controls (`aria-invalid`) when you set an error status.
