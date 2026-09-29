/**
 * `TablePaginationController` (upstream `useTablePagination`): page controls around the table. The
 * plugin renders the controls (through `transformTableContext`, so they sit outside the scroll region) and
 * reports what the user asks for; the config owns the page, and the rows you give the table (`paginateData`,
 * or a server page) are the page. Pass `row-index-start` and `row-count` to the table so `aria-rowindex`
 * follows the full dataset.
 *
 * The controls are the table's own small pager (previous and next buttons, page numbers, a count or a
 * "Page x of y" label, an optional page-size select), built from `tct-button` and the `pagination` message
 * catalog, so it works without the standalone pagination component.
 */
import {html, nothing, type TemplateResult} from 'lit';
import {ifDefined} from 'lit/directives/if-defined.js';
import {defineElement} from '@tecton-wc/core/define.js';
import {TctButton} from '../../button/tct-button.js';
import {TctIcon} from '../../icon/tct-icon.js';
import type {TableContent, TablePluginHost} from '../table.types.js';
import {TablePluginController} from '../table-plugin.js';

/** Visual variants of the page controls. */
export const TABLE_PAGINATION_VARIANTS = ['pages', 'count', 'compact', 'dots', 'none'] as const;
export type TablePaginationVariant = (typeof TABLE_PAGINATION_VARIANTS)[number];

/** Config of {@link TablePaginationController}. */
export interface TablePaginationConfig {
  /** Current page, 1-based. */
  page: number;
  /** Called with the requested page. */
  onPageChange: (page: number) => void;
  /** Total number of items across all pages; takes precedence over `totalPages`. */
  totalItems?: number;
  /** Total number of pages, when the item count is unknown. */
  totalPages?: number;
  /** Whether more pages follow the current one (cursor pagination with no known total). */
  hasMore?: boolean;
  /** Items per page. Default 10. */
  pageSize?: number;
  /** Called with the requested page size; with `pageSizeOptions` a page-size select shows. */
  onPageSizeChange?: (pageSize: number) => void;
  /** The page sizes to offer. */
  pageSizeOptions?: number[];
  /** `pages` (default), `count`, `compact`, `dots` or `none`. */
  variant?: TablePaginationVariant;
  /** Control size, `sm` or `md` (default). */
  size?: 'sm' | 'md';
  /** Where the controls go: `below` (default), `above`, `both` or `none` (render your own). */
  position?: 'below' | 'above' | 'both' | 'none';
  /** Alignment of the controls: `start`, `center` (default) or `end`. */
  align?: 'start' | 'center' | 'end';
  /** Accessible name of the navigation landmark. Default: the localised "Table pagination". */
  label?: string;
}

const MAX_PAGE_BUTTONS = 7;

/** The page buttons to show, with `null` for an ellipsis: 1 … 4 5 6 … 20. */
export function pageWindow(current: number, total: number): (number | null)[] {
  if (total <= MAX_PAGE_BUTTONS) return Array.from({length: total}, (_, i) => i + 1);
  const items: (number | null)[] = [1];
  const start = Math.max(2, Math.min(current - 1, total - 4));
  const end = Math.min(total - 1, Math.max(current + 1, 5));
  if (start > 2) items.push(null);
  for (let page = start; page <= end; page++) items.push(page);
  if (end < total - 1) items.push(null);
  items.push(total);
  return items;
}

export class TablePaginationController<
  T extends Record<string, unknown> = Record<string, unknown>,
> extends TablePluginController<T, TablePaginationConfig> {
  /** The page the user last asked for, announced once the table shows it. */
  #requested: number | null = null;

  override attach(table: TablePluginHost): void {
    super.attach(table);
    defineElement(TctButton);
    defineElement(TctIcon);
  }

  transformTableContext = (children: TableContent): TableContent => {
    const config = this.config;
    const position = config.position ?? 'below';
    if (position === 'none' || (config.variant ?? 'pages') === 'none') return children;
    const size = this.#pageSize();
    const total = this.#totalPages(size);
    if (total === 1 && config.hasMore !== true) return children;
    const label = config.label ?? this.translate('@tct.table.pagination.label');
    const both = position === 'both';
    return html`${
      position === 'above' || both
        ? this.#pager(
            'above',
            both ? this.translate('@tct.table.pagination.labelAbove', {label}) : label,
            size,
            total,
          )
        : nothing
    }${children}${
      position === 'below' || both
        ? this.#pager(
            'below',
            both ? this.translate('@tct.table.pagination.labelBelow', {label}) : label,
            size,
            total,
          )
        : nothing
    }`;
  };

  /** Announces a page the user asked for once the table shows it. */
  updated = (table: TablePluginHost): void => {
    const requested = this.#requested;
    if (requested === null || this.config.page !== requested) return;
    this.#requested = null;
    table.announce(this.translate('@tct.pagination.pageAnnounce', {current: requested}));
  };

  #pageSize(): number {
    const size = this.config.pageSize ?? 10;
    return Number.isFinite(size) ? Math.max(1, Math.floor(size)) : 10;
  }

  #totalPages(size: number): number | undefined {
    const config = this.config;
    if (config.totalItems != null) return Math.max(1, Math.ceil(config.totalItems / size));
    return config.totalPages;
  }

  #go(page: number, total: number | undefined): void {
    const target = Math.max(1, total === undefined ? page : Math.min(total, page));
    if (target === this.config.page) return;
    this.#requested = target;
    this.config.onPageChange(target);
  }

  #pager(
    side: 'above' | 'below',
    label: string,
    size: number,
    total: number | undefined,
  ): TemplateResult {
    const config = this.config;
    const variant = config.variant ?? 'pages';
    const page = Math.max(1, Math.floor(config.page));
    const control = config.size ?? 'md';
    const canPrevious = page > 1;
    const canNext = total === undefined ? config.hasMore === true : page < total;
    const button = (
      name: string,
      icon: string,
      disabled: boolean,
      target: number,
    ): TemplateResult =>
      html`<tct-button
        variant="ghost"
        size=${control}
        icon=${icon}
        icon-only
        label=${name}
        ?disabled=${disabled}
        @click=${() => {
          this.#go(target, total);
        }}
      ></tct-button>`;
    const previous = button(
      this.translate('@tct.pagination.previous'),
      'chevronLeft',
      !canPrevious,
      page - 1,
    );
    const next = button(this.translate('@tct.pagination.next'), 'chevronRight', !canNext, page + 1);

    let middle: TemplateResult | typeof nothing;
    if (variant === 'compact' || (variant === 'pages' && total === undefined)) {
      middle = html`<span class="tct-table-pager-text"
        >${
          total === undefined
            ? this.translate('@tct.pagination.pageAnnounce', {current: page})
            : this.translate('@tct.pagination.pageOfTotal', {current: page, total})
        }</span
      >`;
    } else if (variant === 'count') {
      const totalItems = config.totalItems;
      const from = (page - 1) * size + 1;
      middle =
        totalItems != null
          ? html`<span class="tct-table-pager-text"
              >${this.translate('@tct.pagination.count', {
                from: Math.min(from, totalItems),
                to: Math.min(page * size, totalItems),
                total: totalItems,
              })}</span
            >`
          : html`<span class="tct-table-pager-text"
              >${this.translate('@tct.pagination.pageAnnounce', {current: page})}</span
            >`;
    } else if (variant === 'dots' && total !== undefined) {
      middle = html`<span
        class="tct-table-pager-dots"
        role="group"
        aria-label=${this.translate('@tct.pagination.pageIndicators')}
        >${Array.from({length: total}, (_, index) => {
          const target = index + 1;
          return html`<button
            type="button"
            class="tct-table-pager-dot"
            aria-label=${this.translate('@tct.pagination.goToPage', {page: target})}
            aria-current=${ifDefined(target === page ? 'page' : undefined)}
            @click=${() => {
              this.#go(target, total);
            }}
          ></button>`;
        })}</span
      >`;
    } else if (total !== undefined) {
      middle = html`${pageWindow(page, total).map((item) =>
        item === null
          ? html`<span class="tct-table-pager-ellipsis" aria-hidden="true">…</span>`
          : html`<tct-button
              variant=${item === page ? 'secondary' : 'ghost'}
              size=${control}
              aria-current=${ifDefined(item === page ? 'page' : undefined)}
              aria-label=${this.translate('@tct.pagination.goToPage', {page: item})}
              @click=${() => {
                this.#go(item, total);
              }}
              >${item}</tct-button
            >`,
      )}`;
    } else {
      middle = nothing;
    }

    const sizes = config.pageSizeOptions;
    const sizeSelect =
      sizes && sizes.length > 0 && config.onPageSizeChange
        ? html`<label class="tct-table-pager-size"
            ><span>${this.translate('@tct.pagination.itemsPerPage')}</span
            ><select
              @change=${(event: Event) => {
                config.onPageSizeChange!(Number((event.target as HTMLSelectElement).value));
              }}
            >
              ${sizes.map(
                (option) =>
                  html`<option value=${option} ?selected=${option === size}>${option}</option>`,
              )}
            </select></label
          >`
        : nothing;

    return html`<div
      class="tct-table-pagination"
      data-position=${side}
      data-align=${config.align ?? 'center'}
    >
      <nav class="tct-table-pager" aria-label=${label}>
        ${sizeSelect}${previous}${middle}${next}
      </nav>
    </div>`;
  }
}
