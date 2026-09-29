---
title: Selector
folder: selector
category: Form Controls
entries: [Selector, SelectorOption]
summary: A dropdown for choosing one value from a list, as a form-associated select-only combobox with sections, search, async states and an adaptive bottom sheet.
examples: [basic, rich-options, sections, search, sizes-variants, states, async-options, custom-rows, placement, bottom-sheet, in-form]
keywords: [selector, select, dropdown, combobox, listbox, picker, options, choose, autocomplete, form, sheet, search]
dense:
  description: form-associated select-only combobox that chooses one value from a list in a popover or, on a narrow touch viewport, a bottom sheet; optional search, sections, clear, custom rows and async option states
  usage: Give it a label and set options (strings, objects with value, label, description, icon and disabled, dividers, and titled sections) as a property. The value is the chosen option's value, or an empty string for none. Users open it with a click, Enter, Space or the arrows, move a highlight with the arrows, choose with Enter and close with Escape. Add has-search for long lists, has-clear when choosing nothing is valid, and options-state for an option source that loads or fails. It submits under its name in a form and reads its value from the value property or the input and change events. For choosing several values use tct-multi-selector; for custom selection content use tct-complex-selector; for two to five visible choices use a radio list or segmented control.
  bestPractices:
    - {do: true, text: 'Give every selector a label; it is the accessible name of the combobox. Hide it with label-hidden only where the surrounding UI already names the control.'}
    - {do: true, text: 'Use has-search for lists longer than about ten options; the number of matches is announced.'}
    - {do: true, text: 'Describe an async option source with options-state (loading, error) instead of an empty list, so the panel says what is happening and it is announced once.'}
    - {do: true, text: 'Use sections with titles to group long lists; use dividers only for a visual pause.'}
    - {do: true, text: 'Read value in a change handler; it is the option value, not the label.'}
    - {do: false, text: 'Use a selector for two to five visible choices; use a radio list or segmented control so the choices are on screen.'}
    - {do: false, text: 'Use it for actions; use a dropdown menu.'}
    - {do: false, text: 'Put interactive content (inputs, buttons) in a row; use tct-complex-selector for a richer surface.'}
  properties:
    options: the options, as a property; strings, {value, label, description, icon, disabled}, {type 'divider'} and {type 'section', title, options}
    value: the chosen option's value, or an empty string for none; the value attribute is the default that form reset restores
    label: label text, always rendered for accessibility
    labelHidden: hides the label visually, keeps it for screen readers
    label-hidden: attribute of labelHidden
    labelIcon: icon name before the label text
    label-icon: attribute of labelIcon
    description: helper text between the label and the field
    optional: shows an Optional indicator; mutually exclusive with required
    required: constraint (a choice is needed), aria-required and a Required indicator
    disabled: disables the selector (also through fieldset disabled)
    disabledMessage: explains why the selector is disabled; shows a tooltip and keeps it focusable
    disabled-message: attribute of disabledMessage
    readonly: shows the value but the list does not open; still submitted and in the tab order
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
    name: form field name
    defaultValue: the value attribute
    invalid: marks the selector invalid without failing constraint validation
    hasClear: shows a clear button (and Delete on the trigger) while a value is chosen
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
    placement: above, below, start, end or overlay (the chosen row over the trigger)
    alignment: start, center or end along the placement axis
    indicatorPosition: start or end; where the selection mark sits in a row
    indicator-position: attribute of indicatorPosition
    renderOption: function (option) => template drawn inside each row; use tct-selector-option for the standard content
    renderValue: function (option) => template for the chosen value in the trigger
    changeAction: function (value) => void or Promise; the selector is busy while it is pending and the value returns if it rejects
    open: whether the popup is open; reflects; property and attribute writes never emit events
    show: method, opens the popup without an intent event
    hide: method, closes the popup without an intent event
    toggle: method, opens or closes the popup
    requestClose: method, closes as the user would, firing tct-open-change first
    focus: method, focuses the trigger
    showInvalid: method, displays the current invalidity without submitting
    input: native event when the user chooses another option or clears
    change: native event once after input
    tct-clear: cancelable event when the clear button or Delete is used; preventDefault keeps the value
    tct-open-change: cancelable event before the user opens or closes the popup; open and reason
    tct-after-open-change: event after the popup opened or closed
    layout: selector-option; stacked (description under the label) or inline
    icon: selector-option; registered icon name
    end: selector-option; slot for content at the end of the row
related: [multi-selector, complex-selector, dropdown-menu, radio-list, segmented-control, number-input]
---

## Purpose

`tct-selector` is a dropdown for choosing one value from a list. The closed control is a button that acts
as a select-only combobox; opening it shows the options in a popover anchored to the field, or in a bottom
sheet on a narrow touch viewport. It draws the Tecton outlined field with its label, description, Required
or Optional indicator and validation status, and it is a form-associated element that submits the chosen
value.

`tct-selector-option` is a content helper for custom rows: give `renderOption` a template that uses it to
get the standard row layout (icon, label, description and end content).

## When to use

- One choice from a list that is too long, or too dense, to show on screen.
- A field in a form, filter bar or toolbar (`variant="ghost"`).
- Option sources that load or can fail, with search over long lists.

## Alternatives

- `tct-radio-list` or `tct-segmented-control` for two to five choices that should stay visible.
- `tct-multi-selector` to choose several values.
- `tct-complex-selector` when the selection surface is not a list (a colour grid, a range editor).
- `tct-dropdown-menu` for actions rather than values.

## Anatomy

Label (with an optional icon, indicator and info button), description, the box (part `input`) holding the
start icon, the trigger (part `trigger`, the combobox) with its value or placeholder, the busy spinner, the
clear button, the status glyph and the chevron, and the status message. The popup (part `popup`, or `sheet`
on touch) holds an optional search row, the listbox with its option rows (part `option`), section headings,
dividers, and a message for an empty, loading or failed list.

## Variants and states

- `size` sm, md or lg; `variant` `input` or `ghost`; a start icon; `indicator-position` for the mark.
- Sections with titles, dividers, option descriptions and icons, disabled options, and custom rows and
  values (`renderOption`, `renderValue`).
- `has-search` (the search field is the combobox while the list is open), `has-clear`.
- `options-state` `loading` or `error` shows a message when there are no options; provided options stay
  selectable in every state.
- Statuses `error`, `warning`, `success` and `info`, shown `attached`, `detached` or as a `tooltip`.
- `disabled` (with `disabled-message` it stays focusable and explains why), `readonly`, `loading` and
  `required` or `optional`.
- `placement` (`below` by default; `overlay` puts the chosen row over the trigger) and `alignment`.

## Responsive behaviour

The field fills its container; `width` limits it. `presentation="adaptive"` (the default) opens the list
in a popover on pointer layouts and in a bottom sheet on a narrow touch viewport; `sheet` and `popover`
force one. The popover is as wide as the trigger at least, is capped in height and scrolls, and flips to the
side with room.

## Form semantics

Form-associated (`ElementInternals`): it submits `name=value` (an empty string while nothing is chosen),
resets to the `value` attribute, is restored on back navigation, works with `form="id"` and an external
`<label for>`, and joins `<fieldset disabled>`. `required` is a constraint (nothing chosen blocks the
submit, with the browser's own localized message); the error is shown after a change, a submit attempt or
`reportValidity()`.

`value` is the chosen option's value; `""` means none. `input` and then `change` fire when the user chooses
another option or clears; neither fires when you set `value`. To control the selector, set `value` from your
`change` handler. `changeAction` runs after a change and keeps the selector busy while its promise is
pending.

## Screen-reader expectations

- The trigger is a button with `role="combobox"`, `aria-haspopup="listbox"`, `aria-expanded`, named by the
  label and described by the description and status. With `has-search` the search field inside the popup
  is the combobox while the list is open.
- DOM focus stays on the trigger or the search field; the highlighted option is `aria-activedescendant`.
  The list is a `listbox` of `option`s with `aria-selected`; sections are named groups.
- The number of matches of a search, an empty search, and a loading, empty or failed option source are
  announced politely, once per state or query.
- Typing on the closed trigger chooses the option that starts with the typed text; the keys follow the
  WAI-ARIA select-only combobox pattern.

## Localisation

The placeholder, the panel messages ("No options", "No results found", "Loading options", "Options could
not be loaded"), the search placeholder, the clear button name and the announcements come from the locale
catalogs and follow the page or nearest `lang`. Option labels, the label, description, placeholder and
status text are yours to translate. Typeahead matches with the locale's collation. Layout and the popup
mirror in right-to-left.

## Consumer responsibilities

- Give the selector a `name` to submit it, a `label` always, and a message with every status.
- Provide `options` as a property (they are data, not markup), with unique values.
- Keep `value` in sync with your state if you control it: set it from your `change` handler.
- Set `options-state` when the option source is async, and update `options` when it arrives.
- Do not use it for actions or for a handful of visible choices.
