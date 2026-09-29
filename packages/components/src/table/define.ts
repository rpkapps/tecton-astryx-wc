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
