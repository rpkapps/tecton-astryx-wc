---
title: Empty State
folder: empty-state
category: Content
entries: [EmptyState]
summary: A placeholder for a content area with no data, with a title, a description and next-step actions.
examples: [default, title-only, with-icon, with-actions, compact, compact-with-actions, heading-level]
keywords: [emptystate, empty, placeholder, nodata, blank, noresults, illustration, blankslate]
dense:
  description: placeholder when a content area has no data: icon, title, description, action buttons
  usage: EmptyState shows a placeholder for empty lists, zero search results and first-time setups. Always include a title and a next step.
  bestPractices:
    - {do: true, text: 'Include a clear title + call-to-action button so users know how to proceed.'}
    - {do: true, text: 'Use an illustration or icon that reinforces the context of the empty state.'}
    - {do: true, text: 'Use the compact attribute inside cards or sidebars where space is limited.'}
    - {do: false, text: 'Leave an empty state without guidance; always explain what happened and what the user can do next.'}
    - {do: false, text: 'Use a generic message like "No data"; be specific about what is empty and why.'}
    - {do: false, text: 'Use an empty state for an error that needs immediate action; use a banner instead.'}
  properties:
    heading: primary message, rendered as a heading (h1-h6) inside the empty state
    description: optional secondary text with more context below the title
    headingLevel: controls only the HTML heading level (1-6) for the document outline; does not change the visual size
    compact: reduced spacing and type size for constrained areas
    icon: slot for an icon or illustration above the title; decorative (aria-hidden)
    actions: slot for buttons below the description; a row by default, a column when compact
---

## Purpose

`tct-empty-state` fills a content area that has nothing to show: an empty list, zero search results, a
first-time setup, a cleared inbox. It tells the reader what is empty and gives them a next step, instead
of leaving a blank space.

## When to use

- A list, table or panel with no records yet, or none that match the current filters.
- A first-run screen that explains what will appear and how to add the first item.
- Inside a card or sidebar, in its compact form, where a full-size placeholder would not fit.

## Alternatives

- `tct-skeleton` or `tct-spinner` while the content is still loading.
- A banner for an error the user must act on immediately.
- Plain supporting text when a whole placeholder would be heavier than the empty area deserves.

## Anatomy

- **Icon** (`slot="icon"`): a visual cue above the title that reinforces the context; decorative.
- **Title** (`heading` attribute or `slot="heading"`): the primary message, a real heading. Say what is
  empty ("No projects yet"), not "No data".
- **Description** (`description` attribute or `slot="description"`): why it is empty or what to do.
- **Actions** (`slot="actions"`): one or two buttons that lead to the next step.

## Variants and states

- **Default**: generous spacing and the large title size, actions in a row.
- **Compact** (`compact`): reduced spacing, the label-size title, supporting-size description, actions
  stacked in a column.
- The heading level (`heading-level`, 1 to 6, default 3) is semantic only: the title keeps the same size
  whatever the level, so it can follow the document outline.

## Responsive behaviour

The content is a centred column with a readable measure (360px for the text group) and generous padding, so
it works in a narrow panel and in a full page alike. Use `compact` where space is constrained.

## Form semantics

Not applicable. An empty state is not a form control; its actions are ordinary buttons and links.

## Screen-reader expectations

The host has `role="status"` (default state owned by the element; a host `role` attribute overrides it), so
assistive technology treats the placeholder as status content that can be announced when it appears. The
title is a real heading at the level you choose. The icon is hidden from assistive technology. Slotted
actions are normal tab stops after the placeholder's text.

## Localisation

There are no built-in strings: the title, description and action labels are yours to translate. The layout
is centred and uses logical properties, so it is identical in left-to-right and right-to-left contexts.

## Consumer responsibilities

- Write a specific title and a next step; never leave the empty state without guidance.
- Choose the heading level that fits the surrounding outline.
- Label the actions and give an icon-only action an accessible name.
- Do not use an empty state for an error; use a banner.
