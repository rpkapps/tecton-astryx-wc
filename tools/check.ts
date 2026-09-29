/**
 * `pnpm check`: everything, in order, stopping at the first failure (A§18.3).
 *
 *   generate -> format:check -> lint -> lint:css -> typecheck -> tokens:check -> api:check ->
 *   parity:check -> licenses:check -> test -> build -> size -> docs:build
 *
 * Steps that belong to later milestones skip themselves (with a message) until their inputs exist,
 * so this stays green from M1 onwards. Generation runs once; later steps see TCT_GENERATED=1.
 */
import {run} from './lib/run.ts';

const STEPS: readonly string[] = [
  'generate',
  'format:check',
  'lint',
  'lint:css',
  'typecheck',
  'tokens:check',
  'api:check',
  'parity:check',
  'licenses:check',
  'test',
  'build',
  'size',
  'docs:build',
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
