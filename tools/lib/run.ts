import {
  spawnSync,
  type SpawnSyncOptions,
  type SpawnSyncOptionsWithStringEncoding,
  type SpawnSyncReturns,
} from 'node:child_process';
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
