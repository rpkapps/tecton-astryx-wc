import type {DateRange} from '@tecton-wc/core/date/date-types.js';

/** A quick-select range beside the calendar. `getRange` runs each time the picker renders, so "last 7 days" stays current. */
export interface DateRangePreset {
  label: string;
  getRange: () => DateRange;
}

/** The surfaces a range picker takes (there is no native range control): the popover, the bottom sheet, or the popover with a bottom sheet on a compact touch device. */
export const DATE_RANGE_PRESENTATIONS = [
  'popover',
  'bottom-sheet',
  'adaptive-bottom-sheet',
] as const;
export type DateRangePresentation = (typeof DATE_RANGE_PRESENTATIONS)[number];
