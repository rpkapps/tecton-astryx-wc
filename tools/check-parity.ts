/**
 * `pnpm parity:check`: validates every `parity.json` against tools/schemas/parity.schema.json and
 * enforces the coverage rules (A§4.1): every upstream prop/callback/slot is mapped or waived with a
 * reason, targets exist in the CEM (once custom-elements.json exists, M6), and `implemented`
 * entries have tests and docs. Docs frontmatter is validated too (CONVENTIONS §7, D-011): `keywords`
 * and `dense` are required and `dense.properties` must describe every public API name in the CEM.
 * With zero component folders it passes and says so.
 */
import {existsSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import {
  checkParity,
  discoverParityFiles,
  docsWithoutParity,
  loadManifest,
  loadSchema,
} from './lib/parity.ts';
import {PATHS, ROOT, rel} from './lib/paths.ts';

const manifest = loadManifest(PATHS.manifest);
const schema = loadSchema(PATHS.paritySchema);
const docsSchema = loadSchema(PATHS.docsFrontmatterSchema);
const files = discoverParityFiles(ROOT);

const cemPath = join(PATHS.components, 'custom-elements.json');
const cem = existsSync(cemPath)
  ? (JSON.parse(readFileSync(cemPath, 'utf8')) as unknown)
  : undefined;

const {problems, claimed} = checkParity({manifest, schema, docsSchema, files, cem});
for (const orphan of docsWithoutParity(ROOT)) {
  problems.push({file: rel(orphan), message: 'docs file without a parity.json in the same folder'});
}

if (problems.length > 0) {
  for (const problem of problems) console.error(`${problem.file}: ${problem.message}`);
  console.error(
    `\nparity:check FAILED: ${problems.length} problem(s) in ${files.length} parity file(s).`,
  );
  process.exit(1);
}
console.log(
  `parity:check OK: ${files.length} parity file(s), ${claimed.size}/${manifest.entries.length} upstream ` +
    `entries tracked` +
    (cem ? '' : ' (no custom-elements.json yet: CEM target checks skipped).'),
);
