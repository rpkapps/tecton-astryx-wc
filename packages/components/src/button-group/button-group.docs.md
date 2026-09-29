---
title: Button Group
folder: button-group
category: Action
entries: [ButtonGroup]
summary: Joins related actions into one connected control with a single Tab stop and arrow-key navigation.
examples: [basic, variants, vertical, sizes, split-button, icon-buttons, elevated, disabled, rtl]
keywords: [button-group, connected, split, toolbar, actions, grouped, buttons, segmented, split-button]
dense:
  description: connected button group; shared edges, outer-only radius, one tab stop with arrows, horizontal or vertical
  usage: Wrap tct-button, tct-icon-button or tct-toggle-button children in tct-button-group to join related operations on the same object (copy, cut, paste; undo, redo). Give it a `label`. The group is one Tab stop; arrows move between members, Home and End jump to the ends, disabled members are skipped.
  bestPractices:
    - {do: true, text: 'Group related actions on the same object: copy/cut/paste, undo/redo.'}
    - {do: true, text: 'Use the same variant for every button so the group reads as one unit.'}
    - {do: true, text: 'Keep groups small (2-4 buttons); use a toolbar or a menu for more.'}
    - {do: true, text: 'Label the group for what its buttons act on; the label is its accessible name.'}
    - {do: false, text: 'Mix unrelated actions (Save next to Delete) in one group.'}
    - {do: false, text: 'Use it for navigation or choosing a value; use a segmented control or tabs.'}
    - {do: false, text: 'Nest groups; place them side by side with a gap.'}
    - {do: false, text: 'Disable the group to show an action in flight; a disabled member drops focus. Show progress on the button that started the work.'}
  properties:
    label: accessible name of the group (what its buttons act on)
    orientation: horizontal (default) or vertical; arrows follow it
    size: sm, md (default) or lg; the default size of the members
    elevation: resting shadow on the whole group: none, low, med or high
    disabled: disables every member
    default: the buttons of the group
related: [button, icon-button, toggle-button, toolbar, segmented-control]
---

## Purpose

`tct-button-group` joins related actions into a single connected control: shared edges, rounded outer corners
only, and one Tab stop. It is a labelled `group` of buttons following the WAI-ARIA roving tabindex technique:
Tab enters at the member that last had focus, the arrow keys along the orientation move between members
(wrapping), Home and End jump to the ends, and disabled members are skipped.

## When to use

- Operations that belong together on the same object: copy, cut, paste; undo, redo.
- A split button: a main action followed by a trailing icon-only member.
- A floating cluster of actions above content (`elevation`).

## Alternatives

- Choosing one value or mode: `tct-segmented-control`.
- Independent on/off choices: `tct-toggle-button-group`.
- Many or mixed actions, inputs and tabs: `tct-toolbar`, or a menu for the overflow.
- Navigation between views: tabs or links.

## Anatomy

- **Group** (part `group`): the layout box holding the members and, with `elevation`, the shared shadow.
- **Members**: `tct-button`, `tct-icon-button`, `tct-toggle-button` or a menu trigger, as light-DOM children.

Members do not need to know about each other. Each one asks for the group's context and receives its own
place (`first`, `middle`, `last`, `only`), the orientation, the size and the disabled state; it squares its
interior corners itself with per-corner logical radii, so right-to-left and vertical groups keep the correct
outer corners. Positions come from the members that are actually rendered, so a hidden member or stray markup
never changes which button is last.

## Variants and states

- `orientation`: `horizontal` or `vertical`.
- `size`: `sm`, `md`, `lg`; the default for members, and provided to every sized child.
- `elevation`: `none`, `low`, `med`, `high`. The shadow is on the group, not on each button.
- `disabled`: every member is disabled and the group leaves the tab order. `:state(disabled)` is available.

## Responsive behaviour

The group is `inline-flex` and never wraps its members; it keeps its content width. For more actions than fit,
move the least common ones into a menu, or use a toolbar.

## Form semantics

Not applicable. The group is not a form control; a `type="submit"` member submits its form as it would alone.

## Screen-reader expectations

The group is announced as a group named by `label`, and a screen reader reads the name before each member.
Arrow keys change focus only inside the group; they are not announced separately. Members keep their own
names (icon-only members are named by their `label`). A host `aria-label` overrides the `label` property.

## Localisation

The component has no built-in strings: `label` and each member's text are yours to translate. Arrow keys follow
the visual direction: in right-to-left contexts ArrowLeft moves to the next member.

## Consumer responsibilities

- Always set `label` (or `aria-label`).
- Use one variant across the group and keep it to a few related buttons.
- Do not disable the group for a pending action; use the busy state of the button that started it.
- A member that opens its own layer (a menu) keeps the arrow keys pressed inside that layer.
