/**
 * `createStaticSource` and the server-safe `utils` entry (upstream createStaticSource / Typeahead/utils).
 */
import {describe, expect, it} from 'vitest';
import {createStaticSource, getItemGroup, groupItems} from './utils.js';
import type {SearchableItem} from './utils.js';

const ITEMS: SearchableItem<{aliases?: string[]; group?: string}>[] = [
  {id: 'home', label: 'Home', auxiliaryData: {aliases: ['start', 'dashboard'], group: 'Pages'}},
  {id: 'settings', label: 'Settings', auxiliaryData: {aliases: ['preferences'], group: 'Pages'}},
  {id: 'help', label: 'Help Centre'},
];

describe('createStaticSource', () => {
  const source = createStaticSource(ITEMS);

  it('an empty or blank query returns every item, and bootstrap returns every item', () => {
    expect(source.search('')).toBe(ITEMS);
    expect(source.search('   ')).toBe(ITEMS);
    expect(source.bootstrap()).toBe(ITEMS);
  });

  it('matches a case-insensitive substring of the label, ignoring surrounding whitespace', () => {
    expect((source.search(' SET ') as SearchableItem[]).map((item) => item.id)).toEqual([
      'settings',
    ]);
    expect((source.search('e') as SearchableItem[]).map((item) => item.id)).toEqual([
      'home',
      'settings',
      'help',
    ]);
    expect((source.search('centre') as SearchableItem[]).map((item) => item.id)).toEqual(['help']);
  });

  it('returns nothing for a query that matches no label', () => {
    expect(source.search('zzz')).toEqual([]);
  });

  it('is synchronous and has no cancel: nothing to abort', () => {
    expect(Array.isArray(source.search('h'))).toBe(true);
    expect('cancel' in source).toBe(false);
  });

  it('keywords are checked alongside the label', () => {
    const withKeywords = createStaticSource(ITEMS, {
      keywords: (item) => item.auxiliaryData?.aliases ?? [],
    });
    expect((withKeywords.search('PREFER') as SearchableItem[]).map((item) => item.id)).toEqual([
      'settings',
    ]);
    expect((withKeywords.search('dash') as SearchableItem[]).map((item) => item.id)).toEqual([
      'home',
    ]);
    // The label still matches.
    expect((withKeywords.search('help') as SearchableItem[]).map((item) => item.id)).toEqual([
      'help',
    ]);
    // Without the option the alias is not searched.
    expect(source.search('preferences')).toEqual([]);
  });
});

describe('typeahead utils entry', () => {
  it('getItemGroup reads auxiliaryData.group when it is a string', () => {
    expect(getItemGroup(ITEMS[0]!)).toBe('Pages');
    expect(getItemGroup(ITEMS[2]!)).toBeUndefined();
    expect(getItemGroup({id: 'x', label: 'X', auxiliaryData: {group: 4}})).toBeUndefined();
  });

  it('groupItems keeps the first-seen order of headings, ungrouped items last (or first)', () => {
    const groups = groupItems(ITEMS);
    expect(groups.map((group) => group.heading)).toEqual(['Pages', null]);
    expect(groups[0]!.items.map((item) => item.id)).toEqual(['home', 'settings']);
    expect(groupItems(ITEMS, {ungroupedFirst: true}).map((group) => group.heading)).toEqual([
      null,
      'Pages',
    ]);
  });

  it('groupItems without any group is one heading-less group with the items as they are', () => {
    const plain: SearchableItem[] = [{id: 'a', label: 'A'}];
    expect(groupItems(plain)).toEqual([{heading: null, items: plain}]);
  });
});
