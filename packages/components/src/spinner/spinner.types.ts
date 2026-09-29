/** Spinner sizes (upstream `SpinnerSize`): ring diameter 10, 14, 18 and 28 px. */
export const SPINNER_SIZES = ['sm', 'md', 'lg', 'xl'] as const;
export type SpinnerSize = (typeof SPINNER_SIZES)[number];

/**
 * Colour shades (upstream `SpinnerShade`): `default` (progress accent), `subtle` (secondary text),
 * `on-media` (light on dark or accent backgrounds), `inherit` (the surrounding `currentColor`, for
 * spinners inside coloured controls such as a button).
 */
export const SPINNER_SHADES = ['default', 'subtle', 'on-media', 'inherit'] as const;
export type SpinnerShade = (typeof SPINNER_SHADES)[number];

/** Ring geometry per size, in CSS px: diameter of the ring and stroke width. */
export const SPINNER_GEOMETRY = {
  sm: {diameter: 10, stroke: 2},
  md: {diameter: 14, stroke: 3},
  lg: {diameter: 18, stroke: 3},
  xl: {diameter: 28, stroke: 4},
} as const satisfies Record<SpinnerSize, {diameter: number; stroke: number}>;

/** Fraction of the ring the moving arc covers (upstream `ARC_FRACTION`, 135 degrees). */
export const SPINNER_ARC_FRACTION = 0.375;
