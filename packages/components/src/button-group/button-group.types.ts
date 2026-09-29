/** Orientation of a button group: the axis the members are laid out on and the arrows that move focus. */
export const BUTTON_GROUP_ORIENTATIONS = ['horizontal', 'vertical'] as const;
export type ButtonGroupOrientation = (typeof BUTTON_GROUP_ORIENTATIONS)[number];

/** Resting shadow depth of a group of buttons that floats above content. */
export const BUTTON_GROUP_ELEVATIONS = ['none', 'low', 'med', 'high'] as const;
export type ButtonGroupElevation = (typeof BUTTON_GROUP_ELEVATIONS)[number];
