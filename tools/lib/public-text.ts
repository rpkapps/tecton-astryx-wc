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
      .replace(/[ \t]+([.,;:])/g, '$1')
      .replace(/ {2,}/g, ' ')
  );
}

export const findUpstreamName = (text: string): boolean => UPSTREAM.test(text);

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
