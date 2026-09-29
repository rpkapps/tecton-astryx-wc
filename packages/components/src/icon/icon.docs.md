---
title: Icon
folder: icon
category: Content
entries: [Icon]
summary: A single glyph from the icon registry, or your own slotted SVG, with consistent size, colour and accessibility semantics.
examples: [sizes, colors, labelled, tecton-set, custom-svg, rtl]
keywords: [icon, svg, glyph, symbol, pictogram, graphic, vector, image, registry]
dense:
  description: icon by registry name (or slotted svg) w/ 4 sizes, Tecton icon colors, decorative or labelled semantics
  usage: Icons are small visual symbols that represent actions, objects, or concepts. They improve scannability and reinforce meaning alongside text. Set `name` to a registered icon (Astryx role names + Tecton domain glyphs), or slot your own <svg>. Sizes and colours come from the design tokens; the default set is registered automatically.
  bestPractices:
    - {do: true, text: 'Use semantic icon names when available; they follow the registry and can be overridden once for the whole app.'}
    - {do: true, text: 'Override or add icons with registerIcons() (from @tecton-astryx/core/icons/registry.js) at app bootstrap; consumer registrations beat the built-in set.'}
    - {do: true, text: 'Pair icons with text labels; an icon-only control needs an accessible name on the control itself.'}
    - {do: true, text: 'For a meaningful standalone icon (no adjacent text), set `label`: it becomes role="img" with that name and is unhidden.'}
    - {do: true, text: 'Use the `color` variants (icon and status roles), not hardcoded colour values.'}
    - {do: false, text: 'Use icons as the only carrier of meaning; always provide a text alternative.'}
    - {do: false, text: 'Resize icons with arbitrary pixel values; use `size` (or the size an owning component supplies).'}
    - {do: false, text: 'Mix outlined and filled styles in one context.'}
    - {do: false, text: 'Set `label` on an icon inside a button or link that already has a name; that announces twice.'}
    - {do: false, text: 'Use a `src`, `icon` or `href` attribute; the attribute is `name`.'}
  properties:
    name: registered icon name (Astryx role such as close, chevronDown, search, or a Tecton glyph such as well, seismic, strata, well-filled); unknown name renders the default slot
    color: colour variant (inherit, primary, secondary, tertiary, disabled, accent, success, error, warning, blue, red, green, gray, cyan, teal, yellow, orange, pink, purple)
    size: xsm 12px, sm 16px, md 20px, lg 24px; unset takes the size of the owning component's icon slot, then md
    label: accessible name for a meaningful standalone icon; sets role=img and unhides; empty means decorative
    default: slot for a custom <svg> or the fallback shown when `name` is not registered
related: [button, text, spinner]
---

## Purpose

`tct-icon` draws one glyph at a consistent size and colour and gives it the right accessibility
semantics. Glyphs come from a registry: the default set (Astryx's semantic role names such as `close`,
`chevronDown` and `search`, drawn from Lucide, plus the Tecton domain glyphs such as `well`, `fault`,
`seismic` and `strata`, each also as `<name>-filled`) is registered the first time an icon connects.
Your own glyphs go in through `registerIcons()`, or straight into the default slot as an `<svg>`.

## When to use

- Beside a text label to reinforce meaning (button, menu item, status line).
- As the leading or trailing visual of an input or a list row.
- Standalone, with a `label`, when the glyph itself carries information (a status mark, a domain symbol
  in a legend).

## Alternatives

- An icon-only control: use `tct-button icon-only` with a `label`; it names the button and adds the
  tooltip. Do not put `label` on the icon inside it.
- A count or state in text form: `tct-badge` or `tct-status-dot`.
- A loading indicator: `tct-spinner`.

## Anatomy

A single `<svg>` (part `icon`), decorative unless the icon has a `label`. A custom glyph replaces the
`<svg>` by living in the default slot.

## Variants and states

- Sizes `xsm`, `sm`, `md`, `lg` (12, 16, 20 and 24 CSS px, the Tecton icon size tokens). Without `size`
  an icon takes the size its owning component supplies for its icon slot (a button sets it from the
  button size) and otherwise `md`.
- Colours map to the icon roles (`primary`, `secondary`, `tertiary`, `disabled`, `accent`) and the
  status and hue roles. `accent` paints `--color-icon-accent` (the Tecton adornment ink), because
  `--color-accent` is a fill in Tecton. `inherit` (default) follows the surrounding text colour.
- Stroke icons (the default set) use stroke width 2; change it with `--icon-stroke-width`.
- Directional glyphs (chevrons, arrows) mirror in right-to-left contexts.
- Glyphs that carry colours of their own (`strata`) keep them.

## Responsive behaviour

Not applicable beyond sizing: an icon is a fixed-size box and never reflows. Its size is a token, so a
theme can change the scale.

## Form semantics

Not applicable. `tct-icon` is not a form control and never participates in a form.

## Screen-reader expectations

- Decorative (default): hidden from assistive technology (the host is `aria-hidden` and so is the `<svg>`).
- With `label="Completed"`: exposed as an image named "Completed".
- Explicit `aria-hidden`, `role` and `aria-label` on the host win over the label-derived defaults, so an
  icon can be made meaningful, or hidden again, from markup.
- Give the name to the control, not the icon, when the icon sits inside a button or link.

## Localisation

`tct-icon` has no strings. Write `label` in the user's language. Directional glyphs mirror in RTL
automatically.

## Consumer responsibilities

- Register custom glyphs once at start-up with `registerIcons()`; raw SVG bodies you supply go through
  the sanitiser, but path data should still come from a source you trust.
- Provide `label` for meaningful standalone icons, and an accessible name on any control that contains
  only an icon.
- Keep colour contrast (3:1 for meaningful graphics, WCAG 1.4.11) when you choose a `color` for a
  standalone icon on a custom surface.
