import type {SpacingStep} from '@tecton-wc/core/mixins/box-props.js';

/** Item alignment inside a grid track (`align-items` / `justify-items`). */
export const GRID_ALIGNMENTS = ['start', 'center', 'end', 'stretch'] as const;
export type GridAlignment = (typeof GRID_ALIGNMENTS)[number];

/** Whether empty tracks are kept (`fill`, `auto-fill`) or collapsed (`fit`, `auto-fit`). */
export const GRID_REPEATS = ['fill', 'fit'] as const;
export type GridRepeat = (typeof GRID_REPEATS)[number];

/** The responsive form of `columns` (upstream `GridColumns` object): as many tracks as fit. */
export interface GridColumnsConfig {
  /** The narrowest a track may get, in CSS px. */
  minWidth: number;
  /** The most tracks allowed (the count is capped, the tracks still fill the row). */
  max?: number;
  /** `fill` (default) keeps empty tracks, `fit` collapses them. */
  repeat?: GridRepeat;
}

/** A fixed number of equal columns, or the responsive form. */
export type GridColumns = number | GridColumnsConfig;

/** `columns` and `rows` of a `tct-grid-span`: a count, or `full` for every column. */
export type GridSpanColumns = number | 'full';

const spacingVar = (step: SpacingStep): string => `--spacing-${String(step).replace('.', '-')}`;

/**
 * The `grid-template-columns` value for `columns` (upstream `Grid`, unchanged):
 * - a number above zero is `repeat(n, 1fr)`;
 * - `{minWidth}` is `repeat(auto-fill | auto-fit, minmax(<min>px, 1fr))`;
 * - with `max` the count is capped on the track minimum, `min(100%, max(<min>px, <per-column>))`,
 *   while the track maximum stays `1fr`, so a lone column can still fill the row;
 * - anything else is a single `1fr` column.
 * `columnGap` (else `gap`) feeds the per-column floor.
 */
export function buildGridTemplateColumns(
  columns: GridColumns | undefined,
  gap?: SpacingStep,
  columnGap?: SpacingStep,
): string {
  if (typeof columns === 'object' && columns !== null) {
    const repeatMode = columns.repeat === 'fit' ? 'auto-fit' : 'auto-fill';
    if (columns.max !== undefined && columns.max > 0) {
      const gapStep = columnGap ?? gap;
      const perColumn =
        gapStep === undefined
          ? `calc(100% / ${columns.max})`
          : `calc((100% - ${columns.max - 1} * var(${spacingVar(gapStep)})) / ${columns.max})`;
      return `repeat(${repeatMode}, minmax(min(100%, max(${columns.minWidth}px, ${perColumn})), 1fr))`;
    }
    return `repeat(${repeatMode}, minmax(${columns.minWidth}px, 1fr))`;
  }
  if (typeof columns === 'number' && columns > 0) return `repeat(${columns}, 1fr)`;
  return '1fr';
}
