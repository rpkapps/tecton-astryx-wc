/**
 * D-015 gate: the upstream design system's name must survive nowhere in what the docs site generates for
 * the public: generated component and reference pages, `llms.txt`, `llms-full.txt` and the public agent
 * registry. `pnpm docs:build` runs this first, so a leak fails the build.
 *
 * Authored guides (`guides/`, WP-D) are not generated, but the same rule holds for them: they are scanned
 * and a mention fails the gate like any other leak. (Until the D-015 content pass they were only reported.)
 * The transitional identifiers in `tools/lib/public-text.ts` are tolerated and counted the same way.
 */
import {existsSync, readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {walkFiles} from '../lib/fs.ts';
import {rel} from '../lib/paths.ts';
import {countTransitional, upstreamLeaks} from '../lib/public-text.ts';
import {COMPONENT_PAGES_DIR, DOCS_PUBLIC, GUIDES_DIR, REFERENCE_PAGES_DIR} from '../lib/site.ts';

export interface Leak {
  file: string;
  snippet: string;
}

export interface PublicScan {
  /** Failures: the name in generated public output or in an authored guide. */
  leaks: Leak[];
  /** Occurrences of the transitional identifiers (package scope, message-id namespace) in scanned output. */
  transitional: number;
  /** Generated public files scanned. */
  scanned: number;
  /** Authored pages scanned: the guides and the home page (they fail the gate like generated output). */
  guidesScanned: number;
}

const PAGE = /\.mdx?$/;

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

/**
 * Scans the given generated files, and (unless `guidesDir` is `null`) the authored guides and the home page
 * beside them. Pass `null` to scan only `files`.
 */
export function scanPublicOutputs(
  files: readonly string[],
  guidesDir: string | null = GUIDES_DIR,
): PublicScan {
  const leaks: Leak[] = [];
  let transitional = 0;
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    transitional += countTransitional(text);
    for (const snippet of upstreamLeaks(text)) leaks.push({file, snippet});
  }
  const guides =
    guidesDir !== null && existsSync(guidesDir)
      ? walkFiles(guidesDir).filter((file) => PAGE.test(file))
      : [];
  const home = guidesDir === null ? undefined : join(dirname(guidesDir), 'index.mdx');
  if (home && existsSync(home)) guides.push(home);
  for (const file of guides) {
    const text = readFileSync(file, 'utf8');
    transitional += countTransitional(text);
    for (const snippet of upstreamLeaks(text)) leaks.push({file, snippet});
  }
  return {leaks, transitional, scanned: files.length, guidesScanned: guides.length};
}

/** With file arguments the script scans exactly those files (used by the tests); otherwise the site's own output. */
function main(): void {
  const given = process.argv.slice(2);
  const scan = given.length > 0 ? scanPublicOutputs(given, null) : scanPublicOutputs(generatedPublicFiles());
  if (scan.scanned === 0) {
    console.error('docs public check: no generated public output found; run pnpm generate first.');
    process.exit(1);
  }
  if (scan.transitional > 0) {
    console.log(
      `  docs public check: ${scan.transitional} transitional identifier(s) (@tecton-astryx/* scope, @astryx.* message ids) ` +
        'in generated output; they go with their scheduled renames (D-015).',
    );
  }
  if (scan.leaks.length > 0) {
    for (const leak of scan.leaks.slice(0, 40)) console.error(`  ${rel(leak.file)}: ...${leak.snippet}...`);
    console.error(
      `docs public check FAILED: the upstream design system's name appears ${scan.leaks.length} time(s) in generated public output or authored guides (D-015).`,
    );
    process.exit(1);
  }
  console.log(
    `docs public check OK: ${scan.scanned} generated public file(s) and ${scan.guidesScanned} authored guide(s) never name the upstream system.`,
  );
}

if (process.argv[1] && import.meta.filename === process.argv[1]) main();
