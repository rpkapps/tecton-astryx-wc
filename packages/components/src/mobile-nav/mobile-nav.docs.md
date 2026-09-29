---
title: Mobile Nav
folder: mobile-nav
category: Navigation
entries: [MobileNav, MobileNavToggle]
summary: A slide-out modal drawer for mobile navigation, and the hamburger toggle that opens it inside an app shell.
examples: [default, sides, custom-header, rtl, toggle]
keywords: [mobile nav, mobile navigation, drawer, hamburger, menu toggle, off-canvas, side drawer, navigation drawer, responsive navigation]
dense:
  description: slide-out modal drawer for navigation on small screens, with a header, a close button, Escape and outside-press dismissal and focus return; plus the hamburger toggle for tct-app-shell
  usage: MobileNav is a modal drawer on a native dialog element. Inside a tct-app-shell it follows the shell's mobile navigation state and tct-mobile-nav-toggle opens it below the breakpoint (768 px by default). On its own, control it with open. Escape, a press on the dimmed area, the close button and requestClose() ask to close it with a cancelable tct-open-change; tct-after-open-change reports the settled state. Focus returns to the element that opened it and the page behind is inert. side is start, end or auto, and both are logical.
  bestPractices:
    - {do: true, text: 'Use tct-mobile-nav-toggle in a tct-app-shell instead of wiring the button yourself; it renders only below the breakpoint.'}
    - {do: true, text: 'Put the same navigation in the drawer that the wide layout shows in the side navigation.'}
    - {do: true, text: 'Give the drawer a header or a label so that the dialog has a name.'}
    - {do: true, text: 'Handle tct-open-change and set open yourself when you use the drawer outside an app shell.'}
    - {do: false, text: 'Use it for content that is not navigation; use a dialog or a bottom sheet.'}
    - {do: false, text: 'Show a drawer and a permanent side navigation at the same time.'}
    - {do: false, text: 'Move focus yourself when it closes; it returns to the trigger.'}
  properties:
    open: whether the drawer is open; unset it follows the enclosing app shell, once written it is yours; writing it never emits an event
    header: plain-text title next to the close button, a level 2 heading; the header slot replaces it
    width: drawer width in px (default 320), never wider than the viewport
    side: edge it slides in from, start, end or auto (default, the side of the trigger, else end); logical
    label: accessible name of the dialog (default the header text, then localized "Navigation")
    close-label: accessible name of the close button (default localized "Close navigation")
    isOpen: read-only, whether the drawer is open now, its own open or the shell's state
    show: opens without a tct-open-change; resolves once the entry animation settled
    hide: closes without a tct-open-change; resolves once hidden
    requestClose: closes as the user would, with a cancelable tct-open-change
    default: the navigation content of the drawer (or, for the toggle, a custom icon)
    tct-open-change: the user or a request asks to open or close (open, reason escape, outside, close-button, request or trigger); cancelable
    tct-after-open-change: the change settled after the animation (open)
    isRendered: read-only on the toggle, whether it renders now (below the breakpoint, with mobile navigation)
related: [app-shell, layout, dialog, bottom-sheet]
---

## Purpose

`tct-mobile-nav` is the navigation drawer for small screens: a panel that slides in from an edge over a dimmed
page and holds the navigation. It is built on a native modal `<dialog>`, so the browser provides the focus
containment and the inert page, and the component adds the sliding, the dismissal rules and the focus
return.

`tct-mobile-nav-toggle` is the hamburger button that opens it. Inside a `tct-app-shell` the two are already
wired: below the breakpoint the shell turns its side navigation into the drawer and places the toggle.

## When to use

- The navigation of an application on a phone or a narrow window.
- A secondary menu that is too big for a popover and should cover the page while it is open.

## Alternatives

- A wide-screen side navigation that stays put: the `side-nav` slot of `tct-app-shell`, or a
  `tct-layout-panel`.
- Any other modal content: `tct-dialog`. Content anchored to the bottom edge: `tct-bottom-sheet`.

## Anatomy

- **Dialog** (part `dialog`): the full-viewport `<dialog>`, which carries the dimmed backdrop.
- **Drawer** (part `drawer`): the sliding panel with its border and background. It holds the header row
  and the scrolling content.
- **Header row**: the `header` text as a level 2 heading (or the `header` slot) and the close button.
- **Toggle** (`tct-mobile-nav-toggle`, part `button`): a ghost icon button with the menu glyph; slot an icon
  of your own to replace it.

## Variants and states

- `side`: `start`, `end` or `auto`. Both edges are logical, so `start` is the right edge in right-to-left
  text. `auto` picks the side of the trigger that opened the drawer, and `end` when there is none.
- `width`: 320 px by default, never wider than the viewport.
- `open` and `:state(open)`. Unset, the drawer follows the app shell; once you write it the drawer is yours.
- The drawer slides in and out; under reduced motion the slide becomes a short fade. The exit is animated
  with the Web Animations API. `tct-after-open-change` fires when the change has
  settled, after the animation.
- The toggle reflects the drawer with `aria-expanded` and asks before it acts: it raises a cancelable
  `tct-open-change` with the reason `trigger` and toggles the drawer unless you prevent it. It renders
  nothing above the breakpoint or in a shell without mobile navigation.
- Content that would overflow scrolls inside the drawer. The layout padding of the page is reset at the
  drawer boundary, so a `tct-layout` inside it does not inherit the page padding.

## Responsive behaviour

The drawer is a viewport overlay, so it does not depend on its container. The shell decides when the
drawer applies: below 768 px by default, or the width of `mobile-nav-breakpoint`; the toggle follows the
same rule. On a very narrow screen the drawer takes the whole width.

## Form semantics

Not applicable. A form inside the drawer works as anywhere else, and `method="dialog"` on a form inside it
closes the drawer.

## Screen-reader expectations

The drawer is a modal dialog named by `label`, the header text or "Navigation", and the page behind it is
inert. Focus moves into the drawer when it opens and returns to the toggle, or whatever opened it, when it
closes.

| Key | Action |
| --- | --- |
| Escape | Closes the drawer (a cancelable request) |
| Tab, Shift + Tab | Cycle through the drawer; focus never reaches the page behind |
| Enter, Space | On the toggle: opens or closes the drawer |

The toggle is a named button ("Open navigation" by default) with `aria-expanded`. It has no `aria-controls`
because the drawer lives in another shadow tree, where an id reference cannot resolve.

## Localisation

"Navigation", "Close navigation" and "Open navigation" come from the catalogs, in the language of the page;
`label`, `close-label` and the toggle's `label` replace them. The slide and the edges are logical and mirror
in right-to-left text.

## Consumer responsibilities

- Put real navigation in the drawer, and the same destinations the wide layout offers.
- Name the drawer with `header` or `label`.
- Outside an app shell, own the state: set `open` from `tct-open-change`.
- Do not mount both a permanent side navigation and the drawer at one width; the shell handles the switch.
