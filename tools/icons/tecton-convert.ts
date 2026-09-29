/**
 * Pure conversion of the Tecton domain icon markup into `IconDefinition` data (A§12, D-013 Q-02).
 *
 * The authored source (`packages/icons/src/tecton/source/<name>.ts`, copied from the owner's set) holds
 * each glyph as inner SVG markup. `convertGlyph` turns it into
 *
 *  - `paths`: path data for every plain `<path>`, every `<rect>` (converted to an equivalent path
 *    exactly, with the same helper the Lucide conversion uses) and every simple `<g>` wrapper (flattened;
 *    a `fill-rule` on the group is inherited by its paths). This is the exact route: the definition
 *    renders through `<path d>` and is pixel-identical to the original markup.
 *  - `svg` (only when a glyph cannot be expressed as paths): an already-safe raw SVG body made of
 *    `<path>` elements with `fill` presentation attributes only (no `<defs>`, ids, `url()` references,
 *    `style` or `<foreignObject>`), which the registry sanitises once (A§12) and clones. `paths` keeps the
 *    single-colour outline of the glyph, so a renderer that ignores `svg` still draws a recognisable icon.
 *
 * A clip path that does not clip anything (a single `<rect>` covering the viewBox, as design tools export
 * around every frame) is dropped exactly. The one construct with no SVG counterpart is a CSS
 * `conic-gradient()` drawn through `<foreignObject>` (the top layer of `strata`): it is re-expressed as a
 * fan of flat-coloured wedges (`conicGradientFan`). That is an approximation, not an identity: the browser
 * point-samples the original gradient per pixel, while wedges are anti-aliased shapes. The error is
 * measured against the original markup by the browser test (packages/icons/src/tecton.test.ts).
 *
 * Runs on Node type stripping (erasable syntax only); no dependencies.
 */
import {shapeToPath} from './lucide-convert.ts';

// ---- Markup parsing --------------------------------------------------------------------------------

export interface MarkupNode {
  tag: string;
  attrs: Record<string, string>;
  children: MarkupNode[];
}

const TAG = /<(\/?)([a-zA-Z][\w:-]*)((?:\s+[\w:-]+="[^"]*")*)\s*(\/?)>/g;
const ATTR = /([\w:-]+)="([^"]*)"/g;

/** Parses the restricted markup of the source data (double-quoted attributes, no text content). */
export function parseMarkup(markup: string): MarkupNode[] {
  const root: MarkupNode = {tag: '#root', attrs: {}, children: []};
  const stack: MarkupNode[] = [root];
  let last = 0;
  for (const match of markup.matchAll(TAG)) {
    const between = markup.slice(last, match.index).trim();
    if (between !== '') throw new Error(`unexpected text in glyph markup: "${between}"`);
    last = match.index + match[0].length;
    const [, closing, tag, rawAttrs, selfClosing] = match as unknown as [
      string,
      string,
      string,
      string,
      string,
    ];
    if (closing) {
      const open = stack.pop();
      if (open?.tag !== tag || stack.length === 0)
        throw new Error(`unbalanced </${tag}> in glyph markup`);
      continue;
    }
    const node: MarkupNode = {tag, attrs: {}, children: []};
    for (const attr of rawAttrs.matchAll(ATTR)) node.attrs[attr[1]!] = attr[2]!;
    stack[stack.length - 1]!.children.push(node);
    if (!selfClosing) stack.push(node);
  }
  if (markup.slice(last).trim() !== '') throw new Error('trailing text in glyph markup');
  if (stack.length !== 1) throw new Error(`unclosed <${stack[stack.length - 1]!.tag}>`);
  return root.children;
}

// ---- Numbers, points, matrices ---------------------------------------------------------------------

export type Point = [x: number, y: number];
export type Matrix = [a: number, b: number, c: number, d: number, e: number, f: number];

/** At most 3 decimals, no trailing zeros, no `-0`. */
export function fmt3(value: number): string {
  const text = (Math.round(value * 1000) / 1000).toString();
  return text === '-0' ? '0' : text;
}

function numbers(text: string): number[] {
  return (text.match(/-?\d*\.?\d+(?:e-?\d+)?/gi) ?? []).map(Number);
}

/** `matrix(a b c d e f)` (space or comma separated). */
export function parseMatrix(text: string): Matrix {
  const match = /^\s*matrix\(([^)]*)\)\s*$/.exec(text);
  const values = match ? numbers(match[1]!) : [];
  if (values.length !== 6) throw new Error(`unsupported transform "${text}" (only matrix() is)`);
  return values as Matrix;
}

/** Vertices of a polygon written with absolute `M`, `L`, `H`, `V`, `Z` commands only. */
export function parsePolygon(d: string): Point[] {
  const points: Point[] = [];
  let current: Point = [0, 0];
  for (const match of d.matchAll(/([MLHVZ])([^MLHVZ]*)/g)) {
    const command = match[1]!;
    const args = numbers(match[2]!);
    if (command === 'Z') continue;
    if (command === 'H') current = [args[0]!, current[1]];
    else if (command === 'V') current = [current[0], args[0]!];
    else current = [args[0]!, args[1]!];
    if (command === 'M' && points.length > 0)
      throw new Error('clip path with several sub-paths is not supported');
    points.push(current);
  }
  const [first, last] = [points[0], points[points.length - 1]];
  if (
    first &&
    last &&
    points.length > 1 &&
    Math.hypot(first[0] - last[0], first[1] - last[1]) < 1e-3
  )
    points.pop();
  if (points.length < 3) throw new Error(`clip path "${d}" is not a polygon`);
  return points;
}

// ---- CSS conic-gradient ----------------------------------------------------------------------------

export interface ColorStop {
  /** Position in degrees, 0..360. */
  at: number;
  rgb: [number, number, number];
}
export interface ConicGradient {
  /** `from <angle>` in degrees (CSS: clockwise from 12 o'clock). */
  from: number;
  stops: ColorStop[];
}

/** The text between the parentheses of the first `name(...)` in `css` (nested parentheses balanced). */
function functionBody(css: string, name: string): string | undefined {
  const start = css.indexOf(`${name}(`);
  if (start === -1) return undefined;
  let depth = 0;
  for (let i = start + name.length; i < css.length; i++) {
    if (css[i] === '(') depth++;
    else if (css[i] === ')' && --depth === 0) return css.slice(start + name.length + 1, i);
  }
  return undefined;
}

/** `conic-gradient(from 90deg, rgba(r, g, b, 1) 0deg, ..., ... 360deg)`: opaque stops with explicit degree positions only. */
export function parseConicGradient(css: string): ConicGradient {
  const body = functionBody(css, 'conic-gradient');
  if (!body) throw new Error(`no conic-gradient() in "${css}"`);
  const from = /^\s*from\s+(-?[\d.]+)deg\s*,/.exec(body);
  const stops: ColorStop[] = [];
  const stop = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)\s+(-?[\d.]+)deg/g;
  for (const match of body.matchAll(stop)) {
    if (match[4] !== undefined && Number(match[4]) !== 1)
      throw new Error('translucent gradient stops are not supported');
    stops.push({at: Number(match[5]), rgb: [Number(match[1]), Number(match[2]), Number(match[3])]});
  }
  if (stops.length < 2) throw new Error(`conic-gradient with fewer than two stops: ${body}`);
  for (let i = 1; i < stops.length; i++)
    if (stops[i]!.at < stops[i - 1]!.at) throw new Error('conic-gradient stops must be ascending');
  if (stops[0]!.at !== 0 || stops[stops.length - 1]!.at !== 360)
    throw new Error('conic-gradient stops must span 0deg..360deg');
  return {from: from ? Number(from[1]) : 0, stops};
}

/** Colour at `angle` degrees: piecewise linear between stops in sRGB (the CSS default). */
export function gradientColor(
  stops: readonly ColorStop[],
  angle: number,
): [number, number, number] {
  for (let i = 1; i < stops.length; i++) {
    const [lo, hi] = [stops[i - 1]!, stops[i]!];
    if (angle <= hi.at) {
      const t = hi.at === lo.at ? 1 : (angle - lo.at) / (hi.at - lo.at);
      return lo.rgb.map((channel, k) => channel + (hi.rgb[k]! - channel) * t) as [
        number,
        number,
        number,
      ];
    }
  }
  return stops[stops.length - 1]!.rgb;
}

const hex = (rgb: readonly number[]) =>
  `#${rgb.map((channel) => Math.round(channel).toString(16).padStart(2, '0')).join('')}`;

// ---- Conic gradient -> wedge fan -------------------------------------------------------------------

export interface FanOptions {
  /**
   * Largest colour change (8-bit levels, any channel) between two neighbouring wedges of the top layer.
   * 4 keeps the quantisation error at 2 levels, at the level of the dithering the browser applies to the
   * original gradient. Finer wedges are not better: every extra seam is one more anti-aliasing seam.
   */
  maxColorStep: number;
  /**
   * The top layer is a fan of abutting wedges. Where two wedges meet inside one device pixel,
   * anti-aliasing leaves the pixel slightly transparent, and whatever is underneath shows through.
   * The underlay makes sure that is the right colour and not the glyph's black base shape: a coarser fan
   * whose wedges overlap (each reaches `reach` degrees past its start, so a pixel that straddles several of
   * them is fully covered by the first), shrunk towards the centre by `inset` so its own edge never
   * touches the outline. `null` disables it.
   */
  underlay: {maxColorStep: number; inset: number; reach: number} | null;
}
/** Tuned against the original markup in Chromium (packages/icons/src/tecton.test.ts reports the error). */
export const DEFAULT_FAN: FanOptions = {
  maxColorStep: 4,
  underlay: {maxColorStep: 8, inset: 0.04, reach: 120},
};

export interface Fan {
  /** Wedges in paint order; `d` is a closed polygon, `fill` a `#rrggbb` colour. */
  wedges: {d: string; fill: string}[];
}

function rayHit(center: Point, direction: Point, polygon: readonly Point[]): Point {
  let best: Point | undefined;
  let bestT = Infinity;
  for (let i = 0; i < polygon.length; i++) {
    const [p, q] = [polygon[i]!, polygon[(i + 1) % polygon.length]!];
    const edge: Point = [q[0] - p[0], q[1] - p[1]];
    const denominator = direction[0] * edge[1] - direction[1] * edge[0];
    if (Math.abs(denominator) < 1e-12) continue;
    const [dx, dy] = [p[0] - center[0], p[1] - center[1]];
    const t = (dx * edge[1] - dy * edge[0]) / denominator;
    const s = (dx * direction[1] - dy * direction[0]) / denominator;
    if (t > 1e-9 && s >= -1e-9 && s <= 1 + 1e-9 && t < bestT) {
      bestT = t;
      best = [center[0] + direction[0] * t, center[1] + direction[1] * t];
    }
  }
  if (!best) throw new Error('gradient centre is not inside the clip polygon');
  return best;
}

/**
 * Re-expresses a CSS conic gradient painted through `matrix` and clipped by a polygon as flat-coloured
 * wedges. `box` is the gradient box in the matrix's own coordinates (the `<foreignObject>` rectangle);
 * the gradient is centred on it. The clip polygon must be star-shaped around that centre (convex is
 * enough), so every wedge is the exact intersection of an angular sector and the polygon.
 */
export function conicGradientFan(
  gradient: ConicGradient,
  matrix: Matrix,
  box: {x: number; y: number; width: number; height: number},
  polygon: readonly Point[],
  options: FanOptions = DEFAULT_FAN,
): Fan {
  const [a, b, c, d, e, f] = matrix;
  const local: Point = [box.x + box.width / 2, box.y + box.height / 2];
  const center: Point = [a * local[0] + c * local[1] + e, b * local[0] + d * local[1] + f];
  const determinant = a * d - b * c;
  if (Math.abs(determinant) < 1e-12) throw new Error('singular gradient transform');

  /** Screen direction of the gradient angle `p` (degrees after `from`). CSS: 0deg points up, clockwise. */
  const direction = (p: number): Point => {
    const theta = ((gradient.from + p) * Math.PI) / 180;
    const [lx, ly] = [Math.sin(theta), -Math.cos(theta)];
    return [a * lx + c * ly, b * lx + d * ly];
  };
  /** Gradient angle (0..360) of a screen point, the inverse of `direction`. */
  const angleOf = (point: Point): number => {
    const [dx, dy] = [point[0] - center[0], point[1] - center[1]];
    const [lx, ly] = [(d * dx - c * dy) / determinant, (-b * dx + a * dy) / determinant];
    const theta = (Math.atan2(lx, -ly) * 180) / Math.PI;
    return (((theta - gradient.from) % 360) + 360) % 360;
  };

  /** Wedges for the boundaries of one layer; wedge `i` spans `[b[i], max(b[i + 1], b[i] + reach)]`. */
  const layer = (steps: number, reach: number, shape: readonly Point[]): Fan['wedges'] => {
    const boundaries: number[] = [0];
    for (let i = 1; i < gradient.stops.length; i++) {
      const [lo, hi] = [gradient.stops[i - 1]!, gradient.stops[i]!];
      const delta = Math.max(...lo.rgb.map((channel, k) => Math.abs(hi.rgb[k]! - channel)));
      const count = Math.max(1, Math.ceil(delta / steps));
      for (let k = 1; k <= count; k++) boundaries.push(lo.at + ((hi.at - lo.at) * k) / count);
    }
    const shapeVertices = shape
      .map((point) => ({point, p: angleOf(point)}))
      .sort((left, right) => left.p - right.p);
    const out: Fan['wedges'] = [];
    for (let i = 0; i + 1 < boundaries.length; i++) {
      const start = boundaries[i]!;
      const next = boundaries[i + 1]!;
      const end = Math.min(360, Math.max(next, start + reach));
      const points: Point[] = [center, rayHit(center, direction(start), shape)];
      for (const vertex of shapeVertices)
        if (vertex.p > start + 1e-9 && vertex.p < end - 1e-9) points.push(vertex.point);
      points.push(rayHit(center, direction(end), shape));
      const d = `M${points.map(([x, y]) => `${fmt3(x)} ${fmt3(y)}`).join('L')}Z`;
      out.push({d, fill: hex(gradientColor(gradient.stops, (start + next) / 2))});
    }
    return out;
  };

  const wedges: Fan['wedges'] = [];
  if (options.underlay) {
    const {maxColorStep, inset, reach} = options.underlay;
    const shrunk = polygon.map(([x, y]): Point => [
      center[0] + (x - center[0]) * (1 - inset),
      center[1] + (y - center[1]) * (1 - inset),
    ]);
    wedges.push(...layer(maxColorStep, reach, shrunk));
  }
  wedges.push(...layer(options.maxColorStep, 0, polygon));
  return {wedges};
}

// ---- Glyph conversion ------------------------------------------------------------------------------

export interface PathData {
  d: string;
  fillRule?: 'evenodd';
}
export interface GlyphDefinition {
  paths: PathData[];
  /** Sanitisable raw SVG body (see the file header); present only when `paths` cannot represent the glyph. */
  svg?: string;
  /** The glyph carries colours of its own (`svg` contains explicit fills). */
  colored?: true;
}

interface Painted {
  d: string;
  fillRule?: 'evenodd';
  /** `undefined` = `currentColor`. */
  fill?: string;
}
interface Context {
  fillRule?: 'evenodd' | 'nonzero';
  clip?: Point[];
  matrix?: Matrix;
}

const escapeAttr = (text: string) => text.replaceAll('&', '&amp;').replaceAll('"', '&quot;');

function parseViewBox(viewBox: string): {x: number; y: number; width: number; height: number} {
  const [x, y, width, height] = numbers(viewBox);
  if (height === undefined) throw new Error(`bad viewBox "${viewBox}"`);
  return {x: x!, y: y!, width: width!, height};
}

/**
 * Converts one variant's inner markup. Throws on any construct it cannot convert, so an unsupported
 * source can never be shipped silently wrong.
 */
export function convertGlyph(
  markup: string,
  viewBox: string,
  options: FanOptions = DEFAULT_FAN,
): GlyphDefinition {
  const nodes = parseMarkup(markup);
  const view = parseViewBox(viewBox);

  const clipPaths = new Map<string, MarkupNode>();
  const collectDefs = (list: readonly MarkupNode[]) => {
    for (const node of list) {
      if (node.tag === 'defs') {
        for (const child of node.children) {
          if (child.tag !== 'clipPath' || !child.attrs.id)
            throw new Error(`unsupported <${child.tag}> in <defs>`);
          clipPaths.set(child.attrs.id, child);
        }
      } else collectDefs(node.children);
    }
  };
  collectDefs(nodes);

  const painted: Painted[] = [];
  let hasFan = false;

  /** `undefined` for a clip that clips nothing, else the polygon that clips. */
  const resolveClip = (reference: string): Point[] | undefined => {
    const id = /^url\(#([^)]+)\)$/.exec(reference.trim())?.[1];
    const clip = id ? clipPaths.get(id) : undefined;
    if (clip?.children.length !== 1) throw new Error(`unsupported clip-path "${reference}"`);
    const shape = clip.children[0]!;
    if (shape.tag === 'rect') {
      const [x, y, width, height] = [
        Number(shape.attrs.x ?? 0),
        Number(shape.attrs.y ?? 0),
        Number(shape.attrs.width),
        Number(shape.attrs.height),
      ];
      const covers =
        x <= view.x &&
        y <= view.y &&
        x + width >= view.x + view.width &&
        y + height >= view.y + view.height;
      if (covers && !shape.attrs.rx && !shape.attrs.ry && !shape.attrs.transform) return undefined;
      throw new Error('a clip that cuts the glyph cannot be expressed as paths');
    }
    if (shape.tag === 'path' && shape.attrs.d) return parsePolygon(shape.attrs.d);
    throw new Error(`unsupported clip shape <${shape.tag}>`);
  };

  const allowAttrs = (node: MarkupNode, allowed: readonly string[]) => {
    for (const name of Object.keys(node.attrs))
      if (!allowed.includes(name))
        throw new Error(`unsupported attribute ${name}="${node.attrs[name]}" on <${node.tag}>`);
  };

  const walk = (list: readonly MarkupNode[], context: Context) => {
    for (const node of list) {
      switch (node.tag) {
        case 'defs':
          break;
        case 'path': {
          allowAttrs(node, ['d', 'fill-rule', 'clip-rule', 'fill']);
          if (!node.attrs.d) throw new Error('path without d');
          if (context.clip) throw new Error('a clipped <path> cannot be expressed as paths');
          if (context.matrix) throw new Error('a transformed <path> is not supported');
          const rule = node.attrs['fill-rule'] ?? context.fillRule;
          const entry: Painted = {d: node.attrs.d};
          if (rule === 'evenodd') entry.fillRule = 'evenodd';
          if (node.attrs.fill !== undefined && node.attrs.fill.toLowerCase() !== 'currentcolor')
            entry.fill = node.attrs.fill;
          painted.push(entry);
          break;
        }
        case 'rect': {
          allowAttrs(node, ['x', 'y', 'width', 'height', 'rx', 'ry', 'fill-rule', 'fill']);
          if (context.clip) throw new Error('a clipped <rect> cannot be expressed as paths');
          if (context.matrix) throw new Error('a transformed <rect> is not supported');
          const entry: Painted = {d: shapeToPath('rect', node.attrs)};
          if (node.attrs.fill !== undefined && node.attrs.fill.toLowerCase() !== 'currentcolor')
            entry.fill = node.attrs.fill;
          painted.push(entry);
          break;
        }
        case 'g': {
          allowAttrs(node, ['fill-rule', 'clip-rule', 'clip-path', 'transform']);
          const next: Context = {...context};
          if (node.attrs['fill-rule'])
            next.fillRule = node.attrs['fill-rule'] as 'evenodd' | 'nonzero';
          if (node.attrs['clip-path']) {
            const clip = resolveClip(node.attrs['clip-path']);
            if (clip) next.clip = clip;
          }
          if (node.attrs.transform) next.matrix = parseMatrix(node.attrs.transform);
          walk(node.children, next);
          break;
        }
        case 'foreignObject': {
          allowAttrs(node, ['x', 'y', 'width', 'height']);
          const style = node.children.length === 1 ? node.children[0]! : undefined;
          if (style?.tag !== 'div' || !style.attrs.style)
            throw new Error('<foreignObject> must hold one styled <div>');
          if (!context.clip || !context.matrix)
            throw new Error('a gradient needs its clip polygon and transform');
          const gradient = parseConicGradient(style.attrs.style);
          const box = {
            x: Number(node.attrs.x),
            y: Number(node.attrs.y),
            width: Number(node.attrs.width),
            height: Number(node.attrs.height),
          };
          for (const wedge of conicGradientFan(gradient, context.matrix, box, context.clip, options)
            .wedges)
            painted.push({d: wedge.d, fill: wedge.fill});
          hasFan = true;
          break;
        }
        default:
          throw new Error(`unsupported element <${node.tag}>`);
      }
    }
  };
  walk(nodes, {});

  if (painted.length === 0) throw new Error('glyph has no shapes');

  const coloured = painted.some((entry) => entry.fill !== undefined);
  const outline = painted
    .filter((entry) => entry.fill === undefined)
    .map<PathData>((entry) =>
      entry.fillRule ? {d: entry.d, fillRule: entry.fillRule} : {d: entry.d},
    );
  if (!coloured && !hasFan) return {paths: outline};

  const body = painted
    .map((entry) => {
      const attrs = [
        `d="${escapeAttr(entry.d)}"`,
        `fill="${escapeAttr(entry.fill ?? 'currentColor')}"`,
      ];
      if (entry.fillRule) attrs.push(`fill-rule="${entry.fillRule}"`);
      return `<path ${attrs.join(' ')}/>`;
    })
    .join('');
  return {paths: outline, svg: body, colored: true};
}
