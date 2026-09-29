/** The axis a handle resizes along: `horizontal` drags a vertical divider sideways, `vertical` a horizontal one up and down. */
export const RESIZE_DIRECTIONS = ['horizontal', 'vertical'] as const;
export type ResizeDirection = (typeof RESIZE_DIRECTIONS)[number];

/** `inline` puts the handle in the flow between its siblings; `overlay` positions it inside a parent panel. */
export const RESIZE_POSITIONS = ['inline', 'overlay'] as const;
export type ResizePosition = (typeof RESIZE_POSITIONS)[number];

/** Which side of the divider the grip pill sits on; `auto` is the panel side and flips while the panel is collapsed. */
export const RESIZE_PILL_PLACEMENTS = ['start', 'end', 'center', 'auto'] as const;
export type ResizePillPlacement = (typeof RESIZE_PILL_PLACEMENTS)[number];

/** Keyboard step in px, and the step with Shift held. */
export const RESIZE_KEYBOARD_STEP = 10;
export const RESIZE_KEYBOARD_LARGE_STEP = 50;

/**
 * Which side the pill actually sits on. `auto` is the side of the panel the handle resizes (the start
 * side unless `reversed`) and flips to the other while the panel is collapsed, so the grip stays
 * visible and reachable.
 */
export function resolvePillSide(
  placement: ResizePillPlacement,
  reversed: boolean,
  collapsed: boolean,
): 'start' | 'end' | 'center' {
  if (placement !== 'auto') return placement;
  const panelSide = reversed ? 'end' : 'start';
  if (collapsed) return panelSide === 'start' ? 'end' : 'start';
  return panelSide;
}
