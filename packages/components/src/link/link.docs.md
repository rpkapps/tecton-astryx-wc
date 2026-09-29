---
title: Link
folder: link
category: Action
entries: [Link, LinkProvider]
summary: A text link for navigation, with external-link, tooltip and client-side routing support.
examples: [basic, in-text, external, button-form, disabled, tooltip, linkify, router]
keywords: [link, anchor, href, hyperlink, navigation, url, external, textlink, router, spa]
dense:
  description: styled anchor for inline and standalone text navigation; tct-link-provider hands clicks to a client-side router
  usage: A styled anchor for inline and standalone text navigation. Supports external links, underline variants, tooltips and router integration through tct-link-provider. Use it for navigating between pages or to external URLs; for an action that does not navigate use tct-button.
  bestPractices:
    - {do: true, text: 'Write descriptive, concise link text that communicates the destination.'}
    - {do: true, text: 'Set standalone when the link appears outside inline text, so it receives the base font size.'}
    - {do: true, text: 'Use type="inherit" for a link inside a paragraph so it adopts the paragraph type.'}
    - {do: true, text: 'Only set label when the content is not descriptive text (an icon-only link). For text links the visible text is already the accessible name.'}
    - {do: false, text: 'Use a link for an action that does not navigate; use tct-button.'}
    - {do: false, text: 'Use generic text like "click here" or "read more"; describe the destination.'}
    - {do: false, text: 'Set label on text links; aria-label replaces the visible text for assistive technology.'}
  properties:
    href: destination; without it the element is a button dressed as a link; unsafe schemes render no href
    label: accessible name for an icon-only link
    has-underline: always underline (default: on hover only)
    disabled: plain anchor without href, inert however it is activated
    external: new tab, external icon, noopener noreferrer and a screen-reader hint
    new-tab-label: screen-reader text of an external link, localised by default
    target: link target; _blank adds noopener noreferrer
    rel: link relationship
    download: download the destination; a value suggests the file name
    referrer-policy: referrer policy of the request
    tooltip: hover and focus tooltip
    standalone: base font size for a link outside inline text
    type: text type as tct-text (default body; inherit inside a paragraph)
    size: font size override as tct-text
    weight: font weight override as tct-text
    color: accent (default, body-coloured in Tecton), primary, secondary, disabled, placeholder or inherit
    display: inline (default) or block
    max-lines: lines before truncation, with a tooltip of the full text
    default: link content
    control: the inner anchor or button
    navigate: tct-link-provider property (href, event) => boolean; return true to handle the navigation yourself
    click: native click, retargeted from the inner anchor or button; a disabled link never fires it
related: [button, text, avatar]
---

## Purpose

`tct-link` is navigation as text. It renders a native `<a href>` in its shadow root (or, without an
`href`, a `<button>` styled to read as a link) and gives it the system's type, colour, underline and focus
treatment. `tct-link-provider` is the other half: a wrapper that hands unmodified clicks on internal
links to your client-side router, so a single-page app navigates without a document load.

## When to use

Use a link to go somewhere: another page, a section, an external site, a file. Use it inline in a sentence
(`type="inherit"`) or on its own (`standalone`). Wrap the app, or the part of it that routes on the client, in
`tct-link-provider` once; every link, link-button and avatar link below it then uses the router.

## Alternatives

- `tct-button` for an action (save, delete, open a dialog). A link goes somewhere; a button does something.
- `tct-avatar` with `href` when the link is a person.
- The button form of `tct-link` (no `href`) only for a low-emphasis action that must read as text.

## Anatomy

- **Base** (`part="base"`): the native `<a>`, or the `<button>` in the button form; carries `data-color`.
- **Text** (`part="text"`): a `tct-text` around the content that provides the typography and truncation.
- **External icon** (`part="external-icon"`): shown for `external`, decorative; a visually hidden hint
  ("(opens in new tab)") joins the accessible name.
- **Tooltip** (`part="tooltip"`): the surface for `tooltip`.

## Variants and states

Underline: on hover by default (Tecton's only affordance for a link), always with `has-underline`. Colour:
`accent` (default) is the primary text colour in Tecton and does not change on hover; `primary` and
`secondary` shift 15% toward the hover tint; `inherit` takes the surrounding colour. The text, the underline
and the icon always share one colour. A pressed link paints the system pressed overlay behind the text.
`disabled` dims to half strength, drops the `href` and turns the pointer off; the underline policy stays. In
forced colours the link uses `LinkText` (`GrayText` when disabled).

`external` sets `target="_blank"`, merges `noopener noreferrer` into `rel` and adds the icon. Any explicit
`target="_blank"` gets the same `rel` tokens. `download` and `referrer-policy` pass to the anchor.

## Responsive behaviour

A link is inline text: it wraps with the line and keeps the size of its container with `type="inherit"`.
`max-lines` truncates the text (an ellipsis, with a tooltip of the full text when it is cut) and lets the link
shrink inside a narrow parent.

## Form semantics

Not applicable: a link is not a form control. The button form is `type="button"` and never submits a form.

## Screen-reader expectations

A link with an `href` is announced as a link named by its text. The button form is announced as a button.
A disabled link is an anchor without `href` (not focusable, not a link to follow) and `aria-disabled`. An external link
adds the localised hint to its name ("Docs (opens in new tab)"); the icon is decorative. `label` is the
accessible name for an icon-only link and replaces the content, so leave it off text links. A tooltip is a
description (`aria-describedby`), never the name.

## Localisation

The new-tab hint is the message `@astryx.link.newTab` in the 30 catalogs (override per link with
`new-tab-label`). Link text and tooltips are yours to translate. The external icon sits at the inline end, so it
mirrors in right-to-left contexts.

## Routing with tct-link-provider

`tct-link-provider` renders no box of its own (`display: contents`) and provides the routing hook. Set its
`navigate` property to a function `(href, event) => boolean`; return `true` when your router handled the
navigation and the element cancels the native one. A link offers it a click only when it is a plain primary
click on a same-origin destination that is not external, not a download, has no other `target` and has no
modifier key: Ctrl, Cmd, Shift, Alt and middle clicks, new-tab links and cross-origin destinations
stay native. Destinations that fail the URL policy (`javascript:`, `vbscript:`, `data:text/html`) never
reach the router: the link renders without an `href`. `linkify()` builds `tct-link` elements, so linkified
text routes the same way.

## Consumer responsibilities

- Give links descriptive text; give an icon-only link a `label`.
- Do not use a link (or the button form) for actions that are not navigation, except where the design calls for a
  text-styled action.
- With `tct-link-provider`, make `navigate` return `true` only for destinations your router owns.
- Do not pass untrusted HTML to `linkify()` results; it binds text and attributes, never markup.
- Keep `disabled` links explained nearby: they are not focusable, so a tooltip will not reach keyboard users.
