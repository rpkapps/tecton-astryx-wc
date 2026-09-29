/** Field heights: `sm`, `md` and `lg` change the inner padding; the height is set by `rows`. */
export const TEXT_AREA_SIZES = ['sm', 'md', 'lg'] as const;
export type TextAreaSize = (typeof TEXT_AREA_SIZES)[number];

/**
 * How far into the limit the counter is: `under`, `near` (80% and beyond, announced once) or `over`
 * (announced assertively once).
 */
export type CounterZone = 'under' | 'near' | 'over';

/** Fraction of `maxlength` at which the counter starts speaking. */
export const COUNTER_WARNING_THRESHOLD = 0.8;

/**
 * The number of user-perceived characters (grapheme clusters): an emoji, a flag or an accented letter
 * built from combining marks counts as one. Falls back to code points without `Intl.Segmenter`.
 */
export function characterCount(value: string): number {
  if (value === '') return 0;
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    let count = 0;
    for (const _ of new Intl.Segmenter(undefined, {granularity: 'grapheme'}).segment(value))
      count++;
    return count;
  }
  return [...value].length;
}
