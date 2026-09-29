/**
 * Locales generator (A§9.15), run by `pnpm generate` before the barrels.
 *
 * Inputs (all under `packages/locales/src/`):
 *  - `catalogs/*.json`     the 30 upstream Astryx catalogs (370 ids each), verbatim, hash-locked by
 *                          `catalogs.lock.json`. `--relock` rewrites the lock after an intended update.
 *  - `packages/components/src/<folder>/<folder>.messages.json`   new English messages (`@tct.<folder>.<key>`).
 *
 * Outputs (`packages/locales/dist/`, gitignored):
 *  - `<tag>.js` / `.d.ts`           flat `{id: message}` catalog per shipped locale (default export)
 *  - `en/<namespace>.js` / `.d.ts`  English messages per namespace (upstream ids by their camelCase
 *                                   namespace, new ids by component folder)
 *  - `pseudo.js`                    generated pseudo locale (accented, +30 %, ICU-safe)
 *  - `loaders.js`                   `tag -> () => import('./<tag>.js')` for bundler-visible lazy loading
 *  - `aliases.js`                   shipped tags and the base-tag alias table (data only)
 *  - `types.d.ts`                   emitted by `tsc -b` from `src/types.ts`
 */
import {createHash} from 'node:crypto';
import {existsSync, readdirSync, readFileSync, rmSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {writeIfChanged} from '../../../tools/lib/fs.ts';
import {
  ALIASES,
  PSEUDO_TAG,
  flatten,
  invalidAliases,
  namespaceOf,
  parseFolderMessages,
  pseudoLocalize,
  renderAliasesDeclaration,
  renderAliasesModule,
  renderLoadersDeclaration,
  renderLoadersModule,
  renderMessagesDeclaration,
  renderMessagesModule,
  type FlatMessages,
  type UpstreamCatalog,
} from './lib.ts';

const PACKAGE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CATALOGS = join(PACKAGE, 'src', 'catalogs');
const LOCK = join(PACKAGE, 'src', 'catalogs.lock.json');
const DIST = join(PACKAGE, 'dist');
const COMPONENTS_SRC = resolve(PACKAGE, '..', 'components', 'src');

const sha256 = (path: string): string =>
  createHash('sha256').update(readFileSync(path)).digest('hex');

function readCatalogs(): {tag: string; file: string; catalog: UpstreamCatalog}[] {
  return readdirSync(CATALOGS)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => ({
      tag: name.replace(/\.json$/, ''),
      file: join(CATALOGS, name),
      catalog: JSON.parse(readFileSync(join(CATALOGS, name), 'utf8')) as UpstreamCatalog,
    }));
}

/** Compares catalog hashes with the lock; returns problems (empty = locked and intact). */
function checkLock(catalogs: readonly {tag: string; file: string}[]): string[] {
  const lock = existsSync(LOCK)
    ? (JSON.parse(readFileSync(LOCK, 'utf8')) as Record<string, string>)
    : {};
  const problems: string[] = [];
  for (const {tag, file} of catalogs) {
    const name = `${tag}.json`;
    if (lock[name] === undefined) problems.push(`${name}: not in catalogs.lock.json`);
    else if (lock[name] !== sha256(file)) problems.push(`${name}: hash differs from the lock`);
  }
  for (const name of Object.keys(lock)) {
    if (!catalogs.some((c) => `${c.tag}.json` === name))
      problems.push(`${name}: in the lock but missing`);
  }
  return problems;
}

function folderMessages(): Map<string, FlatMessages> {
  const byFolder = new Map<string, FlatMessages>();
  if (!existsSync(COMPONENTS_SRC)) return byFolder;
  for (const entry of readdirSync(COMPONENTS_SRC, {withFileTypes: true})) {
    if (!entry.isDirectory()) continue;
    const file = join(COMPONENTS_SRC, entry.name, `${entry.name}.messages.json`);
    if (!existsSync(file)) continue;
    byFolder.set(
      entry.name,
      parseFolderMessages(entry.name, JSON.parse(readFileSync(file, 'utf8')), file),
    );
  }
  return byFolder;
}

function main(): number {
  const relock = process.argv.includes('--relock');
  const catalogs = readCatalogs();
  if (catalogs.length !== 30) {
    console.error(`locales: expected 30 upstream catalogs, found ${catalogs.length}`);
    return 1;
  }

  if (relock) {
    const lock = Object.fromEntries(catalogs.map(({tag, file}) => [`${tag}.json`, sha256(file)]));
    writeIfChanged(LOCK, `${JSON.stringify(lock, null, 2)}\n`);
    console.log('  relocked catalogs.lock.json');
  }
  const problems = checkLock(catalogs);
  if (problems.length > 0) {
    console.error(`locales: catalogs do not match catalogs.lock.json:\n  ${problems.join('\n  ')}`);
    console.error(
      'If the change is intended (an upstream sync), run: node packages/locales/scripts/generate.ts --relock',
    );
    return 1;
  }

  const tags = catalogs.map((c) => c.tag);
  const english = flatten(catalogs.find((c) => c.tag === 'en')!.catalog);
  const ids = Object.keys(english);
  for (const {tag, catalog} of catalogs) {
    const flat = flatten(catalog);
    const missing = ids.filter((id) => !(id in flat));
    const extra = Object.keys(flat).filter((id) => !(id in english));
    if (missing.length > 0 || extra.length > 0) {
      console.error(
        `locales: ${tag}.json id set differs from en.json (missing ${missing.length}, extra ${extra.length})`,
      );
      return 1;
    }
  }
  const badAliases = invalidAliases(tags);
  if (badAliases.length > 0) {
    console.error(`locales: aliases point at unknown catalogs: ${badAliases.join(', ')}`);
    return 1;
  }

  let written = 0;
  const write = (relative: string, content: string) => {
    if (writeIfChanged(join(DIST, relative), content)) written++;
  };

  // Per-locale catalogs (+ pseudo).
  for (const {tag, catalog} of catalogs) {
    write(`${tag}.js`, renderMessagesModule(flatten(catalog)));
    write(`${tag}.d.ts`, renderMessagesDeclaration());
  }
  const pseudo: FlatMessages = {};
  for (const id of ids) pseudo[id] = pseudoLocalize(english[id]!);
  write(`${PSEUDO_TAG}.js`, renderMessagesModule(pseudo));
  write(`${PSEUDO_TAG}.d.ts`, renderMessagesDeclaration());

  // English per namespace: upstream ids by camelCase namespace, new ids by component folder.
  const namespaces = new Map<string, FlatMessages>();
  const add = (namespace: string, messages: FlatMessages) => {
    namespaces.set(namespace, {...namespaces.get(namespace), ...messages});
  };
  for (const id of ids) {
    const namespace = namespaceOf(id);
    if (namespace === undefined) {
      console.error(`locales: id without a namespace: ${id}`);
      return 1;
    }
    add(namespace, {[id]: english[id]!});
  }
  for (const [folder, messages] of folderMessages()) add(folder, messages);
  const expected = new Set<string>();
  for (const [namespace, messages] of namespaces) {
    expected.add(`${namespace}.js`);
    expected.add(`${namespace}.d.ts`);
    write(`en/${namespace}.js`, renderMessagesModule(messages));
    write(`en/${namespace}.d.ts`, renderMessagesDeclaration());
  }
  // Drop English namespace modules whose namespace disappeared.
  const enDir = join(DIST, 'en');
  if (existsSync(enDir)) {
    for (const name of readdirSync(enDir)) {
      if (!expected.has(name)) rmSync(join(enDir, name));
    }
  }

  write('loaders.js', renderLoadersModule([...tags, PSEUDO_TAG]));
  write('loaders.d.ts', renderLoadersDeclaration());
  write('aliases.js', renderAliasesModule(tags));
  write('aliases.d.ts', renderAliasesDeclaration());

  console.log(
    `  locales: ${tags.length} catalogs + pseudo, ${namespaces.size} English namespaces, ` +
      `${Object.keys(ALIASES).length} aliases (${written} files written)`,
  );
  return 0;
}

process.exit(main());
