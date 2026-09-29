/**
 * Size bundles (A§18.4): bundles one self-contained, minified file per measured entry into
 * `reports/size/` and writes `reports/size/budgets.json` (`{"<entry>.js": <kB>}`) for `.size-limit.js`.
 *
 *   runtime.js       shared runtime: TctElement, defineElement, events, context; `lit` external (<= 10 kB)
 *   autoloader.js    the autoloader (families load lazily, so they are not part of it)
 *   <folder>.js      a family's `define.ts` with lit and core included; lazy chunks (Floating UI, DOMPurify,
 *                    locales) are code-split into `chunks/` and are not counted
 *
 * Budgets: `parity.json` `sizeBudgetKb` when set, else by upstream complexity S 12, M 16, L 22, XL 30 kB
 * (all including lit). Revise after real measurements (WORK-BREAKDOWN acceptance 13).
 * `measured.json` records raw, gzip and brotli sizes for the hand-off.
 */
import {mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {brotliCompressSync, gzipSync} from 'node:zlib';
import {build} from 'vite';
import {libraryConfig} from '../build/vite.ts';
import {componentFolderNames} from '../lib/docs-model.ts';
import {walkFiles} from '../lib/fs.ts';
import {loadManifest, type Manifest} from '../lib/parity.ts';
import {PATHS} from '../lib/paths.ts';

export const COMPLEXITY_BUDGET_KB: Readonly<Record<string, number>> = {S: 12, M: 16, L: 22, XL: 30};
export const RUNTIME_BUDGET_KB = 10;
export const AUTOLOADER_BUDGET_KB = 3;

const SIZE_DIR = join(PATHS.reports, 'size');
const ENTRY_DIR = join(SIZE_DIR, '.entries');
const LIT = /^(lit|lit-html|lit-element|@lit\/|@lit-labs\/)/;

const RANK = ['S', 'M', 'L', 'XL'];

/** Temporary per-folder budgets (see the file's comment); they win over every other source. */
const PROVISIONAL = (
  JSON.parse(readFileSync(join(import.meta.dirname, 'provisional-budgets.json'), 'utf8')) as {
    budgets: Record<string, number>;
  }
).budgets;

/**
 * Budget of a folder in kB: a provisional override, else an explicit `sizeBudgetKb`, else the largest
 * upstream complexity it implements.
 */
export function folderBudgetKb(folder: string, manifest: Manifest): number {
  const provisional = PROVISIONAL[folder];
  if (provisional !== undefined) return provisional;
  const file = join(PATHS.componentsSrc, folder, 'parity.json');
  let explicit: number | undefined;
  let complexity = 'M';
  try {
    const parity = JSON.parse(readFileSync(file, 'utf8')) as {
      entries: Record<string, {sizeBudgetKb?: number | null}>;
    };
    const byId = new Map(
      (manifest.entries as (Manifest['entries'][number] & {complexity?: string})[]).map((entry) => [
        entry.id,
        entry,
      ]),
    );
    let best = -1;
    for (const [id, entry] of Object.entries(parity.entries)) {
      if (typeof entry.sizeBudgetKb === 'number')
        explicit = Math.max(explicit ?? 0, entry.sizeBudgetKb);
      const rank = RANK.indexOf(byId.get(id)?.complexity ?? '');
      if (rank > best) {
        best = rank;
        complexity = RANK[rank]!;
      }
    }
  } catch {
    // No parity.json: the default complexity applies.
  }
  return explicit ?? COMPLEXITY_BUDGET_KB[complexity]!;
}

function runtimeSources(): string[] {
  const core = PATHS.coreSrc;
  const isSource = (file: string) =>
    file.endsWith('.ts') && !file.endsWith('.d.ts') && !/\.(?:node\.)?test\.ts$/.test(file);
  return [
    join(core, 'tct-element.ts'),
    join(core, 'define.ts'),
    ...walkFiles(join(core, 'events')).filter(isSource),
    ...walkFiles(join(core, 'context')).filter(isSource),
  ].sort();
}

async function bundle(
  name: string,
  entryFile: string,
  external?: (id: string) => boolean,
): Promise<void> {
  await build({
    ...libraryConfig({
      entry: {[name]: entryFile},
      outDir: SIZE_DIR,
      srcRoot: PATHS.componentsSrc,
      bundle: true,
      chunkDir: 'chunks',
      ...(external ? {external} : {}),
    }),
  });
}

export interface Measured {
  entry: string;
  bytes: number;
  gzip: number;
  brotli: number;
  budgetKb: number;
}

export async function buildSizeEntries(): Promise<Measured[]> {
  rmSync(SIZE_DIR, {recursive: true, force: true});
  mkdirSync(ENTRY_DIR, {recursive: true});
  const manifest = loadManifest(PATHS.manifest);
  const budgets: Record<string, number> = {};

  // Shared runtime, lit external.
  const runtimeEntry = join(ENTRY_DIR, 'runtime.ts');
  writeFileSync(
    runtimeEntry,
    `${runtimeSources()
      .map((file) => `export * from ${JSON.stringify(file)};`)
      .join('\n')}\n`,
  );
  await bundle('runtime', runtimeEntry, (id) => LIT.test(id));
  budgets['runtime.js'] = RUNTIME_BUDGET_KB;

  await bundle('autoloader', join(PATHS.componentsSrc, 'autoloader.ts'));
  budgets['autoloader.js'] = AUTOLOADER_BUDGET_KB;

  for (const folder of componentFolderNames(PATHS.componentsSrc)) {
    await bundle(folder, join(PATHS.componentsSrc, folder, 'define.ts'));
    budgets[`${folder}.js`] = folderBudgetKb(folder, manifest);
  }
  rmSync(ENTRY_DIR, {recursive: true, force: true});

  writeFileSync(join(SIZE_DIR, 'budgets.json'), `${JSON.stringify(budgets, null, 2)}\n`);
  const measured: Measured[] = readdirSync(SIZE_DIR)
    .filter((name) => name.endsWith('.js'))
    .sort()
    .map((name) => {
      const content = readFileSync(join(SIZE_DIR, name));
      return {
        entry: name,
        bytes: content.length,
        gzip: gzipSync(content).length,
        brotli: brotliCompressSync(content).length,
        budgetKb: budgets[name] ?? 0,
      };
    });
  writeFileSync(join(SIZE_DIR, 'measured.json'), `${JSON.stringify(measured, null, 2)}\n`);
  return measured;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const measured = await buildSizeEntries();
  for (const row of measured) {
    console.log(
      `  size bundle ${row.entry.padEnd(28)} ${(row.gzip / 1000).toFixed(2)} kB gzip / budget ${row.budgetKb} kB`,
    );
  }
}
