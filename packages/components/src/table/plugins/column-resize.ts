/**
 * `TableColumnResizeController` (upstream `useTableColumnResize`): a resize handle on the inline-end
 * edge of every resizable header cell. The handle is a focusable `separator` (the ARIA window-splitter
 * pattern): drag it with a pointer, or focus it and use ArrowLeft/ArrowRight (10 px, Shift for 50 px;
 * the arrows follow the visual direction, so they mirror in right-to-left), Home for the minimum width
 * and End for the maximum. Every keypress commits, like the end of a drag, so there is no separate
 * activation step. `aria-valuenow` is the measured width in pixels.
 *
 * Proportional columns resize against their neighbour (the pair keeps the table's width), the last
 * resizable proportional column has no handle (it absorbs the rest), and a resize freezes the widths of
 * the columns it touched as pixel widths, reported through `onColumnResizeEnd`. Give `columnWidths` back
 * to control the widths; without it the plugin remembers them itself.
 */
import {html, nothing} from 'lit';
import {ifDefined} from 'lit/directives/if-defined.js';
import {observeResize} from '@tecton-wc/core/controllers/resize.js';
import type {
  ColumnWidth,
  HeaderCellRenderProps,
  TableColumn,
  TablePluginHost,
} from '../table.types.js';
import {DEFAULT_MIN_COLUMN_WIDTH} from '../table.utils.js';
import {TablePluginController} from '../table-plugin.js';

/** Config of {@link TableColumnResizeController}. */
export interface TableColumnResizeConfig {
  /**
   * Column widths in pixels by column key, from earlier resizes. A key here overrides the column's
   * declared `width`. Give it (and update it from `onColumnResizeEnd`) to control and persist the widths.
   */
  columnWidths?: Record<string, number>;
  /**
   * Called when a resize ends (pointer up, or a key press) with the widths of every column that changed:
   * the resized one and the others committed to pixel widths to prevent layout shift. Merge them into
   * your `columnWidths`.
   */
  onColumnResizeEnd?: (updates: Record<string, number>) => void;
  /** Global minimum width in pixels; overrides the per-column minimum. Default: the column's own. */
  minWidth?: number;
  /** Global maximum width in pixels. Default: none. */
  maxWidth?: number;
}

const FALLBACK_MIN_WIDTH = 50;
const KEYBOARD_STEP = 10;
const KEYBOARD_LARGE_STEP = 50;

/** The effective minimum of a column: a global override, else its own width setting. */
function resolveMinWidth(width: ColumnWidth | undefined, override: number | undefined): number {
  if (override != null) return override;
  if (!width) return DEFAULT_MIN_COLUMN_WIDTH;
  if (width.type === 'proportional') return width.minWidth ?? DEFAULT_MIN_COLUMN_WIDTH;
  return width.value > 0 ? width.value : FALLBACK_MIN_WIDTH;
}

const isProportional = (width: ColumnWidth | undefined): boolean =>
  !width || width.type === 'proportional';

interface Snapshot {
  key: string;
  th: HTMLTableCellElement;
  initialWidth: number;
  minWidth: number;
  maxWidth: number;
}

interface Drag {
  startX: number;
  resizeIndex: number;
  neighborIndex: number | null;
  snapshots: Snapshot[];
  tableWidth: number;
}

/**
 * The pixel width of every snapshot column for a drag of `delta` pixels. Only the target column (or,
 * for a proportional column, the pair of it and its neighbour) changes; the last column takes the
 * remainder so the table keeps its width; every width is clamped to its minimum. Pointer and keyboard
 * resizing both come through here, so they distribute widths identically.
 */
export function computeColumnWidths(drag: Drag, delta: number): number[] {
  const {snapshots, resizeIndex, neighborIndex, tableWidth} = drag;
  const widths = snapshots.map((snapshot) => snapshot.initialWidth);
  const last = snapshots.length - 1;
  const self = snapshots[resizeIndex]!;

  if (neighborIndex !== null) {
    const neighbor = snapshots[neighborIndex]!;
    const maxDelta = neighbor.initialWidth - neighbor.minWidth;
    const minDelta = self.minWidth - self.initialWidth;
    const clamped = Math.max(minDelta, Math.min(delta, maxDelta));
    widths[neighborIndex] = neighbor.initialWidth - clamped;
    widths[resizeIndex] = self.initialWidth + clamped;
  } else {
    widths[resizeIndex] = Math.min(
      self.maxWidth,
      Math.max(self.minWidth, self.initialWidth + delta),
    );
  }

  if (last >= 0 && tableWidth > 0) {
    const others = widths.reduce((sum, width, i) => (i === last ? sum : sum + width), 0);
    widths[last] = Math.max(snapshots[last]!.minWidth, tableWidth - others);
  }
  return widths;
}

export class TableColumnResizeController<
  T extends Record<string, unknown> = Record<string, unknown>,
> extends TablePluginController<T, TableColumnResizeConfig> {
  /** The final ordered columns seen at render time, by key (for minimums and neighbours). */
  #columns: readonly TableColumn<Record<string, unknown>>[] = [];
  /** Widths remembered by the plugin itself when the config does not control them. */
  #local: Record<string, number> = {};
  #stopObserving: (() => void) | undefined;
  #observed: HTMLElement | null = null;

  override detach(table: TablePluginHost): void {
    super.detach(table);
    this.#stopObserving?.();
    this.#stopObserving = undefined;
    this.#observed = null;
  }

  #widths(): Record<string, number> {
    return this.config.columnWidths ?? this.#local;
  }

  transformHeaderCell = (
    props: HeaderCellRenderProps,
    column: TableColumn<T>,
    _index: number,
    columns: readonly TableColumn<T>[],
  ): HeaderCellRenderProps => {
    this.#columns = columns as readonly TableColumn<Record<string, unknown>>[];
    if (column.resizable === false) return props;
    const resizable = columns.filter((c) => c.resizable !== false);
    const at = resizable.findIndex((c) => c.key === column.key);
    const proportional = isProportional(column.width);
    // The last resizable proportional column flexes to fill the rest: nothing to drag against.
    if (proportional && at === resizable.length - 1) return props;

    const neighborKey = proportional && at >= 0 ? (resizable[at + 1]?.key ?? null) : null;
    const config = this.config;
    const minWidth = resolveMinWidth(column.width, config.minWidth);
    const maxWidth = config.maxWidth ?? Number.POSITIVE_INFINITY;
    const override = this.#widths()[column.key];
    if (override != null) {
      props.htmlProps.style = {
        ...props.htmlProps.style,
        width: `${override}px`,
        'min-width': `${override}px`,
        'max-width': `${override}px`,
      };
    }
    (props.htmlProps.classes ??= []).push('tct-table-resizable');
    const label = typeof column.header === 'string' ? column.header : column.key;
    props.overlay = html`${props.overlay ?? nothing}
      <div
        class="tct-table-resize-handle"
        role="separator"
        aria-orientation="vertical"
        tabindex="0"
        data-column-key=${column.key}
        aria-label=${this.translate('@tct.table.resize.handleLabel', {label})}
        aria-valuemin=${minWidth}
        aria-valuemax=${ifDefined(Number.isFinite(maxWidth) ? maxWidth : undefined)}
        @pointerdown=${(event: PointerEvent) => {
          this.#pointerDown(event, column.key, neighborKey, minWidth);
        }}
        @keydown=${(event: KeyboardEvent) => {
          this.#keyDown(event, column.key, neighborKey, minWidth, maxWidth);
        }}
      ></div>`;
    return props;
  };

  /** Keeps `aria-valuenow` at the measured width and the handles as tall as the table. */
  updated = (table: TablePluginHost): void => {
    const element = table.element.querySelector<HTMLTableElement>('table');
    if (!element) return;
    this.#syncHandles(element);
    if (this.#observed !== element) {
      this.#stopObserving?.();
      this.#observed = element;
      this.#stopObserving = observeResize(element, () => {
        this.#syncHandles(element);
      });
    }
  };

  #syncHandles(table: HTMLTableElement): void {
    table.style.setProperty('--_table-resize-height', `${table.getBoundingClientRect().height}px`);
    for (const handle of table.querySelectorAll<HTMLElement>('.tct-table-resize-handle')) {
      const th = handle.closest('th');
      if (!th) continue;
      this.#setValue(handle, th.getBoundingClientRect().width);
    }
  }

  #setValue(handle: HTMLElement, width: number): void {
    const rounded = Math.round(width);
    handle.setAttribute('aria-valuenow', String(rounded));
    handle.setAttribute(
      'aria-valuetext',
      this.translate('@tct.table.resize.handleValueText', {width: rounded}),
    );
  }

  #multiplier(element: Element): number {
    return getComputedStyle(element).direction === 'rtl' ? -1 : 1;
  }

  /** Snapshots every resizable column of the row `th` belongs to. */
  #snapshot(
    th: HTMLTableCellElement,
    key: string,
    neighborKey: string | null,
    minWidth: number,
  ): Drag | null {
    const row = th.parentElement;
    const table = th.closest('table');
    if (!row || !table) return null;
    const byKey = new Map(this.#columns.map((column) => [column.key, column]));
    const overrides = this.#widths();
    const config = this.config;
    const snapshots: Snapshot[] = [];
    for (const cell of row.querySelectorAll<HTMLTableCellElement>(':scope > th')) {
      const cellKey = cell.getAttribute('data-column-key');
      if (!cellKey) continue;
      const column = byKey.get(cellKey);
      if (column?.resizable === false) continue;
      const rendered = cell.getBoundingClientRect().width;
      snapshots.push({
        key: cellKey,
        th: cell,
        initialWidth: overrides[cellKey] ?? (rendered > 0 ? rendered : 0),
        minWidth: column ? resolveMinWidth(column.width, config.minWidth) : minWidth,
        maxWidth: config.maxWidth ?? Number.POSITIVE_INFINITY,
      });
    }
    const resizeIndex = snapshots.findIndex((snapshot) => snapshot.key === key);
    if (resizeIndex < 0) return null;
    const neighbor = neighborKey
      ? snapshots.findIndex((snapshot) => snapshot.key === neighborKey)
      : -1;
    return {
      startX: 0,
      resizeIndex,
      neighborIndex: neighbor >= 0 ? neighbor : null,
      snapshots,
      tableWidth: table.getBoundingClientRect().width,
    };
  }

  #apply(drag: Drag, widths: number[]): void {
    drag.snapshots.forEach((snapshot, i) => {
      const px = `${widths[i]!}px`;
      snapshot.th.style.width = px;
      snapshot.th.style.minWidth = px;
      snapshot.th.style.maxWidth = px;
      const handle = snapshot.th.querySelector<HTMLElement>('.tct-table-resize-handle');
      if (handle) this.#setValue(handle, widths[i]!);
    });
  }

  /** Reports the widths of every column except the last, which flexes. */
  #commit(drag: Drag, widths: number[]): void {
    const updates: Record<string, number> = {};
    drag.snapshots.forEach((snapshot, i) => {
      if (i !== drag.snapshots.length - 1)
        updates[snapshot.key] = Math.round(widths[i]! * 100) / 100;
    });
    if (Object.keys(updates).length === 0) return;
    if (this.config.columnWidths === undefined) this.#local = {...this.#local, ...updates};
    this.config.onColumnResizeEnd?.(updates);
    this.refresh();
  }

  #pointerDown(
    event: PointerEvent,
    key: string,
    neighborKey: string | null,
    minWidth: number,
  ): void {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const handle = event.currentTarget as HTMLElement;
    const th = handle.closest('th');
    const drag = th ? this.#snapshot(th, key, neighborKey, minWidth) : null;
    if (!th || !drag) return;
    drag.startX = event.clientX;
    const sign = this.#multiplier(th);
    const table = th.closest('table')!;
    try {
      // Keeps the drag on the handle when the pointer leaves it; a synthetic pointer has nothing to capture.
      handle.setPointerCapture(event.pointerId);
    } catch {
      // Not fatal: the listeners below still follow the handle.
    }
    handle.setAttribute('data-resizing', '');
    table.style.userSelect = 'none';
    // Freeze every column at its current width so the drag moves one boundary.
    this.#apply(drag, computeColumnWidths(drag, 0));

    const widthsAt = (clientX: number): number[] =>
      computeColumnWidths(drag, (clientX - drag.startX) * sign);
    const finish = (): void => {
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', onUp);
      handle.removeEventListener('pointercancel', onCancel);
      handle.removeAttribute('data-resizing');
      table.style.userSelect = '';
    };
    const onMove = (move: PointerEvent): void => {
      this.#apply(drag, widthsAt(move.clientX));
    };
    const onUp = (up: PointerEvent): void => {
      finish();
      this.#commit(drag, widthsAt(up.clientX));
    };
    const onCancel = (): void => {
      finish();
      // Back to the widths before the drag.
      for (const snapshot of drag.snapshots) {
        snapshot.th.style.width = '';
        snapshot.th.style.minWidth = '';
        snapshot.th.style.maxWidth = '';
      }
      this.refresh();
    };
    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onUp);
    handle.addEventListener('pointercancel', onCancel);
  }

  #keyDown(
    event: KeyboardEvent,
    key: string,
    neighborKey: string | null,
    minWidth: number,
    maxWidth: number,
  ): void {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
    const th = (event.currentTarget as HTMLElement).closest('th');
    if (!th) return;
    let delta: number | null = null;
    const current = th.getBoundingClientRect().width;
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowLeft': {
        const step = event.shiftKey ? KEYBOARD_LARGE_STEP : KEYBOARD_STEP;
        delta = step * (event.key === 'ArrowRight' ? 1 : -1) * this.#multiplier(th);
        break;
      }
      case 'Home':
        delta = minWidth - current;
        break;
      case 'End':
        if (Number.isFinite(maxWidth)) delta = maxWidth - current;
        break;
      default:
        return;
    }
    event.preventDefault();
    if (delta === null) return;
    const drag = this.#snapshot(th, key, neighborKey, minWidth);
    if (!drag) return;
    const widths = computeColumnWidths(drag, delta);
    this.#apply(drag, widths);
    this.#commit(drag, widths);
  }
}
