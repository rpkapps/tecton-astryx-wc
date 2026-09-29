/**
 * tct-side-nav-heading: the text lines and their links, the interaction boundary (one link, independent
 * links, the whole heading as the menu trigger, links plus a chevron trigger), the menu disclosure
 * (aria-expanded, focus, Escape, hover and the click guard), the collapsed rail and the trailing content
 * (ported from the upstream SideNavHeading tests; the menu is a disclosure, not an ARIA menu).
 */
import {html} from 'lit';
import {afterEach, describe, expect, it} from 'vitest';
import {page, userEvent} from 'vitest/browser';
import {containsFlat, deepActiveElement} from '@tecton-wc/core/utils/focus.js';
import {axNode, expectAccessible} from '@tecton-wc/testing/a11y.js';
import {fixture} from '@tecton-wc/testing/fixture.js';
import {pressKeys} from '@tecton-wc/testing/keyboard.js';
import {runElementSuite} from '@tecton-wc/testing/suites/element.js';
import {animationsFinished, nextFrame, waitUntil} from '@tecton-wc/testing/timing.js';
import '../nav-icon/define.js';
import './define.js';

afterEach(async () => {
  await userEvent.hover(document.body, {position: {x: 0, y: 0}}).catch(() => undefined);
});

runElementSuite({
  tag: 'tct-side-nav-heading',
  render: () => html`<tct-side-nav-heading heading="Acme" heading-href="#"></tct-side-nav-heading>`,
  properties: {
    heading: 'Acme',
    headingHref: '#home',
    superheading: 'Suite',
    superheadingHref: '#suite',
    subheading: 'Account',
    subheadingHref: '#account',
  },
  attributes: {
    heading: 'heading',
    headingHref: 'heading-href',
    superheading: 'superheading',
    superheadingHref: 'superheading-href',
    subheading: 'subheading',
    subheadingHref: 'subheading-href',
  },
});

const MENU = `<div slot="menu" id="menu"><a id="one" href="#one">Switch to Beta</a><a id="two" href="#two">Switch to Gamma</a></div>`;
const ICON = `<tct-nav-icon slot="icon" id="icon"><tct-icon name="viewColumns"></tct-icon></tct-nav-icon>`;

async function heading(attributes: string, content = '', options: {collapsed?: boolean; dir?: 'rtl'} = {}) {
  await page.viewport(1000, 700);
  const nav = options.collapsed ? 'collapsible collapsed' : '';
  const wrapper = await fixture<HTMLElement>(
    `<div style="block-size: 500px"><tct-side-nav ${nav}><tct-side-nav-heading slot="header" id="h" ${attributes}>${content}</tct-side-nav-heading><tct-side-nav-item label="Home" icon="funnel" href="#"></tct-side-nav-item></tct-side-nav></div>`,
    options.dir ? {dir: options.dir} : {},
  );
  const element = wrapper.querySelector('tct-side-nav-heading')!;
  await element.updateComplete;
  await nextFrame();
  return {wrapper, element, nav: wrapper.querySelector('tct-side-nav')!};
}

const root = (element: Element): ShadowRoot => element.shadowRoot!;
const q = (element: Element, selector: string): HTMLElement =>
  root(element).querySelector<HTMLElement>(selector)!;
const layer = (element: Element): HTMLElement => q(element, '.menu-layer');
const isOpen = (element: Element): boolean => layer(element).matches(':popover-open');

describe('tct-side-nav-heading: text and links', () => {
  it('renders the heading, the superheading and the subheading', async () => {
    const {element} = await heading('heading="Product" superheading="Suite" subheading="Account"', ICON);
    expect(q(element, '.heading').textContent).toBe('Product');
    expect(q(element, '.superheading').textContent).toBe('Suite');
    expect(q(element, '.subheading').textContent).toBe('Account');
    expect(root(element).querySelector<HTMLSlotElement>('slot[name="icon"]')!.assignedElements()[0]!.id).toBe('icon');
  });

  it('is one link when only heading-href is set', async () => {
    const {element} = await heading('heading="Product" heading-href="#home"');
    const link = q(element, 'a.root');
    expect(link.getAttribute('href')).toBe('#home');
    expect(await axNode(link)).toMatchObject({role: 'link', name: 'Product'});
  });

  it('is a plain box with no links and no menu', async () => {
    const {element} = await heading('heading="Product"');
    expect(root(element).querySelector('a, button')).toBeNull();
  });

  it('several hrefs make independent links, and the icon links to the heading destination', async () => {
    const {element} = await heading(
      'heading="Product" heading-href="#p" superheading="Suite" superheading-href="#s" subheading="Team" subheading-href="#t"',
      ICON,
    );
    const links = [...root(element).querySelectorAll('a')];
    expect(links.map((link) => link.getAttribute('href'))).toEqual(['#p', '#s', '#p', '#t'].sort((a, b) => 0 * a.length - 0 * b.length));
    expect(root(element).querySelector('a.root')).toBeNull();
    const names = await Promise.all(links.map(async (link) => (await axNode(link)).name));
    expect(names).toEqual(expect.arrayContaining(['Product', 'Suite', 'Team']));
    expect(names.every((name) => name !== '')).toBe(true);
    await expectAccessible(element);
  });

  it('renders the end content and no chevron without a menu', async () => {
    const {element} = await heading(
      'heading="Product"',
      '<tct-button slot="end" id="end" variant="ghost" icon-only icon="close" label="End"></tct-button>',
    );
    expect(root(element).querySelector<HTMLSlotElement>('slot[name="end"]')!.assignedElements()[0]!.id).toBe('end');
    expect(root(element).querySelector('.chevron-btn')).toBeNull();
  });
});

describe('tct-side-nav-heading: the menu disclosure', () => {
  it('shows a chevron button named "Open menu" that reports aria-expanded, and no ARIA menu semantics', async () => {
    const {element} = await heading('heading="Product"', MENU);
    const button = q(element, '.chevron-btn');
    const state = await axNode(button);
    expect(state).toMatchObject({role: 'button', name: 'Open menu', expanded: 'false'});
    expect(state.haspopup ?? 'false').toBe('false');
    expect(root(element).querySelector('[role="menu"], [role="dialog"]')).toBeNull();
    await expectAccessible(element);
  });

  it('opens from the chevron button with Enter, moves focus into the menu, and Escape returns it', async () => {
    const {element, wrapper} = await heading('heading="Product"', MENU);
    const button = q(element, '.chevron-btn');
    button.focus();
    await pressKeys('Enter');
    await waitUntil(() => isOpen(element), 'the menu opens');
    expect((await axNode(button)).expanded).toBe('true');
    await waitUntil(
      () => containsFlat(wrapper.querySelector('#one'), deepActiveElement()),
      'focus moves to the first link',
    );
    await pressKeys('Escape');
    await waitUntil(() => !isOpen(element), 'Escape closes it');
    await waitUntil(() => deepActiveElement() === button, 'focus returns to the chevron');
  });

  it('a click on the whole heading (no hrefs) opens the menu, and a click on the chevron does not toggle twice', async () => {
    const {element} = await heading('heading="Product"', MENU);
    await userEvent.click(q(element, '.text'));
    await waitUntil(() => isOpen(element), 'the region opens it');
    await animationsFinished(layer(element));
    await userEvent.click(q(element, '.chevron-btn'));
    await waitUntil(() => !isOpen(element), 'the chevron closes it once');
  });

  it('keeps the links independent and the chevron as the trigger when the heading has hrefs and a menu', async () => {
    const {element} = await heading('heading="Product" heading-href="#home" subheading="Team" subheading-href="#team"', MENU);
    expect(root(element).querySelector('.trigger-root')).toBeNull();
    const button = q(element, '.chevron-btn');
    // A press on a link is the link's: it navigates and never toggles the menu (hover may still open it).
    const link = q(element, 'a.heading');
    let navigated = 0;
    link.addEventListener('click', (event) => {
      navigated += 1;
      event.preventDefault();
    });
    await userEvent.hover(document.body, {position: {x: 900, y: 650}});
    await userEvent.click(link);
    expect(navigated).toBe(1);
    await userEvent.hover(document.body, {position: {x: 900, y: 650}});
    await waitUntil(() => !isOpen(element), 'leaving closes a hover-open');
    await userEvent.click(button);
    await waitUntil(() => isOpen(element), 'the chevron opens it');
  });

  it('closes when a link in the menu is chosen', async () => {
    const {element, wrapper} = await heading('heading="Product"', MENU);
    await userEvent.click(q(element, '.chevron-btn'));
    await waitUntil(() => isOpen(element), 'the menu opens');
    const link = wrapper.querySelector<HTMLElement>('#one')!;
    link.addEventListener('click', (event) => {
      event.preventDefault();
    });
    await userEvent.click(link);
    await waitUntil(() => !isOpen(element), 'choosing closes it');
  });

  it('closes on an outside press', async () => {
    const {element} = await heading('heading="Product"', MENU);
    await userEvent.click(q(element, '.chevron-btn'));
    await waitUntil(() => isOpen(element), 'the menu opens');
    await userEvent.click(document.body, {position: {x: 900, y: 600}});
    await waitUntil(() => !isOpen(element), 'an outside press closes it');
  });

  it('opens on hover, leaves focus alone, and closes when the pointer leaves', async () => {
    const {element} = await heading('heading="Product"', MENU);
    const before = deepActiveElement();
    await userEvent.hover(q(element, '.root'));
    await waitUntil(() => isOpen(element), 'hover opens it');
    expect(containsFlat(layer(element), deepActiveElement())).toBe(false);
    expect(deepActiveElement()).toBe(before);
    await userEvent.hover(document.body, {position: {x: 900, y: 650}});
    await waitUntil(() => !isOpen(element), 'leaving closes a hover-open');
  });

  it('a click right after a hover-open keeps it open (pins it); a later click closes it', async () => {
    const {element} = await heading('heading="Product"', MENU);
    const region = q(element, '.root');
    await userEvent.hover(region);
    await waitUntil(() => isOpen(element), 'hover opens it');
    await userEvent.click(q(element, '.chevron-btn'));
    await nextFrame();
    expect(isOpen(element)).toBe(true);
    // Pinned: leaving does not close it any more.
    await userEvent.hover(document.body, {position: {x: 900, y: 650}});
    await nextFrame();
    expect(isOpen(element)).toBe(true);
    await userEvent.click(q(element, '.chevron-btn'));
    await waitUntil(() => !isOpen(element), 'the next click closes it');
  });

  it('opens below the heading, on the start edge, and mirrors in RTL', async () => {
    const ltr = await heading('heading="Product"', MENU);
    await userEvent.click(q(ltr.element, '.chevron-btn'));
    await waitUntil(() => isOpen(ltr.element), 'the menu opens');
    await animationsFinished(layer(ltr.element));
    const anchor = q(ltr.element, '.root').getBoundingClientRect();
    const panel = layer(ltr.element).getBoundingClientRect();
    expect(panel.top).toBeGreaterThanOrEqual(anchor.bottom);
    expect(Math.abs(panel.left - anchor.left)).toBeLessThan(2);
  });

  it('opens on the start edge in RTL', async () => {
    const rtl = await heading('heading="Product"', MENU, {dir: 'rtl'});
    await userEvent.click(q(rtl.element, '.chevron-btn'));
    await waitUntil(() => isOpen(rtl.element), 'the menu opens');
    await animationsFinished(layer(rtl.element));
    const anchor = q(rtl.element, '.root').getBoundingClientRect();
    const panel = layer(rtl.element).getBoundingClientRect();
    expect(Math.abs(panel.right - anchor.right)).toBeLessThan(2);
  });
});

describe('tct-side-nav-heading: the collapsed rail', () => {
  it('is hidden without an icon', async () => {
    const {element} = await heading('heading="Product"', '', {collapsed: true});
    expect(root(element).querySelector('.rail-row')).toBeNull();
    expect(element.getBoundingClientRect().height).toBe(0);
  });

  it('is the icon alone, named by the heading, with the heading in a tooltip', async () => {
    const {element} = await heading('heading="Product" subheading="Team"', ICON, {collapsed: true});
    expect(q(element, '.text, .heading, .subheading') ?? null).toBeNull();
    const control = q(element, '.rail-row');
    expect(control.localName).toBe('div');
    await userEvent.hover(control);
    // A plain icon has no name of its own; the tooltip still shows the heading.
    const surface = q(element, '.tooltip-surface');
    await waitUntil(() => surface.matches(':popover-open'), 'the tooltip opens');
    expect(surface.textContent?.trim()).toBe('Product');
  });

  it('is a link named by the heading when it has a destination', async () => {
    const {element} = await heading('heading="Product" heading-href="#home"', ICON, {collapsed: true});
    const link = q(element, 'a.rail-row');
    expect(await axNode(link)).toMatchObject({role: 'link', name: 'Product'});
    await expectAccessible(element);
  });

  it('is a menu trigger button when it has a menu, and hides the end content', async () => {
    const {element, wrapper} = await heading(
      'heading="Product"',
      `${ICON}${MENU}<span slot="end" id="end">end</span>`,
      {collapsed: true},
    );
    const trigger = q(element, 'button.rail-row');
    expect(await axNode(trigger)).toMatchObject({role: 'button', name: 'Product', expanded: 'false'});
    expect(root(element).querySelector('slot[name="end"]')).toBeNull();
    await userEvent.click(trigger);
    await waitUntil(() => isOpen(element), 'the menu opens');
    expect(wrapper.querySelector('#one')).not.toBeNull();
  });
});
