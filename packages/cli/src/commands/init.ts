/**
 * `tct init`: non-interactive project setup. It never prompts, so it behaves identically for people, agents,
 * CI and piped input; it is safe to re-run; it writes the tool-agnostic `AGENTS.md` by default and fails
 * (exit 1) only on bad input.
 */
import type {CommandContext, CommandSpec, Outcome} from '../command.ts';
import {ERROR_CODES, CliError} from '../errors.ts';
import {expectedBlock} from '../agent-docs/context.ts';
import {
  AGENT_PRESETS,
  installAgentDocs,
  removeAgentDocs,
  type AgentPreset,
} from '../agent-docs/files.ts';
import {blocks} from '../text.ts';
import type {InitRemoveData, InitRunData} from '../types.ts';

const FEATURES = ['agents'] as const;

export const initSpec: CommandSpec = {
  name: 'init',
  summary: 'Install the agent docs block for AI coding tools',
  description:
    'Generates the managed agent-docs block (a workflow, behavioural rules, a CLI reference and an index of every ' +
    'element) from the installed registry and writes it between <!-- TCT:START --> and <!-- TCT:END --> markers. ' +
    'Without --agent it refreshes every existing agent-doc file (AGENTS.md, CLAUDE.md, .claude/CLAUDE.md, ' +
    '.cursorrules) and creates AGENTS.md when there is none. Text outside the markers is never touched. The block ' +
    'is refreshed after a dependency bump with `tct upgrade --apply`. Page templates are deferred.',
  args: [],
  options: [
    {
      flag: '--features',
      type: 'string',
      value: 'list',
      description:
        'Comma-separated features to install. Valid: agents. (Theme and template scaffolding are deferred.)',
    },
    {flag: '--all', type: 'boolean', description: 'Install every feature.'},
    {
      flag: '--agent',
      type: 'string',
      value: 'tool',
      choices: AGENT_PRESETS,
      choiceError: ERROR_CODES.ERR_UNKNOWN_AGENT,
      description:
        'Target one tool: claude (.claude/CLAUDE.md), cursor (.cursorrules), codex (AGENTS.md) or all.',
    },
    {
      flag: '--agent-docs-path',
      type: 'string',
      value: 'file',
      multiple: true,
      description:
        'Write the block to this file (relative, inside the project; repeatable). Overrides --agent.',
    },
    {
      flag: '--remove-agents',
      type: 'boolean',
      description: 'Remove the managed block instead of installing it.',
    },
    {
      flag: '--dry-run',
      type: 'boolean',
      description: 'Print the block that would be written; change nothing.',
    },
  ],
  examples: [
    {label: 'Default: AGENTS.md', cli: 'tct init --features agents'},
    {label: 'For Claude Code', cli: 'tct init --features agents --agent claude'},
    {
      label: 'A custom file',
      cli: 'tct init --features agents --agent-docs-path .cursor/rules/tct.mdc',
    },
    {label: 'Remove it again', cli: 'tct init --remove-agents'},
  ],
  exitCodes: [
    {code: 0, when: 'installed, refreshed or removed'},
    {
      code: 1,
      when: 'unknown feature or agent, a path outside the project, a malformed existing block, or no registry',
    },
  ],
  responseTypes: ['init.run', 'init.remove'],
  json: true,
  related: ['upgrade', 'doctor'],
  run: (context) => runInit(context),
};

const NEXT_STEPS = [
  'Next steps:',
  "  1. Load the stylesheet once: import '@tecton-wc/components/tecton.css'",
  "  2. Register the elements you use: import '@tecton-wc/components/button' (or the autoloader)",
  '  3. Run `tct doctor` to verify the setup',
  '  4. Run `tct --help` for all commands',
];

function runInit(context: CommandContext): Outcome {
  const {options, cwd} = context;

  if (options.removeAgents === true) {
    const {removed, deleted} = removeAgentDocs(cwd);
    const data: InitRemoveData = {removed, deleted};
    const lines = [
      ...deleted.map((path) => `[ok] Removed empty ${path}`),
      ...removed.map((path) => `[ok] Removed the managed section from ${path}`),
    ];
    return {
      type: 'init.remove',
      data,
      text: lines.length > 0 ? lines.join('\n') : 'No managed agent-docs block found.',
    };
  }

  const requested =
    options.all === true
      ? [...FEATURES]
      : typeof options.features === 'string'
        ? options.features
            .split(',')
            .map((feature) => feature.trim().toLowerCase())
            .filter(Boolean)
        : null;
  if (requested) {
    const invalid = requested.filter(
      (feature) => !(FEATURES as readonly string[]).includes(feature),
    );
    if (invalid.length > 0) {
      throw new CliError(
        `Unknown features: ${invalid.join(', ')}. Valid features: ${FEATURES.join(', ')}.`,
        ERROR_CODES.ERR_UNKNOWN_FEATURE,
        FEATURES.map((feature) => ({name: feature, reason: 'valid feature'})),
      );
    }
  }
  const agent = options.agent as AgentPreset | undefined;
  if (agent !== undefined && !AGENT_PRESETS.includes(agent)) {
    throw new CliError(
      `Unknown agent "${agent}". Valid agents: ${AGENT_PRESETS.join(', ')}.`,
      ERROR_CODES.ERR_UNKNOWN_AGENT,
      AGENT_PRESETS.map((preset) => ({name: preset, reason: 'valid agent'})),
    );
  }
  const paths = Array.isArray(options.agentDocsPath) ? options.agentDocsPath : undefined;

  const {block} = expectedBlock(context);
  const mode: InitRunData['mode'] = requested ? 'features' : 'default';
  const data: InitRunData = {
    mode,
    features: requested ?? ['agents'],
    docsWritten: [],
    docsCreated: [],
    nextSteps: mode === 'default',
  };

  if (options.dryRun === true) {
    data.dryRun = true;
    data.block = block;
    return {type: 'init.run', data, text: block};
  }

  const result = installAgentDocs(cwd, block, {
    ...(agent ? {agent} : {}),
    ...(paths ? {paths} : {}),
  });
  data.docsWritten = result.written;
  data.docsCreated = result.created;
  const lines: string[] = [];
  if (result.written.length > 0)
    lines.push(`[ok] Agent docs installed -> ${result.written.join(', ')}`);
  else lines.push('No agent-doc file was written.');
  return {
    type: 'init.run',
    data,
    text: blocks(lines.join('\n'), mode === 'default' && NEXT_STEPS.join('\n')),
  };
}
