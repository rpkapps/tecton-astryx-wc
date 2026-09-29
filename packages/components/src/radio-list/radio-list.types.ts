/** Layout of the options: stacked (`vertical`) or in a wrapping row (`horizontal`). */
export const RADIO_LIST_ORIENTATIONS = ['vertical', 'horizontal'] as const;
export type RadioListOrientation = (typeof RADIO_LIST_ORIENTATIONS)[number];

/** Size of the radios: a 24px (`md`) or 20px (`sm`) circle. */
export const RADIO_LIST_SIZES = ['sm', 'md'] as const;
export type RadioListSize = (typeof RADIO_LIST_SIZES)[number];
