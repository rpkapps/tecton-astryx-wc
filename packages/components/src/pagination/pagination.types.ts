/**
 * What sits between the previous and next buttons: `pages` page numbers with ellipses, `count` an
 * "X-Y of Z" readout, `compact` a "Page X of Y" readout, `dots` a row of page dots, `input` an editable
 * "Page [ n ] / N" box, `none` nothing.
 */
export const PAGINATION_VARIANTS = ['pages', 'count', 'compact', 'dots', 'input', 'none'] as const;
export type PaginationVariant = (typeof PAGINATION_VARIANTS)[number];

/** Size of the controls. */
export const PAGINATION_SIZES = ['sm', 'md'] as const;
export type PaginationSize = (typeof PAGINATION_SIZES)[number];

/** Runs after the user changed the page; the paginator is busy while a returned promise is pending. */
export type PaginationChangeAction = (page: number) => void | Promise<void>;
