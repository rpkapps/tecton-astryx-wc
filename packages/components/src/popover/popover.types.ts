/** Enumerations shared by the anchored overlays (Popover, HoverCard). */
import type {Alignment, Placement} from '@tecton-astryx/core/layer/position.js';

export const POPOVER_PLACEMENTS = [
  'above',
  'below',
  'start',
  'end',
] as const satisfies readonly Placement[];
export const POPOVER_ALIGNMENTS = [
  'start',
  'center',
  'end',
] as const satisfies readonly Alignment[];
export const POPOVER_ROLES = ['dialog', 'none'] as const;

/** Which side of the trigger the popover opens on (logical: `start`/`end` follow the text direction). */
export type PopoverPlacement = (typeof POPOVER_PLACEMENTS)[number];
/** Alignment along the placement axis. */
export type PopoverAlignment = (typeof POPOVER_ALIGNMENTS)[number];
/** `dialog` stamps `role="dialog"` on the surface; `none` leaves the role to the slotted content. */
export type PopoverRole = (typeof POPOVER_ROLES)[number];
