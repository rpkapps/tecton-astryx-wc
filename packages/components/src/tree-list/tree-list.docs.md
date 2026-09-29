---
title: Tree List
folder: tree-list
category: Table & List
entries: [TreeList]
summary: An expandable tree for hierarchical data, with guide lines, expand and collapse, interactive rows and the WAI-ARIA tree keyboard model.
examples: [basic, density-variant, states, interactive, lazy-loading, programmatic, rtl]
keywords: [tree, hierarchy, nested, accordion, folder, expand, collapse, treeview, outline, file-explorer, navigation]
dense:
  description: expandable tree for nested data w/ guide lines, expand/collapse, APG tree keyboard. data-driven via the items property
  usage: An expandable tree for hierarchical data such as file explorers and nested category browsers. The data is the items array (id, label, children, start and end content, onClick or href); expansion is owned by the tree. The tree is one tab stop; arrow keys, Home, End, typeahead, Enter and Space follow the WAI-ARIA tree pattern.
  bestPractices:
    - {do: true, text: 'Give every item a stable, unique id; it keys the row, the expansion state and the focus recovery.'}
    - {do: true, text: 'Name the tree with header (or slot="header", or aria-label on the host).'}
    - {do: true, text: 'Set isExpanded on items for the initial state, and use expand() and collapse() afterwards.'}
    - {do: true, text: 'For lazily loaded branches set expandable, listen for tct-tree-toggle, and assign children when expanded is true.'}
    - {do: true, text: 'Use density="compact" for dense navigation trees and variant="noGuides" when indentation alone is enough.'}
    - {do: false, text: 'Do not put buttons or links in startContent or endContent unless they are secondary actions; the row itself is the primary target.'}
    - {do: false, text: 'Do not use a tree for a flat collection; use tct-list.'}
    - {do: false, text: 'Do not mutate an item without assigning a new items array; the tree re-renders on assignment.'}
  properties:
    items: property; recursive TreeListItemData[] (id, label, description, startContent, endContent, children, expandable, onClick, href, target, isDisabled, isSelected, isExpanded, style, part)
    density: row spacing; compact, balanced (default), spacious
    variant: guide lines; lineGuides (default) or noGuides
    header: attribute and slot; the attribute is a text header that names the tree, the slot takes rich header content and overrides the attribute
    toggleChildrenLabel: attribute toggle-children-label; overrides the accessible name of the expand/collapse toggle
    tct-tree-toggle: cancelable; the user expands or collapses a branch; id, expanded (the requested state) and reason
    expand: method; expand(id) opens a branch without firing tct-tree-toggle
    collapse: method; collapse(id) closes a branch without firing tct-tree-toggle
    toggle: method; toggle(id, force?) flips or sets a branch without firing tct-tree-toggle
    isExpanded: method; isExpanded(id) reports whether a branch is open
    focusItem: method; focusItem(id) moves focus to a visible item and returns whether it did
    --tree-list-indent: CSS custom property; indent per level (default spacing-4)
    --tree-list-row-gap: CSS custom property; gap between rows (default spacing-0-5)
related: [list, item, overflow-list]
---

## Purpose

`tct-tree-list` shows hierarchical data as an expandable tree: file trees, nested categories, outlines.
You give it the data as `items`; it renders the rows, the guide lines and the expand and collapse
toggles, keeps the accessibility relationships (level, position, set size, expanded) correct, and
implements the standard keyboard model.

## When to use

- File explorers, project or category browsers, settings outlines, navigation with more than one level.
- Data that is naturally nested and where users need to move around with the keyboard.
- Trees whose branches load on demand (`expandable`).

## Alternatives

- A flat collection of rows: `tct-list`.
- A single disclosure of arbitrary content: an accordion or disclosure element.
- A data table with expandable rows: a table component.

## Anatomy

- **Tree** (part `tree`): the `role="tree"` list, with an optional header (part `header`) that names it.
- **Item** (part `tree-list-item`): one `role="treeitem"` row with an optional start content, a label
  (part `tree-list-item-label`), a description, end content and, for a branch, a toggle
  (part `tree-list-chevron`).
- **Guide** (part `tree-list-guide`): the connector line beside a group of children (`lineGuides`).
- **Actions**: an item with `onClick` or `href` renders an invisible button or link carrying the label,
  so the whole row is the target; the treeitem stays the tab stop.

## Variants and states

- **Density**: `compact`, `balanced` (default), `spacious` change the block padding of a row.
- **Variant**: `lineGuides` (default) draws connectors; `noGuides` leaves indentation alone. Density and
  variant compose.
- **Item states**: `isSelected` (selected fill, `aria-selected`), `isDisabled` (skipped by arrows,
  dimmed, `aria-disabled`), `isExpanded` (initial open branch), `expandable` (toggle without children yet).
- **Levers**: `--tree-list-indent` and `--tree-list-row-gap` retune the indent and the row gap; the
  guides follow.

## Responsive behaviour

The tree is a block that takes its container's width; long labels wrap onto further lines. Indentation is
per level, so deep trees in narrow containers scroll or wrap according to the container. Nothing depends
on the viewport.

## Form semantics

Not applicable. The tree is not a form control and does not participate in form submission.

## Screen-reader expectations

- The list is announced as a tree named by its header (or `aria-label`), each item as a tree item with
  its name, level, position (`n of m`), expanded or collapsed state (branches only) and selected or
  disabled state.
- An item is named by its label alone (not its whole subtree) and described by its description.
- The toggle button is named "Toggle children" and is not a tab stop; screen reader users expand and
  collapse with the arrow keys.
- When the focused item disappears (its branch collapses, `items` changes) focus moves to the nearest
  surviving item rather than being lost to the page.

## Localisation

The toggle's name is the message `@tct.treeList.toggleChildren`; the `toggle-children-label` attribute
overrides it. Labels and descriptions are yours to translate. Nesting, guide lines and the chevron mirror
in right-to-left containers, and ArrowLeft and ArrowRight swap their expand and collapse roles.

## Consumer responsibilities

- Provide a name for the tree (`header`, the header slot, or `aria-label`).
- Keep `id` values unique and stable across `items` updates.
- Assign a new `items` array after changing the data; expansion the user chose is kept by id.
- Give nested controls in `startContent` and `endContent` their own accessible names.
- Load children yourself for `expandable` branches, in response to `tct-tree-toggle`.
