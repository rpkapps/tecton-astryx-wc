/**
 * `tct manifest`: the full capability manifest, so an agent can drive the whole CLI from one call.
 */
import type {CommandSpec, Outcome} from '../command.ts';
import {COMMANDS} from './index.ts';
import {buildManifest} from '../help.ts';
import {records, section} from '../text.ts';
import {VERSION} from '../version.ts';
import {blocks} from '../text.ts';

export const manifestSpec: CommandSpec = {
  name: 'manifest',
  summary: 'Print the full CLI capability manifest (use with --json)',
  description:
    'Every command, argument, option, response type and exit code, generated from the command definitions so it ' +
    'cannot drift from the real CLI. Use --json for the structured manifest.',
  args: [],
  options: [],
  examples: [{label: 'The manifest', cli: 'tct manifest --json'}],
  exitCodes: [{code: 0, when: 'success'}],
  responseTypes: ['manifest'],
  json: true,
  related: [],
  run: (context): Outcome => {
    void context;
    const manifest = buildManifest(COMMANDS, VERSION);
    return {
      type: 'manifest',
      data: manifest,
      text: blocks(
        section(`tct v${manifest.version} (${manifest.commands.length} commands)`),
        records(
          manifest.commands.map((command) => ({
            name: command.name,
            json: command.json ? 'yes' : '',
            description: command.description,
          })),
          {layout: 'inline', fields: ['name', 'json', 'description']},
        ),
        'Run `tct manifest --json` for the full structured manifest.',
      ),
    };
  },
};
