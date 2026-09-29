/** Whether a group keeps one button pressed (clicking the pressed one releases it) or any number. */
export const TOGGLE_BUTTON_GROUP_TYPES = ['single', 'multiple'] as const;
export type ToggleButtonGroupType = (typeof TOGGLE_BUTTON_GROUP_TYPES)[number];

/** Layout axis of a group of toggle buttons. */
export const TOGGLE_BUTTON_GROUP_ORIENTATIONS = ['horizontal', 'vertical'] as const;
export type ToggleButtonGroupOrientation = (typeof TOGGLE_BUTTON_GROUP_ORIENTATIONS)[number];

/** Resting shadow depth for a floating toggle button (upstream `Elevation`). */
export const TOGGLE_BUTTON_ELEVATIONS = ['none', 'low', 'med', 'high'] as const;
export type ToggleButtonElevation = (typeof TOGGLE_BUTTON_ELEVATIONS)[number];
