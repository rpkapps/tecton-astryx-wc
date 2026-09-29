/**
 * `pnpm generate` step (A§16.2): writes the generated docs pages under
 * `apps/docs/src/content/docs/` (all gitignored):
 *
 *   components/index.mdx                      overview of the 11 categories
 *   components/<category>/index.mdx           one overview per category
 *   components/<category>/<folder>.mdx        one page per documented component folder
 *   reference/tokens.mdx                      packages/tokens/dist/tokens.json
 *
 * Authored guides (`guides/`) belong to WP-D and are never touched. A folder with a `<folder>.docs.md`
 * must have every required authored section and valid frontmatter, otherwise generation fails.
 */
import {existsSync, mkdirSync, readFileSync, readdirSync, rmSync} from 'node:fs';
import {basename, dirname, join} from 'node:path';
import {cemElements, loadCem} from '../lib/cem.ts';
import {
  REQUIRED_SECTIONS,
  componentFolderNames,
  customPropertiesUsed,
  loadComponentDocs,
  missingSections,
} from '../lib/docs-model.ts';
import {walkFiles, writeIfChanged} from '../lib/fs.ts';
import {checkParity, discoverParityFiles, loadManifest, loadSchema} from '../lib/parity.ts';
import {PATHS, ROOT, rel} from '../lib/paths.ts';
import {
  CATEGORIES,
  COMPONENT_PAGES_DIR,
  GUIDES_DIR,
  REFERENCE_PAGES_DIR,
  categorySlug,
} from '../lib/site.ts';
import {loadTokens} from '../lib/tokens.ts';
import {flatten, parseFolderMessages, type UpstreamCatalog} from '../../packages/locales/scripts/lib.ts';
import {differencesReport, parseOpenQuestions} from './internal-reports.ts';
import {COMPONENT_SECTION_ORDER, DocsError, renderComponentPage} from './component-page.ts';
import {
  categoryPage,
  componentsOverviewPage,
  tokensPage,
  type PageIndex,
} from './site-pages.ts';

const errors: string[] = [];
const outputs = new Map<string, string>();

const cem = loadCem(join(PATHS.components, 'custom-elements.json'));
if (!cem) {
  console.error('docs: custom-elements.json is missing; the CEM step must run first.');
  process.exit(1);
}
const tokenData = loadTokens();
const tokensByName = new Map((tokenData?.tokens ?? []).map((token) => [token.name, token]));

// English text of message ids: upstream catalog plus every folder's messages.json.
const english: Record<string, string> = {};
const enCatalog = join(ROOT, 'packages/locales/src/catalogs/en.json');
if (existsSync(enCatalog)) {
  Object.assign(english, flatten(JSON.parse(readFileSync(enCatalog, 'utf8')) as UpstreamCatalog));
}
for (const folder of componentFolderNames(PATHS.componentsSrc)) {
  const file = join(PATHS.componentsSrc, folder, `${folder}.messages.json`);
  if (existsSync(file)) {
    Object.assign(english, parseFolderMessages(folder, JSON.parse(readFileSync(file, 'utf8')) as unknown, file));
  }
}

/** Message ids the folder's source refers to. */
function messageIds(dir: string): string[] {
  const ids = new Set<string>();
  for (const file of walkFiles(dir, {skipDirs: ['examples', '__snapshots__']})) {
    if (!file.endsWith('.ts') || /\.(?:node\.)?test\.ts$/.test(file) || file.endsWith('.d.ts')) continue;
    for (const match of readFileSync(file, 'utf8').matchAll(/['"`](@(?:astryx|tct)\.[A-Za-z0-9_.-]+)['"`]/g)) {
      ids.add(match[1]!);
    }
  }
  return [...ids].sort();
}

const pages = new Map<string, {category: string; title: string; summary: string; tags: string[]}>();
const elementsByFolder = new Map<string, ReturnType<typeof cemElements>>();
for (const element of cemElements(cem)) {
  if (element.folder) elementsByFolder.set(element.folder, [...(elementsByFolder.get(element.folder) ?? []), element]);
}

for (const folder of componentFolderNames(PATHS.componentsSrc)) {
  const docs = loadComponentDocs(PATHS.componentsSrc, folder);
  if (!docs.docsFile) {
    console.log(`  docs: ${folder} has no ${folder}.docs.md yet; no page`);
    continue;
  }
  const where = `${folder}/${folder}.docs.md`;
  for (const problem of docs.problems) errors.push(`${where}: ${problem}`);
  if (!docs.frontmatter) continue;
  if (!(CATEGORIES as readonly string[]).includes(docs.frontmatter.category)) {
    errors.push(`${where}: category "${docs.frontmatter.category}" is not one of the 11 upstream categories`);
    continue;
  }
  const missing = missingSections(docs.sections);
  if (missing.length > 0) {
    errors.push(
      `${where}: missing required section(s) ${missing.map((name) => `"## ${name}"`).join(', ')} ` +
        `(write "Not applicable." with one sentence why, rather than omitting)`,
    );
    continue;
  }
  const elements = elementsByFolder.get(folder) ?? [];
  if (elements.length === 0) {
    errors.push(`${where}: the folder defines no element (no tct-*.ts class with a tag in the CEM)`);
    continue;
  }

  try {
    const content = renderComponentPage({
      docs,
      elements,
      cssVariables: customPropertiesUsed(docs.dir),
      tokens: tokensByName,
      messages: messageIds(docs.dir).map((id) => ({id, english: english[id]})),
      classFiles: elements.map((element) => ({
        className: element.declaration.name,
        file: basename(element.module.path, '.ts'),
      })),
    });
    const headings = [...content.matchAll(/^## (.+)$/gm)].map((match) => match[1]!);
    const generated = headings.filter((heading) => (COMPONENT_SECTION_ORDER as readonly string[]).includes(heading));
    if (generated.join('|') !== COMPONENT_SECTION_ORDER.join('|')) {
      throw new DocsError(`${folder}: page sections are ${generated.join(', ')}; expected ${COMPONENT_SECTION_ORDER.join(', ')}`);
    }
    const category = docs.frontmatter.category;
    outputs.set(join(COMPONENT_PAGES_DIR, categorySlug(category), `${folder}.mdx`), content);
    pages.set(folder, {
      category,
      title: docs.frontmatter.title,
      summary: docs.frontmatter.summary,
      tags: elements.map((element) => element.tagName),
    });
  } catch (error) {
    errors.push(`${where}: ${(error as Error).message}`);
  }
}

const index: PageIndex = pages;
outputs.set(join(COMPONENT_PAGES_DIR, 'index.mdx'), componentsOverviewPage(index));
for (const category of CATEGORIES) {
  outputs.set(join(COMPONENT_PAGES_DIR, categorySlug(category), 'index.mdx'), categoryPage(category, index));
}

// Reference: the token reference is public. Parity status and differences are internal reports
// (the upstream design system's name is not printed on the public site).
outputs.set(join(REFERENCE_PAGES_DIR, 'tokens.mdx'), tokensPage(tokenData));

const {parity} = checkParity({
  manifest: loadManifest(PATHS.manifest),
  schema: loadSchema(PATHS.paritySchema),
  docsSchema: loadSchema(PATHS.docsFrontmatterSchema),
  files: discoverParityFiles(ROOT),
});
const questionsFile = join(ROOT, 'docs/plan/OPEN-QUESTIONS.md');
const openQuestions = existsSync(questionsFile) ? parseOpenQuestions(readFileSync(questionsFile, 'utf8')) : [];
const internalReport = join(PATHS.reports, 'differences.md');

if (errors.length > 0) {
  for (const message of errors) console.error(`docs: ${message}`);
  console.error(`\ndocs: ${errors.length} problem(s); no pages were written.`);
  process.exit(1);
}

// Public pages must not name the upstream design system. Generated pages are scrubbed by the templates;
// this reports what is left (authored guides and docs.md prose), so nothing slips through unseen.
const PACKAGE_NAME = /@tecton-astryx/g;
const leaks: string[] = [];
const scan = (file: string, content: string) => {
  const count = (content.replace(PACKAGE_NAME, '').match(/astryx/gi) ?? []).length;
  if (count > 0) leaks.push(`${rel(file)}: ${count}`);
};
for (const [file, content] of outputs) scan(file, content);
for (const file of walkFiles(GUIDES_DIR)) {
  if (/\.mdx?$/.test(file)) scan(file, readFileSync(file, 'utf8'));
}

let written = 0;
mkdirSync(PATHS.reports, {recursive: true});
if (writeIfChanged(internalReport, `${differencesReport({parity, tokens: tokenData, openQuestions})}\n`)) written++;
for (const [path, content] of outputs) {
  if (writeIfChanged(path, content)) written++;
}
// Remove generated pages that no longer have a source (a renamed or deleted folder).
let removed = 0;
for (const dir of [COMPONENT_PAGES_DIR, REFERENCE_PAGES_DIR]) {
  for (const file of walkFiles(dir)) {
    if (file.endsWith('.mdx') && !outputs.has(file)) {
      rmSync(file);
      removed++;
      // Drop the category folder when nothing is left in it.
      if (readdirSync(dirname(file)).length === 0) rmSync(dirname(file), {recursive: true});
    }
  }
}
if (leaks.length > 0) {
  console.warn(
    `  docs: WARNING the public site still names the upstream design system in ${leaks.length} file(s) ` +
      `(count per file): ${leaks.join(', ')}`,
  );
}
console.log(
  `  docs: ${pages.size} component page(s), ${outputs.size} generated page(s) ` +
    `(${written} written, ${removed} removed) -> ${rel(join(PATHS.components, '..', '..', 'apps/docs/src/content/docs'))}; ` +
    `required sections: ${REQUIRED_SECTIONS.length}`,
);
