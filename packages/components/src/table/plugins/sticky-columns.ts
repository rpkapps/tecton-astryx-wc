/**
 * `TableStickyColumnsController` (upstream `useTableStickyColumns`): pins columns to the start and/or end
 * edge while the table scrolls sideways. `startKeys` pins the run of columns from the first column
 * through the last listed key, `endKeys` the run from the first listed key through the last column.
 * Pinned cells use `position: sticky` with logical offsets (`inset-inline-start`/`-end`), so pinning
 * follows the writing direction and works in right-to-left tables, where the scroll position is negative.
 *
 * Offsets are cumulative widths of the pinned columns before them. They start from the declared widths
 * and are then measured from the rendered header cells, so a proportional or resized column still lines
 * up. A soft shadow on the pinned edge shows only while content is hidden behind it. A pinned body cell
 * paints an opaque background (`--table-sticky-background`) and replays the row's own fill (stripe, hover,
 * selection) over it.
 */
import {observeResize} from '@tecton-wc/core/controllers/resize.js';
import type {
  BodyCellRenderProps,
  HeaderCellRenderProps,
  ScrollWrapperRenderProps,
  TableColumn,
  TableHtmlProps,
  TablePluginHost,
} from '../table.types.js';
import {DEFAULT_MIN_COLUMN_WIDTH} from '../table.utils.js';
import {TablePluginController} from '../table-plugin.js';

/**
 * Config of {@link TableStickyColumnsController}. Every field is optional: `{}` pins nothing, so the
 * config can be computed conditionally without branching on whether to install the plugin.
 */
export interface TableStickyColumnsConfig {
  /** Column keys pinned to the start edge: the run from the first column through the last listed key. */
  startKeys?: string[];
  /** Column keys pinned to the end edge: the run from the first listed key through the last column. */
  endKeys?: string[];
}

interface Side {
  edge: 'start' | 'end';
  /** Index of the column in the final list. */
  index: number;
  /** Cumulative offset from the declared widths, in pixels. */
  offset: number;
  /** The column next to the scrolling region: the one that shows the shadow. */
  isEdge: boolean;
}

interface Layout {
  columns: readonly TableColumn<Record<string, unknown>>[];
  signature: string;
  sides: Map<string, Side>;
  start: number[];
  end: number[];
}

/** A column's width for offset math before it is measured: pixel value, else the proportional minimum. */
function declaredWidth(column: TableColumn<Record<string, unknown>>): number {
  const width = column.width;
  if (!width) return DEFAULT_MIN_COLUMN_WIDTH;
  if (width.type === 'pixel') return width.value;
  return width.minWidth ?? DEFAULT_MIN_COLUMN_WIDTH;
}

function computeLayout(
  columns: readonly TableColumn<Record<string, unknown>>[],
  startKeys: readonly string[],
  endKeys: readonly string[],
): Layout {
  const sides = new Map<string, Side>();
  const start: number[] = [];
  const end: number[] = [];
  let lastStart = -1;
  columns.forEach((column, i) => {
    if (startKeys.includes(column.key)) lastStart = i;
  });
  let cumulative = 0;
  for (let i = 0; i <= lastStart; i++) {
    sides.set(columns[i]!.key, {
      edge: 'start',
      index: i,
      offset: cumulative,
      isEdge: i === lastStart,
    });
    start.push(i);
    cumulative += declaredWidth(columns[i]!);
  }
  const firstEnd = columns.findIndex((column) => endKeys.includes(column.key));
  if (firstEnd >= 0) {
    cumulative = 0;
    for (let i = columns.length - 1; i >= firstEnd; i--) {
      const key = columns[i]!.key;
      // A key configured on both edges resolves to the start edge.
      if (!sides.has(key)) {
        sides.set(key, {edge: 'end', index: i, offset: cumulative, isEdge: i === firstEnd});
        end.push(i);
      }
      cumulative += declaredWidth(columns[i]!);
    }
  }
  return {columns, signature: '', sides, start, end};
}

export class TableStickyColumnsController<
  T extends Record<string, unknown> = Record<string, unknown>,
> extends TablePluginController<T, TableStickyColumnsConfig> {
  #layout: Layout | undefined;
  #scroller: HTMLElement | null = null;
  #detachScroll: (() => void) | undefined;
  #stopObserving: (() => void)[] = [];
  #observedCells: Element[] = [];

  #layoutFor(
    columns: readonly TableColumn<Record<string, unknown>>[] | undefined,
  ): Layout | undefined {
    if (!columns || columns.length === 0) return undefined;
    const {startKeys = [], endKeys = []} = this.config;
    if (startKeys.length === 0 && endKeys.length === 0) return undefined;
    const signature = `${startKeys.join('\u0000')}|${endKeys.join('\u0000')}`;
    const cached = this.#layout;
    if (cached?.columns === columns && cached.signature === signature) return cached;
    const layout = computeLayout(columns, startKeys, endKeys);
    layout.signature = signature;
    this.#layout = layout;
    return layout;
  }

  /** Marks one cell (header or body) as pinned. */
  #pin(htmlProps: TableHtmlProps, side: Side): void {
    (htmlProps.classes ??= []).push('tct-table-sticky');
    const attributes = (htmlProps.attributes ??= {});
    attributes['data-sticky'] = side.edge;
    if (side.isEdge) attributes['data-edge'] = '';
    // Measured offset first, the declared one until the header cells have been measured.
    (htmlProps.style ??= {})[side.edge === 'start' ? 'inset-inline-start' : 'inset-inline-end'] =
      `var(--_table-sticky-${side.edge}-${side.index}, ${side.offset}px)`;
  }

  transformHeaderCell = (
    props: HeaderCellRenderProps,
    column: TableColumn<T>,
  ): HeaderCellRenderProps => {
    const side = this.#layoutFor(props.columns)?.sides.get(column.key);
    if (side) this.#pin(props.htmlProps, side);
    return props;
  };

  transformBodyCell = (props: BodyCellRenderProps, column: TableColumn<T>): BodyCellRenderProps => {
    const side = this.#layoutFor(props.columns)?.sides.get(column.key);
    if (side) this.#pin(props.htmlProps, side);
    return props;
  };

  transformScrollWrapper = (props: ScrollWrapperRenderProps): ScrollWrapperRenderProps => {
    const {startKeys = [], endKeys = []} = this.config;
    if (startKeys.length === 0 && endKeys.length === 0) return props;
    const existing = props.htmlProps.ref;
    props.htmlProps.ref = (element) => {
      this.#attachScroll(element);
      existing?.(element);
    };
    return props;
  };

  /** Measures the header cells after every render so the offsets follow the real widths. */
  updated = (table: TablePluginHost): void => {
    const layout = this.#layout;
    const tableElement = table.element.querySelector<HTMLTableElement>('table');
    if (!layout || !tableElement) return;
    const cells = tableElement.querySelectorAll<HTMLTableCellElement>('thead > tr > th');
    this.#measure(tableElement, cells, layout);
    // Re-measure when a pinned column's width changes (resize, container width, content).
    const pinned = [...layout.start, ...layout.end].map((index) => cells[index]).filter(Boolean);
    if (
      pinned.length !== this.#observedCells.length ||
      pinned.some((cell, i) => cell !== this.#observedCells[i])
    ) {
      for (const stop of this.#stopObserving.splice(0)) stop();
      this.#observedCells = pinned as Element[];
      for (const cell of pinned) {
        this.#stopObserving.push(
          observeResize(cell!, () => {
            this.#measure(tableElement, tableElement.querySelectorAll('thead > tr > th'), layout);
          }),
        );
      }
    }
  };

  override detach(table: TablePluginHost): void {
    super.detach(table);
    this.#detachScroll?.();
    this.#detachScroll = undefined;
    this.#scroller = null;
    for (const stop of this.#stopObserving.splice(0)) stop();
    this.#observedCells = [];
  }

  #measure(table: HTMLElement, cells: NodeListOf<HTMLTableCellElement>, layout: Layout): void {
    let cumulative = 0;
    for (const index of layout.start) {
      table.style.setProperty(`--_table-sticky-start-${index}`, `${cumulative}px`);
      cumulative += cells[index]?.getBoundingClientRect().width ?? 0;
    }
    cumulative = 0;
    for (const index of layout.end) {
      table.style.setProperty(`--_table-sticky-end-${index}`, `${cumulative}px`);
      cumulative += cells[index]?.getBoundingClientRect().width ?? 0;
    }
  }

  /**
   * Scroll-aware shadows: two custom properties on the scroll container say whether content is hidden
   * behind the start or end edge; the cell shadows read them. No render is involved, so scrolling never
   * re-renders anything. The position is an absolute distance from the inline-start edge, because a
   * right-to-left scroll container reports a negative `scrollLeft`.
   */
  #attachScroll(element: HTMLElement | null): void {
    if (element === this.#scroller) return;
    this.#detachScroll?.();
    this.#detachScroll = undefined;
    this.#scroller = element;
    if (!element) return;
    const update = (): void => {
      const max = element.scrollWidth - element.clientWidth;
      const overflow = max > 1;
      const position = Math.abs(element.scrollLeft);
      element.style.setProperty(
        '--_table-sticky-shadow-start',
        overflow && position > 1 ? '1' : '0',
      );
      element.style.setProperty(
        '--_table-sticky-shadow-end',
        overflow && position < max - 1 ? '1' : '0',
      );
    };
    element.addEventListener('scroll', update, {passive: true});
    const stop = observeResize(element, update);
    update();
    this.#detachScroll = () => {
      element.removeEventListener('scroll', update);
      stop();
    };
  }
}
