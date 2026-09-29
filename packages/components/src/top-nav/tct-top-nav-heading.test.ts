/**
 * tct-top-nav-heading: the logo, the text lines and their links, the interaction boundary, the logo link
 * names, and the menu disclosure (ported from the upstream TopNavHeading tests; the menu is a disclosure,
 * not an ARIA menu).
 */
import {html} from 'lit';
import {afterEach, describe, expect, it} from 'vitest';
import {page, userEvent} from 'vitest/browser';
import {containsFlat, deepActiveElement} from '@tecton-wc/core/utils/focus.js';
import {axNode, expectAccessible} from '@tecton-wc/testing/a11y.js';
import {fixture} from '@tecton-wc/testing/fixture.js';
import {pressKeys} from '@tecton-wc/testing/keyboard.js';
import {runElementSuite} from '@tecton-wc/testing/suites/element.js';
import {nextFrame, waitUntil} from '@tecton-wc/testing/timing.js';
import '../nav-icon/define.js';
import './define.js';
import type {TctTopNavHeading} from './tct-top-nav-heading.js';

afterEach(async () => {
  await userEvent.hover(document.body, {position: {x: 0, y: 0}}).catch(() => undefined);
});

runElementSuite({
  tag: 'tct-top-nav-heading',
  render: () => html`<tct-top-nav-heading heading="Acme" heading-href="#"></tct-top-nav-heading>`,
  properties: {
    heading: 'Acme',
    headingHref: '#home',
    superheading: 'Suite',
    superheadingHref: '#suite',
    subheading: 'Team',
    subheadingHref: '#team',
    logoLabel: 'Acme home',
  },
  attributes: {
    heading: 'heading',
    headingHref: 'heading-href',
    superheading: 'superheading',
    superheadingHref: 'superheading-href',
    subheading: 'subheading',
    subheadingHref: 'subheading-href',
    logoLabel: 'logo-label',
  },
});

const LOGO = `<tct-nav-icon slot="logo" id="logo"><tct-icon name="viewColumns"></tct-icon></tct-nav-icon>`;
const MENU = `<div slot="menu"><a id="one" href="#one">Switch to Beta</a><a id="two" href="#two">Switch to Gamma</a></div>`;

async function heading(attributes: string, content = '') {
  await page.viewport(1000, 700);
  const bar = await fixture<HTMLElement>(
    `<tct-top-nav><tct-top-nav-heading slot="heading" id="h" ${attributes}>${content}</tct-top-nav-heading></tct-top-nav>`,
  );
  const element = bar.querySelector<TctTopNavHeading>('#h')!;
  await element.updateComplete;
  await nextFrame();
  return {bar, element};
}

const q = (element: Element, selector: string): HTMLElement =>
  element.shadowRoot!.querySelector<HTMLElement>(selector)!;
const isOpen = (element: Element): boolean => q(element, '.menu-layer').matches(':popover-open');

describe('tct-top-nav-heading', () => {
  it('renders the heading, the lines around it and the logo', async () => {
    const {element} = await heading('heading="Product" superheading="Suite" subheading="Team"', LOGO);
    expect(q(element, '.heading').textContent).toBe('Product');
    expect(q(element, '.superheading').textContent).toBe('Suite');
    expect(q(element, '.subheading').textContent).toBe('Team');
    expect(element.shadowRoot!.querySelector<HTMLSlotElement>('slot[name="logo"]')!.assignedElements()[0]!.id).toBe(
      'logo',
    );
  });

  it('is a plain box with no links and no menu, and one link with only heading-href', async () => {
    const plain = await heading('heading="Product"');
    expect(plain.element.shadowRoot!.querySelector('a, button')).toBeNull();
    const linked = await heading('heading="Product" heading-href="#home"');
    expect(await axNode(q(linked.element, 'a.root'))).toMatchObject({role: 'link', name: 'Product'});
  });

  it('names the logo link in the independent-links configuration: by the heading, or by logo-label', async () => {
    const byHeading = await heading('heading="Product" heading-href="#p" superheading="Suite" superheading-href="#s"', LOGO);
    const logo = byHeading.element.shadowRoot!.querySelector<HTMLElement>('a.icon-link')!;
    expect((await axNode(logo)).name).toBe('Product');
    const byLabel = await heading(
      'heading="Product" heading-href="#p" superheading="Suite" superheading-href="#s" logo-label="Acme home"',
      LOGO,
    );
    expect((await axNode(byLabel.element.shadowRoot!.querySelector<HTMLElement>('a.icon-link')!)).name).toBe('Acme home');
    await expectAccessible(byLabel.bar);
  });

  it('a logo alone is a link named by logo-label, or a plain box without a destination', async () => {
    const linked = await heading('logo-label="Acme home" heading-href="#home"', LOGO);
    const link = q(linked.element, 'a.root');
    expect(await axNode(link)).toMatchObject({role: 'link', name: 'Acme home'});
    const plain = await heading('', LOGO);
    expect(plain.element.shadowRoot!.querySelector('a')).toBeNull();
  });

  it('renders the end content', async () => {
    const {element} = await heading(
      'heading="Product"',
      '<span slot="end" id="end">end</span>',
    );
    expect(element.shadowRoot!.querySelector<HTMLSlotElement>('slot[name="end"]')!.assignedElements()[0]!.id).toBe('end');
  });
});

describe('tct-top-nav-heading: the menu disclosure', () => {
  it('a chevron button named "Open menu" reports aria-expanded; there are no ARIA menu semantics', async () => {
    const {element, bar} = await heading('heading="Product"', MENU);
    const button = q(element, '.chevron-btn');
    const state = await axNode(button);
    expect(state).toMatchObject({role: 'button', name: 'Open menu', expanded: 'false'});
    expect(state.haspopup ?? 'false').toBe('false');
    expect(element.shadowRoot!.querySelector('[role="menu"], [role="dialog"]')).toBeNull();
    await expectAccessible(bar);
  });

  it('opens with Enter, enters the menu, closes with Escape and returns focus to the chevron', async () => {
    const {element, bar} = await heading('heading="Product"', MENU);
    const button = q(element, '.chevron-btn');
    button.focus();
    await pressKeys('Enter');
    await waitUntil(() => isOpen(element), 'the menu opens');
    await waitUntil(() => containsFlat(bar.querySelector('#one'), deepActiveElement()), 'focus enters the menu');
    await pressKeys('Escape');
    await waitUntil(() => !isOpen(element), 'Escape closes it');
    await waitUntil(() => deepActiveElement() === button, 'focus returns to the chevron');
  });

  it('a press on the whole heading opens the menu when there are no hrefs', async () => {
    const {element} = await heading('heading="Product"', MENU);
    await userEvent.click(q(element, '.text'));
    await waitUntil(() => isOpen(element), 'the region opens it');
  });

  it('with hrefs the links stay links and only the chevron opens the menu', async () => {
    const {element} = await heading('heading="Product" heading-href="#home"', MENU);
    expect(q(element, 'a.heading').getAttribute('href')).toBe('#home');
    expect(element.shadowRoot!.querySelector('.trigger-root')).toBeNull();
    await userEvent.click(q(element, '.chevron-btn'));
    await waitUntil(() => isOpen(element), 'the chevron opens it');
  });

  it('opens below the heading at the start edge, and mirrors in RTL', async () => {
    await page.viewport(1000, 700);
    for (const dir of ['ltr', 'rtl'] as const) {
      const bar = await fixture<HTMLElement>(
        `<tct-top-nav><tct-top-nav-heading slot="heading" id="h" heading="Product">${MENU}</tct-top-nav-heading></tct-top-nav>`,
        {dir},
      );
      const element = bar.querySelector<TctTopNavHeading>('#h')!;
      await element.updateComplete;
      await userEvent.click(q(element, '.chevron-btn'));
      await waitUntil(() => isOpen(element), 'the menu opens');
      const anchor = q(element, '.root').getBoundingClientRect();
      const panel = q(element, '.menu-layer').getBoundingClientRect();
      expect(panel.top).toBeGreaterThanOrEqual(anchor.bottom);
      // The JS fallback keeps an 8px gutter to the viewport edge.
      if (dir === 'rtl') expect(Math.abs(panel.right - anchor.right)).toBeLessThan(10);
      else expect(Math.abs(panel.left - anchor.left)).toBeLessThan(10);
    }
  });
});
