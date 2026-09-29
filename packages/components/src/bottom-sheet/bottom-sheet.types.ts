import {devWarn} from '@tecton-astryx/core/utils/dev.js';
import {isValidSnapPoint, type BottomSheetSnapPoint} from './snap-offsets.js';

export type {BottomSheetSnapPoint} from './snap-offsets.js';

/** Named height budgets (upstream `BottomSheetHeight`). */
export const BOTTOM_SHEET_HEIGHTS = ['hug', 'capped', 'tall'] as const;
export type BottomSheetHeight = (typeof BOTTOM_SHEET_HEIGHTS)[number];

/** Implicit-dismissal policy, aligned with `tct-dialog` (upstream `DialogPurpose`). */
export const BOTTOM_SHEET_PURPOSES = ['required', 'form', 'info'] as const;
export type BottomSheetPurpose = (typeof BOTTOM_SHEET_PURPOSES)[number];

/** The largest share of the viewport each named height may take (upstream `HEIGHT_BUDGETS`). */
export const HEIGHT_BUDGETS: Readonly<Record<BottomSheetHeight, string>> = {
  hug: '92dvh',
  capped: '62dvh',
  tall: '92dvh',
};

/** Height of the reserved block-end band under the viewport that a lift (rubber band) reveals. */
export const OVERSCROLL_PADDING = 48;

/** Clearance kept between a focused field and the on-screen keyboard. */
export const MOBILE_KEYBOARD_BOTTOM_CLEARANCE = 48;

export const isNamedHeight = (height: string | number | undefined): height is BottomSheetHeight =>
  typeof height === 'string' && (BOTTOM_SHEET_HEIGHTS as readonly string[]).includes(height);

/**
 * The CSS length behind a `height`: a named budget, a bare number (px), or a CSS length as written.
 * An empty or missing value is the default (`capped`).
 */
export function heightBudget(height: string | number | undefined): string {
  if (height === undefined || height === '') return HEIGHT_BUDGETS.capped;
  if (typeof height === 'number') return `${height}px`;
  if (isNamedHeight(height)) return HEIGHT_BUDGETS[height];
  const trimmed = height.trim();
  return /^\d+(\.\d+)?$/.test(trimmed) ? `${trimmed}px` : trimmed;
}

/**
 * Parses the `snap-points` attribute: comma or space separated stops. A bare number is a viewport
 * fraction (`0.5`); `50%` and `96px` stay strings, as in the `snapPoints` property.
 */
export function parseSnapPoints(value: string | null): BottomSheetSnapPoint[] {
  if (!value) return [];
  return value
    .split(/[\s,]+/)
    .filter(Boolean)
    .map((part) => (/^(\d+(\.\d+)?|\.\d+)$/.test(part) ? Number(part) : part));
}

/** Warns (once per distinct set) about snap points the sheet cannot honour. */
export function warnIgnoredSnapPoints(points: ReadonlyArray<BottomSheetSnapPoint>): void {
  const ignored = points.filter((point) => !isValidSnapPoint(point));
  if (ignored.length === 0) return;
  devWarn(
    `tct-bottom-sheet:snap-points:${JSON.stringify(ignored)}`,
    `tct-bottom-sheet: snap points ignored ${JSON.stringify(ignored)}. A snap point is a viewport fraction above 0 and up to 1 (0.5 is half the screen), a px length ('320px'), or a percentage ('50%').`,
  );
}
