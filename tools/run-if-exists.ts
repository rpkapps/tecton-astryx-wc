/**
 * `node tools/run-if-exists.ts <required-path> -- <command> [args...]`
 *
 * Runs the command only when `<required-path>` exists (relative to the repository root); otherwise
 * prints a skip message and exits 0. Root scripts that belong to later milestones (tokens:check,
 * api:check, size, docs:*, build) use this so `pnpm check` stays green until their inputs exist.
 */
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {run} from './lib/run.ts';
import {ROOT} from './lib/paths.ts';

const argv = process.argv.slice(2);
const separator = argv.indexOf('--');
if (separator < 1 || separator === argv.length - 1) {
  console.error('usage: node tools/run-if-exists.ts <required-path> -- <command> [args...]');
  process.exit(2);
}

const required = argv[0]!;
const [command, ...args] = argv.slice(separator + 1) as [string, ...string[]];

if (!existsSync(resolve(ROOT, required))) {
  console.log(`skip: ${required} does not exist yet (later WP-F milestone); nothing to run.`);
  process.exit(0);
}
process.exit(run(command, args).status);
