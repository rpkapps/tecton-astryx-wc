/**
 * Overflow measurement (A§9.18, WP-5): port of upstream `useOverflow` + `computeOverflow` (MIT, Meta
 * Platforms). How many of N items fit in the available width once an overflow indicator is reserved,
 * with a floor (`minVisibleItems`), a ceiling (`maxVisibleItems`), bounded multi-row packing
 * (`maxRows`) and collapsing from either end.
 *
 * `computeOverflow` is pure (widths in, counts out) and unit-tested without a DOM.
 * `OverflowController` is the reactive wrapper: it observes the measurement targets through the
 * shared `ResizeObserver`, asks the host to `read()` the current measurements, and stores the result,
 * re-rendering the host only when it changed.
 *
 * The controller never loops: a result equal to the previous one is dropped, and `read()` is only
 * invoked from a resize callback, an explicit `measure()` or the first update, never from `render()`.
 * Hosts make measurement flicker-free by revealing every item, reading, and hiding again inside the
 * one `read()` call (a single synchronous layout, no paint in between).
 *
 * There is a single source of truth for `visibleCount`:
 *   visibleCount = clamp(fitCount, minVisibleItems, maxVisibleItems ?? itemCount)
 *
 * ```ts
 * #overflow = new OverflowController(this, {
 *   targets: () => [this.#container, this.#measure],
 *   read: () => ({availableWidth, widths, indicatorWidth}),
 *   options: () => ({gap: 8, minVisibleItems: 0, collapseFrom: 'end'}),
 * });
 * render() { const {visibleCount, hasOverflow} = this.#overflow; … }
 * ```
 * Guides: [mwg:css-layout] [mwg:size-aware-styling]
 */
import type {ReactiveController, ReactiveControllerHost} from 'lit';
import {observeResize} from './resize.js';

export interface ComputeOverflowInput {
  /** Measured widths of each item, in original DOM order. */
  widths: number[];
  /** Gap between items, in pixels. */
  gap: number;
  /** Width available to lay items out, in pixels. */
  availableWidth: number;
  /** Measured width of the overflow indicator (0 if none). */
  indicatorWidth: number;
  /** Floor: always show at least this many items. */
  minVisibleItems: number;
  /** Ceiling: never show more than this many items. `undefined` = no cap. */
  maxVisibleItems?: number;
  /**
   * Bounded multi-row: wrap items across up to this many rows, then collapse the rest into the
   * overflow indicator. `undefined` (or `1`) = single line.
   */
  maxRows?: number;
  /** Which end items collapse from. */
  collapseFrom: 'start' | 'end';
}

export interface ComputeOverflowResult {
  /** Number of items that should be rendered in the visible container. */
  visibleCount: number;
  /** Number of rows the visible items occupy (always 1 for the single-line path). */
  rows: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(Math.min(value, max), min);
}

/**
 * Resolves the floor and ceiling against the item count. When the ceiling is below the floor, the
 * floor wins (`clamp` applies the floor last).
 */
function resolveBounds(
  itemCount: number,
  minVisibleItems: number,
  maxVisibleItems: number | undefined,
): {floor: number; ceiling: number} {
  const floor = Math.max(0, Math.min(minVisibleItems, itemCount));
  const rawCeiling = maxVisibleItems ?? itemCount;
  const ceiling = Math.max(0, Math.min(rawCeiling, itemCount));
  return {floor, ceiling};
}

/**
 * Single-line greedy fit: items are added while they fit next to the reserved indicator (the last
 * item needs no indicator, because nothing is hidden after it). The floor is honoured even when it
 * does not fit; the ceiling stops the loop.
 */
function computeSingleLineFit(
  orderedWidths: number[],
  gap: number,
  availableWidth: number,
  indicatorWidth: number,
  floor: number,
  ceiling: number,
): number {
  let totalWidth = 0;
  let count = 0;

  for (let i = 0; i < orderedWidths.length; i++) {
    if (count >= ceiling) break;

    const itemWidth = orderedWidths[i]!;
    const gapWidth = i > 0 ? gap : 0;
    const candidateWidth = totalWidth + itemWidth + gapWidth;

    const isLastItem = i === orderedWidths.length - 1;
    const reservedWidth = isLastItem
      ? 0
      : indicatorWidth + (count > 0 || indicatorWidth > 0 ? gap : 0);

    if (candidateWidth + reservedWidth > availableWidth && count >= floor) break;

    totalWidth = candidateWidth;
    count++;
  }

  return count;
}

/**
 * Packs items onto up to `maxRows` rows (flex-wrap order). The indicator's width (plus a gap) is
 * reserved on the last row only. An item wider than a row occupies a row on its own.
 */
function packRows(
  orderedWidths: number[],
  gap: number,
  availableWidth: number,
  indicatorReserve: number,
  maxRows: number,
): {placed: number; rows: number} {
  let placed = 0;
  let row = 1;
  let rowWidth = 0;

  for (let i = 0; i < orderedWidths.length; i++) {
    const w = orderedWidths[i]!;
    const isFirstInRow = rowWidth === 0;
    const candidate = isFirstInRow ? w : rowWidth + gap + w;

    const onLastRow = row === maxRows;
    const reserve = onLastRow && indicatorReserve > 0 ? indicatorReserve + gap : 0;

    if (candidate + reserve <= availableWidth) {
      rowWidth = candidate;
      placed++;
      continue;
    }

    if (isFirstInRow) {
      // A single item wider than the row occupies this row alone (it is clipped visually), unless
      // it cannot coexist with the reserved indicator on the last row.
      if (onLastRow && reserve > 0) break;
      rowWidth = candidate;
      placed++;
      continue;
    }

    if (row >= maxRows) break;
    row++;
    rowWidth = 0;
    i--; // re-attempt this item as the first on the new row
  }

  return {placed, rows: row};
}

/** How many rows a set of items occupies when wrapped at `availableWidth`. */
function countRows(orderedWidths: number[], gap: number, availableWidth: number): number {
  if (orderedWidths.length === 0) return 0;
  let rows = 1;
  let rowWidth = 0;
  for (const w of orderedWidths) {
    const isFirstInRow = rowWidth === 0;
    const candidate = isFirstInRow ? w : rowWidth + gap + w;
    if (candidate <= availableWidth || isFirstInRow) {
      rowWidth = candidate;
    } else {
      rows++;
      rowWidth = w;
    }
  }
  return rows;
}

function computeMultiRowFit(
  orderedWidths: number[],
  gap: number,
  availableWidth: number,
  indicatorWidth: number,
  maxRows: number,
): {count: number; rows: number} {
  const n = orderedWidths.length;
  if (n === 0) return {count: 0, rows: 0};

  // Everything fits within maxRows without an indicator: nothing overflows.
  const packAll = packRows(orderedWidths, gap, availableWidth, 0, maxRows);
  if (packAll.placed === n) return {count: n, rows: packAll.rows};

  // Overflow: reserve the indicator on the final row and pack again.
  const packWithIndicator = packRows(orderedWidths, gap, availableWidth, indicatorWidth, maxRows);
  const count = packWithIndicator.placed;
  const rows = countRows(orderedWidths.slice(0, count), gap, availableWidth);
  return {count, rows: Math.max(count > 0 ? 1 : 0, rows)};
}

/** The pure fit computation (upstream `computeOverflow`). */
export function computeOverflow(input: ComputeOverflowInput): ComputeOverflowResult {
  const {
    widths,
    gap,
    availableWidth,
    indicatorWidth,
    minVisibleItems,
    maxVisibleItems,
    maxRows,
    collapseFrom,
  } = input;

  const itemCount = widths.length;
  if (itemCount === 0) return {visibleCount: 0, rows: 0};

  const {floor, ceiling} = resolveBounds(itemCount, minVisibleItems, maxVisibleItems);
  const orderedWidths = collapseFrom === 'end' ? widths : [...widths].reverse();
  const multiRow = maxRows != null && maxRows > 1;

  if (!multiRow) {
    const fitCount = computeSingleLineFit(
      orderedWidths,
      gap,
      availableWidth,
      indicatorWidth,
      floor,
      ceiling,
    );
    const visibleCount = clamp(fitCount, floor, ceiling);
    return {visibleCount, rows: visibleCount > 0 ? 1 : 0};
  }

  const {count, rows} = computeMultiRowFit(
    orderedWidths,
    gap,
    availableWidth,
    indicatorWidth,
    maxRows,
  );
  const visibleCount = clamp(count, floor, ceiling);
  const resolvedRows =
    visibleCount === count
      ? rows
      : countRows(orderedWidths.slice(0, visibleCount), gap, availableWidth);
  return {visibleCount, rows: visibleCount > 0 ? Math.max(1, resolvedRows) : 0};
}

// ---------------------------------------------------------------------------------- controller

/** What the host measured, in CSS pixels (the same units as `gap`). */
export interface OverflowMeasurement {
  /** Width available to lay items out. */
  availableWidth: number;
  /** Natural width of every item, in original DOM order. */
  widths: number[];
  /** Width of the overflow indicator at its widest (0 when there is none). */
  indicatorWidth: number;
  /** Tallest item, for sizing a multi-row container (0 when unknown). */
  rowHeight?: number;
}

/** The settings of a computation; read fresh on every measurement so attribute changes apply. */
export interface OverflowSettings {
  gap: number;
  minVisibleItems: number;
  maxVisibleItems?: number;
  maxRows?: number;
  collapseFrom: 'start' | 'end';
}

export interface OverflowControllerOptions {
  /** Elements whose resizing invalidates the measurement (the visible container or its parent, the measurement copy). */
  targets: () => readonly (Element | null | undefined)[];
  /** Reads the current measurements, or `null` when the host cannot measure yet (not rendered). */
  read: () => OverflowMeasurement | null;
  options: () => OverflowSettings;
  /** Called after a measurement whose result differs from the previous one. */
  onResult?: (result: OverflowResult) => void;
}

export interface OverflowResult extends ComputeOverflowResult {
  itemCount: number;
  /** Whether any item is collapsed. */
  hasOverflow: boolean;
  rowHeight: number;
}

/** Reactive wrapper around {@link computeOverflow} (upstream `useOverflow`). */
export class OverflowController implements ReactiveController {
  readonly #host: ReactiveControllerHost;
  readonly #options: OverflowControllerOptions;
  #stops = new Map<Element, () => void>();
  #connected = false;
  #result: OverflowResult = {
    visibleCount: 0,
    rows: 1,
    itemCount: 0,
    hasOverflow: false,
    rowHeight: 0,
  };
  #measured = false;

  constructor(host: ReactiveControllerHost, options: OverflowControllerOptions) {
    this.#host = host;
    this.#options = options;
    host.addController(this);
  }

  /** Items to render as visible; before the first measurement every item counts as visible (optimistic). */
  get visibleCount(): number {
    return this.#result.visibleCount;
  }

  get hasOverflow(): boolean {
    return this.#result.hasOverflow;
  }

  get rows(): number {
    return this.#result.rows;
  }

  get rowHeight(): number {
    return this.#result.rowHeight;
  }

  /** Whether a measurement has completed since the controller connected. */
  get measured(): boolean {
    return this.#measured;
  }

  hostConnected(): void {
    this.#connected = true;
  }

  hostUpdated(): void {
    this.#syncTargets();
  }

  hostDisconnected(): void {
    this.#connected = false;
    for (const stop of this.#stops.values()) stop();
    this.#stops.clear();
    this.#measured = false;
  }

  /** Re-measures now (after children changed without the container resizing). */
  measure(): void {
    if (!this.#connected) return;
    const measurement = this.#options.read();
    if (!measurement) return;
    const {gap, minVisibleItems, maxVisibleItems, maxRows, collapseFrom} = this.#options.options();
    const computed = computeOverflow({
      widths: measurement.widths,
      gap,
      availableWidth: measurement.availableWidth,
      indicatorWidth: measurement.indicatorWidth,
      minVisibleItems,
      maxVisibleItems,
      maxRows,
      collapseFrom,
    });
    const itemCount = measurement.widths.length;
    const next: OverflowResult = {
      ...computed,
      itemCount,
      hasOverflow: computed.visibleCount < itemCount,
      rowHeight: measurement.rowHeight ?? 0,
    };
    const previous = this.#result;
    this.#measured = true;
    if (
      previous.visibleCount === next.visibleCount &&
      previous.rows === next.rows &&
      previous.itemCount === next.itemCount &&
      previous.rowHeight === next.rowHeight
    ) {
      return;
    }
    this.#result = next;
    this.#options.onResult?.(next);
    this.#host.requestUpdate();
  }

  /** Observes the current targets; resize callbacks re-measure through the shared observer. */
  #syncTargets(): void {
    if (!this.#connected) return;
    const wanted = new Set(
      this.#options.targets().filter((target): target is Element => target instanceof Element),
    );
    for (const [element, stop] of this.#stops) {
      if (!wanted.has(element)) {
        stop();
        this.#stops.delete(element);
      }
    }
    for (const element of wanted) {
      if (!this.#stops.has(element)) {
        // The platform delivers an initial observation for a newly observed element, which is the
        // first measurement.
        this.#stops.set(
          element,
          observeResize(element, () => {
            this.measure();
          }),
        );
      }
    }
  }
}
