/**
 * The `tct` program: parse, dispatch, render. `run(argv, io)` returns the exit code and never calls
 * `process.exit`, so tests and the MCP tools drive it in-process.
 *
 * Exit-code policy (the contract CI and agents read before any text):
 *  1. any user-visible error exits 1, in `--json` and text mode alike;
 *  2. "did you mean" suggestions are still errors;
 *  3. help and version exit 0;
 *  4. a bare command with a sensible default (`tct component`) lists and exits 0.
 *
 * JSON contract: every emission in `--json` mode is one valid envelope on stdout (success
 * `{apiVersion, type, data, meta?}`, error `{apiVersion, error, code, suggestions?}`); stderr stays empty
 * on error; commands that do not support `--json` are rejected before any side effect.
 */
import {existsSync} from 'node:fs';
import {join} from 'node:path';
import {
  checkArguments,
  globalOptions,
  parseArguments,
  type CommandContext,
  type CommandSpec,
  type GlobalOptions,
  type Io,
  type Outcome,
} from './command.ts';
import {COMMANDS} from './commands/index.ts';
import {API_VERSION} from './json.ts';
import {ERROR_CODES, CliError, isErrorCode, type ErrorCode, type Suggestion} from './errors.ts';
import {buildManifest, commandHelp, programHelp} from './help.ts';
import {loadRegistry, type LoadedRegistry} from './registry/load.ts';
import {isInitialised} from './agent-docs/state.ts';
import {closest} from './text.ts';
import {VERSION} from './version.ts';

export {COMMANDS};

export {VERSION};

/** Options that take a value and are recognised before the command is known. */
const GLOBAL_VALUE_FLAGS = new Set(['--detail', '--registry']);

interface Resolved {
  spec: CommandSpec;
  path: string;
  /** argv with the command path tokens removed. */
  rest: string[];
}

/** Finds the command (and subcommand) named in `argv`; null when none is named. */
function resolveCommand(
  argv: readonly string[],
): Resolved | 'none' | {unknown: string; path: string; candidates: string[]} {
  const rest = [...argv];
  let level: readonly CommandSpec[] = COMMANDS;
  let spec: CommandSpec | undefined;
  const path: string[] = [];
  for (let index = 0; index < rest.length;) {
    const token = rest[index]!;
    if (token === '--') break;
    if (token.startsWith('-') && token !== '-') {
      index += GLOBAL_VALUE_FLAGS.has(token) ? 2 : 1;
      continue;
    }
    // A positional: a command name while we are still choosing one.
    if (spec && !spec.subcommands?.length) break;
    const candidates: readonly CommandSpec[] = level;
    const found: CommandSpec | undefined = candidates.find((command) => command.name === token);
    if (!found) {
      return {
        unknown: token,
        path: path.join(' '),
        candidates: candidates.map((command) => command.name),
      };
    }
    spec = found;
    path.push(token);
    rest.splice(index, 1);
    level = found.subcommands ?? [];
    if (!found.subcommands?.length) break;
  }
  if (!spec) return 'none';
  return {spec, path: path.join(' '), rest};
}

function envelope(outcome: Pick<Outcome, 'type' | 'data' | 'meta'>): string {
  const body: Record<string, unknown> = {
    apiVersion: API_VERSION,
    type: outcome.type,
    data: outcome.data,
  };
  if (outcome.meta !== undefined) body.meta = outcome.meta;
  return JSON.stringify(body, null, 2);
}

function errorEnvelope(message: string, code: ErrorCode, suggestions: Suggestion[]): string {
  const body: Record<string, unknown> = {apiVersion: API_VERSION, error: message, code};
  if (suggestions.length > 0) body.suggestions = suggestions;
  return JSON.stringify(body, null, 2);
}

/** Writes an error the way the mode demands and returns exit code 1. */
function fail(io: Io, json: boolean, error: unknown): number {
  const tct = error instanceof CliError ? error : null;
  const message = error instanceof Error ? error.message : String(error);
  const carried = (error as {code?: unknown} | null)?.code;
  const code: ErrorCode = tct ? tct.code : isErrorCode(carried) ? carried : ERROR_CODES.ERR_UNKNOWN;
  const suggestions = tct?.suggestions ?? [];
  if (json) {
    io.stdout(`${errorEnvelope(message, code, suggestions)}\n`);
    return 1;
  }
  io.stderr(`Error: ${message}\n`);
  if (suggestions.length > 0) {
    io.stderr('\n');
    for (const suggestion of suggestions) {
      io.stderr(`  ${suggestion.name}${suggestion.reason ? `  (${suggestion.reason})` : ''}\n`);
    }
  }
  if (!tct && process.env.TCT_DEBUG === '1' && error instanceof Error)
    io.stderr(`${error.stack ?? ''}\n`);
  return 1;
}

/** Whether `argv` asks for JSON output (a raw scan: it must hold even when parsing itself fails). */
function wantsJson(argv: readonly string[]): boolean {
  const end = argv.indexOf('--');
  return (end === -1 ? argv : argv.slice(0, end)).includes('--json');
}

const NUDGE_EXEMPT = new Set(['init', 'help', 'manifest', 'mcp', 'doctor']);

/** One stderr line when the project has not run `tct init` yet (never in `--json`; opt out with TCT_NO_NUDGE). */
function setupNudge(io: Io, command: string, global: GlobalOptions): void {
  if (global.json || NUDGE_EXEMPT.has(command) || io.env.TCT_NO_NUDGE) return;
  try {
    if (!existsSync(join(io.cwd, 'package.json'))) return;
    if (isInitialised(io.cwd)) return;
    io.stderr(
      '\nNext step: run `tct init --features agents` to install the agent docs for this project.\n',
    );
  } catch {
    // The nudge never breaks a command.
  }
}

/** `tct help [command]` is `tct [command] --help`. */
function rewriteHelp(argv: readonly string[]): readonly string[] {
  for (let index = 0; index < argv.length;) {
    const token = argv[index]!;
    if (token.startsWith('-')) {
      index += GLOBAL_VALUE_FLAGS.has(token) ? 2 : 1;
      continue;
    }
    return token === 'help' ? [...argv.slice(0, index), ...argv.slice(index + 1), '--help'] : argv;
  }
  return argv;
}

export async function run(input: readonly string[], io: Io): Promise<number> {
  const argv = rewriteHelp(input);
  const json = wantsJson(argv);
  try {
    const resolved = resolveCommand(argv);

    if (resolved === 'none') {
      const parsed = parseArguments(argv, {options: [], args: [], name: 'tct'});
      if (parsed.version) {
        io.stdout(
          json ? `${envelope({type: 'version', data: {version: VERSION}})}\n` : `${VERSION}\n`,
        );
        return 0;
      }
      if (parsed.args.length > 0) {
        return fail(
          io,
          json,
          unknownCommand(
            parsed.args[0]!,
            COMMANDS.map((command) => command.name),
          ),
        );
      }
      if (json) {
        const manifest = buildManifest(COMMANDS, VERSION);
        io.stdout(
          `${envelope({
            type: 'help',
            data: {
              name: manifest.name,
              version: manifest.version,
              commands: manifest.commands.map((command) => command.name),
              jsonSupported: manifest.jsonSupported,
              manifest,
            },
          })}\n`,
        );
      } else {
        io.stdout(`${programHelp(COMMANDS, VERSION)}\n`);
      }
      return 0;
    }

    if ('unknown' in resolved) {
      const level = resolved.path ? 'subcommand' : 'command';
      const error = unknownCommand(resolved.unknown, resolved.candidates, level, resolved.path);
      return fail(io, json, error);
    }

    const {spec, path, rest} = resolved;
    const parsed = parseArguments(rest, spec);
    const global = globalOptions(parsed.options);

    if (parsed.help || (spec.subcommands?.length && !spec.run)) {
      const text = commandHelp(spec, path);
      io.stdout(
        json ? `${envelope({type: 'help', data: {command: path, help: text}})}\n` : `${text}\n`,
      );
      return 0;
    }
    if (parsed.version) {
      io.stdout(
        json ? `${envelope({type: 'version', data: {version: VERSION}})}\n` : `${VERSION}\n`,
      );
      return 0;
    }
    if (global.json && !spec.json) {
      // Rejected before any side effect.
      return fail(
        io,
        true,
        new CliError(
          `JSON output is not supported for the '${path}' command`,
          ERROR_CODES.ERR_INVALID_OPTION,
        ),
      );
    }
    if (!spec.run)
      return fail(io, json, new CliError(`'${path}' is not runnable.`, ERROR_CODES.ERR_UNKNOWN));
    checkArguments(spec, parsed.args);

    let loaded: LoadedRegistry | undefined;
    const context: CommandContext = {
      io,
      cwd: io.cwd,
      args: parsed.args,
      options: parsed.options,
      global,
      registry: () =>
        (loaded ??= loadRegistry({
          cwd: io.cwd,
          ...(global.registry ? {path: global.registry} : {}),
          env: io.env,
        })),
    };
    setupNudge(io, spec.name, global);
    const outcome = await spec.run(context);
    if (global.json) io.stdout(`${envelope(outcome)}\n`);
    else if (outcome.text)
      io.stdout(outcome.text.endsWith('\n') ? outcome.text : `${outcome.text}\n`);
    return outcome.exitCode ?? 0;
  } catch (error) {
    return fail(io, json, error);
  }
}

function unknownCommand(
  name: string,
  known: readonly string[],
  level: 'command' | 'subcommand' = 'command',
  parent = '',
): CliError {
  const close = closest(name, known, 3);
  const suggestions: Suggestion[] = (close.length > 0 ? close : [...known]).map((candidate) => ({
    name: parent ? `${parent} ${candidate}` : candidate,
    reason: close.length > 0 ? 'did you mean this?' : `available ${level}`,
  }));
  return new CliError(
    `unknown ${level} '${name}'`,
    level === 'command' ? ERROR_CODES.ERR_UNKNOWN_COMMAND : ERROR_CODES.ERR_UNKNOWN_SUBCOMMAND,
    suggestions,
  );
}
