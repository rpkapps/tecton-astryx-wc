/**
 * `pnpm generate` step (D-011 prerequisite for WP-AI): writes
 *
 *   packages/components/agent-registry.json     the registry (gitignored; a request asks the orchestrator to
 *                                               export it as `@tecton-astryx/components/agent-registry.json`)
 *   apps/docs/public/agent-registry.json        the same file, served by the docs site (MCP HTTP route, CLI)
 *   apps/docs/public/llms.txt, llms-full.txt    the llms.txt pair, copied into the docs build
 */
import {existsSync, readFileSync, readdirSync} from 'node:fs';
import {join} from 'node:path';
import {loadCem} from '../lib/cem.ts';
import {componentFolderNames} from '../lib/docs-model.ts';
import {readFrontmatter} from '../lib/frontmatter.ts';
import {writeIfChanged} from '../lib/fs.ts';
import {loadManifest} from '../lib/parity.ts';
import {PATHS, rel} from '../lib/paths.ts';
import {DOCS_PUBLIC, GUIDES_DIR} from '../lib/site.ts';
import {loadTokens} from '../lib/tokens.ts';
import {buildRegistry, type GuideInput} from './build.ts';
import {renderLlmsFull, renderLlmsTxt} from './llms.ts';

const cem = loadCem(join(PATHS.components, 'custom-elements.json'));
if (!cem) {
  console.error('agent-registry: custom-elements.json is missing; the CEM step must run first.');
  process.exit(1);
}

/** Authored guides (`guides/<topic>.mdx`, plain Starlight frontmatter), written by WP-D. */
function readGuides(): GuideInput[] {
  if (!existsSync(GUIDES_DIR)) return [];
  const guides: GuideInput[] = [];
  for (const name of readdirSync(GUIDES_DIR).sort()) {
    if (!/\.mdx?$/.test(name) || name.startsWith('_')) continue;
    const file = join(GUIDES_DIR, name);
    try {
      const parsed = readFrontmatter(readFileSync(file, 'utf8'));
      const data = parsed?.data ?? {};
      const sidebar = data.sidebar as {order?: number} | undefined;
      guides.push({
        slug: name.replace(/\.mdx?$/, ''),
        title: typeof data.title === 'string' ? data.title : name.replace(/\.mdx?$/, ''),
        description: typeof data.description === 'string' ? data.description : '',
        order: typeof sidebar?.order === 'number' ? sidebar.order : 1000,
        body: parsed?.body ?? readFileSync(file, 'utf8'),
      });
    } catch (error) {
      console.warn(`  agent-registry: skipped ${rel(file)}: ${(error as Error).message}`);
    }
  }
  return guides;
}

const registry = buildRegistry({
  cem,
  componentsSrc: PATHS.componentsSrc,
  folders: componentFolderNames(PATHS.componentsSrc),
  manifest: loadManifest(PATHS.manifest),
  ...(loadTokens() ? {tokens: loadTokens()!} : {}),
  guides: readGuides(),
});

const json = `${JSON.stringify(registry, null, 2)}\n`;
const outputs: [string, string][] = [
  [join(PATHS.components, 'agent-registry.json'), json],
  [join(DOCS_PUBLIC, 'agent-registry.json'), json],
  [join(DOCS_PUBLIC, 'llms.txt'), renderLlmsTxt(registry)],
  [join(DOCS_PUBLIC, 'llms-full.txt'), renderLlmsFull(registry)],
];
for (const [path, content] of outputs) writeIfChanged(path, content);
console.log(
  `  registry: ${registry.components.length} component(s), ${registry.topics.length} topic(s), ` +
    `${registry.tokens.length} token(s) -> ${outputs.map(([path]) => rel(path)).join(', ')}`,
);
