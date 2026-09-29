---
title: Outline
folder: outline
category: Navigation
entries: [Outline]
summary: A table of contents that highlights the section you are reading and scrolls to a heading.
examples: [basic, from-document, controlled, density-and-levels, rtl]
keywords: [outline, table-of-contents, toc, headings, scrollspy, on-this-page, anchor, sidebar, in-page, navigation]
dense:
  description: table of contents of page headings; follows scroll (scrollspy), aria-current=location, smooth scroll on click
  usage: A nav of anchor links to headings, from items ({id, label, level}) or source (a container selector whose headings become the items). Unless active-id is set it follows scrolling and marks the last heading whose top passed the activation line; the list is one Tab stop seated on the active heading. Point it at a scrolling pane with scroll-container, and shift the line with offset for a fixed header.
  bestPractices:
    - {do: true, text: 'Give every target heading a stable id and use the same id in items.'}
    - {do: true, text: 'Use source to build the items from the document so the outline follows edits.'}
    - {do: true, text: 'Set offset to the height of a fixed header so headings land below it and activate where they land.'}
    - {do: true, text: 'Use scroll-container when the content scrolls inside a pane, a modal or a panel.'}
    - {do: false, text: 'Use an outline for site navigation; it links to headings on the current page.'}
    - {do: false, text: 'List more than about three heading levels; the indent stops at four steps.'}
  properties:
    items: the entries {id, label, level} (property); ignored while source is set
    source: selector of a container whose h1 to h6 with an id become the items; follows changes
    active-id: id of the active item; set, built-in tracking is off and you own the state
    activeId: id of the active item; set, built-in tracking is off and you own the state
    label: accessible name (default "Table of contents"); a host aria-label wins
    density: default or compact item padding
    offset: px of a fixed header; shifts the activation line and the scroll landing
    scroll-container: selector of the scroll container to track instead of the nearest scrollable ancestor
    scrollContainerSelector: selector of the scroll container to track instead of the nearest scrollable ancestor
    scrollContainer: the scroll container element to track (property)
    no-scroll-on-click: activating an item does not scroll; the active item, hash and events still happen
    noScrollOnClick: activating an item does not scroll; the active item, hash and events still happen
    currentId: the id of the active item, from tracking or active-id (read-only getter)
    navigateTo: navigates to an item as a click would (method); false when no element has the id
    tct-active-change: after the active item changed by scrolling or a user choice (id, reason)
    tct-navigate-start: when navigation to an item begins, before the scroll (id)
    tct-navigate-end: once per navigation, when the scroll settles or the user interrupts it (id)
related: [tab-list, breadcrumbs, link]
---

## Purpose

`tct-outline` is the "on this page" list of a long document: a labelled navigation landmark of anchor links to the
page's headings, indented by heading level, with a bar that slides to the item of the section you are reading.
Activating an item scrolls to its heading and pushes the hash.

## When to use

- Long-form content, documentation and settings pages with several sections.
- Beside a scrolling pane (`scroll-container`), or under a fixed header (`offset`).

## Alternatives

- Site or app navigation: a side or top navigation.
- Switching views: `tct-tab-list`.
- A short page: no outline is needed.

## Anatomy

- **Base** (part `base`): the `<nav>`; **list** (part `list`) of **items** (part `item`, an anchor).
- **Track and indicator** (part `indicator`): a 2px rail with a bar that slides to the active item.

## Variants and states

- `density` `default` or `compact`; items indent by heading level (levels 1 and 2 share the first step).
- The active item is primary text one weight heavier with `aria-current="location"`; the element exposes
  `:state(active)`. Hover, keyboard focus and pressed use the tertiary action fills, each paired with its own text role.
- Tracked (default) or controlled (`active-id`).

## Responsive behaviour

Items truncate with an ellipsis; the outline takes the width of its container, so give it a sidebar column. It
tracks the nearest scrollable ancestor, an explicit `scroll-container`, or the viewport. It re-reads heading
positions on scroll, resize, font load and layout growth, so content that arrives late does not leave it wrong.

## Form semantics

Not applicable: the outline navigates, it holds no value.

## Screen-reader expectations

The outline announces as a navigation landmark named "Table of contents" (or your `label`) containing a list of
links; the active link is announced as the current location. The bar and the track are hidden from assistive
technology. Activating a link moves the page to the heading; focus stays on the link.

## Localisation

The only built-in string is the default landmark name, from the shared catalogs in every shipped locale; item
labels are yours to translate. The track and the bar sit on the inline start, so they mirror in right-to-left.

## Consumer responsibilities

- Give every target an `id` in the same tree (or the document) as the outline; a missing id leaves the link to the
  browser.
- Keep `items` in document order: the active item is the last one whose heading passed the line.
- With `active-id`, set it from `tct-active-change` (or your router) yourself.
- With `no-scroll-on-click` you own the scrolling; the events still tell you where to go.
