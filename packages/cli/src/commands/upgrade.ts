/**
 * `tct upgrade`: stale-block detection and refresh for the managed agent-docs block.
 *
 * Without `--apply` it only reports (a dry run). With `--apply` it rewrites the text between the markers of
 * every stale block and nothing else: bytes outside the markers are never touched, a block a person edited
 * is left alone unless `--force`, and a malformed block is never guessed at. `--check` turns "something needs
 * attention" into exit 1 for CI.
 */
import {join} from 'node:path';
import type {CommandContext, CommandSpec, Outcome} from '../command.ts';
import {expectedBlock} from '../agent-docs/context.ts';
import {injectBlock} from '../agent-docs/files.ts';
import {inspectAgentDocs, type BlockFile} from '../agent-docs/inspect.ts';
import {assertWithin} from '../fs-safety.ts';
import {blocks, records, section} from '../text.ts';
import type {UpgradeRunData} from '../types.ts';

export const upgradeSpec: CommandSpec = {
  name: 'upgrade',
  summary: 'Detect and refresh a stale agent-docs block',
  description:
    'Compares the managed block in your agent-doc files with the block the installed registry generates now. A ' +
    'stale block is refreshed by --apply, which rewrites only the text between the TCT markers: your own text, ' +
    'in the same files or elsewhere, is never touched. A block that was edited by hand is skipped (use --force to ' +
    'overwrite it), and a malformed block is reported for manual repair. Run it after any @tecton-wc dependency bump.',
  args: [],
  options: [
    {
      flag: '--apply',
      type: 'boolean',
      description: 'Rewrite stale blocks. Without it, upgrade only reports.',
    },
    {
      flag: '--force',
      type: 'boolean',
      description: 'With --apply: also overwrite a block that was edited by hand.',
    },
    {
      flag: '--check',
      type: 'boolean',
      description: 'Exit 1 when any block is stale, edited or malformed (a CI gate).',
    },
  ],
  examples: [
    {label: 'Report', cli: 'tct upgrade'},
    {label: 'Refresh stale blocks', cli: 'tct upgrade --apply'},
    {label: 'CI gate', cli: 'tct upgrade --check --json'},
  ],
  exitCodes: [
    {code: 0, when: 'current, missing, reported, or fully applied'},
    {
      code: 1,
      when: '--check found a block that needs attention, or --apply left one unresolved, or an error',
    },
  ],
  responseTypes: ['upgrade.run'],
  json: true,
  related: ['init', 'doctor'],
  run: (context) => runUpgrade(context),
};

const STATE_HELP: Record<BlockFile['state'], string> = {
  current: 'up to date',
  stale: 'stale (older than the installed registry)',
  edited: 'edited by hand',
  malformed: 'malformed markers',
};

function runUpgrade(context: CommandContext): Outcome {
  const {cwd, options} = context;
  const apply = options.apply === true;
  const force = options.force === true;
  const check = options.check === true;
  const {block, version} = expectedBlock(context);
  let inspection = inspectAgentDocs(cwd, block);

  const applied: string[] = [];
  const skipped: {path: string; reason: string}[] = [];

  if (apply) {
    const todo = inspection.files.filter(
      (file) => file.state === 'stale' || (force && file.state === 'edited'),
    );
    // Every target is checked before the first write.
    for (const file of todo) assertWithin(file.path, cwd, 'agent docs path');
    for (const file of todo) {
      if (injectBlock(join(cwd, file.path), block, {onlyReplace: true})) applied.push(file.path);
    }
    for (const file of inspection.files) {
      if (file.state === 'edited' && !force) {
        skipped.push({
          path: file.path,
          reason: `${file.detail ?? 'edited by hand'}; use --force to overwrite it`,
        });
      }
      if (file.state === 'malformed')
        skipped.push({path: file.path, reason: file.detail ?? 'malformed markers'});
    }
    inspection = inspectAgentDocs(cwd, block);
  }

  const attention = inspection.files.some((file) => file.state !== 'current');
  const complete = !attention;
  const data: UpgradeRunData = {
    status: inspection.status,
    libraryVersion: version,
    apply,
    complete,
    files: inspection.files.map((file) => ({
      path: file.path,
      state: file.state,
      blockVersion: file.blockVersion,
      ...(file.detail ? {detail: file.detail} : {}),
    })),
    applied,
    skipped,
  };

  let text: string;
  if (inspection.status === 'missing') {
    text = 'No agent-docs block found. Run `tct init --features agents` to install it.';
  } else if (complete) {
    text =
      applied.length > 0
        ? blocks(
            `[ok] Refreshed the agent-docs block in ${applied.join(', ')}`,
            'Everything is up to date.',
          )
        : 'Agent docs are up to date.';
  } else {
    text = blocks(
      section(apply ? 'Agent docs still need attention' : 'Agent docs need attention'),
      records(
        inspection.files.map((file) => ({
          path: file.path,
          state: STATE_HELP[file.state],
          version: file.blockVersion ?? '',
        })),
        {layout: 'inline', fields: ['path', 'state', 'version']},
      ),
      applied.length > 0 && `[ok] Refreshed: ${applied.join(', ')}`,
      skipped.length > 0 &&
        skipped.map((entry) => `Skipped ${entry.path}: ${entry.reason}`).join('\n'),
      !apply &&
        'Run `tct upgrade --apply` to refresh stale blocks (text outside the markers is never touched).',
      !apply &&
        inspection.files.some((file) => file.state === 'edited') &&
        'A block edited by hand is skipped unless you add --force.',
    );
  }
  const failed = attention && (check || apply);
  return {type: 'upgrade.run', data, text, exitCode: failed ? 1 : 0};
}
