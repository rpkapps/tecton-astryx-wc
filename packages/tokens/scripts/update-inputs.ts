/**
 * `node packages/tokens/scripts/update-inputs.ts [--check]`
 *
 * Maintainer script (never part of `pnpm generate`): copies the hash-locked token inputs from their
 * reference locations into `src/inputs/`, derives the two extracted inputs, and rewrites
 * `inputs.lock.json` (A§5.1).
 *
 *   tecton.tokens.json, tecton-tokens.css   <- owner's tecton-webcomponents (D-001 export)
 *   semantic-map.json                        <- docs/research/tecton-semantic-map.json
 *   upstream-tokens.json                       <- the upstream design system @ ca632c6: names checked against
 *                                               tokens.stylex.ts, dataTokens.ts, syntax/tokens.ts;
 *                                               defaults come from the semantic map
 *   tailwind-v4-theme-names.json             <- tailwindcss@4 `theme.css` (path via --tailwind=<file>;
 *                                               kept as is when the flag is absent)
 *
 * Environment overrides: TCT_TECTON_WC_TOKENS, TCT_UPSTREAM_REF.
 * `--check` recomputes every hash and reports drift without writing.
 */
import {createHash} from 'node:crypto';
import {existsSync, readFileSync, writeFileSync, copyFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const PKG = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const INPUTS = join(PKG, 'src/inputs');
const REPO = resolve(PKG, '../..');

const WC_TOKENS =
  process.env.TCT_TECTON_WC_TOKENS ?? '/home/user/rpkapps/tecton-webcomponents/packages/wc/tokens';
const UPSTREAM = process.env.TCT_UPSTREAM_REF ?? '/home/user/refs/astryx';
const UPSTREAM_COMMIT = 'ca632c6594b03aa3933ce9b35d1f6128fbad7a47';

interface LockEntry {
  sha256: string;
  bytes: number;
  origin: string;
}

const sha256 = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');

function main(): number {
  const check = process.argv.includes('--check');
  const tailwindFlag = process.argv.find((arg) => arg.startsWith('--tailwind='))?.slice(11);

  const origins: Record<string, string> = {
    'tecton.tokens.json': 'tecton-webcomponents/packages/wc/tokens/tecton.tokens.json',
    'tecton-tokens.css': 'tecton-webcomponents/packages/wc/tokens/tecton-tokens.css',
    'semantic-map.json': 'docs/research/tecton-semantic-map.json',
    'upstream-tokens.json': `upstream@${UPSTREAM_COMMIT.slice(0, 7)} theme/tokens.stylex.ts + domainTokens/dataTokens.ts + syntax/tokens.ts (names), semantic map (defaults)`,
    'tailwind-v4-theme-names.json':
      'tailwindcss@4.3.3 theme.css (sha256 of the source in `source`)',
  };

  if (!check) {
    copyFileSync(join(WC_TOKENS, 'tecton.tokens.json'), join(INPUTS, 'tecton.tokens.json'));
    copyFileSync(join(WC_TOKENS, 'tecton-tokens.css'), join(INPUTS, 'tecton-tokens.css'));
    copyFileSync(
      join(REPO, 'docs/research/tecton-semantic-map.json'),
      join(INPUTS, 'semantic-map.json'),
    );
    writeFileSync(join(INPUTS, 'upstream-tokens.json'), buildUpstreamTokens());
    if (tailwindFlag)
      writeFileSync(join(INPUTS, 'tailwind-v4-theme-names.json'), buildTailwind(tailwindFlag));
  }

  const files: Record<string, LockEntry> = {};
  for (const name of Object.keys(origins).sort()) {
    const path = join(INPUTS, name);
    if (!existsSync(path)) {
      console.error(`missing input ${name}`);
      return 1;
    }
    files[name] = {sha256: sha256(path), bytes: readFileSync(path).length, origin: origins[name]!};
  }
  const lock = `${JSON.stringify({version: 1, files}, null, 2)}\n`;
  const lockPath = join(INPUTS, 'inputs.lock.json');
  if (check) {
    if (!existsSync(lockPath) || readFileSync(lockPath, 'utf8') !== lock) {
      console.error('inputs.lock.json is out of date; run update-inputs without --check');
      return 1;
    }
    console.log('inputs.lock.json matches');
    return 0;
  }
  writeFileSync(lockPath, lock);
  for (const [name, entry] of Object.entries(files)) console.log(`${entry.sha256}  ${name}`);
  return 0;
}

/** Names found as quoted custom-property keys in an upstream token source file. */
function upstreamNames(relPath: string): string[] {
  const text = readFileSync(join(UPSTREAM, 'packages/core/src', relPath), 'utf8');
  return [...text.matchAll(/^\s*'(--[a-z0-9-]+)'\s*:/gm)].map((match) => match[1]!);
}

function buildUpstreamTokens(): string {
  const map = JSON.parse(readFileSync(join(INPUTS, 'semantic-map.json'), 'utf8')) as {
    tokens: Record<string, {category: string; upstreamDefault: string}>;
  };
  const files = [
    'theme/tokens.stylex.ts',
    'theme/domainTokens/dataTokens.ts',
    'theme/syntax/tokens.ts',
  ];
  const fromUpstream = new Set(files.flatMap(upstreamNames));
  const fromMap = new Set(Object.keys(map.tokens));
  const missing = [...fromUpstream].filter((name) => !fromMap.has(name));
  const extra = [...fromMap].filter((name) => !fromUpstream.has(name));
  if (missing.length > 0 || extra.length > 0) {
    throw new Error(
      `semantic map and upstream disagree. missing in map: ${missing.join(', ')}; not upstream: ${extra.join(', ')}`,
    );
  }
  const tokens: Record<string, {category: string; default: string}> = {};
  for (const name of [...fromUpstream].sort()) {
    const entry = map.tokens[name]!;
    tokens[name] = {category: entry.category, default: entry.upstreamDefault};
  }
  return `${JSON.stringify(
    {
      source: {
        repository: 'upstream design system (read-only reference)',
        commit: UPSTREAM_COMMIT,
        files: files.map((file) => `packages/core/src/${file}`),
        note: 'Names are extracted from the upstream sources; defaults are the upstream values recorded in the semantic map.',
      },
      count: fromUpstream.size,
      tokens,
    },
    null,
    2,
  )}\n`;
}

function buildTailwind(themeCss: string): string {
  const css = readFileSync(themeCss, 'utf8');
  const names = [
    ...new Set([...css.matchAll(/^\s*(--[a-z0-9-]+)\s*:/gm)].map((match) => match[1]!)),
  ];
  return `${JSON.stringify(
    {
      source: {package: 'tailwindcss@4.3.3', file: 'theme.css', sha256: sha256(themeCss)},
      note: 'Custom properties declared by the Tailwind v4 default theme; used for the collision check.',
      count: names.length,
      names: names.sort(),
    },
    null,
    2,
  )}\n`;
}

process.exit(main());
