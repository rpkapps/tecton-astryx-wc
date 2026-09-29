/**
 * `pnpm api:update` / `pnpm api:check` (A§3): per-folder public-API guards
 * `packages/components/src/<folder>/__snapshots__/api.json`, derived from a fresh analysis of the
 * sources (never from a possibly stale custom-elements.json).
 *
 *   node tools/api/snapshot.ts --update   write snapshots, remove orphans
 *   node tools/api/snapshot.ts --check    fail on missing, drifted or orphaned snapshots
 */
import {existsSync, readFileSync, rmSync, readdirSync} from 'node:fs';
import {join} from 'node:path';
import {analyzeComponents} from '../cem/analyze.ts';
import {listDirs, writeIfChanged} from '../lib/fs.ts';
import {PATHS, ROOT, rel} from '../lib/paths.ts';
import {buildSnapshots, serializeSnapshot} from './build-snapshot.ts';

const mode = process.argv.includes('--update')
  ? 'update'
  : process.argv.includes('--check')
    ? 'check'
    : undefined;
if (!mode) {
  console.error('usage: node tools/api/snapshot.ts --check | --update');
  process.exit(2);
}

const snapshotPath = (folder: string) =>
  join(PATHS.componentsSrc, folder, '__snapshots__', 'api.json');

/** Naive line diff: enough to show which API lines appeared or disappeared. */
function diffLines(before: string, after: string): string[] {
  const a = new Set(before.split('\n'));
  const b = new Set(after.split('\n'));
  return [
    ...before
      .split('\n')
      .filter((line) => !b.has(line))
      .map((line) => `-${line}`),
    ...after
      .split('\n')
      .filter((line) => !a.has(line))
      .map((line) => `+${line}`),
  ];
}

const cem = analyzeComponents({
  root: ROOT,
  componentsSrc: PATHS.componentsSrc,
  coreSrc: PATHS.coreSrc,
});
const expected = buildSnapshots(cem);
const problems: string[] = [];
let written = 0;

for (const [folder, snapshot] of expected) {
  const path = snapshotPath(folder);
  const content = serializeSnapshot(snapshot);
  if (mode === 'update') {
    if (writeIfChanged(path, content)) {
      written++;
      console.log(`  wrote ${rel(path)}`);
    }
  } else if (!existsSync(path)) {
    problems.push(`${rel(path)}: missing (run \`pnpm api:update\` and commit it)`);
  } else {
    const actual = readFileSync(path, 'utf8');
    if (actual !== content) {
      problems.push(
        `${rel(path)}: the public API changed\n${diffLines(actual, content)
          .slice(0, 40)
          .map((line) => `    ${line}`)
          .join('\n')}\n  If intended, run \`pnpm api:update\` and commit the snapshot.`,
      );
    }
  }
}

// Snapshots for folders that no longer define an element.
for (const folder of listDirs(PATHS.componentsSrc)) {
  const path = snapshotPath(folder);
  if (!existsSync(path) || expected.has(folder)) continue;
  if (mode === 'update') {
    rmSync(path);
    written++;
    console.log(`  removed ${rel(path)}`);
    const dir = join(PATHS.componentsSrc, folder, '__snapshots__');
    if (readdirSync(dir).length === 0) rmSync(dir, {recursive: true});
  } else {
    problems.push(`${rel(path)}: orphan snapshot (folder defines no element)`);
  }
}

if (problems.length > 0) {
  for (const problem of problems) console.error(problem);
  console.error(`\napi:check FAILED: ${problems.length} problem(s).`);
  process.exit(1);
}
console.log(
  mode === 'update'
    ? `api:update: ${expected.size} folder snapshot(s), ${written} file(s) changed.`
    : `api:check OK: ${expected.size} folder snapshot(s) match.`,
);
