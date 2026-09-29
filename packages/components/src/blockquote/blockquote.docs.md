---
title: Blockquote
folder: blockquote
category: Content
entries: [Blockquote]
summary: A quotation block with a rule on its inline-start edge and an optional attribution.
examples: [default, with-citation, in-content, multiple-paragraphs, pull-quote, rtl]
keywords: [blockquote, quote, citation, pullquote, quotation, cite, excerpt, testimonial]
dense:
  description: quotation block with an inline-start rule, secondary text and an optional citation
  usage: A quotation block with a rule on its inline-start edge and secondary text colour. Use it to highlight quoted content, testimonials or excerpts. The rule and the padding are logical, so they move to the right edge in right-to-left locales.
  bestPractices:
    - {do: true, text: 'Use for quoted text, testimonials or highlighted excerpts from external sources.'}
    - {do: true, text: 'Provide cite when the source of the quote is known.'}
    - {do: true, text: 'Pass the source through cite (or the cite slot) rather than typing it into the quote, so it renders as a semantic <cite> that assistive technology can tell from the quotation.'}
    - {do: false, text: 'Use it for callout boxes or informational notes; use a banner.'}
    - {do: false, text: 'Wrap the attribution in your own <footer>; a footer inside a blockquote becomes a contentinfo landmark, and a page with several quotes then reports several page footers.'}
  properties:
    cite: the attribution as plain text, rendered as a <cite> after the quote (the name of the source, not a URL); the cite slot takes markup for the attribution instead
    default: the quoted content
related: [text, code, kbd]
---

## Purpose

`tct-blockquote` sets a quotation apart from the text around it with a rule on its inline-start edge, extra
inline padding and the secondary text colour. It renders a real `<blockquote>`, and an optional
attribution as a `<cite>` after the quotation.

## When to use

- Quoted text, testimonials and excerpts from an external source.
- A pull quote in an article.
- A citation for the quote, when the source is known.

## Alternatives

- A callout or an informational note: a banner.
- Emphasised text that is not a quotation: `tct-text`.
- Code or a command: `tct-code`.

## Anatomy

- **Quotation** (part `base`): the `<blockquote>` with the rule, the padding and the text colour; the
  quoted content is slotted into it.
- **Attribution** (part `cite`, optional): a `<cite>` after the quotation, from the `cite` attribute or
  the `cite` slot.

## Variants and states

There are no variants. The rule is `--spacing-0-5` wide in `--color-border-emphasized`, the padding is
`--spacing-4`, and the text is secondary. The attribution is in the supporting size, on its own line, not
italic, with `--spacing-2` above it. The quotation uses `text-wrap: pretty` where supported to avoid
orphans. An empty or whitespace `cite` renders no attribution.

## Responsive behaviour

A quote is as wide as its container; the text wraps and long words break so it never overflows. It has
no breakpoints.

## Form semantics

Not applicable. A blockquote is not a form control.

## Screen-reader expectations

- The quotation is a `blockquote` in the accessibility tree; an `aria-label` on the host is mirrored onto
  it, so a quote can be named.
- The attribution is a bare `<cite>` and is never wrapped in a `<footer>`: a footer inside a blockquote
  maps to the `contentinfo` document landmark, and a page with several quotes would report several page
  footers.
- The `cite` attribute is the attribution text, not the URL the native `cite` attribute of a blockquote
  takes.

## Localisation

Not applicable: no strings. Write the quote and its attribution in the reader's language. The rule and
the padding are on the inline-start edge, so they move to the right edge under `dir="rtl"`.

## Consumer responsibilities

- Quote accurately and attribute the source (`cite`); do not use a blockquote for text that is not a
  quotation.
- Keep quoted text in the quotation and the source in the attribution.
- Give a quote an accessible name (`aria-label`) only when it needs one; most quotes do not.
