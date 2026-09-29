/**
 * Types of the table family: the column model, the plugin protocol (render props per structural
 * level) and the enumerations of the element attributes. The plugin protocol is the upstream
 * `TablePlugin` re-expressed for a light-DOM Lit renderer: attribute bags (`TableHtmlProps`) replace
 * React `htmlProps`/`xstyle`, Lit renderables replace `ReactNode`.
 */
import type {TemplateResult} from 'lit';

// ------------------------------------------------------------------------------ enumerations

/** Row density: cell padding and rhythm. */
export const TABLE_DENSITIES = ['compact', 'balanced', 'spacious'] as const;
export type TableDensity = (typeof TABLE_DENSITIES)[number];

/** Where dividers are drawn between cells. */
export const TABLE_DIVIDERS = ['rows', 'columns', 'grid', 'none'] as const;
export type TableDividers = (typeof TABLE_DIVIDERS)[number];

/** Vertical alignment of body cells. */
export const TABLE_VERTICAL_ALIGNS = ['middle', 'top', 'bottom'] as const;
export type TableVerticalAlign = (typeof TABLE_VERTICAL_ALIGNS)[number];

/** How default-rendered body cell text behaves when it is wider than its column. */
export const TABLE_TEXT_OVERFLOWS = ['wrap', 'truncate'] as const;
export type TableTextOverflow = (typeof TABLE_TEXT_OVERFLOWS)[number];

/** Horizontal alignment of a column (logical: `start` follows the writing direction). */
export const TABLE_COLUMN_ALIGNS = ['start', 'center', 'end'] as const;
export type TableColumnAlign = (typeof TABLE_COLUMN_ALIGNS)[number];

// ---------------------------------------------------------------------------------- content

/**
 * Anything the renderer can draw in a cell or a slot of the pipeline: text (never HTML), a number, a
 * Lit template, a DOM node (it can be in one place only), `nothing`/`null`, or an array of those.
 */
export type TableContent =
  | TemplateResult
  | Node
  | string
  | number
  | boolean
  | bigint
  | null
  | undefined
  | symbol
  | readonly TableContent[];

// ---------------------------------------------------------------------------------- widths

/** A proportional (`fr`-like) column width. Create it with `proportional()`. */
export interface ProportionalWidth {
  type: 'proportional';
  value: number;
  /** Minimum width in pixels: the column never shrinks below it. */
  minWidth?: number;
}

/** A fixed pixel column width. Create it with `pixel()`. */
export interface PixelWidth {
  type: 'pixel';
  value: number;
}

/** A column width: proportional or fixed pixels. */
export type ColumnWidth = ProportionalWidth | PixelWidth;

/** Sortable column configuration. */
export interface TableSortableColumnConfig {
  /**
   * The sort key of the column; it must match a key in the sort state. Decouples column identity from
   * sort identity (a "Full name" column can sort by `lastName`). Default: the column `key`.
   */
  sortKey?: string;
}

/**
 * Reference from a column to a field of the filtering plugin's search configuration (`useTableFiltering`
 * belongs to the search work package): a field key, or a field with an explicit operator.
 */
export type TableFilterFieldRef = string | {field: string; operator?: string};

/** Column definition for data-driven rendering. */
export interface TableColumn<T extends Record<string, unknown> = Record<string, unknown>> {
  /** Unique key: identifies the column and reads the value from the row (`item[key]`). */
  key: string;
  /** Header content: text or a template. Default: the key. */
  header?: TableContent;
  /**
   * Column width. `proportional(1)` shares the free space and keeps a 120px minimum, `pixel(200)` is
   * fixed. Omitted: proportional(1) distribution with no minimum, so prefer an explicit width for
   * text-heavy columns.
   */
  width?: ColumnWidth;
  /** Horizontal alignment of the header and the cells. Default `start`. */
  align?: TableColumnAlign;
  /** Sortable: `true` (sort key = column key) or `{sortKey}`. The sort plugin adds the control. */
  sortable?: boolean | TableSortableColumnConfig;
  /** Whether the resize plugin adds a handle to this column. Default `true`. */
  resizable?: boolean;
  /** Filter configuration for the filtering plugin. */
  filter?: TableFilterFieldRef;
  /**
   * Custom cell renderer: receives the row and returns text (never HTML), a template or a node.
   * Default: the stringified value of `item[key]`.
   */
  renderCell?: (item: T) => TableContent;
}

// ----------------------------------------------------------------------------- element props

/** Values an attribute bag accepts: `true` = empty attribute; `false`, `null`, `undefined` remove it. */
export type TableAttributeValue = string | number | boolean | null | undefined;

/**
 * What a plugin can say about one element of the table (the `<table>`, a `<tr>`, a `<th>`, a `<td>`, the
 * scroll wrapper). The renderer applies it with a directive that diffs it against the previous value.
 * Plugins may mutate the bag they receive and return it; every call gets a fresh one.
 */
export interface TableHtmlProps {
  /** Attributes: `aria-*`, `data-*`, `scope`, `colspan`... */
  attributes?: Record<string, TableAttributeValue>;
  /** Inline style declarations by CSS property name (custom properties included). `null` removes one. */
  style?: Record<string, string | number | null | undefined>;
  /** Class names (the table's own light CSS styles the ones the library plugins add). */
  classes?: string[];
  /** Event listeners by event name (`click`). */
  listeners?: Record<string, EventListener>;
  /** Called with the element when it is created or replaced, and with `null` when it goes away. */
  ref?: (element: HTMLElement | null) => void;
}

/** The `<table>` element. */
export interface TableRenderProps {
  htmlProps: TableHtmlProps;
}

/** The header `<tr>`. */
export interface HeaderRowRenderProps {
  htmlProps: TableHtmlProps;
  /** The header cells. */
  children: TableContent;
}

/**
 * One header `<th>`. Plugins write to named slots so several of them can contribute without
 * conflicts. They render in order `before | content | after`, with `overlay` positioned over the cell
 * and `below` under the label row.
 */
export interface HeaderCellRenderProps {
  htmlProps: TableHtmlProps;
  /** Rendered before the label (a selection checkbox). */
  before?: TableContent;
  /** The label. Initialised from `column.header ?? column.key`; plugins may wrap or replace it. */
  content?: TableContent;
  /** Rendered after the label (a sort icon, a filter trigger). */
  after?: TableContent;
  /** Absolutely positioned layer over the cell (the resize handle). */
  overlay?: TableContent;
  /** Rendered under the label row (inline filter controls). */
  below?: TableContent;
  /** Right-click actions for this header cell; plugins append theirs, never replace. */
  contextMenuActions?: TableContextActions;
  /** Index of this column in the final, ordered column list. */
  columnIndex?: number;
  /** The final, ordered column list (cumulative sticky offsets read it). */
  columns?: readonly TableColumn<Record<string, unknown>>[];
}

/** One body `<tr>`. */
export interface BodyRowRenderProps {
  htmlProps: TableHtmlProps;
  /** The row's cells (already built). */
  children: TableContent;
  /**
   * Content rendered as a sibling right after the row (a full-width detail panel `<tr>`). Several
   * plugins compose by wrapping the previous value.
   */
  afterRow?: TableContent;
  /**
   * Right-click actions for the whole row (one closure per row instead of one per cell). Resolved when
   * the menu opens and merged after the actions of the cell under the pointer.
   */
  contextMenuActions?: TableContextActions;
}

/** One body `<td>`. */
export interface BodyCellRenderProps {
  htmlProps: TableHtmlProps;
  /** Right-click actions for this cell; plugins append theirs. */
  contextMenuActions?: TableContextActions;
  /** Index of this cell's column in the final ordered column list. */
  columnIndex?: number;
  /** The final, ordered column list. */
  columns?: readonly TableColumn<Record<string, unknown>>[];
  /**
   * When true the cell renders empty: neither the column's `renderCell` nor the default renderer runs.
   * Set it for a row a plugin replaces wholesale (a group heading), where the consumer's renderer can
   * only misread the synthetic row.
   */
  isContentSuppressed?: boolean;
}

/** The scroll wrapper around the `<table>` (the horizontal scroll container). */
export interface ScrollWrapperRenderProps {
  /** Attributes, style and `ref` of the scroll container. Explicit attributes win over the defaults. */
  htmlProps: TableHtmlProps;
  /** Content before the `<table>`, inside the scroll container. */
  beforeTable?: TableContent;
  /** Content after the `<table>`, inside the scroll container. */
  afterTable?: TableContent;
}

// ------------------------------------------------------------------------------ context menu

/** One right-click action contributed by a plugin. */
export interface TableContextAction {
  /** Stable identifier, unique within one menu. */
  id: string;
  /** Visible label (text). */
  label: string;
  /** Registered icon name shown before the label. */
  icon?: string;
  /** Called when the item is chosen. */
  onSelect: () => void;
  /** Rendered but not selectable. */
  disabled?: boolean;
  /**
   * Group key: related actions cluster and a divider separates groups (`sort`, `selection`); ungrouped
   * actions form a trailing group. Group order is first-seen order.
   */
  group?: string;
  /** Shows the action as checked (the active sort direction). */
  checked?: boolean;
  /** `destructive` draws the action in the error colour. */
  variant?: 'default' | 'destructive';
}

/**
 * Context-menu actions: an array, or a getter that builds the array lazily when the menu opens
 * (prefer it for actions derived from state: no array or closure is built for every cell on every
 * render).
 */
export type TableContextActions = TableContextAction[] | (() => TableContextAction[]);

// ---------------------------------------------------------------------------------- plugins

/** The row facts a plugin receives when it resolves right-click actions or row signatures. */
export interface TablePluginRow<T> {
  item: T;
  index: number;
}

/**
 * A table plugin transforms the render props at each structural level; plugins compose by sequential
 * application (the output of the first feeds the next).
 *
 * Pipeline order: `transformColumns`, `transformTable`, `transformHeaderCell`, `transformHeaderRow`,
 * `transformBodyCell`, `transformBodyRow`, `transformScrollWrapper`, `transformTableContext`. A row's
 * cells are built before its row transform runs and reach it as `children`.
 */
export interface TablePlugin<T extends Record<string, unknown> = Record<string, unknown>> {
  /** Filter, reorder or inject columns before rendering (a selection checkbox column). */
  transformColumns?: (columns: TableColumn<T>[]) => TableColumn<T>[];
  /** Transform the root `<table>` element. */
  transformTable?: (props: TableRenderProps) => TableRenderProps;
  /** Transform the header `<tr>`. */
  transformHeaderRow?: (props: HeaderRowRenderProps) => HeaderRowRenderProps;
  /** Transform each `<th>`; `columnIndex` and the full column list support position-aware plugins. */
  transformHeaderCell?: (
    props: HeaderCellRenderProps,
    column: TableColumn<T>,
    columnIndex: number,
    columns: readonly TableColumn<T>[],
  ) => HeaderCellRenderProps;
  /** Transform each body `<tr>`. */
  transformBodyRow?: (props: BodyRowRenderProps, item: T, index: number) => BodyRowRenderProps;
  /** Transform each body `<td>`. */
  transformBodyCell?: (
    props: BodyCellRenderProps,
    column: TableColumn<T>,
    item: T,
    columnIndex: number,
    columns: readonly TableColumn<T>[],
  ) => BodyCellRenderProps;
  /** Transform the scroll wrapper: attach a `ref`, add chrome before or after the `<table>`. */
  transformScrollWrapper?: (props: ScrollWrapperRenderProps) => ScrollWrapperRenderProps;
  /** Wrap the whole output (pagination controls around the table). Runs last to first. */
  transformTableContext?: (children: TableContent) => TableContent;

  /**
   * Cheap value describing everything about a row this plugin's output depends on besides the item
   * itself (is it selected, expanded, its tree level). The renderer skips rebuilding a row whose item
   * and signatures are all unchanged, so a selection change re-renders one row, not ten thousand.
   * Plugins whose row output depends on external state must provide it; when absent the plugin is
   * assumed to depend on the item only.
   */
  rowSignature?: (item: T, index: number) => unknown;
  /** Called when the plugin is put on a table (`plugins` property); returns nothing. */
  attach?: (table: TablePluginHost) => void;
  /** Called when the plugin is removed from a table, or the table disconnects. */
  detach?: (table: TablePluginHost) => void;
}

/** What a plugin can ask of the table that hosts it. */
export interface TablePluginHost {
  /** The table element. */
  readonly element: HTMLElement;
  /** Re-render the table. */
  requestUpdate(): void;
  /** Text direction of the table, from computed style. */
  readonly dir: 'ltr' | 'rtl';
  /** Localised message by full id (`@tct.table.sort.ascending`). */
  translate(id: string, args?: Record<string, unknown>): string;
  /** Speaks a message through the announcer. */
  announce(message: string, politeness?: 'polite' | 'assertive'): void;
  /** The locale's collator. */
  collator(options?: Intl.CollatorOptions): Intl.Collator;
}

// ------------------------------------------------------------------------------- table context

/** What `tct-table` publishes to its subcomponents (upstream `TableContext`). */
export interface TableContextValue {
  density: TableDensity;
  dividers: TableDividers;
  striped: boolean;
  hasHover: boolean;
  verticalAlign: TableVerticalAlign;
  textOverflow: TableTextOverflow;
}

/** A named plugin record, as `tct-table` accepts it. */
export type TablePluginRecord<T extends Record<string, unknown> = Record<string, unknown>> = Record<
  string,
  TablePlugin<T>
>;

/** Row key extractor: a property name or a function. */
export type TableIdKey<T extends Record<string, unknown>> =
  (keyof T & string) | ((item: T) => string | number);
