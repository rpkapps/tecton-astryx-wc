/**
 * Option data helpers shared by `tct-selector` and `tct-multi-selector` (upstream `Selector/utils` and
 * the filtering both components share): type guards, normalisation, flattening, the search predicate
 * and the panel model, so the visible rows, the keyboard order and the announced result count all come
 * from one list.
 */
import type {ComboboxRecord} from '@tecton-wc/core/controllers/combobox.js';
import type {
  SelectorDivider,
  SelectorOptionData,
  SelectorOptionType,
  SelectorSection,
} from './selector.types.js';

/** The sentinel value of the "Select all" row (never a real option value). */
export const SELECT_ALL_VALUE = '__tct_select_all__';

/** A selectable option: a string or an option object (not a divider or a section). */
export function isOptionData(option: SelectorOptionType): option is SelectorOptionData | string {
  return typeof option === 'string' || !('type' in option);
}

export function isDivider(option: SelectorOptionType): option is SelectorDivider {
  return typeof option === 'object' && 'type' in option && option.type === 'divider';
}

export function isSection(option: SelectorOptionType): option is SelectorSection {
  return typeof option === 'object' && 'type' in option && option.type === 'section';
}

/** A string becomes `{value, label}`; an object gets its label defaulted to its value. */
export function normalizeOption(option: string | SelectorOptionData): SelectorOptionData {
  if (typeof option === 'string') return {value: option, label: option};
  return {...option, label: option.label ?? option.value};
}

/** Every selectable option in order (sections flattened, dividers dropped). */
export function getSelectableOptions(options: readonly SelectorOptionType[]): SelectorOptionData[] {
  const result: SelectorOptionData[] = [];
  for (const option of options) {
    if (isOptionData(option)) result.push(normalizeOption(option));
    else if (isSection(option))
      for (const inner of option.options) result.push(normalizeOption(inner));
  }
  return result;
}

/** Case-insensitive substring match on the label (the one predicate for the list, the count and the keys). */
export function optionMatchesQuery(
  option: SelectorOptionData,
  query: string,
  locale?: string,
): boolean {
  if (!query) return true;
  const label = option.label ?? option.value;
  try {
    return label.toLocaleLowerCase(locale).includes(query.toLocaleLowerCase(locale));
  } catch {
    return label.toLowerCase().includes(query.toLowerCase());
  }
}

/** The options whose label contains `query`. */
export function filterOptionsByQuery(
  options: readonly SelectorOptionData[],
  query: string,
  locale?: string,
): SelectorOptionData[] {
  return query
    ? options.filter((option) => optionMatchesQuery(option, query, locale))
    : [...options];
}

/** One navigable option as the panel renders it (and as the combobox keys see it). */
export interface SelectorRecord extends ComboboxRecord {
  readonly label: string;
  readonly data: SelectorOptionData;
  /** The "Select all" row of a multi-selector. */
  readonly selectAll?: boolean;
}

/** One option row of the panel with its position in the keyboard order. */
export interface OptionEntry {
  readonly kind: 'option';
  readonly record: SelectorRecord;
  readonly index: number;
}

/** One row of the panel: an option, a divider, or a titled group of options. */
export type PanelEntry =
  | OptionEntry
  | {readonly kind: 'divider'; readonly key: string}
  | {
      readonly kind: 'section';
      readonly key: string;
      readonly title: string | undefined;
      readonly entries: readonly OptionEntry[];
    };

export interface PanelModel {
  /** Rows in display order. */
  readonly entries: readonly PanelEntry[];
  /** Every option row in DOM order: the list the keyboard walks. Index = position in this array. */
  readonly records: readonly SelectorRecord[];
}

export interface PanelOptions {
  query?: string;
  locale?: string;
  /** Values that move to the top of their group (a multi-selector lists what was chosen first while open). */
  selectedFirst?: ReadonlySet<string>;
  /** A first row for "Select all" (indexed 0); only when there are options to select. */
  selectAll?: {label: string} | undefined;
}

const toRecord = (data: SelectorOptionData): SelectorRecord => ({
  value: data.value,
  label: data.label ?? data.value,
  disabled: data.disabled === true,
  data,
});

/**
 * Builds what the panel shows for `options` under the query. While searching, dividers disappear and a
 * group with no match disappears with its heading. With `selectedFirst`, each run of options between
 * dividers (and each section) lists its chosen options first, in their original order.
 */
export function buildPanel(
  options: readonly SelectorOptionType[],
  panel: PanelOptions = {},
): PanelModel {
  const query = panel.query ?? '';
  const searching = query.length > 0;
  const chosen = panel.selectedFirst;
  const selectAllRow = panel.selectAll;
  const offset = 0;
  const records: SelectorRecord[] = [];
  const entries: PanelEntry[] = [];
  // The select-all row (when there is anything to select) takes index 0; everything else follows it.
  const reserve = selectAllRow ? 1 : 0;

  const order = (items: SelectorOptionData[]): SelectorOptionData[] => {
    if (!chosen || chosen.size === 0) return items;
    return [
      ...items.filter((item) => chosen.has(item.value)),
      ...items.filter((item) => !chosen.has(item.value)),
    ];
  };
  const visible = (items: readonly (string | SelectorOptionData)[]): SelectorOptionData[] =>
    items
      .map(normalizeOption)
      .filter((item) => !searching || optionMatchesQuery(item, query, panel.locale));
  const add = (data: SelectorOptionData): OptionEntry => {
    const record = toRecord(data);
    const index = records.length + reserve + offset;
    records.push(record);
    return {kind: 'option', record, index};
  };

  let run: SelectorOptionData[] = [];
  const flush = (): void => {
    for (const item of order(run)) entries.push(add(item));
    run = [];
  };

  options.forEach((option, position) => {
    if (isDivider(option)) {
      flush();
      // A divider between groups would be orphaned once its neighbours are filtered out.
      if (!searching) entries.push({kind: 'divider', key: `divider-${position}`});
    } else if (isSection(option)) {
      flush();
      const items = order(visible(option.options));
      if (items.length === 0) return;
      entries.push({
        kind: 'section',
        key: `section-${position}`,
        title: option.title,
        entries: items.map((item) => add(item)),
      });
    } else {
      run.push(...visible([option]));
    }
  });
  flush();

  if (selectAllRow && records.length > 0) {
    const selectAll: SelectorRecord = {
      value: SELECT_ALL_VALUE,
      label: selectAllRow.label,
      disabled: false,
      data: {value: SELECT_ALL_VALUE, label: selectAllRow.label},
      selectAll: true,
    };
    return {
      entries: [{kind: 'option', record: selectAll, index: 0}, ...entries],
      records: [selectAll, ...records],
    };
  }
  return {entries, records};
}
