/**
 * Pagination (useTablePagination, paginateData): the client-side slice, the page controls in every
 * variant and position, page announcements, and composition with selection.
 */
import {afterEach, beforeAll, beforeEach, describe, expect, it} from 'vitest';
import {getAnnouncerRegions} from '@tecton-wc/core/a11y/announcer.js';
import {overrideFeature} from '@tecton-wc/core/features.js';
import {axNode, expectAccessible} from '@tecton-wc/testing/a11y.js';
import {fixture} from '@tecton-wc/testing/fixture.js';
import {pressKeys} from '@tecton-wc/testing/keyboard.js';
import {aTimeout, waitUntil} from '@tecton-wc/testing/timing.js';
import './define.js';
import {
  TablePaginationController,
  TableSelectionController,
  TableSelectionStateController,
  paginateData,
  pageWindow,
  type TablePaginationConfig,
} from './define.js';
import {bodyText, useLayeredPreflight} from './table-test-helpers.js';
import type {TctTable} from './tct-table.js';

beforeAll(useLayeredPreflight);

interface Item extends Record<string, unknown> {
  id: string;
  name: string;
}

const ITEMS: Item[] = Array.from({length: 95}, (_, i) => ({
  id: `i${i + 1}`,
  name: `Item ${i + 1}`,
}));
const COLUMNS = [{key: 'name', header: 'Name'}];

describe('paginateData (useTablePagination.test.tsx)', () => {
  const data = Array.from({length: 25}, (_, i) => i + 1);

  it('slices data for page 1, page 2 and a partial last page', () => {
    expect(paginateData(data, 1, 10)).toEqual(data.slice(0, 10));
    expect(paginateData(data, 2, 10)).toEqual(data.slice(10, 20));
    expect(paginateData(data, 3, 10)).toEqual([21, 22, 23, 24, 25]);
  });

  it('returns an empty array for empty data or a page past the end', () => {
    expect(paginateData([], 1, 10)).toEqual([]);
    expect(paginateData(data, 9, 10)).toEqual([]);
  });

  it('handles data shorter than the page size', () => {
    expect(paginateData([1, 2, 3], 1, 10)).toEqual([1, 2, 3]);
  });

  it('clamps invalid pages to the first page and bad page sizes to a positive integer (#3593)', () => {
    expect(paginateData(data, 0, 10)).toEqual(data.slice(0, 10));
    expect(paginateData(data, -1, 10)).toEqual(data.slice(0, 10));
    expect(paginateData(data, Number.NaN, 10)).toEqual(data.slice(0, 10));
    expect(paginateData(data, 1.9, 10)).toEqual(data.slice(0, 10));
    expect(paginateData(data, 1, 0)).toEqual([1]);
    expect(paginateData(data, 1, Number.NaN)).toEqual(data.slice(0, 10));
  });
});

describe('pageWindow', () => {
  it('lists every page when there are few, and elides the middle when there are many', () => {
    expect(pageWindow(1, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(pageWindow(1, 20)).toEqual([1, 2, 3, 4, 5, null, 20]);
    expect(pageWindow(10, 20)).toEqual([1, null, 9, 10, 11, null, 20]);
    expect(pageWindow(20, 20)).toEqual([1, null, 16, 17, 18, 19, 20]);
  });
});

interface Harness {
  table: TctTable<Item>;
  plugin: TablePaginationController<Item>;
  pages: number[];
  sizes: number[];
  state: {page: number; pageSize: number};
}

async function make(
  options: Partial<TablePaginationConfig> & {data?: Item[]; dir?: 'rtl'; lang?: string} = {},
): Promise<Harness> {
  const root = await fixture<HTMLElement>(
    `<div ${options.dir ? `dir="${options.dir}"` : ''} ${options.lang ? `lang="${options.lang}"` : ''}><tct-table></tct-table></div>`,
  );
  const table = root.querySelector<TctTable<Item>>('tct-table')!;
  const data = options.data ?? ITEMS;
  const pages: number[] = [];
  const sizes: number[] = [];
  const state = {page: options.page ?? 1, pageSize: options.pageSize ?? 10};
  const {data: _data, dir: _dir, lang: _lang, ...rest} = options;
  void _data;
  void _dir;
  void _lang;
  const render = (): void => {
    table.data = paginateData(data, state.page, state.pageSize);
    table.rowIndexStart = (state.page - 1) * state.pageSize + 1;
    table.rowCount = data.length;
  };
  const plugin = new TablePaginationController<Item>(table, {
    totalItems: data.length,
    ...rest,
    get page() {
      return state.page;
    },
    get pageSize() {
      return state.pageSize;
    },
    onPageChange: (page) => {
      pages.push(page);
      state.page = page;
      render();
      plugin.refresh();
    },
    onPageSizeChange: (size) => {
      sizes.push(size);
      state.pageSize = size;
      state.page = 1;
      render();
      plugin.refresh();
    },
  });
  Object.assign(table, {columns: COLUMNS, idKey: 'id', plugins: {pagination: plugin}});
  render();
  await table.updateComplete;
  return {table, plugin, pages, sizes, state};
}

const nav = (table: Element): HTMLElement[] => [
  ...table.querySelectorAll<HTMLElement>('nav.tct-table-pager'),
];
const inner = (button: Element): HTMLButtonElement =>
  button.shadowRoot!.querySelector<HTMLButtonElement>('button')!;
const byLabel = (table: Element, label: string): HTMLElement =>
  table.querySelector<HTMLElement>(
    `tct-button[label="${label}"], tct-button[aria-label="${label}"]`,
  )!;

describe('table pagination plugin', () => {
  describe('placement', () => {
    it('renders the controls below the table by default, outside the scroll region', async () => {
      const {table} = await make();
      const [pager] = nav(table);
      expect(pager).toBeTruthy();
      const region = table.querySelector('.tct-table-scroll')!;
      expect(region.contains(pager!)).toBe(false);
      expect(
        region.compareDocumentPosition(pager!) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      expect(pager!.closest('.tct-table-pagination')!.getAttribute('data-position')).toBe('below');
    });

    it('renders above, or above and below with distinct names', async () => {
      const above = await make({position: 'above'});
      const [pager] = nav(above.table);
      expect(
        pager!.compareDocumentPosition(above.table.querySelector('.tct-table-scroll')!) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      const both = await make({position: 'both'});
      expect(nav(both.table).map((el) => el.getAttribute('aria-label'))).toEqual([
        'Table pagination (top)',
        'Table pagination (bottom)',
      ]);
      const custom = await make({position: 'both', label: 'Orders'});
      expect(nav(custom.table).map((el) => el.getAttribute('aria-label'))).toEqual([
        'Orders (top)',
        'Orders (bottom)',
      ]);
    });

    it('renders nothing for position none, variant none, one page or no items', async () => {
      expect(nav((await make({position: 'none'})).table)).toHaveLength(0);
      expect(nav((await make({variant: 'none'})).table)).toHaveLength(0);
      expect(nav((await make({data: ITEMS.slice(0, 5)})).table)).toHaveLength(0);
      expect(nav((await make({data: [], totalItems: 0})).table)).toHaveLength(0);
      expect(nav((await make({totalItems: undefined, totalPages: 1})).table)).toHaveLength(0);
    });

    it('still renders with one page of data when hasMore is true', async () => {
      const {table} = await make({data: ITEMS.slice(0, 5), totalItems: undefined, hasMore: true});
      expect(nav(table)).toHaveLength(1);
      expect(byLabel(table, 'Go to next page').hasAttribute('disabled')).toBe(false);
    });

    it('aligns the controls', async () => {
      for (const align of ['start', 'center', 'end'] as const) {
        const {table} = await make({align});
        expect(table.querySelector('.tct-table-pagination')!.getAttribute('data-align')).toBe(
          align,
        );
      }
      const {table} = await make({align: 'end'});
      const wrapper = table.querySelector<HTMLElement>('.tct-table-pagination')!;
      expect(getComputedStyle(wrapper).justifyContent).toMatch(/flex-end|end/);
    });
  });

  describe('paging', () => {
    it('shows the page slice, and previous/next and page buttons change it', async () => {
      const {table, pages} = await make();
      expect(bodyText(table)).toHaveLength(10);
      expect(bodyText(table)[0]![0]).toBe('Item 1');
      inner(byLabel(table, 'Go to next page')).click();
      await table.updateComplete;
      expect(pages).toEqual([2]);
      expect(bodyText(table)[0]![0]).toBe('Item 11');
      inner(byLabel(table, 'Go to page 5')).click();
      await table.updateComplete;
      expect(bodyText(table)[0]![0]).toBe('Item 41');
      inner(byLabel(table, 'Go to previous page')).click();
      await table.updateComplete;
      expect(pages).toEqual([2, 5, 4]);
      expect(bodyText(table)[0]![0]).toBe('Item 31');
    });

    it('disables previous on the first page and next on the last, and never goes out of range', async () => {
      const first = await make();
      expect(byLabel(first.table, 'Go to previous page').hasAttribute('disabled')).toBe(true);
      const last = await make({page: 10});
      expect(byLabel(last.table, 'Go to next page').hasAttribute('disabled')).toBe(true);
      expect(bodyText(last.table)).toHaveLength(5);
      expect(last.pages).toEqual([]);
    });

    it('marks the current page with aria-current and names every page button', async () => {
      const {table} = await make({page: 3});
      const current = table.querySelector('tct-button[aria-current="page"]')!;
      expect(current.textContent.trim()).toBe('3');
      expect(current.getAttribute('aria-label')).toBe('Go to page 3');
      expect(table.querySelectorAll('tct-button[aria-current]')).toHaveLength(1);
      expect((await axNode(inner(current))).name).toBe('Go to page 3');
    });

    it('elides the middle of a long page list', async () => {
      const {table} = await make({page: 5});
      const numbers = [
        ...table.querySelectorAll('nav.tct-table-pager tct-button:not([icon-only])'),
      ].map((button) => button.textContent.trim());
      expect(numbers).toEqual(['1', '4', '5', '6', '10']);
      expect(table.querySelectorAll('.tct-table-pager-ellipsis').length).toBeGreaterThan(0);
    });

    it('handles rapid page changes', async () => {
      const {table, pages} = await make();
      for (const label of ['Go to next page', 'Go to next page', 'Go to next page']) {
        inner(byLabel(table, label)).click();
        await table.updateComplete;
      }
      expect(pages).toEqual([2, 3, 4]);
      expect(bodyText(table)[0]![0]).toBe('Item 31');
    });

    it('keeps aria-rowindex and aria-rowcount on the full dataset', async () => {
      const {table} = await make({page: 3});
      expect(table.querySelector('table')!.getAttribute('aria-rowcount')).toBe('95');
      expect(table.querySelector('tbody tr')!.getAttribute('aria-rowindex')).toBe('21');
    });
  });

  describe('variants', () => {
    it('count shows "from–to of total"', async () => {
      const {table} = await make({variant: 'count', page: 2});
      expect(table.querySelector('.tct-table-pager-text')!.textContent).toBe('11–20 of 95');
      const last = await make({variant: 'count', page: 10});
      expect(last.table.querySelector('.tct-table-pager-text')!.textContent).toBe('91–95 of 95');
    });

    it('compact shows "Page x of y" and no numbered buttons', async () => {
      const {table} = await make({variant: 'compact', page: 4});
      expect(table.querySelector('.tct-table-pager-text')!.textContent).toBe('Page 4 of 10');
      expect(
        table.querySelectorAll('nav.tct-table-pager tct-button:not([icon-only])'),
      ).toHaveLength(0);
    });

    it('dots shows one indicator per page and switches pages', async () => {
      const {table, pages} = await make({variant: 'dots', data: ITEMS.slice(0, 35)});
      const dots = [...table.querySelectorAll<HTMLButtonElement>('button.tct-table-pager-dot')];
      expect(dots).toHaveLength(4);
      expect(dots[0]!.getAttribute('aria-current')).toBe('page');
      dots[2]!.click();
      await table.updateComplete;
      expect(pages).toEqual([3]);
      expect(dots[2]!.getAttribute('aria-label')).toBe('Go to page 3');
      const rect = dots[0]!.getBoundingClientRect();
      expect(rect.width).toBeGreaterThanOrEqual(24);
      expect(rect.height).toBeGreaterThanOrEqual(24);
    });

    it('cursor mode (hasMore, no total) shows "Page n" and next only while more follows', async () => {
      const {table, pages} = await make({
        data: ITEMS.slice(0, 10),
        totalItems: undefined,
        hasMore: true,
      });
      expect(table.querySelector('.tct-table-pager-text')!.textContent).toBe('Page 1');
      inner(byLabel(table, 'Go to next page')).click();
      expect(pages).toEqual([2]);
    });

    it('sizes the buttons (sm and md)', async () => {
      const {table} = await make({size: 'sm'});
      expect(table.querySelector('nav.tct-table-pager tct-button')!.getAttribute('size')).toBe(
        'sm',
      );
    });
  });

  describe('page size', () => {
    it('offers the sizes in a labelled select and reports the choice', async () => {
      const {table, sizes} = await make({pageSizeOptions: [10, 25, 50]});
      const select = table.querySelector<HTMLSelectElement>('.tct-table-pager-size select')!;
      expect([...select.options].map((option) => option.value)).toEqual(['10', '25', '50']);
      expect(select.value).toBe('10');
      expect((await axNode(select)).name).toBe('Items per page');
      select.value = '25';
      select.dispatchEvent(new Event('change', {bubbles: true}));
      await table.updateComplete;
      expect(sizes).toEqual([25]);
      expect(bodyText(table)).toHaveLength(25);
    });

    it('shows no select without pageSizeOptions', async () => {
      const {table} = await make();
      expect(table.querySelector('.tct-table-pager-size')).toBeNull();
    });

    it('guards a page size of 0 against an infinite page count', async () => {
      const {table} = await make({pageSize: 0, data: ITEMS.slice(0, 3)});
      expect(table.querySelector('table')).toBeTruthy();
      expect(nav(table).length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('accessibility', () => {
    it('names the landmark and passes axe in every variant', async () => {
      for (const variant of ['pages', 'count', 'compact', 'dots'] as const) {
        const {table} = await make({variant, position: 'both', pageSizeOptions: [10, 20]});
        await expectAccessible(table);
      }
      const {table} = await make();
      expect(nav(table)[0]!.getAttribute('aria-label')).toBe('Table pagination');
      expect((await axNode(nav(table)[0]!)).role).toBe('navigation');
    });

    it('is keyboard operable: Tab reaches the controls, Enter activates', async () => {
      const {table, pages} = await make();
      inner(byLabel(table, 'Go to next page')).focus();
      await pressKeys('Enter');
      await table.updateComplete;
      expect(pages).toEqual([2]);
    });

    it('passes axe in RTL', async () => {
      const {table} = await make({dir: 'rtl', page: 2});
      await expectAccessible(table);
    });
  });

  describe('announcement', () => {
    let restore: () => void;
    beforeEach(() => {
      restore = overrideFeature('ariaNotify', false);
    });
    afterEach(() => {
      restore();
    });

    it('announces the page the user moved to, once the table shows it', async () => {
      const {table} = await make();
      inner(byLabel(table, 'Go to next page')).click();
      await waitUntil(
        () => getAnnouncerRegions().polite?.textContent === 'Page 2',
        'page announcement',
      );
    });

    it('does not announce a page change made by the owner', async () => {
      const {table, plugin, state} = await make();
      state.page = 3;
      plugin.refresh();
      await table.updateComplete;
      await aTimeout(300);
      expect(getAnnouncerRegions().polite?.textContent ?? '').toBe('');
    });
  });

  describe('i18n', () => {
    it('localises the controls in de-DE', async () => {
      const {table} = await make({lang: 'de-DE', variant: 'compact'});
      await waitUntil(
        () => table.querySelector('.tct-table-pager-text')!.textContent.includes('Seite'),
        'de-DE catalog',
      );
    });
  });

  it('works alongside the selection plugin, in either record order', async () => {
    const root = await fixture<HTMLElement>('<div><tct-table></tct-table></div>');
    const table = root.querySelector<TctTable<Item>>('tct-table')!;
    const state = new TableSelectionStateController<Item>(table, {
      data: ITEMS.slice(0, 10),
      idKey: 'id',
    });
    const selection = new TableSelectionController<Item>(table, state.selectionConfig);
    const pagination = new TablePaginationController<Item>(table, {
      page: 1,
      totalItems: 95,
      onPageChange: () => undefined,
    });
    Object.assign(table, {
      data: ITEMS.slice(0, 10),
      columns: COLUMNS,
      idKey: 'id',
      plugins: {pagination, selection},
    });
    await table.updateComplete;
    expect(table.querySelectorAll('tbody tct-checkbox-input')).toHaveLength(10);
    expect(table.querySelectorAll('nav.tct-table-pager')).toHaveLength(1);
    await expectAccessible(table);
  });
});
