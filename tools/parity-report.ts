/**
 * `pnpm parity`: writes reports/parity.{json,md} from the upstream manifest (184 core + 67 extension
 * entries), every parity.json, the docs folders and the CEM (A§15.5). The model lives in
 * tools/lib/parity-report.ts; the docs "Parity status" page reads the same report.
 */
import {mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {writeIfChanged} from './lib/fs.ts';
import {checkParity, discoverParityFiles, loadManifest, loadSchema} from './lib/parity.ts';
import {PARITY_REPORT_FILES, buildParityReport, parityMarkdown} from './lib/parity-report.ts';
import {PATHS, ROOT, rel} from './lib/paths.ts';

const manifest = loadManifest(PATHS.manifest);
const {problems, parity} = checkParity({
  manifest,
  schema: loadSchema(PATHS.paritySchema),
  docsSchema: loadSchema(PATHS.docsFrontmatterSchema),
  files: discoverParityFiles(ROOT),
});

const report = buildParityReport({
  manifest,
  parity,
  problems,
  componentsSrc: PATHS.componentsSrc,
  cemPath: join(PATHS.components, 'custom-elements.json'),
  shown: (file) => rel(file),
});

mkdirSync(PATHS.reports, {recursive: true});
const files = PARITY_REPORT_FILES(PATHS.reports);
writeIfChanged(files.json, `${JSON.stringify(report, null, 2)}\n`);
writeIfChanged(files.md, parityMarkdown(report, manifest.baseline.commit));
console.log(
  `parity: wrote reports/parity.{json,md} (${report.entries.length} entries; ` +
    `${report.entries.filter((row) => row.status !== 'not-started').length} started).`,
);
