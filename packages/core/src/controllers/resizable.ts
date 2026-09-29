/**
 * `ResizableController` (A§9.18, upstream `useResizable`): the size, collapse, snapping and persistence
 * state of one resizable region, plus the small gesture interface a `tct-resize-handle` drives. It is a
 * reactive controller (the host re-renders when the region changes) and also an observable store
 * (`subscribe`), so a panel and its handle, which are different elements, both follow one region.
 *
 * Sizes are always resolved pixels: state, persistence, events and `aria-valuenow` never see a
 * percentage. A percentage is a share of a basis, the content box of `container` (observed) or, without
 * one, the viewport, and resolves in one of two ways:
 *  - as `defaultSize` it resolves once, into the initial pixel choice, and does not track its basis;
 *  - as `minSize` or `maxSize` it stays live: when the basis changes the bound is re-resolved and the
 *    current pixel choice is clamped (and stays clamped: it does not spring back when the basis grows).
 * `percent(40, {min: pixel(333)})` adds exactly one pixel floor or ceiling to a percentage.
 * A container that is not laid out yet (hidden, detached, zero-sized) is treated as unmeasured, and
 * nothing is persisted from the temporary 1200px stand-in basis.
 *
 * ```ts
 * const sidebar = new ResizableController(this, () => ({
 *   defaultSize: 250, minSize: 150, maxSize: percent(40, {min: pixel(333)}),
 *   container: () => this.renderRoot.querySelector('.split'),
 *   onSizeChange: (size) => this.requestUpdate(),
 * }));
 * // <tct-resize-handle .resizable=${sidebar}></tct-resize-handle>
 * ```
 * `ResizableController.regions(host, options)` builds several regions that share a container and axis.
 * Guides: [mwg:css-layout] (viewport and container units), [mwg:size-aware-styling]
 */
import type {ReactiveController, ReactiveControllerHost} from 'lit';
import {devWarn} from '../utils/dev.js';
import {observeResize} from './resize.js';

// ---------------------------------------------------------------------------------------- sizes

/** A pixel size (structurally the same value as a fixed table column width). */
export interface PixelWidth {
  readonly type: 'pixel';
  readonly value: number;
}

/** A percentage with exactly one pixel floor or ceiling. */
export type ResizablePercentSize = {readonly type: 'percent'; readonly value: number} & (
  | {readonly min: PixelWidth; readonly max?: never}
  | {readonly min?: never; readonly max: PixelWidth}
);

/**
 * A size: a number or `Npx` (pixels), an exact `N%`, `pixel(n)`, or `percent(n, {min|max: pixel(n)})`.
 * Typed as `string` for the exact spellings so attribute values can be passed as they are.
 */
export type ResizableSize = number | string | PixelWidth | ResizablePercentSize;

export function pixel(value: number): PixelWidth {
  return {type: 'pixel', value};
}

/**
 * A literal percentage with one pixel floor or ceiling. The options argument is required: an
 * unbounded percentage already has the `'40%'` spelling.
 */
export function percent(
  value: number,
  options: {min: PixelWidth; max?: never} | {min?: never; max: PixelWidth},
): ResizablePercentSize {
  return {type: 'percent', value, ...options};
}

export type ResizableDirection = 'horizontal' | 'vertical';

export interface ResizableRegionConfig {
  /**
   * Initial size. A number or `Npx` is pixels; `N%` is a share of the basis; the structured
   * `percent()` adds one pixel bound. Resolved once. Default 250.
   */
  defaultSize?: ResizableSize;
  /** Live minimum in the same forms. Default 50. */
  minSize?: ResizableSize;
  /** Live maximum in the same forms. Default unbounded. */
  maxSize?: ResizableSize;
  /** Whether dragging below `collapsedSize` collapses the region to zero. */
  collapsible?: boolean;
  /** Size in px below which a drag collapses the region. Default 40. */
  collapsedSize?: number;
  /** Pixel values the size snaps to; when set the region only rests on them. */
  snaps?: readonly number[];
  /** Cascade priority among regions: lower shrinks first. Informational, kept for parity. */
  shrinkOrder?: number;
}

export interface ResizableOptions extends ResizableRegionConfig {
  /**
   * The element a percentage is a share of. Caller-owned: the controller never infers one. Omitted,
   * percentages use the viewport. May return a different element over time; the basis follows it.
   */
  container?: () => HTMLElement | null | undefined;
  /** The axis the region resizes along (default `horizontal`); it must match the handle's. */
  direction?: ResizableDirection;
  /** Key for persisting size and collapse state in `localStorage`. */
  autoSaveId?: string;
  /** Initial collapse state; a persisted entry wins. Only honoured when `collapsible`. */
  defaultCollapsed?: boolean;
  /**
   * Asked before a user gesture collapses or expands the region; return `false` to keep the state
   * (how a page owns the collapse state). `collapse()`/`expand()` do not ask.
   */
  beforeCollapseChange?: (collapsed: boolean, reason: ResizableReason) => boolean | void;
  /** Called after the size changed (dragging calls it for every step). */
  onSizeChange?: (size: number, reason: ResizableReason) => void;
  /** Called after the collapse state changed. */
  onCollapseChange?: (collapsed: boolean, reason: ResizableReason) => void;
}

/** What changed a region: a drag, the keyboard, or a method call. */
export type ResizableReason = 'pointer' | 'keyboard' | 'request';

/** What a `tct-resize-handle` needs from a region. */
export interface ResizableProps {
  /** Current size in px (0 while collapsed). */
  readonly size: number;
  readonly collapsed: boolean;
  /** Resolved minimum in px. */
  readonly minSize: number;
  /** Resolved maximum in px (`Infinity` when unbounded). */
  readonly maxSize: number;
  readonly snaps: readonly number[];
  readonly collapsedSize: number;
  readonly collapsible: boolean;
  readonly direction: ResizableDirection;
  /** A gesture begins (freezes the basis so a container resizing mid-drag cannot move a bound). */
  start(reason?: ResizableReason): void;
  /** Moves the region by `delta` px from where the gesture started (already direction-corrected). */
  move(delta: number): void;
  /** The gesture ended. */
  end(): void;
  /** The gesture was interrupted (cancelled pointer, lost capture, handle removed mid-drag). */
  cancel(): void;
  /** Runs `listener` after the region changed; returns the unsubscribe function. */
  subscribe(listener: () => void): () => void;
}

// ------------------------------------------------------------------------------------- parsing

const DEFAULT_MIN = 50;
const DEFAULT_COLLAPSED_SIZE = 40;
const DEFAULT_SIZE = 250;
/** The basis used until a supplied container has been measured (and without a window). */
const TEMPORARY_BASIS = 1200;
const STORAGE_PREFIX = 'tct-resizable:';
const GUIDANCE =
  'Use a non-negative number of pixels, an exact "Npx" string, an exact "N%" string from 0% to 100%, ' +
  'pixel(value), or percent(value, {min: pixel(value)}) / percent(value, {max: pixel(value)}).';

type Parsed =
  {kind: 'px'; value: number} | {kind: 'percent'; value: number; min?: number; max?: number};

const PX = /^(\d+(?:\.\d+)?)px$/;
const PERCENT = /^(\d+(?:\.\d+)?)%$/;
const PLAIN = /^\d+(?:\.\d+)?$/;

function pixelValue(value: unknown): number | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const candidate = value as {type?: unknown; value?: unknown};
  return candidate.type === 'pixel' &&
    typeof candidate.value === 'number' &&
    Number.isFinite(candidate.value) &&
    candidate.value >= 0
    ? candidate.value
    : null;
}

/** Validates a size; `null` when it is not one of the accepted forms. */
export function parseResizableSize(value: unknown): Parsed | null {
  if (typeof value === 'number')
    return Number.isFinite(value) && value >= 0 ? {kind: 'px', value} : null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    const px = PX.exec(trimmed);
    if (px) return {kind: 'px', value: Number(px[1])};
    // A bare number in an attribute is pixels.
    if (PLAIN.test(trimmed)) return {kind: 'px', value: Number(trimmed)};
    const percentMatch = PERCENT.exec(trimmed);
    if (percentMatch) {
      const number = Number(percentMatch[1]);
      return number <= 100 ? {kind: 'percent', value: number} : null;
    }
    return null;
  }
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    const px = pixelValue(value);
    if (px !== null) return {kind: 'px', value: px};
    const candidate = value as {type?: unknown; value?: unknown; min?: unknown; max?: unknown};
    if (
      candidate.type !== 'percent' ||
      typeof candidate.value !== 'number' ||
      !Number.isFinite(candidate.value) ||
      candidate.value < 0 ||
      candidate.value > 100
    ) {
      return null;
    }
    // Exactly one bound.
    const hasMin = candidate.min !== undefined;
    if (hasMin === (candidate.max !== undefined)) return null;
    const bound = pixelValue(hasMin ? candidate.min : candidate.max);
    if (bound === null) return null;
    return hasMin
      ? {kind: 'percent', value: candidate.value, min: bound}
      : {kind: 'percent', value: candidate.value, max: bound};
  }
  return null;
}

const dependsOnBasis = (parsed: Parsed | null): boolean => parsed?.kind === 'percent';

function toPixels(parsed: Parsed, basis: number): number {
  if (parsed.kind === 'px') return parsed.value;
  const share = Math.round((parsed.value / 100) * basis);
  if (parsed.min !== undefined) return Math.max(share, parsed.min);
  if (parsed.max !== undefined) return Math.min(share, parsed.max);
  return share;
}

function describe(value: unknown): string {
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

function clampSize(size: number, min: number, max: number, snaps: readonly number[]): number {
  const clamped = Math.min(max, Math.max(min, size));
  // With snap points the region only rests on them: no intermediate positions.
  if (snaps.length === 0) return clamped;
  let nearest = snaps[0]!;
  for (const snap of snaps) {
    if (Math.abs(clamped - snap) < Math.abs(clamped - nearest)) nearest = snap;
  }
  return Math.min(max, Math.max(min, nearest));
}

// ------------------------------------------------------------------------------- persistence

interface Persisted {
  /** Expanded size in px, or `null` when the entry carries no usable size. */
  size: number | null;
  /** Collapse state when the entry was written, or `null` when unknown. */
  collapsed: boolean | null;
}

function loadPersisted(key: string): Persisted | null {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === 'number') {
      if (!Number.isFinite(parsed)) return null;
      return parsed === 0 ? {size: null, collapsed: true} : {size: parsed, collapsed: null};
    }
    if (typeof parsed === 'object' && parsed !== null) {
      const {size, collapsed} = parsed as {size?: unknown; collapsed?: unknown};
      const hasSize = typeof size === 'number' && Number.isFinite(size) && size > 0;
      if (hasSize || collapsed === true) {
        return {size: hasSize ? size : null, collapsed: collapsed === true};
      }
    }
  } catch {
    // Storage can be blocked or hold something else: start from the defaults.
  }
  return null;
}

function savePersisted(key: string, state: Persisted): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(state));
  } catch {
    // Storage can be blocked or full: the region simply is not remembered.
  }
}

// ----------------------------------------------------------------------------------- controller

type HostLike = ReactiveControllerHost | null;

/**
 * One resizable region. Pass the reactive host (a panel, or the element that owns the split) so it
 * re-renders on change, or `null` for a bare store. The options are read again on every refresh, so
 * a host can pass a function that reads its attributes.
 */
export class ResizableController implements ReactiveController, ResizableProps {
  readonly #host: HostLike;
  readonly #options: () => ResizableOptions;
  readonly #listeners = new Set<() => void>();
  #chosen: number | null = null;
  #initialised = false;
  #collapsed = false;
  #defaultLatch: {px: number; final: boolean} | null = null;
  #committed: {min: number; max: number} | null = null;
  #gestureBasis: number | null = null;
  #gestureReason: ResizableReason = 'pointer';
  #dragStart = 0;
  #container: HTMLElement | null = null;
  #stopContainer: (() => void) | undefined;
  #containerBasis: number | null = null;
  #viewportListening = false;
  #warned = new Set<string>();
  #snapshot = '';
  #lastNotified = '';
  #lastPersisted = '';
  #persisted: Persisted | null | undefined;
  #connected = false;

  constructor(host: HostLike, options: ResizableOptions | (() => ResizableOptions)) {
    this.#host = host;
    this.#options = typeof options === 'function' ? options : () => options;
    host?.addController(this);
    // A bare store has no lifecycle: it is live from the start.
    if (host === null) {
      this.#connected = true;
      this.refresh();
    }
  }

  /**
   * Builds several regions that share one container and axis. Regions stay independently
   * pixel-selected: sharing a basis adds no ratio or 100% total between them.
   */
  static regions<Names extends string>(
    host: HostLike,
    options: {
      regions: Record<Names, ResizableRegionConfig>;
      container?: () => HTMLElement | null | undefined;
      direction?: ResizableDirection;
      autoSaveId?: string;
    },
  ): Record<Names, ResizableController> {
    const result = {} as Record<Names, ResizableController>;
    for (const name of Object.keys(options.regions) as Names[]) {
      result[name] = new ResizableController(host, () => ({
        ...options.regions[name],
        container: options.container,
        direction: options.direction,
        autoSaveId: options.autoSaveId ? `${options.autoSaveId}:${name}` : undefined,
      }));
    }
    return result;
  }

  // ------------------------------------------------------------------------------ public state

  get size(): number {
    return this.collapsed ? 0 : this.#resolve().size;
  }

  get collapsed(): boolean {
    return this.collapsible && this.#collapsed;
  }

  get minSize(): number {
    return this.#resolve().min;
  }

  get maxSize(): number {
    return this.#resolve().max;
  }

  get snaps(): readonly number[] {
    return this.#options().snaps ?? [];
  }

  get collapsedSize(): number {
    return this.#options().collapsedSize ?? DEFAULT_COLLAPSED_SIZE;
  }

  get collapsible(): boolean {
    return this.#options().collapsible === true;
  }

  get direction(): ResizableDirection {
    return this.#options().direction ?? 'horizontal';
  }

  /** The handle-facing view of this region (the controller itself). */
  get props(): ResizableProps {
    return this;
  }

  /** Whether a percentage basis is real (a supplied container has been laid out). */
  get isBasisMeasured(): boolean {
    return this.#resolve().measured;
  }

  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  // ----------------------------------------------------------------------------- commands

  /** Collapses the region (when collapsible) without asking; a repeated call changes nothing. */
  collapse(): void {
    this.#setCollapsed(true, 'request', false);
  }

  /** Expands from the collapsed state without asking. */
  expand(): void {
    this.#setCollapsed(false, 'request', false);
    this.#emitSize('request');
  }

  /** Resizes to a pixel size, clamped to the bounds; expands a collapsed region. */
  resize(size: number): void {
    if (!Number.isFinite(size) || size < 0) {
      this.#warnOnce(
        `resize:${String(size)}`,
        `resize(${String(size)}) is not a pixel size. Keeping the current size. Percentages configure the controller; they are not a programmatic input.`,
      );
      return;
    }
    const {min, max} = this.#resolve();
    const clamped = clampSize(size, min, max, this.snaps);
    this.#chosen = clamped;
    this.#setCollapsed(false, 'request', false);
    this.#emitSize('request');
    this.#changed();
  }

  /** Re-reads the options and the basis (a host calls it after its attributes changed). */
  refresh(): void {
    this.#syncBasis();
    this.#resolve();
    this.#persist();
    if (this.#snapshot !== this.#lastNotified) this.#notify();
  }

  // -------------------------------------------------------------------------------- gestures

  start(reason: ResizableReason = 'pointer'): void {
    const resolved = this.#resolve();
    // One stable basis per gesture: a container that resizes mid-drag would move the bound under
    // the pointer; the new basis applies when the gesture ends.
    this.#gestureBasis = resolved.basis;
    this.#gestureReason = reason;
    this.#dragStart = this.#collapsed && this.collapsible ? 0 : resolved.size;
  }

  move(delta: number): void {
    const reason = this.#gestureReason === 'request' ? 'pointer' : this.#gestureReason;
    const raw = this.#dragStart + delta;
    const {min, max} = this.#resolve();
    if (this.collapsible && raw < this.collapsedSize) {
      if (!this.#collapsed) this.#setCollapsed(true, reason, true);
      return;
    }
    if (this.#collapsed && raw >= this.collapsedSize) {
      if (!this.#setCollapsed(false, reason, true)) return;
    }
    const clamped = clampSize(raw, min, max, this.snaps);
    if (clamped === this.#chosen && !this.#collapsed) return;
    this.#chosen = clamped;
    this.#emitSize(reason);
    this.#changed();
  }

  end(): void {
    this.#releaseGesture();
  }

  cancel(): void {
    this.#releaseGesture();
  }

  // ------------------------------------------------------------------------------ lifecycle

  hostConnected(): void {
    this.#connected = true;
    this.refresh();
  }

  hostUpdated(): void {
    // Options may have followed the host's attributes; the container element may have changed.
    this.refresh();
  }

  hostDisconnected(): void {
    this.#connected = false;
    this.#stopContainer?.();
    this.#stopContainer = undefined;
    this.#container = null;
    this.#containerBasis = null;
    if (this.#viewportListening) {
      window.removeEventListener('resize', this.#onViewportResize);
      this.#viewportListening = false;
    }
  }

  // ---------------------------------------------------------------------------------- internals

  #warnOnce(id: string, message: string): void {
    if (this.#warned.has(id)) return;
    this.#warned.add(id);
    devWarn(`resizable:${id}`, message);
  }

  #releaseGesture(): void {
    if (this.#gestureBasis === null) return;
    this.#gestureBasis = null;
    // The basis may have moved during the gesture; apply it now.
    this.refresh();
    this.#notify();
  }

  /** Whether a collapse state change is applied; `ask` runs the veto (a user gesture). */
  #setCollapsed(next: boolean, reason: ResizableReason, ask: boolean): boolean {
    if (!this.collapsible) return false;
    if (this.#collapsed === next) return true;
    if (ask && this.#options().beforeCollapseChange?.(next, reason) === false) return false;
    this.#collapsed = next;
    this.#options().onCollapseChange?.(next, reason);
    if (next) this.#options().onSizeChange?.(0, reason);
    this.#changed();
    return true;
  }

  #emitSize(reason: ResizableReason): void {
    this.#options().onSizeChange?.(this.size, reason);
  }

  #changed(): void {
    this.#persist();
    this.#resolve();
    this.#notify();
  }

  #notify(): void {
    this.#lastNotified = this.#snapshot;
    this.#host?.requestUpdate();
    for (const listener of [...this.#listeners]) listener();
  }

  #persist(): void {
    const key = this.#options().autoSaveId;
    const resolved = this.#resolve();
    // Nothing is written while the basis is only the temporary stand-in: that size is a placeholder,
    // and persisting it would overwrite the real saved size with one from a basis that was never real.
    if (!key || !resolved.measured) return;
    const entry = {size: resolved.size, collapsed: this.collapsed};
    const serialised = `${key}|${entry.size}|${String(entry.collapsed)}`;
    if (serialised === this.#lastPersisted) return;
    this.#lastPersisted = serialised;
    savePersisted(key, entry);
  }

  /** The stored entry, read once. */
  #storedEntry(): Persisted | null {
    const key = this.#options().autoSaveId;
    if (!key) return null;
    if (this.#persisted === undefined) this.#persisted = loadPersisted(key);
    return this.#persisted;
  }

  // -------------------------------------------------------------------------------------- basis

  readonly #onViewportResize = (): void => {
    this.refresh();
  };

  #syncBasis(): void {
    if (!this.#connected) return;
    const options = this.#options();
    const boundsDepend =
      dependsOnBasis(parseResizableSize(options.minSize)) ||
      dependsOnBasis(parseResizableSize(options.maxSize));
    const defaultDepends = dependsOnBasis(parseResizableSize(options.defaultSize));
    const persisted = this.#storedEntry();
    const container = options.container?.() ?? null;
    // A default needs a live container only until its initial pixel choice is final; a persisted
    // pixel choice wins without measuring the unused default. Bounds keep following the basis.
    const needsInitial =
      persisted?.size == null && defaultDepends && this.#defaultLatch?.final !== true;
    const observeContainer = container !== null && (boundsDepend || needsInitial);

    if (!observeContainer || container !== this.#container) {
      this.#stopContainer?.();
      this.#stopContainer = undefined;
      this.#container = null;
      this.#containerBasis = null;
    }
    if (observeContainer && container !== this.#container) {
      this.#container = container;
      this.#containerBasis = measureContentBox(container, this.direction);
      this.#stopContainer = observeResize(container, (entry) => {
        this.#containerBasis = measureContentBox(container, this.direction, entry);
        this.refresh();
      });
    }
    const viewportBasis = container === null && boundsDepend;
    if (viewportBasis && !this.#viewportListening) {
      window.addEventListener('resize', this.#onViewportResize);
      this.#viewportListening = true;
    } else if (!viewportBasis && this.#viewportListening) {
      window.removeEventListener('resize', this.#onViewportResize);
      this.#viewportListening = false;
    }
  }

  /** Everything derived from the options and the basis, computed on demand and committed. */
  #resolve(): {size: number; min: number; max: number; basis: number; measured: boolean} {
    const options = this.#options();
    const hasContainer = (options.container?.() ?? null) !== null;
    const parsedMin = parseResizableSize(options.minSize);
    const parsedMax = parseResizableSize(options.maxSize);
    const parsedDefault = parseResizableSize(options.defaultSize);
    const boundsDepend = dependsOnBasis(parsedMin) || dependsOnBasis(parsedMax);
    const defaultDepends = dependsOnBasis(parsedDefault);
    const persisted = this.#initialised ? null : this.#storedEntry();
    const observing =
      hasContainer && (boundsDepend || (defaultDepends && this.#defaultLatch?.final !== true));

    // A zero measurement is not a measurement: a hidden or detached container reports 0, and
    // resolving "50%" against it would produce a real maximum of 0.
    const positive = this.#containerBasis !== null && this.#containerBasis > 0;
    const viewportBasis =
      typeof window === 'undefined'
        ? TEMPORARY_BASIS
        : this.direction === 'vertical'
          ? window.innerHeight
          : window.innerWidth;
    const containerBasis = this.#containerBasis ?? 0;
    const liveBasis = hasContainer ? (positive ? containerBasis : TEMPORARY_BASIS) : viewportBasis;
    const measured = observing ? positive : true;
    const basis = this.#gestureBasis ?? liveBasis;

    const bound = (
      raw: unknown,
      parsed: Parsed | null,
      fallback: number,
      label: string,
    ): number => {
      if (raw === undefined) return fallback;
      if (raw === Infinity && fallback === Infinity) return Infinity;
      if (parsed === null) {
        this.#warnOnce(
          `${label}:${describe(raw)}`,
          `${label}: ${describe(raw)} is not a size. ${GUIDANCE} Falling back to ${String(fallback)}.`,
        );
        return fallback;
      }
      return toPixels(parsed, basis);
    };
    const min = bound(options.minSize, parsedMin, DEFAULT_MIN, 'minSize');
    const max = bound(options.maxSize, parsedMax, Infinity, 'maxSize');
    if (min > max) {
      this.#warnOnce(
        'inverted',
        `the resolved minimum (${min}px) is above the resolved maximum (${max}px). The maximum wins.`,
      );
    }

    // A basis-dependent default resolves ONCE into a pixel size; it is not final while a supplied
    // container is still unmeasured.
    if (this.#defaultLatch === null || !this.#defaultLatch.final) {
      this.#defaultLatch = {
        px: bound(options.defaultSize, parsedDefault, DEFAULT_SIZE, 'defaultSize'),
        final: measured,
      };
    }
    const defaultPx = this.#defaultLatch.px;
    const snaps = options.snaps ?? [];

    if (!this.#initialised) {
      this.#initialised = true;
      this.#collapsed = persisted?.collapsed ?? options.defaultCollapsed ?? false;
      if (persisted?.size != null) this.#chosen = persisted.size;
    }
    if (this.#chosen === null && measured) this.#chosen = clampSize(defaultPx, min, max, snaps);

    // A re-resolved bound clamps the SELECTION, not only the paint, so a container that shrank and
    // grew again does not revive the pre-clamp size. Held until the basis is real and no gesture runs.
    if (
      measured &&
      this.#gestureBasis === null &&
      (this.#committed === null || this.#committed.min !== min || this.#committed.max !== max)
    ) {
      this.#committed = {min, max};
      if (this.#chosen !== null) this.#chosen = clampSize(this.#chosen, min, max, snaps);
    }
    const size = clampSize(this.#chosen ?? defaultPx, min, max, snaps);
    this.#snapshot = `${size}|${min}|${max}|${String(this.collapsible && this.#collapsed)}`;
    return {size, min, max, basis, measured};
  }
}

/**
 * The container's content-box size on the active axis. Content box, not border box, so a bordered or
 * padded container does not report a basis a few pixels larger than the space a percentage is a
 * share of. The observer entry carries `contentBoxSize` (writing-mode aware); measuring the element
 * is the fallback for the first, synthetic call.
 */
function measureContentBox(
  element: HTMLElement,
  direction: ResizableDirection,
  entry?: ResizeObserverEntry,
): number | null {
  const box = entry?.contentBoxSize?.[0];
  if (box) return direction === 'vertical' ? box.blockSize : box.inlineSize;
  const style = getComputedStyle(element);
  const size =
    direction === 'vertical'
      ? element.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom)
      : element.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
  return Number.isFinite(size) ? size : null;
}
