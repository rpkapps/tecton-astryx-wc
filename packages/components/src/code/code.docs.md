---
title: Code
folder: code
category: Content
entries: [Code]
summary: Inline code in the monospace family on the muted surface, sized for the surrounding text.
examples: [default, in-paragraph, colors, sizes, long-content]
keywords: [code, inline code, monospace, snippet, identifier, command, literal, tt, kbd, variable]
dense:
  description: inline code element; a styled <code> with monospace type on the muted surface, for prose
  usage: Inline code element. Renders a styled <code> with the monospace font and the muted surface. For multi-line code use a code block.
  bestPractices:
    - {do: true, text: 'Use it for a function name, a value, a command or a path inside a sentence.'}
    - {do: true, text: 'Use size="inherit" when inline code sits in larger or smaller text so it adopts that size.'}
    - {do: true, text: 'Use color="inherit" when the surrounding text is coloured (a link, a banner).'}
    - {do: false, text: 'Use it for multi-line code; use a code block.'}
    - {do: false, text: 'Use it to style ordinary emphasis; it means "this is code".'}
  properties:
    color: text colour; primary (default), secondary, or inherit to follow the surrounding text
    size: inherit adopts the surrounding text's font size and line height; unset uses the code text size
    default: the code text
related: [kbd, text, blockquote]
---

## Purpose

`tct-code` marks a piece of text as code inside a sentence: `npm install`, `--color-accent`,
`/api/wells`. It renders a real `<code>` element, so assistive technology and copy-and-paste see code,
in the monospace family on the muted surface, at the Tecton code size.

## When to use

- A command, a function or variable name, a value or a file path in running text.
- Documentation and help text that mixes prose and identifiers.

## Alternatives

- Several lines of code, or code that needs highlighting: a code block.
- A key or a shortcut: `tct-kbd`.
- Emphasis, a term or a name: `tct-text` (bold or a type variant), not code.

## Anatomy

An inline host and an inner `<code>` (part `base`) that carries the type, the surface, the padding and the
radius. The text you write in the element is slotted into it and flows and wraps like ordinary inline
text.

## Variants and states

- `color`: `primary` (default), `secondary`, or `inherit` (the surrounding text colour).
- `size`: `inherit` adopts the surrounding font size and line height; unset uses the Tecton code size.
- The monospace family carries a numeric `font-size-adjust`, so inline code matches the x-height of the
  surrounding text; where the property is not supported the fonts keep their natural size.
- Long unbroken text (an identifier, a path) wraps at any point rather than overflowing.

## Responsive behaviour

Inline: it takes the width of its text and wraps with the paragraph. Long content breaks anywhere so it
never widens its container.

## Form semantics

Not applicable. `tct-code` is not a form control.

## Screen-reader expectations

The inner element is a `<code>`, which the browser exposes with the `code` role; its text is read as
normal text. The muted background and the monospace type are visual only; do not rely on them to convey
meaning that the text does not.

## Localisation

Not applicable: no strings. Code is usually not translated; write the slotted text as it must be typed.
The inline padding is symmetric, so nothing changes in RTL (code stays left-to-right inside its own
`dir="ltr"` if it contains Latin text, so set `dir="ltr"` on a `tct-code` in an RTL sentence when the
punctuation order matters).

## Consumer responsibilities

- Put real code in it, and keep it short; use a code block for anything longer.
- In an RTL sentence, set `dir="ltr"` on code that contains punctuation so it does not reorder.
- Do not rely on colour alone to distinguish code from text.
