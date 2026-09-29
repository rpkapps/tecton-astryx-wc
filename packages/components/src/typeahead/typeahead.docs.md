---
title: Typeahead
folder: typeahead
category: Form Controls
entries: [Typeahead, TypeaheadItem, BaseTypeahead]
summary: A search field for choosing one item from a large or dynamic set, with a debounced, cancelable result popup; plus the bare combobox and the default result row.
examples: [basic, entries-on-focus, async-source, custom-items, grouped, sizes, status, states, in-form, base-typeahead]
keywords: [typeahead, autocomplete, combobox, searchbox, autosuggest, select, dropdown, lookup, searchable, suggestion, picker, search, async, debounce]
dense:
  description: searchable single-select field (editable combobox) with async or sync searchSource, debounced and cancelable, result popup, chosen item shown as a token
  usage: Choose one item from a set too large for a select. Give it a label and a searchSource ({search(query), bootstrap(), cancel?()}, or createStaticSource(items) for an array); results appear as the user types, and a choice fires the cancelable tct-selection-change, then input and change. The chosen item shows as a token (press it to edit); value is its id, which the form submits. tct-base-typeahead is the same engine as a bare input for your own box, and tct-typeahead-item is the default result row.
  bestPractices:
    - {do: true, text: 'Give the field a visible label and a placeholder that hints at what can be searched.'}
    - {do: true, text: 'Use entries-on-focus with a bootstrap() of recent or popular items when people benefit from choices before typing.'}
    - {do: true, text: 'Keep debounce-ms above 0 for remote sources and implement cancel() to abort the request; set it to 0 for local sources.'}
    - {do: true, text: 'Use createStaticSource(items) for an array; write a SearchSource for fuzzy, ranked or server-side search.'}
    - {do: true, text: 'Put your own data in auxiliaryData and show it with renderItem and tct-typeahead-item; set auxiliaryData.group to group results under headings.'}
    - {do: false, text: 'Use it for a short list that fits a select or a menu; use a dropdown or select instead.'}
    - {do: false, text: 'Use it for several choices; use tct-tokenizer.'}
    - {do: false, text: 'Rely on the text in the input for the value: read item, or value (the id), and listen to tct-selection-change.'}
    - {do: false, text: 'Wrap a disabled typeahead in a tooltip to explain why; use disabled-message.'}
  properties:
    label: label text, always rendered for accessibility
    searchSource: object {search(query), bootstrap(), cancel?()}; sync or async; older responses are discarded
    renderItem: function (item) => template, node or text for a result row; default tct-typeahead-item
    item: the chosen item {id, label, element?, auxiliaryData?} or null; writing it fires no events
    defaultItem: the item that form reset returns to
    value: id of the chosen item, what the form submits; the value attribute is the default id
    entriesOnFocus: shows the source's bootstrap() results when the field takes focus
    entries-on-focus: attribute of entriesOnFocus
    maxMenuItems: the most results shown, default 10
    max-menu-items: attribute of maxMenuItems
    minQueryLength: characters (as a person counts them) before the source is searched, default 1
    min-query-length: attribute of minQueryLength
    emptySearchResultsText: message when a completed search found nothing; default localised
    empty-search-results-text: attribute of emptySearchResultsText
    debounceMs: delay in ms before a typed query is searched, default 150; 0 for sync sources
    debounce-ms: attribute of debounceMs
    noClear: removes the clear button that shows while an item is chosen
    no-clear: attribute of noClear
    startIcon: icon name at the start of the field
    start-icon: attribute of startIcon
    query: read-only, the text in the input
    open: read-only, whether the result popup is open
    editing: read-only, whether the chosen item is being edited
    control: read-only, the inner combobox input
    placeholder: hint shown when nothing is chosen or typed; unset shows a localised Search
    description: helper text between the label and the field
    required: constraint, a chosen item; aria-required and a Required indicator
    disabled: disables the field (also through fieldset disabled)
    disabledMessage: explains why the field is disabled and keeps it focusable
    readonly: shows the chosen item, cannot be changed
    loading: shows the busy spinner and aria-busy
    status: object {type, message}; the same as statusType and statusMessage
    size: sm, md, lg; unset follows the nearest size provider
    name: form field name
    "slot:start": your own content at the start of the field, such as an avatar
    input: native event when the query text changes or an item is chosen
    change: native event when the user commits a choice or clears it
    tct-selection-change: cancelable event before the user chooses or clears an item; has action, item, items, reason
    tct-open-change: cancelable event before the popup opens or closes because of the user or a result
    tct-after-open-change: event after the popup finished opening or closing
    label-hidden: attribute of labelHidden, hides the label visually
    focusableDisabled: tct-base-typeahead, with disabled keeps the input focusable through aria-disabled
    focusable-disabled: attribute of focusableDisabled
    menuWidth: tct-base-typeahead, fixed popup width in px, never narrower than the anchor
    menu-width: attribute of menuWidth
    inputId: tct-base-typeahead, id of the inner input
    input-id: attribute of inputId
    inputTabIndex: tct-base-typeahead, tabindex of the inner input
    input-tab-index: attribute of inputTabIndex
    anchor: tct-base-typeahead, id of the element the popup is placed against
    anchorElement: tct-base-typeahead, the element the popup is placed against
    focus: method, focuses the input (tct-base-typeahead) or the field
    blur: method, blurs the input of tct-base-typeahead
    group: tct-typeahead-item, the group heading label kept for parity; groups come from auxiliaryData.group
    "slot:icon": tct-typeahead-item, an icon or avatar before the label
related: [tokenizer, token, text-input, input-group, popover]
---

## Purpose

`tct-typeahead` lets a person find and choose one item by typing, from a set that is too large or too
dynamic for a select. It is an editable combobox (WAI-ARIA APG): DOM focus stays in the input while the
result popup opens, `aria-activedescendant` names the highlighted result, and every result count is
announced once per menu. It draws the Tecton outlined field with its label, description, validation status
and start icon, and it is a form-associated element.

The family has three elements. `tct-typeahead` is the field. `tct-base-typeahead` is the same combobox
engine without the field: a bare input and the result popup, for when you draw the box yourself.
`tct-typeahead-item` is the default content of a result row.

## When to use

- Choosing one record from a long or remote list: a person, a project, a place.
- Search-as-you-type where the results depend on the query, from a local array or a server.
- A field that should offer recent or popular choices on focus (`entries-on-focus`).

## Alternatives

- A select or a dropdown menu when the list is short enough to scan.
- `tct-tokenizer` when the user chooses several items.
- `tct-text-input` when free text is the answer and nothing has to be chosen.

## Anatomy

The field (part `field`) has the label, the description, the box (part `input`) and the status message.
The box holds the start icon or the `start` slot, the combobox input (part `control`) or, once an item is
chosen, its token (part `token`), the busy indicator, the clear button and the status glyph. The result
popup (part `popup`) sits in the top layer, anchored to the box: a scrolling list (part `dropdown`) of
options (part `option`) whose default content is a `tct-typeahead-item` (part `typeahead-item`), group
headings, and the empty message (part `empty-state`).

## Variants and states

- `size` sm, md or lg; the result rows follow it.
- With an item chosen the field shows a token; pressing it (or Enter on it) starts editing: the query
  becomes the item's label and the popup searches for it. Leaving without choosing restores the token, and
  Escape restores it and puts focus back on it.
- Results can be grouped (`auxiliaryData.group`), rendered your own way (`renderItem`, `item.element`) and
  are capped at `max-menu-items`. The chosen result shows a check.
- `min-query-length` keeps short queries from searching; `debounce-ms` delays the search after typing. A
  newer query supersedes an older one: a slow response never replaces a newer result, and `cancel()` is
  called on the source.
- Statuses `error`, `warning`, `success` and `info`, shown `attached`, `detached` or as a `tooltip` behind
  a status button. `disabled` (with `disabled-message`, which keeps the field focusable), `readonly`,
  `loading`, `required` and `optional`.
- `:state(open)` while the popup is open and `:state(busy)` while a search is pending.

## Responsive behaviour

The field fills its container; `width` limits it. The popup is at least as wide as the field (`menu-width`
on the base element sets a fixed width, never narrower than the anchor), never wider than the viewport and
flips above the field when there is no room below. Long labels truncate in the token and the rows.

## Form semantics

`tct-typeahead` is form-associated (`ElementInternals`): it submits `name=id` of the chosen item, resets to
`defaultItem` (or the `value` attribute), is restored on back navigation with its label, works with
`form="id"` and an external `<label for>`, and joins `<fieldset disabled>`. `required` means an item is
chosen, whatever is typed. With the popup open, Enter chooses the highlighted result and never submits the
form; with it closed Enter submits like a text input. A choice fires the cancelable `tct-selection-change`
(prevent it to keep the current item), then `input` and `change`; typing fires `input` (read the text from
`query`). Writing `item` or `value` fires no events. `tct-base-typeahead` is not form-associated.

## Screen-reader expectations

- The input is a combobox with `aria-autocomplete="list"`, `aria-expanded`, `aria-controls` and
  `aria-activedescendant`; the popup is a listbox of options, with groups named by their headings.
- The number of results (or the empty message) is announced once per menu through the announcer, not on
  every keystroke; nothing is announced while the query is below the minimum.
- An Enter or Escape that belongs to an input method editor (a composing key event) is left alone.
- The token and the clear button are named from the item and the locale; a `disabled-message` field stays
  focusable so the reason can be reached.

## Localisation

Strings ("Search…", "No results found", the result count, the clear and remove button names, the
Required and Optional indicators) come from the locale catalogs and follow the page language or the nearest
`lang`; a provider's overrides win. Layout and the popup mirror in right-to-left. The label, description,
placeholder, `empty-search-results-text`, the item labels and anything from `renderItem` are yours to
translate.

## Consumer responsibilities

- Provide a `searchSource`. Make `search()` idempotent and, for remote sources, implement `cancel()` to
  abort the request; an older response is discarded either way.
- Give every item a stable `id` (it is what the form submits) and a `label`.
- Give the field a `name` to submit it, a `label` always, and a message with every status.
- Do not put HTML strings in rows: `renderItem` and `item.element` take templates, nodes or text.
- Name a bare `tct-base-typeahead` yourself (`aria-label` or `aria-labelledby`) and draw its box.
