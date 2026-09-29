---
title: List
folder: list
category: Table & List
entries: [List, ListItem]
summary: A vertical collection of items with consistent spacing, dividers, markers and a header; rows are static, buttons, links or targets for a nested control.
examples: [basic, density, dividers, markers, interactive, edge-compensation, rtl]
keywords: [list, listitem, listbox, menu, collection, items, ul, navlist, ol, rows, dividers, markers]
dense:
  description: vertical list for item collections w/ density, dividers, marker styles, header. composition - tct-list wraps tct-list-item rows
  usage: A vertical collection of items with consistent spacing, dividers and optional markers. Supports a header, start and end content (icons, avatars, badges) and interactive rows (button, link, or a nested control that owns the action). Use it for ordered or unordered groups of related content.
  bestPractices:
    - {do: true, text: 'Provide a header (or aria-label) so the list has an accessible name.'}
    - {do: true, text: 'Use the start and end slots for icons, avatars and badges on each row.'}
    - {do: true, text: 'Use list-style="decimal" for steps; it renders an ordered list and numbers the rows.'}
    - {do: false, text: 'Do not put interactive elements inside a pressable or link row; they create nested click targets and confusing focus.'}
    - {do: false, text: 'Do not use a list for a single item or for laying out unrelated content; lists imply a meaningful collection.'}
    - {do: false, text: 'Do not mix clickable and non-clickable rows without a clear visual distinction.'}
  properties:
    density: row spacing for every item; compact, balanced (default), spacious
    hasDividers: attribute has-dividers; separates rows with a 1px rule and makes them flush
    edgeCompensation: attribute edge-compensation; inline cancels the row inline inset up to the container padding
    header: header text naming the list (attribute) or rich content (slot header)
    listStyle: attribute list-style; marker style none (default), disc, circle or decimal (ordered list)
    start: tct-list attribute, first number of a decimal list (default 1); and the row slot for leading content (icon, avatar, checkbox)
    label: row primary text (attribute) or rich content (slot label)
    description: row secondary text (attribute) or rich content (slot description)
    pressable: makes the row a button; listen for click
    interactiveElement: nested control that owns the row action; the row forwards surface clicks to it
    interactiveSelector: attribute interactive-selector; selector for that control in the row light DOM
    href: makes the row a link
    target: link target; _blank adds noopener noreferrer
    rel: link relationship tokens
    disabled: disabled row; aria-disabled, no input
    selected: selected row; exposed as aria-current
    aria-current: an author aria-current on a row wins over (and hands back to) the value from selected
    default: slot for the tct-list-item rows
    end: trailing row content (badge, action, chevron)
related: [item, tree-list, metadata-list]
---

## Purpose

`tct-list` groups related rows into one semantic list. It gives every `tct-list-item` the same spacing
(density), optional dividers, optional markers (bullets, rings or numbers) and an optional header that
names the list for assistive technology. Rows are built on `tct-item`, so they share its truncation,
hover and interactive patterns.

## When to use

- A short or medium vertical collection where each entry has a label and, optionally, a description,
  start content and end content.
- An ordered set of steps (`list-style="decimal"`) or a bulleted set of points (`disc`, `circle`).
- A list whose rows open something (buttons), go somewhere (links) or toggle a nested checkbox.

## Alternatives

- One standalone row: `tct-item`.
- A hierarchy with expand and collapse: `tct-tree-list`.
- Key-value pairs: `tct-metadata-list`.
- Tabular data with columns: `tct-table`.
- A menu of actions or a selector: `tct-dropdown-menu`, `tct-selector`, which render `tct-item` rows
  with their own keyboard model.

## Anatomy

- **Header** (optional): text or rich content above the list. It names the list.
- **List**: an `<ul>` (an `<ol>` for `decimal`) with an explicit list role and the rows slotted into it.
- **Row** (`tct-list-item`): an optional marker, start content, a label and description, end content,
  and an optional divider below it.

## Variants and states

- **Density**: `compact`, `balanced`, `spacious`, applied to every row.
- **Dividers**: `has-dividers` draws a rule between rows (none after the last) and squares the rows.
- **Markers**: `list-style` `none`, `disc`, `circle`, `decimal`; `start` sets the first number.
- **Edge compensation**: `edge-compensation="inline"` pulls row content toward the line of a heading above
  the list by cancelling the row inset, up to the padding the surrounding container publishes as
  `--_container-padding-inline-start` and `--_container-padding-inline-end`. The header never moves and
  hover, selection and focus paint keep their inset.
- **Row modes**: static, `pressable` (button), `href` (link), or delegating to a nested control
  (`interactive-selector`).
- **Row states**: `selected` (aria-current), `disabled`.

## Responsive behaviour

The list fills its container and rows never reflow into columns. Long plain-text labels ellipsize on
one line; rich content wraps.

## Form semantics

Not applicable. A list is not a form control. A checkbox or radio placed in a row's start slot owns its
own form participation.

## Screen-reader expectations

- The list is announced as "list, N items" (an explicit `role="list"` restores this in Safari and
  VoiceOver, which drop list semantics for `list-style: none`). Each row is a list item.
- The header names the list; without one, put `aria-label` or `aria-labelledby` on the `tct-list`, and
  it is delegated to the inner list. `aria-labelledby` may point at a heading outside the component.
- A pressable row is one button named by its label and description; a link row is one link. Nothing else
  on the row is a tab stop.
- Selection is `aria-current` on the row. A disabled row is `aria-disabled`.
- Markers are hidden from assistive technology; the list structure already conveys order.

## Localisation

`tct-list` has no strings of its own. Numbers use the document's digits (`decimal` counters follow the
element's `lang`). Start content leads on the right in right-to-left contexts.

## Consumer responsibilities

- Name the list: give it a `header`, an `aria-label` or an `aria-labelledby`.
- Publish the container padding (`--_container-padding-inline-start` and `--_container-padding-inline-end`)
  when you use `edge-compensation`; without it the rows stay in place.
- Give a nested control in delegation mode an accessible name.
- Listen for `click` on the `tct-list-item`; a click on a nested button or link bubbles as its own click,
  so check `event.target`.
- Do not slot anything but `tct-list-item` rows into the default slot: the list exposes its children as
  list items.
