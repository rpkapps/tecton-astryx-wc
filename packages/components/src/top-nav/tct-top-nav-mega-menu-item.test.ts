/**
 * tct-top-nav-mega-menu-item and tct-top-nav-mega-menu-featured-card: the destination cards (link or
 * button, title and description, icon), and the featured card (image alt handling, link) - ported from the
 * upstream TopNavMegaMenuItem and TopNavMegaMenuFeaturedCard tests.
 */
import {html} from 'lit';
import {describe, expect, it} from 'vitest';
import {page, userEvent} from 'vitest/browser';
import {axNode, expectAccessible} from '@tecton-wc/testing/a11y.js';
import {fixture} from '@tecton-wc/testing/fixture.js';
import {runElementSuite} from '@tecton-wc/testing/suites/element.js';
import {nextFrame} from '@tecton-wc/testing/timing.js';
import './define.js';

runElementSuite({
  tag: 'tct-top-nav-mega-menu-item',
  render: () => html`<tct-top-nav-mega-menu-item heading="Analytics" href="#a"></tct-top-nav-mega-menu-item>`,
  properties: {
    heading: 'Reports',
    description: 'Dashboards',
    icon: 'funnel',
    href: '#r',
    target: '_blank',
    rel: 'nofollow',
  },
  attributes: {
    heading: 'heading',
    description: 'description',
    icon: 'icon',
    href: 'href',
    target: 'target',
    rel: 'rel',
  },
});

runElementSuite({
  tag: 'tct-top-nav-mega-menu-featured-card',
  render: () => html`<tct-top-nav-mega-menu-featured-card heading="News"></tct-top-nav-mega-menu-featured-card>`,
  properties: {
    heading: 'News',
    description: 'What is new',
    image: '/x.png',
    imageAlt: 'A team',
    linkLabel: 'Read',
    linkHref: '#news',
  },
  attributes: {
    heading: 'heading',
    description: 'description',
    image: 'image',
    imageAlt: 'image-alt',
    linkLabel: 'link-label',
    linkHref: 'link-href',
  },
});

async function mount<T extends HTMLElement>(markup: string, selector: string): Promise<T> {
  await page.viewport(1000, 700);
  const root = await fixture<HTMLElement>(`<div>${markup}</div>`);
  const element = root.querySelector<T>(selector)!;
  await (element as unknown as {updateComplete: Promise<unknown>}).updateComplete;
  await nextFrame();
  return element;
}

const entry = (element: Element): HTMLElement => element.shadowRoot!.querySelector<HTMLElement>('.entry')!;

describe('tct-top-nav-mega-menu-item', () => {
  it('renders a link with the title as its name and the description as its description', async () => {
    const element = await mount(
      '<tct-top-nav-mega-menu-item id="i" heading="Analytics" description="Track behaviour" icon="funnel" href="#a"></tct-top-nav-mega-menu-item>',
      '#i',
    );
    expect(entry(element).localName).toBe('a');
    expect(await axNode(entry(element))).toMatchObject({
      role: 'link',
      name: 'Analytics',
      description: 'Track behaviour',
    });
    expect(element.shadowRoot!.querySelector('tct-icon')!.getAttribute('name')).toBe('funnel');
  });

  it('renders a button when there is no destination, and a click reaches the host', async () => {
    const element = await mount('<tct-top-nav-mega-menu-item id="i" heading="Export"></tct-top-nav-mega-menu-item>', '#i');
    expect(entry(element).localName).toBe('button');
    expect(await axNode(entry(element))).toMatchObject({role: 'button', name: 'Export'});
    let clicks = 0;
    element.addEventListener('click', () => {
      clicks += 1;
    });
    await userEvent.click(entry(element));
    expect(clicks).toBe(1);
  });

  it('opens in a new tab with a safe rel', async () => {
    const element = await mount(
      '<tct-top-nav-mega-menu-item id="i" heading="Docs" href="https://example.com" target="_blank"></tct-top-nav-mega-menu-item>',
      '#i',
    );
    expect(entry(element).getAttribute('target')).toBe('_blank');
    expect(entry(element).getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('a javascript: destination renders no href', async () => {
    const element = await mount(
      '<tct-top-nav-mega-menu-item id="i" heading="Bad" href="javascript:alert(1)"></tct-top-nav-mega-menu-item>',
      '#i',
    );
    expect(entry(element).hasAttribute('href')).toBe(false);
  });

  it('renders a custom icon from the icon slot', async () => {
    const element = await mount(
      '<tct-top-nav-mega-menu-item id="i" heading="Docs" href="#d"><svg slot="icon" id="glyph" width="16" height="16"></svg></tct-top-nav-mega-menu-item>',
      '#i',
    );
    expect(element.shadowRoot!.querySelector<HTMLSlotElement>('slot[name="icon"]')!.assignedElements()[0]!.id).toBe('glyph');
  });

  it('is accessible', async () => {
    await mount(
      `<tct-top-nav-mega-menu-item id="i" heading="Analytics" description="Track behaviour" icon="funnel" href="#a"></tct-top-nav-mega-menu-item>
       <tct-top-nav-mega-menu-item heading="Export"></tct-top-nav-mega-menu-item>`,
      '#i',
    ).then((element) => expectAccessible(element.parentElement!));
  });
});

describe('tct-top-nav-mega-menu-featured-card', () => {
  // The embedded-resource policy refuses data: URLs, so the test image is a path.
  const IMAGE = '/x.png';

  it('renders the title, the description and the call to action link', async () => {
    const element = await mount(
      '<tct-top-nav-mega-menu-featured-card id="c" heading="What is new" description="AI features" link-label="Read more" link-href="#news"></tct-top-nav-mega-menu-featured-card>',
      '#c',
    );
    const root = element.shadowRoot!;
    expect(root.querySelector('.heading')!.textContent).toBe('What is new');
    expect(root.querySelector('.description')!.textContent).toBe('AI features');
    const link = root.querySelector<HTMLAnchorElement>('.link')!;
    expect(link.getAttribute('href')).toBe('#news');
    expect((await axNode(link)).name).toBe('Read more');
  });

  it('shows the link only with both a label and a destination', async () => {
    const element = await mount(
      '<tct-top-nav-mega-menu-featured-card id="c" heading="News" link-label="Read more"></tct-top-nav-mega-menu-featured-card>',
      '#c',
    );
    expect(element.shadowRoot!.querySelector('.link')).toBeNull();
  });

  it('marks the image decorative when there is no image-alt, and exposes it with one', async () => {
    const decorative = await mount(
      `<tct-top-nav-mega-menu-featured-card id="c" heading="News" image="${IMAGE}"></tct-top-nav-mega-menu-featured-card>`,
      '#c',
    );
    const img = decorative.shadowRoot!.querySelector('img')!;
    expect(img.getAttribute('alt')).toBe('');
    expect(img.getAttribute('role')).toBe('presentation');
    expect(img.getAttribute('aria-hidden')).toBe('true');
    const described = await mount(
      `<tct-top-nav-mega-menu-featured-card id="d" heading="News" image="${IMAGE}" image-alt="A team"></tct-top-nav-mega-menu-featured-card>`,
      '#d',
    );
    const named = described.shadowRoot!.querySelector('img')!;
    expect(named.getAttribute('alt')).toBe('A team');
    expect(named.hasAttribute('role')).toBe(false);
    expect(named.hasAttribute('aria-hidden')).toBe(false);
  });

  it('refuses an image URL the policy blocks', async () => {
    const element = await mount(
      '<tct-top-nav-mega-menu-featured-card id="c" heading="News" image="javascript:alert(1)"></tct-top-nav-mega-menu-featured-card>',
      '#c',
    );
    expect(element.shadowRoot!.querySelector('img')).toBeNull();
  });

  it('renders custom content from the default slot below the body', async () => {
    const element = await mount(
      '<tct-top-nav-mega-menu-featured-card id="c" heading="News"><p id="extra">Extra</p></tct-top-nav-mega-menu-featured-card>',
      '#c',
    );
    expect(element.shadowRoot!.querySelector<HTMLSlotElement>('slot')!.assignedElements()[0]!.id).toBe('extra');
  });

  it('points the arrow along the reading direction', async () => {
    await page.viewport(1000, 700);
    const root = await fixture<HTMLElement>(
      '<tct-top-nav-mega-menu-featured-card heading="News" link-label="Read" link-href="#n"></tct-top-nav-mega-menu-featured-card>',
      {dir: 'rtl'},
    );
    const arrow = root.shadowRoot!.querySelector('.arrow')!;
    expect(getComputedStyle(arrow).scale).toBe('-1 1');
  });

  it('is accessible', async () => {
    const element = await mount(
      `<tct-top-nav-mega-menu-featured-card id="c" heading="What is new" description="AI features" link-label="Read more" link-href="#news" image="${IMAGE}"></tct-top-nav-mega-menu-featured-card>`,
      '#c',
    );
    await expectAccessible(element.parentElement!);
  });
});
