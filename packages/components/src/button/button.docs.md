---
title: Button
folder: button
category: Action
entries: [Button]
summary: Triggers an action when activated; also a link, a form submitter and an icon-only button.
examples: [variants, sizes, icons, loading, disabled-with-reason, link, in-form, width]
keywords: [button, btn, cta, submit, action, loading, primary, secondary, ghost, destructive, danger, outlined, text-only, icon-only]
dense:
  description: action trigger w/ 6 variants, 3 sizes, loading state, link + form submitter modes
  usage: Button triggers an action when clicked. Use for form submission, confirmation or any interaction needing a clear CTA. The default slot (or `label`) is the text, `icon`/`end` slots add glyphs, `clickAction` runs async work and shows the busy state, `href` renders a link.
  bestPractices:
    - {do: true, text: 'Primary for the single most important action in the view; secondary, ghost, outlined or text-only for the rest.'}
    - {do: true, text: 'Labels that describe the action ("Save changes"), not "OK" or "Click here".'}
    - {do: true, text: 'Show loading for async actions: use clickAction (busy while its promise is pending) or the loading attribute.'}
    - {do: true, text: 'Icon-only buttons need `label` (the accessible name and the built-in tooltip).'}
    - {do: true, text: 'Explain a disabled button with `tooltip`: it stays focusable and the tooltip is the reason.'}
    - {do: false, text: 'More than one primary button in one view; it dilutes hierarchy.'}
    - {do: false, text: 'Destructive without a confirmation step for irreversible actions.'}
    - {do: false, text: 'A button for navigation; use `href` (a link-styled button) or tct-link if it only takes the user to another page.'}
    - {do: false, text: 'A `variant`-less colour override with utility classes; use the variants.'}
  properties:
    variant: primary, secondary (default), ghost, destructive, outlined, text-only
    size: sm 28px, md 32px, lg 36px; unset takes the button group or size provider, else md
    elevation: resting shadow for floating buttons none|low|med|high; ignored inside a button group
    type: button (default), submit, reset
    name: name submitted with the form when this button submits it
    value: value submitted with the form when this button submits it
    label: accessible label; visible text unless the default slot has content; aria-label when icon-only or loading
    disabled: disables the button; with tooltip it is aria-disabled and stays focusable
    loading: busy state (spinner, aria-busy, no activation); a pending clickAction does the same
    interruptible: stay clickable while a clickAction is pending; a re-click starts a fresh action
    icon: registered icon name shown before the label; also the slot for your own leading icon
    icon-only: square icon-only button; label becomes the accessible name and tooltip
    width: number is px, string is a CSS length ('100%' for full width)
    tooltip: tooltip text on hover and keyboard focus; with disabled it is the reason
    href: renders a link (a) with button styling; a disabled button never renders as a link
    target: link target
    rel: link rel
    formaction: submitter override for the form action
    formmethod: submitter override for the form method
    formenctype: submitter override for the form encoding
    formtarget: submitter override for the form target
    formnovalidate: submitter override to skip validation
    clickAction: async click action; busy while the returned promise is pending
    form: read-only owner form (the `form` attribute is the id of a form elsewhere)
    busy: read-only boolean, true while loading or a clickAction is pending
    default: the visible label (defaults to the label attribute)
    end: trailing content slot (badge, icon, chevron); ignored when icon-only
    click: native click, one per activation; cancelable (submit, reset, link and clickAction follow only when it is not prevented)
related: [icon, spinner, link, button-group, icon-button, toggle-button]
---

## Purpose

`tct-button` triggers an action. It renders a native `<button>` in its shadow root (an `<a>` when it has
an `href`), so it behaves like one: focus, Enter and Space, forms, disabled states. Around that it adds
the Tecton variants and sizes, a busy state for async work, an icon-only mode with a built-in tooltip, and a
"disabled with a reason" mode.

## When to use

- Form submission, reset, confirmation, and any interaction with a clear call to action.
- Actions that take time (save, pay, send): `clickAction` shows the busy state and ignores a second click.
- Icon-only actions in toolbars and rows (`icon-only` with a `label`).

## Alternatives

- Navigation to another page: `tct-link`, or a link-styled button with `href` when it must look like a button.
- An on/off action with pressed state: `tct-toggle-button`.
- A dedicated icon-only component with its own tooltip API: `tct-icon-button`.
- Several related actions as one control: `tct-button-group`.

## Anatomy

A host (`tct-button`) with one inner control (`part="button"`) containing, in order: an optional icon
(`part="icon"`), the label (`part="label"`), optional end content (`part="end"`), and, while busy, a
spinner overlay. The tooltip surface (when a `tooltip` is set, or when the button is icon-only) is a
sibling of the control inside the shadow root.

## Variants and states

- **Variants.** `primary`, `secondary` (default), `ghost` (Tecton's tertiary), `destructive`, and the two
  Tecton additions `outlined` and `text-only`. Each paints from Tecton action roles; `destructive` from
  the status error roles. The focus state is the hover fill plus the hot-pink ring, on every variant.
- **Sizes.** `sm` 28px, `md` 32px, `lg` 36px tall. An explicit `size` wins, then the button group, then a
  size provider. Slotted `tct-icon` follows the size (16px for `sm` and `md`, 20px for `lg`).
- **Loading and busy.** `loading` or a pending `clickAction` shows a spinner over the (hidden) content,
  sets `aria-busy`, ignores clicks, and announces once. A fast action never flashes the spinner: it is
  revealed after a short delay when the action started it. A busy button keeps focus.
- **Disabled.** `disabled` dims the button (recessed fill) and removes it from the tab order. With a
  `tooltip` it stays focusable (`aria-disabled`) so the reason can be reached.
- **Icon-only.** `icon-only` renders a square button; `label` is the accessible name and the tooltip.
- **Link.** With `href` it is an `<a>`; `target` and `rel` apply. A disabled button renders a `<button>`.
- **Elevation.** `elevation` lifts a floating button; a button group owns its own surface.
- **In a group.** Inside `tct-button-group` the button squares its interior corners from the group's
  context and draws a hairline between neighbours.

## Responsive behaviour

The button hugs its content; `width="100%"` fills the container. Long labels truncate with an ellipsis.
Targets are at least 28px tall, and a coarse pointer does not change the visual size.

## Form semantics

The host is form-associated. `type="submit"` submits the button's form with the button's `name` and
`value` (and the `form*` overrides); `type="reset"` resets it; Enter in a text field of the form activates
the form's first submit button, the same as a native one. `form="id"` associates a button outside the form
and a disabled `<fieldset>` disables it. The button has no value of its own in the form data.

`SubmitEvent.submitter` is a temporary native `<button>` the element inserts for the submission, not
the `tct-button` (a platform limit); the button's `name=value` entry is in the form data.
Listeners on the host can call `preventDefault()` on the click to cancel the submission, exactly as with
a native button.

## Screen-reader expectations

The host is a generic wrapper with no role; the inner native `<button>` (or `<a>`) carries the role and the
name, and host `aria-*` attributes (`aria-expanded`, `aria-haspopup`, `aria-pressed`, `aria-label`,
`aria-labelledby`, `aria-describedby`, ...) are delegated to it.

- Name: the visible text, or `label` when the button is icon-only, busy, or its slotted text differs from
  the label. A host `aria-label` wins.
- Busy: `aria-busy="true"`, one polite announcement ("Loading", localised), the content is hidden from
  assistive technology while the spinner shows; focus is not moved.
- Disabled with a reason: `aria-disabled="true"`; the tooltip is the accessible description.
- The tooltip opens on hover and keyboard focus, closes with Escape, and never traps focus.

## Localisation

The only string is the loading announcement (`@astryx.button.loading`), resolved from the language in
scope. Labels are yours to translate. Icons that point (chevrons) mirror in right-to-left; the button lays
out icon, label and end content along the inline axis.

## Consumer responsibilities

- Give every icon-only button a `label`.
- Write a `clickAction` that returns a promise for work that takes time, and handle its errors (a rejected
  promise ends the busy state and surfaces as an unhandled rejection).
- Confirm irreversible `destructive` actions.
- Avoid several `primary` buttons in one view.
