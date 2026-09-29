/**
 * `pnpm size` (A§18.4): bundles the measured entries into `reports/size/` (tools/size/build-entries.ts:
 * shared runtime, autoloader and one file per component family, lit included) and runs size-limit over
 * them with the budgets from `reports/size/budgets.json`. The measured numbers are also written to
 * `reports/size/measured.json`.
 */
import {join} from 'node:path';
import {ROOT} from '../lib/paths.ts';
import {run} from '../lib/run.ts';
import {buildSizeEntries} from './build-entries.ts';

const measured = await buildSizeEntries();
for (const row of measured) {
  console.log(
    `  bundled ${row.entry.padEnd(28)} ${(row.bytes / 1000).toFixed(2)} kB raw, ` +
      `${(row.gzip / 1000).toFixed(2)} kB gzip, ${(row.brotli / 1000).toFixed(2)} kB brotli (budget ${row.budgetKb} kB)`,
  );
}
process.exit(run(join(ROOT, 'node_modules', '.bin', 'size-limit'), []).status);
