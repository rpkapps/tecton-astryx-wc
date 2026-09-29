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
];

export const EXTERNAL_STEPS_AFTER_BARRELS: readonly ExternalStep[] = [
  // TODO(M6): Custom Elements Manifest (analyzer + tools/cem plugins, A§17) -> components/custom-elements.json
  {name: 'custom-elements manifest', script: 'tools/cem/generate.ts', milestone: 'M6'},
  // TODO(M6): cloak.css (CEM tags + @cloakDisplay) and light-dom.css (glob *.light.css)
  {name: 'cloak + light-dom css', script: 'tools/css/generate-shared.ts', milestone: 'M6'},
  // TODO(M6): docs component pages, sidebar data, llms.txt (A§16.2)
  {name: 'docs pages', script: 'tools/docs/generate.ts', milestone: 'M6'},
  // TODO(WP-AI, D-011): the agent registry (CEM + docs frontmatter keywords/dense/related + examples +
  // tokens + docs topics) read by the CLI, the MCP server and the docs site. tools/lib/frontmatter.ts
  // already parses the frontmatter subset; WP-AI adds the script and its package under orchestrator
  // supervision (packages/cli is not created by WP-F).
  {name: 'agent registry', script: 'tools/agent-registry/generate.ts', milestone: 'WP-AI'},
  // TODO(M6): reports/parity.{json,md} beyond the M1 report, i18n-missing report
  {name: 'i18n missing report', script: 'tools/i18n/report-missing.ts', milestone: 'M6'},
];

function runExternal(step: ExternalStep): boolean {
  if (!existsSync(resolve(ROOT, step.script))) {
    console.log(`  skip  ${step.name} (${step.script} arrives in ${step.milestone})`);
    return true;
  }
  console.log(`  run   ${step.name} (${step.script})`);
  return run('node', [step.script]).status === 0;
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
