import {
  spawnSync,
  type SpawnSyncOptions,
  type SpawnSyncOptionsWithStringEncoding,
  type SpawnSyncReturns,
} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {dirname, join} from 'node:path';
import {ROOT} from './paths.ts';

/**
 * How to start pnpm on every platform. On Windows `pnpm` is a `pnpm.cmd` shim, which Node refuses to
 * spawn without a shell (EINVAL/ENOENT), so `pnpm check` failed at its first step there. When a script
 * runs under pnpm, `npm_execpath` is pnpm's own JavaScript entry: run it with this Node directly, no
 * shell and no quoting. Otherwise fall back to the shim (through a shell on Windows).
 */
export function pnpmCommand(args: readonly string[]): {
  command: string;
  args: string[];
  shell: boolean;
} {
  const entry = process.env.npm_execpath;
  if (entry && /pnpm/i.test(entry) && /\.[cm]?js$/i.test(entry)) {
    return {command: process.execPath, args: [entry, ...args], shell: false};
  }
  return {command: 'pnpm', args: [...args], shell: process.platform === 'win32'};
}

/** `spawnSync` for pnpm with the platform handling of `pnpmCommand`. */
export function spawnPnpmSync(
  args: readonly string[],
  options: SpawnSyncOptionsWithStringEncoding,
): SpawnSyncReturns<string>;
export function spawnPnpmSync(
  args: readonly string[],
  options?: SpawnSyncOptions,
): SpawnSyncReturns<string | Buffer>;
export function spawnPnpmSync(
  args: readonly string[],
  options: SpawnSyncOptions = {},
): SpawnSyncReturns<string | Buffer> {
  const {command, args: argv, shell} = pnpmCommand(args);
  return spawnSync(command, argv, {...options, shell});
}

export interface RunResult {
  status: number;
}

/** Runs a command in the repository root with inherited stdio. Never throws; returns the exit status. */
export function run(
  command: string,
  args: readonly string[],
  options: {env?: Record<string, string | undefined>; cwd?: string} = {},
): RunResult {
  const launch = command === 'pnpm' ? pnpmCommand(args) : {command, args: [...args], shell: false};
  const result = spawnSync(launch.command, launch.args, {
    cwd: options.cwd ?? ROOT,
    stdio: 'inherit',
    env: {...process.env, ...options.env},
    shell: launch.shell,
  });
  if (result.error) {
    console.error(`Failed to start ${command}: ${result.error.message}`);
    return {status: 127};
  }
  return {status: result.status ?? 1};
}

/**
 * The JavaScript entry of a dependency's command (its package.json `bin`), resolved from the repository
 * root. Running `node_modules/.bin/<name>` directly works only on POSIX: on Windows `.bin` holds a shell
 * script plus `.cmd`/`.ps1` shims, so the build failed at its first `tsc` ("tsc failed for
 * @tecton-wc/locales"). Running the entry with this Node works everywhere.
 */
export function packageBin(packageName: string, binName: string = packageName): string {
  const require = createRequire(join(ROOT, 'package.json'));
  const manifestPath = require.resolve(`${packageName}/package.json`);
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
    bin?: string | Record<string, string>;
  };
  const entry = typeof manifest.bin === 'string' ? manifest.bin : manifest.bin?.[binName];
  if (!entry) throw new Error(`${packageName} has no "${binName}" command`);
  return join(dirname(manifestPath), entry);
}

/** Runs a dependency's command (see `packageBin`) with this Node. */
export function runPackageBin(
  packageName: string,
  args: readonly string[],
  options: {env?: Record<string, string | undefined>; cwd?: string; binName?: string} = {},
): RunResult {
  return run(process.execPath, [packageBin(packageName, options.binName), ...args], options);
}
