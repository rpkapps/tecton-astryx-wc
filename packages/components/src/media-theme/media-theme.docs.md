---
title: Media Theme
folder: media-theme
category: Utility
entries: [MediaTheme]
summary: Token context for content on an inverted surface: a dark or light side, or one measured from what is painted.
examples: [default, explicit-modes, auto-surfaces, fallback, off, toast, focus-ring, nested]
keywords: [theme, dark-mode, light-mode, media, inverted, overlay, scrim, toast, tooltip, surface, color-scheme]
dense:
  description: token overrides for content on inverted surfaces (media overlays, scrims, toasts, tooltips); flips color-scheme so light-dark() tokens resolve to the right side
  usage: Provides token overrides for content over an inverted surface. It sets data-media-theme, which flips the colour scheme so every light-dark() token resolves to the side of the surface, pins the text, surface, border, icon and accent roles, and moves the focus ring with them. A theme can customise components further on media surfaces (onDark, onLight). It has no box and paints no background.
  bestPractices:
    - {do: true, text: 'Use it for content over a dark background (image overlays, video scrims, dark cards) or on inverted surfaces such as toasts and tooltips.'}
    - {do: true, text: 'Prefer mode="auto" when the surface colour comes from a token: a token named "inverted" is not guaranteed to be inverted, and auto measures what was painted. It can decide that no media context is needed at all.'}
    - {do: true, text: 'Pair it with a background: it flips the token context but does not add one. Set the background on the parent element.'}
    - {do: true, text: 'Set fallback to the side that matches a background image: an image cannot be measured from CSS.'}
    - {do: false, text: 'Use it for app-level dark mode; use tct-theme with mode="dark" or mode="system". This is for local surface inversions.'}
  properties:
    mode: surface luminance context; dark for content over a dark surface, light for a light one, auto (default) to decide from the painted surface (no context when the ambient text already reads at 3:1, otherwise the side that reads better), off to remove the context; the element stays either way
    fallback: the side auto uses while the surface cannot be measured (first frame, background-image, no opaque layer); dark (default) or light; ignored unless mode is auto
    default: content rendered in the media context
related: [section, card, heading, text]
---

## Purpose

`tct-media-theme` gives its content the token context of a surface whose luminance differs from the page:
a dark card on a light page, a scrim over an image, a toast or a tooltip on the inverted surface. It sets
`data-media-theme="dark"` or `"light"`; the token pipeline (and a theme's generated CSS) targets that
attribute. The colour scheme flips, so every `light-dark()` token resolves to the side of the surface, and
the text, surface, border, icon and accent roles are pinned to it. Buttons, links, text and inputs inside
pick the change up through inherited custom properties; nothing inside has to know.

Only tokens change: the parent theme's structural styling (radius, weight, spacing) passes through
unchanged. A theme can style components further on media surfaces with `onDark` and `onLight`.

## When to use

- Content over a dark background: an image overlay, a video scrim, a dark card.
- Inverted surfaces such as toasts and tooltips.
- A surface whose colour comes from a token whose side is not guaranteed (`mode="auto"`).

## Alternatives

- Page-wide or subtree colour mode (light, dark, system): `tct-theme`.
- A surface that is just a card or a section: `tct-card` or `tct-section` with a variant, which already
  sets its own inks.
- Changing one colour: set the custom property on the element, not a whole context.

## Anatomy

There is no shadow root and no box. The element is `display: contents`, so a flex or grid parent lays out
its children directly, and it renders nothing itself. It sets one attribute, `data-media-theme`, and
publishes the resolved side to descendants through `themeContext`. It does not paint a background:
put the background on the parent, and the provider reads it.

## Variants and states

- `mode="dark"`: light text and inks over a dark surface. Pinned, whatever the page theme is.
- `mode="light"`: dark text and inks over a light surface.
- `mode="auto"` (default): measures the surface the browser painted. The surface is the parent in the
  flat tree, so a provider slotted into a card measures the card's painted base, not its transparent host.
  Translucent layers are composited over the first opaque ancestor; `display: contents` ancestors paint
  nothing and are skipped. The answer is `off` when the ambient text already reads on the surface at 3:1,
  otherwise whichever side reads better (ties go to dark). It measures again when a `style`, `class`,
  `data-theme` or `hidden` attribute changes on an ancestor and when the system colour scheme changes.
- `mode="off"`: no media context. The element stays in the tree, so a surface can switch contexts without
  re-creating its content.
- `fallback` (`dark` by default, or `light`): the side `auto` uses until it can measure, and whenever the
  backdrop is not knowable from CSS: a `background-image` (a gradient, a photo, a video poster) anywhere in
  the chain, or no opaque layer at all.
- The focus ring follows the side, including its inner ring on surfaces where the ring colour alone would
  not reach 3:1, so a focused control stays visible on the inverted surface.

## Responsive behaviour

None of its own: it takes no space. `auto` measures again when the painted surface changes through its
attributes; a change made only by a stylesheet swap does not reach it, so switch `mode` to `off` and back
to `auto` to measure again.

## Form semantics

Not applicable. It is not a form control and does not affect form association.

## Screen-reader expectations

It has no role, name or state and adds nothing to the accessibility tree; its children are exposed as if
the wrapper were not there. The context exists so that text and controls stay readable: on a dark surface
the text role resolves to a light colour that meets the contrast requirements the token pairs are checked
against. Do not rely on the media context to fix a surface whose own colour fails contrast.

## Localisation

Not applicable: no strings and nothing directional.

## Consumer responsibilities

- Paint the surface on the parent element, and do not put a `background-image` on it if `auto` must decide
  by itself: pick `dark` or `light`, or set `fallback` to match the image.
- Measure the real surface: put the provider directly on the element that owns the background, not several
  levels below an unrelated one.
- Use `tct-theme`, not this element, for the page's own colour mode.
- Without a token pipeline stylesheet (`tokens.css`) on the page the attribute has nothing to target.
- In engines without `light-dark()` (Chrome before 123, Safari before 17.5) the pinned roles still apply
  but the remaining tokens keep the page's side.
