/**
 * `pnpm test [path...] [--watch]`: generates first (A§3), then runs Vitest (browser + node projects).
 * Any other arguments are passed through to Vitest (e.g. `pnpm test -t "Escape closes"`).
 */
import {join} from 'node:path';
import {ROOT} from './lib/paths.ts';
import {run} from './lib/run.ts';

const args = process.argv.slice(2).filter((arg) => arg !== '--');
const watch = args.includes('--watch') || args.includes('-w');

const generated = run('node', ['tools/generate.ts']);
if (generated.status !== 0) process.exit(generated.status);

const vitest = join(ROOT, 'node_modules', '.bin', 'vitest');
const forwarded = args.filter((arg) => arg !== '--watch' && arg !== '-w');
process.exit(run(vitest, [watch ? 'watch' : 'run', ...forwarded]).status);
