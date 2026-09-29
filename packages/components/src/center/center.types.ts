/**
 * Which axes `tct-center` centres on (upstream `CenterAxis`). The values name the flex axes:
 * `horizontal` is the main (inline) axis, `vertical` the cross (block) axis, both in horizontal
 * writing; in vertical writing modes they keep following the flex axes, not the physical names.
 */
export const CENTER_AXES = ['both', 'horizontal', 'vertical'] as const;
export type CenterAxis = (typeof CENTER_AXES)[number];
