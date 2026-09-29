---
title: Metadata List
folder: metadata-list
category: Table & List
entries: [MetadataList, MetadataListItem]
summary: Key-value pairs for the attributes of an object, in one column, several columns or a wrapping row, with a Show more toggle for long lists.
examples: [basic, label-position, columns, horizontal, collapse, icons, rtl]
keywords: [metadata, description, definition, keyvalue, properties, details, attributes, summary, key, value, label]
dense:
  description: label/value metadata display; column layout, label position, orientation, collapse. tct-metadata-list wraps tct-metadata-list-item pairs
  usage: Displays key-value pairs for object attributes such as quality, condition and status in a structured layout. Use it for detail panels, settings summaries and record information. Each pair is a tct-metadata-list-item with a label attribute and the value as its content.
  bestPractices:
    - {do: true, text: 'Choose the label position for the content: start for short values, top (label-position="top") for long or complex values.'}
    - {do: true, text: 'Collapse long lists with max-num-of-items to keep the page scannable.'}
    - {do: false, text: 'Do not use it for extensive form input; use a form layout instead.'}
    - {do: false, text: 'Do not use it for data without a clear key-value structure.'}
  properties:
    columns: column layout; single (default), multi (as many as fit) or a whole number; ignored when horizontal
    labelPosition: attribute label-position; start (beside the value) or top (above it); defaults to top for several columns, start otherwise
    labelWidth: attribute label-width; width of the label column with start labels; a number is px, a string any CSS length
    maxNumOfItems: attribute max-num-of-items; items shown before the rest collapse behind Show more; ignored when horizontal
    orientation: vertical (default) or horizontal (a wrapping row, labels above)
    heading: heading text (attribute) or rich content (slot heading); upstream title
    expanded: whether collapsed items are shown; the attribute is the initial state and the user toggles it; tct-open-change fires first
    showMoreLabel: attribute show-more-label; overrides the Show more label
    showLessLabel: attribute show-less-label; overrides the Show less label
    tct-open-change: the user toggles Show more or Show less; cancelable; open is the requested state
    label: the pair label (tct-metadata-list-item)
    default: the values (tct-metadata-list-item) or the pairs (tct-metadata-list)
    icon: icon rendered before the label text (tct-metadata-list-item)
related: [list, item]
---

## Purpose

`tct-metadata-list` shows an object's attributes as label and value pairs: a well's quality and
condition, an asset's owner and status, a record's details. It lays the pairs out for you (one column,
several columns or a wrapping row), keeps the labels aligned, and collapses a long list behind a
"Show more" toggle.

## When to use

- A detail panel, a settings summary or a record header made of short attributes.
- A compact summary strip (`orientation="horizontal"`).
- A long attribute list you want to keep scannable (`max-num-of-items`).

## Alternatives

- Editable values: a form layout with fields.
- Rows with actions, icons and badges: `tct-list`.
- Tabular data with many records: `tct-table`.
- A hierarchy: `tct-tree-list`.

## Anatomy

- **Heading** (optional): text or rich content above the pairs.
- **Pairs**: each `tct-metadata-list-item` has a **label** (with an optional icon) and a **value**.
- **Disclosure** (optional): the "Show more" / "Show less" button, shown when the list has more items
  than `max-num-of-items`.

## Variants and states

- **Columns**: `single`, `multi` (as many columns as fit, at least 280px each) or a number.
- **Label position**: `start` (beside the value; the label column is shared by all rows) or `top`. Several
  columns default to `top`; `label-width` sets the width of the side-label column.
- **Orientation**: `horizontal` flows the pairs in a wrapping row with labels above; it ignores
  `columns`, `label-position` and `max-num-of-items`.
- **Collapsed / expanded**: items past `max-num-of-items` are hidden until the user expands the list;
  `expanded` starts it open.

## Responsive behaviour

The list fills its container. `columns="multi"` adds and removes columns as the container's width
changes; a fixed number of columns keeps that count. Long values wrap instead of overflowing.

## Form semantics

Not applicable. The list only displays values; it is not a form control.

## Screen-reader expectations

- The list is announced as "list, N items" and each pair as an item whose label is a **term** and whose
  value is a **definition**. This is a deliberate difference from a native `<dl>`: every pair is a separate
  custom element, and a `<dl>` cannot contain custom elements, nor can one element be both a term and a
  definition.
- Items collapsed behind "Show more" are hidden and are not read.
- The toggle is a button that reports `aria-expanded` and controls the list; its label changes between
  "Show more" and "Show less".
- Icons in labels are decorative.

## Localisation

The toggle labels are localised (`@tct.metadataList.showMore` and `showLess`) from the nearest
`lang`; set `show-more-label` and `show-less-label` to override them. Write labels and values in the
user's language. Layouts use logical properties, so labels lead on the right in right-to-left contexts.

## Consumer responsibilities

- Give every pair a `label`; the value is the element's content.
- Keep values short for side labels; use `label-position="top"` for long or rich values.
- Do not put other elements between the list and its `tct-metadata-list-item` children: items past the
  cap are hidden by marking the list's direct children.
- Listen to `tct-open-change` if you need to know when the user expands or collapses the list; call
  `preventDefault()` to keep it as it is.
