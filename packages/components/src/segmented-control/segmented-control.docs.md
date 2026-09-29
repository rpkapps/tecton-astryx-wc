---
title: Segmented Control
folder: segmented-control
category: Action
entries: [SegmentedControl, SegmentedControlItem]
summary: A single choice from a small set of mutually exclusive options, all visible at once; a radio group that selects on focus.
examples: [basic, sizes, layout-fill, icons, disabled, in-form, rtl]
keywords: [segmented-control, segmented, radio, tabs, toggle, toggle-group, pill, button-group, switch, segment, control, choice, mode, view-switcher]
dense:
  description: segmented radio group for one choice from 2-5 visible options; selection follows focus; form-associated when named
  usage: A strip of tct-segmented-control-item children where exactly one option is the value. Use it when all options should be visible and the choice sets a value or mode, not page navigation. It is a radio group: one Tab stop, arrows move focus and selection together. Give it a `label`; add `name` to submit it in a form.
  bestPractices:
    - {do: true, text: 'Use for switching between 2-5 mutually exclusive views or modes where all options should be visible.'}
    - {do: true, text: 'Give the control a descriptive `label`; it is the radio group name and is never painted.'}
    - {do: true, text: 'Use `disabled-message` to explain a disabled control; the reason is the tooltip and the accessible description.'}
    - {do: false, text: 'Use for page-level navigation; use tabs or links. A segmented control is an input that always has one selected option.'}
    - {do: false, text: 'Use for simple on/off states; use tct-toggle-button or tct-switch.'}
    - {do: false, text: 'Wrap a disabled control in a tooltip; disabled controls swallow the hover events it needs.'}
  properties:
    value: current selection (property); the value attribute is the initial selection; user selection fires input then change
    defaultValue: the initial selection (attribute value)
    label: accessible name of the radio group (never painted)
    size: sm, md (default) or lg; unset follows a size provider
    layout: hug (default) sizes to content; fill stretches segments equally
    disabled: disables the whole control
    disabledMessage: why the control is disabled; shows as a tooltip and description (attribute disabled-message)
    disabled-message: why the control is disabled; shows as a tooltip and description
    name: form field name; makes the control submit its value
    required: a selection is required for the form to submit
    readonly: blocks changing the selection
    invalid: marks the control invalid
    default: tct-segmented-control-item children
    input: fired when the user selects a segment (composed)
    change: fired once after input when the user selects a segment
    selected: item is the control value (read-only getter)
    isDisabled: item is disabled itself or by the control (read-only getter)
    labelHidden: item shows only its icon; label stays the accessible name (attribute label-hidden)
    label-hidden: item shows only its icon; label stays the accessible name
    icon: slot for an icon before the item label
related: [button-group, toggle-button, toolbar, tab-list]
---

## Purpose

`tct-segmented-control` presents a small set of mutually exclusive choices as one connected strip. It
controls a value or a mode (a view, a range, a density), so it behaves as a radio group: one Tab stop,
arrow keys move focus and selection together, Home and End jump to the ends, and Tab moving into the
group never changes the value. Each choice is a `tct-segmented-control-item` with a `label` and an
optional icon.

## When to use

- Switching between two to five views or modes where every option should stay visible.
- Choosing a value in a form, with `name` (the control is form-associated).
- Compact filters in a toolbar (`size` cascades from the toolbar).

## Alternatives

- Page or panel navigation: tabs or links. Tabs control a view; a segmented control controls a value.
- An independent on/off choice: `tct-toggle-button`, or `tct-switch` for a setting.
- Several independent choices: `tct-toggle-button-group` with `type="multiple"`.
- Related actions rather than a choice: `tct-button-group`.
- More than about five options: a selector.

## Anatomy

- **Control** (part `control`): the strip; it is the radiogroup element and paints the track.
- **Segment** (part `item` of each `tct-segmented-control-item`): one choice; the item host is the radio
  and the keyboard focus target.
- **Label** (part `label`): the visible text, unless `label-hidden`.
- **Icon**: an optional icon in the `icon` slot, sized from the control size.
- **Keyboard hint** (part `keyboard-hint`): "← → to navigate", shown once on first keyboard entry.

## Variants and states

- Sizes `sm`, `md`, `lg`; `layout="hug"` (content width) or `fill` (equal shares, long labels truncate).
- Selected: a flat filled segment (Tecton tab strip roles), no shadow, no weight change. The item exposes
  `:state(selected)` and `:state(disabled)`; the control exposes `:state(disabled)` and `:state(user-invalid)`.
- Hover and pressed are the shared overlay washes on unselected segments.
- Disabled: the whole control, one segment, or a control with a `disabled-message`. A disabled control
  without a reason leaves the tab order; with a reason the selected segment stays focusable so the
  tooltip can be reached by keyboard. Selection is blocked either way.

## Responsive behaviour

`hug` controls take their content width; put them in a flex or grid parent that does not stretch them.
`fill` takes the container width and lets segments shrink, truncating labels with an ellipsis. Prefer
icon-only segments (`label-hidden`) when the row must stay narrow.

## Form semantics

Form-associated when it has a `name`: it submits `name=value` (nothing while empty), `form.reset()` returns
to the `value` attribute, a disabled `<fieldset>` disables it, and the browser can restore it. `required`
reports `valueMissing` with the browser's radio-group message, shows the error after the user acts or a
submit attempt (`:state(user-invalid)` and `aria-invalid` together), and focuses the tab-stop segment when a
submit is blocked. `readonly` blocks changes. `<label for>` names the control and focuses its tab stop.
A user selection fires a composed `input` then `change`; setting `value` from code fires nothing.

## Screen-reader expectations

The control announces as a radio group named by `label` (plus its reason as the description when disabled
with `disabled-message`). Each segment announces as a radio named by its `label`, checked or not, and
disabled when it is. The keyboard hint is hidden from assistive technology. Do not repeat the group name in
each segment label.

## Localisation

The only built-in string is the keyboard hint text ("to navigate"), from the shared catalogs in every
shipped locale. `label`, `disabled-message` and every segment `label` are yours to translate. Arrow keys
follow the visual direction, so in right-to-left contexts ArrowLeft moves to the next segment.

## Consumer responsibilities

- Always set `label` (or `aria-label`) on the control and `label` on every segment.
- Give every segment a unique `value`; a `value` that matches no segment leaves nothing selected.
- Do not use it as navigation, and keep to a handful of short options.
- In a controlled framework binding, set `value` back from the `change` handler; the element already
  updates itself, so a handler that does nothing is also correct.
