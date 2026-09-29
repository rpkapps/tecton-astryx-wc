/** Whether a group keeps one button pressed (clicking the pressed one releases it) or any number. */
export const TOGGLE_BUTTON_GROUP_TYPES = ['single', 'multiple'] as const;
export type ToggleButtonGroupType = (typeof TOGGLE_BUTTON_GROUP_TYPES)[number];

/** Layout axis of a group of toggle buttons. */
export const TOGGLE_BUTTON_GROUP_ORIENTATIONS = ['horizontal', 'vertical'] as const;
export type ToggleButtonGroupOrientation = (typeof TOGGLE_BUTTON_GROUP_ORIENTATIONS)[number];
