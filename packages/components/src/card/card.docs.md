---
title: Card
folder: card
category: Container
entries: [Card]
summary: A bordered, optionally elevated container for a discrete, self-contained item.
examples: [default, variants, elevations, padding, fixed-height, full-bleed, in-grid, rtl]
keywords: [card, surface, panel, container, elevated, shadow, box, paper, tile, well]
dense:
  description: bordered container for DISCRETE items; NOT the default layout tool. Most content does not need a card.
  usage: Card is for discrete items with clear interaction boundaries (one profile, one notification, one product). Cards are NOT the default. Spacing and alignment create visual grouping without borders. Ask whether the item could be reordered or removed independently; if not, do not use a card.
  bestPractices:
    - {do: true, text: 'Ask "could I reorder or remove this independently?" If yes, it is a card. If no, it is a section of the page: use a heading and a stack, or tct-section.'}
    - {do: true, text: 'Use cards for discrete items: one profile, one notification, one metric, one product in a grid. Each card is one thing with clear interaction boundaries.'}
    - {do: true, text: 'Try removing the card: if the grouping still reads from whitespace and typography, skip it.'}
    - {do: true, text: 'Keep padding consistent across sibling cards so they align in a grid or list.'}
    - {do: true, text: 'Pair a card with a stack for a header, content and footer with actions.'}
    - {do: false, text: 'Default to cards for grouping; a heading and a stack with proper spacing creates hierarchy without borders everywhere.'}
    - {do: false, text: 'Wrap page sections in cards ("General settings", form groups); those are page regions, use tct-section.'}
    - {do: false, text: 'Create identical card grids (icon, heading, text, repeated); vary the layout or question whether cards are needed.'}
    - {do: false, text: 'Nest cards inside other cards; flatten the hierarchy or use spacing and dividers.'}
    - {do: false, text: 'Use colour variants for status; use a banner or a badge. Colour cards are for categorisation.'}
  properties:
    variant: background variant; default (card surface plus border), transparent, muted, or a colour (blue, cyan, gray, green, orange, pink, purple, red, teal, yellow) for categorisation
    elevation: resting shadow depth; none (default, flat), low, med or high
    padding: padding on all sides, spacing step; unset takes the theme padding (--card-padding, step 4 by default)
    padding-inline: inline-axis padding step; overrides padding on that axis
    padding-inline-start: inline-start edge padding step
    padding-inline-end: inline-end edge padding step
    padding-block: block-axis padding step; overrides padding on that axis
    padding-block-start: block-start edge padding step
    padding-block-end: block-end edge padding step
    width: width (number is px, string is a CSS length)
    height: height (number is px, string is a CSS length); a fixed height makes the card scroll its content
    max-width: maximum width
    min-height: minimum height
    default: the card's content
related: [section, stack, grid, divider]
---

## Purpose

`tct-card` is a bordered container for one discrete item: a user profile, a notification, a metric, a
product in a grid. The card gives the item a clear boundary you can act on (open it, reorder it, remove
it). It is not the default layout tool: most content groups need no container, and a region of a page
is a `tct-section`.

The card paints on an inner box (part `base`): the Tecton card surface, a 1px border, the container
radius and the padding. The default slot sits inside it.

## When to use

- One self-contained item that could be reordered, removed or acted on independently.
- Tiles in a grid where each tile needs an interaction boundary or a visual comparison.
- A callout with a categorising colour (`blue`, `green`, and so on).

## Alternatives

- A region of a page or a group of settings: `tct-section`.
- Grouping by whitespace and a heading, without a box: `tct-vstack` with a `tct-heading`.
- Status: a banner or a badge, not a colour card.
- A boundary inside a container: `tct-divider`.

## Anatomy

- **Card** (`tct-card`): a host that carries the sizes.
- **Base** (part `base`): the painted box that holds the background, the border, the radius, the shadow
  and the padding, and the slotted content.
- **Content**: whatever you put in the card, often a stack of a heading, text and actions.

## Variants and states

- `variant`: `default` (card surface with a 1px border), `transparent` (no background, no border),
  `muted` (the muted background), or one of ten colours that paint the matching
  `--color-background-<name>` token. A value the stylesheet does not know falls back to the plain box,
  so a theme can add a variant and style it with `tct-card[variant="brand"]::part(base)`.
- `elevation`: `none` (default, flat), `low`, `med`, `high`: the shadow tokens. Raise it only to float
  above content. A composing surface can layer an inset ring next to the elevation through the private
  `--_card-ring` custom property.
- Padding: spacing step 4 (16px) unless you set `padding`, the axis or edge attributes, or a theme sets
  `--card-padding` (and `--card-padding-inline`, `--card-padding-inline-start`, `--card-padding-inline-end`,
  `--card-padding-block-start`, `--card-padding-block-end`). The default variant draws its border inside
  the padding, so border plus padding equals the padding you asked for.
- `--card-background-color` replaces the fill of the default variant, and `--card-background-image` paints
  an image or gradient over the fill (for a tile that shows a picture behind its text). Set them on the
  card; text on a picture needs a `tct-media-theme` around it.
- A fixed `height` (anything but unset or `auto`) makes the card scroll its own content.
- The card publishes its padding as `--container-padding-*` and `--layout-padding-*`, so a
  `tct-divider full-bleed`, a nested `tct-section` and layout components inside it can run edge to edge or
  align to it.

## Responsive behaviour

A card is as wide as its container (or its `width`), and its content wraps. In a `tct-grid` with
responsive columns a card reflows with the grid. A fixed `height` makes it scroll instead of growing;
percentage sizes resolve against the parent.

## Form semantics

Not applicable. A card is not a form control; form controls inside it associate with their own form.

## Screen-reader expectations

None of its own: a card adds no role and no accessible name. If the card is a meaningful group, give it
one: a heading inside it, or `role="group"` (or `region`) with `aria-labelledby` on the host. A whole-card
click target is a different component (a clickable card); do not attach click handlers to a plain card
without a keyboard-operable control inside it.

A card with a fixed `height` that really overflows, and has nothing focusable inside, is a tab stop (the
inner box gets `tabindex="0"` and the shared focus ring), so its content can be scrolled with the keyboard
in every engine. When the content fits, or brings its own focusable elements, no tab stop is added.

## Localisation

Not applicable: no strings. Padding uses logical edges, so `padding-inline-start` pads the right edge in
RTL.

## Consumer responsibilities

- Give a card that represents a discrete item a heading or a name.
- Do not use colour variants to convey status on their own; the colour is decorative categorisation.
- Keep interactive content keyboard-operable: put buttons and links inside the card, not click handlers
  on it.
- Style the box through `::part(base)`; painting the host does not survive an application CSS reset.
