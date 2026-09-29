---
title: Token
folder: token
category: Content
entries: [Token]
summary: A compact chip for a tag, a category, a filter or a selected value, optionally clickable, linked or removable.
examples: [colors, sizes, icon-and-end, removable, clickable, link, states]
keywords: [token, chip, tag, pill, label, removable, dismissible, filter chip, closable, badge, selection]
dense:
  description: compact chip/tag for inline metadata, filters, selections. 11 colors, 3 sizes, removable, clickable, linkable.
  usage: Represents a discrete piece of data inline: a tag, a category, an active filter, a chosen recipient. Plain by default; add clickable for a button, href for a link, removable for a remove button (it fires tct-remove and your handler removes the token or the item it stands for). The tokenizer and the typeahead use it for their chosen items.
  bestPractices:
    - {do: true, text: 'Colour-code categories (green for active, red for blocked, blue for review) so groups scan quickly; two or three colours per group.'}
    - {do: true, text: 'Use removable when a token stands for a dismissible user choice such as a filter or a multi-select value, and remove it in your tct-remove handler.'}
    - {do: true, text: 'Add a leading icon in the icon slot when it helps identify the kind of token.'}
    - {do: true, text: 'Keep labels to one to three words; long labels truncate with an ellipsis.'}
    - {do: false, text: 'Use a token for an action or for navigation to another page; use tct-button or tct-link. A token displays metadata.'}
    - {do: false, text: 'Hide the label (label-hidden) unless the icon alone is universally clear; the label stays the accessible name.'}
    - {do: false, text: 'Expect the token to remove itself: tct-remove is a request, and the handler decides.'}
  properties:
    label: text of the token, also its accessible name
    size: sm, md or lg; unset follows the nearest size provider
    color: default or one of red, orange, yellow, green, teal, cyan, blue, purple, pink, gray
    disabled: dims the token and blocks every interaction; a disabled link loses its href
    clickable: makes the label a button; the host fires a native click
    removable: adds a remove button named "Remove {label}" that fires tct-remove
    href: makes the token a link; unsafe URL schemes render an anchor without href
    target: where the link opens; _blank adds rel noopener noreferrer
    rel: link relationship
    description: accessible description of the interactive element
    labelHidden: hides the label visually, keeps it as the accessible name
    label-hidden: attribute of labelHidden
    value: what tct-remove carries as its value; default is the label
    control: read-only, the inner button or link that takes focus and presses
    click: native event when a clickable or linked token is pressed
    tct-remove: cancelable event when the remove button is pressed; carries value
    "slot:icon": an icon before the label
    "slot:end": content after the label and before the remove button
related: [badge, tokenizer, typeahead, link]
---

## Purpose

`tct-token` is a small inline chip for a discrete piece of associated data: a tag, a category, a filter
that is switched on, a person picked in a field. It is plain text in a pill by default and becomes
interactive in three ways that compose: a button (`clickable`), a link (`href`) and a remove button
(`removable`).

## When to use

- Labelling content with a category or status that is worth scanning, in one of the eleven colours.
- Showing the active filters or the chosen values of a field, each one removable.
- Representing a chosen item inside a search field: `tct-tokenizer` and `tct-typeahead` render their
  choices as tokens.

## Alternatives

- `tct-badge` for a status or a count that is never interactive.
- `tct-button` for an action and `tct-link` for navigation: a token displays data, it does not start a
  workflow.
- `tct-tokenizer` when the user builds the set of tokens by searching.

## Anatomy

The pill (part `base`, carrying `data-color` and `data-size`) holds an optional icon (slot `icon`), the
label (part `label`), optional end content (slot `end`) and the remove button (part `remove-button`). With
`clickable` the label is a real button; with `href` it is an anchor and, when the token is also removable,
the whole pill follows the link except over the remove button.

## Variants and states

- `color`: `default` (the neutral pill), or `red`, `orange`, `yellow`, `green`, `teal`, `cyan`, `blue`,
  `purple`, `pink`, `gray`. In the Tecton palette `teal` and `cyan` share their values.
- `size`: `sm`, `md`, `lg`; unset follows the nearest size provider.
- Interactive forms: plain, `clickable`, `href` (with `target` and `rel`) and `removable`, alone or
  together. Hover and pressed states draw the pill's edge in the token's own ink, half strength and full
  strength; keyboard focus shows the shared focus ring.
- `disabled` dims the token and ignores the pointer, so a disabled token fires no `click` and no
  `tct-remove`.
- `label-hidden` hides the text visually for an icon-only token and keeps it as the name.

## Responsive behaviour

A token is as wide as its content; a long label truncates with an ellipsis, so give the token a maximum
width (or its container) when labels are unpredictable. A group of tokens is laid out by the parent
(`tct-hstack` with `wrap="wrap"`).

## Form semantics

Not applicable: a token is not a form control and submits nothing. Inside `tct-tokenizer` and
`tct-typeahead` the field owns the value.

## Screen-reader expectations

- A plain token is text. A clickable token is a button and a link token is a link, named by the label and
  described by `description`.
- The remove button is a separate control (a second tab stop, never nested in the label's button or link)
  named "Remove {label}".
- Inside a popover trigger a plain token renders as a button so the popover can bind to it.
- Colour is never the only carrier of meaning: put the meaning in the label.

## Localisation

The name of the remove button comes from the locale catalog and follows the page language or the nearest
`lang`; a provider's overrides win. Layout mirrors in right-to-left. The label, the description and any
end content are yours to translate.

## Consumer responsibilities

- Remove the token (or the item it stands for) in your `tct-remove` handler; the element does not remove
  itself.
- Give a `clickable` token a click handler, and keep `href` for real destinations.
- Keep colours meaningful and the label short, and always provide a label even when it is hidden.
