/**
 * size-limit config (A§18.4), computed at run time. Milestone M6's `tools/size/build-entries.ts`
 * bundles every `<folder>/define.js` (lit and core included) into `reports/size/` and writes
 * `reports/size/budgets.json` (`{"<entry>.js": <kB>}`; kB from `parity.json.sizeBudgetKb` or the
 * complexity default). This file turns that directory into size-limit entries. Until then it yields
 * no entries and `pnpm size` skips (see tools/size/run.ts).
 */
import {existsSync, readFileSync, readdirSync} from 'node:fs';
import {join} from 'node:path';

const dir = join(import.meta.dirname, 'reports', 'size');
const budgetsFile = join(dir, 'budgets.json');
const budgets = existsSync(budgetsFile) ? JSON.parse(readFileSync(budgetsFile, 'utf8')) : {};

export default existsSync(dir)
  ? readdirSync(dir)
      .filter((name) => name.endsWith('.js'))
      .sort()
      .map((name) => ({
        name,
        path: join('reports', 'size', name),
        gzip: true,
        ...(budgets[name] === undefined ? {} : {limit: `${budgets[name]} kB`}),
      }))
  : [];
