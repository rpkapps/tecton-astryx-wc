---
title: Dropdown Menu
folder: dropdown-menu
category: Action
entries: [DropdownMenu, DropdownMenuItem, DropdownMenuDivider, DropdownMenuCheckboxItem, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSubMenu]
summary: A menu of actions opened from a trigger button, compound or data-driven, with checkbox and radio rows, submenus and an adaptive bottom-sheet presentation.
examples: [basic, descriptions, states, selectable, submenu, data-mode, placement, sizes, custom-trigger, bottom-sheet, async-submenu, controlled, rtl]
keywords: [dropdown, menu, popover, select, actions, contextmenu, overflow, kebab, menubutton, menuitem, submenu, checkbox, radio, flyout]
dense:
  description: dropdown menu for actionable items in a popup opened from a trigger button; compound rows or data-driven items, popover or bottom sheet
  usage: A menu of actions opened from a button. Put tct-dropdown-menu-item, -checkbox-item, -radio-group, -divider and -sub-menu children in the menu (compound), or assign items (data-driven, the only mode that supports presentation="bottom-sheet" and "adaptive"). Use it to offer next-step actions without cluttering the interface. For navigation use a navigation component; for a three-dot overflow trigger use tct-more-menu; for right-click use tct-context-menu.
  bestPractices:
    - {do: true, text: 'Keep rows concise and action-oriented so people can scan them.'}
    - {do: true, text: 'Group related actions with dividers or titled sections when the menu has many rows.'}
    - {do: true, text: 'For a short, flat action set that needs a modal touch surface, use presentation="bottom-sheet"; use "adaptive" to stay anchored on pointer layouts and become a sheet on compact touch layouts.'}
    - {do: true, text: 'Give the trigger a label: it also names the menu for screen readers.'}
    - {do: true, text: 'Mark dangerous rows variant="destructive" and give a disabled row a reason nearby; disabled rows stay focusable.'}
    - {do: false, text: 'Use a dropdown menu for navigation; use a navigation component instead.'}
    - {do: false, text: 'Put more than 10-12 rows in one menu without grouping them into sections.'}
    - {do: false, text: 'Nest rich content (forms, inputs) in a menu; use tct-popover for interactive content.'}
  properties:
    open: whether the menu is open; reflects; property and attribute writes never emit events
    label: label of the built-in trigger and accessible name of the menu; default the localized "Menu"
    variant: trigger button variant; on a row, destructive draws it in the error colour
    size: trigger size; also sizes the rows (sm, md, lg); unset follows the size provider
    icon: registered icon name shown before the trigger label, or before a row label; slot icon takes a custom icon
    iconOnly: attribute icon-only; shows only the icon on the trigger, label is then its accessible name
    tooltip: trigger tooltip, dropped while the menu is open
    disabled: disables the trigger, or a row (disabled rows stay focusable but cannot be activated), or a submenu row
    noChevron: attribute no-chevron; removes the trigger chevron
    placement: side of the trigger (above, below, start, end); start/end are logical
    alignment: alignment along the placement axis (start, center, end)
    menuWidth: attribute menu-width; minimum width (bare number is px); intrinsic keywords set the preferred width; capped to the viewport
    presentation: popover (default), bottom-sheet or adaptive; data-driven items only
    items: data-driven rows - actions, dividers {type divider}, sections {type section, title, items}; a row with items is a submenu
    backLabel: attribute back-label; label of the Back button in the bottom sheet drill-in view
    show: opens without an intent event; resolves once settled
    hide: closes without an intent event; resolves once hidden
    toggle: opens or closes (force picks the state) without an intent event
    requestClose: closes as the user would (cancelable tct-open-change)
    default: slot for the menu rows (compound mode); on a submenu, the flyout rows
    trigger: slot for your own trigger button, replacing the built-in tct-button
    tct-open-change: cancelable intent event before a user-driven open or close (open, reason)
    tct-after-open-change: an open or close settled (open); every actual change
    description: secondary text below a row label (attribute) or rich content (slot description); rich labels go in slot label
    noCloseOnSelect: attribute no-close-on-select; the row keeps the menu open after activation; on a radio group, keeps it open after a choice
    closeOnSelect: attribute close-on-select; a checkbox row closes the menu when toggled
    checked: checkbox row state; reflects; toggled by activation after a cancelable tct-value-change
    value: on a radio group, the selected value; on a radio item, the value it stands for
    menuLabel: the row text typeahead and assistive technology read
    hasSpinner: attribute has-spinner; a spinner replaces the submenu caret while its rows load
    end: trailing row content (a keyboard-shortcut hint, a badge)
    tct-value-change: cancelable event before a checkbox row or radio group changes (value, oldValue, reason)
    click: native click, once per activation of a row
related: [more-menu, context-menu, popover, bottom-sheet, list, item]
---

## Purpose

`tct-dropdown-menu` presents a list of actions in a panel opened from a button. It implements the menu
button pattern: the trigger announces that it opens a menu and whether it is open, the panel is a
`menu` named by the trigger label, and rows are `menuitem`, `menuitemcheckbox` or `menuitemradio`.
Focus is managed like a native menu: arrow keys move between rows, typing jumps to a row, Escape closes
the top-most level and returns focus, and choosing a row closes the menu.

## When to use

- Secondary and contextual actions that would clutter the interface as visible buttons.
- The next step of a process: a short set of options attached to the button that starts it.
- A short, flat set of touch actions: use `presentation="bottom-sheet"` or `"adaptive"` with `items`.
- Independent options (checkbox rows) or a single choice (a radio group) that apply immediately.

## Alternatives

- Navigation: use a navigation component; a menu is for actions.
- Interactive content (forms, filters, rich layouts): `tct-popover`.
- A three-dot overflow trigger at the end of a row: `tct-more-menu`.
- Actions for a region, opened where the user right-clicks: `tct-context-menu`.
- Choosing a value for a field: a selector, not a menu.
- More than about twelve rows: group them into sections, or reconsider the interaction.

## Anatomy

- The **trigger** (part `trigger`) is a `tct-button` in the shadow root, configured by `label`, `variant`,
  `size`, `icon`, `icon-only`, `tooltip` and `disabled`, with a chevron unless `no-chevron`. Put your own
  button in `slot="trigger"` to replace it.
- The **menu** (part `menu`) is a `role="menu"` panel in a top-layer surface anchored to the trigger. It has
  a 1px rule on the recessed Tecton popover fill and no drop shadow, and scrolls only when its rows
  overflow.
- **Rows** are light-DOM children (compound mode) or rendered from `items` (data mode):
  - `tct-dropdown-menu-item`: icon, label, description and end content; `variant="destructive"` for
    dangerous actions.
  - `tct-dropdown-menu-checkbox-item`: an independent boolean with a decorative box.
  - `tct-dropdown-menu-radio-group` and `tct-dropdown-menu-radio-item`: a named single choice.
  - `tct-dropdown-menu-sub-menu`: a row that opens a flyout of its own rows.
  - `tct-dropdown-menu-divider`: a rule between groups. Data mode also has titled sections.
- The **bottom sheet** (part `sheet`) shows data-driven rows as a spacious list under a heading, with a Back
  button after drilling into a submenu row.

## Variants and states

- `placement` (`above`, `below`, `start`, `end`) and `alignment` (`start`, `center`, `end`) are logical and
  mirror in right-to-left contexts; the browser flips the menu when it does not fit. Without `menu-width`
  the menu is at least as wide as the trigger.
- `size` (`sm`, `md`, `lg`) sizes the trigger and the rows.
- Rows can be `disabled` (announced as unavailable, still focusable, never activated), `destructive`, or
  keep the menu open (`no-close-on-select`, and by default checkbox rows).
- A submenu can show a spinner instead of its caret (`has-spinner`) while its rows load.
- `presentation` picks the surface for data-driven items: `popover`, `bottom-sheet`, or `adaptive` (a sheet at
  768px and narrower with a coarse pointer, a popover elsewhere, switching live and keeping the menu open).
- `open` reflects, `:state(open)` matches while open, and `tct-open-change` is the cancelable intent event.

## Responsive behaviour

The menu never exceeds the viewport minus a 16px gutter and scrolls internally past 300px of height. On
compact touch devices choose the bottom-sheet or adaptive presentation for short data-driven action lists;
compound menus are always anchored popovers.

## Form semantics

Not applicable. A menu is not a form control: checkbox and radio rows change their own state and emit
`tct-value-change` (a non-form selection event), never `input` or `change`, and submit nothing.

## Screen-reader expectations

- The trigger has `aria-haspopup="menu"` (`dialog` for the sheet) and `aria-expanded`; the built-in trigger
  also has `aria-controls`. A custom trigger relies on the first two, because an ID reference cannot cross
  the shadow boundary.
- The panel is a `menu` named from the trigger label. Rows are `menuitem`, `menuitemcheckbox` (with
  `aria-checked`) or `menuitemradio` (with `aria-checked`) inside a named `group`. A submenu row is a
  `menuitem` with `aria-haspopup="menu"` and `aria-expanded`; its flyout is a named `menu`. Dividers are
  `separator`s.
- Disabled rows are focusable and announced as unavailable (`aria-disabled`).
- A pointer open focuses the panel itself so no row sounds pre-selected; a keyboard or assistive
  technology open focuses the first enabled row.
- Escape closes one level per press and returns focus to the row or the trigger; Tab closes the menu.

## Localisation

The default trigger label ("Menu") and the sheet's Back label are localized in all 30 shipped locales;
`label` and `back-label` override them. Write row labels in the user's language. Placement, the submenu
arrow keys and the caret mirror in right-to-left text, and typeahead matches with the locale's collation
(case and accent insensitive).

## Consumer responsibilities

- Give the trigger a `label`; give each radio group a `label`.
- Put only menu rows in the menu: a menu is not a container for forms or arbitrary content.
- Listen for `click` on a row (or use `onClick` in data mode) for its action; listen for
  `tct-value-change` on checkbox rows and radio groups, and call `preventDefault()` to veto a change.
- Keep a route to every action for assistive technology and touch: do not hide an important action in a
  menu that only appears on hover.
- Do not set `tabindex`, `role` or `aria-*` for the menu pattern on the rows yourself.
