/**
 * `packages/components/src/generated/autoloader-map.ts`, read by `packages/components/src/autoloader.ts`
 * (A§2.5). Derived from the Custom Elements Manifest:
 *
 *  - `autoloaderMap`   tag name -> component family folder
 *  - `folderLoaders`   folder -> `() => import('../<folder>/define.js')`
 *
 * The loaders are written out as literal dynamic imports (not `import(\`./${folder}/define.js\`)`) so
 * every bundler, the library build and the CDN code splitter can see each family as a chunk, and so the
 * same file works from source (`define.ts`, Vite resolves the `.js` specifier) and from `dist`.
 */
import {join} from 'node:path';
import {GENERATED_BANNER, type GeneratedFile} from './barrels.ts';

export function autoloaderMapFile(
  componentsSrc: string,
  entries: readonly (readonly [tag: string, folder: string])[],
): GeneratedFile {
  const sorted = [...entries].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const folders = [...new Set(sorted.map(([, folder]) => folder))].sort();
  return {
    path: join(componentsSrc, 'generated', 'autoloader-map.ts'),
    content:
      `${GENERATED_BANNER}// tag name -> component family folder (from the Custom Elements Manifest).\n` +
      `export const autoloaderMap: Readonly<Record<string, string>> = {\n` +
      sorted.map(([tag, folder]) => `  '${tag}': '${folder}',`).join('\n') +
      `${sorted.length ? '\n' : ''}};\n\n` +
      `// folder -> lazy registration of the family (literal specifiers: bundlers split each one).\n` +
      `export const folderLoaders: Readonly<Record<string, () => Promise<unknown>>> = {\n` +
      folders.map((folder) => `  '${folder}': () => import('../${folder}/define.js'),`).join('\n') +
      `${folders.length ? '\n' : ''}};\n`,
  };
}
