---
title: Status Dot
folder: status-dot
category: Feedback & Status
entries: [StatusDot]
summary: A small coloured dot that signals status such as presence or severity.
examples: [variants, pulsing, with-icon, tooltip]
keywords: [statusdot, dot, indicator, status, signal, presence, availability, online, pip]
dense:
  description: a small coloured dot for status such as online/offline presence or severity
  usage: A small coloured dot that communicates status like online/offline presence or severity levels. Supports five semantic variants, an optional pulse and an icon. Always pair with a visible text label, as colour alone should not carry meaning.
  bestPractices:
    - {do: true, text: 'Use it as a binary present/absent signal; avoid encoding many distinct states in one dot, since colour and size alone cannot reliably distinguish them.'}
    - {do: true, text: 'Always pair with a visible text label so status is not conveyed by colour alone.'}
    - {do: true, text: 'Provide a descriptive label attribute for screen readers.'}
    - {do: true, text: 'Add an icon (a different one per status) when the dot must stand on its own without adjacent text.'}
    - {do: true, text: 'If you cannot add a label or an icon, convey the status accessibly elsewhere (adjacent text, a table column, a live region).'}
    - {do: false, text: 'Rely on colour alone to communicate status; the dot is not fully accessible in isolation.'}
    - {do: false, text: 'Use the pulse for decoration; reserve it for states that need immediate attention.'}
  properties:
    variant: success, warning, error, accent or neutral
    label: accessible name of the status (required); the dot is a role=img
    pulsing: pulse animation; stops under prefers-reduced-motion
    tooltip: text shown on hover to explain the status; a description, not the name
    icon: slot for an icon centred in the dot, painted in the variant ink
related: [badge, avatar]
---

## Purpose

`tct-status-dot` is an 8px coloured dot that carries one status: online or offline, healthy or
degraded, live. It is the smallest status signal in the system and, by design, colour only unless you give
it an icon.

## When to use

Use it beside a label, a name or an avatar to add presence or severity at a glance: a connection state, a
row's health, a "live" marker. Keep it to a binary or a very small set of states.

## Alternatives

- `tct-badge` when the status needs a word, or when more than a few states have to be told apart.
- `tct-avatar-status-dot` for a status that belongs on an avatar; it scales with the avatar and uses
  distinct shapes.
- `tct-progress-bar` for a task that is running rather than a state that holds.

## Anatomy

- **Dot** (`part="base"`): the painted, fixed 8px circle. It is a `role="img"` named by `label`.
- **Icon** (`slot="icon"`, `part="icon"`): optional, centred, painted from the variant's ink, hidden from
  assistive technology (the label carries the status). Drawn only when something is slotted.
- **Tooltip** (`part="tooltip"`): optional surface opened on hover, shown when `tooltip` is set.

## Variants and states

Five variants: `success`, `warning`, `error`, `accent` and `neutral`. Each is a pair of plate and ink so
a slotted icon keeps its contrast: the `on-*` ink of the status role, and the surface colour on the neutral
grey plate. `pulsing` fades the dot in and out every two seconds; under `prefers-reduced-motion` the pulse
stops. The dot is never focusable and has no hover or press state. In forced colours the dot is drawn in
`CanvasText` (`GrayText` for neutral).

## Responsive behaviour

The dot is a fixed size and never shrinks (`flex-shrink: 0`); it is `inline-flex` and aligned to the
middle of the text line, so it sits beside a label without extra layout.

## Form semantics

Not applicable. A status dot is not a form control and submits nothing.

## Screen-reader expectations

The dot is a `role="img"` whose name is `label`, so the status is announced without hovering; it is not
focusable and has no keyboard interaction. The tooltip only describes the dot (`aria-describedby`); it
never replaces the label. Colour alone fails WCAG 1.4.1: pair the dot with adjacent text or an icon per
status.

## Localisation

The label and the tooltip are yours to translate; there are no built-in strings. The dot has no
direction-dependent geometry, and the tooltip placement follows the writing direction.

## Consumer responsibilities

- Always provide a `label`.
- Convey the status somewhere that does not depend on colour: visible text, or an icon per status.
- Use the semantic variants for real status, and the pulse only for states that need attention.
- Keep the tooltip short; it appears on hover only, so it must not carry information that keyboard and
  touch users need.
