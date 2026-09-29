/**
 * Icon data shapes, exactly as ARCHITECTURE §12 specifies them.
 *
 * `IconDefinition` is owned by core (`@tecton-astryx/core/icons/registry.js`). The icons package has
 * no dependency on core (A§2.2: icons depends on nothing), so this is a structurally identical local
 * copy; the two must stay in sync, and TypeScript's structural typing lets a registry accept either.
 * Reconcile when core's registry lands: replace this file's `IconDefinition` by an `import type`
 * from core if the orchestrator adds the dependency, or keep the copy and add a type-level test.
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
  /** The glyph does not inherit `currentColor`. */
  colored?: boolean;
}

/** Lazy definition, as accepted by `registerIcons`. */
export type IconLoader = () => Promise<IconDefinition>;
