/**
 * `TableSortableController` (upstream `useTableSortable`): column sorting. It puts a sort button around
 * the label of every sortable column header, marks the sorted column `aria-sort`, adds "Sort ascending /
 * descending / Clear sort" to the header's right-click menu, and announces the result. The plugin never
 * holds sort state: the config owns it (`sort` and `onSortChange`); pair it with
 * `TableSortableStateController` when you want the state and the sorting done for you.
 *
 * Clicking cycles ascending, descending and (unless `allowUnsortedState` is false) unsorted; with
 * `multiSort`, Shift+click adds or toggles a column as a further sort key and a rank shows beside the
 * arrow.
 */
import {html, type TemplateResult} from 'lit';
import {defineElement} from '@tecton-wc/core/define.js';
import {TctIcon} from '../../icon/tct-icon.js';
import {resolveContextActions} from '../table.context-menu.js';
import type {
  HeaderCellRenderProps,
  TableColumn,
  TableContextAction,
  TablePluginHost,
} from '../table.types.js';
import {TablePluginController} from '../table-plugin.js';

/** Sort direction of one column. */
export type TableSortDirection = 'ascending' | 'descending';

/** One entry of the sort state. */
export interface TableSortEntry<TSortKey extends string = string> {
  /** The sort key: which column (or derived value) to sort by. */
  sortKey: TSortKey;
  /** The direction. */
  direction: TableSortDirection;
}

/**
 * The sort state: an ordered list of entries, the first the primary sort and the rest tiebreakers. An
 * empty array is unsorted.
 */
export type TableSortState<TSortKey extends string = string> = TableSortEntry<TSortKey>[];

/** Config of {@link TableSortableController}; the config owns the state. */
export interface TableSortableConfig<TSortKey extends string = string> {
  /** The current sort state. */
  sort: TableSortState<TSortKey>;
  /** Called with the complete new sort state when the user changes it from a header. */
  onSortChange: (sort: TableSortState<TSortKey>) => void;
  /**
   * Allow returning to the unsorted state: clicking a sorted column then cycles ascending, descending,
   * unsorted. When false it cycles ascending, descending, ascending. Default `true`.
   */
  allowUnsortedState?: boolean;
  /** Shift+click adds or toggles a column as a secondary sort; a plain click replaces the sort. Default `false`. */
  multiSort?: boolean;
}

function resolveSortKey<T extends Record<string, unknown>>(column: TableColumn<T>): string | null {
  const sortable = column.sortable;
  if (!sortable) return null;
  if (sortable === true) return column.key;
  return sortable.sortKey ?? column.key;
}

function headerLabel<T extends Record<string, unknown>>(column: TableColumn<T>): string {
  return typeof column.header === 'string' ? column.header : column.key;
}

function nextDirection(
  current: TableSortDirection | null,
  allowUnsorted: boolean,
): TableSortDirection | null {
  if (current === null) return 'ascending';
  if (current === 'ascending') return 'descending';
  return allowUnsorted ? null : 'ascending';
}

const sameSort = (a: readonly TableSortEntry[], b: readonly TableSortEntry[]): boolean =>
  a.length === b.length &&
  a.every((entry, i) => entry.sortKey === b[i]!.sortKey && entry.direction === b[i]!.direction);

export class TableSortableController<
  T extends Record<string, unknown> = Record<string, unknown>,
  TSortKey extends string = string,
> extends TablePluginController<T, TableSortableConfig<TSortKey>> {
  /** Adds sort actions to the header's right-click menu. */
  readonly contributesContextActions = true;

  /** The sort the last user gesture asked for, until the config reflects it (then it is announced). */
  #requested: TableSortState<TSortKey> | null = null;
  #announced: TableSortState<TSortKey> = [];

  override attach(table: TablePluginHost): void {
    super.attach(table);
    defineElement(TctIcon);
    this.#announced = this.config.sort;
  }

  transformHeaderCell = (
    props: HeaderCellRenderProps,
    column: TableColumn<T>,
  ): HeaderCellRenderProps => {
    const sortKey = resolveSortKey(column);
    if (sortKey === null) return props;

    const config = this.config;
    const index = config.sort.findIndex((entry) => entry.sortKey === sortKey);
    const entry = index >= 0 ? config.sort[index]! : null;
    const direction = entry?.direction ?? null;
    const multi = config.multiSort === true && config.sort.length > 1;
    const rank = multi && index >= 0 ? index + 1 : null;

    if (entry) (props.htmlProps.attributes ??= {})['aria-sort'] = entry.direction;
    props.content = this.#button(column, sortKey, direction, rank, props.content);

    const prior = props.contextMenuActions;
    props.contextMenuActions = () => [
      ...resolveContextActions(prior),
      ...this.#menuActions(sortKey as TSortKey),
    ];
    return props;
  };

  /** Announces a sort the user asked for once the table shows it. */
  updated = (table: TablePluginHost): void => {
    const requested = this.#requested;
    if (!requested) return;
    const sort = this.config.sort;
    if (!sameSort(sort, requested)) return;
    this.#requested = null;
    if (sameSort(sort, this.#announced)) return;
    this.#announced = sort;
    const first = sort[0];
    if (!first) {
      table.announce(table.translate('@tct.table.sort.announceCleared'));
      return;
    }
    const column = this.#labels.get(first.sortKey) ?? first.sortKey;
    table.announce(
      table.translate('@tct.table.sort.announceSorted', {
        label: column,
        direction: this.translate(`@tct.table.sort.direction.${first.direction}`),
      }),
    );
  };

  /** The header labels seen at render time, by sort key, for announcements. */
  readonly #labels = new Map<string, string>();

  #button(
    column: TableColumn<T>,
    sortKey: string,
    direction: TableSortDirection | null,
    rank: number | null,
    content: HeaderCellRenderProps['content'],
  ): TemplateResult {
    const label = headerLabel(column);
    this.#labels.set(sortKey, label);
    const total = this.config.sort.length;
    const directionText =
      direction === null ? '' : this.translate(`@tct.table.sort.direction.${direction}`);
    const name =
      direction === null
        ? this.translate('@tct.table.sort.sortBy', {label})
        : rank !== null && total > 1
          ? this.translate('@tct.table.sort.sortedByWithPriority', {
              label,
              direction: directionText,
              rank,
              total,
            })
          : this.translate('@tct.table.sort.sortedBy', {label, direction: directionText});
    const icon =
      direction === 'ascending'
        ? 'arrowUp'
        : direction === 'descending'
          ? 'arrowDown'
          : 'arrowsUpDown';
    return html`<button
      type="button"
      class="tct-table-sort"
      aria-label=${name}
      ?data-sorted=${direction !== null}
      @click=${(event: MouseEvent) => {
        this.#activate(sortKey as TSortKey, event.shiftKey);
      }}
    >
      <span>${content}</span>
      <span class="tct-table-sort-icon"
        ><tct-icon
          name=${icon}
          size="xsm"
          color=${direction !== null ? 'accent' : 'secondary'}
        ></tct-icon
      ></span>
      ${rank !== null ? html`<span class="tct-table-sort-rank" aria-hidden="true">${rank}</span>` : null}
    </button>`;
  }

  #activate(sortKey: TSortKey, shift: boolean): void {
    const config = this.config;
    const allowUnsorted = config.allowUnsortedState ?? true;
    let next: TableSortState<TSortKey>;
    if (shift && config.multiSort) {
      const at = config.sort.findIndex((entry) => entry.sortKey === sortKey);
      if (at >= 0) {
        const direction = nextDirection(config.sort[at]!.direction, allowUnsorted);
        next = [...config.sort];
        if (direction === null) next.splice(at, 1);
        else next[at] = {...next[at]!, direction};
      } else {
        next = [...config.sort, {sortKey, direction: 'ascending'}];
      }
    } else {
      const direction = nextDirection(
        config.sort.find((entry) => entry.sortKey === sortKey)?.direction ?? null,
        allowUnsorted,
      );
      next = direction === null ? [] : [{sortKey, direction}];
    }
    this.#set(next);
  }

  #set(next: TableSortState<TSortKey>): void {
    this.#requested = next;
    this.config.onSortChange(next);
  }

  /** Right-click actions of one header, read when the menu opens so they show the latest state. */
  #menuActions(sortKey: TSortKey): TableContextAction[] {
    const direction =
      this.config.sort.find((entry) => entry.sortKey === sortKey)?.direction ?? null;
    const actions: TableContextAction[] = [
      {
        id: 'sort-asc',
        group: 'sort',
        label: this.translate('@tct.table.sort.ascending'),
        icon: 'arrowUp',
        checked: direction === 'ascending',
        onSelect: () => {
          this.#set([{sortKey, direction: 'ascending'}]);
        },
      },
      {
        id: 'sort-desc',
        group: 'sort',
        label: this.translate('@tct.table.sort.descending'),
        icon: 'arrowDown',
        checked: direction === 'descending',
        onSelect: () => {
          this.#set([{sortKey, direction: 'descending'}]);
        },
      },
    ];
    if (direction !== null) {
      actions.push({
        id: 'sort-clear',
        group: 'sort-clear',
        label: this.translate('@tct.table.sort.clear'),
        icon: 'close',
        onSelect: () => {
          this.#set(this.config.sort.filter((entry) => entry.sortKey !== sortKey));
        },
      });
    }
    return actions;
  }
}
