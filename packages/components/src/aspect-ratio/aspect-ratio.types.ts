/** The box's outline: `rectangle` (default), or `ellipse` (a circle at ratio 1, an oval otherwise). */
export const ASPECT_RATIO_SHAPES = ['rectangle', 'ellipse'] as const;
export type AspectRatioShape = (typeof ASPECT_RATIO_SHAPES)[number];

/** How the content fills the box: crop (`cover`), letterbox (`contain`) or natural size in the middle (`center`). */
export const ASPECT_RATIO_FITS = ['cover', 'contain', 'center'] as const;
export type AspectRatioFit = (typeof ASPECT_RATIO_FITS)[number];

/**
 * The CSS `aspect-ratio` value for `ratio`, or `undefined` when it is not a positive ratio. Accepts a
 * number (`1.7778`, `16 / 9` in a script), a numeric string, or a `w/h` string (`"16/9"`, `"16 / 9"`).
 */
export function toCssRatio(ratio: unknown): string | undefined {
  if (typeof ratio === 'number')
    return Number.isFinite(ratio) && ratio > 0 ? String(ratio) : undefined;
  if (typeof ratio !== 'string') return undefined;
  const text = ratio.trim();
  if (text === '') return undefined;
  const pair = /^(\d*\.?\d+)\s*\/\s*(\d*\.?\d+)$/.exec(text);
  if (pair) {
    const [, width, height] = pair;
    return Number(width) > 0 && Number(height) > 0 ? `${width} / ${height}` : undefined;
  }
  const number = Number(text);
  return Number.isFinite(number) && number > 0 ? String(number) : undefined;
}
