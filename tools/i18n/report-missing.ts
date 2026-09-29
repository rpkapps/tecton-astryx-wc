/**
 * `pnpm generate` step: writes `reports/i18n-missing.json` (A§3).
 *
 * Catalog ids = the 370 upstream ids (`@astryx.*`) in `packages/locales/src/catalogs/en.json` plus the
 * new English ids of every `<folder>/<folder>.messages.json` (`@tct.<folder>.<key>`). The report lists,
 * per shipped locale, which catalog ids have no translation (new `@tct.*` ids exist in English only
 * until translated), and every message id used in source that no catalog defines (a typo or a
 * missing messages file). It informs; it does not fail the build.
 */
import {existsSync, readFileSync, readdirSync} from 'node:fs';
import {join} from 'node:path';
import {writeIfChanged, walkFiles} from '../lib/fs.ts';
import {PATHS, ROOT, rel} from '../lib/paths.ts';
import {
  flatten,
  parseFolderMessages,
  type UpstreamCatalog,
} from '../../packages/locales/scripts/lib.ts';

const catalogsDir = join(ROOT, 'packages/locales/src/catalogs');
if (!existsSync(catalogsDir)) {
  console.log('  skip  i18n missing report (no catalogs)');
  process.exit(0);
}

const readCatalog = (tag: string) =>
  flatten(JSON.parse(readFileSync(join(catalogsDir, `${tag}.json`), 'utf8')) as UpstreamCatalog);

const tags = readdirSync(catalogsDir)
  .filter((name) => name.endsWith('.json'))
  .map((name) => name.replace(/\.json$/, ''))
  .sort();
const english = readCatalog('en');

const folderIds: Record<string, string[]> = {};
const allIds = new Set(Object.keys(english));
for (const entry of readdirSync(PATHS.componentsSrc, {withFileTypes: true})) {
  if (!entry.isDirectory()) continue;
  const file = join(PATHS.componentsSrc, entry.name, `${entry.name}.messages.json`);
  if (!existsSync(file)) continue;
  const messages = parseFolderMessages(
    entry.name,
    JSON.parse(readFileSync(file, 'utf8')) as unknown,
    file,
  );
  folderIds[entry.name] = Object.keys(messages).sort();
  for (const id of folderIds[entry.name]!) allIds.add(id);
}

const locales: Record<string, {translated: number; missing: string[]}> = {};
for (const tag of tags) {
  if (tag === 'en') continue;
  const catalog = readCatalog(tag);
  const missing = [...allIds].filter((id) => !(id in catalog)).sort();
  locales[tag] = {translated: allIds.size - missing.length, missing};
}

// Ids referenced in shipped source.
const ID_LITERAL = /['"`](@(?:astryx|tct)\.[A-Za-z0-9_.-]+)['"`]/g;
const unknown: {id: string; file: string}[] = [];
for (const root of [PATHS.componentsSrc, PATHS.coreSrc]) {
  for (const file of walkFiles(root, {skipDirs: ['generated', '__snapshots__', 'examples']})) {
    if (!file.endsWith('.ts') || /\.(?:node\.)?test\.ts$/.test(file) || file.endsWith('.d.ts'))
      continue;
    for (const match of readFileSync(file, 'utf8').matchAll(ID_LITERAL)) {
      const id = match[1]!;
      if (!allIds.has(id) && !unknown.some((u) => u.id === id && u.file === rel(file)))
        unknown.push({id, file: rel(file)});
    }
  }
}

const report = {
  baseline: {
    upstreamIds: Object.keys(english).length,
    newIds: Object.values(folderIds).reduce((sum, ids) => sum + ids.length, 0),
    totalIds: allIds.size,
    folders: folderIds,
  },
  locales,
  unknownIdsInSource: unknown.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
};
const path = join(PATHS.reports, 'i18n-missing.json');
writeIfChanged(path, `${JSON.stringify(report, null, 2)}\n`);
const untranslated = Object.values(locales).filter((locale) => locale.missing.length > 0).length;
console.log(
  `  i18n: ${allIds.size} ids, ${untranslated}/${Object.keys(locales).length} locales incomplete, ` +
    `${unknown.length} unknown id(s) in source -> ${rel(path)}`,
);
