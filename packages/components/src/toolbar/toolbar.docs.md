---
title: Toolbar
folder: toolbar
category: Action
entries: [Toolbar]
summary: A labelled bar of contextual actions with start, centre and end areas, one Tab stop and arrow-key navigation.
examples: [basic, center-content, sizes, vertical, rtl]
keywords: [toolbar, nav, bar, actions, buttonbar, header, footer, action-bar, control-bar, roving]
dense:
  description: horizontal bar w/ start, center, end areas; one tab stop, arrows between controls; size cascades to children
  usage: tct-toolbar holds contextual actions inside a content area (above a table, in a card or panel), not a page header. Put content in slot="start", "center" and "end" (unslotted children are start content). It is one Tab stop; arrows (or up/down when vertical) move between buttons, inputs and other controls, Home and End jump to the ends. Set `size` once and the controls inside follow.
  bestPractices:
    - {do: true, text: 'Secondary actions (Back) at the start, primary actions (Save) at the end.'}
    - {do: true, text: 'Make temporary toolbars (bulk selection) visually distinct with a variant or dividers.'}
    - {do: true, text: 'Separate the toolbar from the content below with a divider, a variant, or both.'}
    - {do: true, text: 'Use it as a card header when the header has actions (filter, add); a title alone needs no toolbar.'}
    - {do: false, text: 'Overload it with actions; move rarely used ones into a menu.'}
    - {do: false, text: 'Set size on child buttons; set it once on the toolbar.'}
    - {do: false, text: 'Use it for app-wide navigation; use a top navigation or a layout header.'}
  properties:
    label: accessible name of the toolbar
    size: sm, md (default) or lg; minimum height and the default size of the controls inside
    gap: spacing step between items in an area (0, 0.5, 1, 1.5, 2, 3, 4, 5, 6, 8, 10), default 1
    orientation: horizontal (default) or vertical; which arrow keys move focus
    variant: transparent (default), section or muted surface
    dividers: sides with a rule: top, bottom, start, end (attribute is a space separated list)
    start: slot for content at the inline start
    default: unslotted children, treated as start content
    center: slot for centred content
    end: slot for content at the inline end
related: [button-group, button, segmented-control, section]
---

## Purpose

`tct-toolbar` is a horizontal (or vertical) bar for the actions of one region of a page. It follows the APG
toolbar pattern: it is one Tab stop, and the arrow keys move focus between the controls inside it
(buttons, links, text fields, selectors), wrapping at the ends. Text fields keep their caret keys: arrows
move focus only once the caret can go no further.

## When to use

- Actions above a table, in a card header or in a panel: filter, add, view options.
- Bulk-selection bars that replace a header while items are selected.
- A row that mixes buttons, a text field and a segmented control.

## Alternatives

- A few related buttons that belong together: `tct-button-group`.
- App-wide or page-level navigation: a top navigation or layout header.
- A title with no actions: a heading in a section or card header.
- Overflow of rarely used actions: a menu.

## Anatomy

- **Surface** (part `surface`): the outer chrome that paints the variant background and the divider rules.
- **Toolbar** (part `toolbar`): the bar with three areas, always laid out as start, centre, end. An empty centre
  collapses, so start-only, end-only and two-area toolbars need no special mode and look right before any
  script runs.
- **Areas**: slots `start` (also unslotted children), `center`, `end`.
- **Keyboard hint** (part `keyboard-hint`): "← → to navigate", shown once on first keyboard entry.

## Variants and states

- `size` (`sm`, `md`, `lg`) sets the minimum height and is the default size of every sized control inside.
- `variant`: `transparent` (default), `section`, `muted`. `dividers`: any of `top`, `bottom`, `start`, `end`
  (logical edges).
- `gap`: a spacing step between items inside each area.
- `orientation`: `horizontal` or `vertical`; arrows and the layout follow it.
- A nested composite that runs its own roving tabindex (a segmented control, a tab list) keeps its own tab stop
  and arrow keys; the toolbar's arrows move between its other controls.

## Responsive behaviour

The bar keeps one row; content that does not fit is the consumer's to move into a menu. The centre area
shrinks and clips before the start and end areas do. Vertical toolbars stack the areas and stretch controls.

## Form semantics

Not applicable. A toolbar is not a form control; controls inside it belong to their own forms.

## Screen-reader expectations

The bar is announced as a toolbar named by `label`, with its orientation. Focus is managed as one composite:
after Tab enters, arrow keys move between controls without announcing the toolbar again. The keyboard hint is
hidden from assistive technology. A host `aria-label` overrides the `label` property.

## Localisation

The only built-in string is the keyboard hint text ("to navigate"), from the shared catalogs in every shipped
locale. `label` and the content are yours to translate. Arrow keys follow the visual direction.

## Consumer responsibilities

- Always set `label` (or `aria-label`).
- Put controls, not long text, in the areas; keep the number of actions small.
- Disabled controls are skipped by the arrow keys; do not rely on them being reachable.
- Ghost buttons that should sit flush at the edges must opt in with `data-tct-edge-comp` (the toolbar pulls
  the first and last one in by the difference between its inline and block padding).
