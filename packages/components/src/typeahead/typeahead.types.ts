import type {TemplateResult} from 'lit';

/** Field heights of the typeahead family (`--size-element-sm/md/lg`). */
export const TYPEAHEAD_SIZES = ['sm', 'md', 'lg'] as const;
export type TypeaheadSize = (typeof TYPEAHEAD_SIZES)[number];

/** What a `renderItem` function (or a pre-rendered `element`) returns: a template, a node or plain text (never HTML). */
export type TypeaheadRenderResult = TemplateResult | Node | string;

/**
 * Minimal item interface for search results. Put your own data in `auxiliaryData`.
 *
 * ```ts
 * const user: SearchableItem<{role: string}> = {id: '1', label: 'Jane Doe', auxiliaryData: {role: 'Engineer'}};
 * ```
 */
export interface SearchableItem<TAuxData = unknown> {
  /** Unique identifier of the item: the value a form submits. */
  id: string;
  /** Display label of the item. */
  label: string;
  /**
   * Pre-rendered content of the result row. Takes priority over `renderItem` and the default
   * label layout. A template, a node or text; never HTML.
   */
  element?: TypeaheadRenderResult;
  /** Arbitrary extra data associated with the item. `auxiliaryData.group` groups results under a heading. */
  auxiliaryData?: TAuxData;
}

/**
 * Search source: supplies the results of a query. Synchronous and asynchronous sources both work.
 *
 * ```ts
 * const users: SearchSource<UserItem> = {
 *   async search(query) { this.cancel(); ...await fetch... },
 *   bootstrap: () => recentUsers,
 *   cancel() { this.controller?.abort(); },
 * };
 * ```
 */
export interface SearchSource<T extends SearchableItem = SearchableItem> {
  /**
   * Called when the query changes (after the debounce). Returns the matching items. For expensive
   * operations consider caching results per query.
   */
  search(query: string): Promise<T[]> | T[];
  /** Called on focus when `entries-on-focus` is set. Returns the initial items. */
  bootstrap(): Promise<T[]> | T[];
  /**
   * Cancel any in-flight search. Called when a new search supersedes a previous one, or when the menu
   * closes. Optional: without it an older search simply resolves and its result is discarded.
   */
  cancel?(): void;
}

/** Reads `auxiliaryData.group`: the heading a result is listed under, when it has one. */
export function getItemGroup(item: SearchableItem): string | undefined {
  const aux = item.auxiliaryData as Record<string, unknown> | undefined;
  return typeof aux?.group === 'string' ? aux.group : undefined;
}

/** A group of results with an optional heading (`null` for ungrouped items). */
export interface ItemGroup<T extends SearchableItem = SearchableItem> {
  heading: string | null;
  items: T[];
}

/**
 * Groups items by `auxiliaryData.group`, keeping the order in which groups first appear. Ungrouped items
 * form a group without a heading, listed first (`ungroupedFirst`, the typeahead's order) or last.
 * Without any group it returns one heading-less group with the items as they are.
 */
export function groupItems<T extends SearchableItem>(
  items: T[],
  {ungroupedFirst = false}: {ungroupedFirst?: boolean} = {},
): ItemGroup<T>[] {
  if (!items.some((item) => getItemGroup(item) !== undefined)) return [{heading: null, items}];
  const named = new Map<string, T[]>();
  const ungrouped: T[] = [];
  for (const item of items) {
    const group = getItemGroup(item);
    if (group === undefined) ungrouped.push(item);
    else named.set(group, [...(named.get(group) ?? []), item]);
  }
  const groups: ItemGroup<T>[] = [...named].map(([heading, list]) => ({heading, items: list}));
  const rest: ItemGroup<T>[] = ungrouped.length > 0 ? [{heading: null, items: ungrouped}] : [];
  return ungroupedFirst ? [...rest, ...groups] : [...groups, ...rest];
}
