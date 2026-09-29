---
title: Toggle Button
folder: toggle-button
category: Action
entries: [ToggleButton, ToggleButtonGroup]
summary: A button that switches between pressed and released, alone or in a group with single or multiple selection.
examples: [basic, icons, sizes, disabled, async-action, group-single, group-multiple, in-button-group, rtl]
keywords: [toggle-button, toggle, pressed, aria-pressed, on-off, formatting, view-mode, toggle-group, group, multi-select, favourite]
dense:
  description: button toggling pressed/released, standalone or in a group (single or multiple); pressed-icon swap; async pressedChangeAction
  usage: tct-toggle-button is a ghost button with aria-pressed for a persistent on/off choice (toolbar actions, view modes, formatting). Standalone it owns `pressed` and fires the cancelable tct-pressed-change. Give buttons a `value` and wrap them in tct-toggle-button-group (type single or multiple) to coordinate them; the group fires the cancelable tct-value-change. For a setting that is on or off, use a switch.
  bestPractices:
    - {do: true, text: 'Use for toolbar actions, view-mode switches and formatting controls.'}
    - {do: true, text: 'Use pressed-icon for an outline-to-filled swap.'}
    - {do: true, text: 'Use pressedChangeAction for API-backed toggles (favourite, follow); the button shows progress and restores on failure.'}
    - {do: true, text: 'Label the group; it is the accessible name of the set of buttons.'}
    - {do: false, text: 'Use for a setting that is on or off; use a switch.'}
    - {do: false, text: 'Use a group where exactly one option always applies; use tct-segmented-control.'}
    - {do: false, text: 'Set `pressed` on a button that is a group member; the group value decides.'}
  properties:
    label: visible text unless slotted text or icon-only; accessible name and tooltip when icon-only
    pressed: pressed state (attribute is the initial state); ignored for a group member
    value: identifies the button in a group
    size: sm, md or lg; a group member defaults to the group size
    elevation: resting shadow depth none, low, med or high
    disabled: disables the button
    loading: shows the busy spinner and blocks activation
    icon: registered icon name shown before the label
    pressedIcon: registered icon name shown while pressed (attribute pressed-icon)
    pressed-icon: registered icon name shown while pressed
    iconOnly: square icon-only button (attribute icon-only)
    icon-only: square icon-only button
    tooltip: tooltip text; with disabled it is the reason
    pressedChangeAction: async function called with the requested pressed state
    isPressed: effective pressed state, group-aware (read-only getter)
    default: visible label content
    pressed-icon-slot: icon shown while pressed
    tct-pressed-change: cancelable, before a user toggle of a standalone button
    type: group mode single (default) or multiple
    defaultValue: group initial pressed value(s); attribute value, space separated for multiple
    orientation: group layout horizontal (default) or vertical
    tct-value-change: cancelable group event before a user toggle; value is the requested selection
related: [button, button-group, segmented-control, icon-button, toolbar]
---

## Purpose

`tct-toggle-button` is a button whose pressed state persists: a formatting option, a view mode, a filter. It is
a ghost `tct-button` that exposes `aria-pressed` to assistive technology, so Enter, Space, focus, the tooltip
and the busy spinner all behave exactly as on a button. `tct-toggle-button-group` labels a set of them and
coordinates single or multiple selection.

## When to use

- Toolbar actions that stay on: bold, italic, show grid.
- A view or mode switch that may also be left unset (single group: pressing the pressed button releases it).
- Independent options (`type="multiple"`).
- API-backed toggles such as favourite or follow, with `pressedChangeAction`.

## Alternatives

- A setting that is on or off: `tct-switch`.
- Exactly one option always applies: `tct-segmented-control`.
- A momentary action: `tct-button`.
- Options in a form: `tct-checkbox-input` or a radio list.

## Anatomy

- **Toggle button** (part `button` of `tct-toggle-button`): the inner `tct-button`; it carries the pressed fill.
- **Icon** (slot `icon`, or `icon` attribute) and **pressed icon** (slot or `pressed-icon` attribute) shown while pressed.
- **Group** (part `group` of `tct-toggle-button-group`): a labelled `role="group"` with the buttons separated by a gap.

## Variants and states

- Pressed, released, disabled, loading; sizes `sm`, `md`, `lg`; `elevation`; `icon-only` with a tooltip.
- Group: `type` `single` or `multiple`, `orientation`, `size` (the members' default), `disabled` (members cannot
  re-enable themselves; a member may disable itself).
- Standalone, a user toggle fires the cancelable `tct-pressed-change` (reason `trigger`) and, unless prevented,
  flips `pressed` at once. Inside a group the group fires the cancelable `tct-value-change` with the requested
  selection (a string or `null` for `single`, an array for `multiple`). Property and attribute writes never fire
  intent events. `:state(pressed)` styles the pressed button.
- `pressedChangeAction` runs after the change; while pending the button is busy and interruptible (a re-click
  reverses the pending toggle) and the previous state is restored if it rejects.

## Responsive behaviour

Buttons keep their intrinsic width; a group is `inline-flex` and does not wrap. Use the `vertical`
orientation, or a toolbar with a menu, when horizontal room is short. Icon-only toggles stay square.

## Form semantics

Not applicable. A toggle button is not a form control and submits nothing; keep the state in your data model.

## Screen-reader expectations

A toggle button is announced as a button named by its label and "pressed" or "not pressed". Icon-only toggles
are named by `label`. The group is announced as a group named by `label`. Every member is a Tab stop; there is
no arrow-key roving. A busy button announces once and reports `aria-busy`.

## Localisation

The only built-in string is the busy announcement ("Loading"), from the shared catalogs. `label`, `tooltip`
and the group `label` are yours to translate. Layout follows the writing direction.

## Consumer responsibilities

- Always give the button a `label` and the group a `label`.
- For a group member set `value`; do not set `pressed` on it.
- Controlled use: cancel `tct-pressed-change` (or the group's `tct-value-change`) and set `pressed` (or the
  group `value`) yourself.
- Do not use a toggle button for a setting whose state is only visible through colour: the label or icon
  should change too (`pressed-icon`).
