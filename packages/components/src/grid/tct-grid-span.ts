import type {CSSResultGroup, PropertyValues, TemplateResult} from 'lit';
import {html} from 'lit';
import {property} from 'lit/decorators.js';
import {TctElement} from '@tecton-astryx/core/tct-element.js';
import {devWarn} from '@tecton-astryx/core/utils/dev.js';
import base from '../styles/base.styles.css';
import type {GridSpanColumns} from './grid.types.js';
import styles from './tct-grid-span.styles.css';

/** Spans the stylesheet handles without JavaScript (attribute selectors); larger ones use a per-instance sheet. */
const STATIC_SPAN_LIMIT = 12;

/** A positive whole number from an attribute or property, or `undefined`. */
const toCount = (value: unknown): number | undefined => {
  const number = typeof value === 'string' ? Number(value) : value;
  return typeof number === 'number' && Number.isInteger(number) && number > 0 ? number : undefined;
};

const columnsConverter = {
  fromAttribute: (value: string | null): GridSpanColumns | undefined =>
    value === 'full' ? 'full' : toCount(value),
  toAttribute: (value: GridSpanColumns | undefined): string | null =>
    value === undefined ? null : String(value),
};

const rowsConverter = {
  fromAttribute: (value: string | null): number | undefined => toCount(value),
  toAttribute: (value: number | undefined): string | null =>
    value === undefined ? null : String(value),
};

/**
 * A grid item that spans several columns or rows of a `tct-grid`. `columns="2"` spans two columns,
 * `columns="full"` every column, `rows="2"` two rows. The span is a grid item itself, so it takes
 * the height of its cell and lets its own content stretch.
 *
 * @summary Makes one item of a `tct-grid` span several columns or rows.
 * @tag tct-grid-span
 * @upstream GridSpan
 * @slot - The item's content.
 * @cloakDisplay grid
 */
export class TctGridSpan extends TctElement {
  static override readonly tagName = 'tct-grid-span';
  static override styles: CSSResultGroup = [base, styles];

  /** How many columns to span (`2`), or `full` for every column. Unset, the item takes one column. */
  @property({converter: columnsConverter, reflect: true}) columns: GridSpanColumns | undefined;

  /** How many rows to span. Unset, the item takes one row. */
  @property({converter: rowsConverter, reflect: true}) rows: number | undefined;

  #sheet: CSSStyleSheet | undefined;

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('columns') && this.columns !== undefined && this.columns !== 'full') {
      if (toCount(this.columns) === undefined) {
        devWarn(
          `grid-span:columns:${String(this.columns)}`,
          `columns must be a positive integer or "full".`,
        );
      }
    }
    if (changed.has('rows') && this.rows !== undefined && toCount(this.rows) === undefined) {
      devWarn(`grid-span:rows:${String(this.rows)}`, `rows must be a positive integer.`);
    }
  }

  /** Spans beyond the static rules: a small constructed sheet on this element's shadow root. */
  protected override updated(changed: PropertyValues<this>): void {
    if (!changed.has('columns') && !changed.has('rows')) return;
    const declarations: string[] = [];
    const columns = this.columns === 'full' ? undefined : toCount(this.columns);
    const rows = toCount(this.rows);
    if (columns !== undefined && columns > STATIC_SPAN_LIMIT) {
      declarations.push(`grid-column: span ${columns};`);
    }
    if (rows !== undefined && rows > STATIC_SPAN_LIMIT)
      declarations.push(`grid-row: span ${rows};`);
    const root = this.renderRoot as ShadowRoot;
    if (declarations.length === 0) {
      if (this.#sheet) {
        root.adoptedStyleSheets = root.adoptedStyleSheets.filter((sheet) => sheet !== this.#sheet);
      }
      return;
    }
    this.#sheet ??= new CSSStyleSheet();
    this.#sheet.replaceSync(`@layer component { :host { ${declarations.join(' ')} } }`);
    if (!root.adoptedStyleSheets.includes(this.#sheet)) {
      root.adoptedStyleSheets = [...root.adoptedStyleSheets, this.#sheet];
    }
  }

  override render(): TemplateResult {
    return html`<slot></slot>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-grid-span': TctGridSpan;
  }
}
