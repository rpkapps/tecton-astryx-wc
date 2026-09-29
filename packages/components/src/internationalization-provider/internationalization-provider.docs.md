---
title: Internationalization provider
folder: internationalization-provider
category: Utility
entries: [InternationalizationProvider]
summary: Sets the locale, extra message catalogs, message overrides and direction for every component inside it.
examples: [locale, overrides, rtl]
keywords: [internationalization, i18n, locale, language, translation, messages, overrides, rtl, direction, lang, localisation]
dense:
  description: provider of locale, extra catalogs, per-locale message overrides and text direction; reflects lang onto itself
  usage: Wrap the part of the page that should use a locale different from the document's, or add catalogs and message overrides. Set locale (a BCP 47 tag) and, for a right-to-left language, dir="rtl" yourself. messages adds catalogs, overrides changes single messages, and a component's own label attribute still wins over both.
  bestPractices:
    - {do: true, text: 'Set dir="rtl" together with an RTL locale; the provider does not infer it from the locale.'}
    - {do: true, text: 'Use overrides for a few changed strings, and messages for a whole catalog the library does not ship.'}
    - {do: true, text: 'Give messages and overrides new object identities when they change; the same object is treated as unchanged.'}
    - {do: false, text: 'Rely on it to translate your own text; it only supplies the strings components ship.'}
    - {do: false, text: 'Nest it needlessly; the nearest provider replaces the outer one wholesale.'}
  properties:
    locale: BCP 47 tag such as fr, pt-BR or zh-Hans; reflected as lang on the provider
    messages: property only; extra catalogs by locale tag, ICU strings or {defaultMessage} entries by message id
    overrides: property only; sparse per-locale message overrides applied on top of every catalog
    dir: native attribute ltr or rtl; the direction of the subtree and what components read
    default: the subtree that takes the locale
related: [size-provider, theme]
---

## Purpose

`tct-internationalization-provider` tells the components inside it which language to speak: it supplies the
locale, extra message catalogs and per-message overrides, and it puts the matching `lang` on the page so
`:lang()`, assistive technology and `Intl` formatting agree with what is shown.

## When to use

- A region of the page in a different language from the document.
- An application-wide locale chosen at run time, when you do not control `<html lang>`.
- Renaming a few built-in strings (a different "Next" label) or supplying a catalog the library does not ship.

## Alternatives

- One language for the whole document: set `<html lang>`; components read it and load their catalog.
- One component's label: use its own attribute (for example `close-label`), which beats the provider.

## Anatomy

The provider has no shadow root and draws nothing (`display: contents`). Its children stay in your tree.
The context it answers to carries `locale`, `dir`, `messages` and `overrides`.

## Variants and states

- **Locale.** `locale` is required in practice. A regional tag is looked up from the most specific tag to the
  least specific (`pt-BR`, then `pt`), then English. Shipped catalogs load on demand and components re-render
  when they arrive.
- **Resolution order for a string.** The component's own attribute, then `overrides`, then `messages`, then the
  shipped catalog, then the English default.
- **Direction.** `dir` is the native attribute. Set it to `rtl` for Arabic, Hebrew and other right-to-left
  languages: the subtree is laid out right-to-left and components read that direction (arrow keys, popup
  placement). The provider does not infer it from `locale`, so layout and components can never disagree.
- **Nesting.** The nearest provider wins and replaces the outer one wholesale; it does not merge catalogs.
- **`lang`.** The locale is reflected as `lang` on the provider and removed again when `locale` is cleared;
  a `lang` you wrote yourself is left alone while there is no locale.

## Responsive behaviour

The provider has no box, so it takes part in no layout.

## Form semantics

Not applicable.

## Screen-reader expectations

The provider exposes nothing itself. The `lang` it sets makes screen readers pronounce the subtree in that
language, and the components inside expose their strings (for example a spinner's name) in that locale.

## Localisation

This is the localisation entry point. The library ships 30 catalogs (370 message ids) plus a pseudo locale
(`locale="pseudo"`) that brackets and lengthens every string, for finding truncation and untranslated text.
Message ids look like `@tct.pagination.next`. Text you write yourself is yours to translate.

## Consumer responsibilities

- Set `dir` for right-to-left locales, and keep it in step with `locale` when the user switches language.
- Translate your own content; the provider only covers the strings components ship.
- Replace `messages` and `overrides` with new objects when they change.
