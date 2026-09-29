/**
 * The converted Tecton glyphs against the original markup, in a real engine (Chromium locally; Firefox
 * and WebKit in CI). Each variant of each glyph is rendered twice at four sizes, once from the authored
 * markup (`glyphs/<name>.ts`) and once from the shipped `IconDefinition` (`tecton/<name>.ts`), the way
 * `tct-icon` draws it: `<path d>` per entry of `paths`, or the raw `svg` body when the glyph has one.
 *
 *  - The 17 glyphs converted to paths must match pixel for pixel (RGBA, every pixel, every size).
 *  - `strata` paints a CSS conic gradient through `<foreignObject>`, which paths and a sanitiser cannot
 *    express. Its converted body is a fan of flat wedges (tools/icons/tecton-convert.ts), so it is an
 *    approximation: the test bounds the difference instead of demanding zero. Measured in Chromium 141
 *    (mean absolute difference over painted pixels, composited over white): 96px 1.7, 48px 3.9.
 */
import {describe, expect, it} from 'vitest';
import {tectonIconNames, tectonIcons} from './tecton.js';
import type {IconDefinition, IconLoader} from './types.js';

const loadIcon = (name: string): Promise<IconDefinition> =>
  (tectonIcons as Record<string, IconLoader>)[name]!();

interface GlyphData {
  viewBox: string;
  colored?: boolean;
  outlined: string;
  filled: string;
}

const glyphModules = import.meta.glob<Record<string, GlyphData>>('./tecton/glyphs/*.ts', {
  eager: true,
});
const original = (name: string): GlyphData => {
  const module = glyphModules[`./tecton/glyphs/${name}.ts`];
  if (!module) throw new Error(`no authored data for ${name}`);
  return Object.values(module)[0]!;
};

/** The markup `tct-icon` renders for a definition. */
const converted = (definition: IconDefinition): string =>
  definition.svg ??
  definition.paths
    .map((path) => `<path d="${path.d}"${path.fillRule ? ` fill-rule="${path.fillRule}"` : ''}/>`)
    .join('');

const SIZES = [16, 24, 48, 96];

const canvas = document.createElement('canvas');

/** RGBA pixels of `<svg viewBox>` + markup at `size` x `size` (currentColor = black). */
async function rasterise(viewBox: string, inner: string, size: number): Promise<Uint8ClampedArray> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${viewBox}" fill="currentColor" color="black">${inner}</svg>`;
  const image = new Image();
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await image.decode();
  canvas.width = canvas.height = size;
  const context = canvas.getContext('2d', {willReadFrequently: true})!;
  context.clearRect(0, 0, size, size);
  context.drawImage(image, 0, 0);
  return context.getImageData(0, 0, size, size).data;
}

interface Difference {
  painted: number;
  /** Pixels that differ at all. */
  different: number;
  /** Mean absolute difference over painted pixels, composited over white (all channels and alpha). */
  mean: number;
  /** Share of painted pixels that differ by more than 16 levels. */
  over16: number;
}

function compare(a: Uint8ClampedArray, b: Uint8ClampedArray): Difference {
  let [painted, different, over16, sum] = [0, 0, 0, 0];
  for (let i = 0; i < a.length; i += 4) {
    let worst = Math.abs(a[i + 3]! - b[i + 3]!);
    for (let k = 0; k < 3; k++) {
      const over = (pixels: Uint8ClampedArray) =>
        (pixels[i + k]! * pixels[i + 3]! + 255 * (255 - pixels[i + 3]!)) / 255;
      worst = Math.max(worst, Math.abs(over(a) - over(b)));
    }
    if (a[i + 3]! > 0 || b[i + 3]! > 0) {
      painted++;
      sum += worst;
      if (worst > 16) over16++;
    }
    if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2] || a[i + 3] !== b[i + 3])
      different++;
  }
  return {
    painted,
    different,
    mean: sum / Math.max(1, painted),
    over16: over16 / Math.max(1, painted),
  };
}

const EXACT = tectonIconNames.filter((name) => original(name).colored !== true);

describe('Tecton icons render like the original markup', () => {
  describe.each(EXACT)('%s (converted to paths)', (name) => {
    it.each(['outlined', 'filled'] as const)(
      '%s is pixel-identical at every size',
      async (variant) => {
        const data = original(name);
        const definition = await loadIcon(variant === 'outlined' ? name : `${name}-filled`);
        expect(definition.svg).toBeUndefined();
        for (const size of SIZES) {
          const [a, b] = await Promise.all([
            rasterise(data.viewBox, data[variant], size),
            rasterise(definition.viewBox, converted(definition), size),
          ]);
          const difference = compare(a, b);
          expect(
            difference.painted,
            `${name} ${variant} ${size}px paints something`,
          ).toBeGreaterThan(0);
          expect(difference.different, `${name} ${variant} ${size}px`).toBe(0);
        }
      },
    );
  });

  describe('strata (conic gradient -> wedge fan; an approximation, bounded)', () => {
    // Chromium 141 measures mean 1.7 / 3.9 and over-16 share 1.1% / 5.6% at 96 / 48px; the bounds leave room
    // for engine differences in gradient rasterisation and anti-aliasing.
    const BOUNDS: Record<number, {mean: number; over16: number}> = {
      96: {mean: 4, over16: 0.05},
      48: {mean: 7, over16: 0.12},
    };

    it.each(['outlined', 'filled'] as const)('%s stays close to the original', async (variant) => {
      const data = original('strata');
      const definition = await loadIcon(variant === 'outlined' ? 'strata' : 'strata-filled');
      expect(definition.svg).toBeDefined();
      for (const [size, bound] of Object.entries(BOUNDS)) {
        const [a, b] = await Promise.all([
          rasterise(data.viewBox, data[variant], Number(size)),
          rasterise(definition.viewBox, converted(definition), Number(size)),
        ]).catch(() => [undefined, undefined] as const);
        if (!a || !b) continue; // this engine taints the canvas for <foreignObject>: nothing to compare
        const difference = compare(a, b);
        expect(difference.painted).toBeGreaterThan(0);
        expect(difference.mean, `${size}px mean difference`).toBeLessThan(bound.mean);
        expect(difference.over16, `${size}px share of pixels off by more than 16`).toBeLessThan(
          bound.over16,
        );
      }
    });

    it('draws the gradient: the top layer is coloured, the two lower layers are currentColor', async () => {
      const definition = await loadIcon('strata');
      const size = 96;
      const pixels = await rasterise(definition.viewBox, converted(definition), size);
      const at = (x: number, y: number) =>
        Array.from(pixels.slice((y * size + x) * 4, (y * size + x) * 4 + 4));
      // viewBox 0.35..15.65: the top diamond is centred at (8.325, 4.917) -> (49, 28) px. Left of the centre is
      // the gradient's red end, right of it the orange end; the lower layers are black.
      const [r, g, b, a] = at(45, 22);
      expect(a).toBe(255);
      expect(r).toBeGreaterThan(150);
      expect(g).toBeLessThan(80);
      expect(b).toBeGreaterThan(20);
      expect(at(60, 30)[0]).toBeGreaterThan(200); // orange side
      expect(at(48, 65)).toEqual([0, 0, 0, 255]); // second layer band
    });

    it('falls back to a recognisable single-colour glyph when only `paths` is drawn', async () => {
      const definition = await loadIcon('strata');
      const pixels = await rasterise(
        definition.viewBox,
        definition.paths.map((path) => `<path d="${path.d}"/>`).join(''),
        96,
      );
      const centre = (28 * 96 + 49) * 4;
      expect(Array.from(pixels.slice(centre, centre + 4))).toEqual([0, 0, 0, 255]);
    });
  });

  // The registry sanitises the raw body once (A§12). Where the engine has the native Sanitizer API, prove
  // the body survives it untouched: every element, fill and geometry the glyph needs is kept.
  it.skipIf(!('setHTML' in Element.prototype))(
    'strata svg body survives the native Sanitizer unchanged',
    async () => {
      const {svg} = await loadIcon('strata');
      const host = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      (host as unknown as {setHTML: (html: string) => void}).setHTML(svg!);
      const paths = [...host.querySelectorAll('path')];
      expect(paths.length).toBe((svg!.match(/<path /g) ?? []).length);
      expect(paths[0]!.getAttribute('fill')).toBe('currentColor');
      expect(paths.at(-1)!.getAttribute('fill')).toMatch(/^#[0-9a-f]{6}$/);
    },
  );
});
