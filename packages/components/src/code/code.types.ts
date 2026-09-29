/** Text colour of inline code: the primary or secondary text role, or whatever the surrounding text is (`inherit`). */
export const CODE_COLORS = ['primary', 'secondary', 'inherit'] as const;
export type CodeColor = (typeof CODE_COLORS)[number];

/** `inherit` adopts the surrounding text's font size and line height instead of the code size. */
export const CODE_SIZES = ['inherit'] as const;
export type CodeSize = (typeof CODE_SIZES)[number];
