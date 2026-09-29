/**
 * The managed agent-docs block: what `tct init --features agents` writes between the TCT markers.
 *
 * Structure: header and CLI prefix, setup (once), the workflow (discover before you write), the rules that
 * prevent the common mistakes, the CLI reference and an index of every element by category. It is generated
 * from the registry and the project, so it is never hand-maintained, and it records a hash of its own body:
 * a block whose body no longer matches its hash was edited by hand, and `tct upgrade` will not overwrite it
 * without `--force`.
 */
import {createHash} from 'node:crypto';
import {existsSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import type {AgentRegistry} from '../registry/types.ts';
import {MARKER_END, MARKER_START} from './state.ts';

export interface BlockInput {
  registry: AgentRegistry;
  /** Version of the component library the registry belongs to. */
  version: string;
  /** How to run the CLI in this project, e.g. `pnpm tct` or `npx --no-install tct`. */
  invocation: string;
}

const sha = (text: string): string => createHash('sha256').update(text).digest('hex').slice(0, 12);

/** The hash line of a block: the SHA-256 (12 hex) of every line between the hash line and the end marker. */
const HASH_LINE = /^<!-- tct:sha ([0-9a-f]{12}) -->$/;

/**
 * How to invoke the CLI in a project, so the block never names a command that would fetch an unrelated
 * package: a `tct` npm script is preferred; else the package manager's exec form with downloads refused.
 */
export function detectInvocation(dir: string): string {
  let manager = 'npm';
  try {
    const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as {
      packageManager?: string;
      scripts?: Record<string, string>;
    };
    const declared = pkg.packageManager?.split('@')[0];
    if (declared === 'pnpm' || declared === 'yarn' || declared === 'bun' || declared === 'npm')
      manager = declared;
    else if (existsSync(join(dir, 'pnpm-lock.yaml'))) manager = 'pnpm';
    else if (existsSync(join(dir, 'yarn.lock'))) manager = 'yarn';
    else if (existsSync(join(dir, 'bun.lock')) || existsSync(join(dir, 'bun.lockb')))
      manager = 'bun';
    if (pkg.scripts?.tct) return manager === 'npm' ? 'npm run tct --' : `${manager} tct`;
  } catch {
    // No readable package.json: the neutral form below.
  }
  return 'npx --no-install tct';
}

const RULES = [
  "- Use `tct-*` elements before raw HTML for what they cover, and register the families you use (`import '@tecton-wc/components/<folder>'`, or the autoloader).",
  '- Layout and spacing come from the layout elements (tct-stack, tct-hstack, tct-vstack, tct-grid, tct-center, tct-card, tct-section), never from hand-written CSS or inline `style` on wrappers. Read `tct layout grammar`.',
  '- Never invent attributes, slots or events: read `tct component <tag>` first (`--dense` for the token-efficient form).',
  '- Tokens for every value: `var(--color-*)`, `var(--spacing-*)`, `var(--radius-*)`. No hex or px literals. Customise through attributes, `::part()`, `:state()` and documented custom properties.',
  '- Structured data (items, options) is set as a property, never as a JSON attribute.',
  '- Icon-only buttons need a `label`. Form controls need a `label` and a `name`. Use `tct-link` for navigation and real `<form>` elements for forms.',
  '- SELF-CHECK before you finish: re-read the markup and replace raw `<div>`/`<span>` layout, inline `style` and hard-coded colours or sizes with the elements and tokens. If unsure an element or attribute exists, run `tct component <tag>` or `tct search "<thing>"`; do not hand-roll CSS.',
];

/** The body between the hash line and the end marker (what the hash covers). */
function renderBody(input: BlockInput): string[] {
  const {registry, invocation, version} = input;
  const count = registry.components.reduce((total, component) => total + component.tags.length, 0);
  const lines: string[] = [];
  lines.push(`${registry.library.name} v${version} · ${count} elements`);
  lines.push(`CLI: run every command as \`${invocation} <cmd>\` (shown below as \`tct ...\`).`);
  lines.push('');
  lines.push('SETUP (once, in your app entry) — without the stylesheet, elements render unstyled:');
  lines.push("  import '@tecton-wc/components/tecton.css';");
  lines.push("  import '@tecton-wc/components/autoloader.js';  // or import each family you use");
  lines.push('');
  lines.push("WORKFLOW — discover, don't guess. Before writing UI:");
  lines.push('1. `tct search "<what you need>"` — find the element, controller or doc topic.');
  lines.push(
    '2. `tct component <tag> --dense` — attributes, slots, events and examples for every element you use.',
  );
  lines.push(
    '3. `tct docs <topic>` — the guide for the pattern (layout, forms, styling, accessibility).',
  );
  lines.push('');
  lines.push('RULES:');
  lines.push(...RULES);
  lines.push('');
  lines.push('MORE CLI:');
  lines.push('  search "<query>"      find any element / controller / doc topic');
  lines.push(`  component --list      ${count} elements by category`);
  lines.push('  controllers [name]    runtime controllers and utilities for building elements');
  const topics = registry.topics.map((topic) => topic.slug);
  if (topics.length > 0) lines.push(`  docs <topic>          ${topics.join(', ')}`);
  lines.push(
    '  layout check|expand   validate or expand a compressed layout expression to tct-* markup',
  );
  lines.push('  doctor                diagnose the project setup');
  lines.push('  upgrade --apply       run after any @tecton-wc dependency bump');
  lines.push('');
  lines.push(`ELEMENTS (${count}), by category — details: \`tct component <tag>\`:`);
  for (const category of registry.categories) {
    const tags = registry.components
      .filter((component) => component.category === category)
      .flatMap((component) => component.tags);
    if (tags.length > 0) lines.push(`  ${category}: ${tags.join(', ')}`);
  }
  return lines;
}

/** The complete block, markers included. */
export function renderBlock(input: BlockInput): string {
  const body = renderBody(input).join('\n');
  return [MARKER_START, `<!-- tct:sha ${sha(body)} -->`, body, MARKER_END].join('\n');
}

export interface BlockFacts {
  /** The library version recorded in the header, when readable. */
  version: string | null;
  /** True when the body still matches the hash recorded with it (not edited by hand). */
  intact: boolean;
}

/** Facts about an existing block (text including markers). */
export function readBlock(block: string): BlockFacts {
  const lines = block.split('\n');
  const hashLine = lines[1] ?? '';
  const match = HASH_LINE.exec(hashLine);
  const bodyLines = lines.slice(2, lines.length - 1);
  const body = bodyLines.join('\n');
  const version = /· ?/.test(bodyLines[0] ?? '')
    ? (/ v(\d+\.\d+\.\d+[^\s·]*)/.exec(bodyLines[0] ?? '')?.[1] ?? null)
    : null;
  return {version, intact: match !== null && match[1] === sha(body)};
}
