---
title: Heading
folder: heading
category: Content
entries: [Heading]
summary: A semantic h1 to h6 heading with themed sizing from the type scale, display types and truncation.
examples: [levels, display-types, accessibility-level, truncation, colors]
keywords: [heading, title, h1, h2, h3, h4, h5, h6, headline, subtitle, section, outline, display]
dense:
  description: semantic h1-h6 w/ themed sizing from the type scale, display types, line-clamp truncation + tooltip
  usage: The host is the heading. `level` sets the semantic level and the visual step (Tecton 24/20/16/14/12/10 px); `type` (display-1..3) switches to the display scale while the level keeps the semantics; `accessibility-level` changes only the announced level. Never skip levels in the document outline.
  bestPractices:
    - {do: true, text: 'Use the level that matches the document outline; sequential h1, h2, h3.'}
    - {do: true, text: 'Set accessibility-level when the visual level differs from the outline (sidebar headings, reused components).'}
    - {do: true, text: 'Use type="display-1..3" for hero titles and data callouts; the level still carries the semantics.'}
    - {do: true, text: 'Use max-lines to truncate long titles; a tooltip shows the full text when it is cut off.'}
    - {do: false, text: 'Skip heading levels in the outline (h1 then h3).'}
    - {do: false, text: 'Use tct-text for headings, or raw h1-h6 tags; use tct-heading so the theme tokens apply.'}
    - {do: false, text: 'Pick a level for its size; pick it for the outline and adjust the look with type or weight.'}
  properties:
    level: heading level 1-6 (semantics and visual step); default 2
    type: display-1, display-2, display-3 or a custom string; overrides the visual step from level
    weight: normal, medium, semibold, bold; wins over the level and the type
    accessibility-level: announced level (aria-level) when the outline differs from the visual level
    color: primary (default), secondary, disabled, placeholder, accent, inherit
    display: block (default) or inline; truncation and has-capsize force block
    max-lines: maximum lines before truncation (0 = none); a tooltip shows the full text when cut off
    no-truncate-tooltip: turn the truncation tooltip off
    truncate-tooltip-placement: above (default), below, start, end
    word-break: break-word or break-all while truncating (default break-all for one line, break-word otherwise)
    text-wrap: wrap, nowrap, balance, pretty
    justify: start (default), center, end (logical)
    has-capsize: optical alignment with text-box trim; forces block
    has-strikethrough: strikethrough decoration
    truncated: read-only boolean, true while max-lines cuts the heading off
    default: the heading content
related: [text]
---

## Purpose

`tct-heading` is a heading: the host carries the heading role and level, and the inner text box carries
the Tecton type scale. Levels 1 to 6 follow the Tecton scale (24, 20, 16, 14, 12 and 10 px, weight 500);
the display types provide the larger hero and data-callout sizes.

## When to use

- Page, section and panel titles that belong in the document outline.
- Hero headlines and large data callouts (with `type="display-1"` to `display-3`).

## Alternatives

- Body copy, labels and captions: `tct-text`.
- A title inside a card or dialog header: the component's own `heading` attribute, which renders this element.
- Visual-only large text that is not a heading: `tct-text type="display-2"`.

## Anatomy

A host (`tct-heading`, `role=heading` through `ElementInternals`) with one inner text box (`part="text"`)
holding the slotted content. A tooltip surface is rendered next to it only while the text is truncated
and the tooltip is enabled.

## Variants and states

- **Level.** `level` 1 to 6 (default 2; an invalid value falls back to 2). It sets the visual step unless a
  `type` is set.
- **Display types.** `display-1`, `display-2`, `display-3`: larger, lighter and tighter. The level still
  decides the semantics. A custom `type` keeps the level baseline; style it with
  `tct-heading[type="hero"]::part(text) { … }`.
- **Weight and colour.** `weight` wins over both the level and the type. `color` is `primary` by default.
- **Announced level.** `accessibility-level` changes only the `aria-level` the outline sees.
- **Truncation.** `max-lines`, `no-truncate-tooltip`, `truncate-tooltip-placement` and `word-break` work as on
  `tct-text`; the full text stays in the accessibility tree.
- **Layout.** `display`, `justify`, `text-wrap`, `has-capsize`, `has-strikethrough`. The heading is block by
  default; truncation and capsize force block.

## Responsive behaviour

Headings reflow with their container; use `text-wrap="balance"` for short multi-line titles. Truncation is
re-measured when the box resizes or the text changes.

## Form semantics

Not applicable.

## Screen-reader expectations

- Exposed as a heading of the announced level (`accessibility-level` if set, else `level`). The host never
  carries a `role` or `aria-level` attribute.
- Do not skip levels; screen-reader users navigate by heading level.
- Truncation only affects painting; the full text is read.

## Localisation

`tct-heading` has no strings. Alignment is logical (`justify="end"` is the left edge in right-to-left
languages).

## Consumer responsibilities

- Choose the level for the outline, not for the size; use `accessibility-level` when a component is reused
  at different depths.
- Keep exactly one level 1 heading per page.
- Provide `lang` for headings in a different language from the page.
