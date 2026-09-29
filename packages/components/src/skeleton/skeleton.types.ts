/** Radius scale (upstream `SkeletonRadius`): a numeric step, `none`, or fully `rounded` (avatars, pills). */
export const SKELETON_RADII = ['none', 0, 1, 2, 3, 4, 'rounded'] as const;

export type SkeletonRadius = (typeof SKELETON_RADII)[number];
