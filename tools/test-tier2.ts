/**
 * `pnpm test:tier2`: the Chromium browser tests with `TCT_TIER2=1` (Tier-2 degraded paths, ARCHITECTURE §1).
 * A script rather than an inline `TCT_TIER2=1 vitest …` so it also runs in cmd.exe on Windows.
 */
import {run} from './lib/run.ts';

const {status} = run(
  'pnpm',
  ['exec', 'vitest', 'run', '--project', 'browser-chromium', ...process.argv.slice(2)],
  {
    env: {TCT_TIER2: '1'},
  },
);
process.exitCode = status;
