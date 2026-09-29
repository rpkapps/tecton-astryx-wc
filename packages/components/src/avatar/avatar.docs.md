---
title: Avatar
folder: avatar
category: Content
entries: [Avatar, AvatarStatusDot, AvatarGroup, AvatarGroupOverflow]
summary: A person or team as a photo, initials or a default icon, with a status dot, stacking and an overflow count.
examples: [sizes, shapes, fallbacks, photo, status, tooltip, interactive, group, group-interactive, group-shapes]
keywords: [avatar, profile, user, photo, thumbnail, initials, gravatar, pfp, userpic, facepile, presence, status dot, avatar group, overflow]
dense:
  description: person/team avatar w/ photo → initials → icon fallback chain, status dot, groups
  usage: Avatar represents a person or team with a profile photo, initials, or a default icon. It falls back automatically. Use it in comment headers, contact lists, chat and user cards. tct-avatar-status-dot goes in the status slot; tct-avatar-group stacks avatars and takes a tct-avatar-group-overflow for the rest.
  bestPractices:
    - {do: true, text: 'Always pass a name for the initials fallback and the screen-reader name.'}
    - {do: true, text: 'Match size to context: xsm/sm inline, md/lg in lists, xl for profiles.'}
    - {do: true, text: 'Add a status dot in chat or team views where availability matters.'}
    - {do: true, text: 'When wrapping an avatar in your own tooltip or hover card, set tooltip="false" so the built-in name tooltip does not overlap yours.'}
    - {do: true, text: 'Interactive avatars (href or interactive) need name or alt; without one they warn in development.'}
    - {do: false, text: 'Rely on a status label to name an interactive avatar. "Online" says nothing about where the link goes.'}
    - {do: false, text: 'Use avatars for logos or product images. Use an image or icon instead.'}
    - {do: false, text: 'Override the shape with CSS; use the shape attribute so a group and a theme stay uniform.'}
  properties:
    src: primary image URL (unsafe schemes and data URLs are refused)
    fallbackSrc: image shown when src fails to load (attribute fallback-src)
    name: user name for initials and the accessible name
    alt: accessible name; falls back to name
    size: xsm 20px, sm 24, md 36 (default), lg 48, xl 128, or a number of pixels; a group's size overrides it
    shape: circle (default), rounded or square; a group's shape overrides it
    tooltip: hover/focus tooltip; absent or true shows the name, a string shows that text, "false" shows none
    href: renders the avatar as a link
    target: link target, only with href
    rel: link rel, only with href
    interactive: renders a button (no href); listen for click; needs alt or name
    control: the inner link or button when interactive, else null
    status: slot for corner content, typically tct-avatar-status-dot
    click: native click from the inner link or button
    variant: status dot shape and colour (success filled, neutral ring, error minus bar)
    label: accessible label of the status; composed into the avatar name ("Jane Doe, Online")
    icon: slot for an icon inside the status dot (medium and large avatars)
    count: overflow count for "+N" and the name "N more"
    default: group members (tct-avatar and one overflow); overflow custom content instead of "+N"
related: [status-dot, badge, tooltip]
---

## Purpose

`tct-avatar` identifies a person or a team. It shows a photo when there is one, then the initials of the
name, then a default person icon, so the layout never has a hole in it. A `tct-avatar-status-dot` in the corner
shows availability, `tct-avatar-group` stacks several avatars into a facepile, and
`tct-avatar-group-overflow` stands for the people who are not shown.

## When to use

- Comment headers, contact lists, chat messages, user cards and anywhere someone must be identified at a glance.
- A facepile of collaborators or assignees, with "+N" for the rest.
- A presence indicator next to a person (status dot).

## Alternatives

- An image or `tct-icon` for logos, product images and anything that is not a person or team.
- `tct-status-dot` for a status signal that is not attached to an avatar.
- `tct-badge` for a label or a count.

## Anatomy

- **Avatar** (`part="base"`): the sized box. A `<div>` with `role="img"`, or the `<a>` / `<button>` when interactive.
- **Content** (`part="content"`): the clipping container of the photo or the fallback.
- **Photo**: the image from `src`, then `fallback-src`.
- **Fallback** (`part="fallback"`): the initials (first character of the first and last words; punctuation is
  skipped), or the default person icon when the name gives none.
- **Status** (`slot="status"`, `part="status"`): a `tct-avatar-status-dot`, placed on the circle edge (4 o'clock)
  or in the corner for rounded and square avatars.
- **Group** (`tct-avatar-group`): a row of overlapping avatars with a surface-coloured ring; the optional
  **overflow** chip shows "+N".

## Variants and states

- **Sizes**: `xsm` 20px, `sm` 24, `md` 36 (default), `lg` 48, `xl` 128, or any number of pixels.
- **Shapes**: `circle`, `rounded` (the element radius) and `square`. Inside a group the group's size and shape win, so
  a facepile stays uniform.
- **Status dot**: three variants that differ by shape as well as colour (WCAG 1.4.1): a filled dot (`success`), a hollow ring
  (`neutral`), a dot with a minus bar (`error`). The dot scales in three tiers with the avatar and can carry an icon
  on medium and large avatars.
- **Interactive**: `href` makes a link (unsafe destinations render no link), `interactive` a button. Inside a group,
  interactive avatars share one tab stop and are reached with the arrow keys.
- **Tooltip**: by default the name appears in a tooltip on hover and keyboard focus.
- The fallback surface is the Tecton avatar fill and ink; the ring in a group is the surface colour.

## Responsive behaviour

Avatars have a fixed size in CSS pixels and never reflow. A group is `inline-flex` and wraps only if its container does; pass
only the avatars you want visible and let the overflow chip carry the rest.

## Form semantics

Not applicable. Avatars are not form controls; an interactive avatar is a link or a `type="button"` button.

## Screen-reader expectations

An avatar with a name is a `role="img"` named from `alt` or `name`, composed with the status label ("Jane Doe, Online") so the status is
reachable although the image role prunes its children. An avatar with neither is decorative (hidden), unless it has a labelled status.
An interactive avatar is a link or button named the same way and needs a real name. A group is a `group` named "Avatars" (change it with
`aria-label`); when it has interactive members it gets a keyboard hint as its description. The overflow chip is named "N more".
A static avatar with a name tooltip is a tab stop so keyboard users can reveal the tooltip (outside a group).

## Localisation

The messages `@astryx.avatar.nameWithStatus`, `@astryx.avatarGroup.label`, `@astryx.avatarGroup.keyboardHint` and
`@astryx.avatarGroup.overflow` ship in the 30 catalogs; names, status labels and tooltip text are yours. Groups overlap toward the inline start,
so a right-to-left facepile mirrors, and the status dot moves to the inline-end corner.

## Consumer responsibilities

- Give every avatar a `name` (or `alt`), and every interactive one a name that says where it leads.
- Slice the member list yourself and pass the remainder as the overflow `count`.
- Set `tooltip="false"` when you provide your own overlay.
- Provide status labels that are meaningful on their own ("Online", "In a meeting"), not just colours.
