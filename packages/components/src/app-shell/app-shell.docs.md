---
title: App Shell
folder: app-shell
category: Layout
entries: [AppShell]
summary: The page shell of an application: top and side navigation, a banner, the main content, a skip link and a mobile navigation drawer.
examples: [default, variants, side-nav-only, banner, auto-height, mobile-drawer, custom-drawer, rtl]
keywords: [app shell, application shell, page shell, app frame, top nav, side nav, skip link, main landmark, mobile drawer, responsive navigation, page layout, banner]
dense:
  description: page shell for an application with top navigation, side navigation, banner, main landmark, skip link and a mobile navigation drawer below 768 px; use INSTEAD of hand-built page frames
  usage: AppShell is the outermost frame of an application page. Fill the slots top-nav, side-nav, banner and the default slot (the main content, the main landmark). Below the mobile breakpoint (768 px, mobile-nav-breakpoint) the side navigation moves into a modal drawer and a toggle opens it; place tct-mobile-nav-toggle in the top nav or let the shell add a top bar. The first Tab stop is a skip link that moves focus to the main region. The shell fills the viewport (height fill) and the main content scrolls inside it; height auto lets the page scroll with the navigation pinned. Consumer components read the mobile state through the app shell mobile context.
  bestPractices:
    - {do: true, text: 'Use one app shell per page, as the outermost frame; it provides the banner and the main landmarks.'}
    - {do: true, text: 'Put the primary navigation in the side-nav slot and let the shell move it into the drawer on small screens.'}
    - {do: true, text: 'Place a tct-mobile-nav-toggle in your top navigation, or leave it to the shell.'}
    - {do: true, text: 'Name each navigation inside the slots with aria-label (for example "Main" and "Sections").'}
    - {do: true, text: 'Use content-padding to pad the main content, and put a tct-layout inside it for further regions.'}
    - {do: false, text: 'Nest an app shell inside another, or use it for a bounded region; use tct-layout.'}
    - {do: false, text: 'Add your own skip link or main landmark; the shell has them.'}
    - {do: false, text: 'Hide the side navigation with CSS on small screens; the drawer handles it.'}
  properties:
    variant: background style, elevated (default), wash, surface or section
    height: fill (default, the viewport height, the content scrolls inside) or auto (at least the viewport height, the page scrolls)
    content-padding: spacing step for the padding of the main content (default 0)
    no-mobile-nav: switches mobile navigation off; no drawer, no toggle, and the side navigation is hidden below the breakpoint
    no-mobile-toggle: the shell places no toggle of its own; put a tct-mobile-nav-toggle where you want it
    mobile-nav-breakpoint: width below which mobile navigation applies, sm, md (default), lg, xl, 2xl or none
    mobile-nav-open: whether the mobile drawer is open; the attribute is the initial state
    default-is-mobile: assume the mobile layout on the first render, for prerendered pages where the viewport is unknown
    no-landmarks: for a shell inside a page that already has banner and main landmarks; the header and the main region get no landmark role
    isMobile: read-only, whether the mobile layout applies now
    mobileBreakpointPx: read-only, the width in px that the mobile layout is below
    openMobileNav: opens the mobile drawer from code, without a tct-open-change
    closeMobileNav: closes the mobile drawer from code, without a tct-open-change
    focusMain: moves focus to the main region, as the skip link does
    default: the main content; it is the main landmark
    top-nav: the top navigation, in the header
    side-nav: the side navigation; an inline panel above the breakpoint, the drawer content below it
    banner: a system-wide announcement above the top navigation
    mobile-nav: a tct-mobile-nav of your own, replacing the automatic drawer
    drawer: content of the automatic drawer when it should differ from the side navigation
    mobile-bar: content of the mobile top bar next to the toggle, in a shell without top navigation
    tct-open-change: the toggle or the drawer asks to open or close the mobile drawer (open, reason); cancelable
related: [layout, mobile-nav, resize-handle, scrollable-area]
---

## Purpose

`tct-app-shell` is the frame of an application page. It puts a top navigation, a side navigation, an optional
system banner and the main content in place, gives the page its `banner` and `main` landmarks and a skip
link, and turns the side navigation into a drawer on small screens. Everything an application repeats on
every page, and gets wrong by hand, lives here.

The shell fills the viewport. The main content scrolls inside it, so the navigation never scrolls away; the
alternative `height="auto"` lets the page scroll with the navigation pinned to the top.

## When to use

- The outermost frame of an application: dashboards, admin tools, settings, mail.
- A page with a persistent navigation that must collapse into a drawer on a phone.
- Anywhere a skip link and a main landmark are wanted without building them.

## Alternatives

- A bounded frame inside a page, a dialog or a card: `tct-layout`.
- A marketing or reading page with no application navigation: `tct-stack` and `tct-section`.
- Only the drawer: `tct-mobile-nav`.

## Anatomy

- **Skip link**: the first Tab stop, "Skip to content", hidden until it takes focus.
- **Header** (part `header`): the banner (a system announcement, slot `banner`) above the top navigation
  (slot `top-nav`); a `banner` landmark.
- **Side navigation** (part `sidenav`): a panel at the start, inline above the breakpoint. Below it, the
  same content is the drawer.
- **Main**: the default slot, the `main` landmark, on a layout content region that scrolls.
- **Mobile drawer**: a `tct-mobile-nav`, added by the shell (or your own in the `mobile-nav` slot).
- **Base** (part `base`): the box with the variant background and the height.

The shell is built from `tct-layout`, `tct-layout-header`, `tct-layout-panel` and `tct-layout-content`.

## Variants and states

- `variant`: `elevated` (default; the content is an elevated surface with a rounded start corner over a
  wash frame), `wash` (the page background everywhere), `surface` (the surface colour everywhere) or
  `section` (the surface with divider lines between the regions).
- `height`: `fill` (default) or `auto`. With `auto` the header and the side navigation are sticky and the
  side navigation fills the rest of the viewport height and scrolls on its own. `--app-shell-height` replaces
  the viewport height, for a shell in a bounded frame such as a preview.
- Mobile: `:state(mobile)` below the breakpoint, and `:state(mobile-nav-open)` while the drawer is open.
  A side-navigation-only shell gets a mobile top bar with the toggle; a top navigation places
  `tct-mobile-nav-toggle` itself. `no-mobile-toggle` leaves the placement to you and `no-mobile-nav` turns
  the whole mobile navigation off.
- A consumer `tct-mobile-nav` in the `mobile-nav` slot replaces the automatic drawer and keeps the toggle
  working. The `drawer` slot swaps only the drawer content.
- `no-landmarks`: for a shell inside a page that already has a banner and a main landmark (a preview, an
  embedded application).

## Responsive behaviour

Below the mobile breakpoint the side navigation leaves the layout and becomes the content of a modal
drawer. The breakpoint is `md` (768 px) by default; `mobile-nav-breakpoint` picks `sm` (640), `md`, `lg`
(1024), `xl` (1280) or `2xl` (1536), or `none` to never switch. When a theme is registered that defines its
own width breakpoints, the shell uses them. The edge belongs to the wider layout: at exactly 768 px the
inline navigation shows. In a browser the shell reads the real viewport before it renders; for prerendered
pages `default-is-mobile` sets the first render.

Components that need to know (a top navigation, a side navigation) read the same state through the app
shell mobile context.

## Form semantics

Not applicable.

## Screen-reader expectations

The header is a `banner` landmark and the main content the `main` landmark; the mobile top bar is a named
`navigation`. Name the navigations you put in the slots with `aria-label`.

The first Tab stop of the page is the skip link. Activating it moves focus to the main region (a fragment
link cannot reach into a shadow tree, so the shell moves focus itself); the region is focusable by script
and is a tab stop only while its content scrolls and holds nothing focusable.

| Key | Action |
| --- | --- |
| Tab | The first stop is the skip link; it becomes visible on focus |
| Enter | On the skip link: moves focus to the main content |
| Escape | Closes the mobile drawer; focus returns to the toggle |

The toggle has `aria-expanded`; see `tct-mobile-nav` for the drawer.

## Localisation

The skip link ("Skip to content"), the mobile top bar name and the drawer strings come from the catalogs,
in the language of the page. The layout follows the text direction: the side navigation is on the right in
right-to-left text, and the elevated corner and the drawer mirror.

## Consumer responsibilities

- Use one shell per page, at the outermost level, and put real navigation in `side-nav` and `top-nav`.
- Name each navigation and keep the destinations of the side navigation and the drawer the same.
- Do not add a second `main` or `banner` landmark, or set `no-landmarks` when the page already has them.
- Give a shell that is not the whole page a height (`--app-shell-height`); by default it is as tall as
  the viewport.
