---
title: Top Nav
folder: top-nav
category: Navigation
entries: [TopNav, TopNavHeading, TopNavItem, TopNavMenu, TopNavMegaMenu, TopNavMegaMenuItem, TopNavMegaMenuFeaturedCard]
summary: The top navigation bar of an application, with a heading, links, disclosure menus and a mega menu, that collapses into the mobile drawer of an app shell.
examples: [default, items, menu, menu-items-data, mega-menu, mega-menu-featured, heading, regions, in-app-shell, rtl]
keywords: [topnav, top nav, navbar, header navigation, top bar, app bar, main navigation, mega menu, dropdown navigation, disclosure navigation, navigation menu, site header]
dense:
  description: application top navigation bar with a heading, link items, disclosure menus, a mega menu with a featured card, start, centre and end regions, and a collapse into the mobile drawer of tct-app-shell
  usage: Put tct-top-nav-heading in the heading slot, tct-top-nav-item, tct-top-nav-menu and tct-top-nav-mega-menu elements in the default (or start) slot, tabs or search in center, and utilities in end. Mark the current page with selected on the item (aria-current="page"). Menus are disclosure navigation, not ARIA menus. A button with aria-expanded shows a group of links, Enter and Space toggle it and move focus to the first link, Tab moves through the links, the arrow keys are an enhancement and Escape closes it and returns focus to the button. The mega menu panel is anchored to the whole bar, at most 960 px wide, aligned by the region of the item and mirrored in RTL. Inside tct-app-shell, below 768 px the bar collapses to the heading, the end content and a drawer toggle, and the items move into the mobile drawer above the side navigation.
  bestPractices:
    - {do: true, text: 'Put the application identity in tct-top-nav-heading and the primary destinations in items.'}
    - {do: true, text: 'Mark the current page with selected so it is announced with aria-current="page".'}
    - {do: true, text: 'Use tct-top-nav-menu for a handful of destinations and tct-top-nav-mega-menu for a browsable grid of them, with a featured card if needed.'}
    - {do: true, text: 'Give each destination in a menu a heading, and a description when the heading alone is not enough.'}
    - {do: true, text: 'Label the bar when a page has more than one navigation landmark.'}
    - {do: false, text: 'Use a menu for actions; it holds links to destinations (use a dropdown menu for commands).'}
    - {do: false, text: 'Nest menus inside menus; flatten the structure or use the side navigation.'}
    - {do: false, text: 'Hide the items with CSS on small screens; inside an app shell they move into the drawer.'}
  properties:
    label: accessible name of the landmark of tct-top-nav (default localized "Top navigation"), or of the button and panel of a menu
    anchorElement: read-only, the element a mega menu panel is anchored to (the bar)
    renderMode: read-only, the render mode of the bar, default, mobile-bar or drawer
    heading: the text of the heading (tct-top-nav-heading), or the title of a menu destination or featured card; a slot of tct-top-nav takes a tct-top-nav-heading
    superheading: text above the heading
    subheading: text below the heading
    heading-href: makes the heading a link
    superheading-href: makes the line above the heading a link
    subheading-href: makes the line below the heading a link
    logo-label: accessible name of the logo link when the logo links on its own (default the heading)
    logo: the logo before the heading, usually a tct-nav-icon
    menu: the panel of a tct-top-nav-heading, the product or account switcher; a disclosure, not an ARIA menu
    start: navigation items after the heading; the default slot is the same region
    center: tabs, a search field or the primary navigation; with it the bar is a three-column grid
    end: end content of the bar (search, icons, a profile), of the heading row, or after the label of a heading
    href: destination of an item, a menu destination or a featured card link; without it a menu destination is a button
    target: where the link opens; _blank adds noopener noreferrer
    rel: link relation
    download: makes the link a download, optionally with a file name
    referrer-policy: referrer policy of the link
    selected: marks the item as the current page (aria-current="page")
    disabled: an anchor without a destination, out of the tab order, that never navigates
    icon-only: shows only the icon and names the link by label
    icon: registered icon name; the icon slot takes your own icon
    size: item size sm, md (default) or lg
    control: read-only, the native link or button of an item or a menu destination
    focus: moves focus to the native link or button
    click: native click, retargeted from the link or the button
    description: text below the title of a menu destination or a featured card
    image: URL of the featured card image, blocked when it is unsafe
    image-alt: alternative text of the featured card image; without it the image is decorative
    link-label: text of the featured card link
    link-href: destination of the featured card link; the link shows only with both a label and a destination
    items: array of {title, description, icon, href, onClick} for a tct-top-nav-menu, instead of slotted destinations
    delay: milliseconds before a hover opens a menu on fine pointers (default 150)
    hide-delay: milliseconds before leaving a menu closes it (default 200 for a menu, 250 for a mega menu)
    open: whether the panel is open; the attribute is the initial state (writing it never emits an event)
    trigger: read-only, the button of a menu
    show: opens without a tct-open-change; resolves once the entry animation settled
    hide: closes without a tct-open-change; resolves once hidden
    toggle: toggles without a tct-open-change
    requestClose: closes as the user would, with a cancelable tct-open-change
    featured: the featured area beside the destinations of a mega menu
    default: the navigation items (tct-top-nav), the destinations of a menu (tct-top-nav-menu, tct-top-nav-mega-menu), custom content of an item, or content below a featured card body
    tct-open-change: the user asks to open or close a panel (open, reason trigger, keyboard, hover, escape, outside, focus-out, selection or request); cancelable
    tct-after-open-change: the panel change settled after the animation (open)
related: [app-shell, mobile-nav, side-nav, nav-icon, dropdown-menu, popover]
---

## Purpose

`tct-top-nav` is the top navigation bar of an application: a landmark with the heading at the start, the
navigation items after it, an optional centre region and the end content (search, icons, a profile). The family has
seven elements: `tct-top-nav`, `tct-top-nav-heading` (the product or account, with an optional switcher menu),
`tct-top-nav-item` (a link), `tct-top-nav-menu` (a disclosure of destinations), `tct-top-nav-mega-menu` (a wide
disclosure with a featured area), `tct-top-nav-mega-menu-item` (a destination with an icon, a title and a
description) and `tct-top-nav-mega-menu-featured-card`.

## When to use

- The primary navigation of a site or an application header with a small number of top-level destinations.
- Grouped destinations that people browse: a menu for a handful, a mega menu for a grid with a featured area.

## Alternatives

- `tct-side-nav` for many destinations or a hierarchy, alone or together with a top navigation.
- `tct-dropdown-menu` for a list of commands (actions); a top navigation menu holds links.
- Tabs for switching views of one page.

## Anatomy

- **Bar** (part `base`): the `nav` band with the top-nav surface role, and the `heading` region.
- **Heading** (`tct-top-nav-heading`): a logo, the name with a line above and below, trailing content, and a menu.
- **Item** (`tct-top-nav-item`, part `item`): a pill link with an optional icon.
- **Menu** (`tct-top-nav-menu`) and **mega menu** (`tct-top-nav-mega-menu`): a `trigger` button and a `panel`
  with the `items`, and for the mega menu a `featured` area.
- **Destination** (`tct-top-nav-mega-menu-item`): the `item` link or button with an `icon`, a `title` and a
  `description`.
- **Featured card** (`tct-top-nav-mega-menu-featured-card`): an `image`, a `body` with a `heading`, a
  `description` and a `link`.

## Variants and states

- **Regions.** `heading` at the start edge, the default or `start` slot for the items, `center` for tabs or a search
  field (the bar becomes a three-column grid so that the centre stays centred), and `end`. A menu panel aligns to
  the region its button sits in.
- **Items.** `selected` (the current page), `disabled` (an anchor without a destination), `icon-only`, an icon,
  and your own content in the default slot. An unmodified click on an internal destination is offered to the
  router of a `tct-link-provider`.
- **Menus are disclosure navigation.** A button with `aria-expanded` and `aria-controls` shows a labelled group of
  ordinary links: there is no `role="menu"`, no `aria-haspopup` and no `menuitem`. They open on hover after
  `delay` on fine pointers and close after `hide-delay`; a click within 500 ms of a hover-open confirms and pins
  it. Only one panel is open at a time. `open` is the state (the attribute is the initial state); the user's
  actions ask with a cancelable `tct-open-change`, and `tct-after-open-change` reports when the change settled.
- **Mega menu.** The panel is anchored to the whole bar, not to its button: it opens below the bar, at most 960
  px wide, aligned to the start, the centre or the end of the bar by the region of the item, mirrored in
  right-to-left text, and scrolling inside when the space below is short. The destinations sit in two columns
  beside the `featured` area.
- **Heading.** Only `heading-href` is one link; several hrefs are independent links (the logo links to the
  heading destination, named by `logo-label` or the heading); a menu and no hrefs make the whole heading the
  trigger; a menu with hrefs keeps the links and adds a chevron button.
- **Band and contrast.** The bar uses the top-nav background role. The items rest on the secondary text role and
  every state that adds a fill (hover, keyboard focus, pressed, the current page) uses the primary text role, in
  light and dark. This differs from the raw top-nav text role, which does not reach 4.5:1 on the light band.
- **Render modes.** `default`, `mobile-bar` and `drawer`. The bar derives `mobile-bar` from the enclosing
  `tct-app-shell`; provide `topNavRenderContext` (module `top-nav/top-nav.context.js`, with
  `TopNavRenderModeController`, upstream `useTopNavRenderMode`) to choose one yourself.

## Responsive behaviour

Inside a `tct-app-shell`, from the mobile breakpoint down (below 768 px by default) the bar collapses to the
heading, the end content and a `tct-mobile-nav-toggle` (unless the shell has `no-mobile-toggle`, when you place
your own). The start and centre items move into the shell's mobile drawer as vertical rows, above the side
navigation with a rule between; a menu becomes a collapsible section of rows, closed until its header is pressed.
The drawer shows copies of the items, and a click on a copy is forwarded to the original as a click, so listeners
on the items still run. Choosing an item closes the drawer. A shell with a `tct-mobile-nav` of your own in the
`mobile-nav` slot keeps the full bar. Above the breakpoint (768 px and wider) everything stays in the bar. Outside
a shell the bar never collapses; give it room or a `center` and `end` region that fit.

## Form semantics

Not applicable. The elements are navigation, not form controls.

## Screen-reader expectations

The bar is a `navigation` landmark named by `label` ("Top navigation" by default). The current page is
announced through `aria-current="page"` on the link. A menu is a button with `aria-expanded` and
`aria-controls`, and its panel is a group named by the menu label; the destinations are links named by their
title and described by their description. Focus returns to the button when the panel closes with Escape.

| Key | Action |
| --- | --- |
| Tab, Shift + Tab | Move through the items and the buttons; inside an open panel, through its links, and out of it (which closes it) |
| Enter, Space | Follow a link, or toggle a menu (a keyboard open moves focus to the first link) |
| ArrowDown | On a menu button: opens the panel and enters it |
| Arrow keys, Home, End | Move between the links of an open panel (an enhancement) |
| Escape | Closes the panel and returns focus to the button |

## Localisation

"Top navigation", "Open menu" and the drawer names come from the catalogs, in the language of the page; `label`
replaces the landmark name and `logo-label` the logo link name. The bar, the panels, the chevrons and the
call-to-action arrow mirror in right-to-left text, and a mega menu aligns to the right edge of the bar.

## Consumer responsibilities

- Keep destinations in `href` so that items are links, and mark the current page with `selected`.
- Give every menu a `label` (it names the button and the panel) and every destination a `heading`.
- Give the bar a `label` when the page has more than one navigation landmark.
- Give the featured card an `image-alt` when the image carries information; otherwise leave it decorative.
- Use `tct-dropdown-menu`, not a top navigation menu, for commands.
