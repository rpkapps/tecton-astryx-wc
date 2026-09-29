---
title: Tab List
folder: tab-list
category: Navigation
entries: [TabList, Tab, TabMenu]
summary: A strip of tabs that switches between related views: a navigation landmark by default, the WAI-ARIA tabs pattern with panels on request.
examples: [basic, sizes, layout-and-divider, icons-and-badges, links, tabs-pattern, manual-activation, tab-menu, overflow, rtl]
keywords: [tabs, tab, tablist, tabbar, tabstrip, navigation, tabpanel, tabgroup, segmented, navtabs, panel, view, switcher, tab-menu, overflow]
dense:
  description: tab strip; nav landmark with aria-current by default, WAI-ARIA tabs pattern with panels via pattern="tabs"; scrolls when narrow
  usage: A strip of tct-tab children (and tct-tab-menu for extra options) with one selected value. Default (navigation pattern) it is a nav of buttons or links marking the current tab with aria-current; with pattern="tabs" (or role="tablist") it is the APG tabs pattern, each tab naming its panel with panel-id. Arrow keys move focus, the strip is one Tab stop, and the selected tab is always scrolled into view.
  bestPractices:
    - {do: true, text: 'Keep tab labels short and descriptive so people can scan the sections.'}
    - {do: true, text: 'Use pattern="tabs" when the strip swaps a panel in place, and give every tab a panel-id pointing at its panel; leave it off for navigation between pages.'}
    - {do: true, text: 'Use activation="manual" when showing a panel is costly, so arrow keys never trigger a load.'}
    - {do: true, text: 'Leave overflow handling on: a strip narrower than its tabs scrolls and keeps the selected tab in view. Use tct-tab-menu for a curated group of extra options.'}
    - {do: true, text: 'Match a Button size to the tab list size when they sit side by side (both md, both sm).'}
    - {do: false, text: 'Use tabs for sequential steps or a workflow; use tct-stepper.'}
    - {do: false, text: 'Confuse it with tct-segmented-control or a toggle: tabs navigate between views, a segmented control sets a value.'}
    - {do: false, text: 'Put anything but tabs inside a pattern="tabs" strip (a tablist owns only tabs).'}
  properties:
    value: the selected tab value (property); the value attribute is the initial selection; a user selecting a tab fires tct-value-change first
    size: sm, md (default) or lg; unset follows a size provider or toolbar
    layout: hug (default) or fill (tabs share the strip equally)
    has-divider: a rule under the strip; the selected indicator sits on it
    hasDivider: a rule under the strip; the selected indicator sits on it
    edge-compensation: inline pulls the strip through a padded container's inline padding and lands the edge labels on the content edge
    full-bleed: deprecated alias of edge-compensation=inline
    pattern: nav (default) is a nav landmark with aria-current; tabs is the WAI-ARIA tabs pattern
    role: role="tablist" on the element is the same request as pattern="tabs"
    activation: tabs pattern only; automatic (default) arrows move focus and select, manual arrows move focus only (Enter or Space select)
    overflow: auto or scroll scroll a narrow strip (fades, arrow buttons, selected tab kept in view); visible turns it off
    label: accessible name (default "Tabs"); a host aria-label or aria-labelledby wins
    default: tct-tab and tct-tab-menu children
    tct-value-change: cancelable, before a user selects a tab (value, oldValue, reason)
    label-hidden: tab shows only its icon; label stays the accessible name
    labelHidden: tab shows only its icon; label stays the accessible name
    href: tab is a link (navigation pattern only)
    panel-id: id of the panel this tab controls (tabs pattern); wired as aria-controls
    panelId: id of the panel this tab controls (tabs pattern); wired as aria-controls
    disabled: tab cannot be selected, skipped by arrow keys
    icon: slot for the icon shown while not selected
    selected-icon: slot for the icon shown while selected
    end: slot for content after the label (badge, dot)
    control: the focusable native control inside the tab or the menu trigger
    selected: tab is the tab list value (read-only getter)
    click: native click on a tab
    options: tab-menu options {value, label, icon} (property only)
    selectedOption: the tab-menu option that is the tab list value (read-only getter)
    tct-open-change: tab-menu menu about to open or close by user action (cancelable)
    tct-after-open-change: tab-menu menu finished opening or closing
related: [segmented-control, breadcrumbs, stepper, toolbar, dropdown-menu]
---

## Purpose

`tct-tab-list` lets people move between related views of the same thing without leaving it: the sections
of a project, the tabs of a settings page. It is a strip of `tct-tab` children with one selected `value`.
It speaks two ARIA patterns and you choose which:

- **Navigation** (default): a `<nav>` landmark of buttons or links. The current tab carries
  `aria-current="true"`. Use it when the tabs navigate, especially with `href` (real links).
- **Tabs** (`pattern="tabs"`, or `role="tablist"` on the element): the WAI-ARIA tabs pattern with
  `tablist`, `tab`, `aria-selected` and `aria-controls` to a panel. Use it when selecting a tab swaps a
  panel in place.

## When to use

- A handful of sibling views that share a page: overview, activity, settings.
- Switching a panel in place (tabs pattern) or moving between routes that look like tabs (navigation).
- A strip that may be narrower than its tabs: it scrolls, and keeps the selected tab in view.

## Alternatives

- A single value in a form or a mode switch: `tct-segmented-control`. Tabs control a view; a segmented
  control controls a value.
- Sequential steps: `tct-stepper`.
- The user's location in a hierarchy: `tct-breadcrumbs`.
- Many pages or a whole app's navigation: a side or top navigation.

## Anatomy

- **Base** (part `base`): the outer box, a `<nav>` in the navigation pattern.
- **Strip** (part `strip`): the scrolling row of tabs.
- **Tab** (part `tab` of each `tct-tab`): the native button or link; its **indicator** (part `indicator`) is
  the 2px bar under the selected tab.
- **Tab menu** (`tct-tab-menu`): a tab-styled trigger that opens a menu of extra options (parts `trigger`,
  `menu`, `menu-heading`).
- **Scroll buttons** (part `scroll-button`) and edge fades: appear while tabs are out of view.
- **Keyboard hint** (part `keyboard-hint`): "← → to navigate", shown once on first keyboard entry.

## Variants and states

- Sizes `sm`, `md`, `lg`; `layout="hug"` or `fill`; `has-divider`.
- A tab has an optional icon (a different one while selected), end content and `label-hidden` for icon-only
  tabs. It exposes `:state(selected)` and `:state(disabled)`.
- States: rest, hover, keyboard focus, pressed, selected, selected while hovered and disabled. Each state fill
  is paired with its own Tecton text role, measured in light and dark.
- `activation="manual"` (tabs pattern) moves focus with arrows and selects with Enter or Space.

## Responsive behaviour

Tabs hug their content and never wrap. When they are wider than the strip it scrolls horizontally with edge
fades, and for pointers that hover, arrow buttons; the selected tab is scrolled back into view on load, on a
value change and when the strip is resized. Arrow keys scroll the focused tab clear of the fade.
`overflow="visible"` turns this off. Put the strip in a container that can shrink (`min-inline-size: 0`).
`edge-compensation="inline"` pulls the strip through the padding of a padded layout container so a divider
spans the container's content width.

## Form semantics

Not applicable: tabs select a view, not a value. The element is not form-associated and never fires `change`
or `input`. Selection is `tct-value-change`.

## Screen-reader expectations

In the navigation pattern the strip is a navigation landmark named "Tabs" (or your `label`), each tab is a
button or link, and the current one is announced as current. In the tabs pattern the element is a tablist
named by `label`, each tab is announced with its position and whether it is selected, and a tab names the
panel it controls through `panel-id`. Give the panel `role="tabpanel"` and `aria-labelledby` pointing at its
tab. The scroll buttons and the keyboard hint are hidden from assistive technology.

## Localisation

The built-in strings are the default name ("Tabs") and the keyboard hint text, from the shared catalogs in
every shipped locale; `label` overrides the name. Tab labels and option labels are yours to translate. Arrow
keys and the scroll buttons follow the visual direction: in right-to-left contexts ArrowLeft moves to the next
tab.

## Consumer responsibilities

- Give every tab a unique `value`; a `value` that matches no tab leaves nothing selected.
- In the tabs pattern give every tab a `panel-id`, put the same id on the panel, and show or hide panels from
  `tct-value-change`. Only tabs may be children of a `pattern="tabs"` strip.
- Keep labels short; put long groups in a `tct-tab-menu`.
- To veto a change call `preventDefault()` on `tct-value-change`; to control the value set `value` from the
  handler.
