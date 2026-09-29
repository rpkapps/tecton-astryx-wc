import type {SearchableItem, SearchSource} from './typeahead.types.js';

export interface CreateStaticSourceOptions<T extends SearchableItem = SearchableItem> {
  /**
   * Extracts additional search terms from an item; they are checked alongside the label.
   *
   * ```ts
   * createStaticSource(items, {keywords: (item) => item.auxiliaryData?.aliases ?? []});
   * ```
   */
  keywords?: (item: T) => string[];
}

/**
 * Creates a search source from a static array of items. It filters by case-insensitive substring match
 * on `label` and the optional keywords; an empty query returns every item, and `bootstrap()` returns
 * every item. For anything beyond substring matching (fuzzy, ranked, server side) implement
 * `SearchSource` directly.
 *
 * ```ts
 * const source = createStaticSource([{id: 'home', label: 'Home'}, {id: 'settings', label: 'Settings'}]);
 * typeahead.searchSource = source;
 * ```
 */
export function createStaticSource<T extends SearchableItem>(
  items: T[],
  options?: CreateStaticSourceOptions<T>,
): SearchSource<T> {
  const keywords = options?.keywords;
  return {
    search(query: string): T[] {
      const needle = query.toLowerCase().trim();
      if (needle === '') return items;
      return items.filter(
        (item) =>
          item.label.toLowerCase().includes(needle) ||
          (keywords?.(item).some((keyword) => keyword.toLowerCase().includes(needle)) ?? false),
      );
    },
    bootstrap(): T[] {
      return items;
    },
  };
}
