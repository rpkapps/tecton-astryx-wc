/** Which side of the switch its label is on (logical: `start` is the left edge in left-to-right text). */
export const SWITCH_LABEL_POSITIONS = ['start', 'end'] as const;
export type SwitchLabelPosition = (typeof SWITCH_LABEL_POSITIONS)[number];

/** `hug` keeps the switch and its label together; `spread` pushes them to opposite ends of the row. */
export const SWITCH_LABEL_SPACINGS = ['hug', 'spread'] as const;
export type SwitchLabelSpacing = (typeof SWITCH_LABEL_SPACINGS)[number];
