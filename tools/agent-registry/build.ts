/**
 * The agent registry (D-011): one JSON document that the docs site, the `tct` CLI and the MCP server
 * (WP-AI) read instead of re-deriving anything. Per component: name, tag(s), category, keywords, dense
 * doc, related, API (from the CEM), examples and authored docs sections. Top level: docs topics,
 * design tokens, upstream hook mappings and the categories.
 *
 * Pure: takes loaded inputs and returns the registry; `generate.ts` does the IO.
 */
import {cemElements, type CemPackage} from '../lib/cem.ts';
import {loadComponentDocs, type DocsFrontmatter} from '../lib/docs-model.ts';
import {elementDoc, type ElementDoc} from '../lib/element-api.ts';
import {publicText, tokenStatusLabel} from '../lib/public-text.ts';
import type {Manifest} from '../lib/parity.ts';
import {CATEGORIES, componentUrl} from '../lib/site.ts';
import type {TokenData, TokenMeta} from '../lib/tokens.ts';

export const REGISTRY_SCHEMA_VERSION = 1;

export interface RegistryElement extends ElementDoc {
  keyboard: {keys: string; action: string; when?: string}[];
  form?: {formAssociated: boolean; notes?: string};
}

export interface RegistryEntry {
  id: string;
  upstream: string;
  tag: string | null;
  status: string;
  /** Upstream prop/callback/slot -> WC API rows (also the migration table). */
  mapping: {upstream: string; kind: string; as: string; target?: string; reason?: string}[];
  differences: {id: string; type: string; text: string}[];
}

export interface RegistryComponent {
  id: string;
  name: string;
  folder: string;
  /** The tag of the entry the page is named after. */
  tag: string | null;
  tags: string[];
  category: string;
  url: string;
  summary: string;
  keywords: string[];
  related: string[];
  status: string;
  /** False until the folder has a valid `<folder>.docs.md`. */
  documented: boolean;
  dense: DocsFrontmatter['dense'] | null;
  elements: RegistryElement[];
  entries: RegistryEntry[];
  examples: {id: string; title: string; description: string; source: string}[];
  /** Authored H2 sections by heading. */
  sections: Record<string, string>;
}

export interface RegistryTopic {
  slug: string;
  title: string;
  description: string;
  url: string;
  sections: {heading: string; body: string}[];
}

export interface RegistryHook {
  folder: string;
  entry: string;
  upstream: string;
  target?: string;
  as?: string;
}

export interface AgentRegistry {
  schemaVersion: number;
  library: {name: string; description: string};
  upstream: {name: string; commit: string};
  categories: string[];
  components: RegistryComponent[];
  hooks: RegistryHook[];
  topics: RegistryTopic[];
  tokens: Pick<TokenMeta, 'name' | 'category' | 'status' | 'light' | 'dark' | 'description'>[];
  tokenCounts: {tokens: number; byStatus: Record<string, number>} | null;
}

export interface GuideInput {
  slug: string;
  title: string;
  description: string;
  order: number;
  body: string;
}

export interface RegistryInputs {
  cem: CemPackage;
  componentsSrc: string;
  folders: readonly string[];
  manifest: Manifest;
  tokens?: TokenData;
  guides: readonly GuideInput[];
}

const STATUS_RANK = ['not-started', 'in-progress', 'implemented', 'verified'];

export function buildRegistry(inputs: RegistryInputs): AgentRegistry {
  const {cem, componentsSrc, manifest} = inputs;
  const elements = cemElements(cem);
  const manifestById = new Map(manifest.entries.map((entry) => [entry.id, entry]));

  const components: RegistryComponent[] = [];
  const hooks: RegistryHook[] = [];

  for (const folder of inputs.folders) {
    const docs = loadComponentDocs(componentsSrc, folder);
    const parityEntries = Object.entries(docs.parity?.entries ?? {});
    const folderElements = elements.filter((element) => element.folder === folder);
    if (folderElements.length === 0 && parityEntries.length === 0) continue;

    const frontmatter = docs.frontmatter;
    const primaryEntry =
      parityEntries.find(([, entry]) => entry.upstream.name === frontmatter?.title) ??
      parityEntries.find(([, entry]) => entry.tag) ??
      parityEntries[0];
    const primaryTag = primaryEntry?.[1].tag ?? folderElements[0]?.tagName ?? null;
    const upstreamManifest = primaryEntry ? manifestById.get(primaryEntry[0]) : undefined;
    const category = frontmatter?.category ?? upstreamManifest?.category ?? 'Utility';

    const registryElements: RegistryElement[] = folderElements.map((element) => {
      const facts = element.declaration['x-tct-upstream'];
      return {
        ...elementDoc(element),
        keyboard: facts?.keyboard ?? [],
        ...(facts?.form ? {form: facts.form} : {}),
      };
    });

    const entries: RegistryEntry[] = parityEntries.map(([id, entry]) => ({
      id,
      upstream: entry.upstream.name,
      tag: entry.tag ?? null,
      status: entry.status,
      mapping: entry.api.map((row) => ({
        upstream: row.upstream,
        kind: row.kind,
        as: row.as,
        ...(row.target ? {target: row.target} : {}),
        ...(row.reason ? {reason: row.reason} : {}),
      })),
      differences: entry.differences ?? [],
    }));

    for (const [id, entry] of parityEntries) {
      for (const hook of entry.hooks ?? []) {
        hooks.push({folder, entry: id, upstream: hook.upstream, target: hook.target, as: hook.as});
      }
    }

    const status = entries.reduce(
      (lowest, entry) =>
        STATUS_RANK.indexOf(entry.status) < STATUS_RANK.indexOf(lowest) ? entry.status : lowest,
      entries[0]?.status ?? 'not-started',
    );

    components.push({
      id: folder,
      name: frontmatter?.title ?? primaryEntry?.[1].upstream.name ?? folder,
      folder,
      tag: primaryTag,
      tags: folderElements.map((element) => element.tagName),
      category,
      url: componentUrl(category, folder),
      summary: frontmatter?.summary ?? folderElements[0]?.declaration.summary ?? '',
      keywords: frontmatter?.keywords ?? [],
      related: frontmatter?.related ?? [],
      status,
      documented: frontmatter !== null,
      dense: frontmatter?.dense ?? null,
      elements: registryElements,
      entries,
      examples: docs.examples.map(({id, title, description, source}) => ({
        id,
        title,
        description,
        source,
      })),
      sections: Object.fromEntries(docs.sections.map((section) => [section.heading, section.body])),
    });
  }
  components.sort((a, b) => (a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1));

  const topics: RegistryTopic[] = [...inputs.guides]
    .sort((a, b) => a.order - b.order || (a.title < b.title ? -1 : 1))
    .map((guide) => ({
      slug: guide.slug,
      title: guide.title,
      description: guide.description,
      url: `/guides/${guide.slug}/`,
      sections: splitTopicSections(guide.body),
    }));

  return {
    schemaVersion: REGISTRY_SCHEMA_VERSION,
    library: {
      name: 'Tecton Web Components',
      description:
        'Framework-independent Web Components (Lit + TypeScript) in the Tecton visual system. Tags and events use the tct- prefix.',
    },
    upstream: {name: '@astryxdesign/core', commit: manifest.baseline.commit},
    categories: [...CATEGORIES],
    components,
    hooks,
    topics,
    tokens: (inputs.tokens?.tokens ?? []).map(
      ({name, category, status, light, dark, description}) => ({
        name,
        category,
        status,
        light,
        dark,
        description,
      }),
    ),
    tokenCounts: inputs.tokens
      ? {tokens: inputs.tokens.counts.tokens, byStatus: inputs.tokens.counts.byStatus}
      : null,
  };
}

/** H2 sections of a guide body (MDX import lines and blank runs are dropped). */
function splitTopicSections(body: string): {heading: string; body: string}[] {
  const cleaned = body
    .split('\n')
    .filter((line) => !/^\s*import\s.+from\s.+;?\s*$/.test(line))
    .join('\n');
  const out: {heading: string; body: string}[] = [{heading: '', body: ''}];
  let fence = false;
  for (const line of cleaned.split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) fence = !fence;
    const heading = !fence ? /^##\s+(.+?)\s*$/.exec(line) : null;
    if (heading) out.push({heading: heading[1]!, body: ''});
    else out[out.length - 1]!.body += `${line}\n`;
  }
  return out
    .map((section) => ({heading: section.heading, body: section.body.trim()}))
    .filter((section) => section.heading !== '' || section.body !== '');
}

/** The registry as served on the public docs site: it never names the upstream design system. */
export interface PublicRegistry extends Omit<AgentRegistry, 'upstream' | 'hooks' | 'components'> {
  components: Omit<RegistryComponent, 'entries'>[];
}

function scrubStrings<T>(value: T): T {
  if (typeof value === 'string') return publicText(value) as T;
  if (Array.isArray(value)) return value.map((item) => scrubStrings(item as unknown)) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, inner]) => [key, scrubStrings(inner)]),
    ) as T;
  }
  return value;
}

/**
 * Public copy of the registry (apps/docs/public, llms.txt): no `upstream`, no upstream mapping tables or
 * hook lists (they stay in the internal registry and in the reports), token statuses use their public
 * labels, and prose that points at the upstream system is removed.
 */
export function toPublicRegistry(registry: AgentRegistry): PublicRegistry {
  const {upstream: _upstream, hooks: _hooks, components, tokens, ...rest} = registry;
  return scrubStrings({
    ...rest,
    components: components.map(({entries: _entries, ...component}) => component),
    tokens: tokens.map((token) => ({...token, status: tokenStatusLabel(token.status) as never})),
    tokenCounts: registry.tokenCounts
      ? {
          ...registry.tokenCounts,
          byStatus: Object.fromEntries(
            Object.entries(registry.tokenCounts.byStatus).map(([status, count]) => [
              tokenStatusLabel(status),
              count,
            ]),
          ),
        }
      : null,
  });
}
