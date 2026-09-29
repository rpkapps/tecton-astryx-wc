/**
 * The page arithmetic of tct-pagination: the page list with ellipsis markers (ported from upstream
 * Pagination.test.tsx `generatePageRange`) and the coercions of page size, step and sibling count.
 */
import {describe, expect, it} from 'vitest';
import {
  coercePageSize,
  coerceSiblingCount,
  coerceStep,
  generatePageRange,
  resolveTotalPages,
} from './pagination.utils.js';

describe('generatePageRange', () => {
  it('returns all pages when the total fits within the slots', () => {
    expect(generatePageRange(1, 5, 1)).toEqual([1, 2, 3, 4, 5]);
    expect(generatePageRange(3, 3, 1)).toEqual([1, 2, 3]);
  });

  it('returns all pages when the total equals the slot count', () => {
    expect(generatePageRange(4, 7, 1)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('shows a right ellipsis near the start', () => {
    expect(generatePageRange(1, 10, 1)).toEqual([1, 2, 3, 4, 5, '...', 10]);
    expect(generatePageRange(3, 10, 1)).toEqual([1, 2, 3, 4, 5, '...', 10]);
  });

  it('shows a left ellipsis near the end', () => {
    expect(generatePageRange(10, 10, 1)).toEqual([1, '...', 6, 7, 8, 9, 10]);
    expect(generatePageRange(8, 10, 1)).toEqual([1, '...', 6, 7, 8, 9, 10]);
  });

  it('shows both ellipses in the middle', () => {
    expect(generatePageRange(5, 10, 1)).toEqual([1, '...', 4, 5, 6, '...', 10]);
  });

  it('honours siblingCount 2', () => {
    expect(generatePageRange(6, 12, 2)).toEqual([1, '...', 4, 5, 6, 7, 8, '...', 12]);
  });

  it('honours siblingCount 0', () => {
    expect(generatePageRange(5, 10, 0)).toEqual([1, '...', 5, '...', 10]);
  });

  it('handles one page and two pages', () => {
    expect(generatePageRange(1, 1, 1)).toEqual([1]);
    expect(generatePageRange(2, 2, 1)).toEqual([1, 2]);
  });

  it('is empty for no pages', () => {
    expect(generatePageRange(1, 0, 1)).toEqual([]);
  });
});

describe('coercions', () => {
  it('coercePageSize: a positive whole number; non-finite is 10', () => {
    expect(coercePageSize(25)).toBe(25);
    expect(coercePageSize(0)).toBe(1);
    expect(coercePageSize(-5)).toBe(1);
    expect(coercePageSize(2.7)).toBe(2);
    expect(coercePageSize(Number.NaN)).toBe(10);
    expect(coercePageSize(Infinity)).toBe(10);
  });

  it('coerceStep: a whole number of at least 1, else 1', () => {
    expect(coerceStep(5)).toBe(5);
    expect(coerceStep(0)).toBe(1);
    expect(coerceStep(-2)).toBe(1);
    expect(coerceStep(1.5)).toBe(1);
    expect(coerceStep(Number.NaN)).toBe(1);
  });

  it('coerceSiblingCount: a non-negative whole number, else 1', () => {
    expect(coerceSiblingCount(2)).toBe(2);
    expect(coerceSiblingCount(0)).toBe(0);
    expect(coerceSiblingCount(-1)).toBe(1);
    expect(coerceSiblingCount(Number.NaN)).toBe(1);
  });

  it('resolveTotalPages: items win, then pages, else unknown', () => {
    expect(resolveTotalPages(95, undefined, 10)).toBe(10);
    expect(resolveTotalPages(95, 3, 10)).toBe(10);
    expect(resolveTotalPages(undefined, 7, 10)).toBe(7);
    expect(resolveTotalPages(undefined, undefined, 10)).toBeUndefined();
    expect(resolveTotalPages(0, undefined, 10)).toBe(0);
  });
});
