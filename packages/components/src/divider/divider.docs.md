---
title: Divider
folder: divider
category: Layout
entries: [Divider]
summary: A hairline rule that separates content into sections, horizontally or vertically, with an optional label.
examples: [default, with-label, variants, vertical, full-bleed, in-card, rtl]
keywords: [divider, separator, hr, rule, line, border, spacer, horizontal rule, section, label]
dense:
  description: visual separator (role separator) with optional centered label; horizontal or vertical; subtle or strong
  usage: A visual separator that divides content into distinct sections. Use it to create clear boundaries between groups of related content, or to demarcate regions within a layout. A horizontal divider fills the width of its container; a vertical one fills the height of its parent.
  bestPractices:
    - {do: true, text: 'Use subtle dividers between related content sections and strong dividers for high-contrast boundaries.'}
    - {do: true, text: 'Add a label when sections need a visible category heading; it also names the separator for assistive technology.'}
    - {do: true, text: 'Give a vertical divider a parent with a definite height (a flex row with an align-items or height).'}
    - {do: false, text: 'Overuse dividers; rely on spacing and layout to separate content when possible.'}
    - {do: false, text: 'Put a label on a divider that only needs to be a line; an unlabelled separator is a plain hairline.'}
  properties:
    orientation: horizontal (default) or vertical; exposed as aria-orientation
    label: plain-text label between two rule segments, also the separator's accessible name; the label slot takes markup for the same place
    variant: subtle (default) or strong; colour only, both are one border-width thick
    full-bleed: extends the rule to the edges of a padded container (tct-section, tct-card) with negative margins
related: [section, card, stack, hstack]
---

## Purpose

`tct-divider` draws a hairline rule between two pieces of content. It separates the groups inside a
card or a panel, a toolbar's button groups (vertical), or the "or" between two sign-in options
(labelled). The rule follows the Tecton divider design: one border-width thick in both weights, where
`strong` only changes the colour.

## When to use

- Separating sections that share a background and need a visible boundary.
- Grouping inside a card, a menu or a toolbar (`orientation="vertical"`).
- Labelling a boundary: "or", "Advanced", a date.
- Running a rule to the edges of a padded card or section (`full-bleed`).

## Alternatives

- Grouping by whitespace: often enough; prefer spacing (`gap`, padding) over rules.
- A boundary between page regions with different backgrounds: `tct-section` with `dividers`.
- A heading that starts a new section: `tct-heading`, with spacing.

## Anatomy

- **Separator** (the host): the element exposed as `role="separator"`.
- **Base** (part `base`): holds the rule segments and the label.
- **Line** (part `line`): a painted rule segment; a second one appears when there is a label.
- **Label** (part `label`, optional): text or markup between the two segments.

## Variants and states

- `orientation`: `horizontal` (default, fills the width) or `vertical` (fills the height of its parent).
- `variant`: `subtle` (default) or `strong`; the colour comes from the Tecton divider roles.
- `label` attribute or `label` slot: a label centred between two segments. In a vertical divider the
  label stacks between the segments.
- `full-bleed`: cancels the padding of the enclosing `tct-section` or `tct-card` so the rule reaches
  the container's edges (it reads the `--container-padding-*` properties they publish).

## Responsive behaviour

A horizontal divider is as wide as its container and a vertical one as tall as its parent; neither has
breakpoints. A vertical divider collapses to its label height in a parent without a definite height:
put it in a flex row with an explicit height or `align-items: stretch`.

## Form semantics

Not applicable. A divider is not a form control.

## Screen-reader expectations

- The host is a `separator` with `aria-orientation` set from `orientation`. Both are default
  `ElementInternals` state, so the semantics work without attributes on the host.
- A separator does not take its name from content, so the `label` text (or the text of a slotted
  label) is set as its accessible name, and follows edits to the slotted label.
- `aria-label` or `aria-labelledby` on the host win over the label.
- An unlabelled divider has no name; screen readers announce it as a separator.

## Localisation

Not applicable: no strings of its own. Write the `label` in the user's language. The rule and the label
padding are symmetrical, and `full-bleed` uses logical margins, so nothing changes under `dir="rtl"`
except which padding edge is "start".

## Consumer responsibilities

- Use dividers sparingly; they are structure, not decoration.
- Give a vertical divider a parent with a definite height.
- For a purely decorative rule, keep it unlabelled and consider hiding it from assistive technology with
  `aria-hidden="true"` on the host, so it is not announced.
- Write the `label` (or slotted label) in the user's language.
