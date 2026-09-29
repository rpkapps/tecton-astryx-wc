---
title: Size provider
folder: size-provider
category: Utility
entries: [SizeProvider]
summary: Cascades a default size to every control inside it, without touching each one.
examples: [cascade, nested]
keywords: [size, provider, context, density, compact, toolbar, cascade, default size]
dense:
  description: provider that cascades a default size (sm, md, lg) to the controls inside it
  usage: Wrap a toolbar, a card header or any container whose controls should share a size. Controls resolve their size as the explicit size attribute, then the nearest provider, then their own default. A provider with no size hands controls back to their own default.
  bestPractices:
    - {do: true, text: 'Use it on containers such as toolbars and headers so every control matches without repeating size.'}
    - {do: true, text: 'Keep an explicit size on a control that must differ; it always wins.'}
    - {do: false, text: 'Expect it to change a control that has its own size attribute.'}
    - {do: false, text: 'Use it to style anything other than control size; it provides no visual styling.'}
  properties:
    size: default size for the controls inside, sm, md or lg; unset provides none
    default: the subtree whose controls take the size
related: [button, text-input]
---

## Purpose

`tct-size-provider` gives every control in its subtree a default `size`, through the shared size context.
It has no shadow root, draws nothing (`display: contents`) and adds no semantics.

## When to use

- Toolbars, page headers, card headers and dense panels whose controls share a size.
- Design-system wrappers that want compact or comfortable controls in one place.

## Alternatives

- One control: set its own `size`.
- Grouped buttons: `tct-button-group` already provides its size to its buttons.

## Anatomy

A single element with a default slot. Nothing is rendered, and the children stay in the page's own tree, so
selectors, `:lang()` and `dir` reach them as usual.

## Variants and states

- `size="sm"`, `"md"`, `"lg"`: the size given to controls inside.
- No `size`: the provider answers "no size" and controls use their own default. This also cancels a size
  provided further out, so a nested provider can reset a region.
- A value that is not a size is ignored (with a warning in development builds).

Resolution for each control is: its own `size` attribute, then the nearest provider, then its default.
Changing `size` re-sizes controls that are already on the page.

## Responsive behaviour

The provider has no box, so it takes part in no layout. Its children are laid out as if it were not there.

## Form semantics

Not applicable.

## Screen-reader expectations

The provider exposes nothing to assistive technology: no role, no name, no state.

## Localisation

Not applicable. It has no text.

## Consumer responsibilities

- Choose sizes that keep touch targets usable on coarse pointers.
- Do not rely on the provider for anything but size: it cannot style a subtree.
