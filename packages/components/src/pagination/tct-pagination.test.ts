/**
 * tct-pagination: the element suite, then rendering of every variant, the page and page-size events,
 * announcements, step, change action, cursor paging, the dots as a radio-group-like row, the page box,
 * the page-size selector, the sixteen messages in de-DE, RTL, forced colours and axe. Ported from upstream
 * Pagination.test.tsx where the behaviour applies.
 */
import {html} from 'lit';
import {userEvent} from 'vitest/browser';
import {afterEach, describe, expect, it} from 'vitest';
import {deepActiveElement} from '@tecton-wc/core/utils/focus.js';
import {expectAccessible} from '@tecton-wc/testing/a11y.js';
import {emulateMedia} from '@tecton-wc/testing/emulate.js';
import {expectEventCounts, recordEvents} from '@tecton-wc/testing/events.js';
import {fixture} from '@tecton-wc/testing/fixture.js';
import {pressKeys} from '@tecton-wc/testing/keyboard.js';
import {runElementSuite} from '@tecton-wc/testing/suites/element.js';
import {nextFrame, waitUntil} from '@tecton-wc/testing/timing.js';
import {
  openByClick,
  optionsOf,
  optionTexts,
  recordAnnouncements,
  type SelectLike,
} from '../selector/fixtures/selector-test-helpers.js';
import './define.js';
import type {TctPagination} from './tct-pagination.js';

let recorder: ReturnType<typeof recordAnnouncements> | undefined;
afterEach(() => {
  recorder?.restore();
  recorder = undefined;
});

/** Mounts a paginator (`page-size` etc. as attributes) and lets it settle. */
async function make(attributes = 'total-pages="10"', lang?: string): Promise<TctPagination> {
  const wrapper = await fixture<HTMLElement>(
    `<div ${lang ? `lang="${lang}"` : ''} style="padding:24px;inline-size:900px"><tct-pagination ${attributes}></tct-pagination></div>`,
  );
  const element = wrapper.querySelector<TctPagination>('tct-pagination')!;
  await settle(element);
  return element;
}

const settle = async (element: TctPagination): Promise<void> => {
  await element.updateComplete;
  await nextFrame();
  await element.updateComplete;
};

const root = (element: TctPagination): ShadowRoot => element.shadowRoot!;
const nav = (element: TctPagination): HTMLElement | null => root(element).querySelector('nav');
const step = (element: TctPagination, name: string): HTMLElement & {disabled: boolean} =>
  root(element).querySelector<HTMLElement & {disabled: boolean}>(`tct-button.${name}`)!;
const pageButtons = (element: TctPagination): (HTMLElement & {disabled: boolean})[] => [
  ...root(element).querySelectorAll<HTMLElement & {disabled: boolean}>('tct-button.page'),
];
const pageNumbers = (element: TctPagination): string[] =>
  pageButtons(element).map((button) => button.textContent.trim());
const dots = (element: TctPagination): HTMLButtonElement[] => [
  ...root(element).querySelectorAll<HTMLButtonElement>('button.dot'),
];
const currentDot = (element: TctPagination): number =>
  dots(element).findIndex((dot) => dot.getAttribute('aria-current') === 'page') + 1;
const readout = (element: TctPagination): string =>
  root(element).querySelector('.readout')?.textContent?.trim() ?? '';
const pageBox = (element: TctPagination): HTMLElement & {value: string; max?: number} =>
  root(element).querySelector<HTMLElement & {value: string; max?: number}>('tct-number-input')!;
const boxInput = (element: TctPagination): HTMLInputElement =>
  pageBox(element).shadowRoot!.querySelector<HTMLInputElement>('input.input')!;
const sizeSelector = (element: TctPagination): HTMLElement & {value: string} =>
  root(element).querySelector<HTMLElement & {value: string}>('tct-selector')!;

/** The native button inside a `tct-button` (what the accessibility tree and the keyboard see). */
const inner = (host: HTMLElement): HTMLButtonElement =>
  host.shadowRoot!.querySelector<HTMLButtonElement>('button')!;

/** Types a page into the box (replacing what is there) and presses Enter. */
async function typePage(element: TctPagination, text: string, key = 'Enter'): Promise<void> {
  await userEvent.click(boxInput(element));
  await userEvent.clear(boxInput(element));
  if (text) await userEvent.type(boxInput(element), text);
  await pressKeys(key);
  await settle(element);
}

runElementSuite({
  tag: 'tct-pagination',
  render: () => html`<tct-pagination total-pages="10"></tct-pagination>`,
  properties: {
    page: 3,
    totalItems: 95,
    totalPages: 8,
    hasMore: true,
    pageSize: 20,
    pageSizeOptions: [10, 20],
    variant: 'compact',
    pageLabel: 'Row',
    noFirstLast: true,
    step: 2,
    siblingCount: 2,
    size: 'sm',
    disabled: true,
    label: 'Results',
  },
  attributes: {
    page: 'page',
    totalItems: 'total-items',
    totalPages: 'total-pages',
    hasMore: 'has-more',
    pageSize: 'page-size',
    variant: 'variant',
    pageLabel: 'page-label',
    noFirstLast: 'no-first-last',
    step: 'step',
    siblingCount: 'sibling-count',
    size: 'size',
    disabled: 'disabled',
    label: 'label',
  },
  events: ['tct-page-change', 'tct-page-size-change'],
});

describe('tct-pagination: basic rendering', () => {
  it('renders a nav landmark with the default label', async () => {
    const element = await make();
    expect(nav(element)!.getAttribute('aria-label')).toBe('Pagination');
  });

  it('renders a nav landmark with a custom label', async () => {
    const element = await make('total-pages="10" label="Search results"');
    expect(nav(element)!.getAttribute('aria-label')).toBe('Search results');
  });

  it('renders previous and next buttons named for what they do', async () => {
    const element = await make('page="3" total-pages="10"');
    expect(step(element, 'previous').getAttribute('label')).toBe('Go to previous page');
    expect(step(element, 'next').getAttribute('label')).toBe('Go to next page');
    expect(inner(step(element, 'previous')).getAttribute('aria-label')).toBe('Go to previous page');
  });

  it('gives the previous and next buttons a tooltip matching their name while they can be used', async () => {
    const element = await make('page="3" total-pages="10"');
    expect(step(element, 'previous').getAttribute('tooltip')).toBe('Go to previous page');
    expect(step(element, 'next').getAttribute('tooltip')).toBe('Go to next page');
    element.page = 1;
    await settle(element);
    expect(step(element, 'previous').getAttribute('tooltip')).toBe('');
  });

  it('renders the chevrons as icons, which mirror by themselves in right-to-left', async () => {
    const element = await make('page="3" total-pages="10"');
    expect(step(element, 'previous').getAttribute('icon')).toBe('chevronLeft');
    expect(step(element, 'next').getAttribute('icon')).toBe('chevronRight');
    expect(step(element, 'previous').hasAttribute('icon-only')).toBe(true);
  });

  it('renders nothing for zero items or zero pages', async () => {
    const noItems = await make('total-items="0"');
    expect(nav(noItems)).toBeNull();
    const noPages = await make('total-pages="0"');
    expect(nav(noPages)).toBeNull();
  });

  it('exposes its parts', async () => {
    const element = await make('page="3" total-pages="10" page-size-options="10,20"');
    for (const part of ['nav', 'controls', 'previous', 'next', 'page', 'page-size']) {
      expect(root(element).querySelector(`[part~="${part}"]`), part).not.toBeNull();
    }
  });
});

describe('tct-pagination: variant pages', () => {
  it('renders page number buttons named "Go to page N"', async () => {
    const element = await make('page="1" total-pages="5"');
    expect(pageNumbers(element)).toEqual(['1', '2', '3', '4', '5']);
    expect(inner(pageButtons(element)[2]!).getAttribute('aria-label')).toBe('Go to page 3');
  });

  it('marks the current page with aria-current', async () => {
    const element = await make('page="3" total-pages="5"');
    const current = pageButtons(element).filter(
      (button) => button.getAttribute('aria-current') === 'page',
    );
    expect(current.map((button) => button.textContent.trim())).toEqual(['3']);
    expect(inner(current[0]!).getAttribute('aria-current')).toBe('page');
  });

  it('shows aria-hidden ellipses for many pages', async () => {
    const element = await make('page="5" total-pages="10"');
    expect(pageNumbers(element)).toEqual(['1', '4', '5', '6', '10']);
    const ellipses = root(element).querySelectorAll('.ellipsis');
    expect(ellipses).toHaveLength(2);
    for (const ellipsis of ellipses) expect(ellipsis.getAttribute('aria-hidden')).toBe('true');
  });

  it('honours sibling-count', async () => {
    const element = await make('page="6" total-pages="12" sibling-count="2"');
    expect(pageNumbers(element)).toEqual(['1', '4', '5', '6', '7', '8', '12']);
  });

  it('does not render pages when the total is unknown', async () => {
    const element = await make('page="2" has-more');
    expect(pageButtons(element)).toHaveLength(0);
    expect(step(element, 'next').disabled).toBe(false);
  });

  it('derives the page count from total-items and page-size; the default size is 10', async () => {
    const element = await make('total-items="95"');
    expect(pageNumbers(element)).toEqual(['1', '2', '3', '4', '5', '10']);
    element.pageSize = 20;
    await settle(element);
    expect(pageNumbers(element)).toEqual(['1', '2', '3', '4', '5']);
  });

  it('total-items wins over total-pages, as the count readout does', async () => {
    const element = await make('total-items="30" total-pages="9"');
    expect(pageNumbers(element)).toEqual(['1', '2', '3']);
  });
});

describe('tct-pagination: variant count', () => {
  it('renders the item range', async () => {
    const element = await make('variant="count" page="2" total-items="95"');
    expect(readout(element)).toBe('11–20 of 95');
  });

  it('clamps the end of the range to the total on the last page', async () => {
    const element = await make('variant="count" page="10" total-items="95"');
    expect(readout(element)).toBe('91–95 of 95');
  });

  it('renders no readout without an item count', async () => {
    const element = await make('variant="count" page="2" total-pages="10"');
    expect(readout(element)).toBe('');
  });
});

describe('tct-pagination: variant compact and none', () => {
  it('renders "Page X of Y"', async () => {
    const element = await make('variant="compact" page="3" total-pages="10"');
    expect(readout(element)).toBe('Page 3 of 10');
  });

  it('none renders only previous and next', async () => {
    const element = await make('variant="none" page="3" total-pages="10"');
    expect(root(element).querySelectorAll('tct-button')).toHaveLength(2);
    expect(root(element).querySelector('.readout, .dots, .input-group')).toBeNull();
  });
});

describe('tct-pagination: page size guarding', () => {
  it('does not crash on a page size of 0; it is treated as 1', async () => {
    const element = await make('variant="dots" total-items="12" page-size="0"');
    expect(dots(element)).toHaveLength(12);
  });

  it('treats a non-numeric page size as the default 10', async () => {
    const element = await make('variant="dots" total-items="30" page-size="many"');
    expect(dots(element)).toHaveLength(3);
  });

  it('clamps a negative page size to 1', async () => {
    const element = await make('variant="dots" total-items="7" page-size="-4"');
    expect(dots(element)).toHaveLength(7);
  });

  it('floors a fractional page size', async () => {
    const element = await make('variant="dots" total-items="10" page-size="2.9"');
    expect(dots(element)).toHaveLength(5);
  });
});

describe('tct-pagination: boundary states and cursor paging', () => {
  it('disables previous on the first page and next on the last', async () => {
    const element = await make('page="1" total-pages="5"');
    expect(step(element, 'previous').disabled).toBe(true);
    expect(step(element, 'next').disabled).toBe(false);
    element.page = 5;
    await settle(element);
    expect(step(element, 'previous').disabled).toBe(false);
    expect(step(element, 'next').disabled).toBe(true);
  });

  it('enables both in the middle and disables both with a single page', async () => {
    const middle = await make('page="3" total-pages="5"');
    expect([step(middle, 'previous').disabled, step(middle, 'next').disabled]).toEqual([
      false,
      false,
    ]);
    const single = await make('page="1" total-pages="1"');
    expect([step(single, 'previous').disabled, step(single, 'next').disabled]).toEqual([
      true,
      true,
    ]);
  });

  it('cursor paging: next follows has-more, previous follows the page', async () => {
    const more = await make('page="1" has-more');
    expect([step(more, 'previous').disabled, step(more, 'next').disabled]).toEqual([true, false]);
    const end = await make('page="4"');
    expect([step(end, 'previous').disabled, step(end, 'next').disabled]).toEqual([false, true]);
  });

  it('disabled disables every control', async () => {
    const element = await make('page="3" total-pages="10" disabled page-size-options="10,20"');
    expect(step(element, 'previous').disabled).toBe(true);
    expect(step(element, 'next').disabled).toBe(true);
    for (const button of pageButtons(element)) expect(button.disabled).toBe(true);
    expect(sizeSelector(element).hasAttribute('disabled')).toBe(true);
    expect(element.matches(':state(disabled)')).toBe(true);
  });
});

describe('tct-pagination: page change events', () => {
  it('a page button fires tct-page-change (cancelable, with the requested and the old page), then the page changes', async () => {
    const element = await make('page="3" total-pages="10"');
    const events = recordEvents(element, ['tct-page-change', 'input', 'change']);
    await userEvent.click(
      pageButtons(element).find((button) => button.textContent.trim() === '4')!,
    );
    await settle(element);
    expectEventCounts(events, {'tct-page-change': 1});
    const event = events.named('tct-page-change')[0] as unknown as {
      page: number;
      oldPage: number;
      reason: string;
      cancelable: boolean;
      bubbles: boolean;
      composed: boolean;
    };
    expect([event.page, event.oldPage, event.reason]).toEqual([4, 3, 'pointer']);
    expect([event.cancelable, event.bubbles, event.composed]).toEqual([true, true, true]);
    expect(element.page).toBe(4);
    expect(currentDot(element)).toBe(0);
  });

  it('next and previous move by one page', async () => {
    const element = await make('page="3" total-pages="10"');
    await userEvent.click(step(element, 'next'));
    expect(element.page).toBe(4);
    await userEvent.click(step(element, 'previous'));
    await userEvent.click(step(element, 'previous'));
    expect(element.page).toBe(2);
  });

  it('preventDefault keeps the current page', async () => {
    const element = await make('page="3" total-pages="10"');
    element.addEventListener('tct-page-change', (event) => event.preventDefault());
    await userEvent.click(step(element, 'next'));
    await settle(element);
    expect(element.page).toBe(3);
  });

  it('clicking the current page asks for nothing', async () => {
    const element = await make('page="3" total-pages="10"');
    const events = recordEvents(element, 'tct-page-change');
    await userEvent.click(
      pageButtons(element).find((button) => button.textContent.trim() === '3')!,
    );
    expect(events.events).toHaveLength(0);
  });

  it('writing page from code fires nothing and announces nothing', async () => {
    recorder = recordAnnouncements();
    const element = await make('page="1" total-pages="10"');
    const events = recordEvents(element, ['tct-page-change', 'input', 'change']);
    element.page = 5;
    element.setAttribute('page', '6');
    await settle(element);
    expect(events.events).toHaveLength(0);
    expect(recorder.messages()).toEqual([]);
  });

  it('a page request from the keyboard names its reason', async () => {
    const element = await make('page="3" total-pages="10"');
    const events = recordEvents(element, 'tct-page-change');
    inner(step(element, 'next')).focus();
    await pressKeys('Enter');
    await settle(element);
    expect(events.events[0]!.reason).toBe('keyboard');
    expect(element.page).toBe(4);
  });

  it('keeps the inner controls internal: the page box and selector events do not leave the element', async () => {
    const element = await make(
      'variant="input" page="2" total-pages="10" page-size-options="10,20"',
    );
    const leaked = recordEvents(element, ['input', 'change', 'tct-enter']);
    await typePage(element, '5');
    expect(element.page).toBe(5);
    expect(leaked.events).toHaveLength(0);
  });
});

describe('tct-pagination: announcements', () => {
  it('does not announce on mount', async () => {
    recorder = recordAnnouncements();
    await make('page="2" total-pages="10"');
    expect(recorder.messages()).toEqual([]);
  });

  it('announces the new page with the total, politely, once per change', async () => {
    recorder = recordAnnouncements();
    const element = await make('page="2" total-pages="10"');
    await userEvent.click(step(element, 'next'));
    await settle(element);
    expect(recorder.messages()).toEqual(['Page 3 of 10']);
    await userEvent.click(
      pageButtons(element).find((button) => button.textContent.trim() === '10')!,
    );
    await settle(element);
    expect(recorder.messages()).toEqual(['Page 3 of 10', 'Page 10 of 10']);
  });

  it('announces without a total when only has-more is known', async () => {
    recorder = recordAnnouncements();
    const element = await make('page="2" has-more');
    await userEvent.click(step(element, 'next'));
    await settle(element);
    expect(recorder.messages()).toEqual(['Page 3']);
  });

  it('announces nothing when the change is prevented', async () => {
    recorder = recordAnnouncements();
    const element = await make('page="2" total-pages="10"');
    element.addEventListener('tct-page-change', (event) => event.preventDefault());
    await userEvent.click(step(element, 'next'));
    await settle(element);
    expect(recorder.messages()).toEqual([]);
  });
});

describe('tct-pagination: step', () => {
  it('next advances by step pages and previous goes back by step pages', async () => {
    const element = await make('page="3" total-pages="20" step="5"');
    await userEvent.click(step(element, 'next'));
    expect(element.page).toBe(8);
    await userEvent.click(step(element, 'previous'));
    expect(element.page).toBe(3);
  });

  it('clamps a step that would overshoot to the last page, and undershoot to the first', async () => {
    const element = await make('page="8" total-pages="10" step="5"');
    await userEvent.click(step(element, 'next'));
    expect(element.page).toBe(10);
    element.page = 3;
    await settle(element);
    await userEvent.click(step(element, 'previous'));
    expect(element.page).toBe(1);
  });

  it('falls back to one page for a step that is not a whole number of at least 1', async () => {
    for (const value of ['0', '-3', '1.5', 'x']) {
      const element = await make(`page="3" total-pages="10" step="${value}"`);
      await userEvent.click(step(element, 'next'));
      expect(element.page, `step=${value}`).toBe(4);
    }
  });

  it('names the buttons for the stride when step is above 1', async () => {
    const element = await make('page="5" total-pages="20" step="5"');
    expect(step(element, 'previous').getAttribute('label')).toBe('Go back 5 pages');
    expect(step(element, 'next').getAttribute('label')).toBe('Go forward 5 pages');
    element.step = 1;
    await settle(element);
    expect(step(element, 'next').getAttribute('label')).toBe('Go to next page');
  });

  it('steps the input variant too', async () => {
    const element = await make('variant="input" page="4" total-pages="20" step="3"');
    await userEvent.click(step(element, 'next'));
    expect(element.page).toBe(7);
  });
});

describe('tct-pagination: change action', () => {
  it('runs with the new page after the event', async () => {
    const calls: number[] = [];
    const element = await make('page="1" total-pages="10"');
    element.changeAction = (page) => {
      calls.push(page);
    };
    await userEvent.click(step(element, 'next'));
    expect(calls).toEqual([2]);
    expect(element.page).toBe(2);
  });

  it('is busy while a returned promise is pending, and the controls stay usable', async () => {
    const element = await make('page="1" total-pages="10"');
    let finish!: () => void;
    element.changeAction = () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      });
    await userEvent.click(step(element, 'next'));
    await settle(element);
    expect(nav(element)!.getAttribute('aria-busy')).toBe('true');
    expect(element.matches(':state(busy)')).toBe(true);
    expect(element.page).toBe(2);
    expect(step(element, 'next').disabled).toBe(false);
    finish();
    await waitUntil(() => nav(element)!.getAttribute('aria-busy') === null, 'busy ends');
    expect(element.matches(':state(busy)')).toBe(false);
  });

  it('is interruptible: rapid clicks each advance from the latest page', async () => {
    const element = await make('page="1" total-pages="10"');
    const calls: number[] = [];
    element.changeAction = (page) =>
      new Promise<void>((resolve) => {
        calls.push(page);
        setTimeout(resolve, 30);
      });
    await userEvent.click(step(element, 'next'));
    await userEvent.click(step(element, 'next'));
    await userEvent.click(step(element, 'next'));
    expect(calls).toEqual([2, 3, 4]);
    expect(element.page).toBe(4);
    await waitUntil(() => nav(element)!.getAttribute('aria-busy') === null, 'all actions settled');
  });

  it('restores the previous page when the action rejects', async () => {
    const element = await make('page="2" total-pages="10"');
    element.changeAction = () => Promise.reject(new Error('offline'));
    await userEvent.click(step(element, 'next'));
    await waitUntil(() => element.page === 2, 'the page is restored');
    expect(nav(element)!.getAttribute('aria-busy')).toBeNull();
  });

  it('does not run when disabled, or when the change was prevented', async () => {
    const calls: number[] = [];
    const disabled = await make('page="2" total-pages="10" disabled');
    disabled.changeAction = (page) => {
      calls.push(page);
    };
    await userEvent.click(step(disabled, 'next'), {force: true});
    const prevented = await make('page="2" total-pages="10"');
    prevented.changeAction = (page) => {
      calls.push(page);
    };
    prevented.addEventListener('tct-page-change', (event) => event.preventDefault());
    await userEvent.click(step(prevented, 'next'));
    expect(calls).toEqual([]);
  });
});

describe('tct-pagination: variant dots', () => {
  it('renders one dot per page in a labelled group, and marks the current one', async () => {
    const element = await make('variant="dots" page="3" total-pages="5"');
    expect(dots(element)).toHaveLength(5);
    const group = root(element).querySelector('.dots')!;
    expect(group.getAttribute('role')).toBe('group');
    expect(group.getAttribute('aria-label')).toBe('Page indicators');
    expect(dots(element)[0]!.getAttribute('aria-label')).toBe('Go to page 1');
    expect(currentDot(element)).toBe(3);
  });

  it('is one tab stop: the current dot is 0, the others -1', async () => {
    const element = await make('variant="dots" page="2" total-pages="4"');
    expect(dots(element).map((dot) => dot.getAttribute('tabindex'))).toEqual([
      '-1',
      '0',
      '-1',
      '-1',
    ]);
    element.page = 4;
    await settle(element);
    expect(dots(element).map((dot) => dot.getAttribute('tabindex'))).toEqual([
      '-1',
      '-1',
      '-1',
      '0',
    ]);
  });

  it('clicking a dot asks for its page', async () => {
    const element = await make('variant="dots" page="1" total-pages="5"');
    const events = recordEvents(element, 'tct-page-change');
    await userEvent.click(dots(element)[3]!);
    expect(element.page).toBe(4);
    expect(events.events).toHaveLength(1);
  });

  it('ArrowRight moves focus to the next dot and goes to that page', async () => {
    const element = await make('variant="dots" page="2" total-pages="5"');
    const events = recordEvents(element, 'tct-page-change');
    dots(element)[1]!.focus();
    await pressKeys('ArrowRight');
    await settle(element);
    expect(element.page).toBe(3);
    expect(root(element).activeElement).toBe(dots(element)[2]);
    expect(events.events).toHaveLength(1);
    expect(events.events[0]!.reason).toBe('keyboard');
  });

  it('ArrowLeft moves to the previous dot', async () => {
    const element = await make('variant="dots" page="3" total-pages="5"');
    dots(element)[2]!.focus();
    await pressKeys('ArrowLeft');
    await settle(element);
    expect(element.page).toBe(2);
    expect(root(element).activeElement).toBe(dots(element)[1]);
  });

  it('Home goes to the first page and End to the last', async () => {
    const element = await make('variant="dots" page="3" total-pages="5"');
    dots(element)[2]!.focus();
    await pressKeys('End');
    await settle(element);
    expect(element.page).toBe(5);
    await pressKeys('Home');
    await settle(element);
    expect(element.page).toBe(1);
  });

  it('wraps from the last dot to the first and back', async () => {
    const element = await make('variant="dots" page="5" total-pages="5"');
    dots(element)[4]!.focus();
    await pressKeys('ArrowRight');
    await settle(element);
    expect(element.page).toBe(1);
    await pressKeys('ArrowLeft');
    await settle(element);
    expect(element.page).toBe(5);
  });

  it('does not navigate by arrows when disabled', async () => {
    const element = await make('variant="dots" page="2" total-pages="5" disabled');
    dots(element)[1]!.focus();
    await pressKeys('ArrowRight');
    await settle(element);
    expect(element.page).toBe(2);
    for (const dot of dots(element)) expect(dot.disabled).toBe(true);
  });

  it('follows the reading direction in right-to-left', async () => {
    const wrapper = await fixture<HTMLElement>(
      '<div dir="rtl" style="padding:24px"><tct-pagination variant="dots" page="2" total-pages="5"></tct-pagination></div>',
    );
    const element = wrapper.querySelector<TctPagination>('tct-pagination')!;
    await settle(element);
    dots(element)[1]!.focus();
    await pressKeys('ArrowLeft');
    await settle(element);
    expect(element.page).toBe(3);
  });

  it('a prevented keyboard change leaves the page and lets focus stay on the dot it reached', async () => {
    const element = await make('variant="dots" page="2" total-pages="5"');
    element.addEventListener('tct-page-change', (event) => event.preventDefault());
    dots(element)[1]!.focus();
    await pressKeys('ArrowRight');
    await settle(element);
    expect(element.page).toBe(2);
  });
});

describe('tct-pagination: variant input', () => {
  it('renders "Page [ n ] / N" with an editable box', async () => {
    const element = await make('variant="input" page="3" total-pages="12"');
    expect(root(element).querySelector('.input-label')!.textContent.trim()).toBe('Page');
    expect(pageBox(element).value).toBe('3');
    expect(root(element).querySelector('.input-total')!.textContent.trim()).toBe('/ 12');
    expect(pageBox(element).getAttribute('label')).toBe('Go to page');
    expect(
      pageBox(element).shadowRoot!.querySelector('[part="label"]')?.textContent ?? '',
    ).toContain('Go to page');
  });

  it('bounds the box to the page range', async () => {
    const element = await make('variant="input" page="3" total-pages="12"');
    expect(pageBox(element).getAttribute('min')).toBe('1');
    expect(pageBox(element).max).toBe(12);
    expect(pageBox(element).hasAttribute('integer-only')).toBe(true);
  });

  it('commits a typed page on Enter and clamps an over-range entry', async () => {
    const element = await make('variant="input" page="3" total-pages="12"');
    await typePage(element, '7');
    expect(element.page).toBe(7);
    await typePage(element, '99');
    expect(element.page).toBe(12);
    expect(pageBox(element).value).toBe('12');
  });

  it('commits when focus leaves the box', async () => {
    const element = await make('variant="input" page="3" total-pages="12"');
    await typePage(element, '6', 'Tab');
    expect(element.page).toBe(6);
  });

  it('restores the current page for an empty entry', async () => {
    const element = await make('variant="input" page="3" total-pages="12"');
    const events = recordEvents(element, 'tct-page-change');
    await typePage(element, '');
    expect(element.page).toBe(3);
    expect(pageBox(element).value).toBe('3');
    expect(events.events).toHaveLength(0);
  });

  it('a below-range entry lands on page 1 rather than out of range', async () => {
    const element = await make('variant="input" page="3" total-pages="12"');
    await typePage(element, '0');
    expect(element.page).toBe(1);
  });

  it('a prevented change puts the typed number back to the current page', async () => {
    const element = await make('variant="input" page="3" total-pages="12"');
    element.addEventListener('tct-page-change', (event) => event.preventDefault());
    await typePage(element, '8');
    expect(element.page).toBe(3);
    expect(pageBox(element).value).toBe('3');
  });

  it('announces the committed page', async () => {
    recorder = recordAnnouncements();
    const element = await make('variant="input" page="3" total-pages="12"');
    await typePage(element, '9');
    expect(recorder.messages()).toEqual(['Page 9 of 12']);
  });

  it('is disabled with the paginator, and when the total is unknown', async () => {
    const disabled = await make('variant="input" page="3" total-pages="12" disabled');
    expect(pageBox(disabled).hasAttribute('disabled')).toBe(true);
    const cursor = await make('variant="input" page="3" has-more');
    expect(pageBox(cursor).hasAttribute('disabled')).toBe(true);
    expect(root(cursor).querySelector('.input-total')).toBeNull();
    expect(root(cursor).querySelector('tct-button.first, tct-button.last')).toBeNull();
  });

  it('shows a custom noun and keeps navigating by page', async () => {
    const element = await make('variant="input" page="3" total-pages="12" page-label="Row"');
    expect(root(element).querySelector('.input-label')!.textContent.trim()).toBe('Row');
    await typePage(element, '5');
    expect(element.page).toBe(5);
  });

  it('first and last buttons jump to the ends and disable at them', async () => {
    const element = await make('variant="input" page="5" total-pages="12"');
    expect(step(element, 'first').getAttribute('label')).toBe('Go to first page');
    expect(step(element, 'last').getAttribute('label')).toBe('Go to last page');
    expect(step(element, 'first').getAttribute('icon')).toBe('chevronsLeft');
    expect(step(element, 'last').getAttribute('icon')).toBe('chevronsRight');
    await userEvent.click(step(element, 'last'));
    expect(element.page).toBe(12);
    expect(step(element, 'last').disabled).toBe(true);
    await userEvent.click(step(element, 'first'));
    expect(element.page).toBe(1);
    expect(step(element, 'first').disabled).toBe(true);
  });

  it('no-first-last leaves them out, and other variants never have them', async () => {
    const without = await make('variant="input" page="5" total-pages="12" no-first-last');
    expect(root(without).querySelector('tct-button.first, tct-button.last')).toBeNull();
    const pages = await make('variant="pages" page="5" total-pages="12"');
    expect(root(pages).querySelector('tct-button.first, tct-button.last')).toBeNull();
  });
});

describe('tct-pagination: page size selector', () => {
  it('renders the selector only when options are given, labelled "Items per page"', async () => {
    const without = await make('page="1" total-pages="5"');
    expect(root(without).querySelector('tct-selector')).toBeNull();
    const element = await make('page="1" total-pages="5" page-size-options="10, 25, 50"');
    const selector = sizeSelector(element);
    expect(selector.getAttribute('label')).toBe('Items per page');
    expect(selector.hasAttribute('label-hidden')).toBe(true);
    expect(selector.value).toBe('10');
    expect(element.pageSizeOptions).toEqual([10, 25, 50]);
  });

  it('accepts the options as a property, and an empty list shows nothing', async () => {
    const element = await make('page="1" total-pages="5"');
    element.pageSizeOptions = [5, 15];
    await settle(element);
    expect(sizeSelector(element).value).toBe('10');
    element.pageSizeOptions = [];
    await settle(element);
    expect(root(element).querySelector('tct-selector')).toBeNull();
  });

  it('choosing a size fires tct-page-size-change, applies it and returns to page 1', async () => {
    const element = await make('page="3" total-items="200" page-size-options="10,25,50"');
    const events = recordEvents(element, ['tct-page-size-change', 'tct-page-change']);
    const selector = sizeSelector(element);
    selector.value = '25';
    selector.dispatchEvent(new Event('change', {bubbles: true, composed: true}));
    await settle(element);
    expect(events.events.map((event) => event.type)).toEqual([
      'tct-page-size-change',
      'tct-page-change',
    ]);
    const sizeEvent = events.events[0] as unknown as {pageSize: number; oldPageSize: number};
    expect([sizeEvent.pageSize, sizeEvent.oldPageSize]).toEqual([25, 10]);
    expect(events.events[1]!.reason).toBe('selection');
    expect(element.pageSize).toBe(25);
    expect(element.page).toBe(1);
  });

  it('asks for page 1 (and runs the change action) even when already there', async () => {
    const calls: number[] = [];
    const element = await make('page="1" total-items="200" page-size-options="10,25,50"');
    element.changeAction = (page) => {
      calls.push(page);
    };
    const events = recordEvents(element, 'tct-page-change');
    const selector = sizeSelector(element);
    selector.value = '50';
    selector.dispatchEvent(new Event('change', {bubbles: true, composed: true}));
    await settle(element);
    expect(events.events).toHaveLength(1);
    expect(calls).toEqual([1]);
  });

  it('a prevented size change keeps the size and puts the selector back', async () => {
    const element = await make('page="3" total-items="200" page-size-options="10,25,50"');
    element.addEventListener('tct-page-size-change', (event) => event.preventDefault());
    const selector = sizeSelector(element);
    selector.value = '50';
    selector.dispatchEvent(new Event('change', {bubbles: true, composed: true}));
    await settle(element);
    expect(element.pageSize).toBe(10);
    expect(selector.value).toBe('10');
    expect(element.page).toBe(3);
  });

  it('the user can choose a size with the selector itself', async () => {
    const element = await make('page="2" total-items="200" page-size-options="10,25,50"');
    const selector = sizeSelector(element);
    await openByClick(selector as unknown as SelectLike);
    expect(optionTexts(selector)).toEqual(['10', '25', '50']);
    await userEvent.click(optionsOf(selector)[1]!);
    await settle(element);
    expect(element.pageSize).toBe(25);
    expect(element.page).toBe(1);
  });
});

describe('tct-pagination: localisation', () => {
  it('renders every one of the sixteen messages in de-DE', async () => {
    recorder = recordAnnouncements();
    const messagesOf = async (
      attributes: string,
      lang: string,
    ): Promise<{element: TctPagination}> => ({element: await make(attributes, lang)});

    const {element: pages} = await messagesOf(
      'page="5" total-items="200" step="3" page-size-options="10,25"',
      'de-DE',
    );
    await waitUntil(
      () => nav(pages)!.getAttribute('aria-label') !== 'Pagination',
      'German catalog',
    );
    const german = new Map<string, string>();
    german.set('label', nav(pages)!.getAttribute('aria-label')!);
    german.set('previousBy', step(pages, 'previous').getAttribute('label')!);
    german.set('nextBy', step(pages, 'next').getAttribute('label')!);
    german.set('goToPage', inner(pageButtons(pages)[0]!).getAttribute('aria-label')!);
    german.set('itemsPerPage', sizeSelector(pages).getAttribute('label')!);

    const {element: single} = await messagesOf('page="5" total-pages="20"', 'de-DE');
    await waitUntil(
      () => step(single, 'next').getAttribute('label') !== 'Go to next page',
      'German',
    );
    german.set('previous', step(single, 'previous').getAttribute('label')!);
    german.set('next', step(single, 'next').getAttribute('label')!);

    const {element: box} = await messagesOf('variant="input" page="5" total-pages="20"', 'de-DE');
    await waitUntil(
      () => step(box, 'first').getAttribute('label') !== 'Go to first page',
      'German',
    );
    german.set('first', step(box, 'first').getAttribute('label')!);
    german.set('last', step(box, 'last').getAttribute('label')!);
    german.set('goToPageInput', pageBox(box).getAttribute('label')!);
    german.set('pageLabel', root(box).querySelector('.input-label')!.textContent.trim());
    german.set('ofTotalPages', root(box).querySelector('.input-total')!.textContent.trim());

    const {element: dotsElement} = await messagesOf(
      'variant="dots" page="2" total-pages="3"',
      'de-DE',
    );
    await waitUntil(
      () =>
        root(dotsElement).querySelector('.dots')!.getAttribute('aria-label') !== 'Page indicators',
      'German',
    );
    german.set(
      'pageIndicators',
      root(dotsElement).querySelector('.dots')!.getAttribute('aria-label')!,
    );

    const {element: count} = await messagesOf('variant="count" page="2" total-items="95"', 'de-DE');
    await waitUntil(() => !readout(count).includes(' of '), 'German count');
    german.set('count', readout(count));

    const {element: compact} = await messagesOf(
      'variant="compact" page="2" total-pages="9"',
      'de-DE',
    );
    await waitUntil(() => !readout(compact).includes(' of '), 'German compact');
    german.set('pageOfTotal', readout(compact));

    const {element: cursor} = await messagesOf('page="2" has-more', 'de-DE');
    await waitUntil(
      () => step(cursor, 'next').getAttribute('label') !== 'Go to next page',
      'German',
    );
    await userEvent.click(step(cursor, 'next'));
    await settle(cursor);
    german.set('pageAnnounce', recorder.messages().at(-1)!);

    // Every one of the sixteen ids was exercised, none fell back to English, none is a raw id.
    expect([...german.keys()].sort()).toEqual(
      [
        'count',
        'first',
        'goToPage',
        'goToPageInput',
        'itemsPerPage',
        'label',
        'last',
        'next',
        'nextBy',
        'ofTotalPages',
        'pageAnnounce',
        'pageIndicators',
        'pageLabel',
        'pageOfTotal',
        'previous',
        'previousBy',
      ].sort(),
    );
    const english: Record<string, string> = {
      label: 'Pagination',
      previous: 'Go to previous page',
      next: 'Go to next page',
      previousBy: 'Go back 3 pages',
      nextBy: 'Go forward 3 pages',
      first: 'Go to first page',
      last: 'Go to last page',
      goToPage: 'Go to page 1',
      goToPageInput: 'Go to page',
      pageLabel: 'Page',
      ofTotalPages: '/ 20',
      pageIndicators: 'Page indicators',
      itemsPerPage: 'Items per page',
      count: '11–20 of 95',
      pageOfTotal: 'Page 2 of 9',
      pageAnnounce: 'Page 3',
    };
    for (const [key, text] of german) {
      expect(text, key).not.toContain('@tct.');
      expect(text, key).not.toBe('');
      // The total after the box is a bare "/ 20" in every locale that keeps the upstream layout.
      if (key !== 'ofTotalPages') expect(text, `${key} is translated`).not.toBe(english[key]);
    }
    expect(german.get('label')).toBe('Seitennummerierung');
    expect(german.get('previousBy')).toContain('3');
    expect(german.get('goToPage')).toContain('1');
  });

  it('takes its language from the nearest lang (fr-FR)', async () => {
    const element = await make('page="2" total-pages="5"', 'fr-FR');
    await waitUntil(
      () => step(element, 'next').getAttribute('label') !== 'Go to next page',
      'French catalog',
    );
    expect(step(element, 'next').getAttribute('label')).toBe('Aller à la page suivante');
  });

  it('label and page-label override the localized defaults', async () => {
    const element = await make(
      'variant="input" page="2" total-pages="5" label="Ergebnisse" page-label="Zeile"',
      'de-DE',
    );
    expect(nav(element)!.getAttribute('aria-label')).toBe('Ergebnisse');
    expect(root(element).querySelector('.input-label')!.textContent.trim()).toBe('Zeile');
  });
});

describe('tct-pagination: right-to-left, size and forced colours', () => {
  it('keeps the previous button before the pages in the reading direction', async () => {
    const wrapper = await fixture<HTMLElement>(
      '<div dir="rtl" style="padding:24px;inline-size:800px"><tct-pagination page="3" total-pages="5"></tct-pagination></div>',
    );
    const element = wrapper.querySelector<TctPagination>('tct-pagination')!;
    await settle(element);
    const previous = step(element, 'previous').getBoundingClientRect();
    const next = step(element, 'next').getBoundingClientRect();
    expect(previous.left).toBeGreaterThan(next.left);
  });

  it('mirrors the direction glyphs in right-to-left', async () => {
    const wrapper = await fixture<HTMLElement>(
      '<div dir="rtl" style="padding:24px"><tct-pagination page="3" total-pages="5"></tct-pagination></div>',
    );
    const element = wrapper.querySelector<TctPagination>('tct-pagination')!;
    await settle(element);
    const icon = step(element, 'previous').shadowRoot!.querySelector('tct-icon')!;
    await waitUntil(() => icon.shadowRoot?.querySelector('svg') != null, 'the glyph is drawn');
    expect(getComputedStyle(icon.shadowRoot!.querySelector('svg')!).scale).toBe('-1 1');
  });

  it('size sm gives smaller controls than md', async () => {
    const md = await make('page="3" total-pages="5"');
    const sm = await make('page="3" total-pages="5" size="sm"');
    expect(step(sm, 'next').getBoundingClientRect().height).toBeLessThan(
      step(md, 'next').getBoundingClientRect().height,
    );
  });

  it('paints the current dot with a system colour under forced colours', async () => {
    const restore = await emulateMedia({forcedColors: 'active'});
    try {
      const element = await make('variant="dots" page="2" total-pages="3"');
      const paint = (dot: HTMLElement): string => getComputedStyle(dot, '::before').backgroundColor;
      const probe = document.createElement('div');
      probe.style.color = 'Highlight';
      element.append(probe);
      const highlight = getComputedStyle(probe).color;
      probe.remove();
      expect(paint(dots(element)[1]!)).toBe(highlight);
      expect(paint(dots(element)[0]!)).not.toBe(highlight);
    } finally {
      await restore();
    }
  });
});

describe('tct-pagination: accessibility', () => {
  it('passes axe in every variant', async () => {
    for (const attributes of [
      'page="3" total-pages="10"',
      'variant="count" page="2" total-items="95"',
      'variant="compact" page="2" total-pages="9"',
      'variant="dots" page="2" total-pages="6"',
      'variant="input" page="2" total-pages="9"',
      'variant="none" page="2" total-pages="9"',
      'page="3" total-pages="10" page-size-options="10,25,50" size="sm"',
      'page="3" total-pages="10" disabled',
    ]) {
      const element = await make(attributes);
      await expectAccessible(element);
    }
  });

  it('the landmark is found by role and name', async () => {
    const element = await make('page="3" total-pages="10" label="Results"');
    expect(nav(element)!.localName).toBe('nav');
    expect(deepActiveElement()).not.toBe(nav(element));
  });
});
