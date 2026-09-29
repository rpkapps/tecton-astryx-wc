/**
 * Docs topics: stable section keys, section lookup and the text projections (full, compact, brief, dense).
 */
import type {RegistryTopic} from '../registry/types.ts';
import {firstSentence, truncate} from '../text.ts';

export interface TopicSection {
  /** Stable key: the slug of the heading (`introduction` for the text before the first heading). */
  id: string;
  title: string;
  body: string;
}

export const slugify = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[`*_~]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'section';

/** The readable sections of a topic with unique stable keys. */
export function topicSections(topic: RegistryTopic): TopicSection[] {
  const seen = new Map<string, number>();
  return topic.sections
    .filter((section) => section.body.trim() !== '' || section.heading !== '')
    .map((section) => {
      const base = section.heading ? slugify(section.heading) : 'introduction';
      const count = seen.get(base) ?? 0;
      seen.set(base, count + 1);
      return {
        id: count === 0 ? base : `${base}-${count + 1}`,
        title: section.heading || 'Introduction',
        body: section.body,
      };
    });
}

export type SectionMatch =
  | {kind: 'found'; section: TopicSection}
  | {kind: 'none'}
  | {kind: 'ambiguous'; candidates: TopicSection[]};

/** By stable key, then exact title, then a unique part of a title; an ambiguous query is refused. */
export function findSection(sections: readonly TopicSection[], query: string): SectionMatch {
  const wanted = query.trim().toLowerCase();
  const byKey = sections.find((section) => section.id === wanted || section.id === slugify(query));
  if (byKey) return {kind: 'found', section: byKey};
  const byTitle = sections.filter((section) => section.title.toLowerCase() === wanted);
  if (byTitle.length === 1) return {kind: 'found', section: byTitle[0]!};
  const partial = sections.filter((section) => section.title.toLowerCase().includes(wanted));
  if (partial.length === 1) return {kind: 'found', section: partial[0]!};
  if (partial.length > 1) return {kind: 'ambiguous', candidates: partial};
  return {kind: 'none'};
}

/** Code blocks longer than this are cut in the compact and dense projections. */
const DENSE_CODE_LINES = 8;

/** Markdown table rows as `a = b = c` lines (no separator row, no pipes). */
function compactTables(lines: string[]): string[] {
  const out: string[] = [];
  for (const line of lines) {
    if (/^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line)) continue;
    if (/^\s*\|.*\|\s*$/.test(line)) {
      const cells = line
        .trim()
        .replace(/^\||\|$/g, '')
        .split(/(?<!\\)\|/)
        .map((cell) => cell.replace(/\\\|/g, '|').trim());
      out.push(cells.join(' = '));
    } else {
      out.push(line);
    }
  }
  return out;
}

/**
 * The token-efficient projection of a topic body: tables become `a = b` rows, admonition fences become plain
 * labels, MDX comments and blank runs are dropped, and long code blocks are cut to their first lines.
 */
export function denseBody(body: string): string {
  const lines = body.split('\n');
  const out: string[] = [];
  let fence: {lines: number} | null = null;
  for (const line of lines) {
    if (/^\s*(```|~~~)/.test(line)) {
      if (fence) {
        if (fence.lines > DENSE_CODE_LINES) out.push('...');
        out.push('```');
        fence = null;
      } else {
        fence = {lines: 0};
        out.push(line.trim());
      }
      continue;
    }
    if (fence) {
      fence.lines++;
      if (fence.lines <= DENSE_CODE_LINES) out.push(line);
      continue;
    }
    if (/^\s*\{\/\*[\s\S]*\*\/\}\s*$/.test(line)) continue;
    const admonition = /^:::(\w+)(?:\[(.*)\])?\s*$/.exec(line.trim());
    if (admonition) {
      out.push(`${admonition[2] ?? admonition[1]}:`);
      continue;
    }
    if (line.trim() === ':::') continue;
    out.push(line.replace(/\s+$/, ''));
  }
  return compactTables(out)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Prose only: code blocks removed (brief and compact levels). */
function withoutCode(body: string): string {
  return body
    .replace(/^\s*(```|~~~)[\s\S]*?^\s*\1\s*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export type DocsDetail = 'brief' | 'compact' | 'full';

export function renderSection(section: TopicSection, detail: DocsDetail, dense: boolean): string {
  if (dense) return `## ${section.title}\n\n${denseBody(section.body)}`.trimEnd();
  if (detail === 'brief') return `${section.title}: ${firstSentence(withoutCode(section.body))}`;
  if (detail === 'compact')
    return `[${section.title}]\n\n${compactTables(withoutCode(section.body).split('\n')).join('\n')}`.trimEnd();
  return `## ${section.title}\n\n${section.body}`.trimEnd();
}

export function renderTopic(topic: RegistryTopic, detail: DocsDetail, dense: boolean): string {
  const sections = topicSections(topic);
  const rendered = sections.map((section) => renderSection(section, detail, dense));
  if (detail === 'brief' && !dense)
    return [`${topic.title}: ${topic.description}`, ...rendered].join('\n');
  const head = dense
    ? `# ${topic.title}\n${truncate(topic.description, 160)}`
    : `# ${topic.title}\n\n${topic.description}`;
  return [head, ...rendered].join('\n\n');
}
