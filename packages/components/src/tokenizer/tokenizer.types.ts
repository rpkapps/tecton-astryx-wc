/**
 * How tokens behave when they do not fit the field's width:
 * `none` wraps them onto more rows; `unfocused-inline` keeps one row with a "+N more" indicator while the
 * field is not focused and expands inline on focus; `unfocused-layer` does the same but expands over the
 * content below in a layer, so the page does not move.
 */
export const TOKEN_OVERFLOW_BEHAVIORS = ['none', 'unfocused-inline', 'unfocused-layer'] as const;
export type TokenOverflowBehavior = (typeof TOKEN_OVERFLOW_BEHAVIORS)[number];

/** Separators of a pasted list: line breaks, tabs, commas and semicolons. */
export const PASTE_SEPARATORS = /[\n\r\t,;]+/;
