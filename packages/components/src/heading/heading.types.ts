/** Heading level (upstream `HeadingLevel`): the semantic level and, unless `type` is set, the visual step. */
export const HEADING_LEVELS = [1, 2, 3, 4, 5, 6] as const;
export type HeadingLevel = (typeof HEADING_LEVELS)[number];

/** Built-in display types for headings (upstream `HeadingTypeMap`). */
export const HEADING_TYPES = ['display-1', 'display-2', 'display-3'] as const;

/**
 * A heading visual type: `display-1..3`, or a custom string you style through `::part(text)`. A custom
 * type keeps the level baseline until your CSS styles it.
 */
export type HeadingType = (typeof HEADING_TYPES)[number] | (string & {});
