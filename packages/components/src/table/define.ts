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
export {TableSortableStateController, sortRows} from './plugins/sortable-state.js';
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
} from './table.types.js';
