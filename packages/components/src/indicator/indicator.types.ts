import type {IndicatorFamilyMap, IndicatorSize} from '@tecton-astryx/core/indicators/registry.js';

/** Control size, matching the owning inputs: a 24px (`md`) or 20px (`sm`) box. */
export const INDICATOR_SIZES = ['sm', 'md'] as const;
export type {IndicatorSize};

/** States a single-selection indicator (radio, check mark) can draw. */
export const SINGLE_SELECTION_STATES = ['unchecked', 'checked'] as const;
export type SingleSelectionState = IndicatorFamilyMap['singleSelection'];

/** States a multi-selection indicator (checkbox) can draw, including the partial one. */
export const MULTI_SELECTION_STATES = ['unchecked', 'checked', 'indeterminate'] as const;
export type MultiSelectionState = IndicatorFamilyMap['multiSelection'];
