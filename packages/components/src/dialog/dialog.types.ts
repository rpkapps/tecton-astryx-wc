import type {ChangeReason} from '@tecton-astryx/core/events/tct-event.js';

export const DIALOG_VARIANTS = ['standard', 'fullscreen'] as const;
/** `standard` is a centred surface with a configurable size; `fullscreen` takes the whole viewport. */
export type DialogVariant = (typeof DIALOG_VARIANTS)[number];

export const DIALOG_PURPOSES = ['required', 'form', 'info'] as const;
/**
 * What may dismiss a dialog:
 * `required` nothing (a mandatory flow: no Escape, no backdrop press, no close button),
 * `form` Escape only (a backdrop press could lose the user's input),
 * `info` Escape and a press on the backdrop.
 */
export type DialogPurpose = (typeof DIALOG_PURPOSES)[number];

/** Spacing steps of the design scale that `padding` accepts. */
export const DIALOG_PADDINGS = [0, 0.5, 1, 1.5, 2, 3, 4, 5, 6, 8, 10] as const;
export type DialogPadding = (typeof DIALOG_PADDINGS)[number];

export const DIALOG_END_COMPENSATIONS = ['inline', 'block', 'all'] as const;
/** Which edges of a dialog header's end slot are pulled in to align its buttons with the title. */
export type DialogEndCompensation = (typeof DIALOG_END_COMPENSATIONS)[number];

/**
 * Static position of a dialog on screen (centred when not given). The inline offsets are logical:
 * `start` and `end` mirror in right-to-left. Numbers are px, strings are CSS lengths.
 */
export interface DialogPosition {
  top?: number | string;
  bottom?: number | string;
  /** Inline-start offset (`inset-inline-start`); mirrors in RTL. */
  start?: number | string;
  /** Inline-end offset (`inset-inline-end`); mirrors in RTL. */
  end?: number | string;
}

/** Why a dialog asks to close, as `tct-open-change` reports it. */
export type DialogCloseReason = Extract<
  ChangeReason,
  'escape' | 'outside' | 'close-button' | 'close-watcher' | 'request' | 'trigger'
>;
