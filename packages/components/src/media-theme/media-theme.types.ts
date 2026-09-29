/** The surface luminance context: a side, `auto` (measure the painted surface) or `off` (none). */
export const MEDIA_THEME_MODES = ['dark', 'light', 'auto', 'off'] as const;
export type MediaThemeMode = (typeof MEDIA_THEME_MODES)[number];

/** Which side `mode="auto"` uses while the surface cannot be measured. */
export const MEDIA_THEME_FALLBACKS = ['dark', 'light'] as const;
export type MediaThemeFallback = (typeof MEDIA_THEME_FALLBACKS)[number];

/** The attribute the token pipeline's `[data-media-theme]` blocks (and generated theme CSS) target. */
export const MEDIA_THEME_ATTRIBUTE = 'data-media-theme';
