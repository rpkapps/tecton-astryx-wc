---
title: Resize Handle
folder: resize-handle
category: Layout
entries: [ResizeHandle]
summary: A draggable, keyboard-operable separator between resizable regions, with an announced value and a non-drag alternative.
examples: [default, end-panel, collapsible, snaps, buttons, persisted, states, rtl]
keywords: [resize handle, resizable, separator, splitter, drag, split pane, sidebar width, collapse, panel resize, gutter]
dense:
  description: focusable separator that resizes a tct-layout-panel by pointer or keyboard, with value semantics, snapping, collapse and persistence; use INSTEAD of custom drag code
  usage: Put a tct-resize-handle right after a resizable tct-layout-panel in the same slot (before an end panel, with reversed), or point it at a panel with for. It is a focusable role=separator with aria-valuenow, aria-valuemin, aria-valuemax and a readable value. The arrow keys resize by 10 px (Shift 50 px), Home and End go to the minimum and the maximum, Enter collapses a collapsible panel. A drag must never be the only way: the keyboard works, and stepBy, stepToMin and stepToMax let you add buttons. The panel raises tct-size-change and a cancelable tct-collapse-change.
  bestPractices:
    - {do: true, text: 'Give the handle a label that names what it resizes ("Resize sidebar"); the default is generic.'}
    - {do: true, text: 'Place the handle after a start panel and before an end panel, and set reversed on the latter.'}
    - {do: true, text: 'Set min-size and max-size on the panel so the value has bounds that are announced.'}
    - {do: true, text: 'Offer buttons that call stepBy, stepToMin and stepToMax where a drag is hard for the user (WCAG 2.5.7).'}
    - {do: true, text: 'Use auto-save-id to remember the size, and collapsible for a sidebar that can be hidden.'}
    - {do: false, text: 'Make dragging the only way to change the size.'}
    - {do: false, text: 'Use it without a resizable region: a lone handle warns and does nothing.'}
    - {do: false, text: 'Set tabindex="-1" on it; it is the keyboard control.'}
  properties:
    direction: horizontal (default, a vertical divider dragged sideways) or vertical; must match the region
    position: inline (default, in the flow between its siblings) or overlay (positioned inside a parent panel's bounds)
    reversed: reverses the drag direction, for a handle that resizes a panel at the end
    disabled: makes the handle inert; it takes no focus and no input
    has-divider: draws a 1 px divider line through the handle
    no-always-visible: shows the grip pill only on hover and focus (the default is always visible)
    pill-placement: where the grip pill sits, start, end, center or auto (default, on the panel side)
    label: accessible name of the separator (default localized "Resize handle")
    for: id of the panel to resize, for a handle that is not next to it
    resizable: property that takes a region (the region of a panel or a ResizableController) directly
    region: read-only, the region the handle drives
    stepBy: resizes by a number of px, like the keyboard; a button can call it
    stepToMin: goes to the minimum size
    stepToMax: goes to the maximum size
    default: a grip of your own, replacing the default pill
related: [layout, scrollable-area, app-shell]
---

## Purpose

`tct-resize-handle` is the separator you drag to change the size of a panel. It is a real control, not a
mouse-only decoration: a focusable `role="separator"` that reports the current size, the bounds and a
readable value, moves with the arrow keys, Home and End, collapses a collapsible panel with Enter, and can
be driven from buttons of your own, so nobody has to drag to resize.

The handle and the panel are separate elements: the panel (`tct-layout-panel` with `resizable`) owns the
size, the handle operates it. The panel raises `tct-size-change` and `tct-collapse-change`.

## When to use

- A sidebar, an inspector or a list pane whose width the user should be able to adjust.
- A panel that can be collapsed and expanded again from the keyboard or with a double click.
- Sizes that should be remembered between visits (`auto-save-id`).

## Alternatives

- A fixed panel: give `tct-layout-panel` a `width` and no handle.
- A drawer that opens over the page: `tct-mobile-nav`, or a dialog.
- A show and hide toggle without resizing: `tct-collapsible`.

## Anatomy

- **Handle** (`tct-resize-handle`, part `base`): the divider line, the focus ring and the container of the
  grab zone and the grip. It takes no space beyond the divider (1 px with `has-divider`); the grab zone
  around it is wider than what you see.
- **Grip** (part `pill`): the pill that shows where to drag. It sits on the panel side and moves to the
  other side while the panel is collapsed. Slot your own to replace it.
- **Region**: the size, the bounds, the snap points, the collapse state and the stored value, in the panel
  (or in a `ResizableController` you pass in the `resizable` property).

## Variants and states

- `direction`: `horizontal` (default) resizes the width of a panel beside the content; `vertical` resizes a
  height, with a region of your own.
- `reversed`: for a handle before an end panel. In right-to-left text the arrow keys and the drag swap so
  that the pointer and the arrows still follow what you see.
- `position`: `inline` in the flow, or `overlay` inside the bounds of a parent panel.
- `has-divider`, `no-always-visible` and `pill-placement` set what is drawn. The grip has 3:1 contrast
  with the surface.
- `disabled`: no focus, no input, and `aria-disabled`.
- `:state(dragging)` while a drag is in progress. A drag can be cancelled by the browser (pointer cancel)
  and the cursor and text selection are restored either way.
- Snapping (`snaps` on the panel), the bounds (`min-size`, `max-size`) and collapse (`collapsible`,
  `collapsed-size`) belong to the region and apply to the pointer and the keyboard alike.

## Responsive behaviour

The size is in pixels, or a percentage of the viewport width or of the element named in `container`. The
bounds are live: when the container becomes narrower than the current size, the panel follows its maximum.
A drag measures the basis once when it starts, so the panel does not jump while you drag. On a narrow
screen prefer moving the panel into a drawer (`tct-app-shell` does this for its side navigation).

## Form semantics

Not applicable. The handle is not a form control and takes no part in a form.

## Screen-reader expectations

The handle is a focusable `separator` with `aria-orientation`, `aria-valuenow`, `aria-valuemin`,
`aria-valuemax` and `aria-valuetext` ("200 px", or "Collapsed"), and it is named by `label`.

| Key | Action |
| --- | --- |
| Arrow keys | Resize by 10 px; the sign follows the direction, `reversed` and the text direction |
| Shift + arrow | Resize by 50 px |
| Home, End | Go to the minimum or the maximum size |
| Enter | Collapse or expand a collapsible panel |

The value text changes with every step, so a screen reader announces the new size. Double click collapses
and expands a collapsible panel for pointer users. Keys are ignored while an input method editor is
composing text.

## Localisation

The default name ("Resize handle"), the value text ("{size} px") and "Collapsed" come from the catalogs, in
the language of the page. Give the handle a `label` in your own words. In right-to-left text the grip and
the direction of the keys mirror.

## Consumer responsibilities

- Name each handle after what it resizes.
- Provide a non-drag way to resize where dragging is hard, for example buttons that call `stepBy`,
  `stepToMin` and `stepToMax`.
- Keep the handle next to its panel in the same slot, or point `for` at the panel.
- Decide who owns the collapse state: `tct-collapse-change` is a request that you can prevent.
