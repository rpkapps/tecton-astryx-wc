import {
  html,
  nothing,
  unsafeCSS,
  type CSSResult,
  type PropertyValues,
  type TemplateResult,
} from 'lit';
import {property} from 'lit/decorators.js';
import {guard} from 'lit/directives/guard.js';
import {repeat} from 'lit/directives/repeat.js';
import {announce} from '@tecton-wc/core/a11y/announcer.js';
import {ContextProvider} from '@tecton-wc/core/context/protocol.js';
import {observeResize} from '@tecton-wc/core/controllers/resize.js';
import {LocaleController} from '@tecton-wc/core/i18n/locale-controller.js';
import {adoptLightDomStyles} from '@tecton-wc/core/styles/light-dom.js';
import {TctElement} from '@tecton-wc/core/tct-element.js';
import {devWarn} from '@tecton-wc/core/utils/dev.js';
import {deepActiveElement} from '@tecton-wc/core/utils/focus.js';
import {isImeKeyEvent} from '@tecton-wc/core/utils/ime.js';
import tableMessages from '@tecton-wc/locales/en/table.js';
import treeMessages from '@tecton-wc/locales/en/tableTree.js';
import expansionMessages from '@tecton-wc/locales/en/tableRowExpansion.js';
import groupedMessages from '@tecton-wc/locales/en/tableGroupedRows.js';
import {TctEmptyState} from '../empty-state/tct-empty-state.js';
import {TctText} from '../text/tct-text.js';
import type {TctContextMenu} from '../context-menu/tct-context-menu.js';
import {tableContext} from './table.context.js';
import {resolveContextActions, toMenuOptions} from './table.context-menu.js';
import {applyPlugins, BaseTablePlugins} from './table.pipeline.js';
import {
  TABLE_DENSITIES,
  TABLE_DIVIDERS,
  TABLE_TEXT_OVERFLOWS,
  TABLE_VERTICAL_ALIGNS,
  type BodyCellRenderProps,
  type BodyRowRenderProps,
  type HeaderCellRenderProps,
  type HeaderRowRenderProps,
  type ScrollWrapperRenderProps,
  type TableColumn,
  type TableContent,
  type TableContextAction,
  type TableContextActions,
  type TableDensity,
  type TableDividers,
  type TableHtmlProps,
  type TableIdKey,
  type TablePlugin,
  type TablePluginHost,
  type TablePluginRecord,
  type TableRenderProps,
  type TableTextOverflow,
  type TableVerticalAlign,
} from './table.types.js';
import {
  defaultCellRenderer,
  generateColumns,
  resolveColumnWidths,
  type ResolvedColumnWidths,
} from './table.utils.js';
import {contextActionsOf, tableProps} from './table-props.directive.js';
import {yieldToMain} from './table-scheduler.js';
import lightStyles from './tct-table.light.css?inline';

/** Datasets up to this many rows render in one synchronous update; larger ones render progressively. */
export const TABLE_SYNC_ROW_LIMIT = 200;
/** Rows of the first chunk of a progressive render: a screenful, so the first paint is quick. */
const FIRST_CHUNK = 60;
/** Time budget of one chunk of a progressive render (ms), well below the 50 ms long-task line. */
const CHUNK_BUDGET_MS = 16;
const MIN_CHUNK = 40;
const MAX_CHUNK = 1500;

type Row = Record<string, unknown>;

/** The message catalogs the table and its plugins draw from, by namespace (the middle id segment). */
const MESSAGE_DEFAULTS: Record<string, Readonly<Record<string, string>>> = {
  table: tableMessages,
  tableTree: treeMessages,
  tableRowExpansion: expansionMessages,
  tableGroupedRows: groupedMessages,
};

let lightSheet: CSSResult | undefined;

function oneOf<V extends string>(allowed: readonly V[], value: V, fallback: V, name: string): V {
  if (allowed.includes(value)) return value;
  devWarn(
    `table:${name}:${String(value)}`,
    `<tct-table ${name}="${String(value)}"> is not one of ${allowed.join(', ')}; using ${fallback}.`,
  );
  return fallback;
}

/**
 * A data table. Give it `columns` and `data` (properties) and it renders a native `<table>` into its
 * own light DOM, so cell renderers can return markup styled by the page and assistive technology
 * meets an ordinary table: `table`, `rowgroup`, `row`, `columnheader` and `cell`, never a `grid`.
 * Author light DOM (`<table>` markup, or `tct-table-header`, `-body`, `-footer`, `-row`, `-cell` and
 * `-header-cell` elements) is the children mode: styled the same way, never rendered from data.
 *
 * Behaviour comes from plugins: `plugins` is a record of named plugin controllers (sorting, selection,
 * pagination, column settings, resizing, sticky columns, grouped rows, row index and status, row
 * expansion, tree data). Each is a transform over the render props of one structural level, applied in
 * a canonical order. Interactive plugins add their own controls (buttons, checkboxes, a separator
 * handle) to the cells, in the tab order; the table is not a grid and adds no arrow-key model.
 *
 * Large datasets render progressively: the first rows in one update and the rest in chunks that each
 * stay well under the long-task line, so an interaction such as sorting ten thousand rows paints
 * quickly. `updateComplete` resolves when every row has been rendered.
 * [mwg:break-up-long-tasks] [mwg:interactions-in-complex-layouts] [mwg:responsive-table]
 *
 * @summary A data table with density, dividers, striping, hover and a plugin pipeline.
 * @tag tct-table
 * @upstream Table
 * @cssprop --container-padding-inline-start - Read from an enclosing padded container (a card, a section): the table bleeds to its edge and its first column lines up with its content inset.
 * @cssprop --container-padding-inline-end - Read like the inline-start one, for the inline end.
 * @cssprop --container-padding-block-start - Read from an enclosing padded container: a table that is the first child bleeds to its block-start edge.
 * @cssprop --container-padding-block-end - Read like the block-start one, for the last child.
 * @cssprop --table-sticky-background - Opaque fill of pinned (sticky) body cells so scrolled content does not show through. Default the card background.
 * @cssstate scrollable - The columns overflow the width and the scroll region is keyboard reachable.
 * @cloakDisplay block
 */
export class TctTable<T extends Row = Row> extends TctElement {
  static override readonly tagName = 'tct-table';
  static override readonly dependencies = [TctEmptyState, TctText];

  /** Row density: cell padding. */
  @property({reflect: true}) density: TableDensity = 'balanced';

  /** Where dividers show between cells: `rows` (default), `columns`, `grid` or `none`. */
  @property({reflect: true}) dividers: TableDividers = 'rows';

  /** Washes the even body rows. */
  @property({type: Boolean, reflect: true}) striped = false;

  /** Highlights the row under the pointer (pointer devices only). */
  @property({type: Boolean, reflect: true, attribute: 'has-hover'}) hasHover = false;

  /** Vertical alignment of body cells: `middle` (default), `top` or `bottom`. */
  @property({reflect: true, attribute: 'vertical-align'}) verticalAlign: TableVerticalAlign =
    'middle';

  /**
   * How default-rendered body text behaves when wider than its column: `wrap` (default) lets the row
   * grow, `truncate` clips with an ellipsis and a tooltip when text is cut. Header cells always
   * truncate; cells with `renderCell` control their own overflow.
   */
  @property({reflect: true, attribute: 'text-overflow'}) textOverflow: TableTextOverflow = 'wrap';

  /** Accessible name of the scroll region. Default: the localised "Table". */
  @property() label = '';

  /**
   * `aria-rowindex` of the first rendered body row (1-based). Setting this or `row-count` opts the
   * table into `aria-rowindex` on body rows and `aria-rowcount` on the table: pass the offset of the
   * first visible row of a paginated view (`(page - 1) * pageSize + 1`). Data-driven mode only.
   */
  @property({type: Number, attribute: 'row-index-start'}) rowIndexStart: number | undefined;

  /**
   * Total number of body rows across all pages, for `aria-rowcount`. With only `row-index-start` set
   * the count is `-1`, ARIA's "unknown". Data-driven mode only.
   */
  @property({type: Number, attribute: 'row-count'}) rowCount: number | undefined;

  /** Text of the default empty state (shown when `data` is an empty array). Default: the localised "No data". */
  @property({attribute: 'empty-label'}) emptyLabel = '';

  /** Turns the empty state off: an empty `data` renders an empty `<tbody>`. */
  @property({type: Boolean, attribute: 'no-empty-state'}) noEmptyState = false;

  /**
   * Content shown in a full-width row when `data` is an empty array: a template, a node (an empty-state
   * element) or text. `false` disables it. Unset: a compact default empty state.
   */
  @property({attribute: false}) emptyState: TableContent | false | undefined;

  /** Row data (property only). `T` is any object type; cells read the row by column key. */
  @property({attribute: false}) data: T[] | undefined;

  /** Column definitions (property only). Omitted with `data` set: generated from the keys of the first row. */
  @property({attribute: false}) columns: TableColumn<T>[] | undefined;

  /**
   * Stable identity of a row: a property name (`id-key="id"`) or a function. It keys the row elements,
   * so a row keeps its element (and focus) as the data reorders. Omitted: the row index.
   */
  @property({attribute: 'id-key'}) idKey: TableIdKey<T> | undefined;

  /**
   * Named plugins (property only): `{sort, selection, pagination, ...}`. The values are plugin
   * controllers; the record may be recreated inline, only its values are compared. Known names apply in
   * the canonical order columnSettings, sort, tree, selection, pagination; other names follow in record
   * order.
   */
  @property({attribute: false}) plugins: TablePluginRecord<T> | undefined;

  /** The rendered `<table>` (data mode), or the first `<table>` child (children mode). */
  get tableElement(): HTMLTableElement | null {
    return this.querySelector<HTMLTableElement>('table');
  }

  /** The element that scrolls horizontally: the inner region in data mode, the table itself in children mode. */
  get scrollRegion(): HTMLElement | null {
    return this.#children ? this : this.querySelector<HTMLElement>('.tct-table-scroll');
  }

  /** Whether the columns overflow the width, so the scroll region is keyboard reachable. */
  get scrollable(): boolean {
    return this.#scrollable;
  }

  /** Body rows currently in the DOM; less than `data.length` only while a large render is in progress. */
  get renderedRowCount(): number {
    return this.#rendered;
  }

  /**
   * Turns on the table's shared context menu. Table parts that carry `contextMenuActions`
   * (`tct-table-cell` and friends) call it; plugins that contribute actions turn it on themselves.
   * @internal
   */
  enableContextMenu(): void {
    if (this.#menuWanted) return;
    this.#menuWanted = true;
    void import('../context-menu/define.js');
    this.requestUpdate();
  }

  /** The plugin-facing view of this table (translation, direction, announcements). */
  get pluginHost(): TablePluginHost {
    return this.#pluginHost;
  }

  /** Text direction: the provider's, else the computed direction of the table. */
  get direction(): 'ltr' | 'rtl' {
    return this.#locales.table!.dir;
  }

  /** Localised message by full id (`@tct.table.sort.ascending`), from the catalog of its namespace. */
  t(id: string, args?: Record<string, unknown>): string {
    const namespace = /^@tct\.([^.]+)\./.exec(id)?.[1] ?? 'table';
    return (this.#locales[namespace] ?? this.#locales.table!).t(id, args);
  }

  // ----------------------------------------------------------------------------- internals

  readonly #locales: Record<string, LocaleController> = Object.fromEntries(
    Object.entries(MESSAGE_DEFAULTS).map(([namespace, defaults]) => [
      namespace,
      new LocaleController(this, {namespace, defaults}),
    ]),
  );
  readonly #context: ContextProvider<typeof tableContext> = new ContextProvider<
    typeof tableContext
  >(this, {context: tableContext, initialValue: null});
  readonly #resolver: BaseTablePlugins<T> = new BaseTablePlugins<T>(null, []);
  readonly #pluginHost: TablePluginHost;
  #attached: readonly TablePlugin<T>[] = [];
  #resolved: TablePlugin<T>[] = [];
  #columns: TableColumn<T>[] = [];
  #widths: ResolvedColumnWidths | undefined;
  #widthsFor: TableColumn<T>[] | undefined;

  #scrollable = false;
  #stopObserving: (() => void)[] = [];
  #observed: Element | null = null;
  #children = false;
  #childrenObserver: MutationObserver | undefined;

  // Progressive rendering.
  #limit = Number.POSITIVE_INFINITY;
  #rendered = 0;
  #chunk = FIRST_CHUNK;
  #chunkStart = 0;
  #chunkFrom = 0;
  #rowBlockSize = 0;
  #progress: {promise: Promise<void>; resolve: () => void} | null = null;
  #chunkQueued = false;

  #menuWanted = false;
  #menuOpener: HTMLElement | null = null;

  constructor() {
    super();
    // eslint-disable-next-line @typescript-eslint/no-this-alias -- the plugin host reads live table state
    const table = this;
    this.#pluginHost = {
      element: this,
      requestUpdate: () => {
        this.requestUpdate();
      },
      get dir() {
        return table.direction;
      },
      translate: (id, args) => this.t(id, args),
      announce: (message, politeness = 'polite') => {
        announce(message, {politeness, element: this});
      },
      collator: (options) => this.#locales.table!.collator(options),
    };
  }

  // ----------------------------------------------------------------------------- lifecycle

  /** Renders into the table itself (light DOM); authored children stay after the rendered content. */
  protected override createRenderRoot(): HTMLElement {
    this.renderOptions.renderBefore ??= this.firstChild;
    return this;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    adoptLightDomStyles(this, (lightSheet ??= unsafeCSS(lightStyles)));
    this.#childrenObserver ??= new MutationObserver(() => {
      if (this.#detectChildren() !== this.#children) this.requestUpdate();
    });
    this.#childrenObserver.observe(this, {childList: true});
    this.addEventListener('contextmenu', this.#onContextMenu);
    this.addEventListener('keydown', this.#onKeyDown);
    for (const plugin of this.#attached) plugin.attach?.(this.#pluginHost);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#childrenObserver?.disconnect();
    this.removeEventListener('contextmenu', this.#onContextMenu);
    this.removeEventListener('keydown', this.#onKeyDown);
    this.#releaseObservers();
    for (const plugin of this.#attached) plugin.detach?.(this.#pluginHost);
    this.#finishProgress();
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('density')) {
      this.density = oneOf(TABLE_DENSITIES, this.density, 'balanced', 'density');
    }
    if (changed.has('dividers')) {
      this.dividers = oneOf(TABLE_DIVIDERS, this.dividers, 'rows', 'dividers');
    }
    if (changed.has('verticalAlign')) {
      this.verticalAlign = oneOf(
        TABLE_VERTICAL_ALIGNS,
        this.verticalAlign,
        'middle',
        'vertical-align',
      );
    }
    if (changed.has('textOverflow')) {
      this.textOverflow = oneOf(TABLE_TEXT_OVERFLOWS, this.textOverflow, 'wrap', 'text-overflow');
    }

    this.#children = this.#detectChildren();
    this.toggleAttribute('data-children', this.#children);
    this.internals.role = this.#children ? (this.#usesCustomParts() ? 'table' : 'group') : null;
    this.internals.ariaLabel = this.#children ? this.#label() : null;

    // Plugins: resolve, attach the new ones, detach the ones that left.
    this.#resolved = this.#resolver.resolve(this.plugins);
    if (
      this.#resolved.length !== this.#attached.length ||
      this.#resolved.some((p, i) => p !== this.#attached[i])
    ) {
      this.#syncAttached();
    }

    // Progressive rendering restarts whenever the rows change.
    if (
      changed.has('data') ||
      changed.has('columns') ||
      changed.has('plugins') ||
      changed.has('idKey')
    ) {
      const total = this.data?.length ?? 0;
      this.#limit = total > TABLE_SYNC_ROW_LIMIT ? FIRST_CHUNK : Number.POSITIVE_INFINITY;
    }
    this.#chunkStart = performance.now();
    this.#chunkFrom = this.#rendered;

    this.#context.setValue({
      density: this.density,
      dividers: this.dividers,
      striped: this.striped,
      hasHover: this.hasHover,
      verticalAlign: this.verticalAlign,
      textOverflow: this.textOverflow,
    });

    if (this.#resolved.some((plugin) => contributesActions(plugin))) this.enableContextMenu();
  }

  protected override updated(): void {
    this.toggleState('scrollable', this.#scrollable);
    this.#syncHostScrollRegion();
    this.#observeScroll();
    this.#advanceProgress();
  }

  protected override async getUpdateComplete(): Promise<boolean> {
    let result = await super.getUpdateComplete();
    while (this.#progress) {
      await this.#progress.promise;
      result = await super.getUpdateComplete();
    }
    return result;
  }

  // ------------------------------------------------------------------------------- children mode

  /** Children mode: no data and no columns, and light DOM children of our own to style. */
  #detectChildren(): boolean {
    if (this.data !== undefined || this.columns !== undefined) return false;
    for (const child of this.children) {
      if (child.localName === 'table' || child.localName.startsWith('tct-table-')) return true;
    }
    return false;
  }

  /** Whether the children are `tct-table-*` elements (ARIA roles) instead of a native `<table>`. */
  #usesCustomParts(): boolean {
    for (const child of this.children) if (child.localName === 'table') return false;
    return true;
  }

  // --------------------------------------------------------------------------------- plugins

  #syncAttached(): void {
    const next = this.#resolved;
    for (const plugin of this.#attached)
      if (!next.includes(plugin)) plugin.detach?.(this.#pluginHost);
    for (const plugin of next)
      if (!this.#attached.includes(plugin)) plugin.attach?.(this.#pluginHost);
    this.#attached = next;
  }

  #revision(): number {
    let revision = 0;
    for (const plugin of this.#resolved) revision += (plugin as {revision?: number}).revision ?? 0;
    return revision;
  }

  // --------------------------------------------------------------------------- progressive render

  #advanceProgress(): void {
    if (this.#children) {
      this.#rendered = 0;
      this.#finishProgress();
      return;
    }
    const total = this.data?.length ?? 0;
    const rendered = Math.min(this.#limit, total);
    // Size the next chunk from what this one cost.
    const rows = rendered - this.#chunkFrom;
    if (rows > 20) {
      const perRow = (performance.now() - this.#chunkStart) / rows;
      this.#chunk = Math.max(
        MIN_CHUNK,
        Math.min(MAX_CHUNK, Math.floor(CHUNK_BUDGET_MS / Math.max(perRow, 0.001))),
      );
    }
    this.#rendered = rendered;
    if (this.#limit >= total) {
      this.#finishProgress();
      return;
    }
    // The spacer for rows still to come is sized from a real row.
    if (this.#rowBlockSize === 0) {
      const row = this.querySelector<HTMLElement>('tbody > tr:not(.tct-table-pending)');
      const height = row?.getBoundingClientRect().height ?? 0;
      if (height > 0) {
        this.#rowBlockSize = height;
        this.style.setProperty('--_table-row-block-size', `${height}px`);
      }
    }
    if (!this.#progress) {
      let resolve!: () => void;
      const promise = new Promise<void>((done) => {
        resolve = done;
      });
      this.#progress = {promise, resolve};
    }
    if (this.#chunkQueued) return;
    this.#chunkQueued = true;
    void yieldToMain().then(() => {
      this.#chunkQueued = false;
      if (!this.isConnected) {
        this.#finishProgress();
        return;
      }
      this.#limit += this.#chunk;
      this.requestUpdate();
    });
  }

  #finishProgress(): void {
    const progress = this.#progress;
    this.#progress = null;
    progress?.resolve();
  }

  // ----------------------------------------------------------------------------------- scrolling

  #label(): string {
    return this.label || this.t('@tct.table.label');
  }

  #observeScroll(): void {
    const scroller = this.scrollRegion;
    if (scroller === this.#observed) return;
    this.#releaseObservers();
    this.#observed = scroller;
    if (!scroller) return;
    const measure = (): void => {
      const overflowing = scroller.scrollWidth - scroller.clientWidth > 1;
      if (overflowing !== this.#scrollable) {
        this.#scrollable = overflowing;
        this.requestUpdate();
      }
    };
    this.#stopObserving.push(observeResize(scroller, measure));
    const table = scroller.querySelector('table');
    if (table) this.#stopObserving.push(observeResize(table, measure));
  }

  #releaseObservers(): void {
    for (const stop of this.#stopObserving.splice(0)) stop();
    this.#observed = null;
  }

  /** In children mode the host is the scroll region: it is keyboard reachable only while it overflows. */
  #syncHostScrollRegion(): void {
    if (!this.#children) return;
    if (this.#scrollable) {
      if (!this.hasAttribute('tabindex')) this.setAttribute('tabindex', '0');
    } else if (this.getAttribute('tabindex') === '0') {
      this.removeAttribute('tabindex');
    }
  }

  // ------------------------------------------------------------------------------- context menu

  get #menu(): TctContextMenu | null {
    return this.querySelector<TctContextMenu>('tct-context-menu.tct-table-menu');
  }

  /** The actions of the cell under `target` and of its row; empty when no plugin contributes any. */
  #actionsFor(target: EventTarget | null): TableContextAction[] {
    if (!this.#menuWanted || !(target instanceof Element)) return [];
    const cell = target.closest('td, th, tct-table-cell, tct-table-header-cell');
    if (!cell || !this.contains(cell)) return [];
    const row = cell.closest('tr, tct-table-row');
    return [
      ...resolveContextActions(actionsOf(cell)),
      ...(row ? resolveContextActions(actionsOf(row)) : []),
    ];
  }

  async #openMenu(actions: TableContextAction[], x: number, y: number): Promise<void> {
    await customElements.whenDefined('tct-context-menu');
    const menu = this.#menu;
    if (!menu) return;
    const active = deepActiveElement();
    this.#menuOpener = active instanceof HTMLElement && this.contains(active) ? active : null;
    menu.items = toMenuOptions(actions);
    await menu.showAt(x, y);
  }

  readonly #onContextMenu = (event: MouseEvent): void => {
    if (event.defaultPrevented) return;
    const actions = this.#actionsFor(event.target);
    if (actions.length === 0) return; // no plugin has an action here: the browser's own menu shows
    event.preventDefault();
    // A keyboard-invoked contextmenu reports (0, 0) in several engines: anchor at the focused element.
    const keyboard = event.clientX === 0 && event.clientY === 0 && event.detail === 0;
    if (keyboard && event.target instanceof Element) {
      const corner = this.#corner(event.target);
      void this.#openMenu(actions, corner.x, corner.y);
      return;
    }
    void this.#openMenu(actions, event.clientX, event.clientY);
  };

  /** ContextMenu key and Shift+F10 open the menu at the focused control (`contextmenu` may not fire for them). */
  readonly #onKeyDown = (event: KeyboardEvent): void => {
    if (isImeKeyEvent(event) || event.defaultPrevented) return;
    if (!(event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey))) return;
    const actions = this.#actionsFor(event.target);
    if (actions.length === 0) return;
    event.preventDefault();
    const corner = this.#corner(event.target as Element);
    void this.#openMenu(actions, corner.x, corner.y);
  };

  #corner(element: Element): {x: number; y: number} {
    const rect = element.getBoundingClientRect();
    return {x: this.direction === 'rtl' ? rect.right : rect.left, y: rect.bottom};
  }

  /** The menu returns focus to what had it before it opened. */
  readonly #onMenuAfterChange = (event: Event): void => {
    if ((event as Event & {open?: boolean}).open !== false) return;
    const opener = this.#menuOpener;
    this.#menuOpener = null;
    const active = deepActiveElement();
    if (opener?.isConnected && (!active || active === document.body))
      opener.focus({preventScroll: true});
  };

  // ------------------------------------------------------------------------------------- render

  protected override render(): TemplateResult | typeof nothing {
    if (this.#children) {
      // Authored content is styled by the light sheet; only the shared context menu is rendered.
      return this.#menuWanted ? this.#menuTemplate() : nothing;
    }
    const plugins = this.#resolved;
    const data = this.data;
    // Nothing to draw until there are data or columns: an empty <table> is not a table.
    if (data === undefined && this.columns === undefined)
      return this.#menuWanted ? this.#menuTemplate() : nothing;

    // ---- columns
    const baseColumns: TableColumn<T>[] = this.columns ?? (data ? generateColumns(data) : []);
    const transformed = applyPlugins(plugins, (p) => p.transformColumns, baseColumns);
    const previous = this.#columns;
    const columns =
      previous.length === transformed.length &&
      previous.every((column, i) => column === transformed[i])
        ? previous
        : transformed;
    this.#columns = columns;
    if (this.#widthsFor !== columns) {
      this.#widths = resolveColumnWidths(columns);
      this.#widthsFor = columns;
    }
    const widths = this.#widths!;

    // ---- the <table>
    const tableRender = applyPlugins(plugins, (p) => p.transformTable, {
      htmlProps: {},
    } satisfies TableRenderProps);
    const tableStyle: Record<string, string | number | null | undefined> = {
      ...tableRender.htmlProps.style,
    };
    if (widths.tableMinWidth > 0) tableStyle['min-width'] = `${widths.tableMinWidth}px`;
    const indexing = this.rowIndexStart != null || this.rowCount != null;
    const tableHtmlProps: TableHtmlProps = {
      ...tableRender.htmlProps,
      attributes: {
        ...(indexing ? {'aria-rowcount': this.rowCount ?? -1} : null),
        ...tableRender.htmlProps.attributes,
      },
      style: tableStyle,
    };

    // ---- header
    const headerCells = columns.map((column, columnIndex) =>
      this.#headerCell(column, columnIndex, columns, widths),
    );
    const headerRow = applyPlugins(plugins, (p) => p.transformHeaderRow, {
      htmlProps: {},
      children: headerCells,
    } satisfies HeaderRowRenderProps);

    // ---- body
    const hasData = data != null && data.length > 0;
    const body = hasData
      ? this.#rows(data, columns, plugins)
      : data != null
        ? this.#empty(columns.length)
        : nothing;

    const table = html`<table ${tableProps(tableHtmlProps)}>
      ${
        columns.length > 0
          ? html`<thead>
              <tr ${tableProps(headerRow.htmlProps)}>
                ${headerRow.children}
              </tr>
            </thead>`
          : nothing
      }
      <tbody>
        ${body}
      </tbody>
    </table>`;

    // ---- scroll wrapper: the horizontal scroll region, named, keyboard reachable only while it overflows
    const wrapper: ScrollWrapperRenderProps = applyPlugins(
      plugins,
      (p) => p.transformScrollWrapper,
      {
        htmlProps: {
          attributes: {
            role: 'group',
            'aria-label': this.#label(),
            tabindex: this.#scrollable ? 0 : undefined,
          },
          classes: ['tct-table-scroll'],
          style: {'overscroll-behavior-inline': this.#scrollable ? 'contain' : null},
        },
      } satisfies ScrollWrapperRenderProps,
    );
    const region = html`<div ${tableProps(wrapper.htmlProps)}>
      ${wrapper.beforeTable}${table}${wrapper.afterTable}
    </div>`;

    // ---- one shared context menu for the whole table
    let output: TableContent = this.#menuWanted ? html`${region}${this.#menuTemplate()}` : region;

    // ---- context wrappers: the first plugin is outermost
    for (let i = plugins.length - 1; i >= 0; i--) {
      const plugin = plugins[i]!;
      if (!plugin.transformTableContext) continue;
      try {
        output = plugin.transformTableContext(output);
      } catch (error) {
        devWarn(
          `table:context:${i}`,
          `Table plugin at index ${i} threw in transformTableContext.`,
          error,
        );
      }
    }
    return output as TemplateResult;
  }

  #menuTemplate(): TemplateResult {
    return html`<tct-context-menu
      class="tct-table-menu"
      label=${this.t('@tct.table.contextMenu.label')}
      @tct-after-open-change=${this.#onMenuAfterChange}
    ></tct-context-menu>`;
  }

  // ----------------------------------------------------------------------------------- header

  #headerCell(
    column: TableColumn<T>,
    columnIndex: number,
    columns: TableColumn<T>[],
    widths: ResolvedColumnWidths,
  ): TemplateResult {
    const initial: HeaderCellRenderProps = {
      htmlProps: {
        attributes: {'data-column-key': column.key, scope: 'col', 'data-align': column.align},
      },
      content: column.header ?? column.key,
      columnIndex,
      columns: columns as readonly TableColumn<Row>[],
    };
    const cell = applyPlugins(
      this.#resolved,
      (p) => p.transformHeaderCell,
      initial,
      column,
      columnIndex,
      columns,
    );
    const label = cell.content ?? column.header ?? column.key;
    const htmlProps = cell.htmlProps;
    htmlProps.style = {...widths.columns.get(column.key)?.style, ...htmlProps.style};
    if (typeof label === 'string' && label.length > 0) {
      htmlProps.attributes = {title: label, ...htmlProps.attributes};
    }
    const {before, after, overlay, below} = cell;
    const slots = before != null || after != null || overlay != null || below != null;
    const inner = slots
      ? html`${before}${
          after != null ? html`<div class="tct-table-header-label">${label}${after}</div>` : label
        }${overlay}${below}`
      : label;
    return html`<th ${tableProps(htmlProps, cell.contextMenuActions)}>${inner}</th>`;
  }

  // -------------------------------------------------------------------------------------- rows

  #empty(columnCount: number): TemplateResult | typeof nothing {
    const custom = this.emptyState;
    if (this.noEmptyState || custom === false) return nothing;
    const content =
      custom !== undefined
        ? (custom as TemplateResult)
        : html`<tct-empty-state
            compact
            heading=${this.emptyLabel || this.t('@tct.table.noData')}
          ></tct-empty-state>`;
    return html`<tr class="tct-table-empty">
      <td colspan=${Math.max(columnCount, 1)}>${content}</td>
    </tr>`;
  }

  #key(item: T, index: number): string | number {
    const idKey = this.idKey;
    if (idKey == null) return index;
    return typeof idKey === 'function' ? idKey(item) : String(item[idKey]);
  }

  #rows(data: T[], columns: TableColumn<T>[], plugins: TablePlugin<T>[]): TemplateResult {
    const visible = this.#limit < data.length ? data.slice(0, this.#limit) : data;
    const indexing = this.rowIndexStart != null || this.rowCount != null;
    const first = this.rowIndexStart ?? 1;
    const revision = this.#revision();
    const overflow = this.textOverflow;
    const signers = plugins.filter((plugin) => typeof plugin.rowSignature === 'function');
    const pending = data.length - visible.length;

    return html`${repeat(
      visible,
      (item, index) => this.#key(item, index),
      (item, index) => {
        const ariaRowIndex = indexing ? first + index : undefined;
        // A row is rebuilt only when its item, position, columns, plugins or a plugin-declared
        // signature changed: selecting one row of ten thousand rebuilds one row.
        return guard(
          [
            item,
            index,
            ariaRowIndex,
            columns,
            plugins,
            overflow,
            revision,
            ...signers.map((plugin) => plugin.rowSignature!(item, index)),
          ],
          () => this.#row(item, index, columns, plugins, ariaRowIndex),
        );
      },
    )}${pending > 0 ? this.#pending(pending, columns.length) : nothing}`;
  }

  /** A spacer for the rows still to come, so the scroll height stays roughly stable while rendering. */
  #pending(count: number, columnCount: number): TemplateResult {
    return html`<tr class="tct-table-pending" aria-hidden="true">
      <td
        colspan=${Math.max(columnCount, 1)}
        style="block-size: calc(${count} * var(--_table-row-block-size, 2.75rem))"
      ></td>
    </tr>`;
  }

  #row(
    item: T,
    index: number,
    columns: TableColumn<T>[],
    plugins: TablePlugin<T>[],
    ariaRowIndex: number | undefined,
  ): TemplateResult {
    const truncate = this.textOverflow === 'truncate';
    const cells = columns.map((column, columnIndex) => {
      const initial: BodyCellRenderProps = {
        htmlProps: {attributes: {'data-align': column.align}},
        columnIndex,
        columns: columns as readonly TableColumn<Row>[],
      };
      const cell = applyPlugins(
        plugins,
        (p) => p.transformBodyCell,
        initial,
        column,
        item,
        columnIndex,
        columns,
      );
      let content: TableContent = null;
      if (!cell.isContentSuppressed) {
        if (column.renderCell) {
          content = column.renderCell(item);
        } else {
          const text = defaultCellRenderer(item, column.key);
          content =
            truncate && text.length > 0
              ? html`<tct-text type="body" max-lines="1">${text}</tct-text>`
              : text;
        }
      }
      return html`<td ${tableProps(cell.htmlProps, cell.contextMenuActions)}>${content}</td>`;
    });

    const row = applyPlugins(
      plugins,
      (p) => p.transformBodyRow,
      {
        htmlProps: {attributes: ariaRowIndex == null ? {} : {'aria-rowindex': ariaRowIndex}},
        children: cells,
      } satisfies BodyRowRenderProps,
      item,
      index,
    );
    return html`<tr ${tableProps(row.htmlProps, row.contextMenuActions)}>
        ${row.children}
      </tr>
      ${row.afterRow ?? nothing}`;
  }
}

/** The actions attached to a rendered cell/row (by the pipeline) or set on a `tct-table-*` part. */
function actionsOf(element: Element): TableContextActions | undefined {
  return (
    contextActionsOf(element) ??
    (element as {contextMenuActions?: TableContextActions}).contextMenuActions
  );
}

function contributesActions(plugin: object): boolean {
  return (plugin as {contributesContextActions?: boolean}).contributesContextActions === true;
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-table': TctTable;
  }
}
