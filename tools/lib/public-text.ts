/**
 * Owner decision (D-015): the upstream design system's name must not appear in anything that ships or
 * renders: the docs site, generated pages, `llms.txt`, the agent registry, the Custom Elements Manifest,
 * token metadata, package names and public ids. Internal files (`parity.json`, tests, planning docs)
 * still carry it, so everything the generators print to shipped output goes through `publicText()`, and
 * token status names go through `tokenStatusLabel()`. Anything the sanitiser cannot remove is found by
 * `findUpstreamName()` and fails the public-output check.
 */
import type {TokenStatus} from './tokens.ts';

const UPSTREAM = /astryx/i;

/** Sentences and parentheticals that only exist to point at the upstream design system are dropped. */
export function publicText(text: string): string {
  if (!UPSTREAM.test(text) && !/\(upstream `[^`]*`\)/.test(text)) return text;
  return (
    text
      // Provenance paragraph of an adapted guide: internal (THIRD-PARTY-NOTICES.md carries it).
      .replace(
        /^Adapted (?:\(not ported\) )?from (?:the )?(?:Astryx|base system) docs topic .*$/gim,
        '',
      )
      // Token status names (guides and metadata): "Astryx-retained", `retained-default`, "Astryx default".
      .replace(/(\|\s*)Astryx-retained(?![A-Za-z0-9-])/g, '$1Retained default')
      .replace(/(?<![A-Za-z0-9])Astryx-retained(?![A-Za-z0-9-])/gi, 'retained default')
      .replace(/(?<![A-Za-z0-9])Astryx default(?![A-Za-z0-9])/g, 'default')
      // The upstream React packages in a migration table: "@astryxdesign/core/Button" -> "upstream/core/Button".
      .replace(/@astryxdesign\/(\w+)/g, 'upstream/$1')
      // The upstream's stable component class, named in passing or in a selector example.
      .replace(/\s*\(`\.astryx-[\w-]+`\)/g, '')
      .replace(/\.astryx-([\w-]+)/g, '.upstream-$1')
      .replace(/`astryx build`/g, '`build`')
      // "(Astryx target `astryx-badge`)" and "(on `x`, Astryx target `astryx-tooltip`)"
      .replace(/\s*\([^()]*Astryx target[^()]*\)/g, '')
      .replace(/\s*Astryx target `[^`]*`\.?/g, '')
      // "(upstream `icon`)"
      .replace(/\s*\(upstream `[^`]*`\)/g, '')
      .replace(/\ban Astryx role\b/g, 'a role')
      .replace(/\bAstryx role names\b/g, 'role names')
      // The owner's React reference theme, cited in parity notes.
      .replace(
        /(?<![@\w/-])tecton-astryx components\.ts/g,
        "the Tecton reference theme's components.ts",
      )
      .replace(/(?<![@\w/-])tecton-astryx's/g, "the Tecton reference theme's")
      // Upstream data attributes and hooks named in notes.
      .replace(/\bdata-astryx-([\w-]+)/g, 'data-upstream-$1')
      .replace(/`astryx-([\w-]+)`/g, '`upstream-$1`')
      .replace(/\bupstream Astryx\b/g, 'upstream')
      // Token metadata: "(tecton-astryx name)", "the default Astryx border", "Not set by tecton-astryx".
      .replace(/\s*\(tecton-astryx name\)/g, '')
      .replace(/\bthe default Astryx (\w+)/g, 'the default $1')
      .replace(/\bthe superseded tecton-astryx derivation\b/g, 'a superseded earlier derivation')
      .replace(/(?<![@\w/-])tecton-astryx(?![\w/-])/g, 'the token binding')
      // Anything left: the name is replaced by a neutral phrase rather than printed.
      .replace(/(?<![@\w/.-])Astryx(?![\w/-])/g, 'the base system')
      .replace(/(?<![@\w/.<-])astryx(?![\w/<-])/g, 'upstream')
      .replace(/[ \t]+([.,;:])/g, '$1')
      .replace(/ {2,}/g, ' ')
  );
}

/** `publicText()` applied to every string inside `value` (objects and arrays are copied). */
export function publicData<T>(value: T): T {
  if (typeof value === 'string') return publicText(value) as T;
  if (Array.isArray(value)) return value.map((item) => publicData(item as unknown)) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, inner]) => [key, publicData(inner)]),
    ) as T;
  }
  return value;
}

/**
 * Every place the upstream name survives in `text`, as short context snippets. Absolute: package scopes,
 * message ids, vendor paths and class names count like any other mention (D-015). Empty when the text is
 * clean.
 */
export function upstreamLeaks(text: string): string[] {
  const found: string[] = [];
  for (const match of text.matchAll(/astryx/gi)) {
    const at = match.index ?? 0;
    found.push(
      text
        .slice(Math.max(0, at - 30), at + 40)
        .replace(/\s+/g, ' ')
        .trim(),
    );
  }
  return found;
}

export const findUpstreamName = (text: string): boolean => upstreamLeaks(text).length > 0;

const STATUS_LABELS: Readonly<Record<TokenStatus, string>> = {
  'tecton-export': 'Tecton',
  'tecton-binding': 'Tecton (bound)',
  'upstream-default': 'default',
  'retained-default': 'retained default',
  provisional: 'provisional',
};

/** Token status as printed on public pages (the stored value names the upstream system). */
export function tokenStatusLabel(status: string): string {
  return STATUS_LABELS[status as TokenStatus] ?? status;
}
