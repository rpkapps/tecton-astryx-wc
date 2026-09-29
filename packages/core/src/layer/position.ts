/**
 * Anchored positioning (A§9.10, A-09).
 *
 * CSS path (default when `features.implicitAnchor`): `showPopover({source: anchor})` makes the anchor
 * the popover's implicit anchor; inline `position-area`, `position-try-fallbacks`, clearance margins
 * on BOTH edges of the placement axis (upstream #4803: a flip must not lose the gap) and clamps
 * place it. No JS runs while it is open except optional `data-placement` tracking.
 *
 * JS path (Tier 2, or a failed probe): `floating.ts` lazily loads `@floating-ui/dom`. It writes the
 * same `data-placement` so arrow styles work identically.
 *
 * Virtual anchors (a context menu at the pointer) are a 0x0 fixed element owned by the controller,
 * so even they stay on the CSS path. Never `@container anchored` (not in every Tier-1 engine).
 */
import type {ReactiveController, ReactiveControllerHost} from 'lit';
import {features} from '../features.js';
import {startFloating, type FloatingHandle, type PhysicalSide} from './floating.js';

export type Placement = 'above' | 'below' | 'start' | 'end';
export type Alignment = 'start' | 'center' | 'end';

export interface PlacementRequest {
  placement: Placement;
  alignment: Alignment;
  /** Clearance from the anchor; a number is px. */
  offset?: string | number;
}

export interface PositionOptions {
  surface: () => HTMLElement | null;
  /** The anchor element, or a point for a virtual anchor. */
  anchor: () => Element | {x: number; y: number} | null;
  placement: () => PlacementRequest;
  /** `true`: surface width = anchor width; `'min'`: at least the anchor width. */
  matchAnchorWidth?: boolean | 'min';
  /** Write the actual side after flips to `data-placement` (arrow styling). */
  trackPlacement?: boolean;
  /** Tests only: force a path. */
  strategy?: 'auto' | 'css' | 'js';
}

/** Logical placement + alignment to a `position-area` value (self-* keywords follow the surface's own direction). */
export function positionAreaFor(placement: Placement, alignment: Alignment): string {
  if (placement === 'above' || placement === 'below') {
    const block = placement === 'above' ? 'self-block-start' : 'self-block-end';
    if (alignment === 'start') return `${block} span-self-inline-end`;
    if (alignment === 'end') return `${block} span-self-inline-start`;
    return block;
  }
  const inline = placement === 'start' ? 'self-inline-start' : 'self-inline-end';
  if (alignment === 'start') return `${inline} span-self-block-end`;
  if (alignment === 'end') return `${inline} span-self-block-start`;
  return inline;
}

/**
 * `position-try-fallbacks` list. Flips cannot rescue a centred layer (centre flips to centre), so
 * centred alignments append span fallbacks that let the browser slide it along the alignment axis.
 */
export function positionTryFallbacksFor(placement: Placement, alignment: Alignment): string {
  const flips =
    placement === 'above' || placement === 'below'
      ? 'flip-block, flip-inline, flip-block flip-inline'
      : 'flip-inline, flip-block, flip-block flip-inline';
  if (alignment !== 'center') return flips;
  if (placement === 'above' || placement === 'below') {
    const [same, opposite] = placement === 'above' ? ['top', 'bottom'] : ['bottom', 'top'];
    return `${flips}, ${same} span-left, ${same} span-right, ${opposite} span-left, ${opposite} span-right`;
  }
  const [same, opposite] = placement === 'start' ? ['left', 'right'] : ['right', 'left'];
  return `${flips}, ${same} span-top, ${same} span-bottom, ${opposite} span-top, ${opposite} span-bottom`;
}

const toLength = (value: string | number | undefined): string | undefined =>
  value === undefined || value === 0 || value === ''
    ? undefined
    : typeof value === 'number'
      ? `${value}px`
      : value;

function toPixels(value: string | number | undefined, surface: HTMLElement): number {
  if (value === undefined) return 0;
  if (typeof value === 'number') return value;
  // A CSS length such as `var(--spacing-1)`: resolve it on the surface with a probe property.
  const probe = surface.style.getPropertyValue('margin-block-start');
  surface.style.setProperty('margin-block-start', value);
  const resolved = Number.parseFloat(getComputedStyle(surface).marginBlockStart);
  if (probe) surface.style.setProperty('margin-block-start', probe);
  else surface.style.removeProperty('margin-block-start');
  return Number.isFinite(resolved) ? resolved : 0;
}

/** Physical side and logical mapping helpers (the direction decides which physical side is `start`). */
function physicalSide(placement: Placement, rtl: boolean): PhysicalSide {
  switch (placement) {
    case 'above':
      return 'top';
    case 'below':
      return 'bottom';
    case 'start':
      return rtl ? 'right' : 'left';
    case 'end':
      return rtl ? 'left' : 'right';
  }
}

function logicalPlacement(side: PhysicalSide, rtl: boolean): Placement {
  switch (side) {
    case 'top':
      return 'above';
    case 'bottom':
      return 'below';
    case 'left':
      return rtl ? 'end' : 'start';
    case 'right':
      return rtl ? 'start' : 'end';
  }
}

const CSS_PROPERTIES = [
  'position-area',
  'position-try-fallbacks',
  'inset',
  'margin',
  'margin-block',
  'margin-inline',
  'max-inline-size',
  'max-block-size',
  'inline-size',
  'min-inline-size',
  'position',
  'left',
  'top',
] as const;

export class PositionController implements ReactiveController {
  readonly #options: PositionOptions;
  #active: 'css' | 'js' | undefined;
  #virtual: HTMLElement | undefined;
  #floating: FloatingHandle | undefined;
  #stopTracking: (() => void) | undefined;
  #anchorElement: HTMLElement | undefined;

  constructor(host: ReactiveControllerHost & HTMLElement, options: PositionOptions) {
    this.#options = options;
    host.addController(this);
  }

  /** The strategy in effect while shown (`undefined` while hidden). */
  get strategy(): 'css' | 'js' | undefined {
    return this.#active;
  }

  /**
   * `showPopover` options for the CSS path: `{source: anchor}` (a virtual anchor is created on
   * demand). `undefined` on the JS path. Valid after {@link prepare}.
   */
  get showOptions(): ShowPopoverOptions | undefined {
    return this.#active === 'css' && this.#anchorElement
      ? {source: this.#anchorElement}
      : undefined;
  }

  /** Chooses the path and writes the surface styles. Called by `LayerController.show()` before the native show. */
  prepare(): void {
    const surface = this.#options.surface();
    if (!surface) return;
    this.#clear(surface);
    this.#active = this.#resolveStrategy();
    this.#anchorElement = this.#resolveAnchorElement();
    if (this.#active === 'css') this.#writeCss(surface);
    else this.#writeRequestedPlacement(surface);
  }

  /** Starts tracking/floating after the native show. Called by `LayerController.show()`. */
  activate(): void {
    const surface = this.#options.surface();
    if (!surface || !this.#active) return;
    if (this.#active === 'js') this.#startFloating(surface);
    else if (this.#options.trackPlacement) this.#startTracking(surface);
  }

  /** Stops everything and removes inline styles and the virtual anchor. */
  deactivate(): void {
    const surface = this.#options.surface();
    this.#floating?.stop();
    this.#floating = undefined;
    this.#stopTracking?.();
    this.#stopTracking = undefined;
    this.#virtual?.remove();
    this.#virtual = undefined;
    this.#anchorElement = undefined;
    if (surface) this.#clear(surface);
    this.#active = undefined;
  }

  /** Re-applies the current placement while open (placement or offset changed). */
  update(): void {
    const surface = this.#options.surface();
    if (!surface || !this.#active) return;
    if (this.#active === 'css') {
      this.#writeCss(surface);
      this.#writePlacementFromRects(surface);
    } else {
      this.#writeRequestedPlacement(surface);
      this.#floating?.update();
    }
  }

  hostDisconnected(): void {
    this.deactivate();
  }

  // ------------------------------------------------------------------------------- internals

  #resolveStrategy(): 'css' | 'js' {
    const forced = this.#options.strategy ?? 'auto';
    if (forced === 'css' || forced === 'js') return forced;
    const anchor = this.#options.anchor();
    // `source` must be an HTMLElement; anything else (SVG anchors) uses the JS path.
    const usable = !anchor || 'x' in anchor || anchor instanceof HTMLElement;
    return features.implicitAnchor && usable ? 'css' : 'js';
  }

  #resolveAnchorElement(): HTMLElement | undefined {
    const anchor = this.#options.anchor();
    if (!anchor) return undefined;
    if (anchor instanceof HTMLElement) return anchor;
    if ('x' in anchor) {
      const point = (this.#virtual ??= document.createElement('div'));
      point.style.cssText =
        `position:fixed;left:${anchor.x}px;top:${anchor.y}px;inline-size:0;block-size:0;` +
        'margin:0;padding:0;border:0;pointer-events:none;visibility:hidden;';
      if (!point.isConnected) document.body.append(point);
      return point;
    }
    return undefined;
  }

  #clear(surface: HTMLElement): void {
    for (const property of CSS_PROPERTIES) surface.style.removeProperty(property);
    surface.removeAttribute('data-placement');
  }

  #writeCss(surface: HTMLElement): void {
    const {placement, alignment, offset} = this.#options.placement();
    const style = surface.style;
    style.setProperty('inset', 'auto');
    style.setProperty('margin', '0');
    style.setProperty('position-area', positionAreaFor(placement, alignment));
    style.setProperty('position-try-fallbacks', positionTryFallbacksFor(placement, alignment));
    // Clearance on both edges of the axis: a flip to the far side must keep the gap.
    const gap = toLength(offset);
    const axis = placement === 'above' || placement === 'below' ? 'margin-block' : 'margin-inline';
    if (gap) style.setProperty(axis, gap);
    // Clamp to the space the position-area leaves.
    style.setProperty('max-inline-size', '100%');
    style.setProperty('max-block-size', '100%');
    const match = this.#options.matchAnchorWidth;
    if (match === true) style.setProperty('inline-size', 'anchor-size(inline)');
    else if (match === 'min') style.setProperty('min-inline-size', 'anchor-size(inline)');
    surface.setAttribute('data-placement', placement);
  }

  #writeRequestedPlacement(surface: HTMLElement): void {
    surface.setAttribute('data-placement', this.#options.placement().placement);
  }

  #startFloating(surface: HTMLElement): void {
    const anchor = this.#options.anchor();
    if (!anchor) return;
    const rtl = getComputedStyle(surface).direction === 'rtl';
    const {placement, alignment, offset} = this.#options.placement();
    this.#floating = startFloating({
      anchor,
      surface,
      side: physicalSide(placement, rtl),
      align: alignment,
      offset: toPixels(offset, surface),
      matchAnchorWidth: this.#options.matchAnchorWidth ?? false,
      placed: (side) => {
        surface.setAttribute('data-placement', logicalPlacement(side, rtl));
      },
    });
  }

  /** CSS path: derive the side actually used after flips from the two rectangles. */
  #writePlacementFromRects(surface: HTMLElement): void {
    if (!this.#options.trackPlacement) return;
    const anchor = this.#anchorElement;
    if (!anchor) return;
    const a = anchor.getBoundingClientRect();
    const s = surface.getBoundingClientRect();
    const rtl = getComputedStyle(surface).direction === 'rtl';
    let side: PhysicalSide | undefined;
    if (s.bottom <= a.top + 1) side = 'top';
    else if (s.top >= a.bottom - 1) side = 'bottom';
    else if (s.right <= a.left + 1) side = 'left';
    else if (s.left >= a.right - 1) side = 'right';
    if (side) surface.setAttribute('data-placement', logicalPlacement(side, rtl));
  }

  #startTracking(surface: HTMLElement): void {
    const track = (): void => {
      this.#writePlacementFromRects(surface);
    };
    const frame = requestAnimationFrame(track);
    const observer = new ResizeObserver(track);
    observer.observe(surface);
    window.addEventListener('resize', track);
    window.addEventListener('scroll', track, true);
    this.#stopTracking = () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', track);
      window.removeEventListener('scroll', track, true);
    };
  }
}
