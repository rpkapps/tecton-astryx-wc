/**
 * Floating UI boundary (A§9.10, A-09, D-007). This is the ONLY module that references
 * `@floating-ui/dom`, and only through a dynamic `import()`: on every Tier-1 path (CSS anchor
 * positioning with implicit anchors) the dependency is never fetched. The JS path is for Tier 2 and
 * for the case where the implicit-anchor probe fails.
 *
 * Coordinates are `strategy: 'fixed'` (popovers live in the top layer), written as `left`/`top` so
 * they never fight an enter animation's `transform`.
 * Guides: [mwg:resilient-context-menus-and-nested-dropdowns]
 */
import type * as FloatingUi from '@floating-ui/dom';
import {devWarn} from '../utils/dev.js';

type FloatingModule = typeof FloatingUi;

export type PhysicalSide = 'top' | 'bottom' | 'left' | 'right';

export interface FloatingRequest {
  /** An element, or a point (virtual anchor for a context menu at the pointer). */
  anchor: Element | {x: number; y: number};
  surface: HTMLElement;
  /** Physical side; alignment is logical along the placement axis (Floating UI mirrors it in RTL). */
  side: PhysicalSide;
  align: 'start' | 'center' | 'end';
  /** Clearance between anchor and surface, in px. */
  offset: number;
  matchAnchorWidth: boolean | 'min';
  /** Viewport padding kept by flip/shift/size, in px. */
  padding?: number;
  /** Called after every placement with the side actually used (after flips). */
  placed(side: PhysicalSide): void;
}

export interface FloatingHandle {
  /** Resolves once the first placement was written (or the module failed to load). */
  readonly ready: Promise<void>;
  /** Recomputes now (options on the request object are read again). */
  update(): void;
  stop(): void;
}

let loading: Promise<FloatingModule> | undefined;

function loadFloating(): Promise<FloatingModule> {
  // The specifier is a literal so bundlers split it into its own chunk.
  loading ??= import('@floating-ui/dom');
  return loading;
}

/** Whether the Floating UI chunk was ever requested (asserted absent on the CSS path). */
export function isFloatingLoaded(): boolean {
  return loading !== undefined;
}

/** Forgets that the module was requested. Test-only (the module itself stays cached by the engine). */
export function resetFloating(): void {
  loading = undefined;
}

/** Positions `request.surface` next to `request.anchor` and keeps it there until `stop()`. */
export function startFloating(request: FloatingRequest): FloatingHandle {
  let stopped = false;
  let cleanup: (() => void) | undefined;
  let module: FloatingModule | undefined;

  const reference = (): Element | {getBoundingClientRect(): DOMRect} => {
    const {anchor} = request;
    if (anchor instanceof Element) return anchor;
    const {x, y} = anchor;
    return {getBoundingClientRect: () => new DOMRect(x, y, 0, 0)};
  };

  const compute = async (): Promise<void> => {
    if (stopped || !module) return;
    const {computePosition, offset, flip, shift, size} = module;
    const padding = request.padding ?? 8;
    const placement =
      request.align === 'center' ? request.side : (`${request.side}-${request.align}` as const);
    const {surface} = request;
    const result = await computePosition(reference(), surface, {
      strategy: 'fixed',
      placement,
      middleware: [
        offset(request.offset),
        flip({padding}),
        shift({padding}),
        size({
          padding,
          apply({availableWidth, availableHeight, rects}) {
            surface.style.setProperty('max-inline-size', `${Math.max(0, availableWidth)}px`);
            surface.style.setProperty('max-block-size', `${Math.max(0, availableHeight)}px`);
            if (request.matchAnchorWidth === true) {
              surface.style.setProperty('inline-size', `${rects.reference.width}px`);
            } else if (request.matchAnchorWidth === 'min') {
              surface.style.setProperty('min-inline-size', `${rects.reference.width}px`);
            }
          },
        }),
      ],
    });
    if (stopped) return;
    surface.style.setProperty('position', 'fixed');
    surface.style.setProperty('inset', 'auto');
    surface.style.setProperty('margin', '0');
    surface.style.setProperty('left', `${Math.round(result.x)}px`);
    surface.style.setProperty('top', `${Math.round(result.y)}px`);
    request.placed(result.placement.split('-')[0] as PhysicalSide);
  };

  const ready = loadFloating().then(
    (loaded) => {
      if (stopped) return;
      module = loaded;
      cleanup = loaded.autoUpdate(reference(), request.surface, () => {
        void compute();
      });
    },
    (error: unknown) => {
      devWarn(
        'floating:load',
        'Could not load the positioning fallback (@floating-ui/dom).',
        error,
      );
    },
  );

  return {
    ready,
    update: () => {
      void compute();
    },
    stop: () => {
      stopped = true;
      cleanup?.();
      cleanup = undefined;
    },
  };
}
