---
title: More Menu
folder: more-menu
category: Action
entries: [MoreMenu]
summary: An overflow menu with a three-dot icon-only trigger: a dropdown menu with the defaults of a row-action button.
examples: [basic, row-actions, variants-sizes, presentation, rtl]
keywords: [moremenu, overflow, kebab, dotmenu, threedot, ellipsis, dropdown, contextmenu, actionmenu]
dense:
  description: three-dot icon-only overflow trigger opening a menu of actions; a tct-dropdown-menu with row-action defaults
  usage: An overflow menu with a three-dot icon-only trigger. Assign items (data-driven) or add tct-dropdown-menu-item children. Everything else - open, placement, alignment, presentation, events, keyboard - is the dropdown menu's. The label is the trigger's accessible name, its tooltip and the menu's name; keep it specific ("Report actions").
  bestPractices:
    - {do: true, text: 'Use it for secondary row or card actions that would clutter the layout as visible buttons.'}
    - {do: true, text: 'Give it a specific label ("Report actions"), not the generic default, when several appear on a page.'}
    - {do: true, text: 'Group related actions with dividers or titled sections and mark dangerous ones variant="destructive".'}
    - {do: true, text: 'Use presentation="adaptive" so the same short action set becomes a bottom sheet on compact touch layouts.'}
    - {do: false, text: 'Hide the only route to an important action in an overflow menu.'}
    - {do: false, text: 'Use it for navigation; use a navigation component instead.'}
  properties:
    items: data-driven rows - actions, dividers, sections; a row with items is a submenu
    label: trigger accessible name, tooltip and menu name; default the localized "More options"
    variant: trigger variant; default ghost
    size: trigger size (sm, md, lg); unset follows the size provider
    icon: registered icon name for the trigger; default moreHorizontal; slot icon takes a custom icon
    disabled: disables the trigger
    placement: side of the trigger (above, below, start, end)
    alignment: alignment along the placement axis (start, center, end)
    presentation: popover (default), bottom-sheet or adaptive; data-driven items only
    open: whether the menu is open; reflects; property and attribute writes never emit events
    menuWidth: attribute menu-width; minimum menu width
    backLabel: attribute back-label; label of the Back button in the bottom sheet
    tooltip: trigger tooltip; default the label
    iconOnly: always on: the trigger has no visible text
    noChevron: not used: the trigger is icon-only
    show: opens without an intent event
    hide: closes without an intent event
    toggle: opens or closes without an intent event
    requestClose: closes as the user would (cancelable tct-open-change)
    default: slot for compound menu rows
    trigger: slot for your own trigger button
    tct-open-change: cancelable intent event before a user-driven open or close (open, reason)
    tct-after-open-change: an open or close settled (open)
related: [dropdown-menu, context-menu, icon-button]
---

## Purpose

`tct-more-menu` is the overflow pattern: a visible three-dot, icon-only button that opens a menu of
secondary actions. It is a `tct-dropdown-menu` with the defaults of a row-action button (a ghost
variant, the `moreHorizontal` icon, no visible text, the label as its tooltip), so its rows, keyboard
contract, presentations and events are the dropdown menu's.

## When to use

- The secondary actions of a row, card or toolbar item that would clutter the layout as visible buttons.
- A menu whose trigger should stay compact and predictable across a table or list.
- Alongside a context menu, as the visible and touch-friendly route to the same actions.

## Alternatives

- A labelled trigger with a chevron: `tct-dropdown-menu`.
- Actions opened by right-click or long-press: `tct-context-menu`.
- One or two important actions: show them as buttons.
- Navigation: a navigation component.

## Anatomy

- The **trigger** (part `trigger`) is an icon-only `tct-button`: the three dots by default, a registered icon
  name in `icon`, or your own icon in `slot="icon"`. Its `label` is the accessible name and the tooltip.
- The **menu** (part `menu`) and its rows are the dropdown menu's: `tct-dropdown-menu-item`, checkbox and
  radio rows, dividers and submenus as compound children, or `items` in data mode.

## Variants and states

- `variant` (ghost by default) and `size` style the trigger; `disabled` blocks it.
- `placement` and `alignment` position the menu; `presentation="adaptive"` uses a bottom sheet on a compact
  touch device.
- `open` reflects; `tct-open-change` and `tct-after-open-change` behave as on the dropdown menu.

## Responsive behaviour

The trigger keeps its size at every width. The menu stays inside the viewport minus a gutter; for narrow
touch layouts use `presentation="adaptive"` (data-driven `items`).

## Form semantics

Not applicable. The menu is not a form control.

## Screen-reader expectations

- The trigger is a button named by `label`, with `aria-haspopup="menu"` and `aria-expanded`. Its name is
  always set, because the button has no visible text.
- The menu is a `menu` named by the same label; rows are `menuitem`, `menuitemcheckbox` and
  `menuitemradio`. See the dropdown menu for the full keyboard and focus contract.

## Localisation

The default label ("More options") is localized in all 30 shipped locales; `label` overrides it and should be
written in the user's language. The menu mirrors in right-to-left text.

## Consumer responsibilities

- Set a specific `label` when a page has several overflow menus.
- Keep a visible route to important actions; an overflow menu is for secondary ones.
- Listen for `click` on rows (or use `onClick` in data mode) for actions.
