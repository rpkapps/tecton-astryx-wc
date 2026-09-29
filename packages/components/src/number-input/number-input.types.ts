/** Field heights: `sm`, `md` and `lg`. */
export const NUMBER_INPUT_SIZES = ['sm', 'md', 'lg'] as const;
export type NumberInputSize = (typeof NUMBER_INPUT_SIZES)[number];

/** Formats the committed value for display while the field is not being edited. */
export type NumberFormatter = (value: number) => string;
