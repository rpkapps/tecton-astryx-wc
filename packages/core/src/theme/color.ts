/**
 * Shared colour parsing and formatting primitives for the theme utilities (upstream
 * `utils/color.ts`, adapted from Astryx, MIT; see THIRD-PARTY-NOTICES.md).
 *
 * Pure and Node-safe: nothing here touches the DOM. Values the parser cannot evaluate (`var()`,
 * `oklch()`, unknown names) return `null` so callers keep the original expression instead of guessing.
 */

/** A colour decomposed into 0-255 RGB channels and a 0-1 alpha. */
export interface RGBA {
  r: number;
  g: number;
  b: number;
  a: number;
}

/** The named colours token expressions rely on. */
const NAMED_COLORS: Readonly<Record<string, RGBA>> = {
  transparent: {r: 0, g: 0, b: 0, a: 0},
  black: {r: 0, g: 0, b: 0, a: 1},
  white: {r: 255, g: 255, b: 255, a: 1},
};

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

/** Expands a shorthand hex body (`rgb`/`rgba`) to its full form (`rrggbb`/`rrggbbaa`). */
function expandShorthand(body: string): string {
  return body
    .split('')
    .map((c) => c + c)
    .join('');
}

/**
 * Parses a hex colour. Accepts `#rgb`, `#rgba`, `#rrggbb` and `#rrggbbaa`, with or without the
 * leading `#`. Returns `null` for anything else.
 */
export function parseHex(hex: string): RGBA | null {
  if (typeof hex !== 'string') return null;
  const body = hex.trim().replace(/^#/, '');
  const normalized = body.length === 3 || body.length === 4 ? expandShorthand(body) : body;
  if ((normalized.length !== 6 && normalized.length !== 8) || !/^[0-9a-fA-F]+$/.test(normalized)) {
    return null;
  }
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
    a: normalized.length === 8 ? parseInt(normalized.slice(6, 8), 16) / 255 : 1,
  };
}

/** Splits a functional-notation body (`a, b, c` / `a b c / d`) into its non-empty tokens. */
function functionArguments(value: string): string[] | null {
  const open = value.indexOf('(');
  if (open === -1 || !value.trim().endsWith(')')) return null;
  const body = value.slice(open + 1, value.lastIndexOf(')')).replace(/\//g, ' ');
  return body
    .split(/[\s,]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function alphaOf(raw: string | undefined): number | null {
  if (raw === undefined) return 1;
  const a = raw.endsWith('%') ? parseFloat(raw) / 100 : parseFloat(raw);
  return Number.isNaN(a) ? null : clamp(a, 0, 1);
}

/**
 * Parses `rgb()`/`rgba()`: comma- or space-separated channels, an optional `/ alpha`, percentage
 * channels.
 */
export function parseRgb(value: string): RGBA | null {
  const parts = functionArguments(value);
  if (!parts || parts.length < 3) return null;
  const channel = (part: string): number =>
    clamp(part.endsWith('%') ? (parseFloat(part) / 100) * 255 : parseFloat(part), 0, 255);
  const r = channel(parts[0]!);
  const g = channel(parts[1]!);
  const b = channel(parts[2]!);
  if ([r, g, b].some(Number.isNaN)) return null;
  const a = alphaOf(parts[3]);
  return a === null ? null : {r, g, b, a};
}

/**
 * Parses `color(srgb r g b / a)` with 0-1 channels, the serialisation engines use for a computed
 * `color-mix()` result. Other colour spaces return `null`.
 */
export function parseColorSrgb(value: string): RGBA | null {
  const parts = functionArguments(value);
  if (!parts || parts.length < 4 || parts[0]!.toLowerCase() !== 'srgb') return null;
  const channel = (part: string): number =>
    clamp((part.endsWith('%') ? parseFloat(part) / 100 : parseFloat(part)) * 255, 0, 255);
  const r = channel(parts[1]!);
  const g = channel(parts[2]!);
  const b = channel(parts[3]!);
  if ([r, g, b].some(Number.isNaN)) return null;
  const a = alphaOf(parts[4]);
  return a === null ? null : {r, g, b, a};
}

/**
 * Parses a concrete CSS colour: hex, `rgb()`/`rgba()`, `color(srgb …)` and the named colours used in
 * token expressions. Returns `null` for anything it cannot evaluate.
 */
export function parseColor(value: string): RGBA | null {
  const trimmed = value.trim();
  const named = NAMED_COLORS[trimmed.toLowerCase()];
  if (named) return {...named};
  if (trimmed.startsWith('#')) return parseHex(trimmed);
  if (/^rgba?\(/i.test(trimmed)) return parseRgb(trimmed);
  if (/^color\(\s*srgb[\s)]/i.test(trimmed)) return parseColorSrgb(trimmed);
  return null;
}

/** Formats RGB channels (0-255) as an uppercase `#RRGGBB` string. */
export function formatHex(r: number, g: number, b: number): string {
  const channel = (c: number): string =>
    clamp(Math.round(c), 0, 255).toString(16).padStart(2, '0').toUpperCase();
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

/** Serialises to `#RRGGBB` when fully opaque, otherwise `rgba(r, g, b, a)`. */
export function formatColor({r, g, b, a}: RGBA): string {
  if (a >= 1) return formatHex(r, g, b);
  const round = (n: number): number => clamp(Math.round(n), 0, 255);
  return `rgba(${round(r)}, ${round(g)}, ${round(b)}, ${parseFloat(a.toFixed(4))})`;
}
