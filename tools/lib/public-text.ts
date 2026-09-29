/**
 * Owner decision: the upstream design system's name must not appear anywhere on the public docs site.
 * Authored JSDoc and token metadata still carry it (it is useful in source, in `parity.json` and in the
 * internal reports), so everything the generators print to public pages goes through `publicText()`,
 * and token status names go through `tokenStatusLabel()`. Anything the sanitiser cannot remove is
 * found by `findUpstreamName()` and reported by the docs generator.
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
      // Token status names (guides and metadata): "Astryx-retained", `astryx-retained`, "Astryx default".
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

/**
 * Identifiers that still carry the upstream name because their rename is scheduled separately (D-015):
 * the package scope `@tecton-astryx/*`, the message-id namespace `@astryx.*` and the vendor path
 * `/vendor/tecton-astryx/` that the guides use. They are not silent:
 * the public-output check reports how many it tolerated. Delete this list when both renames land, and the
 * check becomes absolute.
 */
export const TRANSITIONAL_IDENTIFIERS: readonly RegExp[] = [
  /@tecton-astryx\/[\w.-]+/g,
  /@astryx\.[\w.<>*-]+/g,
  /\/vendor\/tecton-astryx\//g,
];

/** Occurrences of the transitional identifiers in `text` (reported, not failed). */
export function countTransitional(text: string): number {
  return TRANSITIONAL_IDENTIFIERS.reduce(
    (sum, pattern) => sum + (text.match(pattern)?.length ?? 0),
    0,
  );
}

/**
 * Every place the upstream name survives in `text`, as short context snippets, after removing the
 * transitional identifiers. Empty when the text is clean.
 */
export function upstreamLeaks(text: string): string[] {
  let rest = text;
  for (const pattern of TRANSITIONAL_IDENTIFIERS) rest = rest.replace(pattern, ' ');
  const found: string[] = [];
  for (const match of rest.matchAll(/astryx/gi)) {
    const at = match.index ?? 0;
    found.push(
      rest
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
  'tecton-astryx': 'Tecton (bound)',
  'upstream-default': 'default',
  'astryx-retained': 'retained default',
  provisional: 'provisional',
};

/** Token status as printed on public pages (the stored value names the upstream system). */
export function tokenStatusLabel(status: string): string {
  return STATUS_LABELS[status as TokenStatus] ?? status;
}
