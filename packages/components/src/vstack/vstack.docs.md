---
title: VStack
folder: vstack
category: Layout
entries: [VStack]
summary: A vertical stack: children flow top to bottom with token-based spacing, alignment and wrapping.
examples: [default, alignment, distribution, form]
keywords: [vstack, vertical stack, column, flexbox, flex, spacing, gap, form, list, layout]
dense:
  description: vertical stack; top-to-bottom flex column with themed gap, alignment, wrap and padding
  usage: VStack is tct-stack with direction="vertical" fixed. Use it for forms, lists of content and any column of items. h-align is the cross axis (start, center, end, stretch); v-align is the main axis (start, center, end, between, around, evenly).
  bestPractices:
    - {do: true, text: 'Use gap for spacing between items instead of margins.'}
    - {do: true, text: 'Use h-align="start" or "center" when children should not stretch to the full width.'}
    - {do: true, text: 'Give the vstack a height and v-align="between" to pin the first and last child to the ends.'}
    - {do: false, text: 'Set direction on a vstack; it is fixed. Use tct-stack when the direction changes.'}
    - {do: false, text: 'Nest vstacks inside vstacks to fake spacing; use gap.'}
  properties:
    gap: spacing-scale step between items (0, 0.5, 1, 1.5, 2, 3, 4, 5, 6, 8, 10)
    h-align: cross-axis alignment (start, center, end, stretch)
    v-align: main-axis alignment (start, center, end, between, around, evenly)
    justify: alias for v-align
    alignment: alias for h-align
    wrap: nowrap (default), wrap or wrap-reverse
    as: element the box renders as (div, section, article, aside, nav, header, footer, main, ul, ol, li)
    scrollable: overflow auto on the stack box
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
    default: the children, laid out as flex items in a column
related: [stack, hstack, center, grid]
---

## Purpose

`tct-vstack` is `tct-stack` with `direction="vertical"` fixed: its children flow from top to bottom with a
token-based `gap`. Everything else about a stack applies: alignment, wrapping, padding, sizes, `as`, and
`tct-stack-item` for per-item behaviour. The full API and the anatomy are documented on the Stack page.

## When to use

- Forms and field groups, lists of content blocks, the body of a card or a panel.
- A column of items that share one left edge and one gap.
- A page skeleton column, with `tct-stack-item size="fill" scrollable` for the scrolling region.

## Alternatives

- The direction depends on state or breakpoint: `tct-stack` with `direction`.
- Items in columns and rows: `tct-grid`.
- Centering one thing: `tct-center`.
- A row: `tct-hstack`.
- A labelled set of fields: `tct-form-layout`, which also sets the field layout.

## Anatomy

The same as `tct-stack`: a host that carries the sizes, and an inner flex box (part `base`) that holds the
gap, the padding and the slotted children.

## Variants and states

- `h-align` (cross axis): `start`, `center`, `end`, `stretch` (the default); `alignment` is its alias.
- `v-align` (main axis): `start`, `center`, `end`, `between`, `around`, `evenly`; `justify` is its alias.
- `wrap`: `nowrap`, `wrap`, `wrap-reverse` (wrapping needs a fixed height to wrap into columns).
- `gap`, `padding` and the padding axes and edges, `scrollable`, `as` and the sizes are the same as on
  `tct-stack`.
- The `direction` attribute is ignored: a stray `direction="horizontal"` is reset to `vertical`.

## Responsive behaviour

A column follows its container: children stretch to the width unless `h-align` says otherwise.
Percentage sizes resolve against the parent, so `height="100%"` needs a parent with a definite height.

## Form semantics

Not applicable. A vstack is not a form control; the controls inside it associate with their own form.

## Screen-reader expectations

A vstack with the default `as="div"` adds no semantics. With `as="section"`, `nav`, `ul` and the other
semantic elements the real element is rendered inside the shadow root; name a landmark with `aria-label`
on the host. See the Stack page for lists.

## Localisation

Not applicable: no strings. The logical padding edges and the cross-axis `start` and `end` follow
`dir="rtl"` automatically.

## Consumer responsibilities

- Prefer `gap` over margins on the children.
- Name landmarks (`as="nav"` with `aria-label`) and keep list markup native.
- Style the box through `::part(base)` or wrap the vstack in a `tct-section`/`tct-card`; painting the
  host does not survive an application reset.
