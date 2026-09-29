/**
 * `pnpm generate` step: `astro sync` for the docs site, which writes `apps/docs/.astro/` (gitignored),
 * the types behind `astro:content`. Lint and `tsc` read them, and they run before `docs:build`, so a
 * fresh clone needs them from `generate` rather than from a docs build.
 *
 * `TCT_GENERATED=1` stops the astro config from running `pnpm generate` again (we are inside it).
 */
import {join} from 'node:path';
import {ROOT} from '../lib/paths.ts';
import {run} from '../lib/run.ts';

const status = run('pnpm', ['exec', 'astro', 'sync'], {
  cwd: join(ROOT, 'apps/docs'),
  env: {TCT_GENERATED: '1'},
}).status;
process.exit(status);
