/**
 * `pnpm check`: everything, in order, stopping at the first failure (A§18.3).
 *
 *   generate -> format:check -> typecheck -> lint -> lint:css -> tokens:check -> api:check ->
 *   parity:check -> examples:check -> licenses:check -> test -> build -> size -> docs:build -> docs:a11y
 *
 * Steps that belong to later milestones skip themselves (with a message) until their inputs exist,
 * so this stays green from M1 onwards. Generation runs once; later steps see TCT_GENERATED=1.
 */
import {run} from './lib/run.ts';

const STEPS: readonly string[] = [
  'generate',
  'format:check',
  // Before lint: typed lint rules read the referenced projects' declarations in .tsbuild, which
  // `tsc -b` writes. Stale or missing declarations (a fresh clone, or a merge that changed core)
  // turn imported types into `any` and fail no-unsafe-* rules.
  'typecheck',
  'lint',
  'lint:css',
  'tokens:check',
  'api:check',
  'parity:check',
  // Examples lay content out with the library's components, never hand-written CSS (owner rule).
  'examples:check',
  'licenses:check',
  'test',
  'build',
  'size',
  'docs:build',
  'docs:a11y',
];

const results: {step: string; seconds: number; ok: boolean}[] = [];
const env: Record<string, string | undefined> = {};

for (const step of STEPS) {
  console.log(`\n=== pnpm ${step} ${'='.repeat(Math.max(0, 60 - step.length))}`);
  const started = performance.now();
  const {status} = run('pnpm', ['run', step], {env});
  results.push({step, seconds: (performance.now() - started) / 1000, ok: status === 0});
  if (status !== 0) break;
  if (step === 'generate') env.TCT_GENERATED = '1';
}

console.log('\n--- check summary ---');
for (const {step, seconds, ok} of results) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${step.padEnd(16)} ${seconds.toFixed(1)}s`);
}
const failed = results.find((result) => !result.ok);
if (failed) {
  console.log(`\npnpm check FAILED at "${failed.step}".`);
  process.exit(1);
}
console.log(`\npnpm check PASSED (${results.length} steps).`);
