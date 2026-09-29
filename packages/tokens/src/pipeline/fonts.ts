/**
 * `fonts.css` (A§5.4, D-003): self-hosted Figtree Variable (`@fontsource-variable/figtree`) and
 * IBM Plex Mono (`@fontsource/ibm-plex-mono`) plus Capsize-computed metric-matched fallback faces.
 *
 * Guides consulted: [mwg:visually-stable-font-fallbacks] (size-adjust / ascent-override descriptors tune a
 * local fallback so the swap does not shift layout; numeric font-size-adjust tokens live in
 * tokens.css), [mwg:visually-stable-mixed-fonts] (inline code matched by the mono x-height),
 * [mwg:performance] (`font-display: swap`, latin subset first, preload advice in the docs).
 * `@font-face` lives in document CSS only: it is ignored inside shadow roots.
 */
import {existsSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import {createFontStack} from '@capsizecss/core';
import arial from '@capsizecss/metrics/arial';
import courierNew from '@capsizecss/metrics/courierNew';
import figtree from '@capsizecss/metrics/figtree';
import plexMono from '@capsizecss/metrics/iBMPlexMono';
import {GENERATED_BANNER, LAYER_STATEMENT} from './emit-css.ts';
import {PACKAGE_ROOT} from './inputs.ts';

export interface FontFile {
  /** Absolute source path inside node_modules. */
  from: string;
  /** Path relative to `dist/`, e.g. `fonts/figtree-latin-wght-normal.woff2`. */
  to: string;
}

export interface FontsOutput {
  css: string;
  /** Everything after the layer statement, for concatenation into tecton.css. */
  body: string;
  files: FontFile[];
  /** Licence texts copied next to the fonts (OFL-1.1 requires the notice to travel with them). */
  licences: FontFile[];
  /** x-height / unitsPerEm from the Capsize metrics: what `--font-size-adjust-*` must equal. */
  xHeightRatio: {body: number; code: number};
}

const FIGTREE_DIR = join(PACKAGE_ROOT, 'node_modules', '@fontsource-variable', 'figtree');
const PLEX_DIR = join(PACKAGE_ROOT, 'node_modules', '@fontsource', 'ibm-plex-mono');
const SUBSETS = ['latin-ext', 'latin'] as const;
const PLEX_WEIGHTS = [400, 500] as const;

function unicodeRanges(dir: string): Record<string, string> {
  return JSON.parse(readFileSync(join(dir, 'unicode.json'), 'utf8')) as Record<string, string>;
}

const ratio = (metrics: {xHeight: number; unitsPerEm: number}) =>
  Math.round((metrics.xHeight / metrics.unitsPerEm) * 1000) / 1000;

/** Capsize computes the overrides; face names are fixed by D-003. */
function fallbackFace(
  preferred: Parameters<typeof createFontStack>[0][number],
  local: Parameters<typeof createFontStack>[0][number],
  familyName: string,
): string {
  const {fontFaces} = createFontStack([preferred, local], {fontFaceFormat: 'styleObject'});
  const face = fontFaces[0]?.['@font-face'];
  if (!face) throw new Error(`capsize produced no fallback face for ${familyName}`);
  const lines = [
    `  font-family: "${familyName}";`,
    `  src: ${face.src};`,
    face.sizeAdjust ? `  size-adjust: ${face.sizeAdjust};` : '',
    face.ascentOverride ? `  ascent-override: ${face.ascentOverride};` : '',
    face.descentOverride ? `  descent-override: ${face.descentOverride};` : '',
    face.lineGapOverride ? `  line-gap-override: ${face.lineGapOverride};` : '',
  ].filter((line) => line !== '');
  return `@font-face {\n${lines.join('\n')}\n}`;
}

export function buildFonts(): FontsOutput {
  const files: FontFile[] = [];
  const faces: string[] = [];

  const figtreeRanges = unicodeRanges(FIGTREE_DIR);
  for (const subset of SUBSETS) {
    const file = `figtree-${subset}-wght-normal.woff2`;
    files.push({from: join(FIGTREE_DIR, 'files', file), to: `fonts/${file}`});
    faces.push(`/* Figtree Variable, ${subset} (wght 300-900) */
@font-face {
  font-family: "Figtree Variable";
  font-style: normal;
  font-display: swap;
  font-weight: 300 900;
  src: url("./fonts/${file}") format("woff2-variations");
  unicode-range: ${figtreeRanges[subset]};
}`);
  }

  const plexRanges = unicodeRanges(PLEX_DIR);
  for (const weight of PLEX_WEIGHTS) {
    for (const subset of SUBSETS) {
      const file = `ibm-plex-mono-${subset}-${weight}-normal.woff2`;
      files.push({from: join(PLEX_DIR, 'files', file), to: `fonts/${file}`});
      faces.push(`/* IBM Plex Mono ${weight}, ${subset} */
@font-face {
  font-family: "IBM Plex Mono";
  font-style: normal;
  font-display: swap;
  font-weight: ${weight};
  src: url("./fonts/${file}") format("woff2");
  unicode-range: ${plexRanges[subset]};
}`);
    }
  }

  for (const file of files) {
    if (!existsSync(file.from)) throw new Error(`font file missing: ${file.from}`);
  }

  const fallbacks = [
    '/* Metric-matched fallbacks (Capsize): the swap to the web font shifts almost nothing. Safari ignores the\n   ascent/descent/line-gap overrides (WebKit bug 219735) and honours size-adjust. */',
    fallbackFace(figtree, arial, 'Figtree Fallback'),
    fallbackFace(plexMono, courierNew, 'IBM Plex Mono Fallback'),
  ];

  const body = `${faces.join('\n\n')}\n\n${fallbacks.join('\n')}\n`;
  const css = `${GENERATED_BANNER('fonts.css', 'Opt-in fonts: Figtree Variable + IBM Plex Mono (SIL OFL 1.1, licences in ./fonts/) and metric-matched fallbacks. Load once, in the document.')}
${LAYER_STATEMENT}

${body}`;

  const licences: FontFile[] = [
    {from: join(FIGTREE_DIR, 'LICENSE'), to: 'fonts/OFL-Figtree.txt'},
    {from: join(PLEX_DIR, 'LICENSE'), to: 'fonts/OFL-IBM-Plex-Mono.txt'},
  ];
  return {
    css,
    body,
    files,
    licences,
    xHeightRatio: {body: ratio(figtree), code: ratio(plexMono)},
  };
}
