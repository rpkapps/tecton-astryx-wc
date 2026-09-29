/**
 * `--help` text and the capability manifest, both generated from the command definitions.
 */
import {GLOBAL_OPTIONS, type CommandSpec, type OptionSpec} from './command.ts';
import {wrapText} from './text.ts';

const flagLabel = (option: OptionSpec): string =>
  `${option.short ? `${option.short}, ` : ''}${option.flag}${option.type === 'string' ? ` <${option.value ?? 'value'}>` : ''}`;

function optionLines(options: readonly OptionSpec[]): string[] {
  const width = Math.max(0, ...options.map((option) => flagLabel(option).length));
  return options.map((option) => {
    const suffix = option.choices ? ` (${option.choices.join(', ')})` : '';
    const fallback = option.default ? ` [default: ${option.default}]` : '';
    return `  ${flagLabel(option).padEnd(width)}  ${option.description}${suffix}${fallback}`;
  });
}

const usageOf = (spec: CommandSpec, prefix: string): string => {
  const args = spec.args
    .map((arg) => {
      const inner = arg.variadic ? `${arg.name}...` : arg.name;
      return arg.required ? `<${inner}>` : `[${inner}]`;
    })
    .join(' ');
  const sub = spec.subcommands?.length ? ' <command>' : '';
  return `${prefix} ${spec.name}${sub}${args ? ` ${args}` : ''}${spec.options.length ? ' [options]' : ''}`.trim();
};

/** Help for one command (`tct component --help`). `path` is the full command path, e.g. `layout check`. */
export function commandHelp(spec: CommandSpec, path: string): string {
  const lines: string[] = [
    `tct ${path} - ${spec.summary}`,
    '',
    `Usage: ${usageOf({...spec, name: path}, 'tct')}`,
  ];
  if (spec.description) lines.push('', wrapText(spec.description));
  if (spec.subcommands?.length) {
    const width = Math.max(...spec.subcommands.map((sub) => sub.name.length));
    lines.push(
      '',
      'Commands:',
      ...spec.subcommands.map((sub) => `  ${sub.name.padEnd(width)}  ${sub.summary}`),
    );
  }
  const withDescription = spec.args.filter((arg) => arg.description);
  if (withDescription.length > 0) {
    const width = Math.max(...withDescription.map((arg) => arg.name.length));
    lines.push(
      '',
      'Arguments:',
      ...withDescription.map((arg) => `  ${arg.name.padEnd(width)}  ${arg.description}`),
    );
  }
  if (spec.options.length > 0) lines.push('', 'Options:', ...optionLines(spec.options));
  if (spec.examples.length > 0) {
    lines.push(
      '',
      'Examples:',
      ...spec.examples.map((example) => `  ${example.cli}    # ${example.label}`),
    );
  }
  lines.push('', 'Global options:', ...optionLines(GLOBAL_OPTIONS));
  if (spec.exitCodes.length > 0) {
    lines.push('', 'Exit codes:', ...spec.exitCodes.map((code) => `  ${code.code}  ${code.when}`));
  }
  return lines.join('\n');
}

/** Help for the program (`tct --help`). */
export function programHelp(commands: readonly CommandSpec[], version: string): string {
  const width = Math.max(...commands.map((command) => command.name.length));
  return [
    `tct ${version} - agent-ready docs, search and tooling for the Tecton web components`,
    '',
    'Usage: tct <command> [options]',
    '',
    'Commands:',
    ...commands.map((command) => `  ${command.name.padEnd(width)}  ${command.summary}`),
    '',
    'Global options:',
    ...optionLines(GLOBAL_OPTIONS),
    '  -h, --help  Show help for a command',
    '  -V, --version  Print the version',
    '',
    'Output format: text mirrors --json; records are aligned "key: value" lines separated by a blank line,',
    'so a field can be grepped, e.g.  tct search button | grep "^command:". Errors and warnings go to stderr;',
    'use --json for structured parsing. Every error has a stable code in the JSON envelope.',
    '',
    'Run `tct <command> --help` for one command, or `tct manifest --json` for the full machine-readable surface.',
  ].join('\n');
}

export interface ManifestOption {
  flag: string;
  short?: string;
  type: 'boolean' | 'string' | 'enum';
  value?: string;
  description: string;
  choices?: readonly string[];
  default?: string;
  multiple?: boolean;
}

export interface ManifestCommand {
  name: string;
  description: string;
  arguments: {name: string; required: boolean; variadic: boolean; description: string}[];
  options: ManifestOption[];
  json: boolean;
  responseTypes: string[];
  examples: string[];
  exitCodes: {code: number; when: string}[];
  subcommands?: ManifestCommand[];
}

export interface Manifest {
  name: 'tct';
  version: string;
  description: string;
  globalOptions: ManifestOption[];
  commands: ManifestCommand[];
  jsonSupported: string[];
  responseTypes: Record<string, string[]>;
}

const manifestOption = (option: OptionSpec): ManifestOption => ({
  flag: option.flag,
  ...(option.short ? {short: option.short} : {}),
  type: option.choices ? 'enum' : option.type,
  ...(option.value ? {value: option.value} : {}),
  description: option.description,
  ...(option.choices ? {choices: option.choices} : {}),
  ...(option.default ? {default: option.default} : {}),
  ...(option.multiple ? {multiple: true} : {}),
});

function manifestCommand(spec: CommandSpec): ManifestCommand {
  return {
    name: spec.name,
    description: spec.summary,
    arguments: spec.args.map((arg) => ({
      name: arg.name,
      required: arg.required,
      variadic: arg.variadic === true,
      description: arg.description,
    })),
    options: spec.options.map(manifestOption),
    json: spec.json,
    responseTypes: spec.responseTypes,
    examples: spec.examples.map((example) => example.cli),
    exitCodes: spec.exitCodes,
    ...(spec.subcommands?.length ? {subcommands: spec.subcommands.map(manifestCommand)} : {}),
  };
}

/** Every command, argument, option, response type and exit code: one call, no scraping of `--help`. */
export function buildManifest(commands: readonly CommandSpec[], version: string): Manifest {
  const jsonSupported: string[] = [];
  const responseTypes: Record<string, string[]> = {};
  const visit = (spec: CommandSpec, path: string) => {
    if (spec.run) {
      if (spec.json) jsonSupported.push(path);
      responseTypes[path] = spec.responseTypes;
    }
    for (const sub of spec.subcommands ?? []) visit(sub, `${path} ${sub.name}`);
  };
  for (const command of commands) visit(command, command.name);
  return {
    name: 'tct',
    version,
    description: 'Agent-ready docs, search and tooling for the Tecton web components',
    globalOptions: GLOBAL_OPTIONS.map(manifestOption),
    commands: commands.map(manifestCommand),
    jsonSupported,
    responseTypes,
  };
}
