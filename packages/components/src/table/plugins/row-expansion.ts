/**
 * `TableRowExpansionController` (upstream `useTableRowExpansion`): a full-width detail panel below a row.
 * A leading column holds a chevron button per expandable row (`aria-expanded`, named "Expand row" /
 * "Collapse row"); an expanded row is followed by a spanning row that renders `renderExpanded(item)`; the
 * row's right-click menu gets an expand/collapse action. The panel spans the final column count, whatever
 * other plugins add. The consumer owns the expanded set. For hierarchical data whose child rows share
 * the parent's columns use the tree plugin instead.
 */
import {html, type TemplateResult} from 'lit';
import {defineElement} from '@tecton-wc/core/define.js';
import {TctIcon} from '../../icon/tct-icon.js';
import {resolveContextActions} from '../table.context-menu.js';
import type {
  BodyCellRenderProps,
  BodyRowRenderProps,
  HeaderCellRenderProps,
  TableColumn,
  TableContent,
  TablePluginHost,
} from '../table.types.js';
import {pixel} from '../table.utils.js';
import {TablePluginController} from '../table-plugin.js';
import {renderExpander} from './expander.js';

/** Key of the synthetic expansion column. */
export const TABLE_EXPANSION_COLUMN_KEY = '__tct_expansion';

/** Config of {@link TableRowExpansionController}. */
export interface TableRowExpansionConfig<T extends Record<string, unknown>> {
  /** The keys of the expanded rows. */
  expandedKeys: ReadonlySet<string>;
  /** Called with a row key when its expansion is toggled. */
  onToggle: (key: string) => void;
  /** A stable unique key of a row. */
  getRowKey: (item: T) => string;
  /** The content of the detail panel of an expanded row. */
  renderExpanded: (item: T) => TableContent;
  /** Which rows can expand; the others show no chevron, no menu action and no panel. Default: all. */
  getIsItemExpandable?: (item: T) => boolean;
}

export class TableRowExpansionController<
  T extends Record<string, unknown> = Record<string, unknown>,
> extends TablePluginController<T, TableRowExpansionConfig<T>> {
  readonly contributesContextActions = true;

  /** The column count of the last cells built: the panel's `colspan`, so later column plugins are counted. */
  #columnCount = 1;

  readonly #column: TableColumn<T> = {
    key: TABLE_EXPANSION_COLUMN_KEY,
    header: undefined,
    width: pixel(40),
    resizable: false,
    renderCell: (item) => this.#chevron(item),
  };

  override attach(table: TablePluginHost): void {
    super.attach(table);
    defineElement(TctIcon);
  }

  // A stable column object keeps rows memoized; the header text is set per render.
  transformColumns = (columns: TableColumn<T>[]): TableColumn<T>[] => [this.#column, ...columns];

  transformHeaderCell = (
    props: HeaderCellRenderProps,
    column: TableColumn<T>,
  ): HeaderCellRenderProps => {
    if (column.key === TABLE_EXPANSION_COLUMN_KEY) {
      // The column shows only chevrons; its name is visually hidden text.
      props.content = html`<span class="tct-table-visually-hidden"
        >${this.translate('@tct.tableRowExpansion.columnHeader')}</span
      >`;
    }
    return props;
  };

  transformBodyCell = (props: BodyCellRenderProps): BodyCellRenderProps => {
    this.#columnCount = props.columns?.length ?? this.#columnCount;
    return props;
  };

  rowSignature = (item: T): string => {
    const config = this.config;
    if (!(config.getIsItemExpandable?.(item) ?? true)) return 'x';
    return config.expandedKeys.has(config.getRowKey(item)) ? '1' : '0';
  };

  transformBodyRow = (props: BodyRowRenderProps, item: T): BodyRowRenderProps => {
    const config = this.config;
    if (!(config.getIsItemExpandable?.(item) ?? true)) return props;
    const key = config.getRowKey(item);
    const expanded = config.expandedKeys.has(key);

    // One closure per row (not per cell): the right-click action toggles this row.
    const prior = props.contextMenuActions;
    props.contextMenuActions = () => [
      ...resolveContextActions(prior),
      {
        id: 'row-expansion-toggle',
        group: 'row-expansion',
        label: this.translate(
          expanded ? '@tct.tableRowExpansion.collapseRow' : '@tct.tableRowExpansion.expandRow',
        ),
        icon: expanded ? 'chevronDown' : 'chevronRight',
        onSelect: () => {
          this.config.onToggle(key);
        },
      },
    ];

    if (expanded) {
      const panel = html`<tr class="tct-table-detail-row">
        <td colspan=${this.#columnCount}>${config.renderExpanded(item)}</td>
      </tr>`;
      props.afterRow = props.afterRow ? html`${props.afterRow}${panel}` : panel;
    }
    return props;
  };

  #chevron(item: T): TemplateResult | null {
    const config = this.config;
    if (!(config.getIsItemExpandable?.(item) ?? true)) return null;
    const key = config.getRowKey(item);
    const expanded = config.expandedKeys.has(key);
    return renderExpander({
      expanded,
      label: this.translate(
        expanded ? '@tct.tableRowExpansion.collapseRow' : '@tct.tableRowExpansion.expandRow',
      ),
      onToggle: () => {
        this.config.onToggle(key);
      },
    });
  }
}
