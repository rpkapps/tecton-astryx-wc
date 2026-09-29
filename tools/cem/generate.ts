/**
 * `pnpm generate` step: writes `packages/components/custom-elements.json` (gitignored) and the
 * CEM-derived `packages/components/src/generated/autoloader-map.ts` (A§3: "CEM tagName x folder").
 *
 * The autoloader map used to be scanned from `static tagName` text by the barrel generator (M1). It
 * now comes from the manifest: one source of truth for tags, `@internal` classes are excluded
 * (satellites are registered through `static dependencies`, never by sight), and a tag that only
 * appears in a comment can no longer leak in.
 */
import {join} from 'node:path';
import {cemElements} from '../lib/cem.ts';
import {writeIfChanged} from '../lib/fs.ts';
import {PATHS, ROOT, rel} from '../lib/paths.ts';
import {autoloaderMapFile} from '../generators/autoloader-map.ts';
import {analyzeComponents} from './analyze.ts';

const cem = analyzeComponents({
  root: ROOT,
  componentsSrc: PATHS.componentsSrc,
  coreSrc: PATHS.coreSrc,
});
const cemPath = join(PATHS.components, 'custom-elements.json');
writeIfChanged(cemPath, `${JSON.stringify(cem, null, 2)}\n`);

const elements = cemElements(cem);
const missingFolder = elements.filter((element) => element.folder === undefined);
if (missingFolder.length > 0) {
  console.error(
    `cem: ${missingFolder.map((e) => e.tagName).join(', ')} is defined outside packages/components/src/<folder>/`,
  );
  process.exit(1);
}
const duplicates = elements.filter(
  (e, i) => elements.findIndex((o) => o.tagName === e.tagName) !== i,
);
if (duplicates.length > 0) {
  console.error(`cem: duplicate tag name(s) ${duplicates.map((e) => e.tagName).join(', ')}`);
  process.exit(1);
}

const map = autoloaderMapFile(
  PATHS.componentsSrc,
  elements.map((element) => [element.tagName, element.folder!] as [string, string]),
);
writeIfChanged(map.path, map.content);
console.log(
  `  cem: ${elements.length} element(s), ${cem.modules.length} module(s) -> ${rel(cemPath)}; ` +
    `autoloader map ${rel(map.path)}`,
);
