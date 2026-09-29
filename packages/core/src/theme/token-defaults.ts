/**
 * The token defaults a theme resolves against (upstream `tokens.stylex.ts` defaults merged into
 * `tokenDefaults`). The upstream system ships its defaults as TypeScript constants; here the values live in one
 * place, the token pipeline (`@tecton-astryx/tokens`, `tokens.css`), and this module is the seam that
 * lets the runtime theme code see them without `core` depending on the tokens package.
 *
 * `tokenDefaults` starts empty. Register the pipeline's metadata once, before resolving tokens:
 *
 * ```ts
 * import {tokens} from '@tecton-astryx/tokens/tokens.js';
 * registerTokenDefaults(tokenDefaultsFromMetadata(tokens));
 * ```
 *
 * A theme does not need defaults to generate CSS: a `DefinedTheme` carries only the tokens it
 * overrides, and the page's `tokens.css` supplies the rest. Defaults are used by the checks that
 * compare against the full set (theme-local names must not collide with a portable token) and by
 * `resolveThemeTokens`.
 */

/** A default: a CSS value, or a `[light, dark]` pair. */
export type TokenDefaultValue = string | readonly [light: string, dark: string];

/** The token metadata shape the pipeline emits (`tokens.js`): only the resolved values are read. */
export interface TokenMetadataLike {
  readonly light: string;
  readonly dark: string;
}

/** Every registered default as a flat map of token name to CSS value (`light-dark()` for pairs). */
export const tokenDefaults: Record<string, string> = {};

function cssValue(value: TokenDefaultValue): string {
  return typeof value === 'string' ? value : `light-dark(${value[0]}, ${value[1]})`;
}

/** Adds (or replaces) defaults. A pair becomes `light-dark(light, dark)`. */
export function registerTokenDefaults(defaults: Readonly<Record<string, TokenDefaultValue>>): void {
  for (const [name, value] of Object.entries(defaults)) tokenDefaults[name] = cssValue(value);
}

/**
 * Converts the pipeline's token metadata (`{name: {light, dark}}`) to defaults: one value where both
 * modes agree, a pair otherwise.
 */
export function tokenDefaultsFromMetadata(
  metadata: Readonly<Record<string, TokenMetadataLike>>,
): Record<string, TokenDefaultValue> {
  const defaults: Record<string, TokenDefaultValue> = {};
  for (const [name, token] of Object.entries(metadata)) {
    defaults[name] = token.light === token.dark ? token.light : [token.light, token.dark];
  }
  return defaults;
}

/** Forgets every registered default. Test-only. */
export function resetTokenDefaults(): void {
  for (const name of Object.keys(tokenDefaults)) delete tokenDefaults[name];
}
