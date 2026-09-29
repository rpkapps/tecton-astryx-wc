/** The direction of the rule: a horizontal rule separates stacked content, a vertical one sits between neighbours. */
export const DIVIDER_ORIENTATIONS = ['horizontal', 'vertical'] as const;
export type DividerOrientation = (typeof DIVIDER_ORIENTATIONS)[number];

/** Visual weight of the rule (colour only; the thickness is the border width in both). */
export const DIVIDER_VARIANTS = ['subtle', 'strong'] as const;
export type DividerVariant = (typeof DIVIDER_VARIANTS)[number];
