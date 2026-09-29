import {defineElement} from '@tecton-wc/core/define.js';
import {TctTable} from './tct-table.js';
import {TctTableBody} from './tct-table-body.js';
import {TctTableCell} from './tct-table-cell.js';
import {TctTableFooter} from './tct-table-footer.js';
import {TctTableHeader} from './tct-table-header.js';
import {TctTableHeaderCell} from './tct-table-header-cell.js';
import {TctTableRow} from './tct-table-row.js';

defineElement(TctTable);
defineElement(TctTableHeader);
defineElement(TctTableBody);
defineElement(TctTableFooter);
defineElement(TctTableRow);
defineElement(TctTableCell);
defineElement(TctTableHeaderCell);

export {
  TctTable,
  TctTableBody,
  TctTableCell,
  TctTableFooter,
  TctTableHeader,
  TctTableHeaderCell,
  TctTableRow,
};

export {tableContext, TableContext} from './table.context.js';
export {resolveContextActions, toMenuOptions} from './table.context-menu.js';
export {BaseTablePlugins, TABLE_PLUGIN_ORDER, applyPlugins} from './table.pipeline.js';
export {
  DEFAULT_MIN_COLUMN_WIDTH,
  capitalize,
  generateColumns,
  pixel,
  proportional,
  resolveColumnWidths,
} from './table.utils.js';
export {tableProps, contextActionsOf} from './table-props.directive.js';
export {TablePluginController, TableStateController} from './table-plugin.js';
export {TableSortableController} from './plugins/sortable.js';
export {
  TableSortableStateController,
  TABLE_ASYNC_SORT_ROWS,
  sortRows,
  sortRowsSliced,
} from './plugins/sortable-state.js';
export type {
  TableSortableConfig,
  TableSortDirection,
  TableSortEntry,
  TableSortState,
} from './plugins/sortable.js';
export type {TableSortableStateOptions, TableSortComparator} from './plugins/sortable-state.js';
export {TableSelectionController, TABLE_SELECTION_COLUMN_KEY} from './plugins/selection.js';
export {TableSelectionStateController} from './plugins/selection-state.js';
export type {TableSelectionConfig} from './plugins/selection.js';
export type {TableSelectionStateOptions} from './plugins/selection-state.js';
export {paginateData} from './plugins/paginate-data.js';
export {
  TablePaginationController,
  TABLE_PAGINATION_VARIANTS,
  pageWindow,
} from './plugins/pagination.js';
export type {TablePaginationConfig, TablePaginationVariant} from './plugins/pagination.js';
export {TableColumnSettingsController} from './plugins/column-settings.js';
export {TableColumnSettingsStateController} from './plugins/column-settings-state.js';
export type {ColumnSettingsOption, TableColumnSettingsConfig} from './plugins/column-settings.js';
export type {TableColumnSettingsStateOptions} from './plugins/column-settings-state.js';
export {TableColumnResizeController, computeColumnWidths} from './plugins/column-resize.js';
export type {TableColumnResizeConfig} from './plugins/column-resize.js';
export {TableStickyColumnsController} from './plugins/sticky-columns.js';
export type {TableStickyColumnsConfig} from './plugins/sticky-columns.js';
export {TableGroupedRowsController} from './plugins/grouped-rows.js';
export type {TableGroupedRowsConfig} from './plugins/grouped-rows.js';
export {TableRowExpansionController, TABLE_EXPANSION_COLUMN_KEY} from './plugins/row-expansion.js';
export type {TableRowExpansionConfig} from './plugins/row-expansion.js';
export {TableTreeDataController, TABLE_TREE_INDENTS} from './plugins/tree.js';
export type {TableTreeDataConfig, TableTreeIndent, TableTreeRowMeta} from './plugins/tree.js';
export {TableTreeStateController} from './plugins/tree-state.js';
export type {TableTreeStateOptions} from './plugins/tree-state.js';
export {TableRowIndexController, TABLE_ROW_INDEX_COLUMN_KEY} from './plugins/row-index.js';
export type {TableRowIndexConfig} from './plugins/row-index.js';
export {
  TableRowStatusController,
  TABLE_ROW_STATUS_COLORS,
  TABLE_ROW_STATUS_COLUMN_KEY,
} from './plugins/row-status.js';
export type {
  TableRowStatus,
  TableRowStatusColor,
  TableRowStatusConfig,
  TableSemanticRowStatus,
} from './plugins/row-status.js';
export type {
  BodyCellRenderProps,
  BodyRowRenderProps,
  ColumnWidth,
  HeaderCellRenderProps,
  HeaderRowRenderProps,
  PixelWidth,
  ProportionalWidth,
  ScrollWrapperRenderProps,
  TableColumn,
  TableColumnAlign,
  TableContent,
  TableContextAction,
  TableContextActions,
  TableContextValue,
  TableDensity,
  TableDividers,
  TableHtmlProps,
  TablePlugin,
  TablePluginHost,
  TablePluginRecord,
  TableRenderProps,
  TableSortableColumnConfig,
  TableTextOverflow,
  TableVerticalAlign,
  TableWindowing,
} from './table.types.js';
