/** Direction the steps run in (upstream `StepperOrientation`). */
export const STEPPER_ORIENTATIONS = ['horizontal', 'vertical'] as const;
export type StepperOrientation = (typeof STEPPER_ORIENTATIONS)[number];

/** Vertical padding of the steps (upstream `StepperDensity`). */
export const STEPPER_DENSITIES = ['compact', 'balanced', 'spacious'] as const;
export type StepperDensity = (typeof STEPPER_DENSITIES)[number];

/**
 * Where each step's indicator sits relative to the connector track (upstream `StepperIndicatorPosition`).
 * `separated`: in the label row, apart from the progress bar. `on-track`: a node on the track itself, with
 * the label beside it (vertical) or below it (horizontal).
 */
export const STEPPER_INDICATOR_POSITIONS = ['separated', 'on-track'] as const;
export type StepperIndicatorPosition = (typeof STEPPER_INDICATOR_POSITIONS)[number];

/**
 * What a horizontal stepper shows when its steps no longer fit (upstream `StepperCollapsedVariant`).
 * `with-label-and-controls`: the current step's label with previous and next buttons (buttons only
 * when the stepper is `navigable`). `with-label`: the label alone. `hidden-label`: the bare track.
 */
export const STEPPER_COLLAPSED_VARIANTS = [
  'with-label-and-controls',
  'with-label',
  'hidden-label',
] as const;
export type StepperCollapsedVariant = (typeof STEPPER_COLLAPSED_VARIANTS)[number];

/**
 * Semantic status of a step (upstream `StepStatus`): `accent` (colour only), `success`, `warning`, `error`.
 * It never recolours the connector; the current step keeps its current-step indicator.
 */
export const STEP_STATUSES = ['accent', 'success', 'warning', 'error'] as const;
export type StepStatus = (typeof STEP_STATUSES)[number];

/**
 * What a step's indicator shows (upstream `StepIndicatorPreset`): `auto` (a number until completed, then a
 * check), `number` (always a number) or `none`. Slot your own into `slot="indicator"` for anything else.
 */
export const STEP_INDICATORS = ['auto', 'number', 'none'] as const;
export type StepIndicatorPreset = (typeof STEP_INDICATORS)[number];

/** Default width, in px, a step needs for its own label before a horizontal stepper collapses. */
export const DEFAULT_MINIMUM_STEP_WIDTH = 112;
