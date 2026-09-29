/**
 * `paginateData` (upstream `paginateData`): the client-side page slice. For server-side pagination the
 * data is already one page: pass it to the table directly.
 */

/**
 * Slices `data` for `page`. `page` (1-based) and `pageSize` are coerced to positive integers so a bad
 * value never returns the tail of the data dressed up as a page: a non-finite page size falls back to
 * 10, a page below 1 or a fraction is floored to 1.
 *
 * @example
 * table.data = paginateData(rows, page, 25);
 */
export function paginateData<T>(data: readonly T[], page: number, pageSize: number): T[] {
  const size = Number.isFinite(pageSize) ? Math.max(1, Math.floor(pageSize)) : 10;
  const current = Number.isFinite(page) ? Math.max(1, Math.floor(page)) : 1;
  const start = (current - 1) * size;
  return data.slice(start, start + size);
}
