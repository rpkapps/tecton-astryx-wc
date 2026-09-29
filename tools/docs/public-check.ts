/**
 * D-015 gate: the upstream design system's name must survive nowhere in what the docs site generates for
 * the public: generated component and reference pages, `llms.txt`, `llms-full.txt` and the public agent
 * registry. `pnpm docs:build` runs this first, so a leak fails the build.
 *
 * Authored guides (`guides/`, WP-D) are not generated. They are scanned and *reported*, never silently
 * ignored, but do not fail the gate until the content pass that D-015 requires of them has happened; the
 * transitional identifiers in `tools/lib/public-text.ts` are reported the same way.
 */
import {existsSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import {walkFiles} from '../lib/fs.ts';
import {rel} from '../lib/paths.ts';
import {countTransitional, upstreamLeaks} from '../lib/public-text.ts';
import {COMPONENT_PAGES_DIR, DOCS_PUBLIC, GUIDES_DIR, REFERENCE_PAGES_DIR} from '../lib/site.ts';

export interface Leak {
  file: string;
  snippet: string;
}

export interface PublicScan {
  /** Failures: the name in generated public output. */
  leaks: Leak[];
  /** Occurrences of the transitional identifiers (package scope, message-id namespace) in generated output. */
  transitional: number;
  /** Authored guides that still name the upstream system: count per file. Reported, not failed. */
  guides: {file: string; count: number}[];
  scanned: number;
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

export function scanPublicOutputs(
  files: readonly string[],
  guidesDir: string | undefined = GUIDES_DIR,
): PublicScan {
  const leaks: Leak[] = [];
  let transitional = 0;
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    transitional += countTransitional(text);
    for (const snippet of upstreamLeaks(text)) leaks.push({file, snippet});
  }
  const guides =
    guidesDir && existsSync(guidesDir)
      ? walkFiles(guidesDir)
          .filter((file) => PAGE.test(file))
          .map((file) => ({file, count: upstreamLeaks(readFileSync(file, 'utf8')).length}))
          .filter((guide) => guide.count > 0)
      : [];
  return {leaks, transitional, guides, scanned: files.length};
}

/** With file arguments the script scans exactly those files (used by the tests); otherwise the site's own output. */
function main(): void {
  const given = process.argv.slice(2);
  const scan = given.length > 0 ? scanPublicOutputs(given, undefined) : scanPublicOutputs(generatedPublicFiles());
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
  if (scan.guides.length > 0) {
    const total = scan.guides.reduce((sum, guide) => sum + guide.count, 0);
    console.warn(
      `  docs public check: WARNING ${total} mention(s) of the upstream name in ${scan.guides.length} authored guide(s) ` +
        `(WP-D content pass pending): ${scan.guides.map((g) => `${rel(g.file)}: ${g.count}`).join(', ')}`,
    );
  }
  if (scan.leaks.length > 0) {
    for (const leak of scan.leaks.slice(0, 40)) console.error(`  ${rel(leak.file)}: ...${leak.snippet}...`);
    console.error(
      `docs public check FAILED: the upstream design system's name appears ${scan.leaks.length} time(s) in generated public output (D-015).`,
    );
    process.exit(1);
  }
  console.log(`docs public check OK: ${scan.scanned} generated public file(s) never name the upstream system.`);
}

if (process.argv[1] && import.meta.filename === process.argv[1]) main();
