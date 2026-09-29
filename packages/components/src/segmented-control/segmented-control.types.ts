/** How segments are sized: hug their content, or stretch equally to fill the container. */
export const SEGMENTED_CONTROL_LAYOUTS = ['hug', 'fill'] as const;
export type SegmentedControlLayout = (typeof SEGMENTED_CONTROL_LAYOUTS)[number];
