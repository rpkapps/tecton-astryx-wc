/**
 * Pure conversion of Lucide icon nodes into `IconDefinition` data (A§12, D-009).
 *
 * Lucide describes an icon as `[tag, attributes][]` with `path`, `circle`, `ellipse`, `rect`, `line`,
 * `polyline` and `polygon` elements. `IconDefinition.paths` holds path data only, so every basic shape
 * is converted to an equivalent `d` string (same geometry, so the 2px round stroke renders identically).
 * The only element attribute that matters beyond geometry is `fill="currentColor"` on a few circles
 * (dots); those have r <= 1, so the stroke already covers them and the fill is dropped (asserted).
 *
 * Runs on Node type stripping (erasable syntax only); no dependencies.
 */

export type IconNode = [tag: string, attrs: Record<string, string | number | undefined>][];

export interface IconDefinitionData {
  viewBox: string;
  paths: {d: string}[];
  mode: 'stroke';
  strokeWidth: number;
  mirrorInRtl?: true;
}

/** Lucide's defaults (defaultAttributes.mjs): 24x24 viewBox, stroke width 2. */
export const LUCIDE_VIEW_BOX = '0 0 24 24';
export const LUCIDE_STROKE_WIDTH = 2;

/** Number formatting: at most 4 decimals, no trailing zeros, no `-0`. */
export function fmt(value: number): string {
  const text = (Math.round(value * 10000) / 10000).toString();
  return text === '-0' ? '0' : text;
}

function num(attrs: IconNode[number][1], name: string, fallback?: number): number {
  const raw = attrs[name];
  if (raw === undefined) {
    if (fallback === undefined) throw new Error(`missing attribute "${name}"`);
    return fallback;
  }
  const value = Number(raw);
  if (!Number.isFinite(value))
    throw new Error(`attribute "${name}" is not a number: ${String(raw)}`);
  return value;
}

/** Pairs of numbers from an SVG `points` list (`"1 2 3 4"`, `"1,2 3,4"`). */
function points(raw: string | number | undefined): [number, number][] {
  const values = String(raw ?? '')
    .match(/-?\d*\.?\d+(?:e-?\d+)?/gi)
    ?.map(Number);
  if (!values || values.length < 4 || values.length % 2 !== 0)
    throw new Error(`bad points list: ${String(raw)}`);
  const out: [number, number][] = [];
  for (let i = 0; i < values.length; i += 2) out.push([values[i]!, values[i + 1]!]);
  return out;
}

/** Path data equivalent to one Lucide element. */
export function shapeToPath(tag: string, attrs: IconNode[number][1]): string {
  switch (tag) {
    case 'path': {
      if (typeof attrs.d !== 'string' || attrs.d === '') throw new Error('path without d');
      return attrs.d;
    }
    case 'circle': {
      const [cx, cy, r] = [num(attrs, 'cx'), num(attrs, 'cy'), num(attrs, 'r')];
      if (attrs.fill !== undefined && attrs.fill !== 'none' && r > 1)
        throw new Error(`filled circle with r=${r} cannot be represented as a stroke`);
      return `M${fmt(cx - r)} ${fmt(cy)}a${fmt(r)} ${fmt(r)} 0 1 0 ${fmt(2 * r)} 0a${fmt(r)} ${fmt(r)} 0 1 0 ${fmt(-2 * r)} 0`;
    }
    case 'ellipse': {
      const [cx, cy, rx, ry] = [
        num(attrs, 'cx'),
        num(attrs, 'cy'),
        num(attrs, 'rx'),
        num(attrs, 'ry'),
      ];
      return `M${fmt(cx - rx)} ${fmt(cy)}a${fmt(rx)} ${fmt(ry)} 0 1 0 ${fmt(2 * rx)} 0a${fmt(rx)} ${fmt(ry)} 0 1 0 ${fmt(-2 * rx)} 0`;
    }
    case 'rect': {
      const [x, y, w, h] = [
        num(attrs, 'x', 0),
        num(attrs, 'y', 0),
        num(attrs, 'width'),
        num(attrs, 'height'),
      ];
      // SVG: a missing radius takes the other one; both are clamped to half the side.
      const rawRx = attrs.rx === undefined ? undefined : num(attrs, 'rx');
      const rawRy = attrs.ry === undefined ? undefined : num(attrs, 'ry');
      const rx = Math.min(rawRx ?? rawRy ?? 0, w / 2);
      const ry = Math.min(rawRy ?? rawRx ?? 0, h / 2);
      if (rx === 0 || ry === 0) return `M${fmt(x)} ${fmt(y)}h${fmt(w)}v${fmt(h)}h${fmt(-w)}z`;
      const arc = (dx: number, dy: number) => `a${fmt(rx)} ${fmt(ry)} 0 0 1 ${fmt(dx)} ${fmt(dy)}`;
      const parts = [`M${fmt(x + rx)} ${fmt(y)}`];
      if (w - 2 * rx > 0) parts.push(`h${fmt(w - 2 * rx)}`);
      parts.push(arc(rx, ry));
      if (h - 2 * ry > 0) parts.push(`v${fmt(h - 2 * ry)}`);
      parts.push(arc(-rx, ry));
      if (w - 2 * rx > 0) parts.push(`h${fmt(-(w - 2 * rx))}`);
      parts.push(arc(-rx, -ry));
      if (h - 2 * ry > 0) parts.push(`v${fmt(-(h - 2 * ry))}`);
      parts.push(arc(rx, -ry), 'z');
      return parts.join('');
    }
    case 'line':
      return `M${fmt(num(attrs, 'x1'))} ${fmt(num(attrs, 'y1'))}L${fmt(num(attrs, 'x2'))} ${fmt(num(attrs, 'y2'))}`;
    case 'polyline':
    case 'polygon': {
      const list = points(attrs.points);
      const [first, ...rest] = list as [[number, number], ...[number, number][]];
      const body = `M${fmt(first[0])} ${fmt(first[1])}${rest.map(([px, py]) => `L${fmt(px)} ${fmt(py)}`).join('')}`;
      return tag === 'polygon' ? `${body}z` : body;
    }
    default:
      throw new Error(`unsupported element <${tag}>`);
  }
}

/**
 * Directional glyphs mirrored in RTL (`mirrorInRtl`). Best effort by name: any `left` / `right` word
 * plus a few history/navigation icons. Media transport controls (`play`, `skip-*`, `step-*`,
 * `rewind`, `fast-forward`) are deliberately not mirrored: they follow the physical direction of time
 * in every locale. Roles in the default set set the flag explicitly instead of relying on this.
 */
export function isDirectional(name: string): boolean {
  const words = name.split('-');
  if (words.includes('left') || words.includes('right')) return true;
  return /^(undo|redo|reply|forward|log-in|log-out)(-\d)?(-all)?$/.test(name);
}

export function iconNodeToDefinition(node: IconNode, name: string): IconDefinitionData {
  const definition: IconDefinitionData = {
    viewBox: LUCIDE_VIEW_BOX,
    paths: node.map(([tag, attrs]) => ({d: shapeToPath(tag, attrs)})),
    mode: 'stroke',
    strokeWidth: LUCIDE_STROKE_WIDTH,
  };
  if (definition.paths.length === 0) throw new Error(`${name}: no shapes`);
  if (isDirectional(name)) definition.mirrorInRtl = true;
  return definition;
}

/** `chevron-left` -> `ChevronLeft` (Lucide's export names). */
export function kebabToPascal(kebab: string): string {
  return kebab
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

/** `MoreHorizontal` -> `more-horizontal`. */
export function pascalToKebab(pascal: string): string {
  return pascal
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();
}

/**
 * Aliases from Lucide's `iconsAndAliases.mjs`: `export { default as A, default as B } from './icons/x.mjs'`.
 * Only aliases whose kebab-case name is unambiguous (no digits, round-trips to the same PascalCase,
 * is not itself an icon) are returned: alias name -> canonical icon name.
 */
export function parseAliases(source: string, canonical: ReadonlySet<string>): Map<string, string> {
  const aliases = new Map<string, string>();
  for (const match of source.matchAll(/^export \{ (.*) \} from '\.\/icons\/([^']+)\.mjs';$/gm)) {
    const target = match[2]!;
    for (const pascal of [...match[1]!.matchAll(/default as (\w+)/g)].map((m) => m[1]!)) {
      const kebab = pascalToKebab(pascal);
      if (kebab === target || canonical.has(kebab) || /\d/.test(kebab)) continue;
      if (kebabToPascal(kebab) !== pascal) continue;
      const existing = aliases.get(kebab);
      if (existing !== undefined && existing !== target) continue;
      aliases.set(kebab, target);
    }
  }
  return aliases;
}

export const GENERATED_HEADER = (version: string) =>
  `// GENERATED by tools/icons/extract-lucide.ts from lucide@${version} (ISC; the Feather-derived glyphs are MIT, see THIRD-PARTY-NOTICES.md). Do not edit.`;

/** Source of one per-icon module `packages/icons/src/lucide/<name>.ts`. */
export function renderIconModule(definition: IconDefinitionData, version: string): string {
  const paths = definition.paths.map((path) => `{d: ${JSON.stringify(path.d)}}`).join(', ');
  const fields = [
    `viewBox: ${JSON.stringify(definition.viewBox)}`,
    `paths: [${paths}]`,
    `mode: 'stroke'`,
    `strokeWidth: ${definition.strokeWidth}`,
  ];
  if (definition.mirrorInRtl) fields.push('mirrorInRtl: true');
  return `${GENERATED_HEADER(version)}
import type {IconDefinition} from '../types.js';

const icon: IconDefinition = {${fields.join(', ')}};

export default icon;
`;
}

/**
 * Source of `packages/icons/src/lucide.ts`: lazy loaders for every glyph (and unambiguous alias), for
 * `registerIcons(lucideIcons, {namespace: 'lucide'})`. No eager import: each loader is a dynamic
 * `import()` of its own module, so only the glyphs a page uses are fetched.
 */
export function renderRegistry(
  names: readonly string[],
  aliases: ReadonlyMap<string, string>,
  version: string,
): string {
  const loader = (target: string) =>
    `() => import('./lucide/${target}.js').then((module) => module.default)`;
  const lines = [
    ...names.map((name) => `  ${JSON.stringify(name)}: ${loader(name)},`),
    ...[...aliases.entries()]
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(
        ([alias, target]) => `  ${JSON.stringify(alias)}: ${loader(target)}, // alias of ${target}`,
      ),
  ];
  return `${GENERATED_HEADER(version)}
import type {IconLoader} from './types.js';

/**
 * Every Lucide glyph as a lazy loader, keyed by its kebab-case name (\`chevron-down\`, \`a-arrow-up\`).
 * Register with a namespace so it never shadows the semantic role names:
 *
 *   registerIcons(lucideIcons, {namespace: 'lucide'});   // <tct-icon name="lucide:activity">
 *
 * Deprecated Lucide aliases (e.g. \`more-horizontal\`) resolve to the same module as their canonical name.
 */
export const lucideIcons: Readonly<Record<string, IconLoader>> = {
${lines.join('\n')}
};

/** Canonical glyph names (aliases excluded), sorted. */
export const lucideIconNames: readonly string[] = ${JSON.stringify([...names])};
`;
}
