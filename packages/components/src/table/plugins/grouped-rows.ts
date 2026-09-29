/**
 * `TableGroupedRowsController` (upstream `useTableGroupedRows`): groups a flat dataset into collapsible
 * sections. Each distinct `groupBy` value becomes a full-width heading row with a chevron button, the
 * group label and a count; collapsing hides that group's rows and keeps the heading.
 *
 * The controller is both the plugin and the data source: give the table `grouped.data` (the flattened
 * rows: heading, its rows, next heading...), `grouped.idKey` and the plugin itself. Heading rows are
 * synthetic: their cells render empty (the consumer's cell renderers never see them) and other property
 * reads on them give `''`, which keeps sort and filter code off `undefined`.
 *
 * Grouping runs on the rows it is handed, so the order is filter, sort, slice, then group. Sort by the
 * group key first and the reader's keys second, so a section's rows stay contiguous and pages fill
 * sections in order.
 */
import {html, type TemplateResult} from 'lit';
import {defineElement} from '@tecton-wc/core/define.js';
import {TctIcon} from '../../icon/tct-icon.js';
import type {
  BodyCellRenderProps,
  BodyRowRenderProps,
  TableColumn,
  TableContent,
  TablePluginHost,
} from '../table.types.js';
import {TablePluginController} from '../table-plugin.js';
import {renderExpander} from './expander.js';

const GROUP_HEADER = Symbol('tableGroupHeader');

interface GroupHeader {
  [GROUP_HEADER]: true;
  groupKey: string;
  count: number;
}

function isGroupHeader(item: unknown): item is GroupHeader {
  return (
    typeof item === 'object' &&
    item !== null &&
    (item as Record<symbol, unknown>)[GROUP_HEADER] === true
  );
}

// Any read beyond the marker fields gives '', so code that reads a heading row's data (sort, filter, a
// consumer's row handler) never meets `undefined`.
const HEADER_HANDLER: ProxyHandler<Record<string | symbol, unknown>> = {
  get(target, property) {
    if (property === GROUP_HEADER || property === 'groupKey' || property === 'count') {
      return target[property];
    }
    return property in target ? target[property] : '';
  },
};

function makeHeader<T extends Record<string, unknown>>(groupKey: string, count: number): T {
  return new Proxy({[GROUP_HEADER]: true, groupKey, count}, HEADER_HANDLER) as unknown as T;
}

/** Config of {@link TableGroupedRowsController}. */
export interface TableGroupedRowsConfig<T extends Record<string, unknown>> {
  /** The flat rows to group. */
  data: T[];
  /** The group key of a row; rows with the same key share a section. */
  groupBy: (item: T) => string;
  /** The keys of the collapsed groups. */
  collapsedGroups: ReadonlySet<string>;
  /** Called with a group key when its heading is toggled. */
  onToggleGroup: (groupKey: string) => void;
  /**
   * Custom content of a group heading (to the right of the chevron). Default: "<key> (<count>)".
   */
  renderGroupHeader?: (groupKey: string, count: number, collapsed: boolean) => TableContent;
  /** A stable key for a real row. Default: its position in the flattened data. */
  getRowKey?: (item: T) => string;
  /** Explicit group order; groups not listed follow in first-seen order. */
  groupOrder?: string[];
}

export class TableGroupedRowsController<
  T extends Record<string, unknown> = Record<string, unknown>,
> extends TablePluginController<T, TableGroupedRowsConfig<T>> {
  #flattened:
    | {
        source: T[];
        groupBy: unknown;
        collapsed: ReadonlySet<string>;
        order: unknown;
        result: T[];
      }
    | undefined;
  #positions: {source: T[]; map: Map<T, number>} | undefined;
  /** The column count of the last cells built, for the heading's `colspan`. */
  #columnCount = 1;

  override attach(table: TablePluginHost): void {
    super.attach(table);
    defineElement(TctIcon);
  }

  /** The flattened rows: `[heading, ...visible rows, heading, ...]`. Give this to the table's `data`. */
  get data(): T[] {
    const {data, groupBy, collapsedGroups, groupOrder} = this.config;
    const cached = this.#flattened;
    if (
      cached?.source === data &&
      cached.groupBy === groupBy &&
      cached.collapsed === collapsedGroups &&
      cached.order === groupOrder
    ) {
      return cached.result;
    }
    const result = this.#flatten(data, groupBy, collapsedGroups, groupOrder);
    this.#flattened = {
      source: data,
      groupBy,
      collapsed: collapsedGroups,
      order: groupOrder,
      result,
    };
    return result;
  }

  /** The row key resolver; headings are keyed `__group_<key>`. Give this to the table's `idKey`. */
  get idKey(): (item: T) => string {
    return this.#idKey;
  }

  readonly #idKey = (item: T): string => {
    if (isGroupHeader(item)) return `__group_${item.groupKey}`;
    const getRowKey = this.config.getRowKey;
    if (getRowKey) return getRowKey(item);
    const flattened = this.data;
    if (this.#positions?.source !== flattened) {
      const map = new Map<T, number>();
      flattened.forEach((row, index) => map.set(row, index));
      this.#positions = {source: flattened, map};
    }
    return String(this.#positions.map.get(item) ?? -1);
  };

  #flatten(
    data: T[],
    groupBy: (item: T) => string,
    collapsed: ReadonlySet<string>,
    groupOrder: string[] | undefined,
  ): T[] {
    if (data.length === 0) return [];
    const groups = new Map<string, T[]>();
    for (const item of data) {
      const key = groupBy(item);
      const bucket = groups.get(key);
      if (bucket) bucket.push(item);
      else groups.set(key, [item]);
    }
    let keys = [...groups.keys()];
    if (groupOrder && groupOrder.length > 0) {
      keys = [
        ...groupOrder.filter((key) => groups.has(key)),
        ...keys.filter((key) => !groupOrder.includes(key)),
      ];
    }
    const out: T[] = [];
    for (const key of keys) {
      const rows = groups.get(key) ?? [];
      out.push(makeHeader<T>(key, rows.length));
      if (!collapsed.has(key)) out.push(...rows);
    }
    return out;
  }

  // A heading row is not one of the consumer's rows: running a cell renderer on it can only misread it.
  transformBodyCell = (
    props: BodyCellRenderProps,
    _column: TableColumn<T>,
    item: T,
  ): BodyCellRenderProps => {
    this.#columnCount = props.columns?.length ?? this.#columnCount;
    if (isGroupHeader(item)) props.isContentSuppressed = true;
    return props;
  };

  /** A heading's output depends on its collapsed state and count. */
  rowSignature = (item: T): unknown =>
    isGroupHeader(item)
      ? `${this.config.collapsedGroups.has(item.groupKey) ? 1 : 0}|${item.count}`
      : '';

  transformBodyRow = (props: BodyRowRenderProps, item: T): BodyRowRenderProps => {
    if (!isGroupHeader(item)) return props;
    const config = this.config;
    const collapsed = config.collapsedGroups.has(item.groupKey);
    const toggle = (): void => {
      config.onToggleGroup(item.groupKey);
    };
    const attributes = (props.htmlProps.attributes ??= {});
    // The chevron button carries aria-expanded; a native table row cannot (TABLE-09).
    attributes['data-group-expanded'] = collapsed ? 'false' : 'true';
    (props.htmlProps.classes ??= []).push('tct-table-group-row');
    // Clicking anywhere on the heading toggles it; the chevron button is the keyboard control.
    (props.htmlProps.listeners ??= {}).click = toggle;
    props.children = this.#heading(item, collapsed, toggle);
    return props;
  };

  #heading(header: GroupHeader, collapsed: boolean, toggle: () => void): TemplateResult {
    const custom = this.config.renderGroupHeader;
    const content: TableContent = custom
      ? custom(header.groupKey, header.count, collapsed)
      : html`<span class="tct-table-group-label">${header.groupKey}</span>
          <span class="tct-table-group-count">(${header.count})</span>`;
    return html`<td colspan=${this.#columnCount}>
      <span class="tct-table-group-heading" ?data-custom=${custom !== undefined}>
        ${renderExpander({
          expanded: !collapsed,
          label: this.translate(
            collapsed ? '@tct.tableGroupedRows.expandGroup' : '@tct.tableGroupedRows.collapseGroup',
            {groupKey: header.groupKey},
          ),
          onToggle: toggle,
        })}${content}
      </span>
    </td>`;
  }
}
