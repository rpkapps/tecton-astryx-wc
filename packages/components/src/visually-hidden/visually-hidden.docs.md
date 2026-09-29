---
title: Visually hidden
folder: visually-hidden
category: Utility
entries: [VisuallyHidden]
summary: Content that stays in the accessibility tree but is not painted, for icon-only names, live regions and screen-reader context.
examples: [icon-only-label, live-region]
keywords: [visually hidden, screen reader, sr-only, accessible name, live region, aria-live, assistive technology, clip]
dense:
  description: text for assistive technology that is clipped to 1px and not painted
  usage: Wrap content that screen readers must perceive but sighted users should not see, such as the accessible name of an icon-only control, an aria-live announcement, or extra context for a link. The clip block is fixed and cannot be overridden; the host is a generic wrapper that takes aria-*, role, id and data-* like any element.
  bestPractices:
    - {do: true, text: 'Name icon-only controls with hidden text, or prefer the label attribute on tct-button.'}
    - {do: true, text: 'Put aria-live (and role="status") on the host to announce text changes without painting them.'}
    - {do: true, text: 'Place it inside a positioned ancestor when the page can scroll, so the 1px box stays near its context.'}
    - {do: false, text: 'Hide content that should be visible to everyone; use it only for assistive technology.'}
    - {do: false, text: 'Style it or its part; the clip block wins over any author rule.'}
    - {do: false, text: 'Put focusable content inside; a keyboard user would land on something they cannot see.'}
  properties:
    default: the content exposed to assistive technology
related: [button, icon, spinner]
---

## Purpose

`tct-visually-hidden` keeps its content in the accessibility tree while removing it from what is painted.
It is the web-component form of the "screen-reader only" utility, packaged so the clip block is applied
the same way everywhere and cannot be overridden by accident.

## When to use

- The accessible name of a control that shows only an icon.
- Text that a live region announces after an action ("Moved task to Done").
- Supplementary context for assistive technology, such as the target of a repeated "Read more" link.

## Alternatives

- Icon-only buttons: `tct-button` with `icon-only` and `label` names the control and shows a tooltip.
- Content that everyone should read: plain text.
- Announcements from code: the shared announcer in `@tecton-wc/core/a11y/announcer.js`.

## Anatomy

One clipped box (`part="base"`) around a default slot. The box is one pixel square, pinned to the
inline-start, block-start corner of the nearest positioned ancestor, never clickable and never selectable.

## Variants and states

There are none. The upstream `as` prop chose the tag that was rendered (`span` or `div`); the host of a
custom element is always a generic wrapper, and the clipped box takes no space in the flow, so the choice has
nothing to change here. Put `role`, `aria-live` and the other `aria-*` attributes on the host.

## Responsive behaviour

The box is one pixel wide at every viewport, so it never causes overflow or a horizontal scrollbar.

## Form semantics

Not applicable.

## Screen-reader expectations

- The slotted text is exposed exactly as the same text in the page would be, and contributes to the accessible
  name of the control it sits in (`<button><tct-visually-hidden>Delete incident</tct-visually-hidden></button>`).
- The host has no role of its own. Add `role="status"` and `aria-live="polite"` to make a live region; write
  the message into the element after it is in the page, so the change is announced.
- Do not put focusable elements inside: the clip hides them from sight but not from the keyboard.

## Localisation

The content is yours to translate. Under an RTL language the box pins to the right edge of its positioned
ancestor (logical `inset-inline-start`).

## Consumer responsibilities

- Keep the text short and meaningful when read on its own.
- Translate it together with the visible text of the page.
- Do not rely on it for information that sighted users need.
