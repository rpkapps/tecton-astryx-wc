/**
 * Colour parsing, WCAG contrast and the pure media-mode pick (ported from upstream contrast.test.ts,
 * useAutoMediaMode.test.ts and utils/color tests).
 */
import {describe, expect, it} from 'vitest';
import {pickMediaMode} from './auto-media-mode.js';
import {formatColor, formatHex, parseColor, parseHex, parseRgb} from './color.js';
import {compositeOver, contrastRatio, relativeLuminance} from './contrast.js';

const rgb = (hex: string) => {
  const parsed = parseColor(hex);
  if (parsed === null) throw new Error(`fixture colour ${hex} must parse`);
  return parsed;
};

describe('parseColor', () => {
  it('parses hex in all four lengths, with or without #', () => {
    expect(parseHex('#0f8')).toEqual({r: 0, g: 255, b: 136, a: 1});
    expect(parseHex('#0f88')?.a).toBeCloseTo(136 / 255, 5);
    expect(parseHex('123456')).toEqual({r: 18, g: 52, b: 86, a: 1});
    expect(parseHex('#12345680')?.a).toBeCloseTo(128 / 255, 5);
    expect(parseHex('#12345')).toBeNull();
    expect(parseHex('#zzzzzz')).toBeNull();
  });

  it('parses rgb() and rgba() in comma, space and slash forms, and percentages', () => {
    expect(parseRgb('rgb(10, 20, 30)')).toEqual({r: 10, g: 20, b: 30, a: 1});
    expect(parseRgb('rgba(10 20 30 / 0.5)')).toEqual({r: 10, g: 20, b: 30, a: 0.5});
    expect(parseRgb('rgb(100% 0% 50% / 25%)')).toEqual({r: 255, g: 0, b: 127.5, a: 0.25});
    expect(parseRgb('rgb(10, 20)')).toBeNull();
    expect(parseRgb('rgb(a, b, c)')).toBeNull();
  });

  it('parses color(srgb …), the computed form of a color-mix() result', () => {
    expect(parseColor('color(srgb 0.5 0 1)')).toEqual({r: 127.5, g: 0, b: 255, a: 1});
    expect(parseColor('color(srgb 1 1 1 / 0.5)')?.a).toBe(0.5);
    expect(parseColor('color(display-p3 1 0 0)')).toBeNull();
  });

  it('knows the named colours token expressions use, and nothing it cannot evaluate', () => {
    expect(parseColor('transparent')).toEqual({r: 0, g: 0, b: 0, a: 0});
    expect(parseColor('White')).toEqual({r: 255, g: 255, b: 255, a: 1});
    expect(parseColor('var(--color-accent)')).toBeNull();
    expect(parseColor('oklch(0.5 0.1 200)')).toBeNull();
    expect(parseColor('rebeccapurple')).toBeNull();
  });

  it('formats opaque colours as #RRGGBB and translucent ones as rgba()', () => {
    expect(formatHex(255, 0, 128)).toBe('#FF0080');
    expect(formatColor({r: 1, g: 2, b: 3, a: 1})).toBe('#010203');
    expect(formatColor({r: 1, g: 2, b: 3, a: 0.5})).toBe('rgba(1, 2, 3, 0.5)');
  });
});

describe('relativeLuminance', () => {
  it('is 0 for black and 1 for white', () => {
    expect(relativeLuminance({r: 0, g: 0, b: 0, a: 1})).toBe(0);
    expect(relativeLuminance({r: 255, g: 255, b: 255, a: 1})).toBeCloseTo(1, 10);
  });

  it('weights channels per WCAG (green brightest, blue darkest)', () => {
    expect(relativeLuminance({r: 255, g: 0, b: 0, a: 1})).toBeCloseTo(0.2126, 4);
    expect(relativeLuminance({r: 0, g: 255, b: 0, a: 1})).toBeCloseTo(0.7152, 4);
    expect(relativeLuminance({r: 0, g: 0, b: 255, a: 1})).toBeCloseTo(0.0722, 4);
  });
});

describe('contrastRatio', () => {
  it('is 21 for black on white and 1 for identical colors', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrastRatio('#3B82F6', '#3B82F6')).toBe(1);
  });

  it('is symmetric in fg/bg for opaque colors', () => {
    expect(contrastRatio('#0064E0', '#FCFDFE')).toBeCloseTo(
      contrastRatio('#FCFDFE', '#0064E0'),
      10,
    );
  });

  it('matches the canonical 4.5:1 boundary gray (#767676 on white)', () => {
    const ratio = contrastRatio('#767676', '#FFFFFF');
    expect(ratio).toBeGreaterThanOrEqual(4.5);
    expect(ratio).toBeLessThan(4.6);
  });

  it('composites a translucent foreground over the background', () => {
    const composited = contrastRatio('rgba(0, 0, 0, 0.5)', '#FFFFFF');
    expect(composited).toBeLessThan(contrastRatio('#000000', '#FFFFFF'));
    expect(composited).toBeCloseTo(contrastRatio('rgb(127.5, 127.5, 127.5)', '#FFFFFF'), 10);
  });

  it('rejects a translucent background', () => {
    expect(() => contrastRatio('#000000', '#FFFFFF80')).toThrow(/background must be opaque/);
  });

  it('rejects unparseable colors', () => {
    expect(() => contrastRatio('var(--color-accent)', '#FFFFFF')).toThrow(
      /could not parse foreground/,
    );
    expect(() => contrastRatio('#000000', 'oklch(0.5 0.1 200)')).toThrow(
      /could not parse background/,
    );
  });
});

describe('compositeOver', () => {
  it('returns the foreground when opaque and the backdrop at alpha 0', () => {
    const fg = rgb('#123456');
    const bg = rgb('#FFFFFF');
    expect(compositeOver(fg, bg)).toEqual({...fg, a: 1});
    expect(compositeOver({...fg, a: 0}, bg)).toEqual({...bg, a: 1});
  });

  it('blends in gamma-encoded sRGB space like CSS', () => {
    const out = compositeOver(rgb('rgba(0, 0, 0, 0.5)'), rgb('#FFFFFF'));
    expect(out.r).toBeCloseTo(127.5, 5);
    expect(out.g).toBeCloseTo(127.5, 5);
    expect(out.b).toBeCloseTo(127.5, 5);
    expect(out.a).toBe(1);
  });
});

describe('pickMediaMode (useAutoMediaMode.test.ts)', () => {
  const onDark = rgb('#f6f5f8');
  const onLight = rgb('#131214');

  it('is off when the ambient text already reads on the surface at 3:1', () => {
    expect(pickMediaMode(rgb('#ffffff'), onLight, onDark, onLight)).toBe('off');
  });

  it('picks dark for a dark surface the ambient text does not read on', () => {
    expect(pickMediaMode(rgb('#21172a'), onLight, onDark, onLight)).toBe('dark');
  });

  it('picks light for a pale surface the (light) ambient text does not read on', () => {
    expect(pickMediaMode(rgb('#f6f5f8'), onDark, onDark, onLight)).toBe('light');
  });

  it('breaks an exact tie towards dark', () => {
    // A surface where both on-colours give the same ratio: the on-colours are the same colour.
    const same = rgb('#808080');
    expect(pickMediaMode(rgb('#808080'), null, same, same)).toBe('dark');
  });

  it('answers null when an on-colour is unknown, so the fallback applies', () => {
    expect(pickMediaMode(rgb('#000000'), onLight, null, onLight)).toBeNull();
    expect(pickMediaMode(rgb('#000000'), onLight, onDark, null)).toBeNull();
  });

  it('ignores an unknown ambient colour and decides by the on-colours', () => {
    expect(pickMediaMode(rgb('#000000'), null, onDark, onLight)).toBe('dark');
    expect(pickMediaMode(rgb('#ffffff'), null, onDark, onLight)).toBe('light');
  });
});
