/**
 * `TableRowStatusController` (upstream `useTableRowStatus`): a narrow leading column that signals a
 * per-row status. A semantic status (`success`, `warning`, `error`) draws a themed icon; a custom
 * `color` draws a small dot, or the named `icon` in that colour. The marker is an image with the status
 * label as its name (and as its tooltip), and the column has a visually hidden header, so the gutter is
 * blank for sighted users and announced for assistive technology.
 *
 * The colour of a custom marker is one of the named roles below (resolved through the icon colour
 * tokens) or any CSS colour, which is set as a custom property and never as markup.
 */
import {html, type TemplateResult} from 'lit';
import {styleMap} from 'lit/directives/style-map.js';
import {defineElement} from '@tecton-wc/core/define.js';
import {devWarn} from '@tecton-wc/core/utils/dev.js';
import {TctIcon} from '../../icon/tct-icon.js';
import type {IconColor} from '../../icon/icon.types.js';
import type {HeaderCellRenderProps, TableColumn, TablePluginHost} from '../table.types.js';
import {pixel} from '../table.utils.js';
import {TablePluginController} from '../table-plugin.js';

/** The named colours of a custom row-status marker. */
export const TABLE_ROW_STATUS_COLORS = [
  'accent',
  'success',
  'error',
  'warning',
  'red',
  'orange',
  'green',
  'yellow',
  'blue',
  'gray',
] as const;
export type TableRowStatusColor = (typeof TABLE_ROW_STATUS_COLORS)[number];

const NAMED_COLORS: Record<TableRowStatusColor, string> = {
  accent: 'var(--color-icon-accent)',
  success: 'var(--color-icon-green)',
  error: 'var(--color-icon-red)',
  warning: 'var(--color-icon-orange)',
  red: 'var(--color-icon-red)',
  orange: 'var(--color-icon-orange)',
  green: 'var(--color-icon-green)',
  yellow: 'var(--color-icon-yellow)',
  blue: 'var(--color-icon-blue)',
  gray: 'var(--color-icon-gray)',
};

/** The icon colour a named marker colour maps to (the released mapping). */
const ICON_COLORS: Record<TableRowStatusColor, IconColor> = {
  accent: 'accent',
  success: 'success',
  error: 'error',
  warning: 'warning',
  red: 'red',
  orange: 'warning',
  green: 'green',
  yellow: 'warning',
  blue: 'blue',
  gray: 'gray',
};

/** A custom marker: a colour (and optionally an icon) with the label that names it. */
export interface TableRowStatus {
  /** A named colour, or any CSS colour. */
  color: TableRowStatusColor | (string & {});
  /** A registered icon name: the marker draws it (in `color`) instead of a dot. */
  icon?: string;
  /** What the marker means; its accessible name and tooltip. */
  label: string;
}

/** A semantic outcome resolved through the theme. */
export interface TableSemanticRowStatus {
  status: 'success' | 'warning' | 'error';
  color?: never;
  icon?: never;
  label: string;
}

/** Config of {@link TableRowStatusController}. */
export interface TableRowStatusConfig<T extends Record<string, unknown>> {
  /** The status of a row, or `null` for no marker. */
  getStatus: (item: T) => (TableRowStatus & {status?: never}) | TableSemanticRowStatus | null;
}

/** Key of the synthetic status column. */
export const TABLE_ROW_STATUS_COLUMN_KEY = '__tct_rowStatus';

/** Hex, keywords, functional notations and `var(--token)`: no declaration or rule punctuation. */
const SAFE_COLOR = /^[\w\s#%.,()/+*-]+$/;

const isSemantic = (value: unknown): value is TableSemanticRowStatus['status'] =>
  value === 'success' || value === 'warning' || value === 'error';

export class TableRowStatusController<
  T extends Record<string, unknown> = Record<string, unknown>,
> extends TablePluginController<T, TableRowStatusConfig<T>> {
  readonly #column: TableColumn<T> = {
    key: TABLE_ROW_STATUS_COLUMN_KEY,
    header: undefined,
    width: pixel(28),
    resizable: false,
    renderCell: (item) => this.#marker(item),
  };

  override attach(table: TablePluginHost): void {
    super.attach(table);
    defineElement(TctIcon);
  }

  transformColumns = (columns: TableColumn<T>[]): TableColumn<T>[] => [this.#column, ...columns];

  transformHeaderCell = (
    props: HeaderCellRenderProps,
    column: TableColumn<T>,
  ): HeaderCellRenderProps => {
    if (column.key === TABLE_ROW_STATUS_COLUMN_KEY) {
      props.content = html`<span class="tct-table-visually-hidden"
        >${this.translate('@tct.table.rowStatus.columnHeader')}</span
      >`;
    }
    return props;
  };

  /** A marker depends on the status only. */
  rowSignature = (item: T): string => {
    const status = this.config.getStatus(item) as Record<string, unknown> | null;
    return status
      ? `${String(status.status)}|${String(status.color)}|${String(status.icon)}|${String(status.label)}`
      : '';
  };

  #marker(item: T): TemplateResult | null {
    const status = this.config.getStatus(item) as
      (Partial<TableRowStatus> & {status?: unknown; label?: string}) | null;
    if (!status) return null;
    const label = status.label ?? '';

    if (isSemantic(status.status)) {
      if (status.color !== undefined || status.icon !== undefined) {
        devWarn(
          'table:row-status:conflict',
          'A row status cannot combine `status` with `color` or `icon`: the semantic status wins and the custom fields are ignored.',
        );
      }
      return this.#image(
        label,
        html`<tct-icon name=${status.status} size="xsm" color=${status.status}></tct-icon>`,
        undefined,
      );
    }
    if (typeof status.color !== 'string') return null;
    const named = (ICON_COLORS as Record<string, IconColor | undefined>)[status.color];
    const requested =
      (NAMED_COLORS as Record<string, string | undefined>)[status.color] ?? status.color;
    // Only a plain colour expression is used: a string that could end the declaration or smuggle a
    // second one (`;`, `:`, quotes, braces, backslashes) falls back to the inherited colour.
    const value = SAFE_COLOR.test(requested) ? requested : undefined;
    if (typeof status.icon === 'string') {
      return this.#image(
        label,
        named
          ? html`<tct-icon name=${status.icon} size="xsm" color=${named}></tct-icon>`
          : html`<tct-icon name=${status.icon} size="xsm"></tct-icon>`,
        named ? undefined : value,
      );
    }
    return this.#image(label, html`<span class="tct-table-status-dot"></span>`, value);
  }

  #image(label: string, glyph: TemplateResult, color: string | undefined): TemplateResult {
    return html`<span
      class="tct-table-status"
      role="img"
      aria-label=${label}
      title=${label}
      style=${styleMap({'--_table-status-color': color})}
      >${glyph}</span
    >`;
  }
}
