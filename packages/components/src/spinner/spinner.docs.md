---
title: Spinner
folder: spinner
category: Feedback & Status
entries: [Spinner]
summary: An animated indeterminate loading indicator with four sizes and four shades.
examples: [sizes, shades, labelled, theming]
keywords: [spinner, loader, loading, circular, progress, spin, activity, busy, indeterminate]
dense:
  description: animated loading ring, 4 sizes, 4 shades, optional visible label, progressbar semantics
  usage: An animated loading indicator for processes of unknown duration, such as data fetching or form submission. Give it a `label` (or rich content in the slot) so users know what is loading. For content with known dimensions use a skeleton instead.
  bestPractices:
    - {do: true, text: 'Provide a meaningful label to describe what is loading for screen reader users.'}
    - {do: true, text: 'Use shade="on-media" on dark or accent-coloured backgrounds; shade="inherit" inside a coloured control.'}
    - {do: false, text: 'Use for content areas with known dimensions; use a skeleton to preserve layout.'}
    - {do: false, text: 'Stack multiple spinners in one view; use one for the overall loading state.'}
    - {do: false, text: 'Use shade="onMedia"; the value is on-media.'}
  properties:
    size: ring diameter sm 10px, md 14px (default), lg 18px, xl 28px
    shade: default (progress accent), subtle (secondary text), on-media (light on dark), inherit (surrounding currentColor)
    label: visible text below the ring; it also names the spinner unless aria-label is set
    default: rich visible content below the ring, replacing the label text
related: [button, icon, text]
---

## Purpose

`tct-spinner` shows that work of unknown duration is in progress: a ring with a moving arc, in four sizes
and four shades, optionally with a visible label below it. For assistive technology it is an
indeterminate progress bar.

## When to use

- Data fetching, submission and other waits of unknown length.
- Inside a control that is busy (`tct-button` renders one while loading, with `shade="inherit"`).

## Alternatives

- Content with known dimensions: `tct-skeleton`, which preserves layout.
- Work with measurable progress: `tct-progress-bar`.

## Anatomy

A ring (`part="spinner"`: a track circle and a moving arc) and, when there is a `label` or slotted content,
the label below it (`part="label"` for the `label` text).

## Variants and states

- **Sizes.** `sm`, `md` (default), `lg`, `xl`: the ring is 10, 14, 18 and 28 px, and the box adds a stroke
  width on each side.
- **Shades.** `default` uses the Tecton progress accent, `subtle` the secondary text colour, `on-media` a
  light ring for dark or accent backgrounds (the track is drawn translucent), and `inherit` follows the
  surrounding `currentColor` with a translucent track.
- **Theming.** `--spinner-diameter`, `--spinner-stroke-width`, `--spinner-color`, `--spinner-track-color` and
  `--spinner-arc-fraction` re-theme the ring on the host or any ancestor. Lengths need units.
- **Motion.** The ring turns continuously. Under `prefers-reduced-motion: reduce` it turns slowly (3 s
  per revolution) instead of stopping, so it never reads as frozen. Spinners created seconds apart stay in phase.

## Responsive behaviour

A spinner is a fixed-size box that never shrinks in a flex row; a narrow host overflows visibly instead of
slicing the ring.

## Form semantics

Not applicable.

## Screen-reader expectations

- The host is an indeterminate progress bar (`role=progressbar`, no value) through `ElementInternals`.
- Its name is the host `aria-label` if you set one, else the `label` text, else "Loading" (localised).
  The visible label is not announced a second time.
- The spinner does not own a live region and does not announce itself; announce state changes through the
  component that starts the work (a button announces "Loading" once).

## Localisation

The default name (`@tct.spinner.loading`, "Loading") comes from the language in scope in 30 languages.
Your `label` is yours to translate.

## Consumer responsibilities

- Name what is loading (`label`, or `aria-label` for a spinner without visible text).
- Remove the spinner when the work finishes, and move focus meaningfully if the content it replaced had focus.
- Keep colour contrast (3:1) when you set `--spinner-color` on a custom surface.
