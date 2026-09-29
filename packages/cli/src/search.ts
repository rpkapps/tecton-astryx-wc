/**
 * `tct search`: one "I am looking for X" entry point across every content domain: elements, controllers and
 * utilities, and docs topics. Scoring is keyword plus fuzzy ranking (not semantic):
 *
 *   100  exact name (tag, family folder or display name)
 *    90  exact keyword match
 *    80  name Levenshtein distance 1
 *    75  a whole word of a compound name (RovingTabindexController, tct-toggle-button)
 *    70  keyword substring / distance 1
 *    60  name substring (>= 4 characters, >= 50% coverage)
 *    50  description / prose mentions the term (stem tolerant)
 *    45  usage guidance mentions the term
 *    40  name Levenshtein distance 2
 *    30  keyword Levenshtein distance 2
 *    20  name Levenshtein distance 3
 *
 * Name and keyword signals always outweigh description and prose, so an exact match sorts above an
 * incidental mention. Multi-word queries are scored per content word (stop words removed, synonyms
 * fanned out at a discount) and by phrase, whichever is stronger; matching more of the query's terms
 * always scores at least as high as matching fewer.
 */
import {ERROR_CODES, CliError} from './errors.ts';
import type {AgentRegistry, RegistryComponent} from './registry/types.ts';
import {levenshtein, firstSentence} from './text.ts';

export const SEARCH_DOMAINS = ['component', 'controller', 'doc'] as const;
export type SearchDomain = (typeof SEARCH_DOMAINS)[number];

export interface SearchResultEntry {
  domain: SearchDomain;
  name: string;
  score: number;
  reason: string;
  description: string;
  /** Follow-up command to act on the result. */
  command: string;
  /** Import specifier (component and controller results). */
  import?: string;
  /** Doc title (doc results). */
  title?: string;
  /** Component category (component results). */
  category?: string;
  /** Controller kind (controller results). */
  kind?: string;
}

export interface Candidate {
  domain: SearchDomain;
  name: string;
  /** Extra names that count as the name itself (family folder, display name). */
  names?: string[];
  keywords?: string[];
  description?: string;
  prose?: string[];
  guidance?: string[];
  result: Omit<SearchResultEntry, 'score' | 'reason' | 'domain' | 'name' | 'description'>;
}

/**
 * Product-language terms an agent is likely to type, expanded to the catalog's vocabulary so oblique
 * queries still rank. Matched bidirectionally (typing any value also pulls in the key and its siblings).
 */
const SYNONYMS: Record<string, string[]> = {
  modal: ['dialog', 'popup', 'lightbox'],
  popup: ['popover', 'overlay'],
  toast: ['snackbar', 'notification', 'flash'],
  dropdown: ['menu', 'select', 'picker'],
  tabs: ['tablist', 'segmented'],
  form: ['fields', 'inputs', 'survey'],
  layout: ['stack', 'grid', 'flex', 'columns', 'spacing'],
  loading: ['spinner', 'loader', 'progress', 'busy'],
  avatar: ['profile', 'user', 'photo', 'picture'],
  table: ['list', 'rows', 'records', 'spreadsheet', 'datatable'],
  tooltip: ['hint', 'hovercard', 'tip'],
  switch: ['toggle', 'checkbox'],
  accordion: ['collapsible', 'disclosure', 'expand'],
  banner: ['alert', 'message', 'callout'],
  skeleton: ['placeholder', 'shimmer'],
  divider: ['separator', 'rule', 'hr'],
  icon: ['glyph', 'symbol'],
  navigation: ['nav', 'menu', 'sidebar'],
  input: ['textfield', 'textbox', 'field'],
  dark: ['theme', 'colorscheme'],
  tokens: ['variables', 'customproperties', 'design'],
};

const SYNONYM_INDEX = (() => {
  const index = new Map<string, Set<string>>();
  const add = (a: string, b: string) => {
    let set = index.get(a);
    if (!set) index.set(a, (set = new Set()));
    set.add(b);
  };
  for (const [keyWord, values] of Object.entries(SYNONYMS)) {
    for (const value of values) {
      add(keyWord, value);
      add(value, keyWord);
      for (const other of values) if (other !== value) add(value, other);
    }
  }
  return index;
})();

/** Light stemmer: strips common English suffixes so "charts" and "chart" share a root. */
export function stem(word: string): string {
  for (const suffix of ['ing', 'ed', 'ies', 'es', 's']) {
    if (word.length > suffix.length + 2 && word.endsWith(suffix)) {
      return suffix === 'ies' ? `${word.slice(0, -3)}y` : word.slice(0, -suffix.length);
    }
  }
  return word;
}

/** Filler words stripped from multi-word queries so natural phrasing ranks on its content words. */
const STOPWORDS = new Set(
  (
    'a an the of for to with and or in on at by that this my your our their is are be it its as from page ' +
    'screen app application view where you can some like just basically want wants need needs something ' +
    'thing things build make create i me we us so up out over side one big how do use using'
  ).split(' '),
);

/** Content tokens of a lowercased query: stop words and one-letter words removed. */
export function tokenizeQuery(term: string): string[] {
  return term
    .split(/\s+/)
    .map((token) => token.replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, ''))
    .filter((token) => token.length >= 2 && !STOPWORDS.has(token));
}

/** Minimum per-token score in the multi-word pass to count as a real match (guidance stays below it). */
const MIN_TOKEN_SCORE = 50;

interface Hit {
  score: number;
  reason: string;
}

/** Score of one candidate against one term, across name, keyword and prose signals. */
export function scoreCandidate(term: string, candidate: Candidate): Hit | null {
  let best = 0;
  let reason = '';
  const consider = (score: number, why: string) => {
    if (score > best) {
      best = score;
      reason = why;
    }
  };

  for (const name of [candidate.name, ...(candidate.names ?? [])]) {
    const lower = name.toLowerCase();
    if (lower === term) {
      consider(100, 'exact name');
      continue;
    }
    const shorter = term.length < lower.length ? term : lower;
    const longer = term.length < lower.length ? lower : term;
    if (shorter.length >= 4 && longer.includes(shorter) && shorter.length / longer.length >= 0.5) {
      consider(60, `name contains "${shorter}"`);
    }
    // A whole word of a compound name (RovingTabindexController, tct-toggle-button).
    if (
      term.length >= 3 &&
      name.split(/(?=[A-Z][a-z])|[-_\s]+/).some((word) => word.toLowerCase() === term)
    ) {
      consider(75, `name word "${term}"`);
    }
    const distance = levenshtein(term, lower);
    if (distance === 1) consider(80, `similar name (distance ${distance})`);
    else if (distance === 2) consider(40, `similar name (distance ${distance})`);
    else if (distance === 3) consider(20, `similar name (distance ${distance})`);
  }

  for (const keyword of candidate.keywords ?? []) {
    const lower = String(keyword).toLowerCase();
    if (lower === term) {
      consider(90, `keyword "${keyword}"`);
      continue;
    }
    const shorter = term.length < lower.length ? term : lower;
    const longer = term.length < lower.length ? lower : term;
    if (shorter.length >= 4 && longer.includes(shorter) && shorter.length / longer.length >= 0.5) {
      consider(70, `keyword "${keyword}"`);
    }
    const distance = levenshtein(term, lower);
    if (distance === 1) consider(70, `keyword "${keyword}" (distance ${distance})`);
    else if (distance === 2) consider(30, `keyword "${keyword}" (distance ${distance})`);
  }

  if (term.length >= 3) {
    const root = stem(term).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`\\b${root}(s|es|ing|ed|ies)?\\b`);
    if (candidate.description && pattern.test(candidate.description.toLowerCase())) {
      consider(50, `description mentions "${term}"`);
    } else {
      const inProse = (candidate.prose ?? []).some(
        (blob) => blob && pattern.test(blob.toLowerCase()),
      );
      if (inProse) {
        consider(50, `docs mention "${term}"`);
      } else if (
        (candidate.guidance ?? []).some((blob) => blob && pattern.test(blob.toLowerCase()))
      ) {
        // What a component says about USING it: weaker evidence than its own summary.
        consider(45, `guidance mentions "${term}"`);
      }
    }
  }
  return best > 0 ? {score: best, reason} : null;
}

/** Best score of a token, fanning out through synonyms (a synonym hit is discounted). */
function bestForToken(token: string, candidate: Candidate): Hit | null {
  let best = scoreCandidate(token, candidate);
  for (const synonym of SYNONYM_INDEX.get(token) ?? []) {
    const hit = scoreCandidate(synonym, candidate);
    if (hit) {
      const score = Math.round(hit.score * 0.85);
      if (!best || score > best.score) best = {score, reason: `${hit.reason} (~${token})`};
    }
  }
  return best;
}

export function scoreQuery(term: string, tokens: string[], candidate: Candidate): Hit | null {
  const full = scoreCandidate(term, candidate);
  if (tokens.length <= 1) {
    const single = tokens.length === 1 ? bestForToken(tokens[0]!, candidate) : null;
    if (full && (!single || full.score >= single.score)) return full;
    return single;
  }
  // The whole phrase equals a declared name or keyword: a deliberate label, reserved a top tier above
  // anything the per-word path can reach.
  if (full && full.score >= 90) return {score: full.score + 100, reason: full.reason};

  let strongest = 0;
  let matched = 0;
  const hitTerms: string[] = [];
  for (const token of tokens) {
    const hit = bestForToken(token, candidate);
    if (hit && hit.score >= MIN_TOKEN_SCORE) {
      strongest = Math.max(strongest, hit.score);
      matched++;
      hitTerms.push(token);
    }
  }
  if (matched === 0) return full;
  // Strongest matched concept + a bonus per extra matched concept + coverage: monotonic in the matched set.
  const coverage = matched / tokens.length;
  const score = Math.round(strongest + Math.min(matched - 1, 3) * 12 + coverage * 15);
  if (full && full.score >= score) return full;
  return {score, reason: `matches ${matched}/${tokens.length} terms: ${hitTerms.join(', ')}`};
}

const primaryTag = (component: RegistryComponent): string =>
  component.tag ?? `tct-${component.folder}`;

/** Search candidates of a registry, one per component, controller and docs topic. */
export function gatherCandidates(registry: AgentRegistry): Candidate[] {
  const candidates: Candidate[] = [];
  for (const component of registry.components) {
    const tag = primaryTag(component);
    const dense = component.dense;
    candidates.push({
      domain: 'component',
      name: tag,
      names: [component.folder, component.name, ...component.tags.filter((other) => other !== tag)],
      keywords: component.keywords,
      description: dense?.description ?? component.summary,
      prose: [
        component.summary,
        component.sections.Purpose ?? '',
        component.sections['When to use'] ?? '',
      ],
      guidance: [
        dense?.usage ?? '',
        ...(dense?.bestPractices.map((practice) => practice.text) ?? []),
      ],
      result: {
        command: `tct component ${tag}`,
        import: `@tecton-wc/components/${component.folder}`,
        category: component.category,
      },
    });
  }
  for (const controller of registry.controllers) {
    candidates.push({
      domain: 'controller',
      name: controller.name,
      keywords: [controller.kind, controller.area],
      description: controller.summary,
      prose: [controller.description],
      // Where it is used and what its members do: evidence of usage, weaker than its own summary.
      guidance: [
        controller.usedBy.length > 0 ? `used by ${controller.usedBy.join(' ')}` : '',
        ...controller.members.map((member) => member.summary),
      ],
      result: {
        command: `tct controllers ${controller.name}`,
        import: controller.import,
        kind: controller.kind,
      },
    });
  }
  for (const topic of registry.topics) {
    candidates.push({
      domain: 'doc',
      name: topic.slug,
      names: [topic.title],
      keywords: [],
      description: topic.description,
      prose: topic.sections.flatMap((section) => [section.heading, firstSentence(section.body)]),
      result: {command: `tct docs ${topic.slug}`, title: topic.title},
    });
  }
  return candidates;
}

export interface SearchOptions {
  type?: SearchDomain;
  limit?: number;
}

export interface SearchData {
  query: string;
  /** How many candidates matched in total, before `limit` was applied. */
  matchCount: number;
  results: SearchResultEntry[];
}

const DOMAIN_ORDER: Record<SearchDomain, number> = {component: 0, controller: 1, doc: 2};

export function search(
  registry: AgentRegistry,
  query: string,
  options: SearchOptions = {},
): SearchData {
  const {type, limit = 20} = options;
  if (typeof query !== 'string' || query.trim() === '') {
    throw new CliError('A search query is required.', ERROR_CODES.ERR_MISSING_ARGUMENT, [
      {name: 'tct search button', reason: 'example'},
    ]);
  }
  if (type && !SEARCH_DOMAINS.includes(type)) {
    throw new CliError(
      `Unknown --type "${String(type)}".`,
      ERROR_CODES.ERR_INVALID_ARGUMENT,
      SEARCH_DOMAINS.map((domain) => ({name: domain, reason: 'valid type'})),
    );
  }
  if (!Number.isInteger(limit) || limit <= 0) {
    throw new CliError(
      `Invalid limit "${String(limit)}". Must be a positive integer.`,
      ERROR_CODES.ERR_INVALID_ARGUMENT,
    );
  }

  const term = query.trim().toLowerCase();
  const tokens = tokenizeQuery(term);
  const scored: SearchResultEntry[] = [];
  for (const candidate of gatherCandidates(registry)) {
    if (type && candidate.domain !== type) continue;
    const hit = scoreQuery(term, tokens, candidate);
    if (!hit) continue;
    scored.push({
      domain: candidate.domain,
      name: candidate.name,
      score: hit.score,
      reason: hit.reason,
      description: candidate.description ?? '',
      ...candidate.result,
    });
  }
  scored.sort(
    (a, b) =>
      b.score - a.score ||
      DOMAIN_ORDER[a.domain] - DOMAIN_ORDER[b.domain] ||
      a.name.localeCompare(b.name),
  );
  return {query: query.trim(), matchCount: scored.length, results: scored.slice(0, limit)};
}
