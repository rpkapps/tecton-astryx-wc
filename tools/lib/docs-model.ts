/**
 * Component folder documentation model (CONVENTIONS §7, A§16): frontmatter, authored H2 sections,
 * example fragments and token usage of one `packages/components/src/<folder>/`. Shared by the docs
 * page generator, the parity report and the agent registry so they agree on what a folder documents.
 */
import {existsSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import {exemptionProblems, parseExampleHeader, type A11yExemption} from './example-header.ts';
import {readFrontmatter} from './frontmatter.ts';
import {isFile, listDirs, walkFiles} from './fs.ts';
import type {ParityFile} from './parity.ts';

/** Authored H2 sections every component page must have, in page order (CONVENTIONS §7). */
export const REQUIRED_SECTIONS = [
  'Purpose',
  'When to use',
  'Alternatives',
  'Anatomy',
  'Variants and states',
  'Responsive behaviour',
  'Form semantics',
  'Screen-reader expectations',
  'Localisation',
  'Consumer responsibilities',
] as const;
export type RequiredSection = (typeof REQUIRED_SECTIONS)[number];

export interface DocsFrontmatter {
  title: string;
  folder: string;
  category: string;
  entries: string[];
  summary: string;
  examples: string[];
  keywords: string[];
  dense: {
    description: string;
    usage: string;
    bestPractices: {do: boolean; text: string}[];
    properties: Record<string, string>;
  };
  related?: string[];
}

export interface DocSection {
  heading: string;
  /** Markdown between this H2 and the next (H3+ stay inside). */
  body: string;
}

export interface ExampleFile {
  id: string;
  /** Absolute path of `examples/<id>.html`. */
  file: string;
  title: string;
  description: string;
  /** Axe rules the docs accessibility crawl skips inside this example's preview, with the reason. */
  a11yExempt: A11yExemption | undefined;
  /** The fragment without its metadata comment. */
  source: string;
}

export interface ComponentDocs {
  folder: string;
  dir: string;
  docsFile: string | null;
  frontmatter: DocsFrontmatter | null;
  /** Markdown before the first H2. */
  preamble: string;
  sections: DocSection[];
  /** Examples in `frontmatter.examples` order, then any further files alphabetically. */
  examples: ExampleFile[];
  parity: ParityFile | null;
  /** Problems found while loading (bad frontmatter, missing example files). */
  problems: string[];
}

/** Splits a Markdown body on `## ` headings, ignoring headings inside fenced code blocks. */
export function splitSections(body: string): {preamble: string; sections: DocSection[]} {
  const preamble: string[] = [];
  const sections: DocSection[] = [];
  let fence: string | null = null;
  for (const line of body.replace(/\r\n?/g, '\n').split('\n')) {
    const fenceMatch = /^(\s*)(`{3,}|~{3,})/.exec(line);
    if (fenceMatch) {
      if (fence === null) fence = fenceMatch[2]!;
      else if (line.trim().startsWith(fence)) fence = null;
    }
    const heading = fence === null ? /^##\s+(.+?)\s*#*\s*$/.exec(line) : null;
    if (heading) sections.push({heading: heading[1]!, body: ''});
    else if (sections.length === 0) preamble.push(line);
    else sections[sections.length - 1]!.body += `${line}\n`;
  }
  for (const section of sections) section.body = section.body.trim();
  return {preamble: preamble.join('\n').trim(), sections};
}

export function missingSections(sections: readonly DocSection[]): string[] {
  const present = new Set(sections.filter((s) => s.body !== '').map((s) => s.heading));
  return REQUIRED_SECTIONS.filter((name) => !present.has(name));
}

/** The metadata comment on the first line (see tools/lib/example-header.ts) and the fragment after it. */
export function parseExample(id: string, file: string, text: string): ExampleFile {
  const header = parseExampleHeader(text);
  return {
    id,
    file,
    title: header?.title || id,
    description: header?.description ?? '',
    a11yExempt: header?.a11yExempt,
    source: (header ? text.slice(header.length) : text).trimEnd(),
  };
}

export function loadComponentDocs(componentsSrc: string, folder: string): ComponentDocs {
  const dir = join(componentsSrc, folder);
  const problems: string[] = [];
  const docsFile = join(dir, `${folder}.docs.md`);
  let frontmatter: DocsFrontmatter | null = null;
  let body = '';
  if (isFile(docsFile)) {
    try {
      const parsed = readFrontmatter(readFileSync(docsFile, 'utf8'));
      if (parsed) {
        frontmatter = parsed.data as unknown as DocsFrontmatter;
        body = parsed.body;
      } else {
        problems.push(`${folder}.docs.md: missing frontmatter`);
      }
    } catch (error) {
      problems.push(`${folder}.docs.md: ${(error as Error).message}`);
    }
  }
  const {preamble, sections} = splitSections(body);

  const exampleDir = join(dir, 'examples');
  const onDisk = new Map<string, string>();
  for (const file of walkFiles(exampleDir)) {
    if (file.endsWith('.html'))
      onDisk.set(file.slice(exampleDir.length + 1, -'.html'.length), file);
  }
  const order = [
    ...(frontmatter?.examples ?? []),
    ...[...onDisk.keys()].filter((id) => !(frontmatter?.examples ?? []).includes(id)).sort(),
  ];
  const examples: ExampleFile[] = [];
  for (const id of order) {
    const file = onDisk.get(id);
    if (!file) {
      problems.push(`${folder}.docs.md: example "${id}" has no examples/${id}.html`);
      continue;
    }
    const example = parseExample(id, file, readFileSync(file, 'utf8'));
    for (const problem of exemptionProblems(example.a11yExempt)) {
      problems.push(`examples/${id}.html: ${problem}`);
    }
    examples.push(example);
  }

  const parityFile = join(dir, 'parity.json');
  return {
    folder,
    dir,
    docsFile: isFile(docsFile) ? docsFile : null,
    frontmatter,
    preamble,
    sections,
    examples,
    parity: existsSync(parityFile)
      ? (JSON.parse(readFileSync(parityFile, 'utf8')) as ParityFile)
      : null,
    problems,
  };
}

/** Component family folders that have a `define.ts` (same rule as the barrel generator). */
export function componentFolderNames(componentsSrc: string): string[] {
  return listDirs(componentsSrc).filter(
    (name) =>
      !['generated', 'styles', '__snapshots__'].includes(name) &&
      isFile(join(componentsSrc, name, 'define.ts')),
  );
}

/**
 * Custom properties a folder's CSS reads through `var(--x)`, sorted, without private `--_x` aliases.
 * The docs classify them (design token, own `@cssprop`, unknown) against the token metadata.
 */
export function customPropertiesUsed(dir: string): string[] {
  const names = new Set<string>();
  for (const file of walkFiles(dir, {skipDirs: ['examples', '__snapshots__']})) {
    if (!/\.(styles|light)\.css$/.test(file)) continue;
    const css = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    for (const match of css.matchAll(/var\(\s*(--[A-Za-z0-9_-]+)/g)) names.add(match[1]!);
  }
  return [...names].filter((name) => !name.startsWith('--_')).sort();
}
