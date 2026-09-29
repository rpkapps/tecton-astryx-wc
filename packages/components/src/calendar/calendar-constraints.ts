/**
 * Which dates a calendar lets you pick (upstream `useCalendarConstraints`, MIT, adapted as a pure
 * factory). A date is unavailable when it is before `min`, after `max`, too far from (or, for a
 * minimum span, too near) the start of the range being picked, or any `dateConstraints` predicate says no.
 *
 * Spans count both endpoints: `maxRangeSpan` 7 is a 7-day window, so a day is reachable when it is at most
 * six days from the start. The start itself is never disabled by `minRangeSpan`: it is the picked day, and
 * disabling it would show the active selection as unavailable.
 */
import {
  plainDateDiffDays,
  plainDateIsAfter,
  plainDateIsBefore,
  plainDateToDate,
  tryPlainDateFromISO,
} from '@tecton-wc/core/date/plain-date.js';
import type {PlainDate} from '@tecton-wc/core/date/date-types.js';

export interface CalendarConstraintsOptions {
  /** Earliest selectable date (ISO). An unreadable value is ignored. */
  min?: string;
  /** Latest selectable date (ISO). */
  max?: string;
  /** Predicates over a local `Date`; a date is unavailable when any returns `false`. */
  dateConstraints?: readonly ((date: Date) => boolean)[];
  /** Range mode: the most days a range may span, both endpoints counted. Needs a range anchor. */
  maxRangeSpan?: number;
  /** Range mode: the fewest days a range must span, both endpoints counted. Needs a range anchor. */
  minRangeSpan?: number;
  /** The start of the range being picked (first click made, second pending), else `null`. */
  rangeAnchor?: PlainDate | null;
}

export interface CalendarConstraints {
  /** Whether a date cannot be selected. */
  isDateDisabled: (date: PlainDate) => boolean;
  /** The parsed `min`, or `null`. */
  minDate: PlainDate | null;
  /** The parsed `max`, or `null`. */
  maxDate: PlainDate | null;
}

export function createCalendarConstraints(
  options: CalendarConstraintsOptions,
): CalendarConstraints {
  const {dateConstraints, maxRangeSpan, minRangeSpan, rangeAnchor} = options;
  const minDate = tryPlainDateFromISO(options.min ?? null);
  const maxDate = tryPlainDateFromISO(options.max ?? null);

  const isDateDisabled = (date: PlainDate): boolean => {
    if (minDate && plainDateIsBefore(date, minDate)) return true;
    if (maxDate && plainDateIsAfter(date, maxDate)) return true;

    if (rangeAnchor) {
      const distance = Math.abs(plainDateDiffDays(rangeAnchor, date));
      if (maxRangeSpan != null && distance > maxRangeSpan - 1) return true;
      if (minRangeSpan != null && distance > 0 && distance < minRangeSpan - 1) return true;
    }

    if (dateConstraints) {
      // The public predicate takes a native Date.
      const asDate = plainDateToDate(date);
      for (const constraint of dateConstraints) {
        if (!constraint(asDate)) return true;
      }
    }
    return false;
  };

  return {isDateDisabled, minDate, maxDate};
}
