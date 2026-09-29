/**
 * Palette normalisation (A§5.3, tecton-theme.md §2.3): `tecton.tokens.json` (1,820 immutable colour
 * primitives) -> `--tecton-palette-<segments>` names plus a manifest, failing on any collision.
 */

export interface PaletteEntry {
  /** `--tecton-palette-…` */
  name: string;
  /** Full dot path as written in tecton.tokens.json, e.g. `foundational.color.hotPink.onDark.460 (focus outline)`. */
  path: string;
  /** Lowercase hex from `$value`. */
  value: string;
  /** Text of a stripped trailing parenthetical, e.g. `focus outline`. */
  alias?: string;
  /** `$extensions` verbatim. */
  extensions?: unknown;
}

export interface Palette {
  entries: PaletteEntry[];
  byName: Map<string, PaletteEntry>;
  byPath: Map<string, PaletteEntry>;
  /** hex -> every palette entry with that value, in document order. */
  byHex: Map<string, PaletteEntry[]>;
}

/** Root the palette paths start with (the map and the overrides use full paths). */
export const PALETTE_ROOT = 'foundational.color';
export const PALETTE_PREFIX = '--tecton-palette-';

/**
 * Normalises one path segment. Rules, in order: strip a trailing `(…)` (kept as alias), `%` -> `pct`,
 * camelCase boundary -> `-`, lowercase, any run of `[^a-z0-9]` -> `-`, trim `-`.
 */
export function normalizeSegment(segment: string): {name: string; alias?: string} {
  let text = segment;
  let alias: string | undefined;
  const parenthetical = /\s*\(([^)]*)\)\s*$/.exec(text);
  if (parenthetical) {
    alias = parenthetical[1]!.trim();
    text = text.slice(0, parenthetical.index);
  }
  text = text.replace(/%/g, 'pct');
  text = text.replace(/([a-z0-9])([A-Z])/g, '$1-$2');
  text = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return alias === undefined ? {name: text} : {name: text, alias};
}

/** `--tecton-palette-` + normalised segments after `foundational.color`. */
export function paletteName(segments: readonly string[]): {name: string; alias?: string} {
  const parts: string[] = [];
  let alias: string | undefined;
  for (const segment of segments) {
    const normalized = normalizeSegment(segment);
    if (normalized.alias !== undefined) alias = normalized.alias;
    if (normalized.name !== '') parts.push(normalized.name);
  }
  const name = `${PALETTE_PREFIX}${parts.join('-')}`;
  return alias === undefined ? {name} : {name, alias};
}

interface DtcgNode {
  $value?: unknown;
  $extensions?: unknown;
  [key: string]: unknown;
}

/**
 * Flattens the DTCG tree. Value-plus-children nodes (`shades.white`) emit their own value and their
 * children. Throws when a name collides (also case-folded) or a value is not a hex colour.
 */
export function buildPalette(json: unknown): Palette {
  const root = (json as {foundational?: {color?: DtcgNode}}).foundational?.color;
  if (!root) throw new Error('tecton.tokens.json: missing foundational.color');
  const entries: PaletteEntry[] = [];

  const visit = (node: DtcgNode, segments: string[]) => {
    if (segments.length > 0 && node.$value !== undefined) {
      const value = node.$value;
      if (typeof value !== 'string' || !/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(value))
        throw new Error(`${[PALETTE_ROOT, ...segments].join('.')}: $value is not a hex colour`);
      const {name, alias} = paletteName(segments);
      const entry: PaletteEntry = {
        name,
        path: [PALETTE_ROOT, ...segments].join('.'),
        value: value.toLowerCase(),
      };
      if (alias !== undefined) entry.alias = alias;
      if (node.$extensions !== undefined) entry.extensions = node.$extensions;
      entries.push(entry);
    }
    for (const [key, child] of Object.entries(node)) {
      if (key.startsWith('$')) continue;
      if (typeof child === 'object' && child !== null) visit(child as DtcgNode, [...segments, key]);
    }
  };
  visit(root, []);

  const byName = new Map<string, PaletteEntry>();
  const folded = new Map<string, PaletteEntry>();
  const byPath = new Map<string, PaletteEntry>();
  const byHex = new Map<string, PaletteEntry[]>();
  for (const entry of entries) {
    const clash = byName.get(entry.name) ?? folded.get(entry.name.toLowerCase());
    if (clash) {
      throw new Error(
        `palette name collision: ${entry.name} <- "${entry.path}" and "${clash.path}"`,
      );
    }
    byName.set(entry.name, entry);
    folded.set(entry.name.toLowerCase(), entry);
    byPath.set(entry.path, entry);
    const list = byHex.get(entry.value) ?? [];
    list.push(entry);
    byHex.set(entry.value, list);
  }
  return {entries, byName, byPath, byHex};
}

/** `dist/palette.manifest.json`: name -> source path -> value -> extensions -> alias. */
export function paletteManifest(palette: Palette): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const entry of palette.entries) {
    out[entry.name] = {
      path: entry.path,
      value: entry.value,
      ...(entry.alias === undefined ? {} : {alias: entry.alias}),
      ...(entry.extensions === undefined ? {} : {extensions: entry.extensions}),
    };
  }
  return out;
}

/** Path without the `foundational.color.` prefix, for comments and docs. */
export function shortPath(path: string): string {
  return path.startsWith(`${PALETTE_ROOT}.`) ? path.slice(PALETTE_ROOT.length + 1) : path;
}
