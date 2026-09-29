/** Enumerations of `tct-hover-card`. Placement and alignment are shared with `tct-popover`. */
export {
  POPOVER_ALIGNMENTS as HOVER_CARD_ALIGNMENTS,
  POPOVER_PLACEMENTS as HOVER_CARD_PLACEMENTS,
  type PopoverAlignment as HoverCardAlignment,
  type PopoverPlacement as HoverCardPlacement,
} from '../popover/popover.types.js';

export const HOVER_CARD_FOCUS_TRIGGERS = ['auto', 'always', 'never'] as const;
export const HOVER_CARD_TOUCH_TRIGGERS = ['auto', 'tap', 'none'] as const;
export const HOVER_CARD_INDICATIONS = ['auto', 'always', 'never'] as const;

/** When keyboard focus on the trigger opens the card: only if it is focusable (`auto`), always, or never. */
export type HoverCardFocusTrigger = (typeof HOVER_CARD_FOCUS_TRIGGERS)[number];
/** What a tap does where there is no hover. */
export type HoverCardTouchTrigger = (typeof HOVER_CARD_TOUCH_TRIGGERS)[number];
/** Dashed underline on the trigger: for text-only triggers (`auto`), always, or never. */
export type HoverCardIndication = (typeof HOVER_CARD_INDICATIONS)[number];
