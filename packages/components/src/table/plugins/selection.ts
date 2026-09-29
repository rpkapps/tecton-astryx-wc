/**
 * `TableSelectionController` (upstream `useTableSelection`): a leading checkbox column. The header
 * checkbox selects every eligible row (checked, or indeterminate when only some are), each row's
 * checkbox selects that row, and a selected row carries `aria-selected="true"` and the Tecton selected
 * fill. Like every plugin here it holds no selection state: the config answers "is this selected" and is
 * told what the user asked for. `TableSelectionStateController` is that config with the bookkeeping
 * done, including the rule that select-all never touches disabled rows.
 *
 * A row is rebuilt only when its own selection, eligibility or label changed (`rowSignature`), so
 * toggling one row of ten thousand rebuilds one row; the header checkbox is rebuilt with the header.
 */
import {html, type TemplateResult} from 'lit';
import {live} from 'lit/directives/live.js';
import {defineElement} from '@tecton-wc/core/define.js';
import {TctCheckboxInput} from '../../checkbox-input/tct-checkbox-input.js';
import type {
  BodyRowRenderProps,
  HeaderCellRenderProps,
  TableColumn,
  TablePluginHost,
} from '../table.types.js';
import {pixel} from '../table.utils.js';
import {TablePluginController} from '../table-plugin.js';

/** Key of the synthetic selection column. Prefixed so it cannot collide with a data column. */
export const TABLE_SELECTION_COLUMN_KEY = '__tct_selection';

/** Config of {@link TableSelectionController}: questions about the selection and the requests to change it. */
export interface TableSelectionConfig<T extends Record<string, unknown>> {
  /** Is this row selected? */
  getIsItemSelected: (item: T) => boolean;
  /** Called when a row checkbox is toggled; `isSelected` is the state the user asked for. */
  onSelectItem: (event: {item: T; isSelected: boolean}) => void;
  /** Called when the header checkbox is toggled. */
  onSelectAll: (event: {isAllSelected: boolean}) => void;
  /** Are all eligible rows selected? Draws the header checkbox checked. */
  getIsAllSelected: () => boolean;
  /** Is the selection partial? Draws the header checkbox indeterminate. */
  getIsIndeterminate?: () => boolean;
  /** Does this row have a checkbox at all? Default: every row does. */
  getIsItemSelectable?: (item: T) => boolean;
  /** Is this row's checkbox operable? Default: yes. A disabled row keeps its state. */
  getIsItemEnabled?: (item: T) => boolean;
  /**
   * A human-readable identity for a row: its checkbox is named "Select {label}" instead of an
   * undifferentiated "Select row".
   */
  getRowLabel?: (item: T) => string;
  /**
   * Keep the selected fill off checked rows, for a surface where the row background already means
   * something else (a row open in a detail panel). `aria-selected` is set either way.
   */
  noRowHighlight?: boolean;
}

export class TableSelectionController<
  T extends Record<string, unknown> = Record<string, unknown>,
> extends TablePluginController<T, TableSelectionConfig<T>> {
  readonly #column: TableColumn<T> = {
    key: TABLE_SELECTION_COLUMN_KEY,
    header: undefined,
    width: pixel(36),
    resizable: false,
    renderCell: (item) => this.#cell(item),
  };

  override attach(table: TablePluginHost): void {
    super.attach(table);
    defineElement(TctCheckboxInput);
  }

  // The column object is stable, so rows keep their identity; the header checkbox is drawn per render.
  transformColumns = (columns: TableColumn<T>[]): TableColumn<T>[] => [this.#column, ...columns];

  transformHeaderCell = (
    props: HeaderCellRenderProps,
    column: TableColumn<T>,
  ): HeaderCellRenderProps => {
    if (column.key === TABLE_SELECTION_COLUMN_KEY) {
      // Its name comes from the checkbox inside; the cell itself has no text.
      props.content = this.#selectAll();
    }
    return props;
  };

  transformBodyRow = (props: BodyRowRenderProps, item: T): BodyRowRenderProps => {
    const config = this.config;
    if (config.getIsItemSelected(item)) {
      (props.htmlProps.attributes ??= {})['aria-selected'] = 'true';
      if (!config.noRowHighlight) (props.htmlProps.classes ??= []).push('tct-table-selected');
    }
    return props;
  };

  /** What a row's output depends on besides the item: its selection, eligibility and label. */
  rowSignature = (item: T): string => {
    const config = this.config;
    return `${config.getIsItemSelected(item) ? 1 : 0}${(config.getIsItemSelectable?.(item) ?? true) ? 1 : 0}${(config.getIsItemEnabled?.(item) ?? true) ? 1 : 0}${config.getRowLabel?.(item) ?? ''}`;
  };

  #selectAll(): TemplateResult {
    const config = this.config;
    const all = config.getIsAllSelected();
    const indeterminate = !all && (config.getIsIndeterminate?.() ?? false);
    // The column's own name is visually hidden text: a header cell with only a checkbox has none.
    return html`<span class="tct-table-visually-hidden"
        >${this.translate('@tct.table.selection.columnHeader')}</span
      >
      <div class="tct-table-center">
        <tct-checkbox-input
          size="sm"
          label=${this.translate('@tct.table.selection.selectAllRows')}
          label-hidden
          .checked=${live(all)}
          .indeterminate=${live(indeterminate)}
          @change=${() => {
            this.config.onSelectAll({isAllSelected: !all});
          }}
        ></tct-checkbox-input>
      </div>`;
  }

  #cell(item: T): TemplateResult | null {
    const config = this.config;
    if (!(config.getIsItemSelectable?.(item) ?? true)) return null;
    const selected = config.getIsItemSelected(item);
    const enabled = config.getIsItemEnabled?.(item) ?? true;
    const label = config.getRowLabel?.(item);
    return html`<div class="tct-table-center">
      <tct-checkbox-input
        size="sm"
        label=${
          label != null
            ? this.translate('@tct.table.selection.selectRowNamed', {label})
            : this.translate('@tct.table.selection.selectRow')
        }
        label-hidden
        ?disabled=${!enabled}
        .checked=${live(selected)}
        @change=${() => {
          this.config.onSelectItem({item, isSelected: !selected});
        }}
      ></tct-checkbox-input>
    </div>`;
  }
}
