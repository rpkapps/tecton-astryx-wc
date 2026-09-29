---
title: Layout
folder: layout
category: Layout
entries: [Layout, LayoutContent, LayoutHeader, LayoutFooter, LayoutPanel]
summary: A five-slot layout of header, start panel, content, end panel and footer regions, with collapsing padding, dividers, scrolling content and resizable panels.
examples: [default, dividers, panels, content-width, scrolling, auto-height, landmarks, resizable-panel, collapsible-panel, rtl]
keywords: [layout, page layout, header, footer, sidebar, panel, content, split pane, app frame, regions, resizable panel, collapsible sidebar, scrolling content, content width]
dense:
  description: five-slot page or container layout (header, start, content, end, footer) with scrolling content, dividers and resizable, collapsible side panels; use INSTEAD of hand-written grid or flex page frames
  usage: Layout arranges regions in a page or a bounded container. Put a tct-layout-header in slot header, tct-layout-panel elements in slots start and end, a tct-layout-content in the default slot and a tct-layout-footer in slot footer. The layout fills the height of its container (height fill), so the container needs a height, and the content scrolls inside it. Regions collapse their padding where they meet and draw dividers with has-divider. A resizable panel followed by a tct-resize-handle in the same slot is operated by pointer and keyboard. For the application page shell with navigation, skip link and main landmark use tct-app-shell.
  bestPractices:
    - {do: true, text: 'Give the layout a container with a height (a card, a section, a sized box); height fill takes the height of its container.'}
    - {do: true, text: 'Use the region elements (header, panel, content, footer) so the padding, dividers and scrolling are handled for you.'}
    - {do: true, text: 'Name a region that is a landmark: set landmark and label together, and name each one when several of a kind exist.'}
    - {do: true, text: 'Use has-divider on regions, or default-has-dividers on the layout, to separate them; leave both off for regions that should run together.'}
    - {do: true, text: 'Put a tct-resize-handle right after a resizable panel in the same slot (before an end panel, with reversed).'}
    - {do: false, text: 'Use a layout for the page shell of an application; tct-app-shell adds the skip link, the main landmark and the mobile drawer.'}
    - {do: false, text: 'Set landmark="main" on more than one region of a page, or on a nested layout.'}
    - {do: false, text: 'Rely on drag alone for resizing: the handle is keyboard operable, and buttons can call its step methods.'}
  properties:
    height: layout height, fill (default, the height of the container) or auto (grows with the regions); on header and footer a height in px or any CSS length
    padding: spacing step for the outer padding of the regions (layout), or the padding step on a region
    content-width: maximum width the aligned content of the regions shares, a number is px or any CSS length
    default-has-dividers: divider default for the headers and footers of this layout; a region that sets has-divider wins
    has-divider: draws a divider on the side that meets the content; unset follows the layout default (header, footer) or false (panel)
    label: accessible name of the region box, used with landmark
    landmark: ARIA landmark role of the region box (banner, main, navigation, complementary, region, contentinfo); named landmark because a role attribute would shadow the element's own role
    no-scroll: turns the scrolling of a content region or panel off, for auto height layouts where the page scrolls
    focusable: lets the content region take focus from a script or a skip link; it is a tab stop only while it scrolls and holds nothing focusable
    isScrollable: read-only, whether the content region is a tab stop because it scrolls
    focus: focuses the inner scrolling box of the content region
    resizable: makes a panel resizable; pair it with tct-resize-handle
    default-size: initial size of a resizable panel, a number or Npx is pixels, N% a share of the basis (default 250)
    min-size: minimum size of a resizable panel (default 50 px)
    max-size: maximum size of a resizable panel (default unbounded)
    collapsible: lets the panel collapse to zero, by drag below collapsed-size or by Enter on the handle
    collapsed-size: size in px below which a drag collapses a collapsible panel (default 40)
    snaps: sizes in px, space separated, the panel rests on
    auto-save-id: key that remembers the size and the collapsed state in local storage
    container: id of the element percentage sizes are a share of; without it a share of the viewport width
    collapsed: whether the resizable panel is collapsed; it takes no space and its content is hidden
    region: property that takes an external resizable region (a ResizableController) instead of the panel's own
    activeRegion: read-only, the region in use, the panel's own or the one given in region
    resize: sets the size in px from code, without an event
    resolvedHasDivider: read-only, whether the header or footer draws a divider after the layout default
    padding-inline: inline padding step of a region
    padding-block: block padding step of a region
    padding-inline-start: inline-start padding step of a region
    padding-inline-end: inline-end padding step of a region
    padding-block-start: block-start padding step of a region
    padding-block-end: block-end padding step of a region
    width: width of a panel, a number is px or any CSS length
    max-width: maximum width of a region
    min-height: minimum height of a region
    default: the content region (a tct-layout-content), or the content of a region element
    header: the header region (a tct-layout-header)
    start: the start panel (a tct-layout-panel), on the left in left-to-right text
    end: the end panel (a tct-layout-panel), on the right in left-to-right text
    footer: the footer region (a tct-layout-footer)
    tct-size-change: the user resized the panel (size in px, reason pointer, keyboard or request); a notification
    tct-collapse-change: the user asks to collapse or expand the panel (collapsed, reason); cancelable
related: [app-shell, resize-handle, scrollable-area, section, card, stack]
---

## Purpose

`tct-layout` arranges up to five regions in a page or in a bounded container: a header, a panel at the
start, the content, a panel at the end and a footer. It is the frame under a settings screen, an inbox, an
editor with an inspector. The regions are plain elements of their own, `tct-layout-header`,
`tct-layout-panel`, `tct-layout-content` and `tct-layout-footer`, and they do the fiddly work: they
collapse their padding where two of them meet, draw dividers, scroll, become landmarks and, for a panel,
resize.

With `height="fill"` (the default) the layout takes the height of its container, which therefore needs a
height, and the content scrolls inside it while the header, the footer and the panels stay in place.

## When to use

- The frame of a screen: title bar, side navigation, work area, inspector, action bar.
- A bounded region with its own scrolling content, such as a dialog body, a card or a sized panel.
- A side panel the user can resize or collapse.
- Content that should keep one comfortable width while the dividers and the scrollbar stay full width
  (`content-width`).

## Alternatives

- The page shell of an application, with the skip link, the main landmark and the mobile navigation
  drawer: `tct-app-shell`.
- Plain stacking of blocks, with no fixed regions: `tct-stack`, `tct-vstack`, `tct-hstack`.
- A painted page region: `tct-section`. A discrete item: `tct-card`.
- A single scrolling box that needs a name: `tct-scrollable-area`.

## Anatomy

- **Layout** (`tct-layout`, part `base`): a column that holds, in order, the header, a row of start panel,
  content and end panel, and the footer. Inside, slot wrappers exist only to tell each panel whether it is
  a start or an end panel.
- **Header and footer** (`tct-layout-header`, `tct-layout-footer`): bars with an optional divider, a
  `height` and padding. Place them in `slot="header"` and `slot="footer"`.
- **Panel** (`tct-layout-panel`): a side region in `slot="start"` or `slot="end"`, with a `width` or, when
  `resizable`, a size the user controls.
- **Content** (`tct-layout-content`): the main region in the default slot. It scrolls, and its padding
  leaves room for the panels and the bars next to it.
- **Resize handle** (`tct-resize-handle`): a separator placed after a resizable panel in the same slot.

Every region draws its box on an inner element (part `base`); the host takes no box styles of its own.

## Variants and states

- `height`: `fill` (default) or `auto`. With `auto` the layout grows with its regions and the page scrolls;
  set `no-scroll` on the content so that sticky elements inside work against the page.
- `padding`: a spacing step for the outer padding of the regions. A region's own `padding` overrides it.
- `content-width`: a maximum width the regions align their content to, centred when narrower than the
  space. The dividers and the scrollbar of the content stay at the full width.
- `has-divider` on a header, footer or panel draws a divider on the side towards the content. With
  `default-has-dividers` on the layout, headers and footers draw one unless they say otherwise. Without a
  divider the padding of two neighbouring regions collapses, so text and controls do not sit two paddings
  apart.
- Resizable panels: `resizable`, `default-size`, `min-size`, `max-size`, `snaps`, `collapsible`,
  `collapsed-size`, `auto-save-id` and `container`. A collapsed panel (`:state(collapsed)`) takes no space,
  its content is hidden and it leaves the tab order.
- Layouts nest: a layout inside a padded container (a card, a section) cancels that container's padding,
  so it runs edge to edge. An overlay, such as `tct-mobile-nav`, resets the padding at its boundary.

## Responsive behaviour

The layout has no breakpoints of its own. A panel keeps its width; to hide a panel on a narrow screen,
render it conditionally, or use `tct-app-shell`, which moves its side navigation into a drawer. Percentage
sizes of a resizable panel are a share of the viewport width, or of the content box of the element named by
`container`, and are recomputed when it changes size. `start` and `end` follow the text direction.

## Form semantics

Not applicable. A layout is not a form control; put a `<form>` inside the content, or around the whole
layout when the header and the footer hold its actions.

## Screen-reader expectations

A region is a plain box: it exposes no role and no name until you set `landmark` and `label`. Use
`banner` (site header, once), `main` (primary content, once), `navigation` and `complementary` for panels,
`region` for a named area and `contentinfo` for a page footer; give each landmark a distinct `label`.
`landmark` is a separate attribute because a `role` on the element would replace the element's own role.

A scrolling region (the content and the panels) is a tab stop exactly while it overflows and holds
nothing focusable, so a keyboard user can Tab to it and scroll it with the arrow keys, Page Up, Page Down,
Home and End. A region that fits adds nothing to the tab order. A resizable panel is operated through
`tct-resize-handle`, which announces its value; see that page for the keys.

## Localisation

The regions have no text of their own. Start and end panels, dividers and padding use logical edges and
swap in right-to-left text. The resize handle reads its value ("200 px", "Collapsed") and its default
name in the language of the page.

## Consumer responsibilities

- Give the layout a container with a height when it fills.
- Name each landmark, and use `main` once per page.
- Keep the region elements in their slots; a header or footer outside `slot="header"` or `slot="footer"`
  logs a warning in development.
- Offer a way to resize other than dragging when you build your own handle, and persist the size with
  `auto-save-id` if it should survive a reload.
