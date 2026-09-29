/**
 * `pnpm generate` step: writes `packages/components/dist/{cloak,light-dom,tecton}.css` and copies the
 * self-hosted font files next to them (`dist/fonts/`, referenced by `fonts.css` as `./fonts/…`).
 * Runs after the CEM step (cloak.css needs the tags) and after the tokens step (tecton.css needs it).
 * `tools/build.ts` leaves these files alone.
 */
import {copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync} from 'node:fs';
import {join} from 'node:path';
import {loadCem} from '../lib/cem.ts';
import {writeIfChanged} from '../lib/fs.ts';
import {PATHS, ROOT, rel} from '../lib/paths.ts';
import {cloakCss, lightDomCss, tectonCss} from './shared.ts';

const cem = loadCem(join(PATHS.components, 'custom-elements.json'));
if (!cem) {
  console.error('css: custom-elements.json is missing; the CEM step must run first.');
  process.exit(1);
}

const dist = join(PATHS.components, 'dist');
const tokensDist = join(ROOT, 'packages/tokens/dist');
const cloak = cloakCss(cem);
const lightDom = lightDomCss(PATHS.componentsSrc);
const outputs: [string, string][] = [
  ['cloak.css', cloak],
  ['light-dom.css', lightDom],
];
const tokensTecton = join(tokensDist, 'tecton.css');
if (existsSync(tokensTecton)) {
  outputs.push(['tecton.css', tectonCss(readFileSync(tokensTecton, 'utf8'), lightDom, cloak)]);
} else {
  console.warn('  css: packages/tokens/dist/tecton.css is missing; skipping tecton.css');
}

let changed = 0;
for (const [name, content] of outputs) {
  if (writeIfChanged(join(dist, name), content)) changed++;
}

// Fonts: tecton.css refers to ./fonts/<file>, so the files sit next to it.
const fontsFrom = join(tokensDist, 'fonts');
let fonts = 0;
if (existsSync(fontsFrom)) {
  rmSync(join(dist, 'fonts'), {recursive: true, force: true});
  mkdirSync(join(dist, 'fonts'), {recursive: true});
  for (const file of readdirSync(fontsFrom)) {
    copyFileSync(join(fontsFrom, file), join(dist, 'fonts', file));
    fonts++;
  }
}
console.log(
  `  css: ${outputs.length} stylesheet(s) (${changed} changed), ${fonts} font file(s) -> ${rel(dist)}`,
);
