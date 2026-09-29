/**
 * Picks the media context a surface wants by measuring what the browser actually painted (upstream
 * `hooks/useAutoMediaMode.ts`, adapted from Astryx, MIT). It powers `tct-media-theme mode="auto"`.
 *
 * Why measure: `--color-background-inverted` is not required to be inverted. A theme can define it
 * as a pale grey, and a hard-coded `mode="dark"` then paints light text on it at 1.25:1. The
 * surface colour is a runtime value and the mode a compile-time guess, so no amount of care in the
 * component can catch that. (`contrast-color()` cannot replace this: it answers black or white,
 * while the choice here is between the two sides of the token pairs, or neither. [mwg:contrast-color])
 *
 * The answer can also be `off`: when the surface's own ambient text already reads on it, the
 * surface is not effectively inverted and does not want a media context.
 *
 * Deviations from upstream, all for the web-component tree:
 *  - the surface is the parent in the flat tree (slot assignment and shadow hosts are crossed), so
 *    a `tct-media-theme` slotted into a `tct-card` measures the card's painted base, not its host;
 *  - `display: contents` boxes paint nothing and are skipped;
 *  - computed values in `color(srgb …)` form parse directly; anything else is normalised through
 *    a one-pixel canvas.
 *
 * DOM-touching functions run only from element callbacks, never at import time (Node-safe, A§14).
 */
import {compositeOver, contrastRatio} from './contrast.js';
import {formatColor, parseColor, type RGBA} from './color.js';

/** A surface luminance context, or `off` when no media context is wanted. */
export type DetectedMediaMode = 'dark' | 'light' | 'off';

/**
 * Contrast at which a surface's ambient text counts as reading well enough that no media context is
 * wanted. WCAG's large-text and non-text line, deliberately low: this decides whether a surface is
 * effectively inverted, not whether its text meets a standard.
 */
export const AMBIENT_READS_AT = 3;

/**
 * Which media context a surface wants: `off` when its ambient text already reads on it, otherwise
 * whichever on-colour reads better. Pure. Ties go to dark, matching the convention that an inverted
 * surface is usually the dark one. Returns `null` when an on-colour is unknown.
 */
export function pickMediaMode(
  background: RGBA,
  ambient: RGBA | null,
  onDark: RGBA | null,
  onLight: RGBA | null,
): DetectedMediaMode | null {
  if (onDark === null || onLight === null) return null;
  if (ambient !== null && contrastRatio(ambient, background) >= AMBIENT_READS_AT) return 'off';
  return contrastRatio(onDark, background) >= contrastRatio(onLight, background) ? 'dark' : 'light';
}

/** The parent in the flat tree: the assigned slot, else the parent element, else the shadow host. */
export function flatTreeParent(node: Element): Element | null {
  const slot = node.assignedSlot;
  if (slot) return slot;
  if (node.parentElement) return node.parentElement;
  const root = node.getRootNode();
  return root instanceof ShadowRoot ? root.host : null;
}

let canvasContext: CanvasRenderingContext2D | null | undefined;

/** Normalises any CSS colour the engine accepts to sRGB through a one-pixel canvas. */
function canvasColor(value: string): RGBA | null {
  if (canvasContext === undefined) {
    try {
      canvasContext = document.createElement('canvas').getContext('2d', {willReadFrequently: true});
    } catch {
      canvasContext = null;
    }
  }
  const context = canvasContext;
  if (!context) return null;
  context.clearRect(0, 0, 1, 1);
  context.fillStyle = '#000';
  context.fillStyle = value;
  context.fillRect(0, 0, 1, 1);
  const data = context.getImageData(0, 0, 1, 1).data;
  return {r: data[0]!, g: data[1]!, b: data[2]!, a: data[3]! / 255};
}

/** A computed colour string as sRGB, or `null` when neither parser can evaluate it. */
export function computedColor(value: string): RGBA | null {
  return parseColor(value) ?? (value.trim() === '' ? null : canvasColor(value));
}

/**
 * Resolves token references to the colours they paint by reading them back off a hidden probe.
 * `getPropertyValue` returns a token's specified text, and Tecton tokens are `light-dark(a, b)`
 * pairs that resolve only once used in a real property: the probe assigns each to `color` and reads
 * the computed value back. The probe is a `display: none` sibling in front of `anchor`, so it
 * inherits the anchor's surroundings (and follows it through a slot), and costs a style recalc but
 * no reflow.
 */
export function resolvePaintedColors(anchor: Element, tokens: readonly string[]): (RGBA | null)[] {
  const probe = document.createElement('span');
  probe.style.display = 'none';
  anchor.before(probe);
  try {
    return tokens.map((token) => {
      probe.style.color = `var(${token})`;
      return computedColor(getComputedStyle(probe).color);
    });
  } finally {
    probe.remove();
  }
}

/**
 * The colour actually behind an element: its own background if opaque, otherwise its translucent
 * layers composited down onto the first opaque ancestor. `null` when the paint is not knowable from
 * CSS: a `background-image` anywhere in the chain (its pixels need sampling), or no opaque layer at
 * all (the paint is the browser canvas).
 */
export function resolveBackdrop(element: Element): RGBA | null {
  const layers: RGBA[] = [];
  for (let node: Element | null = element; node !== null; node = flatTreeParent(node)) {
    const style = getComputedStyle(node);
    if (style.display === 'contents') continue;
    if (style.backgroundImage !== 'none') return null;
    const color = computedColor(style.backgroundColor);
    if (color !== null && color.a > 0) {
      layers.push(color);
      if (color.a >= 1) break;
    }
  }
  const base = layers.pop();
  if (base === undefined || base.a < 1) return null;
  // `layers` is now top-first; composite downward so the topmost lands last.
  return layers.reduceRight((backdrop, layer) => compositeOver(layer, backdrop), base);
}

export interface MediaMeasurement {
  /** The mode to use, or `null` when the surface cannot be measured (or `unchanged`). */
  mode: DetectedMediaMode | null;
  /** Stable key of the painted backdrop, so a caller can skip the probe when nothing moved. */
  key: string | null;
  /** The backdrop matched `previousKey`: keep the previous answer. */
  unchanged: boolean;
}

/**
 * Measures the surface behind `anchor` (the flat-tree parent, never `anchor` itself: the media
 * attribute is set on the anchor, so measuring it would feed the decision back into its own input
 * and let it oscillate). `previousKey` skips the probe when the painted backdrop is unchanged.
 */
export function measureMediaMode(anchor: Element, previousKey?: string | null): MediaMeasurement {
  const surface = flatTreeParent(anchor);
  if (surface === null) return {mode: null, key: null, unchanged: false};
  const background = resolveBackdrop(surface);
  if (background === null) return {mode: null, key: null, unchanged: false};
  const key = formatColor(background);
  if (previousKey === key) return {mode: null, key, unchanged: true};
  const [ambient, onDark, onLight] = resolvePaintedColors(anchor, [
    '--color-text-primary',
    '--color-on-dark',
    '--color-on-light',
  ]);
  return {
    mode: pickMediaMode(background, ambient ?? null, onDark ?? null, onLight ?? null),
    key,
    unchanged: false,
  };
}
