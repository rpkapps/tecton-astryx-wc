// Adapted from the upstream design system (MIT); see THIRD-PARTY-NOTICES.md.

/**
 * The commit policy of a number field draft: one decision (commit, clear or revert) for the whole text,
 * validated against min, max and integer-only, in the field's locale.
 */

type Locale = string;
import {parseLocaleNumber} from './number-parser.js';

interface NumberInputValidationOptions {
  min?: number | null;
  max?: number | null;
  integerOnly?: boolean;
  locale?: Locale;
}

export type NumberInputCommitDecision =
  {type: 'commit'; value: number; didClamp: boolean} | {type: 'clear'} | {type: 'revert'};

function parseNumericInput(
  input: string,
  options: Pick<NumberInputValidationOptions, 'integerOnly' | 'locale'>,
): number | null {
  const trimmed = input.trim();
  if (trimmed === '') {
    return null;
  }

  const value = parseLocaleNumber(trimmed, options.locale);
  if (value == null || !Number.isFinite(value)) {
    return null;
  }
  if (options.integerOnly && !Number.isInteger(value)) {
    return null;
  }
  return value;
}

export function parseNumberInput(
  input: string,
  options: NumberInputValidationOptions,
): number | null {
  const value = parseNumericInput(input, options);
  if (value === null) {
    return null;
  }
  if (options.min != null && value < options.min) {
    return null;
  }
  if (options.max != null && value > options.max) {
    return null;
  }
  return value;
}

export function resolveNumberInputCommit(
  input: string,
  options: NumberInputValidationOptions & {clearable: boolean},
): NumberInputCommitDecision {
  if (input.trim() === '') {
    return options.clearable ? {type: 'clear'} : {type: 'revert'};
  }

  const value = parseNumericInput(input, options);
  if (value === null) {
    return {type: 'revert'};
  }

  const min =
    options.min == null ? null : options.integerOnly ? Math.ceil(options.min) : options.min;
  const max =
    options.max == null ? null : options.integerOnly ? Math.floor(options.max) : options.max;
  if (min != null && max != null && min > max) {
    return {type: 'revert'};
  }

  const committedValue =
    min != null && value < min ? min : max != null && value > max ? max : value;
  return {
    type: 'commit',
    value: committedValue,
    didClamp: committedValue !== value,
  };
}
