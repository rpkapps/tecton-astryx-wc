/** Standard duration representations (upstream `TimerFormat`). */
export const TIMER_FORMATS = ['elapsed', 'clock'] as const;

export type TimerFormat = (typeof TIMER_FORMATS)[number];
