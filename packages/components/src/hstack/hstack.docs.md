---
title: HStack
folder: hstack
category: Layout
entries: [HStack]
summary: A horizontal stack: children flow left to right with token-based spacing, alignment and wrapping.
examples: [default, alignment, wrapping, in-vstack, start-and-end]
keywords: [hstack, horizontal stack, row, flexbox, flex, spacing, gap, inline, toolbar, layout]
dense:
  description: horizontal stack; left-to-right flex row with themed gap, alignment, wrap and padding
  usage: HStack is tct-stack with direction="horizontal" fixed. Use it for toolbars, button rows and inline groups. h-align is the main axis (start, center, end, between, around, evenly); v-align is the cross axis (start, center, end, stretch).
  bestPractices:
    - {do: true, text: 'Use gap for spacing between items instead of margins.'}
    - {do: true, text: 'Use v-align="center" to align mixed-height items on their middle.'}
    - {do: true, text: 'Use wrap="wrap" so a row flows onto the next line in a narrow container.'}
    - {do: false, text: 'Set direction on an hstack; it is fixed. Use tct-stack when the direction changes.'}
    - {do: false, text: 'Nest hstacks inside hstacks; try wrap first.'}
  properties:
    gap: spacing-scale step between items (0, 0.5, 1, 1.5, 2, 3, 4, 5, 6, 8, 10)
    h-align: main-axis alignment (start, center, end, between, around, evenly)
    v-align: cross-axis alignment (start, center, end, stretch)
    justify: alias for h-align
    alignment: alias for v-align
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
    default: the children, laid out as flex items in a row
related: [stack, vstack, center, grid]
---

## Purpose

`tct-hstack` is `tct-stack` with `direction="horizontal"` fixed: its children flow along the inline axis
(left to right in LTR, right to left in RTL) with a token-based `gap`. Everything else about a stack
applies: alignment, wrapping, padding, sizes, `as`, and `tct-stack-item` for per-item behaviour. The
full API and the anatomy are documented on the Stack page.

## When to use

- Toolbars, button rows, breadcrumbs and any inline group of items.
- A label next to a value, or an icon next to text, with consistent spacing.
- The row of a page skeleton, with `tct-stack-item size="fill"` for the flexible column.

## Alternatives

- The direction depends on state or breakpoint: `tct-stack` with `direction`.
- Items in columns and rows: `tct-grid`.
- Centering one thing: `tct-center`.
- A column: `tct-vstack`.

## Anatomy

The same as `tct-stack`: a host that carries the sizes, and an inner flex box (part `base`) that holds the
gap, the padding and the slotted children.

## Variants and states

- `h-align` (main axis): `start`, `center`, `end`, `between`, `around`, `evenly`; `justify` is its alias.
- `v-align` (cross axis): `start`, `center`, `end`, `stretch` (the default); `alignment` is its alias.
- `wrap`: `nowrap`, `wrap`, `wrap-reverse`.
- `gap`, `padding` and the padding axes and edges, `scrollable`, `as` and the sizes are the same as on
  `tct-stack`.
- The `direction` attribute is ignored: a stray `direction="vertical"` is reset to `horizontal`.

## Responsive behaviour

A row does not reflow by itself: give it `wrap="wrap"` and it flows onto the next line when the
container is narrow. Percentage sizes resolve against the parent.

## Form semantics

Not applicable. An hstack is not a form control.

## Screen-reader expectations

An hstack with the default `as="div"` adds no semantics. With `as="nav"` (and the other semantic
elements) the real element is rendered inside the shadow root; name a landmark with `aria-label` on the
host. See the Stack page for lists.

## Localisation

Not applicable: no strings. The flow and the logical padding edges follow `dir="rtl"` automatically.

## Consumer responsibilities

- Prefer `gap` over margins on the children, and `wrap` over deep nesting.
- Name landmarks (`as="nav"` with `aria-label`) and keep list markup native.
- Style the box through `::part(base)` or wrap the hstack in a `tct-section`/`tct-card`; painting the
  host does not survive an application reset.
