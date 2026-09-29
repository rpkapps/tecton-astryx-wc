/**
 * `tct-outline`: the labelled nav of anchors, the scrollspy (the right section on load, while scrolling up
 * and for a short last section), navigation with start and end events, the roving tab stop, scroll scoping
 * (`offset`, `scroll-container`), `source` (items from the document), RTL, localisation and contrast in
 * every state. Test names follow upstream `Outline.test.tsx`.
 */
import {cdp, userEvent} from 'vitest/browser';
import {afterEach, describe, expect, it} from 'vitest';
import {axNode, expectAccessible} from '@tecton-wc/testing/a11y.js';
import {emulateMedia} from '@tecton-wc/testing/emulate.js';
import {expectEventCounts, recordEvents} from '@tecton-wc/testing/events.js';
import {fixture} from '@tecton-wc/testing/fixture.js';
import {deepActiveElement, pressKeys, tabSequence} from '@tecton-wc/testing/keyboard.js';
import {runElementSuite} from '@tecton-wc/testing/suites/element.js';
import {nextFrame, waitUntil} from '@tecton-wc/testing/timing.js';
import {TctActiveChangeEvent} from '@tecton-wc/core/events/tct-active-change.js';
import {TctNavigateEndEvent} from '@tecton-wc/core/events/tct-navigate-end.js';
import {TctNavigateStartEvent} from '@tecton-wc/core/events/tct-navigate-start.js';
import './define.js';
import {collectOutlineItems} from './outline.api.js';
import type {OutlineItem} from './outline.types.js';
import type {TctOutline} from './tct-outline.js';

const ITEMS: OutlineItem[] = [
  {id: 'intro', label: 'Introduction', level: 1},
  {id: 'install', label: 'Installation', level: 2},
  {id: 'usage', label: 'Usage', level: 2},
  {id: 'api', label: 'API reference', level: 1},
  {id: 'faq', label: 'FAQ', level: 3},
];

/** Sections 400px tall, the last one short (so it can never reach the top by scrolling alone). */
const SECTIONS = ITEMS.map(
  (item, index) =>
    `<section style="height: ${index === ITEMS.length - 1 ? 120 : 400}px"><h2 id="${item.id}" style="margin: 0">${item.label}</h2></section>`,
).join('');

interface Page {
  outline: TctOutline;
  pane: HTMLElement;
}

/** An outline next to a scroll container of sections; the container is the scroll root. */
async function page(attributes = '', scrollTop = 0, extra = ''): Promise<Page> {
  const wrapper = await fixture<HTMLDivElement>(
    `<div style="display: flex; gap: 16px; width: 600px"><div id="pane" style="height: 300px; width: 300px; overflow: auto; position: relative" tabindex="0">${SECTIONS}${extra}</div>` +
      `<tct-outline id="outline" scroll-container="#pane" ${attributes}></tct-outline></div>`,
  );
  const pane = wrapper.querySelector<HTMLElement>('#pane')!;
  pane.scrollTop = scrollTop;
  const outline = wrapper.querySelector('tct-outline')!;
  outline.items = ITEMS;
  await outline.updateComplete;
  await nextFrame();
  await nextFrame();
  return {outline, pane};
}

const links = (outline: TctOutline): HTMLAnchorElement[] => [...outline.shadowRoot!.querySelectorAll<HTMLAnchorElement>('a.link')];
const activeLabel = (outline: TctOutline): string | undefined =>
  links(outline).find((link) => link.getAttribute('aria-current') === 'location')?.textContent?.trim();
const scrollHeading = (pane: HTMLElement, id: string): void => {
  pane.scrollTop = (pane.querySelector<HTMLElement>(`#${id}`)!.parentElement as HTMLElement).offsetTop;
};

afterEach(() => {
  window.scrollTo(0, 0);
  history.replaceState(null, '', location.pathname + location.search);
});

runElementSuite({
  tag: 'tct-outline',
  render: () => '<tct-outline></tct-outline>',
  properties: {density: 'compact', offset: 40, label: 'On this page', noScrollOnClick: true, activeId: 'a', source: 'main'},
  attributes: {density: 'density', offset: 'offset', label: 'label', activeId: 'active-id', source: 'source'},
  events: ['tct-active-change', 'tct-navigate-start', 'tct-navigate-end'],
});

describe('tct-outline: rendering', () => {
  it('renders a labelled nav with anchor links', async () => {
    const {outline} = await page();
    const nav = outline.shadowRoot!.querySelector('nav')!;
    expect(await axNode(nav)).toMatchObject({role: 'navigation', name: 'Table of contents'});
    expect(links(outline).map((link) => link.getAttribute('href'))).toEqual(ITEMS.map((item) => `#${item.id}`));
    expect(await axNode(links(outline)[0]!)).toMatchObject({role: 'link', name: 'Introduction'});
    expect(outline.shadowRoot!.querySelector('ul')!.getAttribute('role')).toBe('list');
  });

  it('supports a custom label and a host aria-label', async () => {
    const custom = await page('label="On this page"');
    expect(await axNode(custom.outline.shadowRoot!.querySelector('nav')!)).toMatchObject({name: 'On this page'});
    const host = await page('aria-label="Sections"');
    expect(await axNode(host.outline.shadowRoot!.querySelector('nav')!)).toMatchObject({name: 'Sections'});
  });

  it('indents by heading level and applies density', async () => {
    const {outline} = await page('density="compact"');
    const padding = (index: number): number => parseFloat(getComputedStyle(links(outline)[index]!).paddingInlineStart);
    // Levels 1 and 2 share the first step; level 3 indents one step further.
    expect(padding(0)).toBe(padding(1));
    expect(padding(3)).toBe(padding(0));
    expect(padding(4)).toBeGreaterThan(padding(1));
    const compact = parseFloat(getComputedStyle(links(outline)[0]!).paddingBlockStart);
    const regular = parseFloat(getComputedStyle((await page()).outline.shadowRoot!.querySelector('a.link')!).paddingBlockStart);
    expect(compact).toBeLessThan(regular);
  });

  it('renders the sliding indicator on the active item, measured from the link', async () => {
    const {outline} = await page();
    const indicator = outline.shadowRoot!.querySelector<HTMLElement>('.indicator')!;
    expect(indicator.getAttribute('aria-hidden')).toBe('true');
    const link = links(outline)[0]!;
    await waitUntil(() => indicator.style.getPropertyValue('--_indicator-height') === `${link.offsetHeight}px`, 'indicator sized');
    expect(indicator.style.getPropertyValue('--_indicator-top')).toBe(`${link.offsetTop}px`);
  });

  it('renders no links for no items', async () => {
    const wrapper = await fixture<HTMLDivElement>('<div><tct-outline></tct-outline></div>');
    const outline = wrapper.querySelector('tct-outline')!;
    await outline.updateComplete;
    expect(links(outline)).toHaveLength(0);
  });
});

describe('tct-outline: scrollspy', () => {
  it('marks the first item active at the top', async () => {
    const {outline} = await page();
    expect(activeLabel(outline)).toBe('Introduction');
  });

  it('highlights the right section on load, when the page opens scrolled down', async () => {
    const {outline} = await page('', 800);
    await waitUntil(() => activeLabel(outline) === 'Usage', 'the section at the scroll position');
  });

  it('follows the scroll position down and back up', async () => {
    const {outline, pane} = await page();
    const seen: string[] = [];
    for (const id of ['install', 'usage', 'api']) {
      scrollHeading(pane, id);
      await waitUntil(() => activeLabel(outline) === ITEMS.find((item) => item.id === id)!.label, `active ${id}`);
      seen.push(activeLabel(outline)!);
    }
    // Scrolling UP: the previous sections take the highlight back (the earlier project got this wrong).
    for (const id of ['usage', 'install', 'intro']) {
      scrollHeading(pane, id);
      await waitUntil(() => activeLabel(outline) === ITEMS.find((item) => item.id === id)!.label, `active ${id} scrolling up`);
      seen.push(activeLabel(outline)!);
    }
    expect(seen).toEqual(['Installation', 'Usage', 'API reference', 'Usage', 'Installation', 'Introduction']);
  });

  it('keeps the section whose heading is above the line active while its body is on screen', async () => {
    const {outline, pane} = await page();
    scrollHeading(pane, 'usage');
    pane.scrollTop += 150;
    await waitUntil(() => activeLabel(outline) === 'Usage', 'usage stays active in its body');
  });

  it('activates the last item at the bottom, even though its heading never reaches the top', async () => {
    const {outline, pane} = await page();
    pane.scrollTop = pane.scrollHeight;
    await waitUntil(() => activeLabel(outline) === 'FAQ', 'last item at the bottom');
    pane.scrollTop = pane.scrollHeight - pane.clientHeight - 200;
    await waitUntil(() => activeLabel(outline) !== 'FAQ', 'leaves the last item above the bottom');
  });

  it('exposes aria-current="location" on exactly the active link', async () => {
    const {outline, pane} = await page();
    scrollHeading(pane, 'api');
    await waitUntil(() => activeLabel(outline) === 'API reference', 'api active');
    const current = links(outline).filter((link) => link.hasAttribute('aria-current'));
    expect(current).toHaveLength(1);
    expect(current[0]!.getAttribute('aria-current')).toBe('location');
    expect(outline.matches(':state(active)')).toBe(true);
  });

  it('notifies tct-active-change when the scroll position changes the active item, not on property writes', async () => {
    const {outline, pane} = await page();
    const events = recordEvents(outline, 'tct-active-change');
    scrollHeading(pane, 'usage');
    await waitUntil(() => events.events.length > 0 && activeLabel(outline) === 'Usage', 'reported');
    const last = events.events.at(-1) as unknown as TctActiveChangeEvent;
    expect(last).toMatchObject({id: 'usage', reason: 'scroll'});
    expect(last.bubbles && last.composed).toBe(true);
    const before = events.events.length;
    outline.activeId = 'faq';
    await outline.updateComplete;
    expect(events.events.length).toBe(before);
  });

  it('activates a heading exactly where navigating to it lands it: offset and scroll-margin-top compose', async () => {
    const {outline, pane} = await page('offset="40"');
    // The heading sits 30px below the pane top: above the line (40px) it is not yet passed, below it is.
    pane.scrollTop = pane.querySelector<HTMLElement>('#install')!.parentElement!.offsetTop - 30;
    await waitUntil(() => activeLabel(outline) === 'Introduction', 'not yet passed');
    pane.scrollTop += 20;
    await waitUntil(() => activeLabel(outline) === 'Installation', 'passed the offset line');
  });

  it('tracks a custom scroll container given as an element property', async () => {
    const wrapper = await fixture<HTMLDivElement>(
      `<div><div id="pane" style="height: 200px; overflow: auto">${SECTIONS}</div><tct-outline></tct-outline></div>`,
    );
    const outline = wrapper.querySelector('tct-outline')!;
    const pane = wrapper.querySelector<HTMLElement>('#pane')!;
    outline.items = ITEMS;
    outline.scrollContainer = pane;
    await outline.updateComplete;
    scrollHeading(pane, 'usage');
    await waitUntil(() => activeLabel(outline) === 'Usage', 'tracked the property container');
  });

  it('tracks the viewport when nothing scrolls inside', async () => {
    const wrapper = await fixture<HTMLDivElement>(`<div><tct-outline></tct-outline><div>${SECTIONS.replaceAll('400px', '900px')}</div></div>`);
    const outline = wrapper.querySelector('tct-outline')!;
    outline.items = ITEMS;
    await outline.updateComplete;
    document.getElementById('usage')!.scrollIntoView();
    await waitUntil(() => activeLabel(outline) === 'Usage', 'viewport scrolled to usage');
  });

  it('with active-id set, scroll tracking is off and the id is the state', async () => {
    const {outline, pane} = await page('active-id="api"');
    expect(activeLabel(outline)).toBe('API reference');
    scrollHeading(pane, 'usage');
    await nextFrame();
    await nextFrame();
    expect(activeLabel(outline)).toBe('API reference');
    outline.activeId = 'faq';
    await outline.updateComplete;
    expect(activeLabel(outline)).toBe('FAQ');
  });
});

describe('tct-outline: navigating', () => {
  it('smooth-scrolls on click, fires start then end once, and lands the active item when the scroll settles', async () => {
    const {outline, pane} = await page();
    const events = recordEvents(outline, ['tct-navigate-start', 'tct-navigate-end', 'tct-active-change']);
    await userEvent.click(links(outline)[2]!);
    await waitUntil(() => events.named('tct-navigate-end').length === 1, 'navigation ended', 4000);
    expect(events.named('tct-navigate-start')).toHaveLength(1);
    expect(events.named('tct-navigate-start')[0]).toMatchObject({id: 'usage'});
    expect(events.named('tct-navigate-end')[0]).toMatchObject({id: 'usage'});
    expect(events.events.map((event) => event.type)[0]).toBe('tct-navigate-start');
    expect(activeLabel(outline)).toBe('Usage');
    expect(Math.abs(pane.scrollTop - pane.querySelector<HTMLElement>('#usage')!.parentElement!.offsetTop)).toBeLessThanOrEqual(2);
    expect(location.hash).toBe('#usage');
    await nextFrame();
    expectEventCounts(events, {'tct-navigate-start': 1, 'tct-navigate-end': 1, 'tct-active-change': events.named('tct-active-change').length});
  });

  it('does not chase the scroll: the indicator stays until the navigation lands', async () => {
    const {outline} = await page();
    const seen = new Set<string>();
    const stop = recordEvents(outline, 'tct-active-change');
    await userEvent.click(links(outline)[3]!);
    await waitUntil(() => activeLabel(outline) === 'API reference', 'landed', 4000);
    // Intermediate sections (Installation, Usage) were never active on the way.
    for (const event of stop.events) seen.add((event as unknown as TctActiveChangeEvent).id);
    expect([...seen]).toEqual(['api']);
  });

  it('reports the chosen id when controlled, and the consumer owns the state', async () => {
    const {outline} = await page('active-id="intro"');
    const events = recordEvents(outline, ['tct-active-change', 'tct-navigate-start', 'tct-navigate-end']);
    await userEvent.click(links(outline)[1]!);
    await waitUntil(() => events.named('tct-navigate-end').length === 1, 'ended', 4000);
    expect(events.named('tct-active-change')[0]).toMatchObject({id: 'install', reason: 'click'});
    expect(events.named('tct-navigate-start')).toHaveLength(1);
    expect(activeLabel(outline)).toBe('Introduction');
  });

  it('a second click supersedes the first: still one end per start', async () => {
    const {outline} = await page();
    const events = recordEvents(outline, ['tct-navigate-start', 'tct-navigate-end']);
    await userEvent.click(links(outline)[4]!);
    await userEvent.click(links(outline)[1]!);
    await waitUntil(() => activeLabel(outline) === 'Installation', 'second target', 4000);
    expect(events.named('tct-navigate-start')).toHaveLength(2);
    await waitUntil(() => events.named('tct-navigate-end').length === 2, 'both ended', 4000);
    expect(events.named('tct-navigate-end').map((event) => (event as unknown as TctNavigateEndEvent).id).sort()).toEqual(['faq', 'install']);
  });

  it('a manual scroll mid-flight ends the navigation exactly once', async () => {
    const {outline, pane} = await page();
    const events = recordEvents(outline, ['tct-navigate-start', 'tct-navigate-end']);
    await userEvent.click(links(outline)[3]!);
    pane.dispatchEvent(new WheelEvent('wheel', {deltaY: 10, bubbles: true}));
    await waitUntil(() => events.named('tct-navigate-end').length === 1, 'ended by the user', 4000);
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(events.named('tct-navigate-end')).toHaveLength(1);
  });

  it('no-scroll-on-click skips the scroll but still navigates: events, active item and hash', async () => {
    const {outline, pane} = await page('no-scroll-on-click');
    const events = recordEvents(outline, ['tct-navigate-start', 'tct-navigate-end']);
    await userEvent.click(links(outline)[2]!);
    expect(events.named('tct-navigate-start')).toHaveLength(1);
    expect(events.named('tct-navigate-end')).toHaveLength(1);
    expect(pane.scrollTop).toBe(0);
    expect(activeLabel(outline)).toBe('Usage');
    expect(location.hash).toBe('#usage');
  });

  it('lands the heading below a fixed header (offset) instead of underneath it', async () => {
    const {outline, pane} = await page('offset="48"');
    const done = recordEvents(outline, 'tct-navigate-end');
    await userEvent.click(links(outline)[2]!);
    await waitUntil(() => done.events.length === 1, 'landed', 4000);
    const gap = pane.querySelector<HTMLElement>('#usage')!.getBoundingClientRect().top - pane.getBoundingClientRect().top;
    expect(Math.round(gap)).toBe(48);
  });

  it('leaves modifier clicks to the browser', async () => {
    const {outline} = await page();
    const events = recordEvents(outline, 'tct-navigate-start');
    const event = new MouseEvent('click', {bubbles: true, cancelable: true, composed: true, metaKey: true});
    links(outline)[1]!.dispatchEvent(event);
    expect(events.events).toHaveLength(0);
    expect(event.defaultPrevented).toBe(false);
  });

  it('leaves a missing target to the browser instead of deadening the link', async () => {
    const wrapper = await fixture<HTMLDivElement>('<div><tct-outline></tct-outline></div>');
    const outline = wrapper.querySelector('tct-outline')!;
    outline.items = [{id: 'nowhere', label: 'Nowhere', level: 1}];
    await outline.updateComplete;
    const events = recordEvents(outline, 'tct-navigate-start');
    const event = new MouseEvent('click', {bubbles: true, cancelable: true, composed: true});
    links(outline)[0]!.dispatchEvent(event);
    expect(events.events).toHaveLength(0);
    expect(event.defaultPrevented).toBe(false);
  });

  it('jumps instantly under reduced motion and still settles', async () => {
    await emulateMedia({reducedMotion: 'reduce'});
    const {outline, pane} = await page();
    const done = recordEvents(outline, 'tct-navigate-end');
    await userEvent.click(links(outline)[2]!);
    await waitUntil(() => done.events.length === 1, 'settled', 4000);
    expect(pane.scrollTop).toBeGreaterThan(700);
  });
});

describe('tct-outline: keyboard (one roving tab stop)', () => {
  it('exposes a single tab stop, seated on the active heading', async () => {
    const {outline} = await page('', 800);
    await waitUntil(() => activeLabel(outline) === 'Usage', 'usage active');
    await waitUntil(() => links(outline)[2]!.getAttribute('tabindex') === '0', 'tab stop on the active link');
    expect(links(outline).map((link) => link.getAttribute('tabindex'))).toEqual(['-1', '-1', '0', '-1', '-1']);
  });

  it('moves the tab stop as the active heading changes', async () => {
    const {outline, pane} = await page();
    scrollHeading(pane, 'api');
    await waitUntil(() => links(outline)[3]!.getAttribute('tabindex') === '0', 'stop moved with the active heading');
  });

  it('does not yank the tab stop away from the item the user arrowed to', async () => {
    const {outline, pane} = await page();
    links(outline)[0]!.focus();
    await pressKeys('ArrowDown', 'ArrowDown');
    expect(deepActiveElement()).toBe(links(outline)[2]);
    scrollHeading(pane, 'api');
    await waitUntil(() => activeLabel(outline) === 'API reference', 'active moved');
    expect(links(outline)[2]!.getAttribute('tabindex')).toBe('0');
  });

  it('moves focus with ArrowDown and ArrowUp, and jumps with Home and End', async () => {
    const {outline} = await page();
    links(outline)[0]!.focus();
    await pressKeys('ArrowDown');
    expect(deepActiveElement()).toBe(links(outline)[1]);
    await pressKeys('ArrowUp');
    expect(deepActiveElement()).toBe(links(outline)[0]);
    await pressKeys('End');
    expect(deepActiveElement()).toBe(links(outline)[4]);
    await pressKeys('Home');
    expect(deepActiveElement()).toBe(links(outline)[0]);
  });

  it('activates the focused link with Space and with Enter', async () => {
    const {outline} = await page();
    const events = recordEvents(outline, 'tct-navigate-start');
    links(outline)[0]!.focus();
    await pressKeys('ArrowDown', ' ');
    expect(events.events).toHaveLength(1);
    expect(events.events[0]).toMatchObject({id: 'install'});
    await pressKeys('ArrowDown', 'Enter');
    expect(events.events).toHaveLength(2);
    expect(events.events[1]).toMatchObject({id: 'usage'});
  });

  it('leaves modifier chords to the browser (Ctrl + Space is not activation)', async () => {
    const {outline} = await page();
    const events = recordEvents(outline, 'tct-navigate-start');
    links(outline)[0]!.focus();
    await pressKeys('Control+ ');
    expect(events.events).toHaveLength(0);
  });

  it('does not treat its own Space activation as a manual scroll', async () => {
    const {outline} = await page();
    const events = recordEvents(outline, ['tct-navigate-start', 'tct-navigate-end']);
    links(outline)[2]!.focus();
    await pressKeys(' ');
    await waitUntil(() => events.named('tct-navigate-end').length === 1, 'landed', 4000);
    expect(activeLabel(outline)).toBe('Usage');
  });

  it('does not steal Tab from the page: the list is one stop between two buttons', async () => {
    const wrapper = await fixture<HTMLDivElement>(
      '<div><button id="before">before</button><tct-outline></tct-outline><button id="after">after</button></div>',
    );
    const outline = wrapper.querySelector('tct-outline')!;
    outline.items = ITEMS;
    await outline.updateComplete;
    await nextFrame();
    const sequence = await tabSequence(outline, {start: document.getElementById('before')!});
    expect(sequence.map((el) => el.id || 'link')).toEqual(['link', 'after']);
  });

  it('keeps a single tab stop with one item', async () => {
    const wrapper = await fixture<HTMLDivElement>('<div><tct-outline></tct-outline></div>');
    const outline = wrapper.querySelector('tct-outline')!;
    outline.items = [{id: 'only', label: 'Only', level: 1}];
    await outline.updateComplete;
    await nextFrame();
    expect(links(outline).map((link) => link.getAttribute('tabindex'))).toEqual(['0']);
  });
});

describe('tct-outline: items from the document (source)', () => {
  it('collectOutlineItems reads headings with an id, in order, skipping the rest', async () => {
    const wrapper = await fixture<HTMLDivElement>(
      '<article><h1 id="t">Title</h1><h2>No id</h2><h2 id="empty"> </h2><h3 id="deep">Deep <em>one</em></h3></article>',
    );
    expect(collectOutlineItems(wrapper)).toEqual([
      {id: 't', label: 'Title', level: 1},
      {id: 'deep', label: 'Deep one', level: 3},
    ]);
  });

  it('builds items from the container the selector names and follows its changes', async () => {
    const wrapper = await fixture<HTMLDivElement>(
      '<div><tct-outline source="#doc"></tct-outline><article id="doc"><h2 id="one">One</h2><h2 id="two">Two</h2></article></div>',
    );
    const outline = wrapper.querySelector('tct-outline')!;
    await waitUntil(() => links(outline).length === 2, 'two items');
    expect(links(outline).map((link) => link.textContent!.trim())).toEqual(['One', 'Two']);
    const heading = document.createElement('h2');
    heading.id = 'three';
    heading.textContent = 'Three';
    wrapper.querySelector('#doc')!.append(heading);
    await waitUntil(() => links(outline).length === 3, 'three items after a heading was added');
    wrapper.querySelector('#one')!.textContent = 'Uno';
    await waitUntil(() => links(outline)[0]!.textContent!.trim() === 'Uno', 'retitled');
  });
});

describe('tct-outline: localisation and RTL', () => {
  it('names the landmark from the nearest lang (de-DE)', async () => {
    const wrapper = await fixture<HTMLDivElement>('<div lang="de-DE"><tct-outline></tct-outline></div>');
    const outline = wrapper.querySelector('tct-outline')!;
    await waitUntil(() => outline.shadowRoot!.querySelector('nav')?.getAttribute('aria-label') === 'Inhaltsverzeichnis', 'German label', 4000);
  });

  it('names the landmark in Arabic and puts the track on the right (ar-SA)', async () => {
    const wrapper = await fixture<HTMLDivElement>('<div lang="ar-SA" dir="rtl"><tct-outline></tct-outline></div>');
    const outline = wrapper.querySelector('tct-outline')!;
    outline.items = ITEMS;
    await waitUntil(() => outline.shadowRoot!.querySelector('nav')?.getAttribute('aria-label') === 'جدول المحتويات', 'Arabic label', 4000);
    await nextFrame();
    const track = outline.shadowRoot!.querySelector('.track')!.getBoundingClientRect();
    const link = links(outline)[0]!.getBoundingClientRect();
    expect(track.left).toBeGreaterThan(link.left);
  });
});

describe('tct-outline: accessibility', () => {
  it('has no axe violations', async () => {
    const {outline} = await page();
    await expectAccessible(outline.parentElement!);
  });
});

const contrastOnly = {runOnly: {type: 'rule' as const, values: ['color-contrast']}};
async function settled(): Promise<void> {
  await nextFrame();
  await Promise.allSettled(document.getAnimations().map((animation) => animation.finished));
}

describe('tct-outline: text contrast in every state', () => {
  for (const theme of ['light', 'dark'] as const) {
    const mount = async (): Promise<Page & {wrapper: HTMLElement}> => {
      const wrapper = await fixture<HTMLElement>(
        `<div style="background: var(--color-background-body); padding: 16px; width: 480px"><button>before</button><tct-outline density="compact"></tct-outline></div>`,
        {theme},
      );
      const outline = wrapper.querySelector('tct-outline')!;
      outline.items = ITEMS;
      outline.activeId = 'usage';
      await outline.updateComplete;
      await nextFrame();
      return {wrapper, outline, pane: wrapper};
    };

    it(`rest and active (${theme})`, async () => {
      const {wrapper} = await mount();
      await settled();
      await expectAccessible(wrapper, contrastOnly);
    });

    it(`hover over an inactive and over the active item (${theme})`, async () => {
      const {wrapper, outline} = await mount();
      await userEvent.hover(links(outline)[0]!);
      await settled();
      await expectAccessible(wrapper, contrastOnly);
      await userEvent.hover(links(outline)[2]!);
      await settled();
      await expectAccessible(wrapper, contrastOnly);
    });

    it(`keyboard focus on an inactive and on the active item (${theme})`, async () => {
      const {wrapper, outline} = await mount();
      wrapper.querySelector('button')!.focus();
      await pressKeys('Tab');
      await settled();
      await expectAccessible(wrapper, contrastOnly);
      await pressKeys('ArrowUp');
      await settled();
      await expectAccessible(wrapper, contrastOnly);
      expect(links(outline).includes(deepActiveElement() as HTMLAnchorElement)).toBe(true);
    });

    it(`pressed item (${theme})`, async () => {
      const {wrapper, outline} = await mount();
      const box = links(outline)[3]!.getBoundingClientRect();
      const point = {x: box.left + box.width / 2, y: box.top + box.height / 2};
      const session = cdp();
      await session.send('Input.dispatchMouseEvent', {type: 'mouseMoved', ...point});
      await session.send('Input.dispatchMouseEvent', {type: 'mousePressed', ...point, button: 'left', clickCount: 1});
      await settled();
      try {
        await expectAccessible(wrapper, contrastOnly);
      } finally {
        await session.send('Input.dispatchMouseEvent', {type: 'mouseReleased', ...point, button: 'left', clickCount: 1});
      }
    });
  }
});

describe('the outline events', () => {
  it('are notifications that bubble and compose', () => {
    for (const event of [new TctActiveChangeEvent('a', 'scroll'), new TctNavigateStartEvent('a'), new TctNavigateEndEvent('a')]) {
      expect([event.bubbles, event.composed, event.cancelable]).toEqual([true, true, false]);
    }
    expect(new TctActiveChangeEvent('a', 'click')).toMatchObject({type: 'tct-active-change', id: 'a', reason: 'click'});
  });
});
