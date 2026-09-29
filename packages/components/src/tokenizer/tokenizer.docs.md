---
title: Tokenizer
folder: tokenizer
category: Form Controls
entries: [Tokenizer]
summary: A multi-select search field: the chosen items are removable tokens around one combobox input, with a debounced, cancelable result popup.
examples: [basic, create, max-entries, overflow, custom-tokens, status, sizes, states, in-form]
keywords: [tokenizer, multiselect, multi-select, chips, tags, combobox, autocomplete, taginput, chipinput, tokens, search, paste]
dense:
  description: multi-select search field; chosen items are removable tokens around an editable combobox; async or sync searchSource; FACE with repeated name entries
  usage: Choose several items from a searchable source: team members, tags, filters. Give it a label and a searchSource ({search(query), bootstrap(), cancel?()}, or createStaticSource(items)); choosing a result adds a token and clears the query, and results already chosen are left out. items are the chosen items and values their ids; the form submits one name=id entry per token. Every user change fires the cancelable tct-selection-change (action add, create, remove or clear), then input and one change.
  bestPractices:
    - {do: true, text: 'Give the field a visible label and a placeholder that says what to search ("Search people"), not a blank input.'}
    - {do: true, text: 'Use max-entries when the selection is bounded, for example five approvers.'}
    - {do: true, text: 'Use has-create for free-form tagging with values that are not in the source.'}
    - {do: true, text: 'Use token-overflow="unfocused-inline" in narrow places so a long selection keeps one row until the field is focused.'}
    - {do: true, text: 'Use status-type with a message that says what to fix; required means at least one token.'}
    - {do: false, text: 'Use it for a single choice; use tct-typeahead.'}
    - {do: false, text: 'Colour tokens with renderToken unless the colour carries meaning; the default token keeps the field consistent.'}
    - {do: false, text: 'Hide the label unless the context makes the purpose obvious.'}
    - {do: false, text: 'Wrap a disabled tokenizer in a tooltip to explain why; use disabled-message.'}
  properties:
    label: label text, always rendered for accessibility
    searchSource: object {search(query), bootstrap(), cancel?()}; sync or async; older responses are discarded
    renderItem: function (item) => template, node or text for a result row; default tct-typeahead-item
    renderToken: function (item, remove) => template, node or text for a token; call remove() from your own control; default a removable tct-token
    items: the chosen items, in the order added; writing it fires no events
    defaultItems: the items that form reset returns to
    values: read-only, the ids of the chosen items in order; what the form submits
    query: read-only, the text in the input
    open: read-only, whether the result popup is open
    control: read-only, the inner combobox input
    maxEntries: the most tokens allowed; at the limit the input takes no room and offers no results but stays focusable
    max-entries: attribute of maxEntries
    hasClear: shows a clear-all button while there are tokens
    has-clear: attribute of hasClear
    hasCreate: typing offers a Create "text" result that adds the text as a token
    has-create: attribute of hasCreate
    entriesOnFocus: shows the source's bootstrap() results when the field takes focus
    entries-on-focus: attribute of entriesOnFocus
    maxMenuItems: the most results shown, default 10
    max-menu-items: attribute of maxMenuItems
    menuWidth: fixed popup width in px, never narrower than the field
    menu-width: attribute of menuWidth
    minQueryLength: characters (as a person counts them) before the source is searched, default 1; the Create entry needs no search
    min-query-length: attribute of minQueryLength
    emptySearchResultsText: message when a completed search found nothing; default localised
    empty-search-results-text: attribute of emptySearchResultsText
    debounceMs: delay in ms before a typed query is searched, default 150; 0 for sync sources
    debounce-ms: attribute of debounceMs
    startIcon: icon name at the start of the field
    start-icon: attribute of startIcon
    tokenOverflow: none wraps tokens; unfocused-inline keeps one row with "+N more" while unfocused; unfocused-layer is accepted and currently expands in place like unfocused-inline
    token-overflow: attribute of tokenOverflow
    placeholder: hint shown while there are no tokens and nothing is typed; unset shows a localised Search
    description: helper text between the label and the field
    required: constraint, at least one token; aria-required and a Required indicator
    disabled: disables the field and every token (also through fieldset disabled)
    disabledMessage: explains why the field is disabled and keeps it focusable
    readonly: shows the tokens without remove buttons, cannot be changed
    loading: shows the busy spinner and aria-busy
    status: object {type, message}; the same as statusType and statusMessage
    size: sm, md, lg; unset follows the nearest size provider
    name: form field name, repeated once per token in FormData
    label-hidden: attribute of labelHidden, hides the label visually
    focus: method, focuses the input
    blur: method, blurs the input
    "slot:start": your own content at the start of the field, before the tokens
    "slot:end": content at the end of the field row, such as a count or a button
    input: native event when the query text changes or the tokens change
    change: native event once per user change of the tokens
    tct-selection-change: cancelable event before the tokens change; has action (add, create, remove, clear), item, items, reason
    tct-open-change: cancelable event before the popup opens or closes because of the user or a result
    tct-after-open-change: event after the popup finished opening or closing
related: [typeahead, token, text-input, overflow-list]
---

## Purpose

`tct-tokenizer` lets a person build a set by searching: people on a review, tags on a document, filters on
a table. The chosen items are removable tokens around one stable combobox input, with a label, a
description and a validation status. It is a form-associated element that submits one entry per token.

The input is the same editable combobox as `tct-typeahead` (WAI-ARIA APG, `aria-activedescendant`): a
debounced, cancelable search where an older response never wins, `min-query-length`, result counts announced
once per menu, and IME-safe keys.

## When to use

- Choosing several items from a large or remote set.
- Free-form tagging (`has-create`) alongside suggestions from a source.
- A bounded selection (`max-entries`) such as a handful of approvers.

## Alternatives

- `tct-typeahead` for a single choice.
- A checkbox group for a short list where every option can be seen at once.
- `tct-token` on its own when the tokens are display-only.

## Anatomy

The field (part `field`) has the label, the description, the box (part `input`) and the status message.
The box holds the start icon or `start` slot, a group (part `group`) with the tokens (part `token`) and the
combobox input (part `control`), and an end lane with the busy indicator, the clear-all button, the `end`
slot and the status glyph. The result popup (part `popup`) is in the top layer, anchored to the box, with
the same list, options and empty message as `tct-typeahead`.

## Variants and states

- Choosing a result (Enter or a click) adds a token, clears the query and keeps focus in the input for the
  next one. Results already chosen are left out. Backspace in the empty input removes the last token;
  every addition and removal is announced.
- Pasting text with line breaks, tabs, commas or semicolons adds one token per entry that names a result
  exactly (or per entry with `has-create`) in one change, and keeps what it could not resolve in the input.
- `has-create` offers a `Create "text"` result for anything typed; `has-clear` shows a clear-all button;
  `max-entries` stops the field accepting more.
- `token-overflow`: `none` wraps tokens onto more rows; `unfocused-inline` keeps one row with a "+N more"
  indicator while the field is not focused and expands in place on focus. `unfocused-layer` is accepted and
  currently behaves like `unfocused-inline` (it does not yet expand over the content below).
- `size` sm, md or lg; statuses `error`, `warning`, `success` and `info` shown `attached`, `detached` or as a
  `tooltip`; `disabled` (with `disabled-message`), `readonly`, `loading`, `required` and `optional`.
- `:state(open)` while the popup is open and `:state(busy)` while a search is pending.

## Responsive behaviour

The field fills its container; `width` limits it. Tokens wrap onto more rows, or collapse to one row with
"+N more" (`token-overflow`); the input keeps a minimum width. At `max-entries` the input collapses to nothing but stays focusable. The popup is at least as wide
as the field, never wider than the viewport, and flips above the field when there is no room below.

## Form semantics

`tct-tokenizer` is form-associated (`ElementInternals`): it submits one `name=id` entry per token (repeated
names in `FormData`, in order) and nothing without tokens or a name; it resets to `defaultItems`, is
restored on back navigation with its labels, works with `form="id"` and an external `<label for>`, and
joins `<fieldset disabled>`. `required` means at least one token, whatever is typed in the input. With the
popup open, Enter adds the highlighted result and never submits the form. Every user change fires the
cancelable `tct-selection-change` (prevent it to keep the current tokens), then `input` and one `change`;
typing fires `input` (read the text from `query`). Writing `items` fires no events.

## Screen-reader expectations

- The input is a combobox named by the label, with `aria-expanded`, `aria-controls` and
  `aria-activedescendant`; the tokens are in a group named by the label, and each remove button is named
  "Remove {label}".
- Additions, removals and pasted lists are announced ("Added Design", "Removed Design", "Added 3 items");
  the number of results (or the empty message) is announced once per menu, not on every keystroke.
- Focus arriving from outside lands on the input, not on the first token's remove button; an IME Enter or
  Backspace is left alone.
- The "+N more" indicator is text. A `disabled-message` field stays focusable so the reason can be reached.

## Localisation

Strings ("Search…", "No results found", the token and clear button names, the announcements, `Create "…"`,
"+N more") come from the locale catalogs and follow the page language or the nearest `lang`; a provider's
overrides win. The three messages new to this element (`Create`, "+N more", the pasted-items announcement)
fall back to English until the catalogs carry them. Layout mirrors in right-to-left. The label,
description, placeholder, item labels and anything from `renderToken` or `renderItem` are yours to translate.

## Consumer responsibilities

- Provide a `searchSource`, with stable item `id`s (they are what the form submits) and `cancel()` for
  remote sources.
- Give the field a `name` to submit it, a `label` always, and a message with every status.
- When you render your own tokens, call `remove()` from a control with an accessible name.
- Do not put HTML strings in tokens or rows: `renderToken`, `renderItem` and `item.element` take templates,
  nodes or text.
