import {readdirSync, readFileSync} from 'node:fs';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {describe, expect, it} from 'vitest';
import {tectonIconMeta, tectonIconNames, tectonIcons} from './tecton.js';
import type {IconDefinition, IconLoader} from './types.js';

const loadIcon = (name: string): Promise<IconDefinition> =>
  (tectonIcons as Record<string, IconLoader>)[name]!();

/** The 18 glyphs of the owner's Tecton domain icon set (D-013 Q-02). */
const EXPECTED_NAMES = [
  'christmas-tree',
  'drill-bit',
  'fault',
  'geobodies',
  'geostructure',
  'horizon',
  'log-curve',
  'oil-rig-offshore',
  'rock-formations',
  'seismic',
  'strata',
  'surface',
  'trajectory',
  'valve',
  'velocity-model',
  'well',
  'well-pick',
  'well-plan',
];

const GLYPHS = fileURLToPath(new URL('./tecton/glyphs/', import.meta.url));
const MODULES = fileURLToPath(new URL('./tecton/', import.meta.url));

/** Inner markup of a variant, straight from the authored data file. */
async function original(name: string, variant: 'outlined' | 'filled') {
  const module = (await import(pathToFileURL(`${GLYPHS}${name}.ts`).href)) as Record<
    string,
    {viewBox: string; colored?: boolean; outlined: string; filled: string}
  >;
  const data = Object.values(module)[0]!;
  return {viewBox: data.viewBox, colored: data.colored === true, markup: data[variant]};
}

describe('Tecton domain icon set (D-013 Q-02)', () => {
  it('has the 18 glyphs, each registered as <name> and <name>-filled', () => {
    expect(tectonIconNames).toEqual(EXPECTED_NAMES);
    expect(Object.keys(tectonIcons)).toEqual(
      EXPECTED_NAMES.flatMap((name) => [name, `${name}-filled`]),
    );
    expect(Object.keys(tectonIconMeta)).toEqual(EXPECTED_NAMES);
    expect(tectonIconMeta.strata).toMatchObject({label: 'Strata', colored: true});
    expect(tectonIconMeta.well).toMatchObject({label: 'Well', colored: false});
  });

  it('ships the authored data with provenance, one file per glyph', () => {
    const files = readdirSync(GLYPHS).filter((file) => file.endsWith('.ts') && file !== 'types.ts');
    expect(files.sort()).toEqual(EXPECTED_NAMES.map((name) => `${name}.ts`).sort());
    const commit = readFileSync(`${GLYPHS}SOURCE-COMMIT`, 'utf8').trim();
    expect(commit).toMatch(/^[0-9a-f]{40}$/);
    for (const file of [...files, 'types.ts']) {
      const text = readFileSync(`${GLYPHS}${file}`, 'utf8');
      expect(text, file).toContain('D-013');
      expect(text, file).toContain(commit);
    }
  });

  describe.each(EXPECTED_NAMES)('%s', (name) => {
    it.each(['outlined', 'filled'] as const)(
      '%s is a fill-mode IconDefinition',
      async (variant) => {
        const definition = await loadIcon(variant === 'outlined' ? name : `${name}-filled`);
        const source = await original(name, variant);
        expect(definition.viewBox).toBe(source.viewBox);
        expect(definition.mode).toBe('fill');
        expect(definition.strokeWidth).toBeUndefined();
        expect(definition.paths.length).toBeGreaterThan(0);
        for (const path of definition.paths) {
          expect(path.d).toMatch(/^M[\d.\- ]/);
          expect(path.fillRule === undefined || path.fillRule === 'evenodd').toBe(true);
        }
        expect(definition.colored === true).toBe(source.colored);
        expect(definition.svg !== undefined).toBe(source.colored);
      },
    );

    it('converts plain paths exactly: same d strings, same order, same fill rule', async () => {
      for (const variant of ['outlined', 'filled'] as const) {
        const source = await original(name, variant);
        if (source.colored) continue; // strata: see below
        const expected = [...source.markup.matchAll(/<path\b([^>]*)>/g)].map((match) => ({
          d: /\bd="([^"]*)"/.exec(match[1]!)![1]!,
          evenodd: match[1]!.includes('fill-rule="evenodd"'),
        }));
        const definition = await loadIcon(variant === 'outlined' ? name : `${name}-filled`);
        expect(
          definition.paths.map((path) => ({d: path.d, evenodd: path.fillRule === 'evenodd'})),
        ).toEqual(expected);
      }
    });

    it('the per-icon module exports outlined, filled and a default (outlined)', async () => {
      const module = (await import(pathToFileURL(`${MODULES}${name}.ts`).href)) as {
        outlined: IconDefinition;
        filled: IconDefinition;
        default: IconDefinition;
      };
      expect(module.default).toBe(module.outlined);
      expect(await loadIcon(name)).toBe(module.outlined);
      expect(await loadIcon(`${name}-filled`)).toBe(module.filled);
    });
  });

  it('marks nothing as directional (no glyph mirrors in RTL)', async () => {
    for (const name of EXPECTED_NAMES)
      expect((await loadIcon(name)).mirrorInRtl, name).toBeUndefined();
  });

  describe('strata: colours the path list cannot express (raw SVG body)', () => {
    it('keeps the single-colour outline in `paths` and the coloured glyph in `svg`', async () => {
      const strata = await loadIcon('strata');
      expect(strata.colored).toBe(true);
      expect(strata.paths).toHaveLength(2); // the two layer bands + the top diamond
      expect(strata.svg).toBeDefined();
      // The outline paths come first in the body, in currentColor, exactly as in the fallback.
      const body = [...strata.svg!.matchAll(/<path d="([^"]*)" fill="([^"]*)"\/>/g)];
      expect(body[0]![1]).toBe(strata.paths[0]!.d);
      expect(body[0]![2]).toBe('currentColor');
      expect(body[1]![1]).toBe(strata.paths[1]!.d);
      const fills = new Set(body.slice(2).map((match) => match[2]));
      expect(fills.size).toBeGreaterThan(20);
      for (const fill of fills) expect(fill).toMatch(/^#[0-9a-f]{6}$/);
    });

    it('only uses markup a sanitiser keeps: <path d fill fill-rule>, nothing else', async () => {
      const {svg} = await loadIcon('strata');
      const rest = svg!.replace(/<path d="[^"]*" fill="[^"]*"(?: fill-rule="evenodd")?\/>/g, '');
      expect(rest).toBe('');
      expect(svg).not.toMatch(
        /<(?!path\b)|url\(|\bstyle=|\bid=|\bhref=|on\w+=|javascript:|foreignObject|<defs/i,
      );
    });

    it('both variants are the same glyph (the source draws one gradient for both)', async () => {
      expect(await loadIcon('strata-filled')).toBe(await loadIcon('strata'));
    });

    it('stays small: the raw body is under 16 KB', async () => {
      expect((await loadIcon('strata')).svg!.length).toBeLessThan(16 * 1024);
    });
  });
});
