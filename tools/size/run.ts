/**
 * `pnpm size` (A§18.4). M1 hook: runs size-limit over `reports/size/` when M6's build step has
 * produced entries there, and skips (exit 0) otherwise. M6 adds `tools/size/build-entries.ts` and
 * calls it from here before size-limit.
 */
import {existsSync, readdirSync} from 'node:fs';
import {join} from 'node:path';
import {ROOT} from '../lib/paths.ts';
import {run} from '../lib/run.ts';

const dir = join(ROOT, 'reports', 'size');
const entries = existsSync(dir) ? readdirSync(dir).filter((name) => name.endsWith('.js')) : [];

// TODO(M6): run tools/size/build-entries.ts first so reports/size/ is fresh.
if (entries.length === 0) {
  console.log(
    'skip: no bundled entries in reports/size/ yet (size budgets arrive with milestone M6).',
  );
  process.exit(0);
}
process.exit(run(join(ROOT, 'node_modules', '.bin', 'size-limit'), []).status);
