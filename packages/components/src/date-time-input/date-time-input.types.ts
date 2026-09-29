/** Minutes the arrow keys of the time part step by. */
export const DATE_TIME_INCREMENTS = [1, 5, 10, 15, 30] as const;
export type DateTimeIncrement = (typeof DATE_TIME_INCREMENTS)[number];

/** Minutes between the times of the optional dropdown of preset times. */
export const DATE_TIME_OPTION_INTERVALS = [5, 10, 15, 30, 60] as const;
export type DateTimeOptionInterval = (typeof DATE_TIME_OPTION_INTERVALS)[number];
