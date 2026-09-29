---
title: Section
folder: section
category: Layout
entries: [Section]
summary: A painted page region that groups related content, with a background variant, dividers and padding.
examples: [default, variants, dividers, padding, page-layout, full-bleed, nested]
keywords: [section, panel, container, group, fieldset, region, block, page section, settings]
dense:
  description: page-level container for grouping content into regions; use INSTEAD of Card for settings panels, form groups and page sections
  usage: Section creates page regions. Use it for settings groups, form sections, sidebar areas. If you want to visually separate a part of a page, use Section, not Card. Cards are for discrete items (one profile, one notification).
  bestPractices:
    - {do: true, text: 'Use Section for page-level grouping: settings panels, form groups, sidebar regions. These are page sections, not discrete items.'}
    - {do: true, text: 'Start with the default variant; use muted only to call attention to a specific region.'}
    - {do: true, text: 'Add dividers between same-background sections that need separation.'}
    - {do: true, text: 'Combine with a heading and a stack for the typical page-section pattern.'}
    - {do: false, text: 'Use Card when you mean Section. Cards are discrete items (one notification, one profile); sections are page regions.'}
  properties:
    variant: background variant; section (default, the surface colour), transparent or muted
    dividers: sides with a divider rule, space separated (top bottom start end); the property takes an array
    padding: padding on all sides, spacing step (default 4); 0 for edge-to-edge content
    padding-inline: inline-axis padding step; preserves block padding
    padding-inline-start: inline-start edge padding step; wins over padding-inline and padding
    padding-inline-end: inline-end edge padding step; wins over padding-inline and padding
    padding-block: block-axis padding step; preserves inline padding
    padding-block-start: block-start edge padding step; wins over padding-block and padding
    padding-block-end: block-end edge padding step; wins over padding-block and padding
    width: width (number is px, string is a CSS length)
    height: height (number is px, string is a CSS length)
    max-width: maximum width
    min-height: minimum height
    default: the section's content
related: [card, stack, divider, grid]
---

## Purpose

`tct-section` is the way to create regions on a page: a settings group, a form section, a sidebar area,
anything that needs visual separation from its neighbours. It paints a background, pads its content and
can draw divider rules on any side. If you are tempted to use a `tct-card` for a page region, use a
section instead: cards are for discrete items.

The section paints on an inner box (part `base`); the default slot sits inside it.

## When to use

- Grouping a page into regions: settings panels, form sections, sidebars, list panes.
- Separating regions that share a background with a divider rule (`dividers`).
- Highlighting one region with the `muted` variant.
- Nesting a bleeding region inside a card or another section.

## Alternatives

- A discrete, self-contained item (a profile, a notification, a product): `tct-card`.
- Spacing children without painting anything: `tct-stack`, `tct-vstack`.
- A single rule between two blocks: `tct-divider`.

## Anatomy

- **Section** (`tct-section`): a host that carries the sizes.
- **Escape wrapper** (internal): cancels the padding of an enclosing padded container with negative
  margins, so a nested section runs edge to edge.
- **Base** (part `base`): the painted box: background, padding and divider rules, with the slotted
  content.

## Variants and states

- `variant`: `section` (default, the Tecton surface colour), `transparent` or `muted`.
- `dividers`: any of `top`, `bottom`, `start`, `end`; `start` and `end` are logical and follow the
  direction. A divider is a border of one border-width in the border colour.
- Padding: step 4 (16px) by default. `padding` sets all sides (`0` for edge-to-edge content),
  `padding-inline` and `padding-block` set an axis, and the four edge attributes set one edge; the most
  specific wins per edge. A theme can set `--section-padding` and its directional variants.
- An explicit `padding` step is passed on to nested sections that set none, through the private
  `--_section-padding-propagated`. Overlays reset it at their boundary.
- Nesting: a section inside a padded container (a card, another section) reads the container's
  `--container-padding-*` properties and cancels its inline padding, and its block padding where it is the
  first or the last child, so it runs edge to edge. It publishes its own padding the same way.

## Responsive behaviour

A section is as wide as its container (or its `width`) and its content wraps. It has no breakpoints of its
own; use a stack with `wrap` or a responsive `tct-grid` inside it. Percentage sizes resolve against the
parent.

## Form semantics

Not applicable. A section is not a form control and adds no `fieldset` semantics; wrap fields in a
`<fieldset>` with a `<legend>` when the group needs a name.

## Screen-reader expectations

None of its own: a section renders `div` boxes and adds no landmark and no accessible name, matching
upstream. If the region should be a landmark, give the host `role="region"` and an accessible name
(`aria-labelledby` pointing at its heading), or use a labelled `tct-stack as="section"` inside it.

## Localisation

Not applicable: no strings. Padding and dividers use logical edges, so `start` and `end` follow `dir`.

## Consumer responsibilities

- Give a section that is a landmark a name.
- Use `muted` sparingly; a page of muted regions has no emphasis.
- Style the box through `::part(base)`; painting the host does not survive an application CSS reset.
