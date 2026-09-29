---
title: MultiSelector
folder: multi-selector
category: Form Controls
entries: [MultiSelector]
summary: A dropdown for choosing several values with checkboxes, select all, search and a count, labels or badges on the trigger, as a form-associated combobox that submits one entry per value.
examples: [basic, trigger-displays, select-all, sections, states, in-form]
keywords: [multiselect, multi-select, multiselector, dropdown, checkbox, tags, chips, combobox, options, choose, many, form, select-all]
dense:
  description: form-associated select-only combobox that chooses several values from a list with checkboxes, optional select all and search, and shows the choice as a count, labels or badges
  usage: Give it a label and set options (strings, objects, dividers and sections) as a property. Read the chosen values from values (an array) or from the value string (whitespace-separated); the value attribute is the initial choice. Enter or Space toggles the highlighted row and keeps the list open. Add has-select-all for long lists people usually take in full, has-search to filter, and trigger-display to show a count (default), the first labels or badges. In a form it submits one entry per value under its name, like a native select with multiple. For one value use tct-selector; for a small visible set use checkboxes.
  bestPractices:
    - {do: true, text: 'Give every multi selector a label; it is the accessible name of the combobox.'}
    - {do: true, text: 'Use has-select-all when people often choose most or all options; it acts on the options currently shown, so a search narrows it.'}
    - {do: true, text: 'Read values (an array) in your change handler rather than parsing the trigger text.'}
    - {do: true, text: 'Use trigger-display badges or labels when the choices are short and recognisable; use count for many or long ones.'}
    - {do: true, text: 'Use required to need at least one value and give the form a message next to it.'}
    - {do: false, text: 'Use it for two to five options that can stay on screen; use checkboxes.'}
    - {do: false, text: 'Set value with a text that contains whitespace; assign values (an array) instead.'}
    - {do: false, text: 'Expect it to close on each choice; it stays open so several rows can be toggled.'}
  properties:
    options: the options, as a property; strings, {value, label, description, icon, disabled}, {type 'divider'} and {type 'section', title, options}
    values: the chosen values as an array in selection order; setting it fires no events
    value: the chosen values as whitespace-separated text; the value attribute is the default that form reset restores
    triggerDisplay: count, labels or badges; how the choice shows on the closed trigger
    trigger-display: attribute of triggerDisplay
    maxBadges: most badges shown before "+N" in the badges display; default 3
    max-badges: attribute of maxBadges
    hasSelectAll: adds a Select all row that acts on the enabled options shown
    has-select-all: attribute of hasSelectAll
    selectAllLabel: label of the select-all row; default the localized "Select all"
    select-all-label: attribute of selectAllLabel
    formatValue: function (items) => string for the count and labels displays; items are {value, label}
    changeAction: function (values) => void or Promise; the selector is busy while it is pending and the values return if it rejects
    label: label text, always rendered for accessibility
    labelHidden: hides the label visually, keeps it for screen readers
    label-hidden: attribute of labelHidden
    labelIcon: icon name before the label text
    label-icon: attribute of labelIcon
    description: helper text between the label and the field
    optional: shows an Optional indicator; mutually exclusive with required
    required: constraint (at least one value), aria-required and a Required indicator
    disabled: disables the selector (also through fieldset disabled)
    disabledMessage: explains why the selector is disabled; shows a tooltip and keeps it focusable
    disabled-message: attribute of disabledMessage
    readonly: shows the values but the list does not open; still submitted and in the tab order
    loading: shows a spinner and aria-busy (the value is busy); not the state of the options
    placeholder: hint shown when nothing is chosen; default the localized "Select..."
    labelTooltip: text of an info button after the label
    label-tooltip: attribute of labelTooltip
    startIcon: icon name at the start of the trigger
    start-icon: attribute of startIcon
    statusType: status tone (error, warning, success, info)
    status-type: attribute of statusType
    statusMessage: status text
    status-message: attribute of statusMessage
    status: object {type, message}; the same as statusType and statusMessage
    statusVariant: attached, detached or tooltip (a status button in the box)
    status-variant: attribute of statusVariant
    size: sm, md, lg; unset follows the nearest size provider
    variant: input (bordered field) or ghost (borderless toolbar trigger)
    width: width of the field; a number is px, a string a CSS length
    name: form field name; each chosen value is submitted as its own entry
    defaultValue: the value attribute
    invalid: marks the selector invalid without failing constraint validation
    hasClear: shows a clear button (and Delete on the trigger) while values are chosen
    has-clear: attribute of hasClear
    hasSearch: adds a search field to the popup that filters the options
    has-search: attribute of hasSearch
    searchPlaceholder: placeholder of the search field
    search-placeholder: attribute of searchPlaceholder
    emptyText: text of the panel with no options
    empty-text: attribute of emptyText
    emptySearchText: text of the panel when the search matches nothing
    empty-search-text: attribute of emptySearchText
    loadingText: text of the panel while options-state is loading
    loading-text: attribute of loadingText
    errorText: text of the panel when options-state is error
    error-text: attribute of errorText
    optionsState: ready, loading or error; describes the option source
    options-state: attribute of optionsState
    presentation: adaptive (popover, or bottom sheet on a narrow touch viewport), popover or sheet
    placement: above, below, start, end or overlay
    alignment: start, center or end along the placement axis
    indicatorPosition: start or end; where the checkbox sits in a row
    indicator-position: attribute of indicatorPosition
    renderOption: function (option) => template drawn inside each row
    open: whether the popup is open; reflects; property and attribute writes never emit events
    show: method, opens the popup without an intent event
    hide: method, closes the popup without an intent event
    toggle: method, opens or closes the popup
    requestClose: method, closes as the user would, firing tct-open-change first
    focus: method, focuses the trigger
    showInvalid: method, displays the current invalidity without submitting
    input: native event when the user toggles an option, selects all or clears
    change: native event once after input
    tct-clear: cancelable event when the clear button or Delete is used; preventDefault keeps the values
    tct-open-change: cancelable event before the user opens or closes the popup; open and reason
    tct-after-open-change: event after the popup opened or closed
related: [selector, complex-selector, checkbox-input, dropdown-menu]
---

## Purpose

`tct-multi-selector` is a dropdown for choosing several values from a list. It has the trigger, popover (or
bottom sheet), search, sections, async states and keyboard contract of `tct-selector`, with a checkbox on
each row. Choosing toggles a row and keeps the list open. The closed trigger shows the choice as a count
("3 selected"), the first labels or badges.

## When to use

- Filters, tags, permissions, regions: any field where the number of choices is too large to show.
- A field that must submit several values under one name.

## Alternatives

- `tct-selector` for one value.
- Checkboxes (`tct-checkbox-input`) for a handful of options that can stay on screen.
- `tct-complex-selector` for a selection surface that is not a list.

## Anatomy

Label, description, the box (part `input`) holding the start icon, the trigger (part `trigger`, the
combobox) with the placeholder, the count or labels text (part `value`) or the badges (part `badges`, part
`badge`, part `overflow`), the busy spinner, the clear button, the status glyph and the chevron, and the
status message. The popup holds an optional search row, an optional select-all row, the listbox with checkbox
rows, section headings and dividers, and a message for an empty, loading or failed list.

## Variants and states

- `trigger-display` `count`, `labels` or `badges` (with `max-badges`); `format-value` for the text of the
  first two.
- `has-select-all` (with a mixed state while only some shown rows are chosen), `has-search`, `has-clear`.
- Sections, dividers, option descriptions and icons, disabled options; rows you chose are listed first in
  their group while the list is open.
- `options-state`, statuses, `disabled` with `disabled-message`, `readonly`, `loading`, `required` and
  `optional`, `size` and `variant`, as for the selector.

## Responsive behaviour

As the selector: the field fills its container, and `presentation="adaptive"` opens a popover on pointer
layouts and a bottom sheet on a narrow touch viewport. The badges wrap inside the trigger up to `max-badges`
and then show "+N".

## Form semantics

Form-associated like a native `<select multiple>`: it submits one entry per chosen value under `name`
(repeated names in `FormData`, read them with `formData.getAll(name)`), and nothing when nothing is chosen.
It resets to the `value` attribute, is restored on back navigation and joins `<fieldset disabled>`.
`required` needs at least one value.

`values` is the array; `value` is the same list as whitespace-separated text and is also the form of the
`value` attribute. `input` and then `change` fire once per user toggle, select-all or clear; neither fires
when you set `values` or `value`.

## Screen-reader expectations

- As the selector: a `combobox` button with a `listbox`, `aria-activedescendant` and `aria-multiselectable`;
  rows are `option`s with `aria-selected`.
- Every change of the selection is announced once and politely ("3 of 12 selected", "All selected",
  "Selection cleared"); search results and empty, loading and failed panels are announced as for the selector.
- The select-all row is named "Select all" and reports a mixed state while only some shown rows are chosen.

## Localisation

The placeholder, "Select all", "N selected", "+N", the panel messages and the announcements come from the
locale catalogs and follow the page or nearest `lang`. Option labels, the label, description and status
text are yours to translate; `format-value` is yours when you want another sentence. Layout mirrors in
right-to-left.

## Consumer responsibilities

- Give the selector a `name` to submit it, a `label` always, and a message with every status.
- Provide `options` as a property with unique values, and read `values`, not the trigger text.
- Do not put whitespace in a value you set through `value`; assign `values`.
- Set `options-state` when the option source is async.
