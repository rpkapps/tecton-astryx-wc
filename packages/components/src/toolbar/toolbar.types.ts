/** Keyboard axis of the toolbar: which arrow keys move focus. */
export const TOOLBAR_ORIENTATIONS = ['horizontal', 'vertical'] as const;
export type ToolbarOrientation = (typeof TOOLBAR_ORIENTATIONS)[number];

/** Surface behind the toolbar. Upstream `SectionVariant` values a toolbar makes sense with. */
export const TOOLBAR_VARIANTS = ['transparent', 'section', 'muted'] as const;
export type ToolbarVariant = (typeof TOOLBAR_VARIANTS)[number];

/** Sides that draw a divider rule. Logical: `top`/`bottom` are block edges, `start`/`end` inline edges. */
export const TOOLBAR_DIVIDERS = ['top', 'bottom', 'start', 'end'] as const;
export type ToolbarDivider = (typeof TOOLBAR_DIVIDERS)[number];

/** The spacing scale steps (upstream `SpacingStep`). */
export const TOOLBAR_GAPS = [0, 0.5, 1, 1.5, 2, 3, 4, 5, 6, 8, 10] as const;
export type ToolbarGap = (typeof TOOLBAR_GAPS)[number];
