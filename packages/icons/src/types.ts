/**
 * Icon data shapes, exactly as ARCHITECTURE §12 specifies them.
 *
 * `IconDefinition` is owned by core (`@tecton-wc/core/icons/registry.js`). The icons package has
 * no dependency on core (A§2.2: icons depends on nothing), so this is a structurally identical local
 * copy; the two must stay in sync, and TypeScript's structural typing lets a registry accept either.
 * Reconcile when core's registry lands: replace this file's `IconDefinition` by an `import type`
 * from core if the orchestrator adds the dependency, or keep the copy and add a type-level test.
 *
 * D-013 Q-02 adds one optional field, `svg` (below), to A§12's shape: the Tecton `strata` glyph paints a
 * CSS conic gradient that paths cannot express. The core registry owner mirrors the field (see the
 * hand-off report and ARCHITECTURE §12).
 */

export interface IconDefinition {
  /** e.g. `'0 0 24 24'` */
  viewBox: string;
  paths: readonly {d: string; fillRule?: 'evenodd' | 'nonzero'}[];
  /** `stroke`: the stroke width comes from `strokeWidth` (overridable through `--icon-stroke-width`). */
  mode: 'fill' | 'stroke';
  strokeWidth?: number;
  /** Chevrons, arrows: mirrored in right-to-left contexts. */
  mirrorInRtl?: boolean;
  /** The glyph carries colours of its own (it does not simply inherit `currentColor`). */
  colored?: boolean;
  /**
   * Optional raw SVG body (inner markup, no `<svg>` wrapper) for glyphs that `paths` cannot express
   * (per-shape colours, D-013 Q-02). It replaces `paths` when present; `paths` stays as the single-colour
   * outline for renderers that ignore `svg`. Restricted to `<path>` elements with `d`, `fill`
   * (a colour or `currentColor`) and `fill-rule` attributes: no `<defs>`, ids, `url()` references, `style`
   * or `<foreignObject>`. The registry still runs it through the sanitiser once at registration (A§12,
   * `sanitizeHtml(..., {svg: true})`) and clones the result per instance; it is never trusted as-is.
   */
  svg?: string;
}

/** Lazy definition, as accepted by `registerIcons`. */
export type IconLoader = () => Promise<IconDefinition>;
