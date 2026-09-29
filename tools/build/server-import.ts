/**
 * Server-import test (A§14): imports every built module of the shipped packages in plain Node, with
 * no DOM, and fails if any import throws or leaves a DOM global behind. `pnpm build` runs it after the
 * library build; run it alone with `node tools/build/server-import.ts`.
 *
 * Lit's Node build provides `customElements` and `HTMLElement` shims, so `define.js` modules import
 * and register without a browser. `window`, `document` and `matchMedia` must stay undefined: nothing may
 * depend on them at import time.
 */
import {existsSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {walkFiles} from '../lib/fs.ts';
import {ROOT, rel} from '../lib/paths.ts';

const PACKAGES = ['core', 'icons', 'locales', 'components'];
const FORBIDDEN_GLOBALS = ['window', 'document', 'matchMedia'];

const scope = globalThis as unknown as Record<string, unknown>;

/** Built modules of a package: every dist `.js`, except the self-contained CDN bundles (browser only). */
export function builtModules(packageDir: string): string[] {
  const dist = join(packageDir, 'dist');
  return walkFiles(dist, {skipDirs: ['cdn', 'fonts']}).filter((file) => file.endsWith('.js'));
}

export async function main(): Promise<number> {
  const failures: string[] = [];
  let count = 0;
  for (const name of PACKAGES) {
    const dir = join(ROOT, 'packages', name);
    if (!existsSync(join(dir, 'dist'))) {
      failures.push(`packages/${name}/dist is missing; run \`pnpm build\``);
      continue;
    }
    for (const file of builtModules(dir)) {
      count++;
      try {
        await import(pathToFileURL(file).href);
      } catch (error) {
        failures.push(`${rel(file)}: ${(error as Error).message.split('\n')[0]}`);
      }
      for (const global of FORBIDDEN_GLOBALS) {
        if (scope[global] !== undefined) {
          failures.push(`${rel(file)}: defined the global "${global}" while importing`);
          scope[global] = undefined;
        }
      }
    }
  }
  if (failures.length > 0) {
    for (const failure of failures) console.error(`server-import: ${failure}`);
    console.error(`\nserver-import FAILED: ${failures.length} problem(s) in ${count} module(s).`);
    return 1;
  }
  console.log(`server-import OK: ${count} built module(s) import in Node without a DOM.`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(await main());
}
