// Copyright (c) Meta Platforms, Inc. and affiliates.

/**
 * @file Derived variable registry: maps CSS properties to the public properties a component reads.
 *
 * Adapted from Astryx (MIT). Upstream expands standard CSS properties (borderRadius, padding) into
 * component-internal custom properties (`--_button-radius`) because its target element is not the
 * element that paints. Here the painting element is a shadow part, so a plain property on the part
 * (`tct-button::part(button) {border-radius}`) already reaches it and those private aliases are not
 * emitted. What remains are the container components, which publish their padding as public
 * `--<component>-padding*` properties so descendants that bleed to the edge (`tct-divider
 * full-bleed`, a nested `tct-section`) can read it (A§6.3).
 *
 * Adding a component with a derived var: add its entry here, and admit the properties on the
 * element with `@cssprop`.
 */

export interface DerivedVarEntry {
  /** The standard CSS property name (camelCase) that theme authors write. */
  property: string;
  /** Internal CSS custom property names to set. Omit when using `expand`. */
  vars?: string[];
  /** Named expansion strategy. 'container' expands padding to container tokens. */
  expand?: 'container';
  /**
   * Emit only the internal `vars`, dropping the source property from the rule. Use when the part must
   * not receive the standard property itself because a child consumes the value through the var.
   */
  replaces?: boolean;
}

/**
 * Component to derived var mappings. Keys are component keys (the Astryx target minus `astryx-`).
 * Values are ordered arrays: earlier entries emit first when several share a property.
 */
export const derivedVarRegistry: Record<string, DerivedVarEntry[]> = {
  card: [{property: 'padding', expand: 'container'}],
  dialog: [{property: 'padding', expand: 'container'}],
  'number-input': [{property: 'padding', expand: 'container'}],
  section: [{property: 'padding', expand: 'container'}],
};

/** Looks up the derived var entries for a component key and CSS property, in priority order. */
export function getDerivedVars(component: string, property: string): DerivedVarEntry[] {
  return (derivedVarRegistry[component] ?? []).filter((entry) => entry.property === property);
}
