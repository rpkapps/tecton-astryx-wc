---
title: Nav Icon
folder: nav-icon
category: Navigation
entries: [NavIcon]
summary: A circular accent container for the icon of a navigation header.
examples: [default, with-heading]
keywords: [navicon, iconbutton, toolbar icon, appbar icon, nav button, logo, header icon]
dense:
  description: circular icon container w/ accent background for navigation headers
  usage: NavIcon is a circular container with an accent background. Use it in navigation headers (top nav, page header) to visually identify a section or application. Display-only.
  bestPractices:
    - {do: true, text: 'Use in navigation headers to give the section a recognisable visual anchor.'}
    - {do: true, text: 'Pass a tct-icon (16px glyph) so it keeps its proportions.'}
    - {do: false, text: 'Use NavIcon for interaction; it is a display-only container, not a button.'}
  properties:
    icon: slot for the icon inside the circle; unnamed content is treated the same way
related: [icon, avatar]
---

## Purpose

`tct-nav-icon` frames one icon in an accent-coloured circle. It is the "logo" mark of a navigation header:
a small, recognisable anchor beside the title of an application or section.

## When to use

- Beside the heading of a top navigation bar, a side navigation title or a page header.
- Anywhere a single glyph needs the accent circle treatment and no interaction.

## Alternatives

- `tct-icon-button` for an icon that does something when pressed.
- `tct-avatar` for a person or a team.
- `tct-icon` on its own when no circle is wanted.

## Anatomy

A 32px circle (`part="base"`) that centres whatever is in the `icon` slot. A `tct-icon` is sized to 16px by the
container; your own `<svg>` should be about the same size.

## Variants and states

There is one appearance: the accent fill with the on-accent ink, fully circular. NavIcon has no interactive
states, so there is no hover, focus or disabled styling; if the circle must be pressed, make it a button.

## Responsive behaviour

Fixed size and never shrinks in a flex row. It does not change with the viewport.

## Form semantics

Not applicable.

## Screen-reader expectations

NavIcon has no role, and a plain `tct-icon` is decorative, so it is skipped by assistive technology; the
heading beside it names the section. If the icon is the only carrier of meaning, give the icon a `label`.

## Localisation

Not applicable: the container has no text. The circle and its centring do not depend on the writing
direction; a directional glyph inside it mirrors itself in right-to-left contexts.

## Consumer responsibilities

- Name the section in text next to the icon; do not rely on the glyph alone.
- Do not use NavIcon as a control.
- Choose a glyph that reads at 16px on the accent fill.
