---
title: Skeleton
folder: skeleton
category: Feedback & Status
entries: [Skeleton]
summary: A pulsing placeholder that previews the shape of content while it loads.
examples: [shapes, profile-card, wave, radius-scale]
keywords: [skeleton, placeholder, loading, shimmer, pulse, loader, bone, ghost, preloader]
dense:
  description: animated placeholder shape for content that is loading
  usage: An animated placeholder that previews the shape of content while it loads. Use it to build loading screens that match the layout of the real content. For content with unknown dimensions, use tct-spinner instead.
  bestPractices:
    - {do: true, text: 'Match the size and shape of the content being loaded to create a realistic placeholder.'}
    - {do: true, text: 'Stagger several skeletons with the `index` attribute for a natural wave.'}
    - {do: true, text: 'Put aria-busy="true" on the region that is loading; the skeletons themselves are hidden from assistive technology.'}
    - {do: false, text: 'Use skeletons when the content dimensions are unknown; use tct-spinner instead.'}
    - {do: false, text: 'Combine with a spinner on the same content area; pick one loading pattern.'}
    - {do: false, text: 'Show skeletons indefinitely; if loading takes too long, show an error or empty state.'}
  properties:
    width: width; a number is pixels, a string is any CSS length (default 100%)
    height: height; a number is pixels, a string is any CSS length (default 100%)
    radius: corner radius scale none, 0, 1, 2, 3 (default), 4 or rounded
    index: position in a group; pulse starts 1000ms + 100ms x index after mount
    ariaHidden: hidden from assistive technology by default, set through ElementInternals; aria-hidden="false" on the host overrides it
related: [spinner, progress-bar, empty-state]
---

## Purpose

`tct-skeleton` draws a placeholder block where content will appear, so a loading screen keeps the shape
of the finished page instead of jumping when the data arrives. It only paints: the surrounding region
owns the loading state.

## When to use

- A list, card or profile whose layout is known before its data is.
- Replacing text lines, avatars and thumbnails one for one while they load.

## Alternatives

- `tct-spinner` when the size or shape of the result is unknown.
- `tct-progress-bar` when you can report how far along the work is.
- `tct-empty-state` when loading finished and there is nothing to show.

## Anatomy

One painted block (`part="base"`) whose width, height and corner radius you set. Nothing else: no label,
no icon.

## Variants and states

- **Radius** follows the design scale: `none` and `0` (square), `1` (2px), `2` (4px), `3` (8px, default),
  `4` (8px) and `rounded` (fully rounded, for avatars and pills).
- **Motion**: the block holds still for one second (a fast load never flashes it) and then fades between a
  quarter and full opacity in ten steps. `index` delays the start by 100 ms per step so a group ripples.
  Under `prefers-reduced-motion` the pulse is off and the static placeholder stays.
- The colour is the Tecton `--color-skeleton` role. Forced colours paint it in `GrayText` at full
  opacity so it stays visible.

## Responsive behaviour

`width` and `height` accept any CSS length, so a skeleton can be `100%` wide, `12rem` or `min(100%, 20rem)`.
By default it fills the width of its container; the default height `100%` needs a parent with a definite
height, so give text-line skeletons an explicit `height`.

## Form semantics

Not applicable. A skeleton is decorative and never participates in a form.

## Screen-reader expectations

The host is hidden from assistive technology by default (an `aria-hidden` default the element owns; a host
`aria-hidden="false"` overrides it), so an empty placeholder is never announced. Put `aria-busy="true"` on
the region that is loading and remove it when the content arrives. A skeleton is never focusable.

## Localisation

Not applicable: a skeleton has no text. Its block direction and size do not depend on the writing mode;
the layout that contains skeletons mirrors normally in right-to-left contexts.

## Consumer responsibilities

- Size skeletons like the content they replace, and stop showing them when loading ends or fails.
- Mark the loading region `aria-busy` and announce completion or failure in your own live region.
- Do not rely on the placeholder to convey that something is loading to users of assistive technology.
