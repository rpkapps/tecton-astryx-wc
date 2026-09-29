/**
 * `pnpm generate` step for packages/tokens (run by tools/generate.ts when this file exists).
 *
 * Writes `dist/{tokens,palette,fonts,tecton}.css`, `dist/tokens.{js,d.ts,json}`, `dist/fallbacks.json`,
 * `dist/palette.manifest.json`, `dist/fonts/*`, and the committed `snapshots/token-names.json` (the
 * Stylelint `tct/known-custom-properties` guard). Everything under dist/ is gitignored.
 */
import {copyFileSync, mkdirSync, readFileSync, existsSync, rmSync, writeFileSync} from 'node:fs';
import {dirname, join, relative} from 'node:path';
import {build} from '../src/pipeline/build.ts';
import {verifyInputHashes, DIST_DIR, PACKAGE_ROOT, SNAPSHOT_FILE} from '../src/pipeline/inputs.ts';

function writeIfChanged(path: string, content: string): boolean {
  if (existsSync(path) && readFileSync(path, 'utf8') === content) return false;
  mkdirSync(dirname(path), {recursive: true});
  writeFileSync(path, content);
  return true;
}

function main(): number {
  const problems = verifyInputHashes();
  if (problems.length > 0) {
    console.error(`tokens: inputs do not match inputs.lock.json:\n  ${problems.join('\n  ')}`);
    return 1;
  }
  const result = build();

  // Only fonts/ is cleaned: dist/ also holds tsc's declaration output for the package.
  rmSync(join(DIST_DIR, 'fonts'), {recursive: true, force: true});
  let written = 0;
  for (const [file, content] of result.files) {
    if (writeIfChanged(join(DIST_DIR, file), content)) written++;
  }
  for (const font of [...result.fonts.files, ...result.fonts.licences]) {
    const target = join(DIST_DIR, font.to);
    mkdirSync(dirname(target), {recursive: true});
    copyFileSync(font.from, target);
  }
  const snapshotChanged = writeIfChanged(SNAPSHOT_FILE, result.snapshot);

  const {tokens} = result.resolved;
  console.log(
    `  tokens: ${tokens.length} tokens, ${result.palette.entries.length} palette entries, ` +
      `${result.files.size} files (${written} changed), ${result.fonts.files.length} font files` +
      `${snapshotChanged ? `; wrote ${relative(PACKAGE_ROOT, SNAPSHOT_FILE)}` : ''}`,
  );
  return 0;
}

process.exit(main());
