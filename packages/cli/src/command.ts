/**
 * Command definitions and the argument parser.
 *
 * A command is data (name, arguments, options, examples, exit codes, response types) plus a `run` function
 * that returns an {@link Outcome}: the JSON envelope's `type`/`data` and the human text projection of the
 * same data. One definition feeds `--help`, the capability manifest and the docs, so they cannot drift.
 */
import {ERROR_CODES, CliError, type ErrorCode} from './errors.ts';
import {closest} from './text.ts';
import type {LoadedRegistry} from './registry/load.ts';

export interface OptionSpec {
  /** Long flag, e.g. `--limit`. */
  flag: string;
  short?: string;
  type: 'boolean' | 'string';
  /** Placeholder for the value in help, e.g. `n` for `--limit <n>`. */
  value?: string;
  description: string;
  choices?: readonly string[];
  /** Code of the error a value outside `choices` raises (default `ERR_INVALID_ARGUMENT`). */
  choiceError?: ErrorCode;
  /** Repeatable: values are collected. */
  multiple?: boolean;
  default?: string;
}

export interface ArgSpec {
  name: string;
  required: boolean;
  variadic?: boolean;
  description: string;
}

export interface ExitCodeSpec {
  code: number;
  when: string;
}

export interface Outcome<Data = unknown> {
  /** The response `type` discriminator, e.g. `component.detail`. */
  type: string;
  data: Data;
  meta?: Record<string, unknown>;
  /** The human-readable projection of `data` (already honours `--dense` and `--detail`). */
  text: string;
  /** Overrides the exit code (default 0): e.g. a gate that reports and fails. */
  exitCode?: number;
}

export interface GlobalOptions {
  json: boolean;
  dense: boolean;
  detail: 'brief' | 'compact' | 'full' | undefined;
  registry: string | undefined;
}

export interface Io {
  cwd: string;
  env: Record<string, string | undefined>;
  stdout: (text: string) => void;
  stderr: (text: string) => void;
  /** All of stdin, for commands that accept `-`; absent when there is no piped input. */
  readStdin?: () => Promise<string>;
}

export type OptionValues = Record<string, string | boolean | string[] | undefined>;

export interface CommandContext {
  io: Io;
  cwd: string;
  /** Positional arguments after the command name. */
  args: string[];
  options: OptionValues;
  global: GlobalOptions;
  /** Loads the agent registry on first use (commands that never need it never fail on a missing one). */
  registry(): LoadedRegistry;
}

export interface CommandSpec {
  name: string;
  summary: string;
  description: string;
  args: ArgSpec[];
  options: OptionSpec[];
  examples: {label: string; cli: string}[];
  exitCodes: ExitCodeSpec[];
  /** Response `type` values the command can emit. */
  responseTypes: string[];
  /** Supports `--json`. False rejects the flag before any side effect. */
  json: boolean;
  related: string[];
  subcommands?: CommandSpec[];
  run?: (context: CommandContext) => Promise<Outcome> | Outcome;
}

/** Flags every command accepts. */
export const GLOBAL_OPTIONS: OptionSpec[] = [
  {
    flag: '--json',
    type: 'boolean',
    description:
      'Output a typed JSON envelope. Success: { apiVersion, type, data, meta? }. Error: { apiVersion, error, code, suggestions? }.',
  },
  {
    flag: '--dense',
    type: 'boolean',
    description: 'Compressed, token-efficient output for AI context windows.',
  },
  {
    flag: '--detail',
    type: 'string',
    value: 'level',
    choices: ['brief', 'compact', 'full'],
    description:
      'Detail level for list views, increasing in size: brief (names only) < compact (names and one-line descriptions) < full (full docs per entry).',
  },
  {
    flag: '--registry',
    type: 'string',
    value: 'file',
    description:
      'Read this agent registry file instead of the installed @tecton-wc/components one (also: $TCT_AGENT_REGISTRY).',
  },
];

const HELP_FLAGS = ['--help', '-h'];
const VERSION_FLAGS = ['--version', '-V'];

export interface ParsedArgs {
  args: string[];
  options: OptionValues;
  help: boolean;
  version: boolean;
}

/** Camel-cased key of an option (`--agent-docs-path` -> `agentDocsPath`). */
export const optionKey = (flag: string): string =>
  flag.replace(/^--/, '').replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());

/**
 * Parses `argv` against the command's options plus the global ones. Unknown flags, missing values and
 * values outside a choice list are errors with stable codes.
 */
export function parseArguments(
  argv: readonly string[],
  spec: {options: OptionSpec[]; args: ArgSpec[]; name: string},
): ParsedArgs {
  const specs = [...spec.options, ...GLOBAL_OPTIONS];
  const byFlag = new Map(specs.map((option) => [option.flag, option]));
  const byShort = new Map(
    specs.filter((option) => option.short).map((option) => [option.short!, option]),
  );
  const options: OptionValues = {};
  const args: string[] = [];
  let help = false;
  let version = false;

  const store = (option: OptionSpec, value: string | boolean) => {
    const key = optionKey(option.flag);
    if (typeof value === 'string' && option.choices && !option.choices.includes(value)) {
      throw new CliError(
        `Invalid ${option.flag} value "${value}". Valid values: ${option.choices.join(', ')}.`,
        option.choiceError ??
          (option.flag === '--detail'
            ? ERROR_CODES.ERR_INVALID_DETAIL
            : ERROR_CODES.ERR_INVALID_ARGUMENT),
        option.choices.map((choice) => ({name: choice, reason: 'valid value'})),
      );
    }
    if (option.multiple && typeof value === 'string') {
      const previous = options[key];
      options[key] = [...(Array.isArray(previous) ? previous : []), value];
    } else {
      options[key] = value;
    }
  };

  let rest = false;
  for (let index = 0; index < argv.length; index++) {
    const token = argv[index]!;
    if (rest) {
      args.push(token);
      continue;
    }
    if (token === '--') {
      rest = true;
      continue;
    }
    if (HELP_FLAGS.includes(token)) {
      help = true;
      continue;
    }
    if (VERSION_FLAGS.includes(token)) {
      version = true;
      continue;
    }
    if (token === '-' || !token.startsWith('-')) {
      args.push(token);
      continue;
    }
    let flag = token;
    let inline: string | undefined;
    if (token.startsWith('--')) {
      const equals = token.indexOf('=');
      if (equals !== -1) {
        flag = token.slice(0, equals);
        inline = token.slice(equals + 1);
      }
    }
    const option = token.startsWith('--') ? byFlag.get(flag) : byShort.get(flag);
    if (!option) {
      // A negative number is a value, not a flag.
      if (/^-\d/.test(token)) {
        args.push(token);
        continue;
      }
      throw new CliError(
        `Unknown option '${flag}' for '${spec.name}'.`,
        ERROR_CODES.ERR_INVALID_OPTION,
        closest(
          flag,
          specs.map((candidate) => candidate.flag),
          3,
        ).map((name) => ({name, reason: 'did you mean this?'})),
      );
    }
    if (option.type === 'boolean') {
      if (inline !== undefined) {
        throw new CliError(
          `Option '${option.flag}' does not take a value.`,
          ERROR_CODES.ERR_INVALID_ARGUMENT,
        );
      }
      store(option, true);
      continue;
    }
    let value = inline;
    if (value === undefined) {
      const next = argv[index + 1];
      if (next === undefined || (next.startsWith('-') && next !== '-' && !/^-\d/.test(next))) {
        throw new CliError(
          `Option '${option.flag}' needs a value${option.value ? ` <${option.value}>` : ''}.`,
          ERROR_CODES.ERR_MISSING_ARGUMENT,
        );
      }
      value = next;
      index++;
    }
    store(option, value);
  }
  return {args, options, help, version};
}

/** Checks the positional arguments against the spec. */
export function checkArguments(spec: CommandSpec, args: readonly string[]): void {
  const required = spec.args.filter((arg) => arg.required);
  if (args.length < required.length) {
    const missing = required[args.length]!;
    throw new CliError(
      `Missing required argument '${missing.name}' for '${spec.name}'.`,
      ERROR_CODES.ERR_MISSING_ARGUMENT,
    );
  }
  const variadic = spec.args.some((arg) => arg.variadic);
  if (!variadic && args.length > spec.args.length) {
    throw new CliError(
      `Too many arguments for '${spec.name}': unexpected '${args[spec.args.length]}'.`,
      ERROR_CODES.ERR_INVALID_ARGUMENT,
    );
  }
}

export function globalOptions(options: OptionValues): GlobalOptions {
  return {
    json: options.json === true,
    dense: options.dense === true,
    detail: options.detail as GlobalOptions['detail'],
    registry: typeof options.registry === 'string' ? options.registry : undefined,
  };
}
