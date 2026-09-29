/** Which side of the label the disclosure chevron sits on (logical: it follows the writing direction). */
export const COLLAPSIBLE_CHEVRON_POSITIONS = ['start', 'end'] as const;
export type CollapsibleChevronPosition = (typeof COLLAPSIBLE_CHEVRON_POSITIONS)[number];

/** Row density of a group's items: trigger and content block padding. Shared with tables and lists. */
export const COLLAPSIBLE_DENSITIES = ['compact', 'balanced', 'spacious'] as const;
export type CollapsibleDensity = (typeof COLLAPSIBLE_DENSITIES)[number];

/** Whether a group keeps one item open at a time, or any number. */
export const COLLAPSIBLE_GROUP_TYPES = ['single', 'multiple'] as const;
export type CollapsibleGroupType = (typeof COLLAPSIBLE_GROUP_TYPES)[number];
