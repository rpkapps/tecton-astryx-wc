/**
 * `@tecton-wc/cli`: the programmatic surface. `execute` runs a `tct` command in-process (no subprocess) and
 * returns what it printed and its exit code, which is what the agent-eval harness and build tools use; the
 * rest are the building blocks the commands and the MCP server are made of.
 */
import {run} from './cli.ts';
import type {Io} from './command.ts';

export {run, COMMANDS, VERSION} from './cli.ts';
export type {CommandSpec, Io, Outcome} from './command.ts';
export {ERROR_CODES, CliError} from './errors.ts';
export {loadRegistry, locateRegistry, assertRegistry} from './registry/load.ts';
export type {LoadedRegistry} from './registry/load.ts';
export type {AgentRegistry} from './registry/types.ts';
export {RegistryLookup} from './registry/lookup.ts';
export {search, SEARCH_DOMAINS} from './search.ts';
export {callTool, mcpGet, mcpSearch} from './mcp/tools.ts';
export {createMcpServer} from './mcp/server.ts';
export {handleMcpRequest} from './mcp/http.ts';
export {API_VERSION, isError, parseResponse, assertResponse} from './json.ts';

export interface ExecuteResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

/** Runs `tct <argv>` in-process in `cwd` and captures its output. */
export async function execute(
  argv: readonly string[],
  options: {cwd?: string; env?: Record<string, string | undefined>; stdin?: string} = {},
): Promise<ExecuteResult> {
  let stdout = '';
  let stderr = '';
  const stdin = options.stdin;
  const io: Io = {
    cwd: options.cwd ?? process.cwd(),
    env: options.env ?? process.env,
    stdout: (text) => {
      stdout += text;
    },
    stderr: (text) => {
      stderr += text;
    },
    ...(stdin !== undefined ? {readStdin: () => Promise.resolve(stdin)} : {}),
  };
  const exitCode = await run(argv, io);
  return {exitCode, stdout, stderr};
}
