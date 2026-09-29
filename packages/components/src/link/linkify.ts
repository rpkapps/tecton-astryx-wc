import {html, type TemplateResult} from 'lit';

/** A custom pattern for detecting linkable text (upstream `LinkifyPattern`). */
export interface LinkifyPattern {
  /** Regex to match. Must use the global flag (`g`). Capture groups can be used in `href` and `label`. */
  pattern: RegExp;
  /** Builds the link destination from a match. */
  href: (match: RegExpMatchArray) => string;
  /** Custom display text; defaults to the full match (`match[0]`). */
  label?: (match: RegExpMatchArray) => string;
  /** Opens the link in a new tab (`external`). Default `false`. */
  isExternal?: boolean;
}

/** Options of {@link linkify} (upstream `UseLinkifyOptions`). */
export interface LinkifyOptions {
  /** Custom patterns, checked before the built-ins. On overlapping ranges the first match wins. */
  patterns?: readonly LinkifyPattern[];
  /** Include the built-in URL and email detection. Default `true`. */
  hasBuiltins?: boolean;
}

const URL_PATTERN: LinkifyPattern = {
  pattern: /https?:\/\/[^\s<>'")\]},]+/g,
  href: (match) => match[0],
  isExternal: true,
};

const EMAIL_PATTERN: LinkifyPattern = {
  pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  href: (match) => `mailto:${match[0]}`,
};

const BUILTIN_PATTERNS: readonly LinkifyPattern[] = [URL_PATTERN, EMAIL_PATTERN];

interface ResolvedMatch {
  start: number;
  end: number;
  href: string;
  label: string;
  isExternal: boolean;
}

/** All non-overlapping matches across the patterns; earlier patterns and earlier positions win. */
function findMatches(text: string, patterns: readonly LinkifyPattern[]): ResolvedMatch[] {
  const all: ResolvedMatch[] = [];
  for (const candidate of patterns) {
    // A fresh regex per call: a shared global regex keeps `lastIndex` between calls.
    const re = new RegExp(candidate.pattern.source, candidate.pattern.flags);
    for (let match = re.exec(text); match !== null; match = re.exec(text)) {
      // An empty match would never advance the regex.
      if (match[0] === '') {
        re.lastIndex++;
        continue;
      }
      all.push({
        start: match.index,
        end: match.index + match[0].length,
        href: candidate.href(match),
        label: candidate.label ? candidate.label(match) : match[0],
        isExternal: candidate.isExternal ?? false,
      });
    }
  }
  all.sort((a, b) => a.start - b.start);
  const result: ResolvedMatch[] = [];
  let lastEnd = 0;
  for (const match of all) {
    if (match.start >= lastEnd) {
      result.push(match);
      lastEnd = match.end;
    }
  }
  return result;
}

/**
 * Detects URLs, email addresses and custom patterns (`T1234`, `D5678`) in plain text and returns the
 * pieces of the text: strings for the plain parts and a `<tct-link>` template for each match (upstream
 * `useLinkify`, as a module function). Render it with Lit (`html\`<p>${linkify(text)}</p>\``) or `render()`.
 * The links use the `tct-link` URL policy and go through an enclosing `tct-link-provider` for client-side
 * routing. The text is never parsed as HTML: matches and labels are bound as text and attribute values.
 *
 * ```ts
 * html`<p>${linkify('Visit https://example.com or email hi@example.com')}</p>`;
 * ```
 *
 * Guides: [mwg:security] (no HTML strings; hrefs pass the link URL policy in `tct-link`).
 */
export function linkify(text: string, options: LinkifyOptions = {}): (string | TemplateResult)[] {
  const {patterns: custom = [], hasBuiltins = true} = options;
  const patterns = [...custom, ...(hasBuiltins ? BUILTIN_PATTERNS : [])];
  if (patterns.length === 0 || text.length === 0) return [text];
  const matches = findMatches(text, patterns);
  if (matches.length === 0) return [text];

  const nodes: (string | TemplateResult)[] = [];
  let lastIndex = 0;
  for (const match of matches) {
    if (match.start > lastIndex) nodes.push(text.slice(lastIndex, match.start));
    nodes.push(
      html`<tct-link href=${match.href} ?external=${match.isExternal}>${match.label}</tct-link>`,
    );
    lastIndex = match.end;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}
