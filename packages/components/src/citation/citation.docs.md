---
title: Citation
folder: citation
category: Content
entries: [Citation]
summary: An inline reference to a source, as a title chip or a numbered badge.
examples: [label, number, with-icon, without-link, in-text]
keywords: [citation, cite, reference, source, footnote, attribution, provenance, link, chip, superscript]
dense:
  description: inline reference to an external source; attribute info in AI responses, articles, or anywhere provenance is needed
  usage: Citations display inline references to external sources. Use them to attribute information within AI-generated responses, articles, or anywhere provenance and source links are needed. The label variant is a title chip; the number variant is a compact superscript badge.
  bestPractices:
    - {do: true, text: 'Use the label variant when the source title adds meaningful context for the reader.'}
    - {do: true, text: 'Use the number variant for compact inline references within body text, like footnotes.'}
    - {do: false, text: 'Mix label and number variants in the same paragraph; pick one style per context.'}
  properties:
    source: object {title, url, src, icon}; url follows the shared navigation policy, rejected destinations leave the citation visible without navigation
    sourceTitle: attribute form of source.title (source-title)
    sourceUrl: attribute form of source.url (source-url)
    sourceSrc: attribute form of source.src (source-src), a decorative favicon or logo
    number: the citation index, shown in the badge and read in the accessible name
    variant: label (title chip, default) or number (superscript badge)
    icon: slot for a node icon before the label (label variant only); wins over source.src
related: [link, badge]
---

## Purpose

`tct-citation` marks a claim with the source it came from. In its `label` form it is a small chip with the
source title; in its `number` form it is a superscript badge like a footnote marker. With a URL it links to
the source; without one it is a plain reference.

## When to use

- Attribution inside an AI-generated answer, an article or a report.
- Footnote-style references in running text (`number` variant).
- A row of source chips under an answer (`label` variant, optionally with favicons).

## Alternatives

- `tct-link` for an ordinary link in text.
- `tct-badge` for a status or category, which is not a reference.

## Anatomy

- **Container** (`part="base"`): a link when the source has a safe URL, otherwise a plain element.
- **Icon** (`slot="icon"` or `source.src`, `part="icon"`): optional decorative source icon, label variant only.
- **Label** (`part="label"`): the source title, clipped with an ellipsis at 15em; the number variant shows the
  citation number instead.

## Variants and states

- **label**: a bordered chip with the title, secondary text colour; hover (links only) adds the overlay
  and the primary text colour.
- **number**: a round accent-muted badge, raised like a superscript.
- **Link or plain**: only a citation with a safe `url` is interactive. `javascript:`, `vbscript:` and
  `data:text/html` destinations are refused; the citation stays visible without a link.
- **Image sources**: `source.src` (and the legacy `source.icon` URL) are loaded as decorative images and are
  dropped if they fail or if their URL is unsafe. A node in the `icon` slot is drawn as-is and wins.

## Responsive behaviour

The citation is inline and flows with the surrounding text. The label chip never grows past 15em; a longer
title is clipped with an ellipsis and its full text is the native `title`.

## Form semantics

Not applicable.

## Screen-reader expectations

The accessible name is "Citation 3: Source title" (localised), so both the number and the title are read.
A linked citation is a link with the `doc-noteref` role and opens in a new tab with `rel="noopener
noreferrer"`. An unlinked citation is exposed as an image with the same name, because a bare number carries no
meaning on its own. The source icon is decorative.

## Localisation

The name pattern comes from the `@astryx.citation.label` message (`Citation {number}: {title}`) in the 30
shipped locales; the title, the number and the URL are yours. The chip mirrors in right-to-left contexts.

## Consumer responsibilities

- Provide a meaningful `title` (or accept the number as the title).
- Use one variant per context and keep source URLs trustworthy; unsafe schemes are refused, but the page
  the link leads to is not checked.
- Announce updates when citations stream in.
