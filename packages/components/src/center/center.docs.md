---
title: Center
folder: center
category: Layout
entries: [Center]
summary: Centres its content in the middle of its container on the horizontal axis, the vertical axis, or both.
examples: [default, axes, full-size, inline, padding, rtl]
keywords: [center, centered, centering, align, alignment, justify, flexbox, middle, empty-state, loading]
dense:
  description: centers content on one or both flex axes; single-axis names match physical axes only in horizontal writing
  usage: Center aligns content to the middle of its container. Use it for empty states, loading screens, login forms, or any content that should sit in the center of the available space. Give it a height for vertical centering to have room.
  bestPractices:
    - {do: true, text: 'Use a single-axis value only in horizontal writing, or after verifying the active writing mode; the values follow the flex axes.'}
    - {do: true, text: 'Give the center a height (or a parent with one) when using axis="vertical" or the default; centering needs available space on the chosen axis.'}
    - {do: true, text: 'Use the inline attribute to centre small elements (icons, badges) within a line of text without breaking the text flow.'}
    - {do: true, text: 'Keep semantic structure and accessible names on the content; center adds no role or label.'}
    - {do: false, text: 'Wrap large page sections in center; use the layout components or an app shell for page-level structure.'}
    - {do: false, text: 'Use center for horizontal lists of items; use tct-stack with h-align="center" instead.'}
  properties:
    axis: centering mode; both (default), horizontal (inline axis) or vertical (block axis)
    inline: renders inline-flex so small content centres inside a line of text
    padding: inner padding on all sides (spacing step 0, 0.5, 1, 1.5, 2, 3, 4, 5, 6, 8, 10)
    padding-inline: logical inline-axis padding; overrides padding on that axis
    padding-inline-start: logical inline-start padding
    padding-inline-end: logical inline-end padding
    padding-block: logical block-axis padding; overrides padding on that axis
    padding-block-start: logical block-start padding
    padding-block-end: logical block-end padding
    width: width (number is px, string is a CSS length)
    height: height (number is px, string is a CSS length)
    max-width: maximum width
    min-height: minimum height
    default: the content to centre
related: [stack, grid, section, card]
---

## Purpose

`tct-center` puts its content in the middle of the space it has. It is a flex box that centres its
children on the inline axis, the block axis, or both. Use it for the things that belong in the middle of
a region: an empty state, a spinner while a page loads, a sign-in form.

The children are flex items of an inner box (part `base`). The sizes you give it (`width`, `height`,
`max-width`, `min-height`) size the host, so a percentage `height` fills the parent.

## When to use

- Centring an empty state, a loading indicator or a single card in a region.
- Centring a small element (an icon, a badge) in a line of text, with `inline`.
- Centring content inside a fixed-size box such as a thumbnail or an avatar.

## Alternatives

- Several items in a row or a column that share alignment: `tct-stack` (`h-align="center"`).
- Placing items in rows and columns: `tct-grid`.
- Page-level structure: the layout components.

## Anatomy

A host that carries the sizes (and is `inline-flex` with `inline`), and an inner flex box (part `base`)
that centres the slotted content and carries the padding.

## Variants and states

- `axis`: `both` (default) centres on both axes; `horizontal` centres along the inline axis only;
  `vertical` centres along the block axis only. In vertical writing modes the single-axis values keep
  following the flex axes rather than the physical names.
- `inline`: `inline-flex` instead of block-level `flex`.
- Padding: `padding`, the `padding-inline` and `padding-block` axes and the four edges; the most
  specific wins per edge. Zero is a valid step.
- Sizes: `width`, `height`, `max-width`, `min-height`.

## Responsive behaviour

A centre is as wide as its container unless `inline` or a `width` says otherwise, and the content
stays centred as the container resizes. Vertical centring only shows when the centre has room: give it
a `height` or `min-height`, or put it in a parent with a definite height and use `height="100%"`.

## Form semantics

Not applicable. A centre is not a form control.

## Screen-reader expectations

None of its own: `tct-center` is layout only and adds no role or accessible name. The content keeps its
own semantics, so put labels and roles on the content.

## Localisation

Not applicable: no strings. Padding uses logical edges, so `padding-inline-start` pads the right edge in
RTL; centring itself is symmetrical.

## Consumer responsibilities

- Give the centre a height when you expect vertical centring.
- Put the accessible name and role on the content, not on the centre.
- Do not use a centre for page-level structure or for lists of items.
