/** The whole pipeline in memory: inputs -> resolved tokens -> every output file (A§5.4). No disk writes here. */
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {emitPaletteCss, emitTokensCss, GENERATED_BANNER, LAYER_STATEMENT} from './emit-css.ts';
import {fallbacksJson, snapshotJson, tokensDts, tokensJs, tokensJson} from './emit-meta.ts';
import {parseTectonExport} from './export-css.ts';
import type {TectonExport} from './export-css.ts';
import {buildFonts} from './fonts.ts';
import type {FontsOutput} from './fonts.ts';
import {INPUTS_DIR, loadInputs} from './inputs.ts';
import type {LockFile} from './inputs.ts';
import type {Inputs} from './model.ts';
import {buildPalette, paletteManifest} from './palette.ts';
import type {Palette} from './palette.ts';
import {resolveTokens} from './resolve.ts';
import type {Resolved} from './resolve.ts';

export interface BuildResult {
  inputs: Inputs;
  palette: Palette;
  exportRoles: TectonExport;
  resolved: Resolved;
  fonts: FontsOutput;
  /** dist-relative path -> text content */
  files: Map<string, string>;
  /** Content of the committed `snapshots/token-names.json`. */
  snapshot: string;
}

/** `inputs` defaults to the files on disk; tests pass modified copies. */
export function build(inputs: Inputs = loadInputs()): BuildResult {
  const palette = buildPalette(inputs.paletteJson);
  const exportRoles = parseTectonExport(inputs.exportCss);
  const resolved = resolveTokens(inputs, palette, exportRoles);
  const fonts = buildFonts();
  const {tokens, byName} = resolved;

  const lock = JSON.parse(readFileSync(join(INPUTS_DIR, 'inputs.lock.json'), 'utf8')) as LockFile;
  const lockHashes = Object.fromEntries(
    Object.entries(lock.files).map(([name, entry]) => [name, entry.sha256]),
  );

  const tokensCss = emitTokensCss(tokens, byName, inputs.semanticMap);
  const json = tokensJson({
    tokens,
    byName,
    inputs,
    lockHashes,
    paletteCount: palette.entries.length,
    fonts,
  });

  const files = new Map<string, string>();
  files.set('tokens.css', tokensCss.css);
  files.set('palette.css', emitPaletteCss(palette));
  files.set('fonts.css', fonts.css);
  // The one-link bundle: tokens + fonts under a single layer statement. The components build extends it
  // with light-dom.css and cloak.css (A§5.4).
  files.set(
    'tecton.css',
    `${GENERATED_BANNER('tecton.css', 'One-link bundle: tokens.css + fonts.css. (The components build adds light-dom.css and cloak.css.)')}
${LAYER_STATEMENT}

${tokensCss.body}
${fonts.body}`,
  );
  files.set('tokens.json', json);
  files.set('tokens.js', tokensJs(json));
  files.set('tokens.d.ts', tokensDts(tokens));
  files.set('fallbacks.json', fallbacksJson(tokens, byName));
  files.set('palette.manifest.json', `${JSON.stringify(paletteManifest(palette), null, 2)}\n`);

  return {inputs, palette, exportRoles, resolved, fonts, files, snapshot: snapshotJson(tokens)};
}
