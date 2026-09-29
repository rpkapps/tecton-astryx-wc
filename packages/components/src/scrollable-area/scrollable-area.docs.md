---
title: Scrollable Area
folder: scrollable-area
category: Layout
entries: [ScrollableArea]
summary: A named native scroll region that is a keyboard tab stop only while its content overflows.
examples: [default, horizontal, both-axes, region-role, nothing-to-scroll, full-bleed, keyboard-owner, rtl]
keywords: [scrollable area, scroll, overflow, scroll region, viewport, scroll container, keyboard scrolling, overscroll, full bleed]
dense:
  description: native scroll viewport with an accessible name that becomes a keyboard tab stop only while its content overflows; use INSTEAD of a bare overflow:auto div
  usage: ScrollableArea wraps content in a real scroll container. label is required and names the region. The viewport is keyboard reachable exactly while the requested axis overflows and nothing focusable is inside, so users can scroll with the arrow keys; a region that fits adds no tab stop. axis is block (default), inline or both and is logical, so it follows the text direction and the writing mode. Give the region a height (or a max-height through its container) for the block axis.
  bestPractices:
    - {do: true, text: 'Always set label; it is the accessible name of the scroll region and is required.'}
    - {do: true, text: 'Give the region a height, or place it in a container with one, so that there is something to scroll.'}
    - {do: true, text: 'Use axis="inline" for wide content such as a table; the axis is logical and follows the text direction.'}
    - {do: true, text: 'Use viewport-role="region" only for a large scrollable part of a page that should be a landmark.'}
    - {do: false, text: 'Nest scroll regions along the same axis; the inner one takes the keyboard and the outer one becomes unreachable.'}
    - {do: false, text: 'Add tabindex to the region yourself; it manages its own tab stop.'}
    - {do: false, text: 'Use it for a whole page or a layout body; tct-layout-content and tct-app-shell handle that.'}
  properties:
    axis: scrolling axis, block (default), inline or both; logical
    label: accessible name of the scroll region; required
    viewport-role: role of the viewport, group (default) or region; named viewport-role because a role attribute would shadow the element's own role
    overscroll: allow (default) lets scrolling chain to the page, contain stops it at the edge
    sticky-containment: when-scrollable (default) or always; whether a region that fits still contains its sticky children
    full-bleed: lets the content reach the edges of an enclosing padded container
    keyboard-owner: who owns keyboard access, viewport (default, a named tab stop while it scrolls), content-or-viewport (a forward Tab lands on the first link or button inside) or content (the content brings its own)
    padding: padding step of the content (default 0)
    padding-inline: inline padding step
    padding-block: block padding step
    padding-inline-start: inline-start padding step
    padding-inline-end: inline-end padding step
    padding-block-start: block-start padding step
    padding-block-end: block-end padding step
    width: width, a number is px or any CSS length
    height: height, a number is px or any CSS length; needed for the block axis
    max-width: maximum width
    min-height: minimum height
    scrollState: read-only scroll state per axis, whether it scrolls and whether it is at the start or the end
    viewport: read-only, the native scroll container element
    default: the scrolling content
related: [layout, stack, card]
---

## Purpose

`tct-scrollable-area` is a native scroll container with two additions a bare `overflow: auto` box lacks:
an accessible name, and a keyboard tab stop that exists only while there is something to scroll. It measures
its content box for real, so it knows when the requested axis overflows, and it releases the tab stop the
moment the content fits.

Scrolling is the browser's: the wheel, touch, the scrollbar and the keyboard work as they do everywhere,
with none of the scroll code reimplemented.

## When to use

- A list, a log, a table or a code block with a fixed height or width.
- A region of a page that scrolls on its own (a chat transcript, a side list) and must be reachable by
  keyboard.
- Content that has to bleed to the edges of a padded card while it scrolls (`full-bleed`).

## Alternatives

- The body of a page or a screen: `tct-layout-content` scrolls and is a tab stop while it overflows.
- A stack that scrolls: `scrollable` on `tct-stack`.
- A row of items that collapses into a menu instead of scrolling: `tct-overflow-list`.

## Anatomy

- **Scrollable area** (`tct-scrollable-area`): a flex column with a limited height and a `max-block-size`
  of 100%.
- **Viewport** (part `viewport`): the element that scrolls. It carries the role, the name and the tab stop.
- **Content**: a box inside the viewport that is measured and takes the padding, holding the slotted
  content.

## Variants and states

- `axis`: `block` (default), `inline` or `both`. The axes are logical: `inline` scrolls sideways in
  horizontal text and vertically in a vertical writing mode.
- `overscroll`: `allow` (default) or `contain`, which stops scroll chaining into the page.
- `sticky-containment`: `when-scrollable` (default) or `always`: whether a region that fits still contains
  its sticky children.
- `full-bleed`: the region cancels the padding of an enclosing padded container, and its own `padding`
  keeps the content off the edge.
- `keyboard-owner`: `viewport` (default: a named tab stop while it scrolls), `content-or-viewport` (the
  same, but a forward Tab lands on the first link or button inside) or `content` (no tab stop and no role:
  the content brings its own).
- `:state(scrollable)` is set while at least one requested axis really scrolls. The native scrollbar uses
  the theme colours where the browser supports it.
- Padding attributes follow the spacing scale; the default is 0.

## Responsive behaviour

The region is as wide as its container unless you give it a `width`, and `max-width` and `min-height`
apply. It reacts to size changes of the viewport and the content, so it becomes a tab stop or stops being
one when the window is resized or the content changes.

## Form semantics

Not applicable.

## Screen-reader expectations

The viewport has the role `group` (or `region` with `viewport-role="region"`) and the accessible name from
`label`. While a requested axis overflows it is a tab stop: it takes focus with Tab and scrolls with the
arrow keys, Page Up, Page Down, Home, End and Space, and it stops being one as soon as the content fits.
With `keyboard-owner="content-or-viewport"` a forward Tab goes to the first link or button inside, and the
arrow keys pressed on a control that does not use them scroll the region. With `keyboard-owner="content"`
the region writes no role and no tab stop. Do not give the region a `tabindex`; it manages its own.

## Localisation

`label` is your text: write it in the language of the page. Directions are logical, so a horizontal region
starts at the right edge in right-to-left text and the keyboard scrolls accordingly.

## Consumer responsibilities

- Set a meaningful `label` (a development warning fires when it is empty).
- Give the region a height, or a container that limits it, for the block axis.
- Choose `keyboard-owner` when the content is interactive: `content-or-viewport` for a list of links,
  `content` when the content is a composite widget (a grid, a listbox) that brings its own tab stop.
