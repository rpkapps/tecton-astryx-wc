import {html, type CSSResultGroup, type PropertyValues, type TemplateResult} from 'lit';
import {property} from 'lit/decorators.js';
import {ifDefined} from 'lit/directives/if-defined.js';
import {styleMap} from 'lit/directives/style-map.js';
import {BoxPropsMixin, SPACING_STEPS, type SpacingStep} from '@tecton-wc/core/mixins/box-props.js';
import {TctElement} from '@tecton-wc/core/tct-element.js';
import {devWarn} from '@tecton-wc/core/utils/dev.js';
import base from '../styles/base.styles.css';
import {
  buildGridTemplateColumns,
  GRID_ALIGNMENTS,
  GRID_REPEATS,
  type GridAlignment,
  type GridColumns,
  type GridColumnsConfig,
  type GridRepeat,
} from './grid.types.js';
import styles from './tct-grid.styles.css';

/** A finite number from an attribute, or `undefined` (an empty or non-numeric value is "unset"). */
const numberFromAttribute = (value: string | null): number | undefined => {
  if (value === null || value.trim() === '') return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
};

const validStep = (step: SpacingStep | undefined): SpacingStep | undefined =>
  step !== undefined && SPACING_STEPS.includes(step) ? step : undefined;

const spacingToken = (step: SpacingStep | undefined, what: string): string | undefined => {
  if (step === undefined) return undefined;
  if (SPACING_STEPS.includes(step)) return `var(--spacing-${String(step).replace('.', '-')})`;
  devWarn(`grid:${what}:${String(step)}`, `${what}="${String(step)}" is not a spacing step.`);
  return undefined;
};

/**
 * Arranges its children in a CSS grid: a fixed number of equal columns, or as many columns as fit.
 *
 * The children are the grid items of an inner `part="base"` box. `columns="3"` gives three equal
 * columns. The responsive form is written with attributes: `column-min-width="240"` makes as many
 * columns as fit (each at least 240px), `column-max` caps the count and `column-repeat="fit"`
 * collapses empty tracks; the `columns` property also accepts upstream's object
 * `{minWidth, max, repeat}`. Wrap a child in `<tct-grid-span>` to make it span columns or rows.
 *
 * @summary Grid layout with a fixed or responsive column count and token-based gaps.
 * @tag tct-grid
 * @upstream Grid
 * @slot - The grid items.
 * @csspart base - The grid container that holds the items (theme target `grid`).
 * @cloakDisplay flex
 */
export class TctGrid extends BoxPropsMixin(TctElement) {
  static override readonly tagName = 'tct-grid';
  static override styles: CSSResultGroup = [base, styles];

  /**
   * The columns: a number for that many equal columns (`columns="3"`; zero, negative or missing means
   * one column), or the responsive object `{minWidth, max?, repeat?}` as a property.
   */
  @property({converter: {fromAttribute: numberFromAttribute}}) columns: GridColumns | undefined;

  /**
   * The narrowest a column may get, in CSS px. Setting it switches to the responsive form: as many
   * columns as fit. Equivalent to `columns` `{minWidth}`.
   */
  @property({attribute: 'column-min-width', type: Number}) columnMinWidth: number | undefined;

  /** With `column-min-width`, the most columns allowed. The count is capped and the columns still fill the row. */
  @property({attribute: 'column-max', type: Number}) columnMax: number | undefined;

  /** With `column-min-width`, `fill` (default) keeps empty tracks and `fit` collapses them. */
  @property({attribute: 'column-repeat'}) columnRepeat: GridRepeat = 'fill';

  /** Space between rows and columns, a spacing-scale step (0, 0.5, 1, 1.5, 2, 3, 4, 5, 6, 8, 10). */
  @property({type: Number}) gap: SpacingStep | undefined;

  /** Space between rows only; overrides `gap`. */
  @property({attribute: 'row-gap', type: Number}) rowGap: SpacingStep | undefined;

  /** Space between columns only; overrides `gap`. */
  @property({attribute: 'column-gap', type: Number}) columnGap: SpacingStep | undefined;

  /** A fixed row height in CSS px (`grid-auto-rows`). Unset, rows size to their content. */
  @property({attribute: 'row-height', type: Number}) rowHeight: number | undefined;

  /**
   * Vertical alignment of items in their cell (`align-items`; upstream `align`): `start`, `center`,
   * `end` or `stretch`. The attribute is `alignment` because browsers treat `align` as presentational.
   */
  @property() alignment: GridAlignment | undefined;

  /** Horizontal alignment of items in their cell (`justify-items`): `start`, `center`, `end` or `stretch`. */
  @property() justify: GridAlignment | undefined;

  // Sizes go on the host (not part="base") so a percentage resolves against the parent.
  protected override get boxTarget(): HTMLElement {
    return this;
  }

  /** The columns actually used: the object form wins, then `column-min-width`, then the number. */
  #columns(): GridColumns | undefined {
    if (typeof this.columns === 'object' && this.columns !== null) return this.columns;
    if (this.columnMinWidth !== undefined && this.columnMinWidth > 0) {
      const config: GridColumnsConfig = {
        minWidth: this.columnMinWidth,
        repeat: GRID_REPEATS.includes(this.columnRepeat) ? this.columnRepeat : 'fill',
      };
      if (this.columnMax !== undefined) config.max = this.columnMax;
      return config;
    }
    return this.columns;
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('alignment') && this.alignment && !GRID_ALIGNMENTS.includes(this.alignment)) {
      devWarn(
        `grid:alignment:${this.alignment}`,
        `alignment="${this.alignment}" is not one of ${GRID_ALIGNMENTS.join(', ')}.`,
      );
    }
    if (changed.has('justify') && this.justify && !GRID_ALIGNMENTS.includes(this.justify)) {
      devWarn(
        `grid:justify:${this.justify}`,
        `justify="${this.justify}" is not one of ${GRID_ALIGNMENTS.join(', ')}.`,
      );
    }
  }

  override render(): TemplateResult {
    const gap = validStep(this.gap);
    const columnGap = validStep(this.columnGap);
    const rowHeight =
      this.rowHeight !== undefined && this.rowHeight > 0 ? `${this.rowHeight}px` : undefined;
    return html`<div
      part="base"
      class="base"
      data-alignment=${ifDefined(GRID_ALIGNMENTS.find((value) => value === this.alignment))}
      data-justify=${ifDefined(GRID_ALIGNMENTS.find((value) => value === this.justify))}
      style=${styleMap({
        '--_columns': buildGridTemplateColumns(this.#columns(), gap, columnGap),
        '--_gap': spacingToken(this.gap, 'gap'),
        '--_row-gap': spacingToken(this.rowGap, 'row-gap'),
        '--_column-gap': spacingToken(this.columnGap, 'column-gap'),
        '--_row-height': rowHeight,
      })}
    >
      <slot></slot>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-grid': TctGrid;
  }
}
