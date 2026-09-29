/**
 * Test helpers of the date and time fields: device stubs (a compact touch device and a coarse pointer
 * cannot be emulated back and forth inside a page) and contrast arithmetic. Not part of the shipped API.
 */
import {COMPACT_TOUCH_PRESENTATION_QUERY} from '@tecton-wc/core/controllers/adaptive-presentation.js';
import {COARSE_POINTER_QUERY} from './picker-presentation.js';

interface FakeQuery extends EventTarget {
  matches: boolean;
  media: string;
}

export interface DeviceState {
  compactTouch?: boolean;
  coarsePointer?: boolean;
}

/**
 * Stubs `matchMedia` for the compact-touch query (a narrow viewport with a coarse primary pointer) and for
 * `(pointer: coarse)`. Call it before the element connects; `set()` fires `change` so a connected field
 * re-renders live.
 */
export function stubDeviceQueries(initial: DeviceState): {
  set: (value: DeviceState) => void;
  restore: () => void;
} {
  const original = window.matchMedia.bind(window);
  const lists = new Map<FakeQuery, 'compact' | 'coarse'>();
  const current = {
    compactTouch: initial.compactTouch ?? false,
    coarsePointer: initial.coarsePointer ?? false,
  };
  window.matchMedia = (query: string): MediaQueryList => {
    const kind =
      query === COMPACT_TOUCH_PRESENTATION_QUERY
        ? 'compact'
        : query === COARSE_POINTER_QUERY
          ? 'coarse'
          : null;
    if (!kind) return original(query);
    const list = Object.assign(new EventTarget(), {
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
    }) as unknown as FakeQuery;
    Object.defineProperty(list, 'matches', {
      get: () => (kind === 'compact' ? current.compactTouch : current.coarsePointer),
    });
    lists.set(list, kind);
    return list as unknown as MediaQueryList;
  };
  return {
    set(value) {
      Object.assign(current, value);
      for (const list of lists.keys()) {
        list.dispatchEvent(
          Object.assign(new Event('change'), {matches: list.matches, media: list.media}),
        );
      }
    },
    restore() {
      window.matchMedia = original;
    },
  };
}

// --------------------------------------------------------------------------- contrast arithmetic

export interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

export function parseColor(text: string): Rgba {
  const match = /rgba?\(([^)]+)\)/.exec(text) ?? /color\(srgb ([^)]+)\)/.exec(text);
  if (!match) throw new Error(`unreadable colour: ${text}`);
  const parts = match[1]!
    .split(/[\s,/]+/)
    .filter(Boolean)
    .map(Number);
  const scale = text.startsWith('color(') ? 255 : 1;
  return {r: parts[0]! * scale, g: parts[1]! * scale, b: parts[2]! * scale, a: parts[3] ?? 1};
}

export function over(top: Rgba, bottom: Rgba): Rgba {
  const a = top.a + bottom.a * (1 - top.a);
  const mix = (t: number, b: number): number => (t * top.a + b * bottom.a * (1 - top.a)) / (a || 1);
  return {r: mix(top.r, bottom.r), g: mix(top.g, bottom.g), b: mix(top.b, bottom.b), a};
}

/** The painted background of `element` over white. */
export function backgroundOf(element: Element): Rgba {
  return over(parseColor(getComputedStyle(element).backgroundColor), {
    r: 255,
    g: 255,
    b: 255,
    a: 1,
  });
}

function luminance({r, g, b}: Rgba): number {
  const channel = (value: number): number => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG contrast ratio of `foreground` over `background`. */
export function contrast(foreground: Rgba, background: Rgba): number {
  const composed = over(foreground, background);
  const [light, dark] = [luminance(composed), luminance(background)].sort((x, y) => y - x) as [
    number,
    number,
  ];
  return (light + 0.05) / (dark + 0.05);
}

/** Text colour of `element` over `surface`. */
export function textContrast(element: Element, surface: Rgba): number {
  return contrast(parseColor(getComputedStyle(element).color), surface);
}

// ------------------------------------------------------------------------------------- animations

/** Every animation and transition running anywhere under `root`, shadow trees included (`getAnimations` stops at a shadow boundary). */
export function runningAnimations(root: Node = document): Animation[] {
  const found: Animation[] = [];
  const visit = (node: Node): void => {
    if (node instanceof Element) {
      found.push(...node.getAnimations());
      if (node.shadowRoot) visit(node.shadowRoot);
    }
    for (const child of node.childNodes) visit(child);
  };
  visit(root);
  return found;
}

/**
 * Waits until nothing under `root` (shadow trees included) is animating for a few frames in a row: a state
 * change starts its transition a frame late, so measuring the first frame or two hides contrast defects and
 * makes axe read half-faded text.
 */
export async function settleAnimations(root: Node = document): Promise<void> {
  const frame = (): Promise<void> =>
    new Promise((resolve) => {
      requestAnimationFrame(() => {
        resolve();
      });
    });
  for (let quiet = 0; quiet < 3; quiet += 1) {
    const running = runningAnimations(root);
    if (running.length > 0) {
      await Promise.all(running.map((animation) => animation.finished.catch(() => undefined)));
      quiet = -1;
    }
    await frame();
  }
}
