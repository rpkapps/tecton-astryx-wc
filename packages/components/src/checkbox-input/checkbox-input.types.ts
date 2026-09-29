/** Control size of a checkbox or switch: a 24px (`md`) or 20px (`sm`) box, and the row it sits in. */
export const TOGGLE_SIZES = ['sm', 'md'] as const;
export type ToggleSize = (typeof TOGGLE_SIZES)[number];
