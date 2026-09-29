import type {SharedDateFormat} from '@tecton-wc/core/date/format.js';

/** The named formats a committed date is displayed in. */
export const DATE_INPUT_FORMATS = ['date', 'date_long', 'date_weekday', 'system_date'] as const;
export type DateInputFormat = SharedDateFormat;

/** A custom display: receives the ISO value and returns the text. */
export type DateInputFormatter = (value: string) => string;
