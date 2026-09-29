/** One entry of an outline (upstream `OutlineItem`). */
export interface OutlineItem {
  /** Unique id, matching the target heading's `id`. */
  id: string;
  /** Display text. */
  label: string;
  /** Heading depth from 1 to 6; controls the indentation (levels 2 to 5 and beyond share four steps). */
  level: number;
}

/** `default`: standard item padding. `compact`: reduced padding for dense UIs. */
export const OUTLINE_DENSITIES = ['default', 'compact'] as const;
export type OutlineDensity = (typeof OUTLINE_DENSITIES)[number];
