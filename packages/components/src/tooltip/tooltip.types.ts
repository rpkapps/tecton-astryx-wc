import type {Alignment, Placement} from '@tecton-astryx/core/layer/position.js';

export const TOOLTIP_PLACEMENTS = [
  'above',
  'below',
  'start',
  'end',
] as const satisfies readonly Placement[];
export const TOOLTIP_ALIGNMENTS = [
  'start',
  'center',
  'end',
] as const satisfies readonly Alignment[];
/** When keyboard focus opens the tooltip: `auto` only for a naturally focusable trigger. */
export const TOOLTIP_FOCUS_TRIGGERS = ['auto', 'always', 'never'] as const;
export type TooltipFocusTrigger = (typeof TOOLTIP_FOCUS_TRIGGERS)[number];
/** What a tap does on a touch pointer: `auto` opens unless the trigger acts, `tap` always opens, `none` never. */
export const TOOLTIP_TOUCH_TRIGGERS = ['auto', 'tap', 'none'] as const;
export type TooltipTouchTrigger = (typeof TOOLTIP_TOUCH_TRIGGERS)[number];
/** The dashed underline that marks a text-only trigger: `auto` for text-only triggers, or always/never. */
export const TOOLTIP_HOVER_INDICATIONS = ['auto', 'always', 'never'] as const;
export type TooltipHoverIndication = (typeof TOOLTIP_HOVER_INDICATIONS)[number];
export type {Alignment as TooltipAlignment, Placement as TooltipPlacement};
