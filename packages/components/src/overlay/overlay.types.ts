export const OVERLAY_SHOW_ON = ['always', 'hover', 'focus', 'hover-or-focus'] as const;
export const OVERLAY_SCRIMS = ['dark', 'light', 'none'] as const;
export const OVERLAY_POSITIONS = ['fill', 'bottom', 'top'] as const;
export const OVERLAY_ALIGNMENTS = ['start', 'center', 'end'] as const;

/** When the overlay content shows: always, on hover (and focus), on focus only. `hover-or-focus` is an alias of `hover`. */
export type OverlayShowOn = (typeof OVERLAY_SHOW_ON)[number];
/** Scrim mode: a dark or light wash behind the content (which is inverted to stay legible), or `none`. */
export type OverlayScrim = (typeof OVERLAY_SCRIMS)[number];
/** Where the scrim sits on the base content: filling it, or a strip at the block end or start. */
export type OverlayPosition = (typeof OVERLAY_POSITIONS)[number];
/** Alignment of the content inside the scrim. */
export type OverlayAlignment = (typeof OVERLAY_ALIGNMENTS)[number];
