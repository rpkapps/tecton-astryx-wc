---
title: Grid
folder: grid
category: Layout
entries: [Grid, GridSpan]
summary: A CSS grid container with a fixed or responsive column count, token-based gaps and spanning items.
examples: [default, fixed-columns, responsive, capped, fill-vs-fit, grid-span, gaps, alignment, dashboard, rtl]
keywords: [grid, columns, responsive, auto-fill, auto-fit, masonry, tiles, row, col, simplegrid, responsive grid, card grid, span, gap]
dense:
  description: CSS Grid-based layout w/ fixed or responsive column count, themed gaps and spanning items
  usage: A CSS grid layout container for arranging children in rows and columns. Use Grid for card galleries, dashboards, and any multi-column layout. columns="3" gives three equal columns; column-min-width="280" makes as many columns as fit. Wrap a child in tct-grid-span to span columns or rows.
  bestPractices:
    - {do: true, text: 'Use responsive columns for layouts that adapt to the width: column-min-width="280".'}
    - {do: true, text: 'Cap the column count with column-max to keep rows from getting too wide on large screens.'}
    - {do: true, text: 'Use column-repeat="fill" (the default) for consistent item widths; use "fit" when items should stretch to fill leftover space.'}
    - {do: true, text: 'Override the tracks from your own CSS with tct-grid::part(base) { grid-template-columns: ... }, including inside media queries.'}
    - {do: false, text: 'Write manual CSS grid for a standard column layout; tct-grid handles spacing and responsive behaviour.'}
    - {do: false, text: 'Use tct-hstack with wrapping for grids; use tct-grid.'}
  properties:
    columns: tct-grid, number of equal columns (zero, negative or missing means one; the property also accepts {minWidth, max, repeat}); tct-grid-span, how many columns the item spans, or full for every column
    column-min-width: narrowest a column may get in px; switches to as many columns as fit
    column-max: with column-min-width, the most columns allowed
    column-repeat: with column-min-width, fill (default) keeps empty tracks, fit collapses them
    gap: spacing-scale step between rows and columns (0, 0.5, 1, 1.5, 2, 3, 4, 5, 6, 8, 10)
    row-gap: spacing step between rows; overrides gap
    column-gap: spacing step between columns; overrides gap
    row-height: fixed row height in px (grid-auto-rows)
    alignment: align-items for the items in their cell (start, center, end, stretch); the attribute is alignment, not align
    justify: justify-items for the items in their cell (start, center, end, stretch)
    padding: padding on all sides, spacing step
    padding-inline: inline-axis padding step
    padding-inline-start: inline-start edge padding step
    padding-inline-end: inline-end edge padding step
    padding-block: block-axis padding step
    padding-block-start: block-start edge padding step
    padding-block-end: block-end edge padding step
    width: width (number is px, string is a CSS length)
    height: height (number is px, string is a CSS length)
    max-width: maximum width
    min-height: minimum height
    default: the grid items
    rows: tct-grid-span, how many rows the item spans
related: [stack, hstack, center, aspect-ratio, card]
---

## Purpose

`tct-grid` arranges its children in rows and columns with a token-based `gap`. It is the tool for card
galleries, dashboards and any layout that needs two dimensions. Give it a fixed number of equal columns
(`columns="3"`), or let it make as many columns as fit (`column-min-width="280"`), optionally capped
with `column-max`. `tct-grid-span` wraps an item that should span several columns or rows.

The children are the grid items of an inner box (part `base`). The sizes you give the grid (`width`,
`height`, `max-width`, `min-height`) size the host, so a percentage resolves against the parent.

## When to use

- A gallery or a list of cards that should reflow with the available width.
- A dashboard with tiles of different sizes (use `tct-grid-span`).
- Any content that needs aligned rows and columns.

## Alternatives

- A row or a column of items: `tct-hstack`, `tct-vstack` or `tct-stack` (with `wrap` for a flowing row).
- Centring one thing: `tct-center`.
- A form's labelled fields: `tct-form-layout`.
- Media with a fixed proportion inside a cell: `tct-aspect-ratio`.

## Anatomy

- **Grid** (`tct-grid`): a host that carries the sizes and an inner grid container (part `base`) that
  holds the tracks, the gaps, the padding and the slotted items.
- **Grid span** (`tct-grid-span`, optional): the host is the grid item; it spans columns or rows and is
  itself a grid, so its single child stretches to fill the cell.

## Variants and states

- Fixed columns: `columns="3"`. Zero, a negative number or a missing value gives one column.
- Responsive columns: `column-min-width` (px). The columns are `repeat(auto-fill, minmax(min, 1fr))`.
  `column-max` caps the count on the track minimum while the tracks still fill the row, so a lone column
  stretches instead of leaving dead space. `column-repeat="fit"` collapses empty tracks so the items
  stretch to fill the row. The `columns` property also takes upstream's object form
  `{minWidth, max, repeat}`; it wins over the attributes.
- `gap`, `row-gap`, `column-gap`: spacing steps; row and column gaps override `gap` per axis.
- `row-height`: a fixed height (px) for implicit rows.
- `alignment` and `justify`: `start`, `center`, `end`, `stretch`, for the items inside their cells.
- `tct-grid-span`: `columns` (a number or `full`), `rows` (a number).
- The tracks are set through a custom property, never inline, so a rule of your own on
  `tct-grid::part(base)` (also inside a media or container query) wins.

## Responsive behaviour

Responsive columns reflow without media queries: the number of columns follows the width of the grid.
For fixed counts that must change at a breakpoint, override the tracks from your own CSS
(`tct-grid::part(base) { grid-template-columns: repeat(2, 1fr) }` inside a media or container query).
Auto-fill and auto-fit need the grid to have a definite width, which a grid in normal flow does.

## Form semantics

Not applicable. A grid is not a form control; controls inside it associate with their own form.

## Screen-reader expectations

None of its own: `tct-grid` and `tct-grid-span` are layout only and add no role or accessible name. The
DOM order is the reading order, and it is also the tab order: do not rely on a visual reordering
(spans, dense packing) that disagrees with the source order for interactive content.

## Localisation

Not applicable: no strings. The first column is at the inline start, so a grid mirrors under
`dir="rtl"`, and `start` and `end` alignments follow the direction.

## Consumer responsibilities

- Keep the DOM order meaningful; visual placement that differs from it confuses keyboard and
  screen-reader users.
- Give the grid a definite width for responsive columns (a grid in a shrink-to-fit parent cannot fit
  columns).
- Style the container through `::part(base)`, or wrap the grid in a `tct-section` or `tct-card`.
