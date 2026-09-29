/**
 * Button variants: the four upstream emphases plus the two Tecton ones (`outlined` and `text-only`,
 * the owner's React theme `ButtonVariantMap`). `ghost` carries Tecton's tertiary emphasis.
 */
export const BUTTON_VARIANTS = [
  'primary',
  'secondary',
  'ghost',
  'destructive',
  'outlined',
  'text-only',
] as const;
export type ButtonVariant = (typeof BUTTON_VARIANTS)[number];

export const BUTTON_SIZES = ['sm', 'md', 'lg'] as const;
export type ButtonSize = (typeof BUTTON_SIZES)[number];

/** Resting shadow depth for floating buttons (upstream `Elevation`). */
export const BUTTON_ELEVATIONS = ['none', 'low', 'med', 'high'] as const;
export type ButtonElevation = (typeof BUTTON_ELEVATIONS)[number];

export const BUTTON_TYPES = ['button', 'submit', 'reset'] as const;
export type ButtonType = (typeof BUTTON_TYPES)[number];

/** What `clickAction` receives and may return: a promise keeps the button busy until it settles. */
export type ButtonClickAction = (event: MouseEvent) => void | Promise<void>;
