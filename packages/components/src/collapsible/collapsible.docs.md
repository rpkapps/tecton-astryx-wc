---
title: Collapsible
folder: collapsible
category: Container
entries: [Collapsible, CollapsibleGroup]
summary: A trigger that shows and hides a region of content, alone or coordinated as an accordion by a group.
examples: [basic, rich-trigger, disabled, controlled, accordion, multiple, rtl]
keywords: [collapsible, collapse, expand, accordion, disclosure, fold, faq, details, group, show-hide, toggle]
dense:
  description: disclosure trigger + hideable region; tct-collapsible-group makes single or multiple accordions with optional dividers
  usage: tct-collapsible is a trigger button with a chevron and a content region. Standalone it owns its state and starts collapsed (write `open` to start open). Wrap items that have a `value` in tct-collapsible-group for accordion behaviour (`type` single or multiple); has-dividers draws FAQ row chrome. Collapsed content stays findable by browser find in page where supported.
  bestPractices:
    - {do: true, text: 'Use has-dividers on the group for FAQ style lists; it draws themed hairlines, no hand-rolled borders.'}
    - {do: true, text: 'Use type="single" where one section at a time is enough, type="multiple" to compare sections.'}
    - {do: true, text: 'Start sections open (open attribute) when the content is likely needed on first view.'}
    - {do: true, text: 'For controlled state, preventDefault() the cancelable tct-open-change (or the group tct-value-change) and set open/value yourself.'}
    - {do: false, text: 'Hide critical or required content behind a collapsible; users may not discover it.'}
    - {do: false, text: 'Nest collapsibles more than two levels deep.'}
    - {do: false, text: 'Use a collapsible for a single short paragraph; show the text.'}
    - {do: false, text: 'Combine a card around each item with has-dividers; pick one.'}
  properties:
    trigger: trigger text; use slot="trigger" for rich content
    open: content is showing (attribute is the initial state and reflects the current one)
    disabled: blocks toggling; aria-disabled and out of the tab order; keeps its state
    chevronPosition: start or end (attribute chevron-position); defaults to the group's, else end
    chevron-position: start or end; defaults to the group's, else end
    value: identifies the item in a group
    show: method, opens without an intent event
    hide: method, closes without an intent event
    toggle: method, toggles or sets with force, no intent event
    requestClose: method, asks like a user (fires tct-open-change) then closes
    default: the collapsing content
    trigger-slot: rich trigger content
    tct-open-change: cancelable, before a user toggle (not inside a group)
    tct-after-open-change: after every actual change, including code and find in page
    type: group mode, single (default) or multiple
    defaultValue: group initial open value(s); attribute value, space separated for multiple
    hasDividers: group draws hairlines between items (attribute has-dividers)
    has-dividers: group draws hairlines between items
    density: group row density compact, balanced or spacious
    tct-value-change: cancelable, group event before a user toggle; value is the requested selection
related: [card, segmented-control, banner]
---

## Purpose

`tct-collapsible` keeps a page scannable: a trigger row that is always visible and a content region that
opens and closes. The trigger is a real button with `aria-expanded` and `aria-controls`, so Enter, Space and
assistive technology work as for any disclosure. `tct-collapsible-group` coordinates items into an
accordion (one open at a time, or several) and can draw the accordion row chrome.

## When to use

- Settings panels, FAQ lists and detail views where users open the sections they care about.
- A group of comparable sections (`type="multiple"`), or a settings accordion (`type="single"`).
- Any content that is secondary to a heading row.

## Alternatives

- A short paragraph or essential information: show it.
- A message with optional detail: `tct-banner` (its content is collapsible).
- A menu of actions: a dropdown menu.
- Switching between peer views: tabs or `tct-segmented-control`.
- Custom disclosure elements: use the `CollapsibleController` in `collapsible.controller.ts`, the port of
  `useCollapsible`.

## Anatomy

- **Trigger** (part `trigger`): the always-visible button.
- **Chevron** (part `chevron`): the disclosure arrow; `end` points down and flips up, `start` points into the
  row and turns down (mirrored in right-to-left).
- **Content** (part `content`): the region that hides; it is `hidden="until-found"` while collapsed where
  supported. **Body** (part `body`) carries its padding and typography.
- **Group**: adds no box unless `has-dividers`; then each item draws a hairline above it (not the first).

## Variants and states

- `open`, collapsed, `disabled` (aria-disabled, out of the tab order, keeps its state), chevron position.
- Group: `type` single or multiple, `has-dividers`, `density` (compact, balanced, spacious; balanced by
  default with dividers), `chevron-position` for the items.
- States for styling: `:state(open)` and `:state(disabled)`.
- Events: the item fires a cancelable `tct-open-change` (reason `trigger`) before a user toggle and
  `tct-after-open-change` after any change; inside a group the group fires the cancelable
  `tct-value-change` instead. Property and attribute writes never fire an intent event.

## Responsive behaviour

Items are full width and reflow with their container. The trigger label wraps; there is no fixed height.
Nested items keep the group's open state but not its row chrome.

## Form semantics

Not applicable. A collapsible is not a form control; controls inside it submit with their own form as
usual, whether the item is open or not (collapsed content is still in the document).

## Screen-reader expectations

The trigger is a button whose expanded state is announced and which controls the content region. Collapsed
content is not read until opened. A disabled trigger is announced as unavailable and is skipped by Tab.
Where `hidden="until-found"` is supported, browser find in page and fragment links open the item and reveal
the match; elsewhere collapsed content is plainly hidden.

## Localisation

The component has no built-in strings: `trigger` text and the content are yours to translate. The chevron
and the leading-arrow turn mirror for right-to-left.

## Consumer responsibilities

- Give every trigger meaningful text; do not rely on the chevron alone.
- Give each item in a group a unique `value`.
- Do not hide required content, and avoid nesting more than two levels.
- For controlled state, cancel the intent event and set `open` (or the group `value`) yourself.
- Padding and borders belong on inner wrappers of your slotted content, never on an ancestor that carries
  `hidden="until-found"`.
