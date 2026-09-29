---
title: AspectRatio
folder: aspect-ratio
category: Layout
entries: [AspectRatio]
summary: A box that keeps a fixed width-to-height ratio for its content as its container resizes.
examples: [default, ratios, ellipse, fit-modes, responsive-ratio, in-grid]
keywords: [aspect-ratio, ratio, proportion, responsive, embed, container, widescreen, thumbnail, letterbox, crop, video, image, media]
dense:
  description: maintains a specific aspect ratio for its content; optional ellipse shape and cover/contain/center fit
  usage: Maintains a fixed width-to-height ratio for its content as its container resizes. Use it for media containers like videos, images and thumbnails. It takes its width from the container and derives its height from the ratio, so it needs an ancestor with a definite width.
  bestPractices:
    - {do: true, text: 'Write the ratio as a fraction for readability: ratio="16/9" (or ratio="1.7778"). It is required.'}
    - {do: true, text: 'Use fit="cover" for images and video so the box sizes the child; the child should not repeat width, height or object-fit styles.'}
    - {do: true, text: 'Pass one child. With fit set, every direct child is stretched to fill the box, so put an overlay or caption inside a single wrapper child.'}
    - {do: true, text: 'Describe media children with alt (alt="" when decorative); the box adds no role and no accessible name.'}
    - {do: true, text: 'For a ratio that changes with the viewport or container, override aspect-ratio on tct-aspect-ratio::part(base) inside a media or container query.'}
    - {do: false, text: 'Use it for general layout containers; use the layout components.'}
    - {do: false, text: 'Nest aspect-ratio boxes; one level is enough.'}
    - {do: false, text: 'Constrain the height on its own; the width comes from the container, so a height alone clamps the box off ratio.'}
    - {do: false, text: 'Put it in a shrink-to-fit parent (inline-flex, width: fit-content, a float); it contributes no width there and collapses to zero.'}
  properties:
    ratio: width divided by height, a number (1.7778) or a fraction (16/9); required, invalid falls back to 1
    shape: rectangle (default) or ellipse (a circle at ratio 1, an oval otherwise)
    fit: cover fills and crops, contain fills and letterboxes, center keeps the natural size centred; unset, the child styles itself
    default: the content that fills the box
related: [grid, stack, card, center]
---

## Purpose

`tct-aspect-ratio` reserves a box with a fixed proportion and fills it with its content: a video, an
image, a map, a thumbnail, a placeholder. The box takes its width from its container and derives its
height from `ratio`, so the space is reserved before the media loads and the layout does not shift when
the container is resized.

## When to use

- Media that must keep its proportions at every width: video, images, embeds, maps.
- Thumbnails in a grid, so every tile is the same shape.
- A circular or oval crop, with `shape="ellipse"`.

## Alternatives

- A general container that should size to its content: `tct-stack`, `tct-section` or `tct-card`.
- Centring content in a box you size yourself: `tct-center`.
- A row of media that should share one height instead of one ratio: a grid with `row-height`.

## Anatomy

- **Ratio box** (part `base`): holds the aspect ratio, clips its overflow, and takes the elliptical clip
  when `shape` is `ellipse`.
- **Content**: an inner wrapper fills the box and positions the child. With `fit` set it also sizes the
  child; without it the child styles itself.

## Variants and states

- `shape`: `rectangle` (default) or `ellipse`. The clip is `border-radius: 50%` on the box, so it
  follows the ratio: a circle at 1:1, an oval at any other ratio.
- `fit`: `cover` stretches the child to the box and crops images and video with `object-fit: cover`;
  `contain` does the same with `object-fit: contain` (letterboxing); `center` keeps the child's natural
  size and centres it. The sizing rules apply to the direct child only, and any style you put on the
  child itself wins over them.
- A missing or invalid `ratio` falls back to a square and warns in development.

## Responsive behaviour

The box is as wide as its container and keeps its ratio as the container resizes. To change the ratio
at a breakpoint, override `aspect-ratio` from your own CSS on the part:

```css
@container (max-width: 30rem) {
  tct-aspect-ratio::part(base) { aspect-ratio: 4 / 3; }
}
```

The ratio is set through a custom property that the stylesheet reads, never inline, so your rule wins.
The box needs a definite width from its ancestors; in a shrink-to-fit parent it collapses.

## Form semantics

Not applicable. The box is not a form control.

## Screen-reader expectations

None of its own: the box adds no role and no accessible name. The content carries the whole
description: an image needs `alt` (empty when it is decorative), a video its own labelling, an embed a
`title`.

## Localisation

Not applicable: no strings. The box and its centring are symmetrical, so they do not change under
`dir="rtl"`.

## Consumer responsibilities

- Describe the content: `alt` on images, a `title` on iframes, captions where they help.
- Pass a single child (or one wrapper) when `fit` is set.
- Give the box an ancestor with a definite width; do not put it in a shrink-to-fit parent.
- Do not constrain its height on its own.
