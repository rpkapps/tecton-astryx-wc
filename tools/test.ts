/**
 * `pnpm test [path...] [--watch]`: generates first (A§3), then runs Vitest (browser + node projects).
 * Any other arguments are passed through to Vitest (e.g. `pnpm test -t "Escape closes"`).
 */
import {run, runPackageBin} from './lib/run.ts';

const args = process.argv.slice(2).filter((arg) => arg !== '--');
const watch = args.includes('--watch') || args.includes('-w');

const generated = run(process.execPath, ['tools/generate.ts']);
if (generated.status !== 0) process.exit(generated.status);

const forwarded = args.filter((arg) => arg !== '--watch' && arg !== '-w');
process.exit(runPackageBin('vitest', [watch ? 'watch' : 'run', ...forwarded]).status);
