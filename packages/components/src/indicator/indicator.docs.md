---
title: Indicator
folder: indicator
category: Form Controls
entries: [CheckboxIndicator, CheckIndicator, RadioIndicator]
summary: Decorative selection visuals: the mark on a chosen option, the checkbox box and the radio circle. Controls render them by name, so a theme can replace one and every control follows.
examples: [checkbox, radio, check, pending, owner-hover]
keywords: [indicator, checkbox, radio, control, selection, mark, tick, themeable, swap, check, indeterminate]
dense:
  description: decorative selection visuals - mark on a chosen option (tct-check-indicator), checkbox box (tct-checkbox-indicator), radio circle (tct-radio-indicator). Rendered by selectors, checkbox and radio lists, menu rows. Replace one by name via defineIndicators() and every component drawing it follows.
  usage: Componentized selection visuals shared by checkbox, radio and menu rows. Decorative and aria-hidden; the owning control keeps the input, role, accessible name, focus and keyboard behaviour. Render them through getIndicator() / IndicatorController (from @tecton-wc/core/indicators/registry.js) so a theme can replace one by name.
  bestPractices:
    - {do: true, text: 'Restyle with ::part() and tokens first; replacing the element (defineIndicators) is the heavier path, for when the shape itself is wrong.'}
    - {do: true, text: 'A replacement element accepts state, size and disabled and draws default-slot content instead of its state mark; the owner passes its pending spinner through the slot.'}
    - {do: true, text: 'A replacement must be aria-hidden: the owner supplies role and accessible name, and a visible indicator would be announced twice.'}
    - {do: true, text: 'Use theme tokens for every colour, radius and border width in a replacement; meet 3:1 non-text contrast (WCAG 1.4.11) for the boundary and fill.'}
    - {do: true, text: 'Put a border-radius on the replacement root: the owner rings the indicator part at focus time and the outline follows that radius. Do not draw a focus ring yourself.'}
    - {do: false, text: 'Thread hover or pressed state in as attributes; the owner publishes hover with the indicator-scope class (--_indicator-hover), so hovering the row tints the control.'}
    - {do: false, text: 'Assume the indicator is only mounted when selected. The owner renders it in every state and passes state; drawing nothing in a state is the indicator decision (the check draws nothing when unchecked).'}
  properties:
    state: which state to draw; unchecked or checked (check and radio), plus indeterminate (checkbox); a check draws nothing when unchecked, box and circle always draw
    size: control size; md 24px (default) or sm 20px (the check mark is 16px at both)
    disabled: the owner is disabled; visual only, the owner keeps the disabled semantics
    default: slot for content drawn instead of the state mark (a pending spinner), keeping the chrome
related: [item, list]
---

## Purpose

Indicators are the shared selection visuals: the **check** on a chosen list option, the **checkbox** box
and the **radio** circle. They are decorative. The control that renders one keeps the input, the role, the
accessible name, the focus and the keyboard behaviour; the indicator only turns `state` into a picture.
That split is what lets them be themed: restyle one through its parts, or replace the element by name.

## When to use

- Inside a control you are building (a checkbox, a radio row, a menu row with a selection mark).
- As the selection mark in a listbox, where an unchosen row should show no empty box.

Use the finished controls (checkbox input, radio list, selectors) rather than assembling indicators by
hand where they exist.

## Alternatives

- A working checkbox or radio: `tct-checkbox-input`, `tct-radio-list`.
- A general glyph: `tct-icon`.
- A status dot or badge: `tct-status-dot`, `tct-badge`.

## Anatomy

- **Chrome**: the persistent box (checkbox) or circle (radio), present in every state. Parts
  `checkbox-indicator` and `radio-indicator`; the earlier `checkbox`, `radio` and `radio-dot` names are
  still set on the same elements.
- **State mark**: the check mark (`checkbox-indicator-check`), the indeterminate bar
  (`checkbox-indicator-dash`) or the radio dot (`radio-indicator-dot`).
- The **check** indicator has no chrome: it is the glyph, and nothing when unchosen.

## Variants and states

- `state`: `unchecked`, `checked`, plus `indeterminate` for the checkbox only. A radio and the check mark
  have no partial state.
- `size`: `md` (24px) or `sm` (20px).
- `disabled`: dims the indicator (the border drops to the Tecton disabled border) and keeps a chosen
  state readable.
- **Replacement content**: anything in the default slot is drawn inside the chrome instead of the state
  mark, in every state. Whitespace and comments do not count as content.
- Tecton reads selection as a bright chip, not as an accent: a checked box fills with the checkbox fill
  role and draws a glyph in the glyph role; a checked radio is a brighter ring and a filled dot. Every
  boundary and fill meets the 3:1 non-text contrast rule in both colour modes (D-013 Q-05), checked by
  the tests.

## Responsive behaviour

Not applicable. An indicator is a fixed-size box; its size follows the `size` attribute, not the container.

## Form semantics

Not applicable. An indicator is not a form control and never submits a value; the owning input does.

## Screen-reader expectations

Indicators are hidden from assistive technology (the painted box is `aria-hidden`, and the host adds
`aria-hidden` through ElementInternals). They own no role, no name and no state: the owning control names
the option and exposes checked, mixed or selected. An author `aria-hidden="false"` on the host does not
expose the mark.

## Localisation

Not applicable: no strings. The glyphs are symmetric and are not mirrored in right-to-left contexts.

## Consumer responsibilities

- Render indicators inside a control that provides the role, the accessible name and the keyboard
  behaviour.
- Publish hover with the `indicator-scope` class (`indicatorScope` from
  `@tecton-wc/core/indicators/registry.js`) on the element whose hover should tint the indicator, and
  add it only while enabled. Skip it for indicators that should not tint (decorative menu marks).
- Draw the focus ring on the indicator element with `::part(checkbox-indicator)` (or
  `radio-indicator`) when the real input is visually hidden; an indicator never draws its own ring.
- To replace an indicator app-wide, call `defineIndicators({check: 'my-check'}, themeName)` and render it
  through `getIndicator()` or `IndicatorController`; the replacement element must follow the contract in
  the best practices.
