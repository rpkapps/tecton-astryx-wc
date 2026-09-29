/**
 * Page arithmetic of `tct-pagination`: the page list with ellipsis markers, and the coercions that keep a
 * bad `page-size`, `step` or `page` from producing an infinite or reversed page count.
 */

/** An entry of the page list: a 1-based page number, or the marker of an omitted span. */
export type PageRangeEntry = number | '...';

/**
 * The page numbers to show, with `'...'` markers where a span is omitted (`3 + 2 * siblingCount` numbers
 * around the ends, first and last always present).
 *
 * @example
 * generatePageRange(5, 10, 1) // [1, '...', 4, 5, 6, '...', 10]
 * generatePageRange(1, 10, 1) // [1, 2, 3, '...', 10]
 * generatePageRange(1, 5, 1)  // [1, 2, 3, 4, 5]
 */
export function generatePageRange(
  currentPage: number,
  totalPages: number,
  siblingCount: number,
): PageRangeEntry[] {
  // Slots excluding the ellipses: first + last + current + 2 * siblings, plus two ellipsis slots.
  const totalSlots = 5 + 2 * siblingCount;
  if (totalPages <= totalSlots) {
    return Array.from({length: totalPages}, (_, index) => index + 1);
  }

  const leftSiblingIndex = Math.max(currentPage - siblingCount, 1);
  const rightSiblingIndex = Math.min(currentPage + siblingCount, totalPages);
  const showLeftEllipsis = leftSiblingIndex > 2;
  const showRightEllipsis = rightSiblingIndex < totalPages - 1;

  if (!showLeftEllipsis && showRightEllipsis) {
    // Near the start: more pages on the left.
    const leftRange = 3 + 2 * siblingCount;
    const pages: PageRangeEntry[] = Array.from({length: leftRange}, (_, index) => index + 1);
    pages.push('...', totalPages);
    return pages;
  }

  if (showLeftEllipsis && !showRightEllipsis) {
    // Near the end: more pages on the right.
    const rightRange = 3 + 2 * siblingCount;
    const pages: PageRangeEntry[] = [1, '...'];
    for (let page = totalPages - rightRange + 1; page <= totalPages; page++) pages.push(page);
    return pages;
  }

  // In the middle: an ellipsis on both sides.
  const pages: PageRangeEntry[] = [1, '...'];
  for (let page = leftSiblingIndex; page <= rightSiblingIndex; page++) pages.push(page);
  pages.push('...', totalPages);
  return pages;
}

/** The default page size. */
export const DEFAULT_PAGE_SIZE = 10;

/**
 * A usable page size: a positive integer. Zero, negatives and non-finite values would yield an infinite or
 * NaN page count (and an unbounded dot list), so a non-finite value falls back to the default and the rest
 * is floored to at least 1.
 */
export function coercePageSize(value: number): number {
  return Number.isFinite(value) ? Math.max(1, Math.floor(value)) : DEFAULT_PAGE_SIZE;
}

/** The previous/next stride: an integer of at least 1, else 1, so a bad value never freezes or reverses paging. */
export function coerceStep(value: number): number {
  return Number.isInteger(value) && value >= 1 ? value : 1;
}

/** A sibling count: a non-negative integer, else the default 1. */
export function coerceSiblingCount(value: number): number {
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : 1;
}

/**
 * The page count: derived from `totalItems` when given, else `totalPages`; `undefined` when neither is
 * known (cursor paging). `totalItems` wins, as upstream documents (its code lets `totalPages` win; the
 * count readout, which always reads `totalItems`, then agrees with the page count).
 */
export function resolveTotalPages(
  totalItems: number | undefined,
  totalPages: number | undefined,
  pageSize: number,
): number | undefined {
  if (totalItems !== undefined && Number.isFinite(totalItems)) {
    return Math.ceil(totalItems / pageSize);
  }
  if (totalPages !== undefined && Number.isFinite(totalPages)) return Math.floor(totalPages);
  return undefined;
}
