/**
 * Pure column helpers (upstream `columnUtils`, exported through the `Table/utils` entry): width
 * constructors, width resolution, and columns generated from data. No DOM, no Lit.
 */
import type {ColumnWidth, PixelWidth, ProportionalWidth, TableColumn} from './table.types.js';

/** Default minimum width (px) of a proportional column that does not set one. */
export const DEFAULT_MIN_COLUMN_WIDTH = 120;

/** Inline style of one resolved column (`width`, `min-width`), keyed by CSS property name. */
export interface ResolvedColumnWidth {
  style: Record<string, string>;
}

/** Per-column width styles and the aggregate table minimum width. */
export interface ResolvedColumnWidths {
  /** Width styles by column key. */
  columns: Map<string, ResolvedColumnWidth>;
  /** Minimum table width (px) that keeps every proportional column at or above its `minWidth`. */
  tableMinWidth: number;
}

/**
 * Creates a proportional column width (`fr`-like): columns share the free space in proportion to
 * their value, and never shrink below `minWidth` (default {@link DEFAULT_MIN_COLUMN_WIDTH}).
 *
 * @example
 * proportional(2) // twice the space of proportional(1)
 * proportional(1, {minWidth: 200})
 */
export function proportional(value = 1, options?: {minWidth?: number}): ProportionalWidth {
  return {type: 'proportional', value, minWidth: options?.minWidth ?? DEFAULT_MIN_COLUMN_WIDTH};
}

/**
 * Creates a fixed pixel column width.
 *
 * @example
 * pixel(200) // exactly 200px wide
 */
export function pixel(value: number): PixelWidth {
  return {type: 'pixel', value};
}

/**
 * Resolves the width of every column in one pass: the `width` and `min-width` inline styles of each
 * `<th>`, and the table's minimum width (so proportional columns never squeeze below their minimum
 * on a narrow container; the scroll wrapper handles the overflow).
 */
export function resolveColumnWidths<T extends Record<string, unknown>>(
  columns: readonly TableColumn<T>[],
): ResolvedColumnWidths {
  let totalProportion = 0;
  let pixelTotal = 0;
  const proportionalColumns: {proportion: number; minWidth: number}[] = [];

  for (const column of columns) {
    const width: ColumnWidth | undefined = column.width;
    if (width?.type === 'pixel') {
      pixelTotal += width.value;
    } else {
      const proportion = width?.value ?? 1;
      // Only an explicit proportional() carries a minimum; an unset width flexes freely.
      const minWidth = width != null ? (width.minWidth ?? DEFAULT_MIN_COLUMN_WIDTH) : 0;
      totalProportion += proportion;
      proportionalColumns.push({proportion, minWidth});
    }
  }

  let maxProportionalSpace = 0;
  if (totalProportion > 0) {
    for (const {proportion, minWidth} of proportionalColumns) {
      const required = (minWidth * totalProportion) / proportion;
      if (required > maxProportionalSpace) maxProportionalSpace = required;
    }
  }
  const tableMinWidth = pixelTotal + maxProportionalSpace;

  const resolved = new Map<string, ResolvedColumnWidth>();
  for (const column of columns) {
    const width = column.width;
    const style: Record<string, string> = {};
    if (width?.type === 'pixel') {
      style.width = `${width.value}px`;
      style['min-width'] = `${width.value}px`;
    } else {
      const proportion = width?.value ?? 1;
      if (totalProportion > 0) style.width = `${(proportion / totalProportion) * 100}%`;
      if (width != null) style['min-width'] = `${width.minWidth ?? DEFAULT_MIN_COLUMN_WIDTH}px`;
    }
    resolved.set(column.key, {style});
  }
  return {columns: resolved, tableMinWidth};
}

const segmenter: Intl.Segmenter | undefined =
  typeof Intl !== 'undefined' && 'Segmenter' in Intl
    ? new Intl.Segmenter(undefined, {granularity: 'grapheme'})
    : undefined;

function firstCharacter(value: string): string {
  if (segmenter) {
    const first = segmenter.segment(value)[Symbol.iterator]().next();
    if (!first.done) return first.value.segment;
  }
  return Array.from(value)[0] ?? '';
}

/** Capitalises the first letter (grapheme-aware); the header text of a generated column. */
export function capitalize(value: string): string {
  if (value.length === 0) return value;
  const first = firstCharacter(value);
  return first.toUpperCase() + value.slice(first.length);
}

/** The text a default cell shows for `item[key]`: strings, numbers, booleans, bigints and dates only. */
export function defaultCellRenderer<T extends Record<string, unknown>>(
  item: T,
  key: string,
): string {
  const value = item[key];
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString();
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  ) {
    return String(value);
  }
  return '';
}

function contentLength(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === 'string') return value.length;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value).length;
  return 0;
}

/** The longest run of non-whitespace characters (min-width estimation); non-text values give 0. */
function longestWord(value: unknown): number {
  if (value == null) return 0;
  if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean')
    return 0;
  let longest = 0;
  for (const word of String(value).split(/[ \t\n]+/)) longest = Math.max(longest, word.length);
  return longest;
}

/** Floor for any generated column (px): keeps columns from collapsing on narrow viewports. */
const MIN_COLUMN_FLOOR = 60;
/** Approximate pixels per character for the min-width estimate. */
const PX_PER_CHAR = 8;

/**
 * Generates column definitions from the keys of the first data item. Widths are content-proportional:
 * the header and the first five rows are measured, and the minimum width fits the header or the
 * longest word without wrapping.
 */
export function generateColumns<T extends Record<string, unknown>>(
  data: readonly T[],
): TableColumn<T>[] {
  if (data.length === 0) return [];
  const keys = Object.keys(data[0]!);
  const sample = data.slice(0, Math.min(5, data.length));

  return keys.map((key) => {
    const headerLength = capitalize(key).length;
    let maxContent = headerLength;
    let maxWord = headerLength;
    for (const row of sample) {
      maxContent = Math.max(maxContent, contentLength(row[key]));
      maxWord = Math.max(maxWord, longestWord(row[key]));
    }
    // Short (IDs, ages, statuses) = 1, medium (names, dates) = 2, long (emails, descriptions) = 3.
    const proportion = maxContent <= 6 ? 1 : maxContent <= 15 ? 2 : 3;
    const minWidth = Math.max(Math.max(headerLength, maxWord) * PX_PER_CHAR, MIN_COLUMN_FLOOR);
    return {key, header: capitalize(key), width: proportional(proportion, {minWidth})};
  });
}
