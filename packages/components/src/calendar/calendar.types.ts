import type {
  DateRange,
  DayOfWeek,
  DayOfWeekName,
  ISODateString,
} from '@tecton-wc/core/date/date-types.js';

export type {DateRange, DayOfWeek, DayOfWeekName, ISODateString};

/** Selection modes: one date, or a start and an end. */
export const CALENDAR_MODES = ['single', 'range'] as const;
export type CalendarMode = (typeof CALENDAR_MODES)[number];

/** A calendar shows one or two months side by side. */
export type CalendarMonthCount = 1 | 2;

/** What `tct-calendar` holds: a date in `single` mode, a range in `range` mode. */
export type CalendarValue = ISODateString | DateRange;

/** A predicate that keeps a date selectable when it returns `true` (upstream `dateConstraints`). */
export type DateConstraint = (date: Date) => boolean;
