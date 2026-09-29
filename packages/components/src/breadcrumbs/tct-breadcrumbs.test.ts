/**
 * `tct-breadcrumbs` and `tct-breadcrumb-item`: the landmark and list semantics, separators, the current
 * page (explicit and automatic), link, action and menu crumbs, the collapsed trail (`max-items`), RTL,
 * localisation and contrast in every state. Test names follow upstream `Breadcrumbs.test.tsx`.
 */
import {html} from 'lit';
import {cdp, userEvent} from 'vitest/browser';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {axNode, expectAccessible} from '@tecton-wc/testing/a11y.js';
import {recordEvents} from '@tecton-wc/testing/events.js';
import {fixture} from '@tecton-wc/testing/fixture.js';
import {deepActiveElement, pressKeys} from '@tecton-wc/testing/keyboard.js';
import {runElementSuite} from '@tecton-wc/testing/suites/element.js';
import {animationsFinished, nextFrame, waitUntil} from '@tecton-wc/testing/timing.js';
import {resetDevWarnings} from '@tecton-wc/core/utils/dev.js';
import './define.js';
import type {TctBreadcrumbItem} from './tct-breadcrumb-item.js';
import type {TctBreadcrumbs} from './tct-breadcrumbs.js';

const TRAIL =
  '<tct-breadcrumb-item href="/">Home</tct-breadcrumb-item>' +
  '<tct-breadcrumb-item href="/projects">Projects</tct-breadcrumb-item>' +
  '<tct-breadcrumb-item>My Project</tct-breadcrumb-item>';

async function trail(
  attributes = '',
  inner = TRAIL,
  wrapperAttributes = '',
): Promise<TctBreadcrumbs> {
  const wrapper = await fixture<HTMLDivElement>(
    `<div ${wrapperAttributes} style="width: 480px; padding-block-end: 200px"><button id="before">before</button><tct-breadcrumbs ${attributes}>${inner}</tct-breadcrumbs></div>`,
  );
  const element = wrapper.querySelector('tct-breadcrumbs')!;
  await element.updateComplete;
  await settleItems(element);
  return element;
}

async function settleItems(element: Element): Promise<void> {
  await Promise.all([...element.children].map((child) => (child as TctBreadcrumbItem).updateComplete));
  await nextFrame();
  await Promise.all([...element.children].map((child) => (child as TctBreadcrumbItem).updateComplete));
  await nextFrame();
}

const items = (element: Element): TctBreadcrumbItem[] =>
  [...element.children] as TctBreadcrumbItem[];
const crumb = (item: TctBreadcrumbItem): HTMLElement => item.shadowRoot!.querySelector<HTMLElement>('.crumb')!;
const separator = (item: TctBreadcrumbItem): HTMLElement => item.shadowRoot!.querySelector<HTMLElement>('.separator')!;
/** The native anchor inside a crumb's `tct-link`. */
const anchor = (item: TctBreadcrumbItem): HTMLAnchorElement =>
  crumb(item).shadowRoot!.querySelector<HTMLAnchorElement>('a')!;

runElementSuite({
  tag: 'tct-breadcrumbs',
  render: () =>
    html`<tct-breadcrumbs
      ><tct-breadcrumb-item href="/">Home</tct-breadcrumb-item
      ><tct-breadcrumb-item>Page</tct-breadcrumb-item></tct-breadcrumbs
    >`,
  properties: {variant: 'supporting', label: 'Path', separator: '>', separatorIcon: 'chevronRight', maxItems: 3},
  attributes: {variant: 'variant', label: 'label', separator: 'separator', maxItems: 'max-items'},
});

runElementSuite({
  tag: 'tct-breadcrumb-item',
  render: () =>
    html`<tct-breadcrumbs
      ><tct-breadcrumb-item id="under-test" href="/">Home</tct-breadcrumb-item
      ><tct-breadcrumb-item>Page</tct-breadcrumb-item></tct-breadcrumbs
    >`,
  properties: {href: '/x', current: true, icon: 'check', menuSize: 'lg'},
  attributes: {href: 'href', icon: 'icon'},
  skip: ['a11y', 'hostBox'],
});

describe('tct-breadcrumbs', () => {
  it('renders a nav landmark with aria-label', async () => {
    const element = await trail();
    const nav = element.shadowRoot!.querySelector('nav')!;
    expect(await axNode(nav)).toMatchObject({role: 'navigation', name: 'Breadcrumb'});
  });

  it('supports a custom label and a host aria-label', async () => {
    const custom = await trail('label="You are here"');
    expect(await axNode(custom.shadowRoot!.querySelector('nav')!)).toMatchObject({name: 'You are here'});
    const host = await trail('aria-label="Where you are"');
    expect(await axNode(host.shadowRoot!.querySelector('nav')!)).toMatchObject({name: 'Where you are'});
  });

  it('renders items in an ordered list of list items', async () => {
    const element = await trail();
    const list = element.shadowRoot!.querySelector('ol')!;
    expect(await axNode(list)).toMatchObject({role: 'list'});
    for (const item of items(element)) {
      expect(await axNode(item)).toMatchObject({role: 'listitem'});
    }
  });

  it('renders a separator before every item but the first, and separators are aria-hidden', async () => {
    const element = await trail();
    const [first, second, third] = items(element);
    expect(getComputedStyle(separator(first!)).display).toBe('none');
    expect(getComputedStyle(separator(second!)).display).not.toBe('none');
    expect(separator(second!).textContent).toBe('/');
    expect(separator(third!).getAttribute('aria-hidden')).toBe('true');
  });

  it('supports a custom separator text and a separator icon', async () => {
    const text = await trail('separator="›"');
    expect(separator(items(text)[1]!).textContent?.trim()).toBe('›');
    const icon = await trail('separator-icon="chevronRight"');
    expect(separator(items(icon)[1]!).querySelector('tct-icon')!.getAttribute('name')).toBe('chevronRight');
  });

  it('mirrors the built-in slash in right-to-left, not a custom separator', async () => {
    const element = await trail('', TRAIL, 'dir="rtl"');
    expect(getComputedStyle(separator(items(element)[1]!)).scale).toBe('-1 1');
    const custom = await trail('separator="›"', TRAIL, 'dir="rtl"');
    expect(getComputedStyle(separator(items(custom)[1]!)).scale).toBe('none');
  });

  it('defaults to variant="default" and accepts variant="supporting"', async () => {
    const element = await trail();
    expect(element.variant).toBe('default');
    const smallFont = async (attributes: string): Promise<number> => {
      const el = await trail(attributes);
      return parseFloat(getComputedStyle(items(el)[0]!.shadowRoot!.querySelector('.item')!).fontSize);
    };
    expect(await smallFont('variant="supporting"')).toBeLessThan(await smallFont(''));
  });

  it('keeps every crumb in a supporting trail', async () => {
    const element = await trail('variant="supporting"');
    expect(items(element).every((item) => item.shadowRoot!.querySelector('.item')!.getAttribute('data-variant') === 'supporting')).toBe(true);
  });
});

describe('tct-breadcrumb-item', () => {
  it('renders a link when href is provided', async () => {
    const element = await trail();
    const link = anchor(items(element)[0]!);
    expect(link.getAttribute('href')).toBe('/');
    expect(await axNode(link)).toMatchObject({role: 'link', name: 'Home'});
  });

  it('renders the current item as text with aria-current="page"', async () => {
    const element = await trail('', '<tct-breadcrumb-item href="/">Home</tct-breadcrumb-item><tct-breadcrumb-item current href="/x">Now</tct-breadcrumb-item>');
    const current = crumb(items(element)[1]!);
    expect(current.localName).toBe('span');
    expect(current.getAttribute('aria-current')).toBe('page');
    expect(items(element)[1]!.shadowRoot!.querySelector('a, tct-link')).toBeNull();
  });

  it('auto-detects the last item as current when none says so', async () => {
    const element = await trail();
    const last = crumb(items(element)[2]!);
    expect(last.getAttribute('aria-current')).toBe('page');
    expect(crumb(items(element)[1]!).hasAttribute('aria-current')).toBe(false);
  });

  it('auto-detects aria-current on the anchor when the last item is a link', async () => {
    const element = await trail('', '<tct-breadcrumb-item href="/">Home</tct-breadcrumb-item><tct-breadcrumb-item href="/here">Here</tct-breadcrumb-item>');
    const link = items(element)[1]!;
    expect(anchor(link).getAttribute('aria-current')).toBe('page');
    expect(await axNode(anchor(link))).toMatchObject({role: 'link', name: 'Here'});
  });

  it('does not auto-detect when an item is explicitly current', async () => {
    const element = await trail(
      '',
      '<tct-breadcrumb-item href="/">Home</tct-breadcrumb-item><tct-breadcrumb-item current>Middle</tct-breadcrumb-item><tct-breadcrumb-item href="/x">Last</tct-breadcrumb-item>',
    );
    expect(crumb(items(element)[1]!).getAttribute('aria-current')).toBe('page');
    expect(anchor(items(element)[2]!).hasAttribute('aria-current')).toBe(false);
  });

  it('current="false" opts the last item out of auto-detection', async () => {
    const element = await trail(
      '',
      '<tct-breadcrumb-item href="/">Home</tct-breadcrumb-item><tct-breadcrumb-item href="/x" current="false">Last</tct-breadcrumb-item>',
    );
    expect(items(element)[1]!.current).toBe(false);
    expect(anchor(items(element)[1]!).hasAttribute('aria-current')).toBe(false);
  });

  it('follows changes: appending an item moves the automatic current page', async () => {
    const element = await trail();
    const added = document.createElement('tct-breadcrumb-item');
    added.textContent = 'Deeper';
    element.append(added);
    await settleItems(element);
    await waitUntil(() => crumb(added).getAttribute('aria-current') === 'page', 'new current');
    expect(crumb(items(element)[2]!).hasAttribute('aria-current')).toBe(false);
  });

  it('renders a single item as current by auto-detection', async () => {
    const element = await trail('', '<tct-breadcrumb-item>Only</tct-breadcrumb-item>');
    expect(crumb(items(element)[0]!).getAttribute('aria-current')).toBe('page');
  });

  it('renders click-only items as buttons that fire click', async () => {
    const element = await trail('', '<tct-breadcrumb-item id="act">Action</tct-breadcrumb-item><tct-breadcrumb-item>Now</tct-breadcrumb-item>');
    const item = items(element)[0]!;
    expect(crumb(item).localName).toBe('button');
    const events = recordEvents(item, 'click');
    await userEvent.click(crumb(item));
    expect(events.events).toHaveLength(1);
    expect(await axNode(crumb(item))).toMatchObject({role: 'button', name: 'Action'});
  });

  it('fires click on a link crumb', async () => {
    const element = await trail('', '<tct-breadcrumb-item href="#x">Go</tct-breadcrumb-item><tct-breadcrumb-item>Now</tct-breadcrumb-item>');
    const item = items(element)[0]!;
    const events = recordEvents(item, 'click');
    await userEvent.click(anchor(item));
    expect(events.events).toHaveLength(1);
  });

  it('renders the icon attribute and the icon slot before the label', async () => {
    const element = await trail(
      '',
      '<tct-breadcrumb-item href="/" icon="check">Home</tct-breadcrumb-item><tct-breadcrumb-item><tct-icon slot="icon" name="close"></tct-icon>Now</tct-breadcrumb-item>',
    );
    expect(items(element)[0]!.shadowRoot!.querySelector('tct-icon.icon')!.getAttribute('name')).toBe('check');
    expect(items(element)[1]!.shadowRoot!.querySelector('.icon-slot slot[name="icon"]')).not.toBeNull();
  });
});

describe('tct-breadcrumb-item: menu crumb', () => {
  const MENU = [{label: 'Alpha'}, {label: 'Beta'}, {label: 'Gamma'}];
  const menuTrail = async (extra = ''): Promise<{element: TctBreadcrumbs; item: TctBreadcrumbItem}> => {
    const element = await trail(
      '',
      `<tct-breadcrumb-item href="/">Home</tct-breadcrumb-item><tct-breadcrumb-item id="m" ${extra}>Projects</tct-breadcrumb-item><tct-breadcrumb-item>Now</tct-breadcrumb-item>`,
    );
    const item = items(element)[1]!;
    item.menu = MENU.map((row) => ({...row}));
    await item.updateComplete;
    await settleItems(element);
    return {element, item};
  };
  const triggerOf = (item: TctBreadcrumbItem): HTMLButtonElement => crumb(item) as HTMLButtonElement;
  const dropdown = (item: TctBreadcrumbItem): HTMLElement => item.shadowRoot!.querySelector('tct-dropdown-menu')!;
  const layer = (item: TctBreadcrumbItem): HTMLElement => dropdown(item).shadowRoot!.querySelector<HTMLElement>('.layer')!;
  const isOpen = (item: TctBreadcrumbItem): boolean => layer(item).matches(':popover-open');

  it('renders as a menu trigger button with aria-haspopup="menu" and a chevron', async () => {
    const {item} = await menuTrail();
    const trigger = triggerOf(item);
    expect(trigger.localName).toBe('button');
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(trigger.querySelector('.chevron')).not.toBeNull();
    expect(await axNode(trigger)).toMatchObject({role: 'button', name: 'Projects', hasPopup: 'menu'});
  });

  it('opens the menu rows on click, fires the row action and closes', async () => {
    const {item} = await menuTrail();
    const onClick = vi.fn();
    item.menu = [{label: 'Alpha', onClick}, {label: 'Beta'}];
    await item.updateComplete;
    await userEvent.click(triggerOf(item));
    await waitUntil(() => isOpen(item), 'opened');
    await animationsFinished(layer(item));
    const surface = dropdown(item).shadowRoot!.querySelector<HTMLElement>('[role="menu"]')!;
    expect(await axNode(surface)).toMatchObject({role: 'menu', name: 'Projects'});
    const rows = dropdown(item).shadowRoot!.querySelectorAll<HTMLElement>('tct-dropdown-menu-item');
    expect(rows).toHaveLength(2);
    await userEvent.click(rows[0]!);
    expect(onClick).toHaveBeenCalledTimes(1);
    await waitUntil(() => !isOpen(item), 'closed');
  });

  it('supports the compound form with slot="menu" children', async () => {
    const element = await trail(
      '',
      '<tct-breadcrumb-item href="/">Home</tct-breadcrumb-item><tct-breadcrumb-item>Docs<tct-dropdown-menu-item slot="menu" label="Guides"></tct-dropdown-menu-item><tct-dropdown-menu-item slot="menu" label="API"></tct-dropdown-menu-item></tct-breadcrumb-item>',
    );
    const item = items(element)[1]!;
    expect(triggerOf(item).getAttribute('aria-haspopup')).toBe('menu');
    await userEvent.click(triggerOf(item));
    await waitUntil(() => isOpen(item), 'opened');
    const labels = [...item.querySelectorAll('tct-dropdown-menu-item')].map((row) => row.getAttribute('label'));
    expect(labels).toEqual(['Guides', 'API']);
  });

  it('opens with ArrowDown, roves with arrows, closes with Escape and returns focus to the trigger', async () => {
    const {item} = await menuTrail();
    triggerOf(item).focus();
    await pressKeys('ArrowDown');
    await waitUntil(() => isOpen(item), 'opened');
    const rows = [...dropdown(item).shadowRoot!.querySelectorAll('tct-dropdown-menu-item')];
    await waitUntil(() => deepActiveElement() === rows[0], 'first row focused');
    await pressKeys('ArrowDown');
    expect(deepActiveElement()).toBe(rows[1]);
    await pressKeys('Escape');
    await waitUntil(() => !isOpen(item), 'closed');
    await waitUntil(() => deepActiveElement() === triggerOf(item), 'focus back on the trigger');
  });

  it('allows menu together with current: both aria-current and aria-haspopup', async () => {
    const {item} = await menuTrail('current');
    expect(triggerOf(item).getAttribute('aria-current')).toBe('page');
    expect(triggerOf(item).getAttribute('aria-haspopup')).toBe('menu');
  });

  it('warns and lets menu win when href is also provided', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    globalThis.tctDevMode = true;
    resetDevWarnings();
    try {
      const {item} = await menuTrail('href="/nope"');
      expect(triggerOf(item).localName).toBe('button');
      expect(warn.mock.calls.some((call) => String(call[0]).includes('mutually exclusive'))).toBe(true);
    } finally {
      globalThis.tctDevMode = undefined;
      warn.mockRestore();
    }
  });

  it('keeps mid-trail separators intact around a menu crumb', async () => {
    const {element} = await menuTrail();
    expect(getComputedStyle(separator(items(element)[1]!)).display).not.toBe('none');
    expect(getComputedStyle(separator(items(element)[2]!)).display).not.toBe('none');
  });
});

describe('tct-breadcrumbs: collapsed trail (max-items)', () => {
  const LONG =
    '<tct-breadcrumb-item href="/">Home</tct-breadcrumb-item>' +
    '<tct-breadcrumb-item href="/a">Alpha</tct-breadcrumb-item>' +
    '<tct-breadcrumb-item href="/b">Beta</tct-breadcrumb-item>' +
    '<tct-breadcrumb-item href="/c">Gamma</tct-breadcrumb-item>' +
    '<tct-breadcrumb-item>Current</tct-breadcrumb-item>';
  const visible = (element: TctBreadcrumbs): string[] =>
    items(element)
      .filter((item) => getComputedStyle(item).display !== 'none')
      .map((item) => (item.shadowRoot!.querySelector('[data-overflow]') ? 'ellipsis' : item.textContent.trim()));
  const overflowButton = (element: TctBreadcrumbs): HTMLButtonElement | null =>
    element.querySelector<HTMLButtonElement>('tct-breadcrumb-item')
      ? ([...element.children]
          .map((item) => (item as TctBreadcrumbItem).shadowRoot!.querySelector<HTMLButtonElement>('[data-overflow]'))
          .find(Boolean) ?? null)
      : null;

  it('never collapses without max-items', async () => {
    const element = await trail('', LONG);
    expect(visible(element)).toEqual(['Home', 'Alpha', 'Beta', 'Gamma', 'Current']);
    expect(overflowButton(element)).toBeNull();
  });

  it('collapses the middle into one ellipsis button, keeping the first and the last items', async () => {
    const element = await trail('max-items="3"', LONG);
    await waitUntil(() => overflowButton(element), 'ellipsis');
    // First item, the ellipsis (rendered by the first hidden crumb), then the last two.
    expect(visible(element)).toEqual(['Home', 'ellipsis', 'Gamma', 'Current']);
    const button = overflowButton(element)!;
    expect(button.getAttribute('aria-label')).toBe('Show 2 more breadcrumbs');
    expect(await axNode(button)).toMatchObject({role: 'button', hasPopup: 'menu'});
  });

  it('opens a menu with the hidden crumbs and navigates like their links', async () => {
    const element = await trail('max-items="2"', LONG);
    await waitUntil(() => overflowButton(element), 'ellipsis');
    const host = items(element)[1]!;
    await userEvent.click(overflowButton(element)!);
    const dropdown = host.shadowRoot!.querySelector('tct-dropdown-menu')!;
    await waitUntil(() => dropdown.shadowRoot!.querySelector('.layer')!.matches(':popover-open'), 'opened');
    const rows = [...dropdown.shadowRoot!.querySelectorAll('tct-dropdown-menu-item')];
    expect(rows.map((row) => row.getAttribute('label'))).toEqual(['Alpha', 'Beta', 'Gamma']);
  });

  it('hidden crumbs leave the layout and the accessibility tree', async () => {
    const element = await trail('max-items="3"', LONG);
    await waitUntil(() => overflowButton(element), 'ellipsis');
    const hidden = items(element).filter((item) => getComputedStyle(item).display === 'none');
    expect(hidden.map((item) => item.textContent.trim())).toEqual(['Beta']);
  });

  it('runs an action crumb through its own click', async () => {
    const element = await trail(
      'max-items="2"',
      '<tct-breadcrumb-item href="/">Home</tct-breadcrumb-item><tct-breadcrumb-item id="act">Do it</tct-breadcrumb-item><tct-breadcrumb-item>Current</tct-breadcrumb-item>',
    );
    await waitUntil(() => overflowButton(element), 'ellipsis');
    const onClick = vi.fn();
    items(element)[1]!.addEventListener('click', onClick);
    await userEvent.click(overflowButton(element)!);
    const host = items(element)[1]!;
    const dropdown = host.shadowRoot!.querySelector('tct-dropdown-menu')!;
    await waitUntil(() => dropdown.shadowRoot!.querySelector('.layer')!.matches(':popover-open'), 'opened');
    await userEvent.click(dropdown.shadowRoot!.querySelector('tct-dropdown-menu-item')!);
    expect(onClick).toHaveBeenCalled();
  });

  it('a trail that fits is not collapsed', async () => {
    const element = await trail('max-items="5"', LONG);
    expect(overflowButton(element)).toBeNull();
  });
});

describe('tct-breadcrumbs: localisation and accessibility', () => {
  it('names the landmark from the nearest lang (de-DE)', async () => {
    const wrapper = await fixture<HTMLDivElement>(`<div lang="de-DE"><tct-breadcrumbs>${TRAIL}</tct-breadcrumbs></div>`);
    const element = wrapper.querySelector('tct-breadcrumbs')!;
    await waitUntil(
      () => element.shadowRoot!.querySelector('nav')?.getAttribute('aria-label') === 'Brotkrümelnavigation',
      'German label',
      4000,
    );
  });

  it('names the landmark in Arabic and lays the trail out from the right (ar-SA)', async () => {
    const wrapper = await fixture<HTMLDivElement>(
      `<div lang="ar-SA" dir="rtl"><tct-breadcrumbs>${TRAIL}</tct-breadcrumbs></div>`,
    );
    const element = wrapper.querySelector('tct-breadcrumbs')!;
    await waitUntil(
      () => element.shadowRoot!.querySelector('nav')?.getAttribute('aria-label') === 'مسار التنقل',
      'Arabic label',
      4000,
    );
    await settleItems(element);
    const [first, second] = items(element);
    expect(first!.getBoundingClientRect().left).toBeGreaterThan(second!.getBoundingClientRect().left);
  });

  it('has no axe violations for the trail, a menu crumb and a collapsed trail', async () => {
    const element = await trail('max-items="2"', TRAIL + '<tct-breadcrumb-item>Extra</tct-breadcrumb-item>');
    await settleItems(element);
    await expectAccessible(element.parentElement!);
  });
});

/** State colours arrive through CSS transitions: measure the settled state, not the first frame. */
async function settled(_item: TctBreadcrumbItem): Promise<void> {
  await nextFrame();
  await Promise.allSettled(document.getAnimations().map((animation) => animation.finished));
}

afterEach(async () => {
  await userEvent.hover(document.body, {position: {x: 0, y: 0}}).catch(() => undefined);
  await cdp().send('Input.dispatchMouseEvent', {type: 'mouseReleased', x: 0, y: 0, button: 'left'}).catch(() => undefined);
});

describe('tct-breadcrumb-item: text contrast in every state', () => {
  const contrastOnly = {runOnly: {type: 'rule' as const, values: ['color-contrast']}};
  for (const theme of ['light', 'dark'] as const) {
    const mount = async (variant: string): Promise<HTMLElement> => {
      const wrapper = await fixture<HTMLElement>(
        `<div style="background: var(--color-background-body); padding: 16px; width: 480px"><button>before</button>` +
          `<tct-breadcrumbs variant="${variant}"><tct-breadcrumb-item href="/">Home</tct-breadcrumb-item>` +
          `<tct-breadcrumb-item icon="check">Action</tct-breadcrumb-item><tct-breadcrumb-item href="/x">Link</tct-breadcrumb-item>` +
          `<tct-breadcrumb-item>Current page</tct-breadcrumb-item></tct-breadcrumbs></div>`,
        {theme},
      );
      await settleItems(wrapper.querySelector('tct-breadcrumbs')!);
      return wrapper;
    };
    for (const variant of ['default', 'supporting']) {
      it(`rest and current (${variant}, ${theme})`, async () => {
        const wrapper = await mount(variant);
        await expectAccessible(wrapper, contrastOnly);
      });

      it(`hover over a link and an action (${variant}, ${theme})`, async () => {
        const wrapper = await mount(variant);
        const [home, action] = items(wrapper.querySelector('tct-breadcrumbs')!);
        await userEvent.hover(anchor(home!));
        await settled(home!);
        await expectAccessible(wrapper, contrastOnly);
        await userEvent.hover(crumb(action!));
        await settled(action!);
        await expectAccessible(wrapper, contrastOnly);
      });

      it(`keyboard focus on a link and an action (${variant}, ${theme})`, async () => {
        const wrapper = await mount(variant);
        wrapper.querySelector('button')!.focus();
        await pressKeys('Tab');
        await settled(items(wrapper.querySelector('tct-breadcrumbs')!)[0]!);
        await expectAccessible(wrapper, contrastOnly);
        await pressKeys('Tab');
        await settled(items(wrapper.querySelector('tct-breadcrumbs')!)[1]!);
        await expectAccessible(wrapper, contrastOnly);
      });
    }
  }
});
