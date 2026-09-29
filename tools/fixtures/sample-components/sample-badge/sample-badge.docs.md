---
title: Badge
folder: sample-badge
category: Feedback & Status
entries: [Badge]
summary: Highlights a status or category at a glance.
examples: [variants, removable]
keywords: [badge, tag, chip, status, label, pill]
dense:
  description: small status pill with 5 variants
  usage: Highlights a status or category at a glance. Use for short state labels next to an item.
  bestPractices:
    - {do: true, text: 'Keep the label to one or two words.'}
    - {do: false, text: 'Badge for actions; use tct-button.'}
  properties:
    variant: status colour, one of neutral, info, success, warning, error
    size: sm or md
    label: visible text
    removable: shows a remove button
    removeRequests: count of remove requests
    requestRemove: asks to remove the badge
    icon: slot for a leading icon
    default: slot for extra content
    tct-remove: fired when the user asks to remove the badge
    click: native click from the pill
related: [text]
---

## Purpose

A badge labels an item with a short status.

## When to use

Use it next to a row, card or heading to show state.

## Alternatives

Use `tct-button` when the label must trigger an action.

## Anatomy

An optional icon, the label and an optional remove button inside a pill.

## Variants and states

Five status variants and two sizes; `removable` adds the remove button.

## Responsive behaviour

The badge never wraps; long labels truncate in the consumer's container.

## Form semantics

Not applicable. The badge is not a form control.

## Screen-reader expectations

The label is read as text; the remove button is named "Remove <label>".

## Localisation

The remove button label is currently English only in this sample.

## Consumer responsibilities

Provide a meaningful `label`; handle `tct-remove` and remove the badge yourself.
