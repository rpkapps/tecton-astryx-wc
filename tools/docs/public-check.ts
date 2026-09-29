/**
 * D-015 gate: the upstream design system's name must survive nowhere in what ships or renders: generated
 * component and reference pages, `llms.txt`, `llms-full.txt`, the agent registry (public site copy and the
 * package export), the Custom Elements Manifest, every package's `package.json` and build output
 * (`dist/`, when built), and the authored pages outside `guides/`. Package scopes, message ids, vendor
 * paths and class names count like any other mention: the gate is absolute. `pnpm docs:build` runs it
 * first, so a leak fails the build.
 *
 * Authored guides (`guides/`) are held to the same rule: a mention fails the gate like any other leak
 * (they were only reported until the D-015 content pass rewrote them).
 */
import {existsSync, readdirSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import {walkFiles} from '../lib/fs.ts';
import {ROOT, rel} from '../lib/paths.ts';
import {upstreamLeaks} from '../lib/public-text.ts';
import {
  COMPONENT_PAGES_DIR,
  DOCS_CONTENT,
  DOCS_PUBLIC,
  GUIDES_DIR,
  REFERENCE_PAGES_DIR,
} from '../lib/site.ts';

export interface Leak {
  file: string;
  snippet: string;
}

export interface PublicScan {
  /** Failures: the name in public output or an authored guide. */
  leaks: Leak[];
  /** Public output files scanned (guides not included). */
  scanned: number;
  /** Authored guide pages scanned. */
  guidesScanned: number;
}

const PAGE = /\.mdx?$/;

/** Text files of a build output tree (`dist/`); binaries (fonts, images) and source maps are not scanned. */
const TEXT_OUTPUT = /\.(?:m?js|css|json|html|txt|md|svg)$/;

/** The text files under `dist/` of every workspace package that has been built or generated. */
export function distFiles(packagesDir: string = join(ROOT, 'packages')): string[] {
  if (!existsSync(packagesDir)) return [];
  const files: string[] = [];
  for (const pkg of readdirSync(packagesDir, {withFileTypes: true})) {
    if (!pkg.isDirectory()) continue;
    const dist = join(packagesDir, pkg.name, 'dist');
    if (!existsSync(dist)) continue;
    for (const entry of readdirSync(dist, {recursive: true, withFileTypes: true})) {
      const name = join(entry.parentPath, entry.name);
      if (entry.isFile() && (TEXT_OUTPUT.test(name) || name.endsWith('.d.ts'))) files.push(name);
    }
  }
  return files.sort();
}

/** What a consumer of the packages receives besides `dist/`: manifests, registry, package metadata. */
export function packageMetadataFiles(packagesDir: string = join(ROOT, 'packages')): string[] {
  if (!existsSync(packagesDir)) return [];
  const files: string[] = [];
  for (const pkg of readdirSync(packagesDir, {withFileTypes: true})) {
    if (!pkg.isDirectory()) continue;
    for (const name of ['package.json', 'custom-elements.json', 'agent-registry.json']) {
      const file = join(packagesDir, pkg.name, name);
      if (existsSync(file)) files.push(file);
    }
  }
  return files;
}

/** Authored docs pages other than the guides (home page, legal notices). */
export function authoredPages(content: string = DOCS_CONTENT): string[] {
  if (!existsSync(content)) return [];
  const skip = ['guides', 'components', 'reference'].map((dir) => join(content, dir));
  return walkFiles(content).filter((file) => PAGE.test(file) && !skip.some((dir) => file.startsWith(`${dir}/`)));
}

/** Everything the gate scans by default. */
export function publicOutputFiles(): string[] {
  return [
    ...generatedPublicFiles(),
    ...authoredPages(),
    ...packageMetadataFiles(),
    ...distFiles(),
  ];
}

/** The generated public files under the given directories and the public registry and llms files. */
export function generatedPublicFiles(
  dirs: readonly string[] = [COMPONENT_PAGES_DIR, REFERENCE_PAGES_DIR],
  publicDir: string = DOCS_PUBLIC,
): string[] {
  const files = dirs.filter((dir) => existsSync(dir)).flatMap((dir) => walkFiles(dir).filter((f) => PAGE.test(f)));
  for (const name of ['llms.txt', 'llms-full.txt', 'agent-registry.json']) {
    const file = join(publicDir, name);
    if (existsSync(file)) files.push(file);
  }
  return files;
}

export function scanPublicOutputs(
  files: readonly string[],
  /** `null` skips the guides (the CLI with explicit files). */
  guidesDir: string | null = GUIDES_DIR,
): PublicScan {
  const leaks: Leak[] = [];
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    for (const snippet of upstreamLeaks(text)) leaks.push({file, snippet});
  }
  const guides =
    guidesDir && existsSync(guidesDir) ? walkFiles(guidesDir).filter((file) => PAGE.test(file)) : [];
  for (const file of guides) {
    for (const snippet of upstreamLeaks(readFileSync(file, 'utf8'))) leaks.push({file, snippet});
  }
  return {leaks, scanned: files.length, guidesScanned: guides.length};
}

/** With file arguments the script scans exactly those files (used by the tests); otherwise the site's own output. */
function main(): void {
  const given = process.argv.slice(2);
  const scan = given.length > 0 ? scanPublicOutputs(given, null) : scanPublicOutputs(publicOutputFiles());
  if (scan.scanned === 0) {
    console.error('docs public check: no public output found; run pnpm generate first.');
    process.exit(1);
  }
  if (scan.leaks.length > 0) {
    for (const leak of scan.leaks.slice(0, 40)) console.error(`  ${rel(leak.file)}: ...${leak.snippet}...`);
    console.error(
      `docs public check FAILED: the upstream design system's name appears ${scan.leaks.length} time(s) in shipped or rendered output (D-015).`,
    );
    process.exit(1);
  }
  console.log(
    `docs public check OK: ${scan.scanned} public file(s) and ${scan.guidesScanned} authored guide(s) never name the upstream system.`,
  );
}

if (process.argv[1] && import.meta.filename === process.argv[1]) main();
