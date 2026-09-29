---
title: InputGroup
folder: input-group
category: Form Controls
entries: [InputGroup, InputGroupText]
summary: Connects an input with prefix and suffix addons into one field with a shared border, one label and one focus ring.
examples: [basic, url, sizes, status, states, in-form]
keywords: [inputgroup, addon, prefix, suffix, connected, grouped, input, unit, currency, url]
dense:
  description: connects one input with prefix/suffix addons; one label, border and focus ring
  usage: Joins an input with static addons such as "$", "kg" or "https://" into a single visual unit. The group owns the label, description and status; the controls inside keep a hidden label of their own for assistive technology and follow the group's size. Use it with single-line controls only.
  bestPractices:
    - {do: true, text: 'Use tct-input-group-text for static prefixes and suffixes that clarify the format: "$", "kg", "https://".'}
    - {do: true, text: 'Put single-line controls in it: text input, number input, a selector, a typeahead.'}
    - {do: true, text: 'Give each inner control its own specific label and hide it with label-hidden; the group label is what people see.'}
    - {do: false, text: 'Put several text inputs in one group; use separate fields.'}
    - {do: false, text: 'Group unrelated inputs; it is for one input with decorations.'}
    - {do: false, text: 'Use it with a text area, slider, switch, checkbox or radio list.'}
  properties:
    label: label of the group, always rendered for accessibility
    labelHidden: hides the label visually, keeps it for screen readers
    label-hidden: attribute of labelHidden
    description: helper text between the label and the group
    disabled: dims the group and its label; does not disable the controls inside
    optional: shows an Optional indicator; mutually exclusive with required
    required: shows a Required indicator
    size: sm, md, lg; height of the group and default size of the controls inside
    statusType: status tone (error, warning, success, info)
    status-type: attribute of statusType
    statusMessage: status text under the group
    status-message: attribute of statusMessage
    status: object {type, message}; the same as statusType and statusMessage
    labelTooltip: text of an info button after the label
    label-tooltip: attribute of labelTooltip
    default: the addons and controls
    "slot:default": the addons and controls
    "text": default slot of tct-input-group-text, the addon content
---

## Purpose

`tct-input-group` connects one input with prefix or suffix addons in a single visual unit: a currency
field (`$` before the number), a URL field (`https://` before the address), a weight (`kg` after the
value). The whole thing has one border, one label and **one focus ring** around the group, addons
included.

## When to use

- URL, currency, unit and measurement fields.
- A search field with a decorative or textual addon.
- Any single input that needs contextual decoration.

## Alternatives

- A plain `tct-text-input` or `tct-number-input` when the field needs no addon (use `start-icon`, or the
  `start` and `end` slots of the text input, for a glyph inside the box).
- Separate fields, when the inputs are independent (a first and a last name).

## Anatomy

Label (with the Required or Optional indicator and an optional info button), description, the group (part
`group`) holding `tct-input-group-text` addons and one control, and the status message. The controls inside
show no label, description or status of their own; each keeps its `label` for assistive technology.

## Variants and states

- `size` sm, md or lg sets the group height and is the default size of the controls inside; a control
  with its own `size` keeps it.
- Statuses `error`, `warning`, `success` and `info` colour the addon borders and show a detached message
  with an icon. A control inside that displays invalidity colours the addon borders as well.
- `disabled` dims the group and its label. Disable the controls too (`disabled` on each, or a
  `<fieldset disabled>` around the form).

## Responsive behaviour

The group fills its container. The control grows and shrinks; addons keep their content width.

## Form semantics

The group has no value and does not take part in the form: the controls inside submit themselves, with
their own `name`, validation and events.

## Screen-reader expectations

- The group is a `group` named by its label, described by the description and the status message.
- Addon text is not focusable. A screen reader reaches it in reading order.
- Each control keeps its own label, so its name is specific ("Amount" inside "Price").

## Localisation

The Required and Optional indicators and the info button name come from the locale catalogs. Labels,
descriptions, addon text and status messages are yours to translate. In right-to-left text the prefix sits
on the right and the corners mirror.

## Consumer responsibilities

- Give the group and each control a `label`.
- Use single-line controls that draw their box on a part named `input` (`tct-text-input`,
  `tct-number-input`); others keep their own corners.
- Set `disabled` on the controls when the group is disabled.
