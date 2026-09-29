/**
 * Grid focus (upstream `useGridFocus`, MIT, adapted): keyboard navigation of a two-dimensional widget
 * (a month of days, a table of cells) following the WAI-ARIA grid pattern, with one roving tab stop.
 *
 * - Arrow keys move by one cell across and by one row up and down; the horizontal arrows swap in
 *   right-to-left layouts, read from the container's computed direction (WCAG 1.3.2).
 * - Home and End go to the first and last focusable cell of the row; Ctrl or Cmd with them, of the grid.
 * - PageUp and PageDown are the host's business (a calendar moves by month, Shift by year): they call
 *   `onPageUp` / `onPageDown` with the event, so the modifier is readable.
 * - The controller enumerates ALL cells `cellSelector` matches, disabled and empty ones included, so the
 *   real column geometry is kept; a move that lands on a cell `isCellFocusable` rejects continues in the
 *   same direction to the next focusable one. When nothing is left in that direction it calls
 *   `onNavigateBefore` / `onNavigateAfter` (a calendar turns the month) and otherwise does nothing:
 *   the event is left alone so the browser can scroll [mwg:spatial-navigation].
 * - With `hasRovingTabIndex` it owns the tab stop: exactly one focusable target has `tabindex="0"`, it
 *   moves with focus, and it is repaired after every host update (`initialTabStop` seeds it).
 *
 * The cells live in the host's tree (usually its shadow root); the controller never queries outside
 * `container`, and finds the focused cell through the container's own root.
 *
 * ```ts
 * readonly #grid: GridFocusController = new GridFocusController(this, {
 *   container: () => this.renderRoot.querySelector('[role="grid"]'),
 *   columns: 7,
 *   cellSelector: '[role="gridcell"]',
 *   isCellFocusable: (cell) => cell.querySelector('button:not([disabled])') !== null,
 *   getFocusTarget: (cell) => cell.querySelector('button'),
 *   hasRovingTabIndex: true,
 * });
 * // <div role="grid" @keydown=${this.#grid.handleKeyDown} @focusin=${this.#grid.handleFocus}>
 * ```
 */
import type {ReactiveController, ReactiveControllerHost} from 'lit';
import {deepActiveElement} from '../utils/focus.js';
import {isImeKeyEvent} from '../utils/ime.js';

export interface GridFocusOptions {
  /** The grid element that holds the cells (and receives the key events). */
  container: () => HTMLElement | null;
  /** Number of columns (vertical moves step by this many cells). */
  columns: number | (() => number);
  /**
   * Selector for ALL cell positions in DOM order, focusable or not, so row and column are computed on
   * the true grid. Default: `button:not([disabled]), [tabindex]:not([tabindex="-1"])`.
   */
  cellSelector?: string;
  /** Whether a cell can take focus (default: every matched cell). */
  isCellFocusable?: (cell: HTMLElement) => boolean;
  /** The element to focus for a cell (default: the cell itself), e.g. the button inside a gridcell. */
  getFocusTarget?: (cell: HTMLElement) => HTMLElement | null;
  /** Called when a move would leave the grid before its first cell; `offset` is 1 (across) or `columns` (a row). */
  onNavigateBefore?: (column: number, offset: number) => void;
  /** Called when a move would leave the grid after its last cell. */
  onNavigateAfter?: (column: number, offset: number) => void;
  /** PageUp (a calendar: previous month; with Shift, previous year). Not handled when absent. */
  onPageUp?: (event: KeyboardEvent) => void;
  /** PageDown. */
  onPageDown?: (event: KeyboardEvent) => void;
  /** The controller owns a single tab stop (`tabindex` 0 on one target, -1 on the rest). Default `false`. */
  hasRovingTabIndex?: boolean;
  /** Which target starts as the tab stop when none has `tabindex="0"` yet (default: the first). */
  initialTabStop?: (targets: HTMLElement[]) => HTMLElement | null | undefined;
  /** Right-to-left override (default: the container's computed `direction`). */
  isRtl?: () => boolean;
}

const DEFAULT_CELL_SELECTOR = 'button:not([disabled]), [tabindex]:not([tabindex="-1"])';

export class GridFocusController implements ReactiveController {
  readonly #options: GridFocusOptions;

  constructor(host: ReactiveControllerHost & HTMLElement, options: GridFocusOptions) {
    this.#options = options;
    host.addController(this);
  }

  hostUpdated(): void {
    if (this.#options.hasRovingTabIndex) this.syncTabStops();
  }

  get #columns(): number {
    const columns = this.#options.columns;
    return Math.max(1, typeof columns === 'function' ? columns() : columns);
  }

  #cells(): HTMLElement[] {
    const container = this.#options.container();
    if (!container) return [];
    return [
      ...container.querySelectorAll<HTMLElement>(
        this.#options.cellSelector ?? DEFAULT_CELL_SELECTOR,
      ),
    ];
  }

  #focusable(cell: HTMLElement | undefined): boolean {
    if (!cell) return false;
    return this.#options.isCellFocusable ? this.#options.isCellFocusable(cell) : true;
  }

  #target(cell: HTMLElement | undefined): HTMLElement | null {
    if (!cell) return null;
    return this.#options.getFocusTarget ? this.#options.getFocusTarget(cell) : cell;
  }

  /** The focus targets of the focusable cells, in DOM order: they carry the roving tab stop. */
  #targets(): HTMLElement[] {
    return this.#cells()
      .filter((cell) => this.#focusable(cell))
      .map((cell) => this.#target(cell))
      .filter((element): element is HTMLElement => element !== null);
  }

  static #setTabIndex(element: HTMLElement, value: 0 | -1): void {
    if (element.getAttribute('tabindex') !== String(value)) {
      element.setAttribute('tabindex', String(value));
    }
  }

  /**
   * Repairs the roving tab stop: exactly one focusable target keeps (or gets) `tabindex="0"`. An existing
   * `0` is honoured, then `initialTabStop`, then the first target.
   */
  syncTabStops(): void {
    const targets = this.#targets();
    if (targets.length === 0) return;
    const current = targets.find((element) => element.getAttribute('tabindex') === '0');
    const tabbable = current ?? this.#options.initialTabStop?.(targets) ?? targets[0]!;
    for (const element of targets)
      GridFocusController.#setTabIndex(element, element === tabbable ? 0 : -1);
  }

  /**
   * Puts the roving stop on `target` without focusing it, when it is one of this grid's targets (the way a
   * calendar reopens on the selected day instead of wherever focus was last left).
   */
  setTabStop(target: HTMLElement): boolean {
    if (!this.#options.hasRovingTabIndex || !this.#targets().includes(target)) return false;
    this.#focusTargetSilently(target);
    return true;
  }

  /** Forgets where the roving stop was: it goes back to the seed (`initialTabStop`, else the first target). */
  resetTabStop(): void {
    if (!this.#options.hasRovingTabIndex) return;
    for (const element of this.#targets()) GridFocusController.#setTabIndex(element, -1);
    this.syncTabStops();
  }

  /** Moves the roving stop to `target` (when enabled) and focuses it. */
  #focusTarget(target: HTMLElement | null): void {
    if (!target) return;
    if (this.#options.hasRovingTabIndex) {
      for (const element of this.#targets()) {
        GridFocusController.#setTabIndex(element, element === target ? 0 : -1);
      }
    }
    target.focus();
  }

  #focusCellWithStop(cell: HTMLElement | undefined): boolean {
    const target = this.#target(cell);
    if (!target) return false;
    this.#focusTarget(target);
    return true;
  }

  /** Keeps the roving stop on whatever ended up focused (a click, a programmatic focus). */
  readonly handleFocus = (): void => {
    if (this.#options.hasRovingTabIndex) {
      const active = this.#activeTarget();
      if (active) this.#focusTargetSilently(active);
      else this.syncTabStops();
    }
  };

  /** The focus target that currently holds focus, if it is one of ours. */
  #activeTarget(): HTMLElement | null {
    const container = this.#options.container();
    if (!container) return null;
    const active = deepActiveElement(container.getRootNode() as Document | ShadowRoot);
    return this.#targets().find((element) => element === active) ?? null;
  }

  #focusTargetSilently(target: HTMLElement): void {
    for (const element of this.#targets()) {
      GridFocusController.#setTabIndex(element, element === target ? 0 : -1);
    }
  }

  #currentIndex(cells: HTMLElement[]): number {
    const container = this.#options.container();
    if (!container) return -1;
    const active = deepActiveElement(container.getRootNode() as Document | ShadowRoot);
    return cells.findIndex((cell) => cell === active || cell.contains(active));
  }

  /** The index of the first focusable cell from `start` moving by `step`, or -1 past either edge. */
  #findFocusable(cells: HTMLElement[], start: number, step: number): number {
    for (let index = start; index >= 0 && index < cells.length; index += step) {
      if (this.#focusable(cells[index])) return index;
    }
    return -1;
  }

  /** Focuses a cell by index, searching forward then backward for the nearest focusable one. */
  focusCell(index: number): void {
    const cells = this.#cells();
    if (cells.length === 0) return;
    const clamped = Math.max(0, Math.min(index, cells.length - 1));
    let found = this.#findFocusable(cells, clamped, 1);
    if (found === -1) found = this.#findFocusable(cells, clamped, -1);
    if (found !== -1) this.#focusCellWithStop(cells[found]);
  }

  /** Focuses the first focusable cell. */
  focusFirst(): void {
    const cells = this.#cells();
    const index = this.#findFocusable(cells, 0, 1);
    if (index !== -1) this.#focusCellWithStop(cells[index]);
  }

  /** Focuses the last focusable cell. */
  focusLast(): void {
    const cells = this.#cells();
    const index = this.#findFocusable(cells, cells.length - 1, -1);
    if (index !== -1) this.#focusCellWithStop(cells[index]);
  }

  /** The key handler for the grid container. */
  readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (event.defaultPrevented || isImeKeyEvent(event)) return;
    const cells = this.#cells();
    if (cells.length === 0) return;
    const current = this.#currentIndex(cells);
    if (current === -1) return;

    const columns = this.#columns;
    const row = Math.floor(current / columns);
    const column = current % columns;
    const rows = Math.ceil(cells.length / columns);
    const command = event.ctrlKey || event.metaKey;
    // Alt and the browser's shortcuts (Alt+Left is "back") belong to the browser.
    if (event.altKey) return;

    let key = event.key;
    if ((key === 'ArrowLeft' || key === 'ArrowRight') && this.#rtl()) {
      key = key === 'ArrowLeft' ? 'ArrowRight' : 'ArrowLeft';
    }

    let handled = true;
    switch (key) {
      case 'ArrowRight':
      case 'ArrowLeft': {
        if (command) return;
        const step = key === 'ArrowRight' ? 1 : -1;
        const target = this.#findFocusable(cells, current + step, step);
        if (target !== -1) this.#focusCellWithStop(cells[target]);
        else if (step > 0) this.#options.onNavigateAfter?.((column + 1) % columns, 1);
        else this.#options.onNavigateBefore?.(column === 0 ? columns - 1 : column - 1, 1);
        break;
      }
      case 'ArrowDown':
      case 'ArrowUp': {
        if (command) return;
        const step = key === 'ArrowDown' ? columns : -columns;
        const atEdge = key === 'ArrowDown' ? row >= rows - 1 : row <= 0;
        const target = atEdge ? -1 : this.#findFocusable(cells, current + step, step);
        if (target !== -1) this.#focusCellWithStop(cells[target]);
        else if (step > 0) this.#options.onNavigateAfter?.(column, columns);
        else this.#options.onNavigateBefore?.(column, columns);
        break;
      }
      case 'Home':
      case 'End': {
        if (command) {
          if (key === 'Home') this.focusFirst();
          else this.focusLast();
          break;
        }
        const rowStart = row * columns;
        const rowEnd = Math.min(rowStart + columns - 1, cells.length - 1);
        const target =
          key === 'Home'
            ? this.#findFocusable(cells, rowStart, 1)
            : this.#findFocusable(cells, rowEnd, -1);
        const inRow = key === 'Home' ? target <= rowEnd : target >= rowStart;
        if (target !== -1 && inRow) this.#focusCellWithStop(cells[target]);
        break;
      }
      case 'PageUp':
        if (command || !this.#options.onPageUp) return;
        this.#options.onPageUp(event);
        break;
      case 'PageDown':
        if (command || !this.#options.onPageDown) return;
        this.#options.onPageDown(event);
        break;
      default:
        handled = false;
    }
    if (handled) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  #rtl(): boolean {
    if (this.#options.isRtl) return this.#options.isRtl();
    const container = this.#options.container();
    return container ? getComputedStyle(container).direction === 'rtl' : false;
  }
}
