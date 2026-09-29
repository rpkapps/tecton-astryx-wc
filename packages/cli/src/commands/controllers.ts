/**
 * `tct controllers`: the runtime building blocks of `@tecton-wc/core` (controllers, mixins, context keys and
 * utilities). The counterpart of the React design system's hooks.
 */
import type {CommandContext, CommandSpec, Outcome} from '../command.ts';
import {ERROR_CODES, CliError} from '../errors.ts';
import {RegistryLookup} from '../registry/lookup.ts';
import type {RegistryController} from '../registry/types.ts';
import {blocks, records, section, truncate} from '../text.ts';
import type {ControllerListData} from '../types.ts';

export const controllersSpec: CommandSpec = {
  name: 'controllers',
  summary: 'List controllers and utilities or print one',
  description:
    'The runtime building blocks of @tecton-wc/core for building your own elements: reactive controllers ' +
    '(roving focus, layers, positioning, media queries, long press), mixins (form association), context keys and ' +
    'utilities (the announcer, the icon registry, define). With no name, lists them grouped by area; with a name, ' +
    'prints its import, signature, description, usage example and public members.',
  args: [
    {
      name: 'name',
      required: false,
      description: 'Controller or utility name, e.g. RovingTabindexController.',
    },
  ],
  options: [
    {flag: '--list', type: 'boolean', description: 'List everything grouped by area.'},
    {
      flag: '--category',
      type: 'string',
      value: 'area',
      description:
        'List one area: controllers, layer, context, mixins, i18n, icons, forms, a11y, theme, ...',
    },
    {flag: '--members', type: 'boolean', description: 'Print only the public members of a class.'},
  ],
  examples: [
    {label: 'Browse', cli: 'tct controllers --list'},
    {label: 'One controller', cli: 'tct controllers RovingTabindexController'},
    {label: 'Only the layer utilities', cli: 'tct controllers --category layer --detail compact'},
  ],
  exitCodes: [
    {code: 0, when: 'success'},
    {code: 1, when: 'unknown controller or area, or the registry cannot be found'},
  ],
  responseTypes: ['controller.list', 'controller.detail', 'controller.detail.members'],
  json: true,
  related: ['search', 'component', 'docs'],
  run: (context) => runControllers(context),
};

const memberLines = (controller: RegistryController): string[] =>
  controller.members.map(
    (member) => `- \`${member.signature}\`${member.summary ? `: ${member.summary}` : ''}`,
  );

function formatController(
  controller: RegistryController,
  detail: 'brief' | 'compact' | 'full',
): string {
  const lines: string[] = [
    `# ${controller.name} (${controller.kind}, ${controller.area})`,
    '',
    `**Import:** \`import {${controller.name}} from '${controller.import}';\``,
    '',
    controller.signature ? `\`${controller.signature}\`` : '',
    '',
    detail === 'full' ? controller.description : controller.summary,
    '',
  ];
  if (detail !== 'brief' && controller.example) lines.push('```ts', controller.example, '```', '');
  if (detail === 'full' && controller.members.length > 0)
    lines.push('## Members', '', ...memberLines(controller), '');
  if (controller.usedBy.length > 0)
    lines.push(`Used by: ${controller.usedBy.map((folder) => `tct-${folder}`).join(', ')}`, '');
  return lines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function formatDense(controller: RegistryController): string {
  const lines = [`${controller.name} (${controller.kind})  ${controller.import}`];
  if (controller.signature) lines.push(controller.signature);
  lines.push(controller.summary);
  if (controller.example) lines.push(controller.example);
  for (const member of controller.members) {
    lines.push(`  ${member.signature}${member.summary ? `  ${truncate(member.summary, 70)}` : ''}`);
  }
  return lines.join('\n');
}

function runControllers(context: CommandContext): Outcome {
  const {registry} = context.registry();
  const lookup = new RegistryLookup(registry);
  const {options, global} = context;
  const name = context.args[0];
  const area = options.category as string | undefined;

  if (name === undefined || options.list === true || area !== undefined) {
    let controllers = registry.controllers;
    if (area !== undefined) {
      const areas = [...new Set(registry.controllers.map((controller) => controller.area))].sort();
      const match = areas.find((candidate) => candidate.toLowerCase() === area.toLowerCase());
      if (!match) {
        throw new CliError(
          `Unknown area "${area}".`,
          ERROR_CODES.ERR_UNKNOWN_CATEGORY,
          areas.map((candidate) => ({name: candidate, reason: 'valid area'})),
        );
      }
      controllers = controllers.filter((controller) => controller.area === match);
    }
    const level = global.detail ?? 'brief';
    const grouped = new Map<string, RegistryController[]>();
    for (const controller of controllers)
      grouped.set(controller.area, [...(grouped.get(controller.area) ?? []), controller]);
    const areaNames = [...grouped.keys()].sort();

    let data: ControllerListData;
    if (level === 'brief') {
      data = {
        detail: 'names',
        controllers: Object.fromEntries(
          areaNames.map((each) => [
            each,
            grouped
              .get(each)!
              .map((controller) => ({name: controller.name, kind: controller.kind})),
          ]),
        ),
      };
    } else if (level === 'compact') {
      data = {
        detail: 'compact',
        controllers: Object.fromEntries(
          areaNames.map((each) => [
            each,
            grouped.get(each)!.map((controller) => ({
              name: controller.name,
              kind: controller.kind,
              description: controller.summary,
              import: controller.import,
            })),
          ]),
        ),
      };
    } else {
      data = {
        detail: 'full',
        controllers: Object.fromEntries(areaNames.map((each) => [each, grouped.get(each)!])),
      };
    }

    let text: string;
    if (global.dense) {
      text = areaNames
        .flatMap((each) => [
          `## ${each}`,
          ...grouped
            .get(each)!
            .map((controller) =>
              level === 'full'
                ? formatDense(controller)
                : `${controller.name}  ${truncate(controller.summary, 90)}`,
            ),
        ])
        .join('\n');
    } else if (level === 'brief') {
      text = blocks(
        section(`Controllers and utilities (${controllers.length})`),
        ...areaNames.map((each) =>
          blocks(
            section(each),
            records(
              grouped
                .get(each)!
                .map((controller) => ({name: controller.name, kind: controller.kind})),
              {layout: 'inline', fields: ['name', 'kind']},
            ),
          ),
        ),
        'Usage: tct controllers <name>',
      );
    } else if (level === 'compact') {
      text = blocks(
        ...areaNames.map((each) =>
          blocks(
            section(each),
            records(
              grouped.get(each)!.map((controller) => ({
                name: controller.name,
                import: controller.import,
                description: controller.summary,
              })),
            ),
          ),
        ),
      );
    } else {
      text = areaNames
        .flatMap((each) =>
          grouped.get(each)!.map((controller) => formatController(controller, 'full')),
        )
        .join('\n\n');
    }
    return {type: 'controller.list', data, text};
  }

  const controller = lookup.controller(name);
  if (!controller) {
    const suggestions = lookup.suggestControllers(name);
    throw new CliError(
      `No controller or utility named "${name}".`,
      ERROR_CODES.ERR_UNKNOWN_CONTROLLER,
      suggestions.map((candidate) => ({name: candidate, reason: 'similar name'})),
    );
  }
  if (options.members === true) {
    return {
      type: 'controller.detail.members',
      data: {name: controller.name, members: controller.members},
      text:
        controller.members.length > 0
          ? memberLines(controller).join('\n')
          : `${controller.name} has no documented public members.`,
    };
  }
  return {
    type: 'controller.detail',
    data: controller,
    text: global.dense
      ? formatDense(controller)
      : formatController(controller, global.detail ?? 'full'),
  };
}
