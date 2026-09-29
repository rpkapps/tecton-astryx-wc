/**
 * `TableTreeDataController` (upstream `useTableTreeData`): a hierarchy in the first column. The tree
 * affordance decorates the tree column's cells in place, with no extra column: each cell gets
 * per-level indentation and a chevron button (or a same-width spacer on a leaf, so leaf and parent text
 * line up); rows carry `aria-level` and, when expandable, `aria-expanded`. Other columns get no extra DOM.
 *
 * Data shaping stays outside the table: the table always receives exactly the rows it renders
 * (`TableTreeStateController.visibleData`), so a collapsed subtree is not in the DOM. With no expandable
 * row (`hasExpandableRows` false) every transform passes through, so adopting the plugin ahead of
 * hierarchical data changes nothing.
 */
import {html, type TemplateResult} from 'lit';
import {defineElement} from '@tecton-wc/core/define.js';
import {TctIcon} from '../../icon/tct-icon.js';
import type {
  BodyRowRenderProps,
  HeaderCellRenderProps,
  TableColumn,
  TableContent,
  TablePluginHost,
} from '../table.types.js';
import {defaultCellRenderer} from '../table.utils.js';
import {TablePluginController} from '../table-plugin.js';
import {isPlainRowClick, renderExpander} from './expander.js';

/** Where a visible row sits in the tree. */
export interface TableTreeRowMeta {
  /** The row's id (from `idKey`). */
  id: string;
  /** Depth, 0-based: roots are level 0. */
  level: number;
  /** Whether the row shows an expander. */
  hasChildren: boolean;
  /** Whether the row is expanded. */
  isExpanded: boolean;
}

/** Indent step per level. */
export const TABLE_TREE_INDENTS = ['sm', 'md', 'lg'] as const;
export type TableTreeIndent = (typeof TABLE_TREE_INDENTS)[number];

const INDENT_STEP: Record<TableTreeIndent, string> = {
  sm: 'var(--spacing-3)',
  md: 'var(--spacing-4)',
  lg: 'var(--spacing-6)',
};

/** Config of {@link TableTreeDataController}; `TableTreeStateController.treeConfig` provides it. */
export interface TableTreeDataConfig<T extends Record<string, unknown>> {
  /** The structural meta of a visible row; undefined for an unknown row. */
  getRowMeta: (item: T) => TableTreeRowMeta | undefined;
  /** Toggles a row's expansion. */
  onToggleItem: (item: T) => void;
  /** Whether any row is expandable. When false the plugin does nothing. */
  hasExpandableRows: boolean;
  /** Aggregate expansion across every expandable row, for the header control. */
  isAllExpanded?: boolean | 'indeterminate';
  /** Expands every expandable row (the header control). */
  onExpandAll?: () => void;
  /** Collapses every row (the header control). */
  onCollapseAll?: () => void;
  /**
   * Show the expand-all toggle in the tree column header. Needs `isAllExpanded`, `onExpandAll` and
   * `onCollapseAll`. Default `false`.
   */
  expandAllControl?: boolean;
  /** Indent step per level: `sm`, `md` (default) or `lg`. */
  indent?: TableTreeIndent;
  /** The column that carries the indent and expander. Default: the first data column. */
  treeColumnKey?: string;
  /**
   * Clicking anywhere on an expandable row toggles it, besides the chevron. A pointer convenience only:
   * keyboard and assistive technology use the chevron button. Clicks on controls or ending a text
   * selection do not toggle. Default `false`.
   */
  rowClickExpansion?: boolean;
}

export class TableTreeDataController<
  T extends Record<string, unknown> = Record<string, unknown>,
> extends TablePluginController<T, TableTreeDataConfig<T>> {
  /** Wrapped tree columns, cached by the original column so identity is stable across renders. */
  #wrapped = new WeakMap<TableColumn<T>, TableColumn<T>>();
  #wrappedFor: {treeKey: string | undefined; config: TableTreeDataConfig<T>} | undefined;
  #treeKey: string | undefined;

  override attach(table: TablePluginHost): void {
    super.attach(table);
    defineElement(TctIcon);
  }

  transformColumns = (columns: TableColumn<T>[]): TableColumn<T>[] => {
    const config = this.config;
    // The configured column, else the first data column (a synthetic column has a `__` key): the
    // expander must not vanish when column settings hide the configured one.
    const configured =
      config.treeColumnKey != null && columns.some((column) => column.key === config.treeColumnKey);
    const treeKey = configured
      ? config.treeColumnKey
      : (columns.find((column) => !column.key.startsWith('__'))?.key ?? columns[0]?.key);
    this.#treeKey = treeKey;
    if (!config.hasExpandableRows) return columns;
    const previous = this.#wrappedFor;
    if (!previous || previous.treeKey !== treeKey || previous.config !== config) {
      this.#wrapped = new WeakMap();
      this.#wrappedFor = {treeKey, config};
    }
    return columns.map((column) => {
      if (column.key !== treeKey) return column;
      let wrapped = this.#wrapped.get(column);
      if (!wrapped) {
        wrapped = {...column, renderCell: (item) => this.#cell(item, column)};
        this.#wrapped.set(column, wrapped);
      }
      return wrapped;
    });
  };

  transformHeaderCell = (
    props: HeaderCellRenderProps,
    column: TableColumn<T>,
  ): HeaderCellRenderProps => {
    const config = this.config;
    if (
      !config.expandAllControl ||
      !config.hasExpandableRows ||
      column.key !== this.#treeKey ||
      config.isAllExpanded === undefined ||
      !config.onExpandAll ||
      !config.onCollapseAll
    ) {
      return props;
    }
    const all = config.isAllExpanded === true;
    // The label and the toggle share one inline row so the chevron sits beside the title.
    props.content = html`<span class="tct-table-tree-header">
      ${renderExpander({
        expanded: all,
        label: this.translate(
          all ? '@tct.tableTree.collapseAllRows' : '@tct.tableTree.expandAllRows',
        ),
        onToggle: () => {
          const current = this.config;
          if (current.isAllExpanded === true) current.onCollapseAll?.();
          else current.onExpandAll?.();
        },
      })}${props.content}
    </span>`;
    return props;
  };

  /** A row's tree output depends on its level, whether it expands and its state. */
  rowSignature = (item: T): string => {
    const config = this.config;
    if (!config.hasExpandableRows) return '';
    const meta = config.getRowMeta(item);
    return meta
      ? `${meta.level}|${meta.hasChildren ? 1 : 0}|${meta.isExpanded ? 1 : 0}|${config.indent ?? 'md'}|${config.rowClickExpansion ? 1 : 0}`
      : '-';
  };

  transformBodyRow = (props: BodyRowRenderProps, item: T): BodyRowRenderProps => {
    const config = this.config;
    if (!config.hasExpandableRows) return props;
    const meta = config.getRowMeta(item);
    if (!meta) return props;
    const attributes = (props.htmlProps.attributes ??= {});
    // `aria-level` / `aria-expanded` on a row are valid only in a treegrid; a native table row rejects
    // them (axe `aria-conditional-attr`), and a treegrid would promise arrow-key navigation this table
    // does not have. The depth is a data attribute; the state lives on the expander button (TABLE-09).
    attributes['data-tree-level'] = meta.level + 1;
    if (meta.hasChildren) attributes['data-tree-expanded'] = meta.isExpanded ? 'true' : 'false';
    if (config.rowClickExpansion && meta.hasChildren) {
      (props.htmlProps.classes ??= []).push('tct-table-row-clickable');
      (props.htmlProps.listeners ??= {}).click = (event) => {
        if (isPlainRowClick(event)) this.config.onToggleItem(item);
      };
    }
    return props;
  };

  #cell(item: T, column: TableColumn<T>): TemplateResult {
    const config = this.config;
    const content: TableContent = column.renderCell
      ? column.renderCell(item)
      : defaultCellRenderer(item, column.key);
    const meta = config.getRowMeta(item);
    if (!meta) return html`${content}`;
    const indent = INDENT_STEP[config.indent ?? 'md'];
    return html`<div
      class="tct-table-tree-cell"
      style="--_tree-level: ${meta.level}; --_tree-indent: ${indent}"
    >
      ${
        meta.hasChildren
          ? renderExpander({
              expanded: meta.isExpanded,
              label: this.translate(
                meta.isExpanded ? '@tct.tableTree.collapseRow' : '@tct.tableTree.expandRow',
              ),
              onToggle: () => {
                this.config.onToggleItem(item);
              },
            })
          : html`<span class="tct-table-tree-spacer"></span>`
      }${content}
    </div>`;
  }
}
