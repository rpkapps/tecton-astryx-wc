import type {ThemeMode} from '@tecton-astryx/core/theme/types.js';

/** Colour modes (upstream `ThemeMode`): `system` follows the operating system preference. */
export const THEME_MODES = ['light', 'dark', 'system'] as const;

// One name, one declaration: the CEM type-values table resolves an alias by name across the packages,
// and core/theme declares the same union (`ThemeMode`), so this re-exports it instead of redeclaring.
export type {ThemeMode};

/** The theme the library ships (D-013): the Tecton tokens in `tokens.css`. */
export const DEFAULT_THEME = 'tecton';

/**
 * A theme, by name or as any object that has one. Runtime-defined themes (`defineTheme()`, the
 * `core/theme` utilities) are wired to this property when that module lands; until then only the
 * name is used, and `tokens.css` supplies the values.
 */
export type ThemeInput = string | {readonly name: string};

/** The theme name for a `theme` value; an empty or missing value is the default theme. */
export function themeName(theme: ThemeInput | null | undefined): string {
  const name = typeof theme === 'string' ? theme : theme?.name;
  return name?.trim() || DEFAULT_THEME;
}
