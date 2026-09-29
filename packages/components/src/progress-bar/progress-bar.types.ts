/** Fill colour roles (upstream `ProgressBarVariant`). */
export const PROGRESS_BAR_VARIANTS = ['accent', 'success', 'warning', 'error', 'neutral'] as const;

export type ProgressBarVariant = (typeof PROGRESS_BAR_VARIANTS)[number];

/** A fixed target mark drawn on the track (upstream `ProgressBarMark`). */
export interface ProgressBarMark {
  /** Position in the same `0..max` scale as `value`; values outside the range are clamped to the track edges. */
  value: number;
  /**
   * Names the mark: its accessible name and the text revealed in a tooltip on hover and keyboard focus.
   * A mark stands for something meaningful on the track (a goal, a threshold), so a label is required.
   */
  label: string;
}

/** Formats the value text from the clamped value and the maximum (upstream `formatValueLabel`). */
export type ProgressBarValueFormatter = (value: number, max: number) => string;
