import {describe, expect, it} from 'vitest';
import {composite, contrastOver, contrastRatio, isHexColor, parseColor, toHex} from './color.ts';

describe('parseColor / toHex', () => {
  it('parses 3, 4, 6 and 8 digit hex and transparent', () => {
    expect(parseColor('#fff')).toEqual({r: 255, g: 255, b: 255, a: 1});
    expect(parseColor('#0008')).toMatchObject({r: 0, a: 136 / 255});
    expect(parseColor('#ff00aa')).toEqual({r: 255, g: 0, b: 170, a: 1});
    expect(parseColor('#00000080').a).toBeCloseTo(0.502, 3);
    expect(parseColor('transparent').a).toBe(0);
  });

  it('round-trips', () => {
    for (const hex of ['#644a78', '#976dac40', '#ffffff00', '#000000']) {
      expect(toHex(parseColor(hex))).toBe(hex);
    }
  });

  it('rejects other notations', () => {
    expect(isHexColor('rgb(0,0,0)')).toBe(false);
    expect(() => parseColor('oklch(50% 0.1 20)')).toThrow();
  });
});

describe('contrast', () => {
  it('white on black is 21:1', () => {
    expect(contrastRatio(parseColor('#ffffff'), parseColor('#000000'))).toBeCloseTo(21, 5);
  });

  it('matches the ratios recorded in the Tecton audits', () => {
    // styling.md 8: #ff00aa on Tecton light body #f6f4f7 = 3.29:1, #ff52a8 on dark body #1d1c1f = 5.67:1
    expect(contrastRatio(parseColor('#ff00aa'), parseColor('#f6f4f7'))).toBeCloseTo(3.29, 2);
    expect(contrastRatio(parseColor('#ff52a8'), parseColor('#1d1c1f'))).toBeCloseTo(5.67, 2);
  });

  it('composites translucent foregrounds over the surface', () => {
    // black 50% over white = #808080 (rounded) -> 3.95:1 on white
    const mid = composite(parseColor('#00000080'), parseColor('#ffffff'));
    expect(toHex(mid)).toBe('#7f7f7f');
    expect(
      contrastOver(parseColor('#00000080'), parseColor('#ffffff'), parseColor('#ffffff')),
    ).toBeCloseTo(4.0, 1);
  });

  it('composites a translucent background over the backdrop before measuring', () => {
    const backdrop = parseColor('#ffffff');
    const wash = parseColor('#00000040');
    const onWash = contrastOver(parseColor('#000000'), wash, backdrop);
    const onBackdrop = contrastOver(parseColor('#000000'), backdrop, backdrop);
    expect(onWash).toBeLessThan(onBackdrop);
  });
});
