/**
 * D-015 rename codemod. Run it on a branch after merging the rename, to bring the files that branch added
 * or changed up to the new names:
 *
 *   node tools/codemods/d015-rename.ts             rewrite the working tree, print what changed
 *   node tools/codemods/d015-rename.ts --dry-run   print what would change, write nothing
 *   node tools/codemods/d015-rename.ts --no-format do not run prettier on the files it changed
 *
 * It is idempotent (a second run changes nothing) and has no dependencies. It rewrites:
 *
 *  1. the package scope          `@tecton-astryx/`         -> `@tecton-wc/`
 *  2. shipped message ids        `@astryx.<ns>.<key>`      -> `@tct.<ns>.<key>` (never the upstream catalogs)
 *  3. the vendor path            `/vendor/tecton-astryx/`  -> `/vendor/tecton-wc/`
 *  4. token status ids           `'tecton-astryx'`         -> `'tecton-binding'`
 *                                `astryx-retained`         -> `retained-default`
 *  5. hygiene for the shipped Custom Elements Manifest: a `@csspart` line's "(Astryx target `astryx-x`)" note
 *     is dropped from component sources, and "tecton-astryx components.ts" in component CSS comments names
 *     the Tecton reference theme (D-015: nothing that ships names the upstream design system).
 *
 * Not touched: node_modules, dist, generated, `.git`, `.claude`, the upstream message catalogs
 * (`packages/locales/src/catalogs/`, byte-identical by decision), `docs/plan/` and `docs/research/`
 * (historic and internal), and this directory. Prose that says "Astryx" is not rewritten: new prose says
 * "upstream" (D-015), and `pnpm docs:public-check` reports what is left in anything that ships.
 *
 * The shorter names can let an import fit on one line, so the changed files are then formatted with the
 * repository's prettier (`pnpm exec prettier --write --ignore-unknown`).
 *
 * After running it: `pnpm install --offline` (workspace-only lockfile changes) and `pnpm check`.
 */
import {spawnSync} from 'node:child_process';
import {readFileSync, readdirSync, statSync, writeFileSync} from 'node:fs';
import {join, relative, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';

export interface Rule {
  /** Short name printed in the summary. */
  name: string;
  pattern: RegExp;
  replacement: string;
  /** Repository-relative POSIX path filter; every file when absent. */
  only?: RegExp;
}

// The old spellings are written so this file never matches its own rules (it is skipped anyway).
export const RULES: readonly Rule[] = [
  {name: 'package scope', pattern: /@tecton-astryx\//g, replacement: '@tecton-wc/'},
  // Followed by an identifier start (or a placeholder / wildcard): a bare prefix constant stays as it is.
  {name: 'message ids', pattern: /@astryx\.(?=[A-Za-z<*$])/g, replacement: '@tct.'},
  {name: 'vendor path', pattern: /\/vendor\/tecton-astryx\//g, replacement: '/vendor/tecton-wc/'},
  {name: 'token status', pattern: /(['"`])tecton-astryx\1/g, replacement: '$1tecton-binding$1'},
  {name: 'token status', pattern: /\bastryx-retained\b/g, replacement: 'retained-default'},
  {name: 'token status', pattern: /\bastryxRetainedNonTokens\b/g, replacement: 'retainedNonTokens'},
  // "(Astryx target `astryx-x`)" in a component's JSDoc feeds the shipped manifest.
  {
    name: 'csspart notes',
    pattern: / \(Astryx target `[^`]*`\)/g,
    replacement: '',
    only: /^packages\/components\/src\/.*\.ts$/,
  },
  {
    name: 'csspart notes',
    pattern: / \(Astryx target `[^`]*`[;,] /g,
    replacement: ' (',
    only: /^packages\/components\/src\/.*\.ts$/,
  },
  {
    name: 'csspart notes',
    pattern: /, Astryx target `[^`]*`\)/g,
    replacement: ')',
    only: /^packages\/components\/src\/.*\.ts$/,
  },
  {
    name: 'csspart notes',
    pattern: / Astryx target `[^`]*`\./g,
    replacement: '',
    only: /^packages\/components\/src\/.*\.ts$/,
  },
  {
    name: 'css comments',
    pattern: /tecton-astryx components\.ts/g,
    replacement: "the Tecton reference theme's components.ts",
    only: /^packages\/components\/src\/.*\.css$/,
  },
];

/** Directory names never entered. */
const SKIPPED_DIRS = new Set([
  'node_modules',
  'dist',
  'generated',
  '.git',
  '.claude',
  '.astro',
  '.tsbuild',
  '.vite',
  '.cache',
  'coverage',
  'reports',
  '__screenshots__',
]);
/** Repository-relative POSIX prefixes never rewritten. */
const SKIPPED_PREFIXES = [
  'packages/locales/src/catalogs/',
  'docs/plan/',
  'docs/research/',
  'tools/codemods/',
];
const BINARY = /\.(?:woff2?|ttf|otf|png|jpe?g|gif|webp|avif|ico|pdf|zip|gz|mp4|webm)$/i;
const MAX_BYTES = 5 * 1024 * 1024;

export function isSkipped(path: string): boolean {
  return SKIPPED_PREFIXES.some((prefix) => path.startsWith(prefix)) || BINARY.test(path);
}

export interface FileResult {
  path: string;
  text: string;
  /** Replacements made per rule name. */
  counts: Record<string, number>;
}

/** Applies every rule to one file's text. `path` is repository-relative and POSIX-separated. */
export function transform(path: string, text: string): FileResult {
  const counts: Record<string, number> = {};
  let out = text;
  for (const rule of RULES) {
    if (rule.only && !rule.only.test(path)) continue;
    out = out.replace(rule.pattern, (...args) => {
      counts[rule.name] = (counts[rule.name] ?? 0) + 1;
      // Expand `$1` style groups the way String.replace would.
      return rule.replacement.replace(/\$(\d)/g, (_m, n: string) => String(args[Number(n)] ?? ''));
    });
  }
  return {path, text: out, counts};
}

function* walk(root: string, dir: string = root): Generator<string> {
  for (const entry of readdirSync(dir, {withFileTypes: true})) {
    if (entry.isDirectory()) {
      if (!SKIPPED_DIRS.has(entry.name)) yield* walk(root, join(dir, entry.name));
    } else if (entry.isFile()) {
      yield join(dir, entry.name);
    }
  }
}

export interface RunOptions {
  root: string;
  dryRun?: boolean;
}

export interface RunResult {
  changed: {path: string; counts: Record<string, number>}[];
  scanned: number;
}

/** Rewrites (or, with `dryRun`, only reports) every text file under `root`. */
export function run({root, dryRun = false}: RunOptions): RunResult {
  const changed: RunResult['changed'] = [];
  let scanned = 0;
  for (const file of walk(root)) {
    const path = relative(root, file).split(sep).join('/');
    if (isSkipped(path) || statSync(file).size > MAX_BYTES) continue;
    const before = readFileSync(file);
    // Skip binary content that slipped past the extension check.
    if (before.includes(0)) continue;
    scanned++;
    const text = before.toString('utf8');
    const result = transform(path, text);
    if (result.text === text) continue;
    if (!dryRun) writeFileSync(file, result.text);
    changed.push({path, counts: result.counts});
  }
  return {changed, scanned};
}

/** Formats the changed files with the repository's prettier (unknown file types are ignored). */
function format(root: string, paths: readonly string[]): void {
  for (let i = 0; i < paths.length; i += 80) {
    const result = spawnSync(
      'pnpm',
      [
        'exec',
        'prettier',
        '--write',
        '--ignore-unknown',
        '--log-level',
        'warn',
        ...paths.slice(i, i + 80),
      ],
      {cwd: root, stdio: 'inherit'},
    );
    if (result.status !== 0) {
      console.warn('  prettier did not run cleanly; run `pnpm format` before `pnpm check`.');
      return;
    }
  }
}

function main(): void {
  const dryRun = process.argv.includes('--dry-run');
  const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
  const {changed, scanned} = run({root, dryRun});
  const totals: Record<string, number> = {};
  for (const file of changed) {
    const detail = Object.entries(file.counts)
      .map(([name, count]) => `${name} x${count}`)
      .join(', ');
    console.log(`  ${dryRun ? 'would change' : 'changed'}  ${file.path}  (${detail})`);
    for (const [name, count] of Object.entries(file.counts))
      totals[name] = (totals[name] ?? 0) + count;
  }
  const summary = Object.entries(totals)
    .map(([name, count]) => `${name}: ${count}`)
    .join('; ');
  console.log(
    `d015-rename: ${dryRun ? 'would change' : 'changed'} ${changed.length} of ${scanned} file(s)` +
      (summary ? ` (${summary})` : '') +
      '.',
  );
  if (changed.length > 0 && !dryRun && !process.argv.includes('--no-format')) {
    format(
      root,
      changed.map((file) => file.path),
    );
  }
  if (changed.length > 0 && !dryRun) {
    console.log('Next: pnpm install --offline (lockfile), then pnpm check.');
  }
}

if (process.argv[1] && import.meta.filename === process.argv[1]) main();
