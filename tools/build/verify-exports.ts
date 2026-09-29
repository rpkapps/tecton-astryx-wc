/**
 * Checks that every workspace package's `exports` resolve for the built output (A§2.4):
 *
 *  1. every target of every condition (`types`, `default`, `tct-source`) exists on disk; a wildcard
 *     target matches at least one file;
 *  2. for wildcard keys, up to a few real specifiers derived from the built files resolve, through
 *     Node's own resolver, to exactly that file (so the map and the output agree, not just each other);
 *  3. every built `.js` of a shipped package has a matching `.d.ts` (consumers get types).
 *
 * Returns the problems; `tools/build.ts` fails when there are any.
 */
import {existsSync, readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {join, relative, sep} from 'node:path';
import {walkFiles} from '../lib/fs.ts';
import {ROOT} from '../lib/paths.ts';

type ExportsValue = string | {[condition: string]: ExportsValue} | null;

export interface PackageInfo {
  name: string;
  dir: string;
  exports: Record<string, ExportsValue>;
}

export function readPackage(dir: string): PackageInfo {
  const json = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as {
    name: string;
    exports?: Record<string, ExportsValue>;
  };
  return {name: json.name, dir, exports: json.exports ?? {}};
}

/** `{condition: target}` leaves of one export entry (nested condition objects are flattened). */
function leaves(value: ExportsValue, condition = 'default'): {condition: string; target: string}[] {
  if (value === null) return [];
  if (typeof value === 'string') return [{condition, target: value}];
  return Object.entries(value).flatMap(([name, inner]) => leaves(inner, name));
}

const escapeRegExp = (text: string) => text.replace(/[.+?^${}()|[\]\\]/g, '\\$&');

/** Regex for a target pattern with one `*`; capture group 1 is the star. */
function targetRegex(target: string): RegExp {
  const [before = '', after = ''] = target.split('*');
  return new RegExp(`^${escapeRegExp(before)}(.+)${escapeRegExp(after)}$`);
}

const posix = (path: string) => path.split(sep).join('/');

export interface ExportsReport {
  problems: string[];
  checked: number;
}

export function verifyExports(
  pkg: PackageInfo,
  options: {resolveFrom: string; allowEmpty?: readonly string[]},
): ExportsReport {
  const problems: string[] = [];
  let checked = 0;
  const files = walkFiles(pkg.dir, {skipDirs: ['node_modules', 'scripts', '.tsbuild']}).map(
    (file) => `./${posix(relative(pkg.dir, file))}`,
  );
  // `dist` is skipped by walkFiles by default; list it explicitly.
  const distFiles = walkFilesIn(join(pkg.dir, 'dist'), pkg.dir);
  const all = new Set([...files, ...distFiles]);
  const require = createRequire(join(options.resolveFrom, 'package.json'));

  for (const [key, value] of Object.entries(pkg.exports)) {
    for (const {condition, target} of leaves(value)) {
      checked++;
      if (!target.startsWith('./')) {
        problems.push(
          `${pkg.name} exports "${key}" (${condition}): target "${target}" is not package-relative`,
        );
        continue;
      }
      if (target.includes('*')) {
        const regex = targetRegex(target);
        const matches = [...all].filter((file) => regex.test(file));
        if (matches.length === 0) {
          // A family wildcard has no match until the first component folder exists.
          if (options.allowEmpty?.includes(key)) continue;
          problems.push(`${pkg.name} exports "${key}" (${condition}): no file matches ${target}`);
          continue;
        }
        // Resolve real specifiers through Node for the runtime condition.
        if (condition === 'default' && key.includes('*')) {
          for (const file of matches.slice(0, 3)) {
            const star = regex.exec(file)![1]!;
            const specifier = `${pkg.name}/${key.slice(2).replace('*', star)}`;
            try {
              const resolved = posix(relative(pkg.dir, require.resolve(specifier)));
              if (`./${resolved}` !== file) {
                problems.push(`${specifier} resolves to ./${resolved}, expected ${file}`);
              }
            } catch (error) {
              problems.push(
                `${specifier} does not resolve: ${(error as Error).message.split('\n')[0]}`,
              );
            }
          }
        }
      } else if (!all.has(target) && !existsSync(join(pkg.dir, target))) {
        problems.push(`${pkg.name} exports "${key}" (${condition}): ${target} does not exist`);
      }
    }
  }

  // Types for every built module.
  for (const file of distFiles) {
    if (
      file.endsWith('.js') &&
      !file.includes('/cdn/') &&
      !file.includes('/_virtual/') &&
      !file.endsWith('.styles.css.js') &&
      // Light-DOM sheets (`*.light.css?inline`): CSS text for a provider, internal like styles above.
      !file.endsWith('.light.js')
    ) {
      const declaration = file.replace(/\.js$/, '.d.ts');
      if (!all.has(declaration)) problems.push(`${pkg.name}: ${file} has no ${declaration}`);
    }
  }
  return {problems, checked};
}

function walkFilesIn(dir: string, packageDir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  const visit = (current: string) => {
    for (const file of walkFiles(current, {skipDirs: []}))
      out.push(`./${posix(relative(packageDir, file))}`);
  };
  visit(dir);
  return out;
}

export function workspaceResolveRoot(pkgName: string): string {
  // A directory whose node_modules links the package: dependents in this workspace.
  return pkgName === '@tecton-astryx/components'
    ? join(ROOT, 'apps/docs')
    : join(ROOT, 'packages/components');
}
