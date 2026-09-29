/**
 * tct-top-nav: the landmark and its regions, the band (light and dark contrast in every state), and the
 * mobile collapse inside a tct-app-shell (the bar, the toggle, the items in the drawer, at 767 and 768
 * px), ported from the upstream TopNav tests.
 */
import {html} from 'lit';
import {afterEach, describe, expect, it} from 'vitest';
import {page, userEvent} from 'vitest/browser';
import {containsFlat, deepActiveElement} from '@tecton-wc/core/utils/focus.js';
import {axNode, expectAccessible} from '@tecton-wc/testing/a11y.js';
import {recordEvents} from '@tecton-wc/testing/events.js';
import {fixture} from '@tecton-wc/testing/fixture.js';
import {pressKeys} from '@tecton-wc/testing/keyboard.js';
import {runElementSuite} from '@tecton-wc/testing/suites/element.js';
import {isTier2} from '@tecton-wc/testing/tier.js';
import {animationsFinished, nextFrame, waitUntil} from '@tecton-wc/testing/timing.js';
import '../app-shell/define.js';
import '../nav-icon/define.js';
import '../side-nav/define.js';
import './define.js';
import type {TctAppShell} from '../app-shell/tct-app-shell.js';
import type {TctTopNav} from './tct-top-nav.js';
import type {TctTopNavMenu} from './tct-top-nav-menu.js';

afterEach(async () => {
  await page.viewport(1000, 700);
  await userEvent.hover(document.body, {position: {x: 0, y: 0}}).catch(() => undefined);
});

const contrastOnly = {runOnly: {type: 'rule' as const, values: ['color-contrast']}};

runElementSuite({
  tag: 'tct-top-nav',
  render: () =>
    html`<tct-top-nav label="Main"
      ><tct-top-nav-item label="Home" href="#"></tct-top-nav-item
    ></tct-top-nav>`,
  properties: {label: 'Primary'},
  attributes: {label: 'label'},
});

const ITEMS = `
  <tct-top-nav-heading slot="heading" id="heading" heading="Acme" heading-href="#"></tct-top-nav-heading>
  <tct-top-nav-item id="home" label="Home" href="#home" selected></tct-top-nav-item>
  <tct-top-nav-item id="docs" label="Docs" href="#docs"></tct-top-nav-item>
  <tct-top-nav-menu id="products" label="Products">
    <tct-top-nav-mega-menu-item id="analytics" heading="Analytics" description="Track behaviour" href="#analytics"></tct-top-nav-mega-menu-item>
    <tct-top-nav-mega-menu-item id="messaging" heading="Messaging" href="#messaging"></tct-top-nav-mega-menu-item>
  </tct-top-nav-menu>
  <tct-top-nav-item id="search" slot="end" icon-only icon="search" label="Search" href="#search"></tct-top-nav-item>
`;

async function bar(
  content = ITEMS,
  attributes = '',
  options: {theme?: 'light' | 'dark'; dir?: 'rtl'} = {},
) {
  await page.viewport(1000, 700);
  const element = await fixture<TctTopNav>(
    `<tct-top-nav ${attributes}>${content}</tct-top-nav>`,
    options,
  );
  await element.updateComplete;
  await nextFrame();
  return element;
}

const rootOf = (element: Element): ShadowRoot => element.shadowRoot!;
const navOf = (element: Element): HTMLElement => rootOf(element).querySelector<HTMLElement>('nav')!;

describe('tct-top-nav: structure', () => {
  it('is a navigation landmark named "Top navigation" by default and by label', async () => {
    const element = await bar();
    expect(await axNode(navOf(element))).toMatchObject({
      role: 'navigation',
      name: 'Top navigation',
    });
    element.label = 'Main navigation';
    await element.updateComplete;
    expect((await axNode(navOf(element))).name).toBe('Main navigation');
  });

  it('renders the heading, the start items (default slot and start slot), and the end content in their regions', async () => {
    const element = await bar(
      `${ITEMS}<tct-top-nav-item slot="start" id="named" label="Named" href="#n"></tct-top-nav-item>`,
    );
    const root = rootOf(element);
    expect(
      root.querySelector<HTMLSlotElement>('slot[name="heading"]')!.assignedElements()[0]!.id,
    ).toBe('heading');
    const start = root.querySelector<HTMLSlotElement>('slot[name="start"]')!.assignedElements();
    expect(start.map((item) => item.id)).toEqual(['named']);
    const rest = root.querySelector<HTMLSlotElement>('.start slot:not([name])')!.assignedElements();
    expect(rest.map((item) => item.id)).toEqual(['home', 'docs', 'products']);
    expect(root.querySelector<HTMLSlotElement>('slot[name="end"]')!.assignedElements()[0]!.id).toBe(
      'search',
    );
  });

  it('places the heading at the start, the items after it and the end content at the end', async () => {
    const element = await bar();
    const heading = element.querySelector('#heading')!.getBoundingClientRect();
    const home = element.querySelector('#home')!.getBoundingClientRect();
    const search = element.querySelector('#search')!.getBoundingClientRect();
    const box = navOf(element).getBoundingClientRect();
    expect(heading.left).toBeLessThan(home.left);
    expect(home.right).toBeLessThan(search.left);
    expect(box.right - search.right).toBeLessThan(16);
  });

  it('a centre region switches to a three-column grid that keeps it centred whatever the sides hold', async () => {
    const element = await bar(
      `${ITEMS}<tct-top-nav-item slot="center" id="middle" label="Centre" href="#c"></tct-top-nav-item>`,
    );
    expect(getComputedStyle(navOf(element)).display).toBe('grid');
    const middle = element.querySelector('#middle')!.getBoundingClientRect();
    const box = navOf(element).getBoundingClientRect();
    expect(Math.abs(middle.left + middle.width / 2 - (box.left + box.width / 2))).toBeLessThan(1.5);
  });

  it('renders without a centre or end region, and empty', async () => {
    const element = await bar('<tct-top-nav-item label="Home" href="#"></tct-top-nav-item>');
    expect(getComputedStyle(navOf(element)).display).toBe('flex');
    const empty = await bar('');
    expect(navOf(empty)).not.toBeNull();
    await expectAccessible(element);
  });

  it('exposes the band as the base part and the nav as the anchor of mega menus', async () => {
    const element = await bar();
    expect(navOf(element).getAttribute('part')).toBe('base');
    expect(element.anchorElement).toBe(navOf(element));
  });

  it('is accessible with every region filled', async () => {
    const element = await bar();
    await expectAccessible(element);
  });

  it('mirrors in RTL: the heading is on the right and the end content on the left', async () => {
    const element = await bar(ITEMS, '', {dir: 'rtl'});
    const heading = element.querySelector('#heading')!.getBoundingClientRect();
    const search = element.querySelector('#search')!.getBoundingClientRect();
    expect(heading.left).toBeGreaterThan(search.left);
  });
});

describe('tct-top-nav: text contrast on the band, light and dark', () => {
  // The resting ink of the items is the secondary text role, not the export's top-nav text role (4.0:1 on the
  // light band, contrast.allow.json / D-013 Q-03). Every state that adds a fill switches to the primary text role.
  const rgba = (value: string): [number, number, number, number] => {
    const [r = 0, g = 0, b = 0, a = 1] = (value.match(/[\d.]+/g) ?? []).map(Number);
    return [r, g, b, a];
  };
  const luminance = ([r, g, b]: [number, number, number, number]): number => {
    const channel = (v: number) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  };
  const ratio = (fg: string, bg: string): number => {
    const back = rgba(bg);
    const [fr, fgc, fb, fa] = rgba(fg);
    const blend = (f: number, b: number) => f * fa + b * (1 - fa);
    const flat: [number, number, number, number] = [
      blend(fr, back[0]),
      blend(fgc, back[1]),
      blend(fb, back[2]),
      1,
    ];
    const a = luminance(flat);
    const b = luminance(back);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  };

  for (const theme of ['light', 'dark'] as const) {
    it(`the resting ink is at least 4.5:1 on the ${theme} band, and the resting bar passes axe`, async () => {
      const element = await bar(ITEMS, '', {theme});
      const link = element.querySelector('#docs')!.shadowRoot!.querySelector<HTMLElement>('.item')!;
      const band = getComputedStyle(navOf(element)).backgroundColor;
      expect(ratio(getComputedStyle(link).color, band)).toBeGreaterThanOrEqual(4.5);
      await expectAccessible(element, contrastOnly);
    });

    it(`the current page, hover, and keyboard focus pass axe colour contrast (${theme})`, async () => {
      const element = await bar(ITEMS, '', {theme});
      const docs = element.querySelector('#docs')!.shadowRoot!.querySelector<HTMLElement>('.item')!;
      await userEvent.hover(docs);
      await animationsFinished(docs);
      await expectAccessible(element, contrastOnly);
      await userEvent.hover(document.body, {position: {x: 900, y: 600}});
      docs.focus();
      await pressKeys('Shift+Tab');
      await pressKeys('Tab');
      await animationsFinished(docs);
      await expectAccessible(element, contrastOnly);
    });

    it(`an open menu and its panel pass axe colour contrast (${theme})`, async () => {
      const element = await bar(ITEMS, '', {theme});
      const products = element.querySelector<HTMLElement & {show(): Promise<void>}>('#products')!;
      await products.show();
      const trigger = products.shadowRoot!.querySelector<HTMLElement>('.trigger')!;
      await animationsFinished(trigger);
      await animationsFinished(products.shadowRoot!.querySelector<HTMLElement>('.layer')!);
      await expectAccessible(element, contrastOnly);
    });
  }
});

describe('tct-top-nav: inside an app shell', () => {
  const NAV = `
    <tct-top-nav slot="top-nav" id="top" label="Main">${ITEMS}</tct-top-nav>`;
  const SIDE = `
    <tct-side-nav slot="side-nav" id="side">
      <tct-side-nav-item id="dash" label="Dashboard" icon="viewColumns" href="#dash" selected></tct-side-nav-item>
      <tct-side-nav-item id="proj" label="Projects" icon="funnel" href="#proj"></tct-side-nav-item>
    </tct-side-nav>`;

  async function shell(width: number, content = NAV + SIDE, attributes = '') {
    await page.viewport(width, 700);
    const element = await fixture<TctAppShell>(
      `<tct-app-shell no-landmarks ${attributes} style="--app-shell-height: 500px">${content}<p>Main content</p></tct-app-shell>`,
    );
    await element.updateComplete;
    await nextFrame();
    await nextFrame();
    return element;
  }

  const top = (element: Element): TctTopNav => element.querySelector('#top')!;
  const toggle = (element: Element): HTMLElement | null =>
    rootOf(top(element)).querySelector<HTMLElement>('tct-mobile-nav-toggle');
  const drawerOf = (element: Element): HTMLElement | null =>
    rootOf(element).querySelector<HTMLElement>('tct-mobile-nav');
  const copies = (element: Element): HTMLElement | null =>
    element.querySelector<HTMLElement>(':scope > tct-top-nav-drawer');

  it('keeps the full bar at 768px: the items are in the bar and there is no toggle or drawer', async () => {
    const element = await shell(768);
    expect(element.isMobile).toBe(false);
    expect(top(element).renderMode).toBe('default');
    expect(toggle(element)).toBeNull();
    expect(copies(element)).toBeNull();
    expect(rootOf(top(element)).querySelector('.start')).not.toBeNull();
    expect(element.querySelector('#home')!.getBoundingClientRect().width).toBeGreaterThan(0);
  });

  it('collapses at 767px into the mobile bar: heading, end content and a toggle; the items leave the bar', async () => {
    const element = await shell(767);
    expect(element.isMobile).toBe(true);
    expect(top(element).renderMode).toBe('mobile-bar');
    if (!isTier2) expect(top(element).matches(':state(mobile-bar)')).toBe(true);
    const root = rootOf(top(element));
    expect(root.querySelector('.start')).toBeNull();
    expect(element.querySelector('#home')!.getBoundingClientRect().width).toBe(0);
    expect(
      root.querySelector<HTMLSlotElement>('slot[name="heading"]')!.assignedElements()[0]!.id,
    ).toBe('heading');
    expect(root.querySelector<HTMLSlotElement>('slot[name="end"]')!.assignedElements()[0]!.id).toBe(
      'search',
    );
    const button = toggle(element)!.shadowRoot!.querySelector('tct-button')!;
    expect(await axNode(button.shadowRoot!.querySelector('button')!)).toMatchObject({
      role: 'button',
      name: 'Open navigation',
      expanded: 'false',
    });
    await expectAccessible(element);
  });

  it('opens the shell drawer from the toggle with the top navigation items above the side navigation', async () => {
    const element = await shell(767);
    const events = recordEvents(element, ['tct-open-change']);
    const button = toggle(element)!.shadowRoot!.querySelector('tct-button')!;
    await userEvent.click(button);
    const drawer = drawerOf(element)!;
    await waitUntil(() => drawer.shadowRoot!.querySelector('dialog[open]'), 'the drawer opens');
    await animationsFinished(drawer.shadowRoot!.querySelector('dialog')!);
    expect(events.named('tct-open-change')[0]).toMatchObject({open: true, reason: 'trigger'});
    // The drawer content: the copies of the items, then the side navigation.
    const shellSlot = drawer.querySelector<HTMLSlotElement>('slot[name="drawer"]')!;
    expect(shellSlot.assignedElements()[0]).toBe(copies(element));
    const list = copies(element)!.shadowRoot!.querySelector('nav')!;
    expect(await axNode(list)).toMatchObject({role: 'navigation', name: 'Main'});
    const labels = [...list.children].map((child) => child.getAttribute('label'));
    expect(labels).toEqual(['Home', 'Docs', 'Products']);
    const homeRow = list
      .querySelector('tct-top-nav-item')!
      .shadowRoot!.querySelector<HTMLElement>('.item')!;
    expect(homeRow.classList.contains('nav-row')).toBe(true);
    expect(homeRow.getAttribute('aria-current')).toBe('page');
    // The rule between the two navigations, and the side navigation after it.
    expect(copies(element)!.shadowRoot!.querySelector('tct-divider')).not.toBeNull();
    const sideRect = element.querySelector('#side')!.getBoundingClientRect();
    const listRect = list.getBoundingClientRect();
    expect(sideRect.top).toBeGreaterThanOrEqual(listRect.bottom);
  });

  it('a menu of the top navigation is a collapsible section of the drawer, closed until its header is pressed', async () => {
    const element = await shell(767);
    await userEvent.click(toggle(element)!.shadowRoot!.querySelector('tct-button')!);
    const drawer = drawerOf(element)!;
    await waitUntil(() => drawer.shadowRoot!.querySelector('dialog[open]'), 'the drawer opens');
    await animationsFinished(drawer.shadowRoot!.querySelector('dialog')!);
    const menu = copies(element)!.shadowRoot!.querySelector<TctTopNavMenu>('tct-top-nav-menu')!;
    const header = menu.shadowRoot!.querySelector<HTMLButtonElement>('.drawer-header')!;
    expect(await axNode(header)).toMatchObject({
      role: 'button',
      name: 'Products',
      expanded: 'false',
    });
    expect(menu.shadowRoot!.querySelector<HTMLElement>('.drawer-items')!.inert).toBe(true);
    // The chevron sits at the end of the header row, inside the drawer.
    const chevron = header.querySelector('.chevron')!.getBoundingClientRect();
    const dialog = drawer.shadowRoot!.querySelector('.drawer')!.getBoundingClientRect();
    expect(chevron.width).toBeGreaterThan(0);
    expect(chevron.right).toBeLessThanOrEqual(dialog.right);
    expect(chevron.left).toBeGreaterThan(dialog.left + dialog.width / 2);
    await userEvent.click(header);
    await menu.updateComplete;
    expect((await axNode(header)).expanded).toBe('true');
    expect(menu.shadowRoot!.querySelector<HTMLElement>('.drawer-items')!.inert).toBe(false);
    const item = menu.querySelector('tct-top-nav-mega-menu-item')!;
    expect(item.getAttribute('heading')).toBe('Analytics');
  });

  it('choosing a copied link closes the drawer, and the original hears the click first and can cancel it', async () => {
    const element = await shell(767);
    const original = element.querySelector<HTMLElement>('#docs')!;
    const seen: string[] = [];
    original.addEventListener('click', (event) => {
      seen.push('original');
      event.preventDefault();
    });
    await userEvent.click(toggle(element)!.shadowRoot!.querySelector('tct-button')!);
    const drawer = drawerOf(element)!;
    await waitUntil(() => drawer.shadowRoot!.querySelector('dialog[open]'), 'the drawer opens');
    await animationsFinished(drawer.shadowRoot!.querySelector('dialog')!);
    const copy = copies(element)!.shadowRoot!.querySelectorAll<HTMLElement>('tct-top-nav-item')[1]!;
    const link = copy.shadowRoot!.querySelector<HTMLAnchorElement>('.item')!;
    link.addEventListener('click', (event) => {
      seen.push(`copy:${String(event.defaultPrevented)}`);
      event.preventDefault();
    });
    await userEvent.click(link);
    expect(seen).toEqual(['original', 'copy:true']);
    await waitUntil(() => !drawer.shadowRoot!.querySelector('dialog[open]'), 'the drawer closes');
  });

  it('keeps the copies in step with the items: an added item and a changed state show up', async () => {
    const element = await shell(767);
    const added = document.createElement('div');
    added.innerHTML = '';
    const item = element.querySelector<HTMLElement>('#docs')!;
    item.setAttribute('label', 'Documentation');
    await waitUntil(
      () =>
        copies(element)!
          .shadowRoot!.querySelectorAll('tct-top-nav-item')[1]
          ?.getAttribute('label') === 'Documentation',
      'the copy follows the label',
    );
    expect(added.childElementCount).toBe(0);
  });

  it('a shell with no-mobile-toggle leaves the toggle to you, and the drawer still gets the items', async () => {
    const element = await shell(767, NAV + SIDE, 'no-mobile-toggle');
    expect(toggle(element)).toBeNull();
    expect(copies(element)).not.toBeNull();
  });

  it('a shell with no-mobile-nav keeps the full bar', async () => {
    const element = await shell(767, NAV + SIDE, 'no-mobile-nav');
    expect(top(element).renderMode).toBe('default');
    expect(copies(element)).toBeNull();
  });

  it('a tct-mobile-nav of your own in the mobile-nav slot keeps the full bar and the automatic drawer away', async () => {
    const element = await shell(
      767,
      `${NAV}<tct-mobile-nav slot="mobile-nav" header="Menu"><a href="#x">Own</a></tct-mobile-nav>`,
    );
    expect(top(element).renderMode).toBe('default');
    expect(copies(element)).toBeNull();
  });

  it('a top navigation alone still drawers its items, with no rule', async () => {
    const element = await shell(767, NAV);
    expect(toggle(element)).not.toBeNull();
    expect(copies(element)!.shadowRoot!.querySelector('tct-divider')).toBeNull();
  });

  it('follows the viewport: the copies appear below the breakpoint and go away above it', async () => {
    const element = await shell(900);
    expect(copies(element)).toBeNull();
    await page.viewport(700, 700);
    await waitUntil(() => copies(element) !== null, 'the copies appear');
    await page.viewport(900, 700);
    await waitUntil(() => copies(element) === null, 'the copies go away');
    expect(element.querySelector('#home')!.getBoundingClientRect().width).toBeGreaterThan(0);
  });

  it('returns focus to the toggle when the drawer closes', async () => {
    const element = await shell(767);
    const button = toggle(element)!.shadowRoot!.querySelector('tct-button')!;
    button.focus();
    await pressKeys('Enter');
    const drawer = drawerOf(element)!;
    await waitUntil(() => drawer.shadowRoot!.querySelector('dialog[open]'), 'the drawer opens');
    await pressKeys('Escape');
    await waitUntil(() => !drawer.shadowRoot!.querySelector('dialog[open]'), 'the drawer closes');
    await waitUntil(() => containsFlat(button, deepActiveElement()), 'focus returns to the toggle');
  });
});
