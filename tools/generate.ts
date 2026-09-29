/**
 * `pnpm generate`: regenerates every derived artifact (A§3). Runs first in test, typecheck, build,
 * docs and check. Generated files are gitignored and never edited by hand.
 *
 * Two kinds of steps:
 *  - built-in generators (barrels, define-all, autoloader map, core barrel): implemented here;
 *  - external steps owned by later milestones: a script that runs with `node <script>` when it
 *    exists and is skipped (with a message) otherwise. To hook a milestone in, create the script at
 *    the listed path; nothing here needs to change.
 *
 * `TCT_GENERATED=1` makes the command a no-op; `tools/check.ts` sets it after generating once.
 */
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {
  generateComponentsBarrels,
  generateCoreBarrel,
  type GeneratedFile,
} from './generators/barrels.ts';
import {writeIfChanged} from './lib/fs.ts';
import {PATHS, ROOT, rel} from './lib/paths.ts';
import {run} from './lib/run.ts';

interface ExternalStep {
  name: string;
  /** Script path relative to the repository root, run as `node <script>` when present. */
  script: string;
  milestone: string;
}

/**
 * Ordered hooks for the steps later milestones own. Order matters: tokens and locales feed icons and
 * the CEM; the CEM feeds cloak, docs pages and the parity report.
 */
export const EXTERNAL_STEPS_BEFORE_BARRELS: readonly ExternalStep[] = [
  {name: 'tokens', script: 'packages/tokens/scripts/generate.ts', milestone: 'M2'},
  {name: 'locales', script: 'packages/locales/scripts/generate.ts', milestone: 'M3'},
  {name: 'icons (Lucide extraction)', script: 'tools/icons/extract-lucide.ts', milestone: 'M3'},
  {name: 'icons (Tecton domain set)', script: 'tools/icons/extract-tecton.ts', milestone: 'D-013'},
];

export const EXTERNAL_STEPS_AFTER_BARRELS: readonly ExternalStep[] = [
  // Custom Elements Manifest (A§17) and the CEM-derived autoloader map. Everything below reads it.
  {name: 'custom-elements manifest', script: 'tools/cem/generate.ts', milestone: 'M6'},
  // cloak.css (CEM tags + @cloakDisplay), light-dom.css (glob *.light.css), tecton.css bundle.
  {name: 'cloak + light-dom css', script: 'tools/css/generate-shared.ts', milestone: 'M6'},
  // reports/parity.{json,md} (A§15.5); the docs "Parity status" page reads it.
  {name: 'parity report', script: 'tools/parity-report.ts', milestone: 'M6'},
  {name: 'i18n missing report', script: 'tools/i18n/report-missing.ts', milestone: 'M6'},
  // The agent registry (D-011): CEM + docs frontmatter keywords/dense/related + examples + tokens +
  // docs topics, read by the docs site and later by the `tct` CLI and MCP server (WP-AI). Also writes
  // llms.txt / llms-full.txt into apps/docs/public.
  {name: 'agent registry', script: 'tools/agent-registry/generate.ts', milestone: 'M6'},
  // Docs component pages, the parity / differences / tokens pages (A§16.2).
  {name: 'docs pages', script: 'tools/docs/generate.ts', milestone: 'M6'},
  // `astro:content` types (apps/docs/.astro): lint and typecheck read them before any docs build.
  {name: 'docs types (astro sync)', script: 'tools/docs/sync-types.ts', milestone: 'M6'},
];

function runExternal(step: ExternalStep): boolean {
  if (!existsSync(resolve(ROOT, step.script))) {
    console.log(`  skip  ${step.name} (${step.script} arrives in ${step.milestone})`);
    return true;
  }
  console.log(`  run   ${step.name} (${step.script})`);
  return run(process.execPath, [step.script]).status === 0;
}

function writeAll(files: readonly GeneratedFile[]): void {
  for (const file of files) {
    const changed = writeIfChanged(file.path, file.content);
    console.log(`  ${changed ? 'wrote' : 'same '} ${rel(file.path)}`);
  }
}

function main(): number {
  if (process.env.TCT_GENERATED === '1') {
    console.log('generate: already done for this run (TCT_GENERATED=1).');
    return 0;
  }
  console.log('generate');
  for (const step of EXTERNAL_STEPS_BEFORE_BARRELS) {
    if (!runExternal(step)) return 1;
  }
  try {
    writeAll(generateCoreBarrel(PATHS.coreSrc));
    writeAll(generateComponentsBarrels(PATHS.componentsSrc));
  } catch (error) {
    console.error(`generate: ${(error as Error).message}`);
    return 1;
  }
  for (const step of EXTERNAL_STEPS_AFTER_BARRELS) {
    if (!runExternal(step)) return 1;
  }
  return 0;
}

// Only run when executed directly, so tests can import the step tables.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  process.exit(main());
