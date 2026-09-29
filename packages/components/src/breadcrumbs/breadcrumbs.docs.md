---
title: Breadcrumbs
folder: breadcrumbs
category: Navigation
entries: [Breadcrumbs, BreadcrumbItem]
summary: A navigation trail from the root to the current page; long trails collapse into a menu.
examples: [basic, variants-and-separators, icons, current-and-actions, menus, collapsed, rtl]
keywords: [breadcrumbs, breadcrumb, navigation, nav, crumbs, trail, path, hierarchy, wayfinding, ellipsis, overflow]
dense:
  description: nav trail of links to the current page; last item is current automatically; long trails collapse into an ellipsis menu
  usage: A labelled nav around tct-breadcrumb-item children. Ancestors are links (href); the last item is the current page (aria-current="page") without extra markup, or mark one with current. A crumb can open a menu of sibling pages (menu / slot="menu"). max-items folds the middle of a long trail into an ellipsis menu.
  bestPractices:
    - {do: true, text: 'Place breadcrumbs above the page heading so people see where they are before reading.'}
    - {do: true, text: 'Keep labels short and matching the titles of the pages they link to.'}
    - {do: true, text: 'Give each trail its own label when a page renders more than one, so the landmarks stay distinguishable.'}
    - {do: true, text: 'Use the supporting variant in dense UIs such as admin panels or sidebars.'}
    - {do: false, text: 'Use breadcrumbs as the primary navigation; they supplement a sidebar or top nav.'}
    - {do: false, text: 'Show breadcrumbs on top-level pages that have no parent.'}
    - {do: false, text: 'Let a trail grow past about five levels without max-items; simplify the hierarchy instead.'}
  properties:
    variant: default or supporting (smaller, secondary text)
    label: accessible name of the nav landmark (default "Breadcrumb"); a host aria-label wins
    separator: text between items (default /), decorative; the slash mirrors in RTL
    separator-icon: a registered icon name used as the separator instead of text
    separatorIcon: a registered icon name used as the separator instead of text
    max-items: collapse a longer trail; keeps the first and the last max-items - 1 items and folds the rest into an ellipsis menu (0 never collapses)
    maxItems: collapse a longer trail; keeps the first and the last max-items - 1 items and folds the rest into an ellipsis menu (0 never collapses)
    default: tct-breadcrumb-item children (trail) or the label (item)
    href: destination of a link crumb
    current: this item is the current page (plain text, aria-current=page); current="false" opts out of the automatic last-item choice
    icon: registered icon name before the label (or slot icon)
    menu: data rows of a menu crumb, the shape of tct-dropdown-menu items (property); or slot=menu children
    menu-size: sm, md or lg rows of the crumb menu; default sm in a supporting trail
    menuSize: sm, md or lg rows of the crumb menu; default sm in a supporting trail
    click: native click on a link or action crumb
related: [tab-list, stepper, dropdown-menu, link]
---

## Purpose

`tct-breadcrumbs` shows where the current page sits in a hierarchy and offers a way back up. It is the
WAI-ARIA breadcrumb pattern: a labelled navigation landmark around an ordered list of crumbs with a
decorative separator between them and `aria-current="page"` on the current one. Tecton breadcrumbs sit
directly on the page: ancestors are dimmed, the current crumb is bright, and a long trail folds into an
ellipsis.

## When to use

- At the top of detail pages, settings panels and anywhere the hierarchy is more than two levels deep.
- With a menu crumb, to offer sibling pages at one level.
- With `max-items` when a trail can grow long.

## Alternatives

- Primary navigation: a side or top navigation; breadcrumbs only supplement it.
- Switching views of one page: `tct-tab-list`.
- Progress through a sequence: `tct-stepper`.

## Anatomy

- **Trail** (part `base` on the `<nav>`, part `list` on the `<ol>`).
- **Item**: a list item (part `item`) holding a **separator** (part `separator`) and the **crumb** (part
  `crumb`): a link, a button, plain text for the current page, or a menu trigger (part `menu-trigger`) with a
  chevron.
- **Icon**: an optional icon before the label (`icon` attribute or `icon` slot).
- **Ellipsis** (part `overflow-trigger`): the button that stands for collapsed crumbs (`max-items`), with the
  menu (part `menu`) of the hidden ones.

## Variants and states

- `variant="default"` or `supporting` (smaller, secondary).
- The current crumb: explicit with `current`, or the last item automatically. `current="false"` opts an item
  out. A current crumb can still have a menu (both `aria-current` and `aria-haspopup`).
- Link crumbs underline on hover; action and menu crumbs are buttons; a keyboard-focused crumb draws the
  Tecton focus ring.
- Collapsed: `max-items="3"` keeps the first and the last two.

## Responsive behaviour

The trail wraps onto more lines when it does not fit. For a compact trail use `max-items` (the middle folds
into the ellipsis menu) and the `supporting` variant. Keep labels short; there is no truncation.

## Form semantics

Not applicable: breadcrumbs navigate, they hold no value.

## Screen-reader expectations

The trail announces as a navigation landmark named "Breadcrumb" (or your `label`) containing a list; each
crumb is a link, and the current one is announced as the current page. Separators are hidden. A menu crumb is
announced as a menu button; the ellipsis reads "Show N more breadcrumbs" and opens a menu of the hidden
crumbs. Give a page's second trail its own `label`.

## Localisation

The built-in strings are the default landmark name ("Breadcrumb") and the ellipsis name ("Show N more
breadcrumbs", plural-aware), from the shared catalogs (the ellipsis message has an English default until a
translation lands). Labels are yours to translate. The built-in slash mirrors in right-to-left and directional
icon separators mirror by themselves.

## Consumer responsibilities

- Make the last item the current page (or mark it `current`); do not link it.
- Keep `href`s in step with the page titles they stand for.
- With `max-items`, keep the crumbs' text meaningful without their neighbours: it is what the menu rows show.
- Menu rows in data mode have no `href`; give them `onClick` handlers that navigate, or use links as crumbs.
