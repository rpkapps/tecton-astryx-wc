---
title: Stack
folder: stack
category: Layout
entries: [Stack, StackItem]
summary: Arranges items in a row or a column with token-based spacing, alignment, wrapping and padding.
examples: [default, horizontal, alignment-horizontal, alignment-vertical, wrapping, item-fill, item-cross-align, page-layout, padding, scrollable, semantic-elements, rtl]
keywords: [stack, hstack, vstack, flexbox, flex, spacing, gap, horizontal, vertical, row, column, layout, align, justify, wrap, stack-item, fill]
dense:
  description: flex layout in a row or column with themed gap, alignment, wrap, padding and sizes; tct-hstack and tct-vstack fix the direction
  usage: Stack arranges items in a row or column with consistent spacing. Use the gap attribute to control the space between items. direction is horizontal or vertical (default vertical, not row or column). Wrap a child in tct-stack-item size="fill" to make it take the leftover space.
  bestPractices:
    - {do: true, text: 'Use gap for spacing between items; do not add margins to the children.'}
    - {do: true, text: 'Use tct-stack-item size="fill" to make one item stretch and fill the leftover space; add scrollable to make it a scroll region.'}
    - {do: true, text: 'Use as="nav", "ul" and the other semantic elements when the container carries meaning, and name landmarks with aria-label on the host.'}
    - {do: false, text: 'Nest stacks inside stacks; try wrap="wrap" first to let items flow to the next line.'}
    - {do: false, text: 'Use direction="row" or "column"; the values are horizontal and vertical.'}
    - {do: false, text: 'Write gap="space-between" style values; justify takes between, around and evenly, and gap takes a spacing step (0, 0.5, 1, 1.5, 2, 3, 4, 5, 6, 8, 10).'}
  properties:
    direction: horizontal flows items in a row, vertical (default) in a column
    gap: spacing-scale step between items (0, 0.5, 1, 1.5, 2, 3, 4, 5, 6, 8, 10)
    h-align: horizontal alignment; main axis (start, center, end, between, around, evenly) when horizontal, cross axis (start, center, end, stretch) when vertical
    v-align: vertical alignment; cross axis when horizontal, main axis when vertical
    justify: main-axis alias (start, center, end, between, around, evenly); h-align/v-align win
    alignment: cross-axis alias (start, center, end, stretch); the attribute is alignment, not align
    wrap: nowrap (default), wrap or wrap-reverse
    as: element the box renders as (div, section, article, aside, nav, header, footer, main, ul, ol, li); aria-* on the host is mirrored onto it
    scrollable: overflow auto on the stack box
    padding: padding on all sides, spacing step
    padding-inline: inline-axis padding step; overrides padding on that axis
    padding-inline-start: inline-start edge padding step
    padding-inline-end: inline-end edge padding step
    padding-block: block-axis padding step; overrides padding on that axis
    padding-block-start: block-start edge padding step
    padding-block-end: block-end edge padding step
    width: width of the stack (number is px, string is a CSS length)
    height: height of the stack (number is px, string is a CSS length)
    max-width: maximum width
    min-height: minimum height
    default: the stack's children (flex items)
    size: tct-stack-item flex participation; static (default) keeps its size, fill takes the free space
    cross-align-self: tct-stack-item cross-axis override (start, center, end, stretch)
related: [hstack, vstack, center, grid, section, card]
---

## Purpose

`tct-stack` lays out its children along one axis with a token-based `gap`, alignment, wrapping and
padding. It is the default tool for arranging things: a form's fields, a toolbar's buttons, the rows of a
card. `tct-hstack` and `tct-vstack` are the same element with the direction fixed, for the common cases.
`tct-stack-item` wraps one child to control how that child behaves inside the stack.

The children are the flex items of an inner box (part `base`), so a stack behaves like a single flex
container even though it is an element with a shadow root. The sizes you give it (`width`, `height`,
`max-width`, `min-height`) size the host itself, so `height="100%"` fills the stack's parent.

## When to use

- Arranging a sequence of items in a row or a column: form fields, button rows, metadata lines.
- Spacing children consistently from the spacing scale instead of margins.
- Building a page skeleton from nested stacks and `tct-stack-item size="fill"` regions.
- Rendering a navigation, list or region container (`as="nav"`, `as="ul"`) that also lays out its
  children.

## Alternatives

- Two-dimensional layouts (rows and columns): `tct-grid`.
- Centering one thing on one or both axes: `tct-center`.
- A painted page region or a discrete boxed item: `tct-section` or `tct-card`, which pad and paint and
  can hold a stack.
- Structured page chrome (header, scrollable content, footer): the layout components.

## Anatomy

- **Stack** (`tct-stack`): a host that carries the sizes, and an inner flex box (part `base`) that holds
  the padding, the gap and the slotted children. The box renders as the element you choose with `as`.
- **Stack item** (`tct-stack-item`, optional): the host is the flex item; an inner box (part `base`)
  holds the content and the scrolling.
- **Content**: whatever you put in the stack; each child is a flex item.

## Variants and states

- `direction`: `vertical` (default) or `horizontal`. `tct-hstack` and `tct-vstack` fix it.
- `gap`: a spacing step, applied between rows and columns alike.
- Alignment: `h-align` and `v-align` follow the axes (main or cross depending on `direction`);
  `justify` (main) and `alignment` (cross) are direction-independent aliases. A value that does not
  belong to its axis is ignored.
- `wrap`: `nowrap`, `wrap`, `wrap-reverse`.
- Padding: `padding`, then the `padding-inline` / `padding-block` axes, then the four edges; the most
  specific wins per edge.
- `scrollable`: `overflow: auto` on the stack box. `tct-stack-item size="fill" scrollable` is a complete
  scroll region inside a stack.
- `tct-stack-item`: `size` (`static`, `fill`), `cross-align-self`, `scrollable`, `as`.

## Responsive behaviour

A stack is as responsive as its content: use `wrap="wrap"` so a row of items flows onto the next line
in a narrow container. There are no breakpoints of its own. Percentages in `width` and `height`
resolve against the stack's parent; give that parent a definite height for `height="100%"` to have an
effect.

## Form semantics

Not applicable. A stack is not a form control and never participates in a form. Form controls inside
it associate with their own form as usual.

## Screen-reader expectations

- A stack with the default `as="div"` adds no semantics: the children keep theirs.
- `as="nav"`, `section`, `header`, `footer`, `main`, `aside`, `article`, `ul` and `ol` render the real
  element inside the shadow root, so they expose the landmark or list role. Name a landmark with
  `aria-label` or `aria-labelledby` on the host; it is mirrored onto the inner element.
- Lists: use `as="ul"` or `as="ol"` around native `<li>` children. The inner list carries
  `role="list"` so list semantics survive `list-style: none` in Safari. A `tct-stack-item as="li"` is
  a list item in the browser's accessibility tree, but automated checkers such as axe want native
  `<li>` children of a list.
- A scrollable stack has no accessible name by itself; see the consumer responsibilities.

## Localisation

Not applicable: a stack has no strings. Layout uses logical directions, so start and end, padding and
the flow of a horizontal stack follow `dir="rtl"` without extra work.

## Consumer responsibilities

- Choose the element with `as` when the container has a role, and name landmarks (`aria-label`).
- Keep list markup native: `<li>` children for `as="ul"` and `as="ol"`.
- Make a scrollable region reachable: browsers that make scrollers keyboard focusable (Chromium 130+)
  do it for you; elsewhere give the region a `tabindex="0"`, a `role="region"` and an accessible name.
- Prefer `gap` and padding over margins on children, and `wrap` over deep nesting.
- Do not put background, border or shadow on the host expecting them to survive an application CSS
  reset; style `::part(base)` or wrap the stack in a `tct-section` or `tct-card`.
