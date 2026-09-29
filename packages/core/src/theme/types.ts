/**
 * Types shared by the theme utilities (upstream `theme/types.ts`, adapted from Astryx, MIT). The text
 * and prose vocabulary (`TextType`, `TextColor`, …) belongs to `tct-text` and `tct-heading` and lives in
 * their folders.
 */

/**
 * Named font weight: maps to `var(--font-weight-*)` at the token layer. Raw CSS values (`'800'`) are
 * accepted as an escape hatch.
 */
export type FontWeight = 'normal' | 'medium' | 'semibold' | 'bold' | (string & {});

/**
 * A typography role declaration (body, heading or code).
 *
 * Fonts must be loaded by the application (a `<link>` or `@import`, or `fonts.css` from the tokens
 * package). The theme only sets the font-family token, so the font is used once it is available.
 *
 * ```ts
 * body: {family: 'Figtree', fallbacks: 'Helvetica, Arial, sans-serif', weight: 'normal'}
 * ```
 */
export interface TypographyRole {
  /** Primary font name; the application loads it. */
  family?: string;
  /** CSS fallback stack, appended after the family in the computed `--font-family-*` token. */
  fallbacks?: string;
  /** Default font weight for the role. */
  weight?: FontWeight;
  /** Per-level weight overrides (heading only; keys are heading levels 1 to 6). */
  weights?: Partial<Record<1 | 2 | 3 | 4 | 5 | 6, FontWeight>>;
}

/**
 * Unified typography configuration: `scale` controls the geometric type scale (base size and ratio);
 * `body`, `heading` and `code` declare fonts, fallbacks and weights per role. `heading` inherits family
 * and fallbacks from `body` when it declares none.
 */
export interface TypographyConfig {
  /** Type scale: generates the text size tokens from a base and a ratio. */
  scale?: {base: number; ratio: number};
  /** Body text font. */
  body?: TypographyRole;
  /** Heading font. Inherits family and fallbacks from `body` if omitted. */
  heading?: TypographyRole;
  /** Code and monospace font. */
  code?: TypographyRole;
}

/** The colour mode of a theme island: `system` follows the operating system preference. */
export type ThemeMode = 'system' | 'light' | 'dark';

/**
 * A syntax highlighting theme as `defineTheme` reads it: a name and the resolved `--color-syntax-*`
 * values, keyed without the prefix (`keyword`, `string`, …). `tct-syntax-theme` and its
 * `defineSyntaxTheme` produce this shape.
 */
export interface SyntaxThemeDefinition {
  name: string;
  /** Resolved values (`light-dark()` strings), keyed by the token suffix. */
  tokens: Readonly<Record<string, string>>;
}
