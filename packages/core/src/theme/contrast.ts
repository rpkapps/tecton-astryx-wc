/**
 * WCAG 2.x relative luminance and contrast ratios (upstream `theme/contrast.ts`, adapted from
 * Astryx, MIT). Dependency-free; backs the contrast guarantees of generated colour tokens
 * (1.4.3 text >= 4.5:1, 1.4.11 non-text >= 3:1) and `tct-media-theme mode="auto"`.
 *
 * Semi-transparent foregrounds are composited over their backdrop in gamma-encoded sRGB (matching
 * CSS alpha compositing) before the ratio is measured: a translucent token has no contrast of its
 * own, only against what it renders on.
 */
import {parseColor, type RGBA} from './color.js';

/**
 * WCAG 2.x relative luminance of an sRGB colour (alpha ignored): 0 is black, 1 is white.
 * https://www.w3.org/WAI/WCAG22/Techniques/general/G18
 */
export function relativeLuminance(color: RGBA): number {
  const channel = (c: number): number => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b);
}

/**
 * Composites a (possibly translucent) foreground over an opaque backdrop with source-over blending
 * in gamma-encoded sRGB, as CSS paints translucent tokens. Returns an opaque colour.
 */
export function compositeOver(foreground: RGBA, backdrop: RGBA): RGBA {
  const a = foreground.a;
  return {
    r: foreground.r * a + backdrop.r * (1 - a),
    g: foreground.g * a + backdrop.g * (1 - a),
    b: foreground.b * a + backdrop.b * (1 - a),
    a: 1,
  };
}

function resolve(value: string | RGBA, label: string): RGBA {
  if (typeof value !== 'string') return value;
  const parsed = parseColor(value);
  if (parsed === null) {
    throw new TypeError(`contrastRatio: could not parse ${label} "${value}"`);
  }
  return parsed;
}

/**
 * WCAG 2.x contrast ratio between a foreground and an opaque background, in [1, 21]. A translucent
 * foreground is composited over the background first. A translucent background is rejected:
 * composite it over its own backdrop before calling.
 *
 * ```ts
 * contrastRatio('#000000', '#FFFFFF'); // 21
 * ```
 */
export function contrastRatio(foreground: string | RGBA, background: string | RGBA): number {
  const bg = resolve(background, 'background');
  if (bg.a < 1) {
    throw new TypeError(
      'contrastRatio: background must be opaque, composite it over its backdrop first',
    );
  }
  let fg = resolve(foreground, 'foreground');
  if (fg.a < 1) fg = compositeOver(fg, bg);
  const lumA = relativeLuminance(fg);
  const lumB = relativeLuminance(bg);
  return (Math.max(lumA, lumB) + 0.05) / (Math.min(lumA, lumB) + 0.05);
}
