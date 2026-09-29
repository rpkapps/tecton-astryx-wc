/**
 * `pnpm tokens:check` (A§5.6): input hashes, 1,820 palette names, D-001 spot checks, Astryx coverage
 * (258 names), token-name snapshot, Tailwind collision list, contrast matrix with contrast.allow.json,
 * provisional set, fonts. Prints every problem, exits 1 when any check fails.
 */
import {build} from '../src/pipeline/build.ts';
import {runChecks} from '../src/pipeline/checks.ts';
import {loadContrastInputs, SNAPSHOT_FILE, verifyInputHashes} from '../src/pipeline/inputs.ts';

function main(): number {
  const inputProblems = verifyInputHashes();
  let result;
  try {
    result = build();
  } catch (error) {
    console.error(`tokens:check FAILED while building: ${(error as Error).message}`);
    return 1;
  }
  const checks = runChecks(result, inputProblems, SNAPSHOT_FILE, loadContrastInputs());
  let failed = 0;
  for (const check of checks) {
    if (check.problems.length === 0) {
      console.log(`  ok    ${check.name}${check.note ? ` (${check.note})` : ''}`);
    } else {
      failed++;
      console.log(`  FAIL  ${check.name}`);
      for (const problem of check.problems) console.log(`        - ${problem}`);
    }
  }
  console.log(
    failed === 0
      ? '\ntokens:check passed'
      : `\ntokens:check FAILED (${failed} of ${checks.length} checks)`,
  );
  return failed === 0 ? 0 : 1;
}

process.exit(main());
