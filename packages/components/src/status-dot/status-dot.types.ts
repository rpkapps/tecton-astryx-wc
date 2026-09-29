/** Colour roles (upstream `StatusDotVariant`). */
export const STATUS_DOT_VARIANTS = ['success', 'warning', 'error', 'accent', 'neutral'] as const;

export type StatusDotVariant = (typeof STATUS_DOT_VARIANTS)[number];
