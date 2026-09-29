/** Badge variants: five semantic ones (solid fills), and the hue variants (tinted). */
export const BADGE_VARIANTS = [
  'neutral',
  'info',
  'success',
  'warning',
  'error',
  'blue',
  'cyan',
  'green',
  'orange',
  'pink',
  'purple',
  'red',
  'teal',
  'yellow',
] as const;

export type BadgeVariant = (typeof BADGE_VARIANTS)[number];
