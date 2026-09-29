/**
 * Parity records: discovery, schema validation and the coverage rules (A§4.1, A§15.5, CONVENTIONS §8).
 * Shared by `tools/check-parity.ts` (pass/fail) and `tools/parity-report.ts` (reports/parity.*).
 */
import {existsSync, readFileSync} from 'node:fs';
import {basename, dirname, join} from 'node:path';
import {readFrontmatter} from './frontmatter.ts';
import {listDirs, walkFiles} from './fs.ts';
import {validateJson, type Schema} from './json-schema.ts';
import {ROOT, rel} from './paths.ts';

export type Status = 'not-started' | 'in-progress' | 'implemented' | 'verified';

export interface ManifestEntry {
  id: string;
  name: string;
  category?: string | null;
  package: string;
  kind: string;
  status: string;
  props?: {name: string}[];
  events?: string[];
  slots?: {children?: boolean; contentProps?: string[]; renderProps?: string[]};
}

export interface Manifest {
  baseline: {commit: string};
  entries: ManifestEntry[];
}

export interface ApiRow {
  upstream: string;
  kind: string;
  as: string;
  target?: string;
  reason?: string;
}

export interface ParityEntry {
  tag?: string | null;
  status: Status;
  upstream: {name: string};
  api: ApiRow[];
  hooks?: {upstream: string; target?: string; as?: string}[];
  keyboard?: {keys: string; action: string; when?: string}[];
  form?: {formAssociated: boolean; notes?: string};
  tests?: Record<string, boolean>;
  differences?: {id: string; type: string; text: string}[];
  provisional?: string[];
  tokenRequests?: {name: string; reason: string; light?: string; dark?: string}[];
  requests?: {file: string; reason: string; diff?: string}[];
  sizeBudgetKb?: number | null;
  notes?: string | string[];
}

export interface ParityFile {
  folder: string;
  workPackage: string;
  entries: Record<string, ParityEntry>;
}

export interface LoadedParity {
  /** Absolute path of parity.json. */
  file: string;
  /** Folder directory (absolute). */
  dir: string;
  data: ParityFile;
}

export interface Problem {
  file: string;
  message: string;
}

export function loadManifest(path: string): Manifest {
  return JSON.parse(readFileSync(path, 'utf8')) as Manifest;
}

export function loadSchema(path: string): Schema {
  return JSON.parse(readFileSync(path, 'utf8')) as Schema;
}

/** Every `packages/<pkg>/src/<folder>/parity.json` (component families, incl. extension packages). */
export function discoverParityFiles(root: string = ROOT): string[] {
  const files: string[] = [];
  for (const pkg of listDirs(join(root, 'packages'))) {
    const src = join(root, 'packages', pkg, 'src');
    for (const folder of listDirs(src)) {
      const file = join(src, folder, 'parity.json');
      if (existsSync(file)) files.push(file);
    }
  }
  return files;
}

/**
 * Upstream names a parity entry must account for: every prop (which already includes `children`),
 * every callback prop listed in `events`, and every content/render slot prop (A§7.2).
 */
export function expectedApiNames(entry: ManifestEntry): string[] {
  const names = new Set<string>();
  for (const prop of entry.props ?? []) names.add(prop.name);
  for (const event of entry.events ?? []) names.add(event);
  for (const name of entry.slots?.contentProps ?? []) names.add(name);
  for (const name of entry.slots?.renderProps ?? []) names.add(name);
  return [...names].sort();
}

/** Names present in a Custom Elements Manifest declaration for one tag. */
export function cemNamesByTag(cem: unknown): Map<string, Set<string>> {
  const result = new Map<string, Set<string>>();
  const modules = ((cem as {modules?: unknown[]} | null)?.modules ?? []) as {
    declarations?: unknown[];
  }[];
  for (const mod of modules) {
    for (const declaration of (mod.declarations ?? []) as Record<string, unknown>[]) {
      const tag = declaration.tagName;
      if (typeof tag !== 'string') continue;
      const names = new Set<string>();
      const collect = (key: string) => {
        for (const item of (declaration[key] ?? []) as {name?: string}[]) {
          if (typeof item.name === 'string') names.add(item.name === '' ? 'default' : item.name);
        }
      };
      for (const key of [
        'attributes',
        'members',
        'slots',
        'events',
        'cssParts',
        'cssProperties',
        'cssStates',
      ]) {
        collect(key);
      }
      result.set(tag, names);
    }
  }
  return result;
}

/**
 * Public API names of a tag that `dense.properties` must describe (D-011): attributes, own public
 * members (fields and methods), slots and events. Inherited members are documented by the class that
 * declares them; parts, custom properties and states are documented elsewhere. Each entry lists the
 * accepted spellings (attribute and property name, `slot:<name>`), one of which must be a key.
 */
export function cemDenseNames(cem: unknown): Map<string, string[][]> {
  const result = new Map<string, string[][]>();
  const modules = ((cem as {modules?: unknown[]} | null)?.modules ?? []) as {
    declarations?: unknown[];
  }[];
  for (const mod of modules) {
    for (const declaration of (mod.declarations ?? []) as Record<string, unknown>[]) {
      const tag = declaration.tagName;
      if (typeof tag !== 'string') continue;
      const groups: string[][] = [];
      const attributes = (
        (declaration.attributes ?? []) as {
          name?: string;
          fieldName?: string;
          inheritedFrom?: unknown;
        }[]
      ).filter((item) => !item.inheritedFrom);
      const attributeFields = new Set<string>();
      for (const attribute of attributes) {
        if (!attribute.name) continue;
        if (attribute.fieldName) attributeFields.add(attribute.fieldName);
        groups.push([attribute.name, ...(attribute.fieldName ? [attribute.fieldName] : [])]);
      }
      for (const member of (declaration.members ?? []) as {
        name?: string;
        static?: boolean;
        privacy?: string;
        inheritedFrom?: unknown;
        attribute?: string;
      }[]) {
        if (!member.name || member.static || member.inheritedFrom) continue;
        if (
          member.privacy === 'private' ||
          member.privacy === 'protected' ||
          member.name.startsWith('_')
        )
          continue;
        if (attributeFields.has(member.name)) continue; // already covered through its attribute
        groups.push([member.name, ...(member.attribute ? [member.attribute] : [])]);
      }
      for (const slot of (declaration.slots ?? []) as {name?: string}[]) {
        const name = slot.name ?? '';
        groups.push(name === '' ? ['default', 'children', 'slot:default'] : [name, `slot:${name}`]);
      }
      for (const event of (declaration.events ?? []) as {name?: string}[]) {
        if (event.name) groups.push([event.name]);
      }
      result.set(tag, groups);
    }
  }
  return result;
}

/** Non-native, CEM-checkable mapping kinds. Others (context, controller, ...) have no CEM entry. */
const CEM_CHECKED_AS = new Set(['attribute', 'property', 'slot', 'event', 'method', 'css']);

/**
 * HTML global attributes: an `attribute` row may target them (upstream `hasAutoFocus` -> `autofocus`)
 * although the CEM never lists them for an element.
 */
const GLOBAL_ATTRIBUTES = new Set([
  'autofocus',
  'dir',
  'hidden',
  'id',
  'inert',
  'lang',
  'tabindex',
  'title',
  'translate',
]);

export interface CheckOptions {
  manifest: Manifest;
  schema: Schema;
  /** Schema of `<folder>.docs.md` frontmatter (tools/schemas/docs-frontmatter.schema.json). */
  docsSchema: Schema;
  files: readonly string[];
  /** Parsed custom-elements.json when it exists (M6). */
  cem?: unknown;
  root?: string;
}

export interface CheckResult {
  problems: Problem[];
  parity: LoadedParity[];
  /** Manifest entries claimed by a parity file. */
  claimed: Map<string, string>;
}

function testFilesIn(dir: string): string[] {
  return walkFiles(dir, {skipDirs: ['examples', '__snapshots__']}).filter((file) =>
    file.endsWith('.test.ts'),
  );
}

/**
 * Checks `<folder>.docs.md` frontmatter (D-011): schema (keywords and dense are required), folder,
 * category, example files, entries vs parity.json, and `dense.properties` vs the CEM public API.
 */
function checkDocs(
  loaded: LoadedParity,
  options: CheckOptions,
  cemDense: Map<string, string[][]> | undefined,
  fail: (message: string) => void,
): void {
  const {dir, data} = loaded;
  const docsFile = join(dir, `${data.folder}.docs.md`);
  if (!existsSync(docsFile)) return;

  let frontmatter;
  try {
    frontmatter = readFrontmatter(readFileSync(docsFile, 'utf8'));
  } catch (error) {
    fail(`${data.folder}.docs.md: ${(error as Error).message}`);
    return;
  }
  if (!frontmatter) {
    fail(`${data.folder}.docs.md: missing frontmatter (CONVENTIONS §7)`);
    return;
  }

  const errors = validateJson(frontmatter.data, options.docsSchema);
  for (const error of errors)
    fail(`${data.folder}.docs.md frontmatter: ${error.path || '/'} ${error.message}`);
  if (errors.length > 0) return;

  const meta = frontmatter.data as {
    folder: string;
    category: string;
    entries: string[];
    examples: string[];
    dense: {properties: Record<string, string>};
  };

  if (meta.folder !== data.folder)
    fail(`${data.folder}.docs.md: frontmatter folder is "${meta.folder}"`);

  const categories = new Set(
    options.manifest.entries.map((entry) => entry.category).filter(Boolean),
  );
  if (categories.size > 0 && !categories.has(meta.category)) {
    fail(
      `${data.folder}.docs.md: category "${meta.category}" is not one of ${[...categories].sort().join(', ')}`,
    );
  }

  for (const id of meta.examples) {
    if (!existsSync(join(dir, 'examples', `${id}.html`)))
      fail(`${data.folder}.docs.md: example "${id}" has no examples/${id}.html`);
  }

  const started = Object.values(data.entries).filter((entry) => entry.status !== 'not-started');
  if (started.length > 0) {
    const documented = new Set(meta.entries);
    const recorded = new Set(Object.values(data.entries).map((entry) => entry.upstream.name));
    for (const name of recorded) {
      if (!documented.has(name))
        fail(`${data.folder}.docs.md: entries is missing "${name}" (present in parity.json)`);
    }
    for (const name of documented) {
      if (!recorded.has(name))
        fail(`${data.folder}.docs.md: entries lists "${name}", which parity.json does not record`);
    }
  }

  if (cemDense) {
    const keys = new Set(Object.keys(meta.dense.properties));
    for (const entry of started) {
      const groups = entry.tag ? cemDense.get(entry.tag) : undefined;
      for (const group of groups ?? []) {
        if (!group.some((name) => keys.has(name))) {
          fail(
            `${data.folder}.docs.md: dense.properties does not describe ${entry.tag} API "${group[0]}"`,
          );
        }
      }
    }
  }
}

/** `<folder>.docs.md` files whose folder has no parity.json. */
export function docsWithoutParity(root: string = ROOT): string[] {
  const found: string[] = [];
  for (const pkg of listDirs(join(root, 'packages'))) {
    const src = join(root, 'packages', pkg, 'src');
    for (const folder of listDirs(src)) {
      if (
        existsSync(join(src, folder, `${folder}.docs.md`)) &&
        !existsSync(join(src, folder, 'parity.json'))
      ) {
        found.push(join(src, folder, `${folder}.docs.md`));
      }
    }
  }
  return found;
}

export function checkParity(options: CheckOptions): CheckResult {
  const root = options.root ?? ROOT;
  const problems: Problem[] = [];
  const parity: LoadedParity[] = [];
  const claimed = new Map<string, string>();
  const byId = new Map(options.manifest.entries.map((entry) => [entry.id, entry]));
  const cemNames = options.cem ? cemNamesByTag(options.cem) : undefined;
  const cemDense = options.cem ? cemDenseNames(options.cem) : undefined;
  const differenceIds = new Map<string, string>();

  for (const file of options.files) {
    const shown = rel(file, root);
    const fail = (message: string) => problems.push({file: shown, message});

    let data: ParityFile;
    try {
      data = JSON.parse(readFileSync(file, 'utf8')) as ParityFile;
    } catch (error) {
      fail(`invalid JSON: ${(error as Error).message}`);
      continue;
    }

    const schemaErrors = validateJson(data, options.schema);
    for (const error of schemaErrors) fail(`schema: ${error.path || '/'} ${error.message}`);
    if (schemaErrors.length > 0) continue;

    const dir = dirname(file);
    parity.push({file, dir, data});

    if (data.folder !== basename(dir)) {
      fail(`"folder" is "${data.folder}" but the directory is "${basename(dir)}"`);
    }

    checkDocs({file, dir, data}, options, cemDense, fail);

    for (const [id, entry] of Object.entries(data.entries)) {
      const where = `${id}`;
      const upstream = byId.get(id);
      if (!upstream) {
        fail(`${where}: no such entry in the upstream parity manifest`);
        continue;
      }
      const previous = claimed.get(id);
      if (previous)
        fail(
          `${where}: also claimed by ${previous} (each upstream entry belongs to exactly one folder)`,
        );
      else claimed.set(id, shown);

      for (const difference of entry.differences ?? []) {
        const seen = differenceIds.get(difference.id);
        if (seen) fail(`${where}: difference id ${difference.id} already used in ${seen}`);
        else differenceIds.set(difference.id, shown);
      }

      if (entry.status !== 'not-started') {
        // Every upstream prop/callback/slot must be mapped or waived (with a reason: schema).
        const mapped = new Set(entry.api.map((row) => row.upstream));
        const missing = expectedApiNames(upstream).filter((name) => !mapped.has(name));
        if (missing.length > 0) {
          fail(
            `${where}: api rows missing for upstream ${missing.map((name) => `"${name}"`).join(', ')}`,
          );
        }
        if (!entry.tag) {
          fail(`${where}: "tag" is required once the entry is ${entry.status}`);
        }
      }

      if (entry.status === 'implemented' || entry.status === 'verified') {
        if (testFilesIn(dir).length === 0)
          fail(`${where}: status ${entry.status} but the folder has no *.test.ts`);
        if (!existsSync(join(dir, `${data.folder}.docs.md`))) {
          fail(`${where}: status ${entry.status} but ${data.folder}.docs.md is missing`);
        }
      }

      if (cemNames && entry.tag && entry.status !== 'not-started') {
        const names = cemNames.get(entry.tag);
        if (!names) {
          fail(`${where}: tag ${entry.tag} is not in custom-elements.json`);
        } else {
          for (const row of entry.api) {
            if (
              row.as !== 'waived' &&
              CEM_CHECKED_AS.has(row.as) &&
              row.target &&
              !names.has(row.target) &&
              !(row.as === 'attribute' && GLOBAL_ATTRIBUTES.has(row.target))
            ) {
              fail(
                `${where}: api "${row.upstream}" targets ${row.as} "${row.target}", absent from the CEM for ${entry.tag}`,
              );
            }
          }
        }
      }
    }
  }
  return {problems, parity, claimed};
}
