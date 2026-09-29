---
title: Tooltip
folder: tooltip
category: Overlay
entries: [Tooltip]
summary: A short, non-interactive text hint that appears on hover, keyboard focus or tap and describes its trigger.
examples: [basic, placement, text-trigger, delay, info-tip, controlled]
keywords: [tooltip, hint, infotip, title, hover, flyout, balloon, helpertext, description, popover]
dense:
  description: hover/focus/tap tooltip for short non-interactive text anchored to its trigger; the text describes the trigger (aria-describedby)
  usage: A short text hint that appears on hover or focus, anchored to a trigger element. Wrap the trigger in <tct-tooltip content="...">. Use it to describe icon-only controls, show the full text of truncated labels, or add supplementary context. The tooltip is the trigger's accessible description, so it must not hold essential information or interactive content.
  bestPractices:
    - {do: true, text: 'Keep tooltip content concise: aim for under 140 characters of plain text.'}
    - {do: true, text: 'Add a tooltip to icon-only buttons and controls that lack a visible label (tct-button icon-only already has one built in).'}
    - {do: true, text: 'Set touch-trigger="tap" when the trigger is a button whose only job is revealing the tooltip, such as an info icon: touch has no hover, and auto keeps the tap for triggers that perform an action.'}
    - {do: false, text: 'Place links or buttons inside a tooltip; use a popover or hover card instead.'}
    - {do: false, text: 'Use tooltips for essential information users must see to complete a task.'}
    - {do: false, text: 'Wrap a natively disabled control: it swallows the pointer events the wrapper needs. Use the disabled reason of the control (disabled-message on tct-text-input, tooltip on tct-button).'}
  properties:
    content: tooltip text (plain string); empty disables the tooltip and removes the description
    placement: preferred side of the trigger (above, below, start, end); start and end follow the writing direction; flips when there is no room
    alignment: alignment along the placement axis (start, center, end)
    delay: milliseconds a hover waits before opening; default 200
    hideDelay: milliseconds leaving waits before closing; default 0
    hide-delay: attribute of hideDelay
    focusTrigger: when keyboard focus opens it (auto only for naturally focusable triggers, always, never)
    focus-trigger: attribute of focusTrigger
    touchTrigger: what a tap does on touch (auto opens unless the trigger acts, tap always opens, none never)
    touch-trigger: attribute of touchTrigger
    disabled: turns the tooltip off (upstream isEnabled inverted); hover and focus do nothing and nothing describes the trigger
    hoverIndication: dashed underline marking a text-only trigger (auto, always, never)
    hover-indication: attribute of hoverIndication
    open: whether the tooltip is showing; the attribute opens it initially, it stays dismissible; writing it never emits an event
    isOpen: read-only, whether the tooltip layer is showing now
    show: method, opens it programmatically (no tct-open-change)
    hide: method, closes it programmatically (no tct-open-change)
    default: slot for the trigger (first element) or plain text, which makes the element itself the trigger
    surface: slot of the popup satellite the element creates; do not fill it
    tct-open-change: cancelable intent event (hover, focus-out, escape, outside, keyboard); detail open and reason; preventDefault vetoes the change
    tct-after-open-change: event after the entry or exit animation settled; detail open
related: [button, dialog, text-input]
---

## Purpose

`tct-tooltip` shows a short hint next to a trigger when the user hovers it, focuses it with the keyboard
or taps it. The hint is the trigger's accessible description: it is wired with `aria-describedby`, so
screen-reader users hear it after the trigger's name. It never takes focus and holds no interactive
content.

## When to use

- To name or describe an icon-only control.
- To show the full text of a truncated label.
- To add supplementary context to a term, or to explain why a control is unavailable (with the disabled
  reason of the control itself).

## Alternatives

- An icon-only button: `tct-button icon-only` with a `label` has a tooltip built in.
- A disabled text field: `tct-text-input` has `disabled-message`.
- Anything interactive or essential to completing a task: a popover, a hover card, or plain visible text.
- A message about a field's validity: `tct-field-status` or the field's status attributes.

## Anatomy

The trigger (your element, or the tooltip's own text) and the popup surface. The popup is an owned
element in the same tree as the trigger (`tct-tooltip-surface`, `popover="manual"`, `role="tooltip"`),
so the trigger's `aria-describedby` resolves without crossing a shadow root. The surface is the part
`surface`.

## Variants and states

- `placement` above, below, start or end, and `alignment` start, center or end. `start` and `end` are
  logical and mirror in right-to-left. The popup flips to the other side when there is no room.
- A text-only body makes the element the trigger: it is focusable, and a dashed underline marks it
  (`hover-indication`).
- `disabled` switches the tooltip off; `open` shows it, and `tct-open-change` lets you veto changes.
- Positioning uses CSS anchor positioning where the browser has it and Floating UI elsewhere.
- Entry is a fade only, so the tooltip does not move while the pointer travels to it; it can be reached
  with the pointer and dismissed with Escape without moving the pointer (WCAG 1.4.13).

## Responsive behaviour

The popup is at most 300px wide and wraps long text. It stays in the viewport by flipping and shifting.
On touch pointers a tap opens it when the trigger has no action of its own (`touch-trigger`).

## Form semantics

Not applicable. `tct-tooltip` is not a form control.

## Screen-reader expectations

- The tooltip text becomes the trigger's accessible description (`aria-describedby`); the trigger keeps
  its own name.
- It opens on keyboard focus of a naturally focusable trigger (`focus-trigger="auto"`), and Escape closes it.
- Escape closes only the tooltip: a dialog or popup around the trigger stays open, one layer per press.
- A tooltip that would be the only way to learn something is a bug: screen-reader users on touch devices
  may not reach it.

## Localisation

`tct-tooltip` has no strings of its own; write `content` in the user's language. `start` and `end`
placements follow the writing direction.

## Consumer responsibilities

- Keep the text short and plain; do not put interactive content in it.
- Wrap one element (or plain text). Do not wrap a natively disabled control.
- Give an icon-only trigger its own accessible name; the tooltip describes, it does not name.
- To control the tooltip, listen for `tct-open-change`, call `preventDefault()` and set `open` yourself.
