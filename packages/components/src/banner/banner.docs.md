---
title: Banner
folder: banner
category: Feedback & Status
entries: [Banner]
summary: A persistent status message with icon, heading, description, actions, dismiss and collapsible detail.
examples: [statuses, actions-and-dismiss, content, containers, rich-content, rtl]
keywords: [banner, alert, notice, message, status, info, warning, error, success, callout, notification, inline-alert]
dense:
  description: persistent status banner (info, warning, error, success, neutral); heading, description, end actions, dismiss, collapsible content
  usage: tct-banner shows a message the user must see until they act on it (form errors, system updates, maintenance, confirmations). Set `status` and `heading` (or slot="heading"); add `description`, actions in slot="end", `dismissable`, and detail as child content (collapsed behind a toggle unless `no-collapse`). Errors and warnings announce as alerts, the rest as status.
  bestPractices:
    - {do: true, text: 'Match the status to the message: info for updates, warning for caution, error for problems, success for confirmations.'}
    - {do: true, text: 'Use the card container in page content and the section container for full-width messages.'}
    - {do: true, text: 'Make info and success banners dismissable; keep error banners until the issue is fixed.'}
    - {do: true, text: 'Keep headings short and scannable; say the status in the text, the icon is decorative.'}
    - {do: true, text: 'Use no-collapse when the user needs the content to act (fields that failed validation).'}
    - {do: true, text: 'Mount an alert banner in response to an event, not on first paint, so assistive technology has a change to report.'}
    - {do: false, text: 'Use for short-lived messages; use a toast.'}
    - {do: false, text: 'Stack several banners of the same status; combine them.'}
    - {do: false, text: 'Rely on colour or the icon alone to carry the meaning.'}
  properties:
    status: info (default), warning, error, success or neutral; sets fill, icon and announcement role
    heading: heading text; use slot="heading" for rich content
    description: description under the heading; use slot="description" for rich content
    icon: registered icon name replacing the status icon; or slot an icon
    dismissable: shows a dismiss button; the banner hides itself
    dismissLabel: accessible name and tooltip of the dismiss button (attribute dismiss-label)
    dismiss-label: accessible name and tooltip of the dismiss button
    container: card (default, rounded) or section (square, full width)
    elevation: resting shadow depth none, low, med or high
    noCollapse: pins the content open with no toggle (attribute no-collapse)
    no-collapse: pins the content open with no toggle
    open: content is showing (initial and current state); starts collapsed
    default: supplementary content in the card area
    heading-slot: rich heading
    description-slot: rich description
    end: actions at the inline end of the header
    tct-dismiss: cancelable, before the banner hides after a user dismissal
    tct-open-change: cancelable, before a user expands or collapses the content
    tct-after-open-change: after the content state changes for any reason
related: [collapsible, button, icon-button, toast]
---

## Purpose

`tct-banner` shows a persistent message at the top of a page or section: form errors, system updates,
maintenance notices, confirmations. The header carries the message on a status-coloured fill (icon, heading,
description, actions, the expand toggle and dismiss); child content sits in a card-coloured area below.

## When to use

- A message the user must see until they act on it or dismiss it.
- Validation summaries, with `no-collapse` and the list of failing fields as content.
- Page-wide notices (`container="section"`).

## Alternatives

- A short-lived message that disappears on its own: a toast.
- A dialog that needs an answer: an alert dialog.
- Inline help next to one field: the field's status message.
- Detail that is not tied to a status: `tct-collapsible`.

## Anatomy

- **Frame** (part `frame`): the outer box; carries the elevation and, for a raised card, the radius.
- **Header** (part `header`): the status-coloured surface. **Icon** (part `icon`) from the status, or slotted.
- **Heading**, **description** (part `description`): text attributes or slots.
- **End area**: `end` slot actions, then the expand toggle, then the dismiss button.
- **Content** (part `content`): the card-coloured area for child content.

## Variants and states

- Statuses `info`, `success`, `warning`, `error`, `neutral` (Tecton's fifth). Warning and error are
  `role="alert"`; the others `role="status"`.
- Containers: `card` (rounded; the header squares its bottom corners while content shows) and `section`.
- Content: collapsed behind a toggle by default (`open` starts it open), pinned with `no-collapse`. A user
  toggle fires the cancelable `tct-open-change`; every change fires `tct-after-open-change`.
- Dismissal: `dismissable` shows a dismiss button. Pressing it fires the cancelable `tct-dismiss` and then
  hides the banner (the host gets `hidden`); focus returns to the element that had it before it entered the
  banner. Remove `hidden` to show it again.
- `:state(open)` styles the banner while content shows.

## Responsive behaviour

When the header is too narrow to hold the actions and a readable text column, the whole end area wraps to its
own row below the text. Long unbroken strings wrap (no horizontal scroll at 320 px), and text respects 200 %
zoom. Section banners span their container's full width.

## Form semantics

Not applicable. A banner is not a form control. To summarise validation errors, use `no-collapse` and link the
list items to the fields.

## Screen-reader expectations

The banner is announced by its role: alerts interrupt, status messages are polite; mount alerts after an
event so there is a change to report. The icon is decorative, so the heading text must carry the status. The
expand toggle is a button with `aria-expanded` and `aria-controls` (set only while the content is rendered);
the dismiss button is named "Dismiss {heading}" (or `dismiss-label`).

## Localisation

Built-in strings: Expand, Collapse, Dismiss and "{dismiss} {title}", from the shared catalogs in every shipped
locale; `dismiss-label` overrides the dismiss name and tooltip. Heading, description and content are yours to
translate. Layout, the icon and the actions follow the writing direction.

## Consumer responsibilities

- Always set a `heading`; put the status in words, not only in colour or icon.
- Mount error and warning banners in response to an event.
- Prefer `tct-link` for links in the heading, description and `end` slots. A plain `<a>` there is also styled
  (the band's ink and an underline, from the light-DOM sheet the banner adopts into its document or shadow root),
  but do not restyle its colour: the status fills are dark or saturated, and the UA link colour fails contrast on them.
- Give focusable content a sensible order and a name; the banner does not manage focus inside its content.
- After a dismissal, own the state (remove the element, or clear `hidden` deliberately).
