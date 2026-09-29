/**
 * `tct component`: list elements, or print one element's docs (full, compact, brief or dense), its
 * attributes and properties, its examples, its styling hooks or its source.
 */
import {existsSync, readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import type {CommandContext, CommandSpec, Outcome} from '../command.ts';
import {ERROR_CODES, CliError} from '../errors.ts';
import {
  formatBrief,
  formatCompact,
  formatDense,
  formatExamples,
  formatFull,
  formatProps,
  formatStyling,
} from '../format/component.ts';
import {RegistryLookup, importSpecifier, importStatement} from '../registry/lookup.ts';
import type {RegistryComponent, RegistryElement} from '../registry/types.ts';
import {blocks, records, section, truncate} from '../text.ts';
import type {
  ComponentDetail,
  ComponentDetailData,
  ComponentListEntry,
  ComponentListData,
} from '../types.ts';

export const COMPONENT_PACKAGE = '@tecton-wc/components';

export const componentSpec: CommandSpec = {
  name: 'component',
  summary: 'List elements or print element docs',
  description:
    'Resolves an element or component family by tag, folder or name and prints its authored docs, or lists ' +
    'the catalog grouped by category. Naming an element of a compound family (tct-dropdown-menu-item) scopes ' +
    'the answer to that element. Flags narrow one component to its attributes and properties, examples, ' +
    'styling hooks or source. --dense prints the token-efficient projection of the authored dense doc.',
  args: [
    {
      name: 'name',
      required: false,
      description: 'Element tag (tct-button), family folder (button) or display name (Button).',
    },
  ],
  options: [
    {flag: '--list', type: 'boolean', description: 'List all elements grouped by category.'},
    {
      flag: '--category',
      type: 'string',
      value: 'category',
      description: 'List the elements of one category (case-insensitive).',
    },
    {
      flag: '--props',
      type: 'boolean',
      description: 'Print only attributes, properties, slots, events and methods.',
    },
    {flag: '--examples', type: 'boolean', description: 'Print every example with its HTML source.'},
    {flag: '--example', type: 'string', value: 'id', description: 'Print one example by id.'},
    {
      flag: '--styling',
      type: 'boolean',
      description: 'Print only parts, states and custom properties.',
    },
    {
      flag: '--source',
      type: 'boolean',
      description:
        'Print the element source (available when run inside the workspace that contains it).',
    },
  ],
  examples: [
    {label: 'Browse the catalog', cli: 'tct component --list'},
    {label: 'One element, token-efficient', cli: 'tct component tct-button --dense'},
    {label: 'Attributes as JSON', cli: 'tct component tct-button --props --json'},
    {label: 'One example', cli: 'tct component tct-button --example variants'},
  ],
  exitCodes: [
    {code: 0, when: 'success'},
    {code: 1, when: 'unknown element, category or example, or the registry cannot be found'},
  ],
  responseTypes: [
    'component.list',
    'component.detail',
    'component.detail.props',
    'component.detail.examples',
    'component.detail.styling',
    'component.detail.source',
  ],
  json: true,
  related: ['search', 'controllers', 'docs', 'discover'],
  run: (context) => runComponent(context),
};

const primaryTag = (component: RegistryComponent): string =>
  component.tag ?? `tct-${component.folder}`;

function listEntry(component: RegistryComponent): ComponentListEntry {
  return {
    name: primaryTag(component),
    displayName: component.name,
    folder: component.folder,
    package: COMPONENT_PACKAGE,
  };
}

/** The dense projection of a component: what `--dense --json` and `--detail full` lists carry. */
export function denseProjection(
  component: RegistryComponent,
  element: RegistryElement | null = null,
) {
  return {
    name: component.name,
    tag: element?.tag ?? primaryTag(component),
    tags: component.tags,
    folder: component.folder,
    category: component.category,
    import: {specifier: importSpecifier(component), statement: importStatement(component)},
    summary: component.summary,
    related: component.related,
    dense: component.dense,
  };
}

function detailOf(component: RegistryComponent, element: RegistryElement | null): ComponentDetail {
  return {
    name: component.name,
    tag: element?.tag ?? primaryTag(component),
    tags: component.tags,
    folder: component.folder,
    category: component.category,
    url: component.url,
    summary: component.summary,
    keywords: component.keywords,
    related: component.related,
    status: component.status,
    import: {specifier: importSpecifier(component), statement: importStatement(component)},
    package: COMPONENT_PACKAGE,
    dense: component.dense,
    elements: element ? [element] : component.elements,
    examples: component.examples,
    sections: component.sections,
    ...(element ? {scopedTo: element.tag, parent: primaryTag(component)} : {}),
  };
}

function runComponent(context: CommandContext): Outcome {
  const {registry} = context.registry();
  const lookup = new RegistryLookup(registry);
  const {options, global} = context;
  const name = context.args[0];

  const views = ['props', 'examples', 'example', 'styling', 'source'].filter(
    (key) => options[key] !== undefined && options[key] !== false,
  );
  if (views.length > 1) {
    throw new CliError(
      `Use one view flag at a time (got ${views.map((view) => `--${view}`).join(', ')}).`,
      ERROR_CODES.ERR_INVALID_ARGUMENT,
    );
  }

  const listView = options.list === true || options.category !== undefined || name === undefined;
  if (listView || name === undefined) {
    if (views.length > 0) {
      throw new CliError(`--${views[0]} needs a component name.`, ERROR_CODES.ERR_MISSING_ARGUMENT);
    }
    return runList(context);
  }

  const match = lookup.component(name);
  if (!match) {
    const suggestions = lookup.suggestComponents(name);
    throw new CliError(
      `No element named "${name}".`,
      ERROR_CODES.ERR_UNKNOWN_COMPONENT,
      suggestions.map((candidate) => ({name: candidate, reason: 'similar name'})),
    );
  }
  const {component, element} = match;
  const scope = {element};
  const tag = element?.tag ?? primaryTag(component);

  if (options.props === true) {
    const elements = element ? [element] : component.elements;
    const data = {
      component: tag,
      elements: elements.map((each) => ({
        tag: each.tag,
        attributes: each.attributes,
        properties: each.properties,
        slots: each.slots,
        events: each.events,
        methods: each.methods,
      })),
    };
    return {type: 'component.detail.props', data, text: formatProps(component, scope)};
  }
  if (options.styling === true) {
    const elements = element ? [element] : component.elements;
    const data = {
      component: tag,
      elements: elements.map((each) => ({
        tag: each.tag,
        cssParts: each.cssParts,
        cssStates: each.cssStates,
        cssProperties: each.cssProperties,
      })),
    };
    return {type: 'component.detail.styling', data, text: formatStyling(component, scope)};
  }
  if (options.examples === true || options.example !== undefined) {
    const id = options.example as string | undefined;
    let examples = component.examples;
    if (id !== undefined) {
      examples = examples.filter((example) => example.id === id);
      if (examples.length === 0) {
        throw new CliError(
          `No example "${id}" for ${tag}.`,
          ERROR_CODES.ERR_NO_EXAMPLE,
          component.examples.map((example) => ({name: example.id, reason: example.title})),
        );
      }
    }
    const text =
      id !== undefined
        ? `${examples[0]!.source.trim()}`
        : examples.length > 0
          ? formatExamples(examples)
          : `No examples for ${tag}.`;
    return {type: 'component.detail.examples', data: {component: tag, examples}, text};
  }
  if (options.source === true) return runSource(context, component, tag);

  const detail = detailOf(component, element);
  if (global.dense) {
    return {
      type: 'component.detail',
      data: denseProjection(component, element),
      meta: {dense: true},
      text: formatDense(component, scope),
    };
  }
  const level = global.detail ?? 'full';
  const text =
    level === 'brief'
      ? formatBrief(component, scope)
      : level === 'compact'
        ? formatCompact(component, scope)
        : formatFull(component, scope);
  return {type: 'component.detail', data: detail satisfies ComponentDetailData, text};
}

function runList(context: CommandContext): Outcome {
  const {registry} = context.registry();
  const {global, options} = context;
  const category = options.category as string | undefined;
  let components = registry.components;
  let heading: string | undefined;
  if (category !== undefined) {
    const known = registry.categories;
    const match = known.find((candidate) => candidate.toLowerCase() === category.toLowerCase());
    if (!match) {
      throw new CliError(
        `Unknown category "${category}".`,
        ERROR_CODES.ERR_UNKNOWN_CATEGORY,
        known.map((candidate) => ({name: candidate, reason: 'valid category'})),
      );
    }
    components = components.filter((component) => component.category === match);
    heading = match;
  }

  // Single-component views default to full, list views to brief (names only).
  const level = global.detail ?? 'brief';
  const groups = new Map<string, RegistryComponent[]>();
  for (const name of registry.categories) {
    const inCategory = components.filter((component) => component.category === name);
    if (inCategory.length > 0) groups.set(name, inCategory);
  }
  for (const component of components) {
    if (!groups.has(component.category)) {
      groups.set(
        component.category,
        components.filter((other) => other.category === component.category),
      );
    }
  }

  let data: ComponentListData;
  if (level === 'brief') {
    data = {
      detail: 'names',
      components: Object.fromEntries(
        [...groups].map(([name, list]) => [name, list.map(listEntry)]),
      ),
    };
  } else if (level === 'compact') {
    data = {
      detail: 'compact',
      components: Object.fromEntries(
        [...groups].map(([name, list]) => [
          name,
          list.map((component) => ({
            ...listEntry(component),
            description: component.dense?.description ?? component.summary,
            import: importSpecifier(component),
          })),
        ]),
      ),
    };
  } else {
    data = {
      detail: 'full',
      components: Object.fromEntries(
        [...groups].map(([name, list]) => [
          name,
          list.map((component) => denseProjection(component)),
        ]),
      ),
    };
  }

  const total = components.length;
  let text: string;
  if (global.dense) {
    const lines: string[] = [];
    for (const [name, list] of groups) {
      lines.push(`## ${name}`);
      for (const component of list) {
        lines.push(
          level === 'full'
            ? formatDense(component).trimEnd()
            : `${primaryTag(component)}  ${truncate(component.dense?.description ?? component.summary, 90)}`,
        );
      }
    }
    text = lines.join('\n');
  } else if (level === 'full') {
    text = [...groups]
      .flatMap(([name, list]) => [`## ${name}`, '', ...list.map((c) => formatBrief(c))])
      .join('\n');
  } else if (level === 'compact') {
    text = blocks(
      ...[...groups].map(([name, list]) =>
        blocks(
          section(name),
          records(
            list.map((component) => ({
              name: primaryTag(component),
              import: importSpecifier(component),
              description: component.dense?.description ?? component.summary,
            })),
          ),
        ),
      ),
      footer(),
    );
  } else {
    const sorted = components.map((component) => ({
      name: primaryTag(component),
      import: importSpecifier(component),
    }));
    sorted.sort((a, b) => a.name.localeCompare(b.name));
    text = blocks(
      section(heading ?? `Components (${total})`),
      records(sorted, {layout: 'inline', fields: ['name', 'import']}),
      footer(),
    );
  }
  return {type: 'component.list', data, text};
}

const footer = (): string =>
  "Import a family to register its tags (import '@tecton-wc/components/<folder>').\nUsage: tct component <name> [--dense]";

/** The element source: read from the workspace that contains it, else a documented absence. */
function runSource(context: CommandContext, component: RegistryComponent, tag: string): Outcome {
  const relative = `packages/components/src/${component.folder}`;
  let root: string | null = null;
  for (let dir = context.cwd; ; dir = dirname(dir)) {
    if (existsSync(join(dir, relative))) {
      root = dir;
      break;
    }
    if (dirname(dir) === dir) break;
  }
  const file = `tct-${component.folder}.ts`;
  const primary = component.sourceFiles.includes(file)
    ? file
    : (component.sourceFiles.find(
        (candidate) => candidate.endsWith('.ts') && candidate.startsWith('tct-'),
      ) ?? null);
  if (!root || !primary) {
    throw new CliError(
      `The source of ${tag} is not part of this install: it lives in ${relative}/ of the library workspace.`,
      ERROR_CODES.ERR_NO_SOURCE,
      component.sourceFiles.map((name) => ({
        name: `${relative}/${name}`,
        reason: 'source file in the workspace',
      })),
    );
  }
  const path = join(root, relative, primary);
  const source = readFileSync(path, 'utf8');
  return {
    type: 'component.detail.source',
    data: {
      component: tag,
      folder: component.folder,
      file: `${relative}/${primary}`,
      files: component.sourceFiles,
      source,
    },
    text: source,
  };
}
