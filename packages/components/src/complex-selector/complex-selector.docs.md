---
title: ComplexSelector
folder: complex-selector
category: Form Controls
entries: [ComplexSelector]
summary: A field whose trigger opens a dialog popover for custom selection content, such as a colour grid, a staged editor or a calendar, with the field chrome, focus handling and form association done for you.
examples: [basic, staged, ghost-toolbar, states, in-form]
keywords: [complex, selector, picker, popover, dialog, custom, colour, range, calendar, trigger, field, form, staged]
dense:
  description: form-associated field with a trigger that opens a dialog popover holding your own selection content; the content commits a value string with commit() and dismisses with hide()
  usage: Put your selection surface in the default slot. It calls commit(value) on the element to choose (a string; encode structured values yourself) and hide() to dismiss; a staged editor keeps its draft and commits only from its Apply button. Set trigger-label (or the trigger-label slot for markup) to what the closed trigger shows for the current value. The popover is a dialog named by the label, focus moves into it and returns to the trigger, and Tab stays inside. Use tct-selector when the choice is a plain list of options.
  bestPractices:
    - {do: true, text: 'Give the content its own accessible structure: a radiogroup, a grid, a tree, or labelled form controls.'}
    - {do: true, text: 'Show the current value in the trigger with trigger-label so people do not open it to read it.'}
    - {do: true, text: 'Commit and dismiss together for a single choice; keep a draft and use an Apply button for a multi-step edit.'}
    - {do: true, text: 'Encode a structured value into the string yourself, for example as JSON, so it can be submitted.'}
    - {do: false, text: 'Use it for a plain list of options; use tct-selector, which has the combobox keyboard contract built in.'}
    - {do: false, text: 'Rely on the trigger to describe content you did not label; the popover is named only by the label.'}
    - {do: false, text: 'Open it while loading; a busy selector does not open.'}
  properties:
    value: the committed value string, or an empty string; the value attribute is the default that form reset restores
    label: label text, always rendered; also the accessible name of the trigger and of the popover dialog
    labelHidden: hides the label visually, keeps it for screen readers
    label-hidden: attribute of labelHidden
    labelIcon: icon name before the label text
    label-icon: attribute of labelIcon
    description: helper text between the label and the field
    optional: shows an Optional indicator; mutually exclusive with required
    required: constraint (a value is needed) and a Required indicator
    disabled: disables the selector (also through fieldset disabled)
    disabledMessage: explains why the selector is disabled; shows a tooltip and keeps it focusable
    disabled-message: attribute of disabledMessage
    readonly: shows the value but the popover does not open
    loading: shows a spinner and aria-busy; a busy selector does not open
    placeholder: hint shown when there is no trigger label; default the localized "Select..."
    labelTooltip: text of an info button after the label
    label-tooltip: attribute of labelTooltip
    statusType: status tone (error, warning, success, info)
    status-type: attribute of statusType
    statusMessage: status text
    status-message: attribute of statusMessage
    status: object {type, message}; the same as statusType and statusMessage
    statusVariant: attached, detached or tooltip (a status button in the box)
    status-variant: attribute of statusVariant
    size: sm, md, lg; unset follows the nearest size provider
    width: width of the field; a number is px, a string a CSS length
    name: form field name
    defaultValue: the value attribute
    invalid: marks the selector invalid without failing constraint validation
    variant: input (bordered field) or ghost (borderless toolbar trigger)
    triggerLabel: text shown in the closed trigger for the current value
    trigger-label: attribute of triggerLabel
    startIcon: icon name at the start of the trigger
    start-icon: attribute of startIcon
    placement: above, below, start or end; which side of the trigger the popover opens on
    alignment: start, center or end along the placement axis
    open: whether the popover is open; reflects; property and attribute writes never emit events
    changeAction: function (value) => void or Promise; the selector is busy while it is pending and the value returns if it rejects
    show: method, opens the popover without an intent event
    hide: method, closes the popover without an intent event; what content calls to dismiss itself
    toggle: method, opens or closes the popover
    requestClose: method, closes as the user would, firing tct-open-change first
    commit: method, called by the content with the chosen value; fires input and change when it differs
    focus: method, focuses the trigger
    showInvalid: method, displays the current invalidity without submitting
    default: slot, the popover content
    start: slot, custom content at the start of the trigger; overrides start-icon
    input: native event when the content commits a different value
    change: native event once after input
    tct-open-change: cancelable event before the user opens or closes the popover; open and reason
    tct-after-open-change: event after the popover opened or closed, however it happened
related: [selector, multi-selector, popover, dialog]
---

## Purpose

`tct-complex-selector` is the shell for a selection that needs more than a list: a trigger that opens a
dialog popover with your content. It supplies what every field needs (label, description, Required or
Optional indicator, status, form association), the trigger and its states, moving focus into the popover and
back, Escape and outside presses, and the busy state of an async change. You supply what to choose from.

## When to use

- A colour or icon grid, a date or range editor, a tree of categories, any staged selection.
- A toolbar trigger (`variant="ghost"`) that opens a small panel of choices.

## Alternatives

- `tct-selector` for a plain list of options, with the select-only combobox keyboard contract.
- `tct-popover` for a panel that is not a field.
- `tct-dialog` for a modal task.

## Anatomy

Label, description, the box (part `input`) holding the start icon (or the `start` slot), the trigger button
(part `trigger`) showing the trigger label (part `value`, or the `trigger-label` slot) or the placeholder,
the busy spinner, the status glyph and the chevron (part `indicator`), and the status message. The popover
(part `popup`, `role="dialog"`) holds your content in a padded box (part `content`).

## Variants and states

- `variant` `input` or `ghost`; `size` sm, md or lg; a start icon; `placement` and `alignment` of the
  popover.
- Statuses `error`, `warning`, `success` and `info`, shown `attached`, `detached` or as a `tooltip`.
- `disabled` (with `disabled-message` it stays focusable and explains why), `readonly`, `loading` (a busy
  selector does not open) and `required` or `optional`.
- The popover is open with `open` or `show()`, and closes with `hide()`, Escape, an outside press or
  `requestClose()`.

## Responsive behaviour

The field fills its container; `width` limits it. The popover is anchored to the trigger, flips to the side
with room and scrolls when the content is taller than the space. It is a popover on every viewport: your
content owns its own layout, and a narrow layout is your content's concern.

## Form semantics

Form-associated: it submits `name=value` (a string, empty when none), resets to the `value` attribute, is
restored on back navigation, works with `form="id"` and `<label for>`, and joins `<fieldset disabled>`.
`required` is a constraint.

`value` is a string; encode a structured value yourself (JSON, an id, `min-max`). The content commits with
`commit(value)`: when the value differs, `input` and then `change` fire; neither fires when you set `value`.
A staged editor commits only from its own Apply button and calls `hide()` to close.

## Screen-reader expectations

- The trigger is a button with `aria-haspopup="dialog"` and `aria-expanded`, named by the label and
  described by the description and status; ArrowDown on it opens the popover.
- The popover is `role="dialog"` named by the label. Focus moves to the first focusable element of your
  content, Tab wraps inside the popover, and Escape or `hide()` returns focus to the trigger.
- Your content owns its inner semantics: a `radiogroup` of choices, a labelled grid or form controls.
- The busy state is `aria-busy`; a busy selector announces nothing and does not open.

## Localisation

The placeholder and the busy and validation messages come from the locale catalogs and follow the page or
nearest `lang`. The label, description, trigger label, status text and everything in your content are yours to
translate. Layout and the popover mirror in right-to-left.

## Consumer responsibilities

- Call `commit(value)` and `hide()` from your content; the selector does not know what a choice is.
- Keep `trigger-label` (or the slot) in step with the value.
- Give the content an accessible structure and labels.
- Give the selector a `name` to submit it, a `label` always, and a message with every status.
