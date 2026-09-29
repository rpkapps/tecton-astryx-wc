---
title: Context Menu
folder: context-menu
category: Action
entries: [ContextMenu]
summary: A menu of actions for a region that opens at the pointer on right-click, at the focused element on the context-menu keys, and on a touch long press.
examples: [basic, compound, data-submenu, presentation, disabled, rtl]
keywords: [contextmenu, right-click, menu, popover, actions, context, long-press, shift-f10]
dense:
  description: right-click context menu at the pointer; also ContextMenu key, Shift+F10 and touch long-press
  usage: A menu of actions for a region. Put the trigger area in the default slot; give the menu as items (data-driven) or as tct-dropdown-menu-item children in slot="menu". It opens at the pointer on right-click, at the focused element on ContextMenu or Shift+F10, and at the finger on a 500ms touch long-press. Use it to offer shortcuts to actions that also exist elsewhere in the UI.
  bestPractices:
    - {do: true, text: 'Keep rows concise and action-oriented; people expect quick contextual actions.'}
    - {do: true, text: 'Group related actions with dividers and sections when the menu has many rows.'}
    - {do: true, text: 'Use presentation="adaptive" so right-click stays at the cursor on desktop and long-press opens a bottom sheet on compact touch.'}
    - {do: true, text: 'Keep every action reachable another way for keyboard, screen-reader and touch users; a visible tct-more-menu is a good companion.'}
    - {do: false, text: 'Make the context menu the only way to reach an important action; not everyone knows to right-click or long-press.'}
    - {do: false, text: 'Put more than 10-12 rows in one menu without grouping them.'}
  properties:
    open: whether the menu is open; reflects; property and attribute writes never emit events
    label: accessible name of the menu; default the localized "Context menu"
    size: row size (sm, md, lg); unset follows the size provider
    disabled: the browser's own context menu shows and long-press does nothing
    menuWidth: attribute menu-width; minimum menu width, default 160px; bare number is px
    presentation: popover (default), bottom-sheet or adaptive (a sheet on compact touch)
    items: data-driven rows - actions, dividers, sections; nested items open a flyout (popover) or a drill-in view (sheet)
    backLabel: attribute back-label; label of the Back button in the sheet drill-in view
    show: opens at the bottom-start of the trigger area without an intent event
    showAt: opens at a viewport point (x, y) without an intent event
    hide: closes without an intent event
    toggle: opens or closes without an intent event
    requestClose: closes as the user would (cancelable tct-open-change)
    default: slot for the trigger area
    menu: slot for compound menu rows
    tct-open-change: cancelable intent event before a user-driven open (right-click, keys, long press) or close (open, reason)
    tct-after-open-change: an open or close settled (open)
related: [dropdown-menu, more-menu, bottom-sheet]
---

## Purpose

`tct-context-menu` adds a menu of actions to a region. It opens where the user right-clicks, on the
ContextMenu key or Shift+F10 at the focused element, and on a touch long press at the finger, and it
uses the same rows and keyboard contract as `tct-dropdown-menu`. The default slot is the trigger area;
the menu is data-driven (`items`) or compound (rows in `slot="menu"`).

## When to use

- Shortcuts to the actions of a specific element or region: a file row, a canvas layer, a table cell.
- Power-user access to actions that are also available through visible controls.

## Alternatives

- A visible trigger: `tct-dropdown-menu`, or `tct-more-menu` for the overflow pattern.
- Actions people must discover: show them, or add a visible more-menu beside the region.
- Interactive content: `tct-popover`.

## Anatomy

- The **trigger area** (part `trigger`) wraps the default slot. It suppresses native text selection and the
  iOS callout so a long press opens this menu, unless the menu is `disabled`.
- The **menu** (part `menu`) is a `role="menu"` panel anchored to a 0x0 point at the pointer, with a 1px
  rule on the recessed Tecton popover fill and no drop shadow.
- **Rows** are the dropdown menu's: `tct-dropdown-menu-item`, checkbox and radio rows, dividers and
  submenus (compound rows carry `slot="menu"`).
- The **bottom sheet** (part `sheet`) shows the rows as an action sheet for `presentation="bottom-sheet"` or
  the adaptive policy on compact touch.

## Variants and states

- `presentation`: `popover` opens at the pointer; `bottom-sheet` always uses an action sheet; `adaptive`
  uses the sheet at 768px and narrower with a coarse pointer and the popover elsewhere, switching live.
- `disabled` leaves the browser's own menu alone and ignores long press.
- `size` sizes the rows; `menu-width` sets a minimum width (default 160px).
- Opening at a viewport edge flips the menu so it stays on screen. `show()` opens at the bottom-start of the
  trigger area and `showAt(x, y)` at a viewport point.

## Responsive behaviour

Right-click opens at the pointer; on touch a 500ms long press opens at the finger (movement past 10px,
release, a second finger or a browser gesture cancels it). Use `presentation="adaptive"` on compact touch so
the menu is a reachable bottom sheet. Long press is invisible: keep a visible route to important actions.

## Form semantics

Not applicable. The menu is not a form control.

## Screen-reader expectations

- The menu is a `menu` named by `label` ("Context menu" by default); the trigger area has no role and no
  `aria-haspopup`, because it is not a control.
- Keyboard users open it with the ContextMenu key or Shift+F10 on the focused element; the first enabled row
  takes focus, and focus returns to the element that had it before the menu opened.
- Rows, checkbox and radio states, submenus and disabled rows are announced as in the dropdown menu.
- Escape closes one level per press; Tab closes the menu. IME composing Escape is ignored.

## Localisation

The default label ("Context menu") and the sheet's Back label are localized in all 30 shipped locales;
`label` and `back-label` override them. Menus, flyouts and the arrow keys mirror in right-to-left text.

## Consumer responsibilities

- Make the trigger area focusable when keyboard users need to open the menu on it (a focusable child, or
  `tabindex="0"`); the ContextMenu key and Shift+F10 open the menu at the focused element.
- Provide another route to every action; the context menu is a shortcut, not the only way.
- Do not put content that people select and copy inside the trigger area unless `disabled` allows the
  browser's behaviour: the area suppresses text selection so long press works.
- Listen for `click` on rows (or use `onClick` in data mode) for actions.
