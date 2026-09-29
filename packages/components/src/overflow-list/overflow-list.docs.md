---
title: Overflow List
folder: overflow-list
category: Table & List
entries: [OverflowList]
summary: A horizontal list that collapses the items that do not fit its width into an indicator, with floors, caps, bounded multi-row wrapping and a notification of the collapsed set.
examples: [basic, collapse-from, limits, rows, renderer, rtl]
keywords: [overflow, truncate, collapse, breadcrumb, toolbar, tag-list, pill-list, more, clamp, responsive, plus-n]
dense:
  description: horizontal list w/ overflow indicator; hides items beyond the container width
  usage: A horizontal list that automatically hides items when they exceed the available width. Use it for breadcrumbs, toolbars, tag lists, or any row that needs to collapse gracefully at smaller sizes. Children are the items; overflowRenderer (or show-count) draws the indicator; tct-overflow-change reports the collapsed items.
  bestPractices:
    - {do: true, text: 'Provide a meaningful indicator: overflowRenderer returning a "+N more" chip, a menu button, or the built-in show-count.'}
    - {do: true, text: 'When the row already has its own menu, listen for tct-overflow-change and feed the collapsed items into it instead of adding a second anchor.'}
    - {do: true, text: 'Set min-visible-items to keep key items visible, and max-visible-items to cap the row at a fixed count regardless of width.'}
    - {do: true, text: 'Use max-rows to let items wrap onto a bounded number of rows (a two-row tag cloud) before the rest collapse.'}
    - {do: true, text: 'Give the list a width to fit into (it measures its own width by default); use behavior="observe-parent" to keep it content-sized inside a flex row.'}
    - {do: false, text: 'Do not use it for a vertical stack; items flow inline-start to inline-end even with max-rows.'}
    - {do: false, text: 'Do not put the only path to an action behind the overflow; make sure the collapsed items are reachable from the indicator.'}
  properties:
    gap: gap between items as a spacing step (0, 0.5, 1, 1.5, 2, 3, 4, 5, 6, 8, 10); default 2
    minVisibleItems: attribute min-visible-items; items always shown, even if they do not fit; default 0
    maxVisibleItems: attribute max-visible-items; items never exceeded, even if all fit; the floor wins over a smaller cap
    maxRows: attribute max-rows; wrap onto up to this many rows before collapsing; unset or 1 is a single line
    collapseFrom: attribute collapse-from; which end collapses, end (default) or start
    behavior: observe-self (default, the list width) or observe-parent (the parent content width)
    showCount: attribute show-count; draws the built-in +N indicator, named "N more", when there is no overflowRenderer
    overflowRenderer: property; (overflowItems) => template, node or text for the indicator; called for the collapsed items and, hidden, for all items to measure
    tct-overflow-change: the collapsed set changed; items holds each collapsed element and its index; silent while nothing overflows
    default: slot for the items; each child is one item
related: [list, item]
---

## Purpose

`tct-overflow-list` keeps a row of items on one line (or a few) by hiding the ones that do not fit and
telling the user how many are hidden. It measures the items in place, so your markup stays exactly
as you wrote it, and it re-measures whenever the row or its items change size.

## When to use

- Breadcrumb trails, toolbars, tag or filter lists, avatar groups, and any row that must collapse
  gracefully as the space narrows.
- A tag cloud limited to a fixed number of rows (`max-rows`).
- A row that should never show more than N items (`max-visible-items`).

## Alternatives

- Content that should scroll horizontally: a scrollable area.
- Content that should wrap freely: a flex layout with `flex-wrap`.
- A vertical collection: `tct-list`.

## Anatomy

- **Row**: the visible container (part `overflow-list`) holding the visible items.
- **Items**: the list's children. Collapsed ones are hidden (`display: none`).
- **Indicator** (optional): the content `overflowRenderer` returns, or the built-in `+N` (`show-count`),
  placed after the visible items (before them with `collapse-from="start"`).
- A hidden, inert **measurement copy** of the indicator, rendered for all items, reserves the widest
  width the indicator can take; it is not part of the tree assistive technology reads.

## Variants and states

- **Collapse direction**: `collapse-from` `end` (default) or `start`.
- **Limits**: `min-visible-items` (floor), `max-visible-items` (cap; the floor wins if the cap is smaller).
- **Rows**: `max-rows` greater than 1 wraps items across that many rows, then collapses the rest.
- **Measured width**: `behavior="observe-self"` measures the list; `observe-parent` measures the parent's
  content width and lets the list stay content-sized until it overflows.
- **Nothing collapsed / something collapsed**: with room for every item there is no indicator and no
  `tct-overflow-change`; the first collapse, and every later change of the collapsed set, fires it.

## Responsive behaviour

This component *is* the responsive behaviour: as its width changes (a window resize, a sidebar toggled)
it recomputes how many items fit, without flicker, and returns to exactly the same state at the same
width. Items are measured at their natural width, so give them intrinsic sizes rather than
`flex: 1` or percentages.

## Form semantics

Not applicable. The list is not a form control; controls inside its items keep their own form behaviour.

## Screen-reader expectations

- Collapsed items are `display: none`: they leave the tab order and the accessibility tree, so a screen
  reader never lands on an item you cannot see.
- The built-in `+N` indicator is read as "N more" (the visible `+N` is hidden from assistive technology
  and a visually hidden "N more" carries the name). A custom indicator must carry its own accessible
  name (a button named "3 more items"); the list adds none.
- The list itself has no role; it does not announce resizes. If the collapsed items matter, make them
  reachable from the indicator (a menu) rather than relying on the count.

## Localisation

The built-in indicator's name is `@tct.overflow-list.overflow` (`{count} more`), English until a
translation is registered. Custom indicators bring their own text. Items start at the inline start and
the indicator sits at the inline end, in both writing directions.

## Consumer responsibilities

- Give the list a width to measure (it measures itself by default): a block in a sized container, or
  `behavior="observe-parent"`.
- Provide an accessible name for a custom indicator.
- Use `tct-overflow-change` to feed the collapsed items (`event.items`, each with `element` and `index`)
  into a menu the row already has, and read the data you need from the elements.
- Do not depend on collapsed items being removed from the DOM: they stay in place and are only hidden.
