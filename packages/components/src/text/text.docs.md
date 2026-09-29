---
title: Text
folder: text
category: Content
entries: [Text]
summary: Themed body text with semantic types, truncation with a tooltip for cut-off text, and layout helpers.
examples: [types, tecton-types, colors, weights-sizes, truncation, layout, semantics]
keywords: [text, typography, label, paragraph, heading, caption, font, body, subtitle, truncate, ellipsis]
dense:
  description: semantic body text w/ theme-driven type scale, colours, truncation + tooltip, tabular numbers
  usage: Text renders styled text. Pick a semantic `type` (body, label, supporting, large, code, display-1..3, plus the Tecton strong/data/action types) instead of setting size and weight; `max-lines` truncates and shows the full text in a tooltip when it is cut off. Use tct-heading for section titles.
  bestPractices:
    - {do: true, text: 'Pick a semantic type (body, label, supporting, large, code) instead of manually setting size and weight; the theme handles the details.'}
    - {do: true, text: 'Use max-lines to truncate long content; a tooltip with the full text appears on hover, so no text is lost.'}
    - {do: true, text: 'Set has-tabular-numbers for columns of numbers so digits align.'}
    - {do: true, text: 'Use as="p" for paragraphs; span (default) and div add no semantics.'}
    - {do: false, text: 'Override size and weight when a semantic type already matches; overrides fight the theme.'}
    - {do: false, text: 'Use tct-text for headings; use tct-heading with a level (1-6).'}
    - {do: false, text: 'Use a `variant` attribute; the attribute is `type`.'}
    - {do: false, text: 'Use as="label" to label a control; it cannot reach a control across the shadow boundary. Use tct-field.'}
  properties:
    type: semantic type (body, large, label, supporting, code, display-1..3, inherit, Tecton medium-strong, small-strong, tiny, large-data, medium-data, small-data, action-medium, action-small, or a custom string)
    size: font size override 4xs..4xl (keeps the type's weight and leading); prefer type alone
    color: primary, secondary, disabled, placeholder, accent, inherit; default secondary for supporting, else primary
    weight: normal, medium, semibold, bold
    display: inline (default) or block; truncation and has-capsize force block
    max-lines: maximum lines before truncation (0 = none); a tooltip shows the full text when cut off
    no-truncate-tooltip: turn the truncation tooltip off
    truncate-tooltip-placement: above (default), below, start, end
    word-break: break-word or break-all while truncating (default break-all for one line, break-word otherwise)
    text-wrap: wrap, nowrap, balance, pretty
    justify: start (default), center, end (logical)
    has-capsize: optical alignment with text-box trim; forces block
    has-strikethrough: strikethrough decoration
    has-tabular-numbers: tabular figures for aligned numbers
    as: host semantics span (default), p (paragraph), div, label, h1-h3 (headings level 1-3)
    truncated: read-only boolean, true while max-lines cuts the text off
    default: the text
related: [heading, icon, spinner]
---

## Purpose

`tct-text` renders styled text from the type scale: body copy, labels, supporting captions, code,
display sizes and the Tecton strong, data and action variants. It also owns text truncation (one line
with an ellipsis, several with a line clamp) and shows the full text in a tooltip whenever the text is
really cut off.

## When to use

- Body copy, labels, helper text, captions and inline code in your own layouts.
- Numbers in columns (`has-tabular-numbers`, or the `*-data` Tecton types).
- Anywhere long text must stay on one or two lines without losing information (`max-lines`).

## Alternatives

- Section titles and page headings: `tct-heading`, which is the heading in the outline.
- Inline code samples in prose or code blocks: `tct-code` and `tct-code-block`.
- A control label: the label of `tct-field` or the control's own `label` attribute.

## Anatomy

A host (`tct-text`) with one inner text box (`part="text"`) holding the slotted content. When the text is
truncated and the tooltip is enabled, a tooltip surface is rendered next to it (not part of the public
anatomy). The host is `inline` by default; `display="block"`, `max-lines` and `has-capsize` make it block.

## Variants and states

- **Types.** `body` (default), `large`, `label`, `supporting` (secondary colour), `code` (IBM Plex Mono),
  `display-1` to `display-3`, and `inherit` (size, weight, leading and colour from the surrounding text).
  The Tecton types add `medium-strong`, `small-strong`, `tiny`, `large-data`, `medium-data`, `small-data`
  (monospace, tabular figures), `action-medium` and `action-small`.
- **Custom types and colours.** Any other `type` renders with the body baseline; style it with
  `tct-text[type="hero"]::part(text) { … }`. A custom `color` renders as primary until you style
  `tct-text[color="brand"]::part(text)`.
- **Size.** `size` overrides only the font size (`4xs` to `4xl`); prefer `type`.
- **Truncation.** `max-lines="1"` clips with an ellipsis; a larger number clamps that many lines.
  `word-break` defaults to `break-all` for one line and `break-word` otherwise. The tooltip appears on hover
  (and on tap) only when the text is actually cut off; it repositions with `truncate-tooltip-placement`
  and is switched off with `no-truncate-tooltip`. The full text always stays in the accessibility tree.
- **Layout.** `justify`, `text-wrap`, `has-capsize` (needs `text-box` support, otherwise ignored),
  `has-strikethrough`, `has-tabular-numbers`.

## Responsive behaviour

Text reflows with its container; truncation is re-measured whenever the box resizes or the text changes.
Sizes are rem-based tokens, so they follow the root font size.

## Form semantics

Not applicable. `tct-text` is static content and never participates in a form.

## Screen-reader expectations

- `as="p"` exposes a paragraph; `as="h1"` to `as="h3"` expose a heading of that level. `span`, `div` and
  `label` add no role. Semantics are set on the host through `ElementInternals`, never as attributes.
- Truncation only affects painting: screen readers read the full text. The tooltip is a visual aid, described
  by the trigger, and closes with Escape.
- The text colour roles keep at least 4.5:1 against their surfaces; `disabled` and `placeholder` are exempt
  by design.

## Localisation

`tct-text` has no strings. Alignment (`justify`) is logical, so `end` is the left edge in right-to-left
languages. Truncation ellipses and line clamping follow the writing direction of the content.

## Consumer responsibilities

- Choose the semantics (`as`) that match your outline; use `tct-heading` for headings.
- Provide the language (`lang`) for content that differs from the page language.
- Do not put interactive content in truncated text: the clipped part cannot be reached.
