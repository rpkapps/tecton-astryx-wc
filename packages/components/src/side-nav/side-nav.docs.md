---
title: Side Nav
folder: side-nav
category: Navigation
entries: [SideNav, SideNavCollapseButton, SideNavHeading, SideNavItem, SideNavSection]
summary: The sidebar navigation of an application, with a pinned header and footer, sections, nested items, an icon rail, a resize handle and a mobile drawer mode.
examples: [default, collapsible, collapsed, resizable, nested-items, item-actions, states-and-sizes, sections, heading, controlled-collapse, in-app-shell, rtl]
keywords: [sidenav, sidebar, side navigation, navigation, drawer, menu, nav, aside, sidemenu, navmenu, sider, treeview, rail, collapsible sidebar, resizable sidebar, flyout]
dense:
  description: application sidebar navigation with a pinned heading and footer, sections, nested items with row actions, a collapsible icon rail with tooltips and flyouts, a resize handle, and a mobile drawer mode inside tct-app-shell
  usage: Put tct-side-nav-heading in the header slot, a create button or top-level items in top-content, tct-side-nav-section and tct-side-nav-item elements in the default slot (they scroll), and a promo card or icon buttons in footer and footer-icons. Mark the current page with selected (aria-current="page"). collapsible adds a button that shrinks the navigation to a rail of icon buttons named by their labels, with tooltips and flyouts for items with sub-items; resizable adds a keyboard-operable drag handle (auto-save-id remembers the width and the collapse state). The user's collapse asks with a cancelable tct-collapse-change; prevent it and set collapsed to own the state. Inside tct-app-shell it becomes the content of the mobile drawer below 768 px, without the button or the handle, and choosing an item closes the drawer.
  bestPractices:
    - {do: true, text: 'Use sections to group related items so people can scan for their destination.'}
    - {do: true, text: 'Mark the current page with selected; it sets aria-current="page" so the destination is announced, not only coloured.'}
    - {do: true, text: 'Give every item an icon when the navigation is collapsible: items without an icon are hidden in the rail.'}
    - {do: true, text: 'Keep item labels short; they name the icon-only items of the rail.'}
    - {do: true, text: 'Give the navigation a label that tells it apart from other navigation landmarks on the page.'}
    - {do: true, text: 'Put a tct-side-nav-collapse-button anywhere on the page and name the navigation with for when the toggle lives outside it.'}
    - {do: false, text: 'Include a heading when a top navigation already provides the application identity; it duplicates branding.'}
    - {do: false, text: 'Use it to filter content; use tabs or filter buttons.'}
    - {do: false, text: 'Put an action in a rail flyout that has no other route to it; the flyout is only a way to reach the sub-items.'}
    - {do: false, text: 'Hide the navigation with CSS on small screens; the app shell moves it into the drawer.'}
  properties:
    collapsible: adds the collapse button and lets the navigation shrink to the icon rail
    collapsed: whether the navigation is collapsed; the attribute is the initial state, the property is the state (writing it never emits tct-collapse-change)
    no-collapse-button: leaves out the built-in collapse button; place a tct-side-nav-collapse-button of your own
    collapse-button-label: replaces the name and tooltip of the built-in collapse button
    resizable: adds a drag handle at the inline-end edge, a keyboard-operable separator; hidden while collapsed
    default-width: initial width in px when resizable (default 260)
    min-width: smallest width in px when resizable (default 180); dragging below 160 px collapses a collapsible navigation
    max-width: largest width in px when resizable (default 480)
    auto-save-id: key under which the width and the collapse state are remembered in localStorage; the remembered state wins over the attributes on first render
    label: accessible name of the navigation landmark (default localized "Side navigation")
    resize-label: accessible name of the resize handle (default localized "Resize sidebar")
    width: read-only, the current width in px
    isCollapsed: read-only, whether the navigation is collapsed now
    collapse: collapses without a tct-collapse-change
    expand: expands without a tct-collapse-change
    requestCollapseToggle: toggles as the user would, with a cancelable tct-collapse-change
    default: the navigation, tct-side-nav-section and tct-side-nav-item elements; scrolls (for tct-side-nav-item, the sub-items; for tct-side-nav-section, its items; for tct-side-nav-collapse-button, a custom icon)
    header: the heading, typically tct-side-nav-heading, pinned at the top
    top-content: content pinned below the header, such as a create button
    footer: content above the footer icons, such as a promo card
    footer-icons: the footer icon row; its buttons take the compact size
    tct-collapse-change: the user asks to collapse or expand (collapsed, reason pointer or keyboard; a drag past the threshold reports pointer); cancelable
    click: native click of an item, retargeted from its link or button (the chevron toggle never raises it on the item)
    tct-size-change: the user resized the navigation (size, reason)
    sideNav: the navigation a tct-side-nav-collapse-button controls, as an element
    for: id of the tct-side-nav a tct-side-nav-collapse-button controls, in the same tree; inside a navigation it finds it by itself
    size: item size sm, md (default) or lg; on tct-side-nav-collapse-button the button size
    icon: registered icon name of the item; the icon slot (of an item or a heading) takes your own icon or logo
    selected-icon: registered icon name shown while the item is selected; the selected-icon slot takes your own
    selected: marks the item as the current page (aria-current="page")
    disabled: the item takes no focus and does nothing
    href: destination of the item; without it the item is a button
    no-collapse: keeps the sub-items of an item always shown, with no toggle
    has-action: the row keeps an action of its own, so the chevron becomes a separate toggle button
    end: passive trailing content of an item (a badge or a count), or of a section header, or of a heading row
    actions: row-level controls of an item, beside the row; compact size, hidden in the rail
    heading: the text of a heading or of a section title
    subheading: text below the heading or the section title
    superheading: text above the heading of a tct-side-nav-heading
    heading-href: makes the heading a link
    superheading-href: makes the line above the heading a link
    subheading-href: makes the line below the heading a link
    header-hidden: keeps the section heading in the accessibility tree without drawing it
    menu: the panel of a tct-side-nav-heading, the product or account switcher; a disclosure, not an ARIA menu
    control: read-only, the native link or button of a tct-side-nav-item
    focus: moves focus to the native link or button of a tct-side-nav-item
related: [app-shell, mobile-nav, top-nav, nav-icon, tooltip, resize-handle]
---

## Purpose

`tct-side-nav` is the sidebar navigation of an application: a landmark with five zones, a pinned header (the
product or account heading), pinned top content (a create button), the scrolling sections and items, a footer
and a footer icon row. It collapses to a narrow rail of icons, resizes with a handle, and inside a
`tct-app-shell` it turns into the content of the mobile drawer.

The family has five elements: `tct-side-nav`, `tct-side-nav-section` (a titled group), `tct-side-nav-item`
(a row with an icon, a label, a selected state, sub-items and row actions), `tct-side-nav-heading` (the product
or account, with an optional switcher menu) and `tct-side-nav-collapse-button`.

## When to use

- The primary navigation of an application with five or more destinations, or destinations that group
  hierarchically.
- A navigation that people want to keep visible while they work, and to shrink out of the way.

## Alternatives

- `tct-top-nav` for a small number of top-level destinations, or in addition to a side navigation for the
  application-wide links.
- Tabs or a segmented control for switching views of one page.
- A tree for a deep hierarchy of content rather than destinations.

## Anatomy

- **Navigation** (part `base`): the `nav` landmark. Parts `header`, `content` and `footer` are the zones and
  `resize-handle` is the drag handle.
- **Heading** (`tct-side-nav-heading`): an icon, the name, a line above and below, trailing content and a menu.
- **Section** (`tct-side-nav-section`): a `group` named by its heading, with `header`, `heading`, `subheading`,
  `end-content` and `items` parts.
- **Item** (`tct-side-nav-item`): the primary link or button (`item`), the `icon`, the `label`, the
  `end-content`, the chevron `toggle`, the `actions`, the `children` group and, in the rail, the `flyout` and the
  `tooltip`.
- **Collapse button** (`tct-side-nav-collapse-button`): a ghost icon button with a chevron that turns over.

## Variants and states

- **Collapsible.** `collapsible` adds the button, and `collapsed` is the state (the attribute is the initial
  state). Collapsed, the navigation is a 48 px rail: an item shows its icon, is named by its label and shows a
  tooltip on hover and on keyboard focus; an item with sub-items is a button that opens a flyout beside the rail
  with the sub-items in full; items without an icon are hidden and the trailing content is not drawn.
- **Resizable.** `resizable` adds a separator at the inline-end edge, resized by dragging or with the arrow
  keys (10 px), Home and End. The width is kept between `min-width` and `max-width`. Dragging below 160 px
  collapses a collapsible navigation. `auto-save-id` remembers the width and the collapse state.
- **Controlled state.** The user's collapse asks with a cancelable `tct-collapse-change`; call
  `preventDefault()` and set `collapsed` yourself to own the state. Writing `collapsed`, `collapse()` and
  `expand()` never emit it. `tct-size-change` reports each step of a resize.
- **Items.** `selected` (the current page), `disabled`, `size` (`sm`, `md`, `lg`), an icon and a
  `selected-icon`, sub-items (collapsible; `no-collapse` keeps them shown), and `has-action` for a row with an
  action of its own. A row that is a link keeps the link and gets a separate chevron toggle, so both stay
  reachable.
- **Headings.** What is set decides what is interactive: only `heading-href` is one link; several hrefs are
  independent links; a menu and no hrefs make the whole heading the menu trigger; a menu with hrefs keeps the
  links and adds a chevron button that opens the menu.
- **Render modes.** `default`, `drawer` (below the shell's breakpoint), `drawer-content` and `topbar`. The
  navigation derives `drawer` from the enclosing `tct-app-shell`; provide `sideNavRenderContext` yourself to
  render one in a top bar (`topbar`) or in a drawer of your own (`drawer-content`). The module
  `side-nav/side-nav.context.js` also exports `SideNavCollapseController` (upstream `useSideNavCollapse`) and
  `SideNavRenderModeController` (upstream `useSideNavRenderMode`) for your own elements.

## Responsive behaviour

Inside a `tct-app-shell`, from the mobile breakpoint down (below 768 px by default) the shell moves the side
navigation into its modal drawer. There the navigation renders the heading, the top content, the sections and
the items, and the footer, one under the other, as full rows, with no collapse button and no resize handle; a
click on a link or a button item closes the drawer. Above the breakpoint the navigation is inline again and
its own collapse and width apply. Outside a shell it is a block that is 260 px wide (`--side-nav-width`) and
fills the height it is given.

## Form semantics

Not applicable. The elements are navigation, not form controls.

## Screen-reader expectations

The navigation is a `navigation` landmark named by `label` ("Side navigation" by default). A section is a
`group` named by its heading, also when the heading is not drawn. The current page is announced through
`aria-current="page"` on the link. A collapsible item follows the disclosure pattern: the toggle has
`aria-expanded` and `aria-controls`, and the group it owns is `inert` while collapsed. In the rail every item
is named by its label and the flyout is a named dialog; Escape closes it and returns focus to the item.

| Key | Action |
| --- | --- |
| Tab, Shift + Tab | Move through the items, toggles and actions in order |
| Enter, Space | Follow the link, press the button, toggle sub-items, open the rail flyout |
| Escape | Closes a flyout or a heading menu and returns focus to its button |
| Arrow keys, Home, End | Resize, on the focused handle |

## Localisation

"Side navigation", "Collapse sidebar", "Expand sidebar", "Resize sidebar", "Open menu" and the flyout names
come from the catalogs, in the language of the page; `label`, `collapse-button-label` and `resize-label`
replace them. The rail, the handle, the chevrons and the flyout mirror in right-to-left text.

## Consumer responsibilities

- Give every item an icon if the navigation is collapsible, and a `label` that names it.
- Mark the current page with `selected`, and keep the destinations in `href` so that links are links.
- Give the navigation a `label` when there is more than one navigation landmark.
- Own the collapse state through `tct-collapse-change` and `collapsed` if your app must remember it elsewhere.
- Do not put a top-level action in a flyout that has no other route to it.
