---
title: Icon Button
folder: icon-button
category: Action
entries: [IconButton]
summary: A button that shows only an icon; its label is the accessible name and the tooltip.
examples: [basic, variants, sizes, states, in-toolbar, floating, rtl]
keywords: [icon-button, icon, button, toolbar, action, compact, fab, icon-only]
dense:
  description: button showing only an icon, no visible text; label is the accessible name and tooltip
  usage: tct-icon-button is tct-button with icon-only always on. Set `label` (required, the accessible name and the hover/focus tooltip) and `icon` (a registered name) or slot an icon. Use it in toolbars, table rows and compact UI where the icon is universally understood. Everything else (variant, size, elevation, loading, disabled, tooltip, clickAction) works as on tct-button.
  bestPractices:
    - {do: true, text: 'Make the label specific: a trash icon labelled "Delete conversation" beats "Delete".'}
    - {do: true, text: 'Use the ghost variant in toolbars and dense areas to reduce visual clutter.'}
    - {do: true, text: 'Use `tooltip` to override the default tooltip (the label) when a longer hint helps.'}
    - {do: false, text: 'Use an icon button when the action is not obvious from the icon alone; use tct-button with text.'}
    - {do: false, text: 'Put visible text or slot content in it; the label is never painted.'}
  properties:
    label: accessible name and tooltip; never painted
    icon: registered icon name (attribute); or slot an icon into icon
    variant: primary, secondary (default), ghost, destructive, outlined, text-only
    size: sm, md (default) or lg
    elevation: resting shadow depth none, low, med or high; raise it for a floating action button
    loading: shows a spinner and blocks activation
    disabled: disables the button
    tooltip: tooltip text (defaults to the label)
    clickAction: async click handler with automatic busy state
    click: native click event
related: [button, button-group, toggle-button, toolbar]
---

## Purpose

`tct-icon-button` is `tct-button` with `icon-only` fixed on: a square button showing one icon. The `label` is
the accessible name and the built-in tooltip, and is never painted. Prefer it to `<tct-button icon-only>` for
explicit, greppable and codemod-safe icon-only buttons.

## When to use

- Toolbars, table rows and compact UI where space is tight and the icon is universally understood.
- A floating action button, with `elevation`.
- A trailing action beside a field or a list row (clear, more, close).

## Alternatives

- The action is not obvious from the icon: `tct-button` with text.
- An on/off choice: `tct-toggle-button`.
- Several related actions: `tct-button-group`, with icon buttons as members.

## Anatomy

The same anatomy as `tct-button`: one native button (part `button`) holding the icon (part `icon`), with the
tooltip in the same shadow root. The label and the busy spinner follow `tct-button`'s rules.

## Variants and states

- `variant`: `primary`, `secondary` (default), `ghost`, `destructive`, `outlined`, `text-only`.
- `size`: `sm`, `md`, `lg` (the icon follows the size). `elevation`: `none`, `low`, `med`, `high`.
- `loading` (or a pending `clickAction`) shows a spinner, announces once and blocks activation while staying
  focusable. `disabled` is the native disabled state; with a `tooltip` it is `aria-disabled` so the reason
  stays reachable.
- Inside a `tct-button-group` it squares its interior corners and follows the group's size.

## Responsive behaviour

The button is a fixed square of the size token and never reflows. Keep the touch target at least 24 by 24 px
when the size is `sm` by leaving spacing around it.

## Form semantics

Form-associated like `tct-button`: `type="submit"` submits its form with `name` and `value`, `type="reset"`
resets, and `href` renders a link. `SubmitEvent.submitter` is a temporary native button.

## Screen-reader expectations

Announced as a button named by `label` (the visible text is empty). The tooltip is its description. A busy
button announces once and reports `aria-busy`. Do not repeat the label in an adjacent visible text node.

## Localisation

The only built-in string is the busy announcement ("Loading"), from the shared catalogs. `label` and
`tooltip` are yours to translate. Directional icons mirror in right-to-left contexts.

## Consumer responsibilities

- Always set a specific `label`.
- Keep icons recognisable; check icon contrast (3:1) on custom surfaces.
- Do not slot text: an icon button has no visible text.
