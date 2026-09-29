// The step arithmetic is adapted from the upstream design system (MIT); see THIRD-PARTY-NOTICES.md.

/** `horizontal` runs from the inline start to the inline end; `vertical` from the bottom to the top. */
export const SLIDER_ORIENTATIONS = ['horizontal', 'vertical'] as const;
export type SliderOrientation = (typeof SLIDER_ORIENTATIONS)[number];

/** Where the current value is shown: in a bubble over the thumb, as text after the track, or not at all. */
export const SLIDER_VALUE_DISPLAYS = ['tooltip', 'text', 'none'] as const;
export type SliderValueDisplay = (typeof SLIDER_VALUE_DISPLAYS)[number];

/** A tick on the track, with an optional label beneath (or beside, when vertical) it. */
export interface SliderMark {
  value: number;
  label?: string;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Number of decimal places a value carries, including exponent notation (`1e-7` is 7): used to round
 * binary floating-point error away after step arithmetic.
 */
export function decimalPrecision(value: number): number {
  if (Math.abs(value) < 1) {
    const parts = value.toExponential().split('e-');
    if (parts.length === 2) {
      const mantissa = parts[0]?.split('.')[1]?.length ?? 0;
      return mantissa + parseInt(parts[1] ?? '0', 10);
    }
  }
  const fraction = String(value).split('.')[1];
  return fraction ? fraction.length : 0;
}

/** The value snapped to the nearest step counted from `min`, free of floating-point error. */
export function snapToStep(value: number, min: number, step: number): number {
  if (!(step > 0)) return value;
  const snapped = min + Math.round((value - min) / step) * step;
  // `0 + 3 * 0.1` is 0.30000000000000004: a snapped value never has more decimals than min and step do.
  const precision = Math.min(Math.max(decimalPrecision(min), decimalPrecision(step)), 20);
  return Number(snapped.toFixed(precision));
}

/** Where `value` sits between `min` and `max`, in percent. */
export function percentOf(value: number, min: number, max: number): number {
  return max === min ? 0 : ((value - min) / (max - min)) * 100;
}

/**
 * Parses the numbers of a `value` string: `"50"` or `"20,80"` (commas or white space). Anything that is
 * not a number is skipped.
 */
export function parseValues(text: string): number[] {
  return text
    .split(/[\s,]+/)
    .filter((token) => token !== '')
    .map(Number)
    .filter((number) => Number.isFinite(number));
}
