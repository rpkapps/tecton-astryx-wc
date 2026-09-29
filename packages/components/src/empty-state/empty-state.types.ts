/** Semantic heading levels for the title; the visual size does not change with the level. */
export const EMPTY_STATE_HEADING_LEVELS = [1, 2, 3, 4, 5, 6] as const;

export type EmptyStateHeadingLevel = (typeof EMPTY_STATE_HEADING_LEVELS)[number];
