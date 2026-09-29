---
title: Theme
folder: theme
category: Utility
entries: [Theme]
summary: A theme island that applies a colour mode (light, dark or system) and theme name to everything inside it, and keeps the page's data-theme in step.
examples: [modes, page-root, nested]
keywords: [theme, dark mode, light mode, color scheme, color-scheme, mode, system, provider, island, data-theme, theming]
dense:
  description: theme island for a subtree, colour mode light, dark or system, provides {name, mode} to descendants; the outermost one syncs html data-theme
  usage: Wrap the page (or a region) in tct-theme and set mode to light, dark or system. The island pins color-scheme, paints the page surface and text colour, and tells components inside which theme and resolved mode they are in. The outermost tct-theme also sets data-theme and data-tct-theme on html so the viewport, scrollbars and native controls follow.
  bestPractices:
    - {do: true, text: 'Use mode="system" (the default) unless the user chose a mode; it follows the operating system.'}
    - {do: true, text: 'Put one tct-theme at the top of the app; use nested ones for regions that must be light or dark regardless of the page.'}
    - {do: true, text: 'Add <meta name="color-scheme" content="light dark"> to the page head to avoid a flash before the theme loads.'}
    - {do: false, text: 'Set color-scheme or data-theme by hand on elements inside a theme; set mode on the theme instead.'}
    - {do: false, text: 'Expect a nested tct-theme to change the page chrome; only the outermost one syncs html.'}
  properties:
    theme: theme name (default tecton) or an object with a name; runtime-defined themes are wired to this property with the core theme utilities
    mode: light, dark, or system (default); reflected, system follows prefers-color-scheme
    default: the subtree that takes the theme and mode
related: [internationalization-provider, size-provider]
---

## Purpose

`tct-theme` puts a subtree in a colour mode. It is a theme island: a block that pins `color-scheme`,
paints the page surface and text colour, and tells the components inside which theme and resolved mode
(`light` or `dark`, never `system`) they are in. The outermost one also keeps `<html data-theme>` in step,
so the viewport, scrollbars, native form controls and portalled layers follow the mode.

## When to use

- The root of an application, to choose or follow the colour mode.
- A region that must be dark (or light) whatever the page is: a code panel, a media player, a preview.

## Alternatives

- Only a media surface that needs light ink on dark: `tct-media-theme`.
- A page that only follows the operating system and never switches: the token stylesheet alone already does
  that, and no element is needed.

## Anatomy

A single element with a default slot, no shadow root, and `display: block` (the island paints its own
background). The children stay in the page's own tree.

## Variants and states

- **Mode.** `light` and `dark` set `data-theme` on the theme and pin `color-scheme`. `system` (the default)
  removes `data-theme`, sets `color-scheme: light dark` and follows `prefers-color-scheme`, including
  changes made while the page is open. A nested `system` theme follows the operating system, not the theme
  around it.
- **Theme name.** `theme` is a name (`tecton` by default) or an object with a `name`; it is reflected as
  `data-tct-theme` and provided to descendants. Runtime-defined themes (token overrides) are wired to this
  property with the `core/theme` utilities; until then only the name is used.
- **Page root.** The outermost `tct-theme` sets `data-theme` (`light` or `dark`; removed for `system`) and
  `data-tct-theme` on `<html>`, and puts back what was there when it leaves. With several roots the first
  one owns `<html>`, and the next takes over when it goes.
- **Context.** Components read `{name, mode}` through the theme context; it changes only when the name or
  the resolved mode changes.
- **Forced colours.** Surface and text use the system colours through the tokens.

## Responsive behaviour

The island is a block that fills its container's width. It adds no breakpoints of its own.

## Form semantics

Not applicable. `color-scheme` makes native form controls inside match the mode.

## Screen-reader expectations

The theme exposes nothing to assistive technology: no role, no name, no state. Contrast follows the tokens
in both modes (3:1 for UI, 4.5:1 for text), and forced-colours users get system colours.

## Localisation

Not applicable. It has no text.

## Consumer responsibilities

- Persist the user's mode choice yourself and set `mode` from it.
- Add `<meta name="color-scheme" content="light dark">` to the document head, and set
  `<html data-theme>` on the server if you want to avoid any flash before scripts run.
- Do not put a theme inside a component's shadow root and expect the page to follow; it is a light-DOM
  provider for your own tree.
