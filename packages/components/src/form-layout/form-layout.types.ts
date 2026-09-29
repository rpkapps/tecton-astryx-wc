import type {FormLayoutDirection, FormOptionality} from '@tecton-astryx/core/context/keys.js';

export type {FormLayoutDirection, FormOptionality};

/**
 * How the fields are arranged: `vertical` (default) stacks them top to bottom, `horizontal` puts
 * them side by side in equal columns, and `horizontal-labels` puts every label to the left of its
 * control in a two-column grid.
 */
export const FORM_LAYOUT_DIRECTIONS = ['vertical', 'horizontal', 'horizontal-labels'] as const;

/** The state the form treats as its default, so only the exception carries an indicator. */
export const FORM_OPTIONALITIES = ['optional', 'required'] as const;
