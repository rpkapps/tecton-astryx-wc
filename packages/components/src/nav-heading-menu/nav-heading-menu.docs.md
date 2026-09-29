---
title: Nav Heading Menu
folder: nav-heading-menu
category: Navigation
entries: [NavHeadingMenu, NavHeadingMenuItem]
summary: The accessible menu of a navigation heading's popover: rows that are links or actions, with icons and descriptions.
examples: [basic, icons-and-descriptions, sizes, rtl]
keywords: [nav, menu, navigation, heading, menu-item, popover, side-nav, top-nav]
dense:
  description: role=menu of link and action rows for a navigation heading popover; roving arrows, typeahead, closes the popover
  usage: A tct-nav-heading-menu with tct-nav-heading-menu-item rows (label, description, icon, href, disabled). It is one roving group: arrows, Home, End and typeahead move between enabled rows, Enter or Space activate, Escape asks the enclosing heading popover to close. The heading provides navHeadingCloseContext; outside one nothing closes.
  bestPractices:
    - {do: true, text: 'Use it as the content of a side or top navigation heading popover.'}
    - {do: true, text: 'Give rows short labels; put detail in description.'}
    - {do: true, text: 'Use href for rows that navigate so they stay real links.'}
    - {do: false, text: 'Use it for action menus; use tct-dropdown-menu (its rows stay focusable when disabled and support checkbox, radio and sub menus).'}
  properties:
    size: sm, md (default) or lg; sets the minimum width (160, 200, 240px) and the row padding
    min-width: minimum width override; a number is px, a string any CSS length
    minWidth: minimum width override; a number is px, a string any CSS length
    focusFirst: focuses the first enabled row (method)
    focusLast: focuses the last enabled row (method)
    default: the rows (menu) or nothing (row)
    label: primary text of the row, one line; slot label for rich content
    description: secondary text under the label; slot description for rich content
    icon: registered icon name before the label (or slot icon)
    href: destination; renders a link row
    disabled: not focusable or activatable; skipped by arrows and typeahead
    control: the focusable menuitem inside a row
    click: native click on a row, once per activation
related: [dropdown-menu, more-menu, popover, link]
---

## Purpose

`tct-nav-heading-menu` is the content of the popover a navigation heading opens (`tct-side-nav-heading`,
`tct-top-nav-heading`): an accessible `role="menu"` with keyboard navigation, and rows (`tct-nav-heading-menu-item`)
that are links or actions with an icon, a label and a description.

## When to use

- Inside a navigation heading popover, to list the pages of a section.
- On its own wherever a small menu of navigation links and actions is needed.

## Alternatives

- Action menus, with checkbox, radio, sub menus and disabled rows that stay discoverable: `tct-dropdown-menu`.
- An overflow of row actions: `tct-more-menu`.

## Anatomy

- **Menu** (part `menu`): the column of rows.
- **Row** (part `item` of each `tct-nav-heading-menu-item`): the link or the action, with an optional icon, a
  one-line label and a one-line description (both truncated with a tooltip).

## Variants and states

- `size` `sm`, `md`, `lg` sets the minimum width and the padding; `min-width` overrides the width.
- A row is a link (`href`) or an action; rest, hover, keyboard focus (the highlight follows DOM focus), pressed
  and disabled. A row exposes `:state(disabled)`.

## Responsive behaviour

The menu has a minimum width and grows with its content; the enclosing popover decides the maximum. Labels and
descriptions truncate to one line.

## Form semantics

Not applicable: rows navigate or act, they hold no value.

## Screen-reader expectations

The menu announces as a menu; each row is a menu item named by its label (a link row is a link menu item). A
disabled row is announced as unavailable and cannot be focused or activated. Choosing a row closes the popover
and returns focus as the heading decides.

## Localisation

There are no built-in strings. Labels and descriptions are yours to translate; arrow keys are vertical and do not
mirror. Icons and text follow the reading direction.

## Consumer responsibilities

- Give every row a `label`.
- Use `href` for navigation so that middle click and "open in new tab" keep working.
- Outside a heading popover nothing closes: close your own container from the row's `click`.
