/**
 * The date whose month a calendar opens on (upstream `getInitialFocusDate`, MIT, adapted).
 *
 * An explicit `focusDate` wins, then the selected value: both are the consumer's own instruction about
 * where to look, so neither is second-guessed against `min` / `max`. Otherwise the calendar opens on today
 * clamped into the `min`..`max` window, so a window that excludes today (a 2019 audit range, a booking
 * window opening next spring) does not open on an all-disabled month.
 *
 * Clamping forward to `min` leads with that month. Clamping back to `max` lands the *last* pane on
 * `max`'s month: with two months, opening on `[max, max + 1]` would spend half the calendar on a month
 * that is entirely out of bounds. That shift never crosses `min`'s month.
 *
 * Every date is read leniently (`tryPlainDateFromISO`): an attribute that is not a date is ignored rather
 * than thrown from render.
 */
import type {DateRange, PlainDate} from '@tecton-wc/core/date/date-types.js';
import {
  plainDateAddMonths,
  plainDateIsAfter,
  plainDateIsBefore,
  plainDateSetFirstOfMonth,
  tryPlainDateFromISO,
} from '@tecton-wc/core/date/plain-date.js';

export interface InitialFocusDateOptions {
  /** An explicit visible month. */
  focusDate?: string;
  /** The selected value (a date, or a range in range mode). */
  value?: DateRange | string;
  /** Earliest selectable date. */
  min?: string;
  /** Latest selectable date. */
  max?: string;
  /** How many month panes the calendar renders (1 or 2). */
  numberOfMonths: number;
  /** Today, injected so the caller keeps one source of "now". */
  today: PlainDate;
}

export function getInitialFocusDate(options: InitialFocusDateOptions): PlainDate {
  const {focusDate, value, min, max, numberOfMonths, today} = options;

  const focus = tryPlainDateFromISO(focusDate ?? null);
  if (focus) return focus;

  const selected = tryPlainDateFromISO(
    typeof value === 'object' && value !== null ? value.start : (value ?? null),
  );
  if (selected) return selected;

  const minDate = tryPlainDateFromISO(min ?? null);
  const maxDate = tryPlainDateFromISO(max ?? null);

  if (minDate && plainDateIsBefore(today, minDate)) return minDate;

  if (maxDate && plainDateIsAfter(today, maxDate)) {
    const lastPaneOffset = Math.max(0, numberOfMonths - 1);
    const shifted = plainDateAddMonths(plainDateSetFirstOfMonth(maxDate), -lastPaneOffset);
    if (minDate && plainDateIsBefore(shifted, plainDateSetFirstOfMonth(minDate))) return minDate;
    return shifted;
  }
  return today;
}
