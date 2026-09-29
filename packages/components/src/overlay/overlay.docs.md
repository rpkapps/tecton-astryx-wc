---
title: Overlay
folder: overlay
category: Overlay
entries: [Overlay]
summary: Layers action or supporting content over media, cards or other bounded surfaces, with an optional scrim and hover or focus reveal.
examples: [hover-reveal, strip, scrims, focus, controlled, rtl]
keywords: [overlay, scrim, media, hover, focus, image, card, reveal, quick view]
dense:
  description: content layered over media or a card inside its bounds; scrim, position (fill/bottom/top), reveal on hover, focus or always; inverts content to stay legible
  usage: Overlay layers action or supporting content over media, cards, video or other bounded surfaces with an optional scrim and reveal behaviour. Put the base content in the default slot and the overlaid content in slot="content". For floating content anchored outside a surface use tct-popover, tct-tooltip or tct-dialog.
  bestPractices:
    - {do: true, text: 'Use overlays for short, contextual actions or labels that belong to the underlying media or surface.'}
    - {do: true, text: 'Keep overlay content compact so it stays legible over the scrim and does not hide important visual information.'}
    - {do: true, text: 'Leave essential actions reachable without hover: use show-on="always", or make sure the base content is focusable so focus reveals the overlay.'}
    - {do: false, text: 'Use Overlay for floating content anchored outside the surface; use Popover, Tooltip or Dialog.'}
  properties:
    showOn: when the content shows (always, hover, focus, hover-or-focus alias of hover); attribute show-on
    open: forces the content shown (attribute) or hidden and inert (property false); undefined leaves it to show-on
    scrim: scrim behind the content (dark default, light, none); content is inverted to stay legible
    position: where the scrim sits (fill default, bottom, top strips)
    alignment: alignment of the content inside the scrim (start, center, end default)
    default: slot for the base content (image, video, card)
    content: slot for the content shown over it
related: [popover, tooltip, thumbnail, card, aspect-ratio]
---

## Purpose

`tct-overlay` puts actions, labels or supporting text on top of a bounded surface, an image, a video, a
card, without changing the surface. It clips to that surface, washes it with an optional scrim and reveals
the content always, on hover, or on focus. It is not a floating layer: nothing leaves the container.

## When to use

- A quick action or label on a media tile ("Quick view", a duration, a caption).
- A caption strip at the top or bottom of an image or card.
- A hover-revealed action layer on a card, with the same actions reachable by keyboard.

## Alternatives

- Floating content anchored outside a surface: `tct-popover`, `tct-tooltip`, `tct-hover-card`.
- Content that must block the page: `tct-dialog`.
- Revealing row actions or a remove button inside a list row or tile without a scrim: the
  container-reveal styles (`overlay/container-reveal.styles.css`, the port of `useContainerReveal`) that
  Thumbnail and tree list rows use. Mark the container `reveal-container` and the content `reveal`.

## Anatomy

- The **container** (part `overlay`) clips to the base content and takes its corner radius.
- The **base content** is the default slot.
- The **scrim** (part `scrim`) is absolutely positioned over the base content and carries the `content`
  slot. Its colour wash is the Tecton overlay token.

## Variants and states

- `position`: `fill` (default) covers the base content; `bottom` and `top` are full-width strips at the
  block end and start that slide in from their edge.
- `alignment`: `start`, `center`, `end` (default) on the inline axis; mirrors in RTL.
- `scrim`: `dark` (default), `light`, `none`. With a scrim the content is inverted to stay legible, using
  the media-theme island on each `slot="content"` child (`data-media-theme`, managed by the element).
- `show-on`: `always` (default), `hover` (hover and focus; `hover-or-focus` is an alias), `focus`.
- `open`: the attribute forces the content shown; setting the property to `false` hides it and makes it
  inert; `undefined` hands control back to `show-on`. `:state(open)` matches while it is known to be shown.
- On a touch device, in hover mode, a tap on the surface toggles the overlay, unless the tap lands on an
  interactive element.

## Responsive behaviour

The overlay is as large as its base content, so it follows the content's responsive behaviour. Hover
reveal needs a hover-capable pointer; touch devices use the tap toggle described above.

## Form semantics

Not applicable.

## Screen-reader expectations

- Overlay content is ordinary content. While it is hidden it is only transparent and click-through, never
  `display: none` or `visibility: hidden`, so it stays in the accessibility tree and the tab order. Tabbing
  to it reveals it. Upstream hides it with `visibility: hidden`, where a hidden control could never receive
  focus.
- `open=false` is different: it makes the scrim `inert`, removing it from the tab order and the
  accessibility tree.
- Give the overlaid controls their own names; the overlay adds no role.

## Localisation

No built-in strings. Alignment mirrors in RTL.

## Consumer responsibilities

- Do not put essential information or the only route to an action behind hover; keep it reachable by
  keyboard and on touch (`show-on="always"`, or focusable base content).
- Make sure the overlaid content has enough contrast on the scrim (3:1 for controls, 4.5:1 for text).
- Give a media tile a name, an alternative text or a link text, as you would without the overlay.
