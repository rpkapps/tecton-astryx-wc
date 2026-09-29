/**
 * `tct discover`: elements and packages that other installed packages contribute.
 *
 * A package contributes elements by shipping an agent registry (the same JSON the component library ships)
 * and naming it in its `package.json`:
 *
 * ```json
 * {"name": "@acme/widgets", "tct": {"agentRegistry": "./agent-registry.json"}}
 * ```
 *
 * The component library itself is always listed first. Packages are found in the `node_modules` directories
 * above the working directory; a registry that cannot be read is reported, not fatal.
 */
import {existsSync, readdirSync, readFileSync, realpathSync} from 'node:fs';
import {dirname, join, relative, resolve, sep} from 'node:path';
import type {CommandContext, CommandSpec, Outcome} from '../command.ts';
import {ERROR_CODES, CliError} from '../errors.ts';
import {formatBrief, formatCompact, formatDense, formatFull} from '../format/component.ts';
import {assertRegistry} from '../registry/load.ts';
import {RegistryLookup, importSpecifier} from '../registry/lookup.ts';
import type {AgentRegistry, RegistryComponent} from '../registry/types.ts';
import {blocks, closest, list, record, records, section} from '../text.ts';
import type {DiscoverListEntry} from '../types.ts';
import {COMPONENT_PACKAGE} from './component.ts';

const MAX_COMPONENTS_SHOWN = 10;

export const discoverSpec: CommandSpec = {
  name: 'discover',
  summary: 'Discover packages and elements that installed packages contribute',
  description:
    'Lists the component library and every installed package that ships an agent registry (a package.json ' +
    '"tct": {"agentRegistry": "<file>"} entry). With no query it lists those packages; @scope/name browses one ' +
    'package; @scope/name/tct-element or a free-text term resolves to an element doc.',
  args: [
    {
      name: 'query',
      required: false,
      description: '@scope/name, @scope/name/tct-element or a search term.',
    },
  ],
  options: [
    {
      flag: '--components',
      type: 'boolean',
      description:
        'In the package list, print every element of each package instead of the first 10 and a "+N more" count.',
    },
  ],
  examples: [
    {label: 'List packages', cli: 'tct discover'},
    {label: 'Browse the library', cli: 'tct discover @tecton-wc/components'},
    {
      label: 'An element of a package',
      cli: 'tct discover @tecton-wc/components/tct-button --dense',
    },
  ],
  exitCodes: [
    {code: 0, when: 'success'},
    {code: 1, when: 'unknown package or element, or a blank query'},
  ],
  responseTypes: ['discover.list', 'discover.detail', 'discover.detail.doc', 'discover.search'],
  json: true,
  related: ['component', 'search', 'gap-report'],
  run: (context) => runDiscover(context),
};

export interface Package {
  name: string;
  version: string | null;
  description: string | null;
  registry: AgentRegistry;
  /** Where the registry was read from. */
  source: string;
}

export interface ScanResult {
  packages: Package[];
  issues: {name: string; error: string}[];
}

function readJson(path: string): Record<string, unknown> | null {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Every directory of `node_modules` (and scope) that holds packages, nearest first. */
function packageDirs(cwd: string): string[] {
  const dirs: string[] = [];
  const seen = new Set<string>();
  for (let dir = resolve(cwd); ; dir = dirname(dir)) {
    const modules = join(dir, 'node_modules');
    if (existsSync(modules)) {
      for (const entry of readdirSync(modules, {withFileTypes: true})) {
        if (entry.name.startsWith('.')) continue;
        if (entry.name.startsWith('@')) {
          const scope = join(modules, entry.name);
          for (const inner of safeReaddir(scope)) {
            const full = join(scope, inner);
            const real = safeRealpath(full);
            if (!seen.has(real)) {
              seen.add(real);
              dirs.push(full);
            }
          }
        } else {
          const full = join(modules, entry.name);
          const real = safeRealpath(full);
          if (!seen.has(real)) {
            seen.add(real);
            dirs.push(full);
          }
        }
      }
    }
    if (dirname(dir) === dir) break;
  }
  return dirs;
}

const safeReaddir = (dir: string): string[] => {
  try {
    return readdirSync(dir);
  } catch {
    return [];
  }
};

const safeRealpath = (path: string): string => {
  try {
    return realpathSync(path);
  } catch {
    return path;
  }
};

export function scanPackages(context: CommandContext): ScanResult {
  const packages: Package[] = [];
  const issues: ScanResult['issues'] = [];
  const loaded = context.registry();
  const own = readJson(join(dirname(loaded.path), 'package.json'));
  packages.push({
    name: COMPONENT_PACKAGE,
    version: typeof own?.version === 'string' ? own.version : null,
    description: typeof own?.description === 'string' ? own.description : null,
    registry: loaded.registry,
    source: loaded.path,
  });
  for (const dir of packageDirs(context.cwd)) {
    const manifest = readJson(join(dir, 'package.json'));
    const name = typeof manifest?.name === 'string' ? manifest.name : null;
    const tct = manifest?.tct as {agentRegistry?: unknown} | undefined;
    if (!name || name === COMPONENT_PACKAGE || typeof tct?.agentRegistry !== 'string') continue;
    if (packages.some((existing) => existing.name === name)) continue;
    const file = resolve(dir, tct.agentRegistry);
    // The registry must live inside its package.
    const inside = relative(safeRealpath(dir), safeRealpath(file));
    if (inside.startsWith('..') || inside.startsWith(sep) || !existsSync(file)) {
      issues.push({
        name,
        error: `agentRegistry "${tct.agentRegistry}" is missing or outside the package`,
      });
      continue;
    }
    try {
      const registry = assertRegistry(JSON.parse(readFileSync(file, 'utf8')), file);
      packages.push({
        name,
        version: typeof manifest?.version === 'string' ? manifest.version : null,
        description: typeof manifest?.description === 'string' ? manifest.description : null,
        registry,
        source: file,
      });
    } catch (error) {
      issues.push({name, error: (error as Error).message});
    }
  }
  return {packages, issues};
}

export const tagOf = (component: RegistryComponent): string =>
  component.tag ?? `tct-${component.folder}`;

function toEntry(pkg: Package): DiscoverListEntry {
  return {
    name: pkg.name,
    ...(pkg.version ? {version: pkg.version} : {}),
    ...(pkg.description ? {description: pkg.description} : {}),
    components: pkg.registry.components.flatMap((component) => component.tags),
  };
}

function runDiscover(context: CommandContext): Outcome {
  const {packages, issues} = scanPackages(context);
  const query = context.args[0];
  const {global} = context;
  const meta = issues.length > 0 ? {invalid: issues} : undefined;

  const docOutcome = (pkg: Package, component: RegistryComponent, elementTag?: string): Outcome => {
    const lookup = new RegistryLookup(pkg.registry);
    const match = elementTag ? lookup.component(elementTag) : {component, element: null};
    const target = match?.component ?? component;
    const element = match?.element ?? null;
    const scope = {element};
    const text = global.dense
      ? formatDense(target, scope)
      : (global.detail ?? 'full') === 'brief'
        ? formatBrief(target, scope)
        : (global.detail ?? 'full') === 'compact'
          ? formatCompact(target, scope)
          : formatFull(target, scope);
    return {
      type: 'discover.detail.doc',
      data: {
        package: pkg.name,
        name: target.name,
        tag: element?.tag ?? tagOf(target),
        category: target.category,
        import: importSpecifier(target),
        summary: target.summary,
        dense: target.dense,
        elements: element ? [element] : target.elements,
        examples: target.examples,
      },
      ...(meta ? {meta} : {}),
      text,
    };
  };

  if (query === undefined) {
    const entries = packages.map(toEntry);
    const text = blocks(
      records(entries, {
        format: {
          components: (tags: string[]) => {
            if (context.options.components === true) return tags.join(', ');
            const shown = tags.slice(0, MAX_COMPONENTS_SHOWN).join(', ');
            const rest = tags.length - MAX_COMPONENTS_SHOWN;
            return rest > 0 ? `${shown}, +${rest} more` : shown;
          },
        },
      }),
      issues.length > 0 && list(issues.map((issue) => `${issue.name}: ${issue.error}`)),
      'Usage:\n  tct discover <package>              Browse a package\n  tct discover <package>/<tct-element>  View element docs\n  tct discover <search>               Search all packages',
    );
    return {
      type: 'discover.list',
      data: entries,
      meta: {configured: packages.length > 1, ...(meta ?? {})},
      text,
    };
  }

  if (query.trim() === '') {
    throw new CliError('A discover query must not be blank.', ERROR_CODES.ERR_INVALID_ARGUMENT);
  }

  // @scope/name[/tct-element] or name[/tct-element]
  const scoped = /^(@[^/]+\/[^/]+|[^@/][^/]*)(?:\/(.+))?$/.exec(query.trim());
  if (scoped) {
    const [, packageName, elementQuery] = scoped;
    const pkg = packages.find(
      (candidate) => candidate.name.toLowerCase() === packageName!.toLowerCase(),
    );
    if (pkg) {
      if (elementQuery === undefined) {
        const entry = toEntry(pkg);
        return {
          type: 'discover.detail',
          data: entry,
          ...(meta ? {meta} : {}),
          text: blocks(record(entry), `Usage: tct discover ${pkg.name}/<tct-element>`),
        };
      }
      const lookup = new RegistryLookup(pkg.registry);
      const match = lookup.component(elementQuery);
      if (!match) {
        throw new CliError(
          `No element "${elementQuery}" in package "${pkg.name}".`,
          ERROR_CODES.ERR_UNKNOWN_COMPONENT,
          lookup.suggestComponents(elementQuery).map((name) => ({name, reason: 'similar name'})),
        );
      }
      return docOutcome(pkg, match.component, elementQuery);
    }
    if (packageName!.startsWith('@') || elementQuery !== undefined) {
      throw new CliError(
        `No package named "${packageName}" ships an agent registry.`,
        ERROR_CODES.ERR_UNKNOWN_PACKAGE,
        closest(
          packageName!,
          packages.map((candidate) => candidate.name),
          3,
        ).map((name) => ({name, reason: 'similar name'})),
      );
    }
  }

  // Free-text: elements whose tag, folder or name contains the term, across packages.
  const needle = query.trim().toLowerCase().replace(/^tct-/, '');
  const matches: {package: string; component: string; pkg: Package; entry: RegistryComponent}[] =
    [];
  for (const pkg of packages) {
    for (const component of pkg.registry.components) {
      const names = [...component.tags, component.folder, component.name].map((name) =>
        name.toLowerCase(),
      );
      if (
        names.some((name) => name.replace(/^tct-/, '') === needle) ||
        names.some((name) => name.includes(needle))
      ) {
        matches.push({package: pkg.name, component: tagOf(component), pkg, entry: component});
      }
    }
  }
  if (matches.length === 0) {
    throw new CliError(
      `Nothing found for "${query}" in ${packages.length} package(s).`,
      ERROR_CODES.ERR_NOT_FOUND,
      packages
        .slice(0, 5)
        .map((pkg) => ({name: `tct discover ${pkg.name}`, reason: 'browse this package'})),
    );
  }
  const exact = matches.filter(
    (match) => match.component.toLowerCase().replace(/^tct-/, '') === needle,
  );
  const single = matches.length === 1 ? matches[0] : exact.length === 1 ? exact[0] : undefined;
  if (single) return docOutcome(single.pkg, single.entry);
  const found = matches.map(({package: packageName, component}) => ({
    package: packageName,
    component,
  }));
  return {
    type: 'discover.search',
    data: {query, matches: found},
    ...(meta ? {meta} : {}),
    text: blocks(
      section(`Found ${found.length} matches for "${query}"`),
      list(found.map((match) => `tct discover ${match.package}/${match.component}`)),
    ),
  };
}
