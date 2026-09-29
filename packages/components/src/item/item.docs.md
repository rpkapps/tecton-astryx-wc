---
title: Item
folder: item
category: Table & List
entries: [Item]
summary: A universal row that unifies start content, label, description and end content, and can be a static row, a button, a link, or an enlarged target for a nested control.
examples: [basic, density-alignment, layout-truncation, interactive, states, delegation, rtl]
keywords: [item, list-item, media-object, row, cell, entity, contact, notification, preview, label, description]
dense:
  description: universal row w/ start+label+description+end slots. building block for list rows, menu items, contacts, notifications, selector options
  usage: A structured row. Use for list rows, menu items, contact rows, notifications and file browsers. It is static by default; `pressable` makes it a button, `href` a link, `interactive-selector` (or the `interactiveElement` property) makes it an enlarged click target for a nested control. Rich content goes through the `label`, `description`, `start`, `end` and `marker` slots.
  bestPractices:
    - {do: true, text: 'Use the label, description, start and end for the common layout; they cover most rows.'}
    - {do: true, text: 'density="compact" for menus and dense lists, "balanced" for standard rows, "spacious" for roomier layouts.'}
    - {do: true, text: 'Set label-lines and description-lines to control truncation when content length varies.'}
    - {do: true, text: 'Use alignment="start" when the start or end content is taller than one line of text.'}
    - {do: true, text: 'Use interactive-selector when a checkbox or radio in `start` already owns the row action, so the row adds no second tab stop.'}
    - {do: false, text: 'Do not nest interactive elements inside a pressable or link row unless the nested element owns its own click (check event.target).'}
    - {do: false, text: 'Do not use tct-item for navigation between views; use navigation components.'}
    - {do: false, text: 'Do not add read/unread or inbox-specific behaviour to it; compose a thin wrapper.'}
  properties:
    label: primary text (attribute) or rich content (slot label, which overrides the attribute); plain text ellipsizes on one line
    description: secondary text below the label (attribute) or rich content (slot description); plain text ellipsizes
    as: div (default), li (host is a listitem) or span; semantic only
    alignment: vertical alignment of the start and end content; center (default) or start
    density: block padding; compact 4px, balanced 8px (default), spacious 12px (and 12px inline)
    labelLines: attribute label-lines; max label lines before an ellipsis
    descriptionLines: attribute description-lines; max description lines before an ellipsis
    layout: stacked (default) or inline (label and description on one line, description ellipsizes first)
    pressable: makes the row a button (an invisible button carries the label); listen for click
    href: makes the row a link; unsafe URLs render a destination-less anchor
    target: link target, _blank or _self; _blank adds noopener noreferrer
    rel: link relationship tokens; noopener noreferrer are merged for _blank
    highlighted: hover or keyboard-focus appearance, for a parent that owns the pointer
    selected: selected look; aria-selected when the role permits it, else aria-current
    disabled: disabled state; no pointer or keyboard input; aria-disabled
    interactiveElement: nested control that owns the row action; the row forwards surface clicks to it
    interactiveSelector: attribute interactive-selector; selector for that nested control in the light DOM
    marker: list bullet or counter rendered before the start content
    start: leading content: icon, avatar, checkbox
    end: trailing content: badge, timestamp, action button
    role: an author role (set by a parent menu or listbox) makes the row role-managed; no inner button or link, the host is the semantic node
    aria-current: an author aria-current always wins over the value derived from selected
related: [list, tree-list, metadata-list, indicator]
---

## Purpose

`tct-item` is the one row every collection is built from: an optional marker, start content, a label
with an optional description, and end content. Lists, menus, selector options, contact rows and
notifications all render it, so they share spacing, truncation, hover and selection behaviour.

## When to use

- A structured row in a list, a menu, a selector or a feed: an icon or avatar, a name, a supporting
  line and a badge or a timestamp.
- A row that is the whole click target (a button or link) and needs correct keyboard and pointer
  behaviour without hand-writing it.
- A row that is an enlarged target for a checkbox or radio in its start slot.

## Alternatives

- A vertical collection with dividers, markers and density: `tct-list` with `tct-list-item`.
- A hierarchy with expand and collapse: `tct-tree-list`.
- Key-value pairs: `tct-metadata-list`.
- A control that already has its own row (checkbox list, radio list): use those, which build on this.

## Anatomy

- **Marker** (optional): a bullet or counter before the start content.
- **Start** (optional): leading content, an icon, avatar or checkbox.
- **Label** (required): the primary text. **Description** (optional) below it, or on the same line with
  `layout="inline"`.
- **End** (optional): trailing content, pushed to the far end.
- **Action**: when the row is pressable or a link, an invisible button or anchor wraps the label and
  description. It is the row's single tab stop; the visible focus ring is drawn around the whole row.

## Variants and states

- **Density**: `compact`, `balanced`, `spacious`.
- **Alignment**: `center` (default) or `start`.
- **Layout**: `stacked` or `inline`.
- **Mode**: static, `pressable` (button), `href` (link), delegating (`interactive-selector` or
  `interactiveElement`), or role-managed (the host has a `role` set by a parent).
- **State**: `highlighted`, `selected`, `disabled`. Hover and pressed washes appear only while the row is
  interactive.

## Responsive behaviour

The row is a fluid flex box that fills its container. Plain-text labels and descriptions ellipsize; rich
content wraps unless you set `label-lines` / `description-lines`. Use `layout="inline"` when the row must
fit a fixed height.

## Form semantics

Not applicable. `tct-item` is not a form control. A checkbox or radio placed in the start slot owns its
own form participation; `interactive-selector` only forwards row clicks to it.

## Screen-reader expectations

- A pressable row is announced as a button named by the label and description; a link row as a link.
- `as="li"` exposes the host as a list item, so a `tct-list` reads as "list, N items".
- Selection is `aria-selected` when the host `role` is `option`, `tab`, `row`, `gridcell`, `treeitem` (or
  another role that permits it), and `aria-current` otherwise. An `aria-current` attribute you set always
  wins.
- A disabled row is `aria-disabled`.
- In delegation mode there is exactly one focusable control, the nested one. Give it its own accessible
  name; the row publishes its description text to slotted controls so they can reference it.

## Localisation

`tct-item` has no strings of its own. Write labels in the user's language. The row uses logical
properties: start content leads on the right in right-to-left contexts.

## Consumer responsibilities

- Give a nested control in delegation mode an accessible name; the row does not name it.
- When you nest a button or link inside a pressable row, the click of that nested control bubbles to
  the item as its own `click`; check `event.target` (or `composedPath()`) before treating it as a row
  activation.
- Listen for `click` on the item; there is no custom activation event.
- Set `role` (and manage `tabindex` and keyboard access) yourself when a parent widget owns the row, as
  menus and listboxes do. The row then renders no inner button or anchor.
