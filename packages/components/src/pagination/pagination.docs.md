---
title: Pagination
folder: pagination
category: Navigation
entries: [Pagination]
summary: Previous, next and page controls for paged content, with page numbers, a range count, a compact readout, dots or an editable page box, and an optional page-size selector.
examples: [basic, variants, page-size, input, dots, cursor, step, sizes-and-states, async-change]
keywords: [pagination, pager, paginator, pagenavigation, paging, paginate, pages, pagecontrol, next, previous, table, results]
dense:
  description: navigation landmark with previous and next buttons around page numbers, a count, a compact readout, dots or an editable page box, plus an optional page-size selector; known totals or cursor paging
  usage: Set page (1-based) and the total with total-items and page-size, or total-pages, or has-more for cursor paging. Choose what sits between previous and next with variant. When the user chooses a page the cancelable tct-page-change event fires with page, oldPage and reason, and the element then applies the page itself; load your content in the handler, or run it with changeAction. page-size-options shows an Items per page selector, which fires tct-page-size-change and returns to page 1. Setting page from code fires and announces nothing.
  bestPractices:
    - {do: true, text: 'Use the pages variant for a known total with room for numbers, compact for tight spaces and count for tables that show a range.'}
    - {do: true, text: 'Use has-more with variant none for cursor paging where the total is unknown.'}
    - {do: true, text: 'Give the landmark a specific label when a page has more than one paginator ("Search results", "Comments").'}
    - {do: true, text: 'Listen to tct-page-change to load content, and prevent it to keep the current page until the load is confirmed.'}
    - {do: true, text: 'Use step for very long lists so previous and next can skip several pages; the names say so.'}
    - {do: false, text: 'Use pagination for a handful of tabs or steps; use tabs or a stepper.'}
    - {do: false, text: 'Use the dots variant for long lists; each page is a dot and a tab stop would not help.'}
    - {do: false, text: 'Change page from code to reflect a user action; let the element apply it, and only set it when the data changes.'}
  properties:
    page: current page, 1-based; changed by the user's actions after tct-page-change, and by code without events
    total-items: number of items; the page count is derived from it and page-size and it feeds the count variant; wins over total-pages; zero renders nothing
    totalItems: property of total-items
    total-pages: number of pages when the item count is unknown; zero renders nothing
    totalPages: property of total-pages
    has-more: cursor paging; next is enabled while the total is unknown
    hasMore: property of has-more
    page-size: items per page; coerced to a positive whole number, default 10
    pageSize: property of page-size
    page-size-options: page sizes to offer in an Items per page selector; an attribute such as "10, 25, 50" or a number array
    pageSizeOptions: property of page-size-options
    variant: pages, count, compact, dots, input or none
    page-label: noun before the page box of the input variant; default the localized "Page"
    pageLabel: property of page-label
    no-first-last: leaves out the first and last buttons of the input variant
    noFirstLast: property of no-first-last
    step: pages that previous and next move at once, default 1; a value that is not a whole number of at least 1 is 1
    sibling-count: page numbers beside the current page in the pages variant, default 1
    siblingCount: property of sibling-count
    size: sm or md; unset follows the nearest size provider
    disabled: disables every control
    label: accessible name of the navigation landmark; default the localized "Pagination"
    changeAction: function (page) => void or Promise; the paginator is busy while it is pending, clicks are not blocked, and the previous page returns if it rejects
    tct-page-change: cancelable event before the page changes; page, oldPage and reason
    tct-page-size-change: cancelable event before the page size changes; pageSize and oldPageSize
related: [table, selector, number-input, button]
---

## Purpose

`tct-pagination` is the control for moving through pages of content: a search result list, a table, a
gallery. It is a navigation landmark with previous and next buttons and, between them, page numbers with
ellipses, an "X-Y of Z" count, a "Page X of Y" readout, page dots or an editable "Page [ n ] / N" box. An
optional selector chooses how many items to show per page.

It does not own the data. It says which page the user wants; you load it.

## When to use

- Content split into pages, with a known total (`total-items` or `total-pages`) or a cursor (`has-more`).
- A table footer, a results list, or a carousel (`variant="dots"`).

## Alternatives

- Infinite scroll or a "Load more" button when the reader does not need to return to a page.
- Tabs or a stepper for a handful of named sections or steps.

## Anatomy

The landmark (`nav`, part `nav`) holds an optional page-size selector (part `page-size`) and the controls
(part `controls`): optional first and last buttons, previous and next buttons, and between them the variant:
page number buttons (part `page`) with ellipses (part `ellipsis`), a readout (part `readout`), a group of dots
(part `dots`, part `dot`), or the page box group (parts `input-group`, `input-label`, `page-input`,
`input-total`).

## Variants and states

- `variant`: `pages` (numbers and ellipses, `sibling-count` per side), `count` (range and total items),
  `compact` ("Page 3 of 12"), `dots`, `input` and `none`.
- `size` sm or md; `disabled`; the previous button is disabled on the first page and the next on the last.
- `has-more` cursor paging: next follows it, and the `pages`, `count`, `compact` and `dots` variants that
  need a total render nothing; the `input` variant disables its box.
- `step` above 1 makes previous and next move several pages, clamped to the range.
- `page-size-options` adds the Items per page selector; a page-size change returns to page 1.
- A `changeAction` that returns a promise makes the paginator busy (`aria-busy`, `:state(busy)`).
- Zero items or zero pages render nothing.

## Responsive behaviour

The landmark is a flex row that wraps: the page-size selector and the controls sit on one line when there is
room and stack when there is not. For narrow spaces use `compact`, `dots` or `none` instead of page numbers.
Dots are 24px targets on any pointer.

## Form semantics

It is not a form control: it has no value, name or validation, and fires no `input` or `change`. The events
are `tct-page-change` and `tct-page-size-change`, both cancelable intents that fire before the change and only
for user actions; setting `page` or `page-size` from code fires nothing. If they are not prevented the
element applies the change itself, so it works without a script; prevent them, or set the property back, to
control it. The page box inside the `input` variant and the selector inside the page-size control keep their
own `input` and `change` events internal.

## Screen-reader expectations

- A `<nav>` landmark named by `label`; the previous, next, first and last buttons are named ("Go to previous
  page", "Go forward 5 pages", "Go to first page"); page buttons and dots are named "Go to page N" and the
  current one has `aria-current="page"`. Ellipses are hidden from the accessibility tree.
- The dots are a group named "Page indicators" and one tab stop: the arrow keys move focus and the page
  together (selection follows focus, like a radio group), Home and End jump, and focus wraps.
- A user's page change is announced politely as "Page 3 of 12", or "Page 3" without a total; mounting and
  setting `page` from code announce nothing.
- The page box is a spinbutton named "Go to page", bounded to the page range.

## Localisation

All sixteen strings (the landmark and button names, "Go to page N", "Page indicators", "Items per page",
the count, the "Page X of Y" readout and the announcements) come from the locale catalogs and follow the
page or nearest `lang`; numbers are formatted for the locale. `label` and `page-label` override two of them.
The chevrons mirror in right-to-left and the dots' arrow keys follow the reading direction.

## Consumer responsibilities

- Load the content for `page` and `page-size` when the events fire (or run it in `changeAction`), and set
  `total-items`, `total-pages` or `has-more` when the data changes.
- Give the landmark a specific `label` when there is more than one paginator on the page.
- Handle the case where the page count shrinks below the current page (for example after a filter): set
  `page` back into range.
- Do not use it as a tab list or stepper.
