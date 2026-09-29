/**
 * Colour maths for the contrast matrix: hex parsing, alpha compositing (source-over) and WCAG 2.x
 * relative luminance / contrast ratio. In-house on purpose (A§5.6): no colour library is approved.
 */

export interface Rgba {
  /** 0-255 */
  r: number;
  g: number;
  b: number;
  /** 0-1 */
  a: number;
}

const HEX = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/** True for `#rgb`, `#rgba`, `#rrggbb` and `#rrggbbaa`. */
export function isHexColor(value: string): boolean {
  return HEX.test(value.trim());
}

/** Parses a hex colour or the keyword `transparent`. Throws on anything else. */
export function parseColor(value: string): Rgba {
  const text = value.trim().toLowerCase();
  if (text === 'transparent') return {r: 0, g: 0, b: 0, a: 0};
  const match = HEX.exec(text);
  if (!match) throw new Error(`not a hex colour: "${value}"`);
  let digits = match[1]!;
  if (digits.length <= 4) digits = [...digits].map((digit) => digit + digit).join('');
  const byte = (index: number) => Number.parseInt(digits.slice(index, index + 2), 16);
  return {r: byte(0), g: byte(2), b: byte(4), a: digits.length === 8 ? byte(6) / 255 : 1};
}

/** Lowercase `#rrggbb` (opaque) or `#rrggbbaa`. */
export function toHex(color: Rgba): string {
  const part = (value: number) =>
    Math.max(0, Math.min(255, Math.round(value)))
      .toString(16)
      .padStart(2, '0');
  const base = `#${part(color.r)}${part(color.g)}${part(color.b)}`;
  return color.a >= 1 ? base : `${base}${part(color.a * 255)}`;
}

/** Source-over compositing of `fg` on `bg`. */
export function composite(fg: Rgba, bg: Rgba): Rgba {
  const a = fg.a + bg.a * (1 - fg.a);
  if (a === 0) return {r: 0, g: 0, b: 0, a: 0};
  const channel = (f: number, b: number) => (f * fg.a + b * bg.a * (1 - fg.a)) / a;
  return {r: channel(fg.r, bg.r), g: channel(fg.g, bg.g), b: channel(fg.b, bg.b), a};
}

function linear(channel: number): number {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance of an opaque colour. */
export function luminance(color: Rgba): number {
  return 0.2126 * linear(color.r) + 0.7152 * linear(color.g) + 0.0722 * linear(color.b);
}

/** WCAG contrast ratio (1-21) of two opaque colours. */
export function contrastRatio(a: Rgba, b: Rgba): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (light + 0.05) / (dark + 0.05);
}

/**
 * Contrast of `fg` on `bg` after compositing. A translucent `bg` is first composited over
 * `backdrop` (opaque), then a translucent `fg` over the result.
 */
export function contrastOver(fg: Rgba, bg: Rgba, backdrop: Rgba): number {
  const surface = bg.a < 1 ? composite(bg, backdrop) : bg;
  if (surface.a < 1) throw new Error('backdrop must be opaque');
  const ink = fg.a < 1 ? composite(fg, surface) : fg;
  return contrastRatio(ink, surface);
}
