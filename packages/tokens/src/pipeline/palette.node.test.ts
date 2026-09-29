import {describe, expect, it} from 'vitest';
import {loadInputs} from './inputs.ts';
import {buildPalette, normalizeSegment, paletteManifest, paletteName} from './palette.ts';

describe('normalizeSegment', () => {
  it.each([
    ['onDark', 'on-dark'],
    ['hotPink', 'hot-pink'],
    ['appColors', 'app-colors'],
    ['MPL', 'mpl'],
    ['Plasma-25%', 'plasma-25pct'],
    ['viridis-0%', 'viridis-0pct'],
    ['rainbow_bgyrm_35_85_c71-25%', 'rainbow-bgyrm-35-85-c71-25pct'],
    ['1570', '1570'],
    ['transparent', 'transparent'],
  ])('%s -> %s', (segment, expected) => {
    expect(normalizeSegment(segment).name).toBe(expected);
  });

  it('strips a trailing parenthetical into an alias', () => {
    expect(normalizeSegment('460 (focus outline)')).toEqual({name: '460', alias: 'focus outline'});
  });
});

describe('paletteName', () => {
  it('joins normalised segments after the prefix', () => {
    expect(paletteName(['violet', 'onLight', 'transparent', '370', '25']).name).toBe(
      '--tecton-palette-violet-on-light-transparent-370-25',
    );
    expect(paletteName(['hotPink', 'onDark', '460 (focus outline)'])).toEqual({
      name: '--tecton-palette-hot-pink-on-dark-460',
      alias: 'focus outline',
    });
  });
});

describe('buildPalette', () => {
  const dtcg = (color: Record<string, unknown>) => ({foundational: {color}});
  const leaf = (value: string) => ({$type: 'color', $value: value});

  it('emits value-plus-children nodes and their children', () => {
    const palette = buildPalette(
      dtcg({shades: {white: {...leaf('#ffffff'), transparent: {'5': leaf('#ffffff0d')}}}}),
    );
    expect(palette.entries.map((entry) => entry.name)).toEqual([
      '--tecton-palette-shades-white',
      '--tecton-palette-shades-white-transparent-5',
    ]);
  });

  it('fails on a name collision', () => {
    expect(() => buildPalette(dtcg({'a-b': leaf('#000000'), a_b: leaf('#111111')}))).toThrow(
      /collision/,
    );
  });

  it('fails on a case-fold collision', () => {
    expect(() => buildPalette(dtcg({onDark: leaf('#000000'), 'on-dark': leaf('#111111')}))).toThrow(
      /collision/,
    );
  });

  it('rejects non-hex values', () => {
    expect(() => buildPalette(dtcg({a: leaf('red')}))).toThrow(/hex/);
  });
});

describe('tecton.tokens.json (the real input)', () => {
  const palette = buildPalette(loadInputs().paletteJson);

  it('has 1,820 primitives and no collisions', () => {
    expect(palette.entries).toHaveLength(1820);
    expect(new Set(palette.entries.map((entry) => entry.name)).size).toBe(1820);
  });

  it('keeps the focus-outline role as an alias', () => {
    const entry = palette.byName.get('--tecton-palette-hot-pink-on-light-460');
    expect(entry?.value).toBe('#ff00aa');
    expect(entry?.alias).toBe('focus outline');
    expect(entry?.path).toBe('foundational.color.hotPink.onLight.460 (focus outline)');
  });

  it('resolves palette paths used by the semantic map', () => {
    expect(palette.byPath.get('foundational.color.mauve.onLight.680')?.value).toBe('#644a78');
  });

  it('writes a manifest with paths, values and extensions', () => {
    const manifest = paletteManifest(palette);
    expect(manifest['--tecton-palette-shades-white']).toMatchObject({
      path: 'foundational.color.shades.white',
      value: '#ffffff',
    });
  });
});
