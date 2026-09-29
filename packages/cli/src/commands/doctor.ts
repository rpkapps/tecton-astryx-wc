/**
 * `tct doctor`: a read-only project and environment health check. It never installs, writes or mutates
 * anything, so it is safe as a CI gate (exit 1 on any fail) and for agents to run with `--json`.
 *
 * Status semantics: `pass` healthy; `warn` non-fatal, the setup works but could be better; `fail` broken,
 * drives exit 1; `info` purely informational.
 */
import {existsSync, readdirSync, readFileSync, statSync} from 'node:fs';
import {dirname, join, relative} from 'node:path';
import type {CommandContext, CommandSpec, Outcome} from '../command.ts';
import {expectedBlock, libraryVersion} from '../agent-docs/context.ts';
import {inspectAgentDocs} from '../agent-docs/inspect.ts';
import {discoverAgentDocs} from '../agent-docs/state.ts';
import {VERSION} from '../version.ts';
import {ERROR_CODES, CliError} from '../errors.ts';
import {loadRegistry, type LoadedRegistry} from '../registry/load.ts';
import {closest, list, section, blocks} from '../text.ts';
import type {DoctorCheck, DoctorData} from '../types.ts';

export const MIN_NODE = '22.18.0';

export const doctorSpec: CommandSpec = {
  name: 'doctor',
  summary: 'Diagnose the project setup',
  description:
    'Read-only health check: the Node version, the agent registry, whether @tecton-wc/components is installed and ' +
    'in step with this CLI, whether the stylesheet and the elements you use are loaded, unknown tct-* tags in ' +
    'your sources, the freshness of the agent docs and the detected package manager. It never writes anything, so ' +
    'it is safe as a CI gate.',
  args: [],
  options: [],
  examples: [
    {label: 'Run the checks', cli: 'tct doctor'},
    {label: 'As JSON', cli: 'tct doctor --json'},
  ],
  exitCodes: [
    {code: 0, when: 'no check failed (warnings and info do not affect the exit code)'},
    {code: 1, when: 'at least one check failed'},
  ],
  responseTypes: ['doctor'],
  json: true,
  related: ['init', 'upgrade'],
  run: (context) => runDoctor(context),
};

const semver = (text: string): number[] =>
  text.split('.').map((part) => Number.parseInt(part, 10) || 0);
const atLeast = (version: string, minimum: string): boolean => {
  const a = semver(version);
  const b = semver(minimum);
  for (let i = 0; i < 3; i++) if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0);
  return true;
};

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  '.astro',
  '.nuxt',
  '.svelte-kit',
  'coverage',
  '.claude',
  'reports',
  '.tsbuild',
  '.vite',
]);
/** Sources that can use elements: markup, scripts, templates and styles. Markdown prose and tests are not scanned. */
const SOURCE_FILE =
  /(?<!\.(?:test|spec|node\.test|d))\.(?:html?|[cm]?[jt]sx?|css|scss|vue|svelte|astro)$/;
const MAX_FILES = 3000;
const MAX_BYTES = 512 * 1024;

interface ProjectScan {
  files: number;
  stylesheet: string[];
  families: Set<string>;
  autoloader: boolean;
  defineAll: boolean;
  tags: Map<string, string[]>;
  /** Tags the project defines itself (`customElements.define('x-y')`, `tagName = 'x-y'`). */
  defined: Set<string>;
  truncated: boolean;
}

/** A bounded scan of the project's own sources for the stylesheet, registrations and `tct-*` tags. */
export /** A path relative to the project, or the absolute one when it lies outside it. */
function shortPath(cwd: string, path: string): string {
  const rel = relative(cwd, path);
  return rel === '' || rel.startsWith('..') ? path : rel;
}

function scanProject(cwd: string): ProjectScan {
  const scan: ProjectScan = {
    files: 0,
    stylesheet: [],
    families: new Set(),
    autoloader: false,
    defineAll: false,
    tags: new Map(),
    defined: new Set(),
    truncated: false,
  };
  const visit = (dir: string) => {
    let entries;
    try {
      entries = readdirSync(dir, {withFileTypes: true});
    } catch {
      return;
    }
    for (const entry of entries.sort((a, b) => (a.name < b.name ? -1 : 1))) {
      if (scan.files >= MAX_FILES) {
        scan.truncated = true;
        return;
      }
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name) && !entry.name.startsWith('.')) visit(full);
        continue;
      }
      if (!entry.isFile() || !SOURCE_FILE.test(entry.name)) continue;
      let text: string;
      try {
        if (statSync(full).size > MAX_BYTES) continue;
        text = readFileSync(full, 'utf8');
      } catch {
        continue;
      }
      scan.files++;
      const where = relative(cwd, full);
      if (/@tecton-wc\/(?:components|tokens)\/tecton\.css|\/tecton\.css/.test(text))
        scan.stylesheet.push(where);
      for (const match of text.matchAll(/['"]@tecton-wc\/components\/([a-z0-9-]+)(?:\.js)?['"]/g)) {
        const name = match[1]!;
        if (name === 'autoloader') scan.autoloader = true;
        else if (name === 'define') scan.defineAll = true;
        else if (
          ![
            'tecton',
            'cloak',
            'light-dom',
            'custom-elements',
            'agent-registry',
            'package',
          ].includes(name)
        ) {
          scan.families.add(name);
        }
      }
      if (text.includes('autoloader.js')) scan.autoloader = true;
      for (const match of text.matchAll(
        /(?:customElements\.define\(|tagName\s*=)\s*['"]([a-z][a-z0-9-]*-[a-z0-9-]+)['"]/g,
      )) {
        scan.defined.add(match[1]!);
      }
      // Tags in markup.
      for (const match of text.matchAll(/<(tct-[a-z0-9]+(?:-[a-z0-9]+)*)(?=[\s/>])/g)) {
        const tag = match[1]!;
        scan.tags.set(tag, [...(scan.tags.get(tag) ?? []), where]);
      }
    }
  };
  visit(cwd);
  return scan;
}

function detectPackageManager(cwd: string): {manager: string; via: string} | null {
  for (let dir = cwd; ; dir = dirname(dir)) {
    try {
      const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as {
        packageManager?: string;
      };
      if (pkg.packageManager)
        return {
          manager: pkg.packageManager,
          via: `packageManager in ${relative(cwd, join(dir, 'package.json')) || 'package.json'}`,
        };
    } catch {
      // Keep walking.
    }
    for (const [file, manager] of [
      ['pnpm-lock.yaml', 'pnpm'],
      ['yarn.lock', 'yarn'],
      ['bun.lock', 'bun'],
      ['bun.lockb', 'bun'],
      ['package-lock.json', 'npm'],
    ] as const) {
      if (existsSync(join(dir, file))) return {manager, via: file};
    }
    if (dirname(dir) === dir) return null;
  }
}

function runDoctor(context: CommandContext): Outcome {
  const {cwd, io} = context;
  const checks: DoctorCheck[] = [];
  const add = (check: DoctorCheck) => checks.push(check);

  // 1. Node
  const node = process.versions.node;
  add(
    atLeast(node, MIN_NODE)
      ? {
          id: 'node-version',
          label: 'Node.js version',
          status: 'pass',
          message: `Node v${node} meets the minimum (>=${MIN_NODE}).`,
        }
      : {
          id: 'node-version',
          label: 'Node.js version',
          status: 'fail',
          message: `Node v${node} is below the required minimum (>=${MIN_NODE}).`,
          fix: `Upgrade Node.js to >=${MIN_NODE} and re-run.`,
        },
  );

  // 2. Registry
  let loaded: LoadedRegistry | null = null;
  try {
    loaded = loadRegistry({
      cwd,
      ...(context.global.registry ? {path: context.global.registry} : {}),
      env: io.env,
    });
    add({
      id: 'registry',
      label: 'Agent registry',
      status: 'pass',
      message: `Read ${shortPath(cwd, loaded.path)} (${loaded.source}; schema ${loaded.registry.schemaVersion}, ${loaded.registry.components.length} components, ${loaded.registry.controllers.length} controllers).`,
    });
  } catch (error) {
    add({
      id: 'registry',
      label: 'Agent registry',
      status: 'fail',
      message: (error as Error).message,
      fix:
        error instanceof CliError && error.code === ERROR_CODES.ERR_REGISTRY_NOT_FOUND
          ? 'Install @tecton-wc/components (it ships agent-registry.json), or pass --registry <file>.'
          : 'Regenerate the registry (pnpm generate in the workspace) or align the @tecton-wc package versions.',
    });
  }

  // 3. Components package
  if (loaded) {
    const installed = loaded.source === 'project' || loaded.source === 'workspace';
    add(
      installed
        ? {
            id: 'components-installed',
            label: '@tecton-wc/components installed',
            status: 'pass',
            message: `@tecton-wc/components resolves from this project (${loaded.source}).`,
          }
        : {
            id: 'components-installed',
            label: '@tecton-wc/components installed',
            status: 'warn',
            message: `@tecton-wc/components is not installed for this project; the CLI is answering from ${loaded.source === 'bundled' ? 'its own copy' : `the ${loaded.source} registry`}.`,
            fix: 'Install @tecton-wc/components (workspace, tarball or Git source) so the answers match the version you run.',
          },
    );
    // 4. Alignment
    const library = libraryVersion(loaded);
    const [cliMajor, cliMinor] = semver(VERSION);
    const [libMajor, libMinor] = semver(library);
    add(
      cliMajor === libMajor && cliMinor === libMinor
        ? {
            id: 'version-alignment',
            label: 'CLI and components in step',
            status: 'pass',
            message: `@tecton-wc/components v${library} is in step with @tecton-wc/cli v${VERSION}.`,
          }
        : {
            id: 'version-alignment',
            label: 'CLI and components in step',
            status: 'warn',
            message: `@tecton-wc/components v${library} drifts from @tecton-wc/cli v${VERSION} (major/minor mismatch).`,
            fix: 'Install matching versions of @tecton-wc/cli and @tecton-wc/components.',
          },
    );
  }

  // 5-7. Sources
  const hasPackage = existsSync(join(cwd, 'package.json'));
  if (hasPackage) {
    const scan = scanProject(cwd);
    add(
      scan.stylesheet.length > 0
        ? {
            id: 'stylesheet',
            label: 'Tecton stylesheet',
            status: 'pass',
            message: `tecton.css is loaded (${scan.stylesheet.slice(0, 3).join(', ')}${scan.stylesheet.length > 3 ? ', ...' : ''}).`,
          }
        : {
            id: 'stylesheet',
            label: 'Tecton stylesheet',
            status: scan.tags.size > 0 ? 'warn' : 'info',
            message: `No import or link of tecton.css found in ${scan.files} scanned source file(s)${scan.truncated ? ' (scan truncated)' : ''}.`,
            fix: "Load it once: import '@tecton-wc/components/tecton.css' (or a <link> to the built file). Without it elements render unstyled.",
          },
    );
    const registered = scan.autoloader || scan.defineAll || scan.families.size > 0;
    add(
      registered
        ? {
            id: 'elements-registered',
            label: 'Elements registered',
            status: 'pass',
            message: scan.autoloader
              ? 'The autoloader is imported.'
              : scan.defineAll
                ? 'define.js registers every element.'
                : `Families imported: ${[...scan.families].sort().join(', ')}.`,
          }
        : {
            id: 'elements-registered',
            label: 'Elements registered',
            status: scan.tags.size > 0 ? 'warn' : 'info',
            message:
              scan.tags.size > 0
                ? `${scan.tags.size} tct-* tag(s) are used but nothing registers them.`
                : 'No tct-* elements used yet.',
            ...(scan.tags.size > 0
              ? {
                  fix: "Import the families you use (import '@tecton-wc/components/button') or the autoloader (@tecton-wc/components/autoloader.js).",
                }
              : {}),
          },
    );
    if (loaded && scan.tags.size > 0) {
      const known = new Set([
        ...loaded.registry.components.flatMap((component) => component.tags),
        ...scan.defined,
      ]);
      const unknown = [...scan.tags.keys()].filter((tag) => !known.has(tag)).sort();
      const shown = unknown.slice(0, 8);
      const more = unknown.length > shown.length ? ` (+${unknown.length - shown.length} more)` : '';
      add(
        unknown.length === 0
          ? {
              id: 'unknown-elements',
              label: 'Element names',
              status: 'pass',
              message: `All ${scan.tags.size} tct-* tag(s) used exist.`,
            }
          : {
              id: 'unknown-elements',
              label: 'Element names',
              status: 'warn',
              message: `Unknown tct-* tag(s): ${shown
                .map((tag) => `${tag} (${scan.tags.get(tag)![0]})`)
                .join(', ')}${more}.`,
              fix: shown
                .map((tag) => {
                  const near = closest(tag, [...known], 1);
                  return near[0]
                    ? `${tag} -> did you mean ${near[0]}?`
                    : `${tag}: run \`tct search ${tag.replace(/^tct-/, '')}\``;
                })
                .join(' '),
            },
      );
    }
  }

  // 8. Agent docs
  if (loaded) {
    const docs = discoverAgentDocs(cwd);
    if (docs.length === 0) {
      add({
        id: 'agent-docs',
        label: 'Agent docs',
        status: 'info',
        message: 'No agent docs (AGENTS.md, CLAUDE.md, .cursorrules) found.',
        fix: 'Generate them with `tct init --features agents`.',
      });
    } else {
      const {block} = expectedBlock(context);
      const inspection = inspectAgentDocs(cwd, block);
      const path = inspection.files
        .filter((file) => inspection.status === 'current' || file.state !== 'current')
        .map((file) => file.path)
        .join(', ');
      add(
        inspection.status === 'current'
          ? {
              id: 'agent-docs',
              label: 'Agent docs',
              status: 'pass',
              message: `The agent-docs block is current in ${path}.`,
            }
          : inspection.status === 'missing'
            ? {
                id: 'agent-docs',
                label: 'Agent docs',
                status: 'warn',
                message: `Agent docs present (${docs.join(', ')}) but none carries the managed block.`,
                fix: 'Run `tct init --features agents`.',
              }
            : {
                id: 'agent-docs',
                label: 'Agent docs',
                status: 'warn',
                message: `The agent-docs block is ${inspection.status} in ${path}.`,
                fix:
                  inspection.status === 'malformed'
                    ? 'Repair the TCT markers by hand, then run `tct upgrade --apply`.'
                    : 'Run `tct upgrade --apply`.',
              },
      );
    }
  }

  // 9. Package manager, 10. npm script alias
  const manager = detectPackageManager(cwd);
  add({
    id: 'package-manager',
    label: 'Package manager',
    status: 'info',
    message: manager
      ? `Detected package manager: ${manager.manager} (${manager.via}).`
      : 'No lockfile detected: using the neutral npx form.',
  });
  if (hasPackage) {
    let hasScript = false;
    try {
      hasScript = Boolean(
        (
          JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf8')) as {
            scripts?: Record<string, string>;
          }
        ).scripts?.tct,
      );
    } catch {
      // Unreadable package.json: nothing to say.
    }
    if (!hasScript) {
      add({
        id: 'tct-script',
        label: 'tct script alias',
        status: 'info',
        message: 'No "tct" script in package.json.',
        fix: 'Add "scripts": {"tct": "tct"} so agents run one stable command instead of guessing a path.',
      });
    }
  }

  const summary = {
    pass: checks.filter((check) => check.status === 'pass').length,
    warn: checks.filter((check) => check.status === 'warn').length,
    fail: checks.filter((check) => check.status === 'fail').length,
    info: checks.filter((check) => check.status === 'info').length,
  };
  const data: DoctorData = {checks, summary};
  const mark = {pass: '[ok]', warn: '[!!]', fail: '[xx]', info: '[--]'} as const;
  const text = context.global.dense
    ? checks
        .filter((check) => check.status !== 'pass')
        .map(
          (check) =>
            `${check.status} ${check.id}: ${check.message}${check.fix ? ` fix: ${check.fix}` : ''}`,
        )
        .join('\n') || `all ${summary.pass} checks passed`
    : blocks(
        section('tct doctor'),
        list(
          checks.map(
            (check) =>
              `${mark[check.status]} ${check.label}: ${check.message}${check.fix ? `\n    fix: ${check.fix}` : ''}`,
          ),
        ),
        `${summary.pass} passed, ${summary.warn} warning(s), ${summary.fail} failed, ${summary.info} info`,
      );
  return {type: 'doctor', data, text, exitCode: summary.fail > 0 ? 1 : 0};
}
