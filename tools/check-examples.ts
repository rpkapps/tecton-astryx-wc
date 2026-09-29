/**
 * `pnpm examples:check`: examples lay content out with the library's components, not hand-written
 * CSS (owner rule; see tools/lib/example-style.ts for what is allowed).
 */
import {readdirSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import {findStyleViolations} from './lib/example-style.ts';
import {PATHS, rel} from './lib/paths.ts';

const problems: string[] = [];
let count = 0;

for (const folder of readdirSync(PATHS.componentsSrc, {withFileTypes: true})) {
  if (!folder.isDirectory()) continue;
  const dir = join(PATHS.componentsSrc, folder.name, 'examples');
  let files: string[];
  try {
    files = readdirSync(dir).filter((name) => name.endsWith('.html'));
  } catch {
    continue;
  }
  for (const name of files.sort()) {
    const path = join(dir, name);
    count++;
    for (const v of findStyleViolations(readFileSync(path, 'utf8'))) {
      const where = v.source === 'attribute' ? 'style attribute' : '<style> element';
      problems.push(`${rel(path)}:${v.line}: \`${v.property}\` in a ${where}`);
    }
  }
}

if (problems.length > 0) {
  console.error(problems.join('\n'));
  console.error(
    `\nexamples:check FAILED: ${problems.length} hand-written style declaration(s). Use layout and ` +
      'surface components (tct-stack, tct-hstack, tct-grid, tct-center, tct-card, tct-text …) instead; ' +
      'only custom properties and size constraints may be set inline.',
  );
  // exitCode, not exit(): exit() can cut off a large report still being written to a pipe.
  process.exitCode = 1;
} else {
  console.log(`examples:check OK: ${count} example(s), no hand-written layout or surface CSS.`);
}
