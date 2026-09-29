/**
 * Background variants. `default` is the standard card surface with a border; `transparent` and
 * `muted` are the neutral alternatives; the colour names paint the matching
 * `--color-background-<name>` token (for categorisation, not status).
 */
export const CARD_VARIANTS = [
  'default',
  'transparent',
  'muted',
  'blue',
  'cyan',
  'gray',
  'green',
  'orange',
  'pink',
  'purple',
  'red',
  'teal',
  'yellow',
] as const;
export type CardVariant = (typeof CARD_VARIANTS)[number];

/** Resting shadow depth: `none` (flat), then the `--shadow-low`, `--shadow-med` and `--shadow-high` tokens. */
export const CARD_ELEVATIONS = ['none', 'low', 'med', 'high'] as const;
export type CardElevation = (typeof CARD_ELEVATIONS)[number];
