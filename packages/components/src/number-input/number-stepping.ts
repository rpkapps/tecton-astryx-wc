// Adapted from the upstream design system (MIT); see THIRD-PARTY-NOTICES.md.

/** Stepping a number by the configured step, without floating-point drift and inside its bounds. */

export type StepDirection = -1 | 1;

export interface StepOptions {
  currentValue: number | null;
  direction: StepDirection;
  min?: number | null;
  max?: number | null;
  step?: number | null;
  integerOnly: boolean;
}

function decimalPlaces(value: number): number {
  const [coefficient = '', exponentText] = String(value).toLowerCase().split('e');
  const fractionLength = coefficient.split('.')[1]?.length ?? 0;
  const exponent = exponentText === undefined ? 0 : Number(exponentText);
  return Math.max(0, fractionLength - exponent);
}

/** The step in effect: a positive finite number (a whole one when `integerOnly`), else 1. */
export function effectiveStep(step: number | null | undefined, integerOnly: boolean): number {
  if (
    step === null ||
    step === undefined ||
    !Number.isFinite(step) ||
    step <= 0 ||
    (integerOnly && !Number.isInteger(step))
  ) {
    return 1;
  }
  return step;
}

/**
 * The next value in `direction`: the next multiple of the step counted from `min` (or 0), rounded to the
 * step's own precision, clamped to `min` and `max`. From an empty field, up goes to `min` (or 0) and down
 * to `max` (or 0). Returns the current value when there is nowhere to go.
 */
export function steppedValue({
  currentValue,
  direction,
  min,
  max,
  step,
  integerOnly,
}: StepOptions): number | null {
  const size = effectiveStep(step, integerOnly);
  const base =
    min !== null && min !== undefined && (!integerOnly || Number.isInteger(min)) ? min : 0;

  let next: number;
  if (currentValue === null) {
    next = direction === 1 ? (min ?? 0) : (max ?? 0);
    if (integerOnly) next = direction === 1 ? Math.ceil(next) : Math.floor(next);
  } else {
    const position = (currentValue - base) / size;
    const tolerance = Number.EPSILON * Math.max(1, Math.abs(position)) * 4;
    const nextPosition =
      direction === 1 ? Math.floor(position + tolerance) + 1 : Math.ceil(position - tolerance) - 1;
    next = base + nextPosition * size;
  }

  const precision = Math.min(12, Math.max(decimalPlaces(size), decimalPlaces(base)));
  next = Number(next.toFixed(precision));

  // Clamp after rounding so a bound with finer precision than the step cannot be rounded out of range.
  if (min !== null && min !== undefined) next = Math.max(min, next);
  if (max !== null && max !== undefined) next = Math.min(max, next);

  if (!Number.isFinite(next)) return currentValue;
  if (integerOnly && !Number.isInteger(next)) return currentValue;
  return Object.is(next, -0) ? 0 : next;
}
