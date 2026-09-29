import {spawnSync} from 'node:child_process';
import {ROOT} from './paths.ts';

export interface RunResult {
  status: number;
}

/** Runs a command in the repository root with inherited stdio. Never throws; returns the exit status. */
export function run(
  command: string,
  args: readonly string[],
  options: {env?: Record<string, string | undefined>; cwd?: string} = {},
): RunResult {
  const result = spawnSync(command, [...args], {
    cwd: options.cwd ?? ROOT,
    stdio: 'inherit',
    env: {...process.env, ...options.env},
  });
  if (result.error) {
    console.error(`Failed to start ${command}: ${result.error.message}`);
    return {status: 127};
  }
  return {status: result.status ?? 1};
}
