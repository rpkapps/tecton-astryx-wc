/**
 * Builds the Custom Elements Manifest for the component library (A§17) by driving the analyzer's
 * `create()` programmatically with the Lit plugin plus the in-house plugins (tools/cem/plugins.ts).
 *
 * Inputs (all relative to the repository root, so module paths are stable and machine independent):
 *   packages/components/src/<folder>/tct-*.ts   the elements
 *   packages/core/src/tct-element.ts, mixins/*.ts, events/*.ts   inherited API and event classes
 *   packages/components/src/<folder>/parity.json  -> `x-tct-upstream`
 *
 * The functions take the roots as arguments so tests can analyse a fixture tree.
 */
import {existsSync, readFileSync} from 'node:fs';
import {join, relative, sep} from 'node:path';
import {create, ts} from '@custom-elements-manifest/analyzer/index.js';
import {litPlugin} from '@custom-elements-manifest/analyzer/src/features/framework-plugins/lit/lit.js';
import type {CemPackage, CemUpstream} from '../lib/cem.ts';
import {listDirs, walkFiles} from '../lib/fs.ts';
import {tctPlugins, type CemContext} from './plugins.ts';
import {createTypeAliasTable, scanTypeAliases} from './type-values.ts';

export interface AnalyzeRoots {
  /** Repository root; module paths in the manifest are relative to it. */
  root: string;
  /** `packages/components/src` */
  componentsSrc: string;
  /** `packages/core/src` */
  coreSrc: string;
}

const isTest = (file: string) => /\.(?:node\.)?test\.ts$/.test(file) || file.endsWith('.d.ts');

const toPosix = (path: string) => path.split(sep).join('/');

/** Files handed to the analyzer, sorted for a deterministic manifest. */
export function analyzedFiles(roots: AnalyzeRoots): string[] {
  const files: string[] = [];
  for (const folder of listDirs(roots.componentsSrc)) {
    if (folder === 'generated' || folder === 'styles') continue;
    const dir = join(roots.componentsSrc, folder);
    for (const file of walkFiles(dir, {skipDirs: ['examples', '__snapshots__']})) {
      const name = file.slice(dir.length + 1);
      if (!name.includes(sep) && /^tct-[^/]+\.ts$/.test(name) && !isTest(file)) files.push(file);
    }
  }
  const coreElement = join(roots.coreSrc, 'tct-element.ts');
  if (existsSync(coreElement)) files.push(coreElement);
  for (const sub of ['mixins', 'events']) {
    for (const file of walkFiles(join(roots.coreSrc, sub))) {
      if (file.endsWith('.ts') && !isTest(file)) files.push(file);
    }
  }
  return files.sort();
}

/** Every `.ts` file that may declare a type alias used by a public property. */
function aliasSources(roots: AnalyzeRoots): string[] {
  const files = [
    ...walkFiles(roots.componentsSrc, {skipDirs: ['generated', 'examples', '__snapshots__']}),
    ...walkFiles(roots.coreSrc, {skipDirs: ['generated', '__snapshots__']}),
  ];
  return files.filter((file) => file.endsWith('.ts') && !isTest(file)).sort();
}

interface ParityEntryLike {
  tag?: string | null;
  status: string;
  upstream: {name: string; path: string; commit: string};
  api: CemUpstream['api'];
  hooks?: unknown[];
  keyboard?: CemUpstream['keyboard'];
  form?: CemUpstream['form'];
  differences?: CemUpstream['differences'];
}

/** tag -> parity facts, from every `<folder>/parity.json`. */
export function loadParityByTag(componentsSrc: string): Map<string, CemUpstream> {
  const out = new Map<string, CemUpstream>();
  for (const folder of listDirs(componentsSrc)) {
    const file = join(componentsSrc, folder, 'parity.json');
    if (!existsSync(file)) continue;
    const data = JSON.parse(readFileSync(file, 'utf8')) as {
      entries?: Record<string, ParityEntryLike>;
    };
    for (const [entry, record] of Object.entries(data.entries ?? {})) {
      if (!record.tag) continue;
      out.set(record.tag, {
        entry,
        status: record.status,
        upstream: record.upstream,
        api: record.api,
        ...(record.hooks ? {hooks: record.hooks} : {}),
        ...(record.keyboard ? {keyboard: record.keyboard} : {}),
        ...(record.form ? {form: record.form} : {}),
        ...(record.differences ? {differences: record.differences} : {}),
      });
    }
  }
  return out;
}

export function analyzeComponents(roots: AnalyzeRoots): CemPackage {
  const modules = analyzedFiles(roots).map((file) =>
    ts.createSourceFile(
      toPosix(relative(roots.root, file)),
      readFileSync(file, 'utf8'),
      ts.ScriptTarget.ES2015,
      true,
    ),
  );

  const typeAliases = createTypeAliasTable();
  for (const file of aliasSources(roots)) {
    scanTypeAliases(
      ts,
      ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.ES2015, true),
      typeAliases,
    );
  }

  const context: CemContext = {
    dev: false,
    typeAliases,
    parityByTag: loadParityByTag(roots.componentsSrc),
    eventClasses: new Map(),
  };
  return create({modules, plugins: [...litPlugin(), ...tctPlugins()], context}) as CemPackage;
}
