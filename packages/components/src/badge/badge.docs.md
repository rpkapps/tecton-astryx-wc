---
title: Badge
folder: badge
category: Feedback & Status
entries: [Badge]
summary: Highlights a status or a category tag at a glance.
examples: [variants, status-labels, categories, counts, with-icon, long-labels]
keywords: [badge, tag, chip, label, status, indicator, count, counter, pill, notification, marker]
dense:
  description: highlights a status or category tag, NOT for general metadata
  usage: Badge is for status (Active, Failed) and category tags (Engineering, Design). It is NOT for metadata such as dates, durations, counts or descriptions; use supporting text (tct-text type="supporting") for those.
  bestPractices:
    - {do: true, text: 'Every badge steals attention. Only badge states where the user needs to act. If no follow-up is needed, use plain text.'}
    - {do: true, text: 'Use success / warning / error ONLY for system status that needs attention (Failed, Degraded, Action Required). They are visually loud: solid fills.'}
    - {do: true, text: 'Use the colour variants (blue, purple, teal ...) for category tags that classify items: team names, content types, priority levels.'}
    - {do: true, text: 'Keep labels to one or two words. Put more detail in surrounding text.'}
    - {do: true, text: 'Add an icon when it helps identify the badge type quickly, but always include a text label alongside it.'}
    - {do: false, text: 'Apply "success" badges to every healthy or normal item. If most rows are green "Active", none stand out; only highlight exceptions.'}
    - {do: false, text: 'Use badges for metadata. Durations, counts, dates and descriptions belong in tct-text type="supporting".'}
    - {do: false, text: 'Use status variants for non-status information.'}
    - {do: false, text: 'Repeat loud badges in every row. Common states are plain text; reserve badges for the exceptional.'}
    - {do: false, text: 'Make badges clickable; they are read-only. Use tct-button or tct-link for actions.'}
  properties:
    variant: visual style variant (neutral, info, success, warning, error, and nine hue variants)
    label: plain-text label attribute; over-wide labels clip with an ellipsis, full text in title
    default: the badge label when the label attribute is not set (rich content allowed)
    icon: optional leading icon slot
related: [status-dot, avatar]
---

## Purpose

`tct-badge` is a small pill that names a status ("Active", "Failed") or a category ("Engineering",
"Design"). It is read-only: it draws attention to one value and does nothing when pressed.

## When to use

Use a badge when a value represents a distinct state that a reader must notice, or a grouping tag that
classifies an item. Most metadata (dates, durations, counts, descriptions) is plain supporting text, not
a badge. Reserve the loud semantic variants (`success`, `warning`, `error`) for system status that
demands attention, and use the hue variants for categories.

## Alternatives

- `tct-status-dot` for a compact presence or severity signal that sits next to a label.
- `tct-text` with `type="supporting"` for metadata.
- `tct-button` or `tct-link` when the user can act on the value; a badge is never interactive.

## Anatomy

- **Pill** (`part="base"`): the painted, fixed-height, fully rounded container.
- **Icon** (`slot="icon"`, `part="icon"`): optional leading icon, drawn only when one is slotted.
- **Label** (default slot or the `label` attribute, `part="label"`): one line of text, clipped with an
  ellipsis when it does not fit. A plain-text label is also exposed as a native `title`, so the full
  text stays reachable on hover.

## Variants and states

Five semantic variants (`neutral`, `info`, `success`, `warning`, `error`) use solid fills from the
Tecton status roles; nine hue variants (`blue`, `cyan`, `green`, `orange`, `pink`, `purple`, `red`,
`teal`, `yellow`) use tinted backgrounds with coloured text. Badge has no interactive states, so there
is no disabled, hover or focus styling.

Tecton maps Badge to its chip: `neutral` is the chip's default fill and ink. Tecton has no lime badge
role that keeps 4.5:1 in both colour modes, so the upstream variant set is unchanged.

## Responsive behaviour

A badge is one line by construction. A label wider than the space available is cut with an ellipsis
inside the pill instead of escaping its container; the icon keeps its place and the label gives way.
The host is `inline-flex` with `max-inline-size: 100%`, so a badge inside a narrow flex or grid cell
shrinks to fit.

## Form semantics

Not applicable. Badge is not a form control and submits nothing.

## Screen-reader expectations

A badge has no role of its own: it is text in the reading order, so the label is read where it appears.
Meaning must never rest on colour alone, which is why every badge carries a text label; an icon is
decorative and never replaces it. A truncated plain-text label keeps its full text in `title`, which is a
pointer affordance only; do not depend on it for content a keyboard or touch user must read.

## Localisation

Badge has no built-in strings: the label is yours to translate. Labels that grow in other languages are
clipped with an ellipsis rather than reflowing the layout, so leave room for translated text or set a
wider container. The pill and icon mirror in right-to-left contexts (logical properties throughout).

## Consumer responsibilities

- Provide a text label for every badge, including badges that also show an icon.
- Use the semantic variants only for real status; do not use colour as the only cue.
- Do not make a badge clickable; wrap the value in a button or a link instead.
- Give a badge that can be clipped enough room, or accept the ellipsis and the `title` fallback.
