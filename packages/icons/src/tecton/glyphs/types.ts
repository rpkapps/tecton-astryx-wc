/**
 * Authored source, part of the Tecton domain icon set (D-013 Q-02). Supplied by the owner as part of
 * Tecton: copied from rpkapps/tecton-webcomponents, branch claude/busy-johnson-0wz57h,
 * packages/wc/src/icons/types.ts, source commit 8b119b84ec4b912eceebb9f220218346596c6407 (see
 * ./SOURCE-COMMIT and ../README.md). Only formatting differs from the original. It is converted to an
 * IconDefinition by tools/icons/extract-tecton.ts (`pnpm generate`); do not edit the glyph data here
 * without updating the provenance.
 */
/** Glyph style of a Tecton icon. */
export type TectonIconVariant = 'outlined' | 'filled';

/** One Tecton domain icon: SVG markup for both variants on a shared viewBox. */
export interface TectonIconData {
  /** kebab-case name, used as `<tec-icon name="…">`. */
  name: string;
  /** Human-readable name ("Drill Bit"). */
  label: string;
  /** What the glyph depicts (for galleries and search). */
  description: string;
  /** SVG viewBox shared by both variants (optically cropped from the 16-unit source grid). */
  viewBox: string;
  /** Multi-colour glyph: keeps its own colours instead of `currentColor`. */
  colored?: boolean;
  /** Inner SVG markup of the outlined variant (fills inherit `currentColor`). */
  outlined: string;
  /** Inner SVG markup of the filled variant. */
  filled: string;
}
