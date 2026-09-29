export const SAMPLE_BADGE_VARIANTS = ['neutral', 'info', 'success', 'warning', 'error'] as const;
export type SampleBadgeVariant = (typeof SAMPLE_BADGE_VARIANTS)[number];

export type SampleBadgeSize = 'sm' | 'md';
