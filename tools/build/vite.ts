/**
 * Shared Vite configuration for `pnpm build` and the size bundles (A§2.3, A§2.5, A§18.4). Builds run
 * with the repository root as the Vite root so the CSS plugin finds `packages/tokens/dist/fallbacks.json`.
 */
import {readFileSync} from 'node:fs';
import {join, relative, sep} from 'node:path';
import {defaultClientConditions, type InlineConfig} from 'vite';
import {walkFiles} from '../lib/fs.ts';
import {ROOT} from '../lib/paths.ts';
import {tctCss} from '../vite-plugin-tct-css.ts';

export const SOURCE_CONDITION = 'tct-source';

export function libraryVersion(): string {
  return (JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as {version: string})
    .version;
}

/** Shipped TypeScript sources of a package (no tests, declarations, snapshots, fixtures, examples). */
export function sourceModules(srcDir: string, extraSkipDirs: readonly string[] = []): string[] {
  return walkFiles(srcDir, {
    skipDirs: ['__snapshots__', 'fixtures', 'examples', ...extraSkipDirs],
  }).filter(
    (file) =>
      file.endsWith('.ts') && !file.endsWith('.d.ts') && !/\.(?:node\.)?test\.ts$/.test(file),
  );
}

/** Rolldown `entry` record `{ 'dir/name': absolute path }` keyed like preserveModules output. */
export function entryRecord(srcDir: string, files: readonly string[]): Record<string, string> {
  return Object.fromEntries(
    files.map((file) => [relative(srcDir, file).split(sep).join('/').replace(/\.ts$/, ''), file]),
  );
}

/** Bare imports (packages and subpaths) are external in the library build; relative and absolute are not. */
export const isExternal = (id: string): boolean =>
  !id.startsWith('.') &&
  !id.startsWith('/') &&
  !/^[A-Za-z]:[\\/]/.test(id) &&
  !id.startsWith('\0') &&
  // The transformer's decorator helper is compiled into the output instead of imported at runtime.
  !id.startsWith('@oxc-project/runtime');

export interface LibraryBuildOptions {
  entry: Record<string, string>;
  outDir: string;
  srcRoot: string;
  /** Keep every module as its own file (the shipped library). */
  preserveModules?: boolean;
  /** Bundle everything (CDN, size): no externals, minified. */
  bundle?: boolean;
  external?: (id: string) => boolean;
  chunkDir?: string;
}

export function libraryConfig(options: LibraryBuildOptions): InlineConfig {
  const {
    entry,
    outDir,
    srcRoot,
    preserveModules = false,
    bundle = false,
    external,
    chunkDir,
  } = options;
  return {
    root: ROOT,
    configFile: false,
    logLevel: 'warn',
    envDir: false,
    plugins: [tctCss()],
    define: {__TCT_VERSION__: JSON.stringify(libraryVersion())},
    resolve: {conditions: [SOURCE_CONDITION, ...defaultClientConditions]},
    build: {
      outDir,
      emptyOutDir: false,
      copyPublicDir: false,
      target: 'es2023',
      minify: bundle,
      sourcemap: false,
      reportCompressedSize: false,
      lib: {entry, formats: ['es']},
      rolldownOptions: {
        ...(external ? {external} : bundle ? {} : {external: isExternal}),
        output: {
          entryFileNames: '[name].js',
          ...(chunkDir ? {chunkFileNames: `${chunkDir}/[name]-[hash].js`} : {}),
          ...(preserveModules ? {preserveModules: true, preserveModulesRoot: srcRoot} : {}),
        },
      },
    },
  };
}
