/** Background variant: `section` (the surface colour, default), `transparent` or `muted`. */
export const SECTION_VARIANTS = ['section', 'transparent', 'muted'] as const;
export type SectionVariant = (typeof SECTION_VARIANTS)[number];

/** The sides that can carry a divider rule. `start` and `end` are logical (they follow the direction). */
export const SECTION_DIVIDERS = ['top', 'bottom', 'start', 'end'] as const;
export type SectionDivider = (typeof SECTION_DIVIDERS)[number];

/** Parses `dividers="top bottom"` (space or comma separated), dropping anything that is not a side. */
export function parseSectionDividers(value: string | null): SectionDivider[] | undefined {
  if (value === null) return undefined;
  const found = value
    .split(/[\s,]+/)
    .filter((item): item is SectionDivider =>
      (SECTION_DIVIDERS as readonly string[]).includes(item),
    );
  return found.length > 0 ? [...new Set(found)] : undefined;
}
