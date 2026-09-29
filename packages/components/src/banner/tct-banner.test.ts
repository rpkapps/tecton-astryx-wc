/**
 * tct-banner: status roles and icons, heading and description, the collapsible content model, dismiss
 * with focus hand-off, dismiss naming and localisation, containers, elevation, wrapping, contrast on the
 * filled statuses, RTL and forced colours. Names follow upstream Banner.test.tsx.
 */
import {html} from 'lit';
import {userEvent} from 'vitest/browser';
import {describe, expect, it, vi} from 'vitest';
import {loadLocale} from '@tecton-astryx/core/i18n/registry.js';
import {axNode, expectAccessible} from '@tecton-astryx/testing/a11y.js';
import {emulateMedia} from '@tecton-astryx/testing/emulate.js';
import {expectEventCounts, expectEventFlags, recordEvents} from '@tecton-astryx/testing/events.js';
import {fixture} from '@tecton-astryx/testing/fixture.js';
import {pressKeys} from '@tecton-astryx/testing/keyboard.js';
import {runElementSuite} from '@tecton-astryx/testing/suites/element.js';
import {isChromium} from '@tecton-astryx/testing/tier.js';
import {aTimeout, nextFrame} from '@tecton-astryx/testing/timing.js';
import type {TctButton} from '../button/tct-button.js';
import {BANNER_STATUSES} from './banner.types.js';
import '../link/define.js';
import './define.js';
import type {TctBanner} from './tct-banner.js';

const shadow = <T extends Element = HTMLElement>(banner: TctBanner, selector: string): T | null =>
  banner.shadowRoot!.querySelector<T>(selector);
const control = (button: TctButton): HTMLElement =>
  button.shadowRoot!.querySelector<HTMLElement>('.button')!;
const buttons = (banner: TctBanner): TctButton[] => [
  ...banner.shadowRoot!.querySelectorAll<TctButton>('tct-button'),
];
const named = async (banner: TctBanner, name: string): Promise<TctButton | undefined> => {
  for (const button of buttons(banner)) {
    if ((await axNode(control(button))).name === name) return button;
  }
  return undefined;
};

async function make(attributes = 'heading="Heads up"', content = ''): Promise<TctBanner> {
  const wrapper = await fixture<HTMLElement>(
    `<div><tct-banner ${attributes}>${content}</tct-banner></div>`,
  );
  const banner = wrapper.querySelector<TctBanner>('tct-banner')!;
  await banner.updateComplete;
  for (const button of buttons(banner)) await button.updateComplete;
  return banner;
}

runElementSuite({
  tag: 'tct-banner',
  render: () => html`<tct-banner status="info" heading="Heads up"></tct-banner>`,
  properties: {
    status: 'error',
    heading: 'Other',
    description: 'More',
    icon: 'check',
    dismissable: true,
    dismissLabel: 'Close it',
    container: 'section',
    elevation: 'med',
    noCollapse: true,
    open: true,
  },
  attributes: {status: 'status', container: 'container', elevation: 'elevation'},
  events: ['tct-dismiss', 'tct-open-change'],
});

describe('tct-banner: rendering (Banner.test.tsx)', () => {
  it('renders with heading and status', async () => {
    const banner = await make('status="info" heading="Hello"');
    expect(banner.shadowRoot!.textContent).toContain('Hello');
    expect(banner.getAttribute('status')).toBe('info');
  });

  it('defaults to the info status', async () => {
    const banner = await make();
    expect(banner.status).toBe('info');
  });

  it.each([
    ['info', 'status'],
    ['success', 'status'],
    ['neutral', 'status'],
    ['warning', 'alert'],
    ['error', 'alert'],
  ] as const)('renders %s status with role="%s"', async (status, role) => {
    const banner = await make(`status="${status}" heading="Message"`);
    expect(await axNode(banner)).toMatchObject({role});
  });

  it('a host role attribute wins over the status role', async () => {
    const banner = await make('status="error" role="note" heading="Message"');
    expect(await axNode(banner)).toMatchObject({role: 'note'});
  });

  it('renders the default icon per status, decorative', async () => {
    for (const status of BANNER_STATUSES) {
      const banner = await make(`status="${status}" heading="Message"`);
      const icon = shadow(banner, 'tct-icon')!;
      expect(icon, status).not.toBeNull();
      expect(icon.closest('[aria-hidden="true"]'), status).not.toBeNull();
    }
    const error = await make('status="error" heading="M"');
    expect(shadow(error, 'tct-icon')!.getAttribute('name')).toBe('error');
    const warning = await make('status="warning" heading="M"');
    expect(shadow(warning, 'tct-icon')!.getAttribute('name')).toBe('warning');
  });

  it('renders a custom icon override (attribute and slot)', async () => {
    const named = await make('heading="M" icon="check"');
    expect(shadow(named, 'tct-icon')!.getAttribute('name')).toBe('check');
    const slotted = await make('heading="M"', '<span slot="icon" id="custom">*</span>');
    expect(shadow(slotted, 'slot[name="icon"]')).not.toBeNull();
    expect(shadow(slotted, 'tct-icon')).toBeNull();
  });

  it('renders description', async () => {
    const banner = await make('heading="Title" description="Details here"');
    expect(shadow(banner, '.description')!.textContent).toContain('Details here');
  });

  it('renders heading and description as <div> (never <p>) for composition safety', async () => {
    const banner = await make('heading="Title" description="Details"');
    expect(shadow(banner, '.heading')!.localName).toBe('div');
    expect(shadow(banner, '.description')!.localName).toBe('div');
    expect(banner.shadowRoot!.querySelector('p')).toBeNull();
  });

  it('renders no description node when none is provided', async () => {
    const banner = await make('heading="Title" description=""');
    expect(shadow(banner, '.description')).toBeNull();
    expect(shadow(banner, '.text')!.children).toHaveLength(1);
  });

  it('takes a rich heading and description through slots', async () => {
    const banner = await make('', '<b slot="heading">Rich</b><i slot="description">Fancy</i>');
    expect(shadow(banner, 'slot[name="heading"]')).not.toBeNull();
    expect(shadow(banner, 'slot[name="description"]')).not.toBeNull();
  });

  it('renders end content', async () => {
    const banner = await make('heading="Title"', '<button slot="end" id="act">Act</button>');
    const end = banner.querySelector('#act')!.getBoundingClientRect();
    expect(end.width).toBeGreaterThan(0);
    expect(shadow(banner, '.end slot[name="end"]')).not.toBeNull();
  });

  it('renders the card container by default and the section container on request', async () => {
    const card = await make('heading="M"');
    expect(shadow(card, '.frame')!.dataset.container).toBe('card');
    expect(
      parseFloat(getComputedStyle(shadow(card, '.header')!).borderStartStartRadius),
    ).toBeGreaterThan(0);
    const section = await make('heading="M" container="section"');
    expect(shadow(section, '.frame')!.dataset.container).toBe('section');
    expect(getComputedStyle(shadow(section, '.header')!).borderStartStartRadius).toBe('0px');
  });

  it('renders each status type on a distinct fill', async () => {
    const fills = new Set<string>();
    for (const status of BANNER_STATUSES) {
      const banner = await make(`status="${status}" heading="Message"`);
      fills.add(getComputedStyle(shadow(banner, '.header')!).backgroundColor);
    }
    expect(fills.size).toBeGreaterThanOrEqual(4);
  });
});

describe('tct-banner: dismiss (Banner.test.tsx)', () => {
  it('renders a dismiss button when dismissable, and none otherwise', async () => {
    const yes = await make('heading="Heads up" dismissable');
    expect(await named(yes, 'Dismiss Heads up')).toBeDefined();
    const no = await make('heading="Heads up"');
    expect(buttons(no)).toHaveLength(0);
  });

  it('fires the cancelable tct-dismiss when the dismiss button is clicked', async () => {
    const banner = await make('heading="Heads up" dismissable');
    const events = recordEvents(banner, ['tct-dismiss']);
    await userEvent.click((await named(banner, 'Dismiss Heads up'))!);
    await aTimeout(20);
    expectEventCounts(events, {'tct-dismiss': 1});
    expectEventFlags(events.events[0]!, {bubbles: true, composed: true, cancelable: true});
  });

  it('hides the banner on dismiss without a listener', async () => {
    const banner = await make('heading="Heads up" dismissable');
    await userEvent.click((await named(banner, 'Dismiss Heads up'))!);
    await aTimeout(20);
    expect(banner.hidden).toBe(true);
    expect(banner.getBoundingClientRect().height).toBe(0);
  });

  it('hides the banner and fires the event with a listener', async () => {
    const banner = await make('heading="Heads up" dismissable');
    const listener = vi.fn();
    banner.addEventListener('tct-dismiss', listener);
    await userEvent.click((await named(banner, 'Dismiss Heads up'))!);
    await aTimeout(20);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(banner.hidden).toBe(true);
  });

  it('keeps the banner when tct-dismiss is cancelled', async () => {
    const banner = await make('heading="Heads up" dismissable');
    banner.addEventListener('tct-dismiss', (event) => {
      event.preventDefault();
    });
    await userEvent.click((await named(banner, 'Dismiss Heads up'))!);
    await aTimeout(20);
    expect(banner.hidden).toBe(false);
  });

  it('writing hidden or dismissable never fires tct-dismiss', async () => {
    const banner = await make('heading="Heads up"');
    const events = recordEvents(banner, ['tct-dismiss']);
    banner.dismissable = true;
    banner.hidden = true;
    banner.hidden = false;
    await banner.updateComplete;
    expect(events.events).toHaveLength(0);
  });
});

describe('tct-banner: dismiss focus hand-off (Banner.test.tsx)', () => {
  it('returns focus to where it came from instead of dropping it to body', async () => {
    const wrapper = await fixture<HTMLElement>(
      '<div><button id="before">Before</button><tct-banner heading="Heads up" dismissable></tct-banner></div>',
    );
    const banner = wrapper.querySelector<TctBanner>('tct-banner')!;
    await banner.updateComplete;
    const before = wrapper.querySelector<HTMLButtonElement>('#before')!;
    before.focus();
    await pressKeys('Tab');
    const dismiss = (await named(banner, 'Dismiss Heads up'))!;
    expect(banner.shadowRoot!.activeElement).toBe(dismiss);
    await pressKeys('Enter');
    await aTimeout(30);
    expect(banner.hidden).toBe(true);
    expect(document.activeElement).toBe(before);
    expect(document.activeElement).not.toBe(document.body);
  });

  it('leaves focus alone when it never entered the banner', async () => {
    const wrapper = await fixture<HTMLElement>(
      '<div><button id="elsewhere">Elsewhere</button><tct-banner heading="Heads up" dismissable></tct-banner></div>',
    );
    const banner = wrapper.querySelector<TctBanner>('tct-banner')!;
    await banner.updateComplete;
    const elsewhere = wrapper.querySelector<HTMLButtonElement>('#elsewhere')!;
    elsewhere.focus();
    (await named(banner, 'Dismiss Heads up'))!.click();
    await aTimeout(30);
    expect(banner.hidden).toBe(true);
    expect(document.activeElement).toBe(elsewhere);
  });
});

describe('tct-banner: collapsible content (Banner.test.tsx)', () => {
  it('hides content behind a toggle by default', async () => {
    const banner = await make('heading="Collapsible"', '<div id="child">Extra content</div>');
    expect(shadow(banner, '.content')).toBeNull();
    expect(banner.querySelector('#child')!.getBoundingClientRect().height).toBe(0);
    expect(await named(banner, 'Expand')).toBeDefined();
  });

  it('shows content with no toggle for no-collapse', async () => {
    const banner = await make('heading="Opted out" no-collapse', '<div id="child">Extra</div>');
    expect(banner.querySelector('#child')!.getBoundingClientRect().height).toBeGreaterThan(0);
    expect(await named(banner, 'Expand')).toBeUndefined();
    expect(await named(banner, 'Collapse')).toBeUndefined();
  });

  it('leaves non-collapsible content out of the disclosure wiring', async () => {
    const banner = await make(
      'heading="Plain content" dismissable no-collapse',
      '<div id="child">Extra</div>',
    );
    const dismiss = (await named(banner, 'Dismiss Plain content'))!;
    expect(control(dismiss).hasAttribute('aria-expanded')).toBe(false);
    expect(dismiss.hasAttribute('aria-controls')).toBe(false);
    expect(shadow(banner, '.content')!.hasAttribute('id')).toBe(false);
  });

  it('starts open for the open attribute', async () => {
    const banner = await make('heading="Open" open', '<div id="child">Content</div>');
    expect(banner.querySelector('#child')!.getBoundingClientRect().height).toBeGreaterThan(0);
    expect(await named(banner, 'Collapse')).toBeDefined();
    expect(banner.matches(':state(open)')).toBe(true);
  });

  it('does not show the toggle when there is no content', async () => {
    const banner = await make('heading="No content"');
    expect(buttons(banner)).toHaveLength(0);
  });

  it('does not show the toggle for whitespace-only content, nor draw a content area', async () => {
    const banner = await make('heading="Heads up"', '\n   \n');
    expect(buttons(banner)).toHaveLength(0);
    expect(shadow(banner, '.content')).toBeNull();
  });

  it('toggles content visibility on expand and collapse click', async () => {
    const banner = await make('heading="Toggle"', '<div id="child">Extra</div>');
    const child = banner.querySelector<HTMLElement>('#child')!;
    await userEvent.click((await named(banner, 'Expand'))!);
    await banner.updateComplete;
    expect(child.getBoundingClientRect().height).toBeGreaterThan(0);
    const collapse = (await named(banner, 'Collapse'))!;
    expect(collapse).toBeDefined();
    await userEvent.click(collapse);
    await banner.updateComplete;
    expect(child.getBoundingClientRect().height).toBe(0);
  });

  it('reports open-state changes through tct-open-change (intent) and tct-after-open-change', async () => {
    const banner = await make('heading="Toggle"', '<div id="child">Extra</div>');
    const events = recordEvents(banner, ['tct-open-change', 'tct-after-open-change']);
    await userEvent.click((await named(banner, 'Expand'))!);
    await banner.updateComplete;
    await aTimeout(20);
    expectEventCounts(events, {'tct-open-change': 1, 'tct-after-open-change': 1});
    expect(events.named('tct-open-change')[0]!.open).toBe(true);
    expectEventFlags(events.named('tct-open-change')[0]!, {cancelable: true});
  });

  it('defers to the consumer when tct-open-change is cancelled', async () => {
    const banner = await make('heading="Toggle"', '<div id="child">Extra</div>');
    banner.addEventListener('tct-open-change', (event) => {
      event.preventDefault();
    });
    await userEvent.click((await named(banner, 'Expand'))!);
    await banner.updateComplete;
    expect(banner.open).toBe(false);
    expect(banner.querySelector('#child')!.getBoundingClientRect().height).toBe(0);
    banner.open = true;
    await banner.updateComplete;
    expect(banner.querySelector('#child')!.getBoundingClientRect().height).toBeGreaterThan(0);
  });

  it('writing open fires no intent event', async () => {
    const banner = await make('heading="Toggle"', '<div>Extra</div>');
    const events = recordEvents(banner, ['tct-open-change']);
    banner.open = true;
    await banner.updateComplete;
    expect(events.events).toHaveLength(0);
  });

  it('renders the expand button before the dismiss button', async () => {
    const banner = await make('heading="Both" dismissable', '<div>Extra</div>');
    const order = await Promise.all(
      buttons(banner).map(async (b) => (await axNode(control(b))).name),
    );
    expect(order).toEqual(['Expand', 'Dismiss Both']);
  });

  it('links the expand toggle to its content region via aria-controls', async () => {
    const banner = await make('heading="Toggle"', '<div>Extra</div>');
    const toggle = (await named(banner, 'Expand'))!;
    // Collapsed: nothing to point at, so no aria-controls.
    expect(toggle.hasAttribute('aria-controls')).toBe(false);
    await userEvent.click(toggle);
    await banner.updateComplete;
    const expanded = (await named(banner, 'Collapse'))!;
    await expanded.updateComplete;
    const id = expanded.getAttribute('aria-controls')!;
    expect(id).not.toBe('');
    expect(banner.shadowRoot!.getElementById(id)).toBe(shadow(banner, '.content'));
    expect(await axNode(control(expanded))).toMatchObject({expanded: 'true'});
  });

  it('carries aria-expanded on the toggle, and the chevron rotates when open', async () => {
    const banner = await make('heading="Toggle" open', '<div>Extra</div>');
    const toggle = (await named(banner, 'Collapse'))!;
    expect(control(toggle).getAttribute('aria-expanded')).toBe('true');
    expect(toggle.hasAttribute('data-expanded')).toBe(true);
  });
});

describe('tct-banner: containers and elevation (Banner.test.tsx)', () => {
  it('carries the frame part and defaults to flat', async () => {
    const banner = await make();
    expect(shadow(banner, '[part="frame"]')).not.toBeNull();
    expect(getComputedStyle(shadow(banner, '.frame')!).boxShadow).toBe('none');
  });

  it('draws a distinct shadow per elevation level, following the card radius', async () => {
    const shadows = new Set<string>();
    for (const elevation of ['none', 'low', 'med', 'high']) {
      const banner = await make(`heading="M" elevation="${elevation}"`);
      shadows.add(getComputedStyle(shadow(banner, '.frame')!).boxShadow);
    }
    expect(shadows.size).toBe(4);
    const raised = await make('heading="M" elevation="med"');
    expect(
      parseFloat(getComputedStyle(shadow(raised, '.frame')!).borderStartStartRadius),
    ).toBeGreaterThan(0);
  });

  it('squares the header bottom corners while content shows, and rounds the content area', async () => {
    const banner = await make('heading="M" no-collapse', '<div>Body</div>');
    const header = getComputedStyle(shadow(banner, '.header')!);
    expect(header.borderEndStartRadius).toBe('0px');
    expect(parseFloat(header.borderStartStartRadius)).toBeGreaterThan(0);
    expect(
      parseFloat(getComputedStyle(shadow(banner, '.content')!).borderEndStartRadius),
    ).toBeGreaterThan(0);
  });
});

describe('tct-banner: narrow viewport wrapping (Banner.test.tsx)', () => {
  it('lets the header wrap so the end area can take its own row', async () => {
    const banner = await make('heading="Wrap"');
    expect(getComputedStyle(shadow(banner, '.header')!).flexWrap).toBe('wrap');
  });

  it('gives the text column a wrap threshold when end content is present', async () => {
    const banner = await make('heading="Wrap"', '<button slot="end">Act</button>');
    expect(shadow(banner, '.text')!.hasAttribute('data-with-end')).toBe(true);
    expect(getComputedStyle(shadow(banner, '.text')!).flexBasis).not.toBe('auto');
  });

  it('leaves the text column free to shrink when there is no end content', async () => {
    const banner = await make('heading="Wrap"');
    expect(shadow(banner, '.text')!.hasAttribute('data-with-end')).toBe(false);
  });

  it('wraps the actions below the text in a narrow container, with no horizontal scroll', async () => {
    const wrapper = await fixture<HTMLElement>(
      '<div style="inline-size:220px"><tct-banner heading="A reasonably long heading that must wrap" dismissable><button slot="end">Retry</button></tct-banner></div>',
    );
    const banner = wrapper.querySelector<TctBanner>('tct-banner')!;
    await banner.updateComplete;
    await nextFrame();
    const text = shadow(banner, '.text')!.getBoundingClientRect();
    const end = shadow(banner, '.end')!.getBoundingClientRect();
    expect(end.top).toBeGreaterThanOrEqual(text.bottom - 1);
    expect(banner.scrollWidth).toBeLessThanOrEqual(banner.clientWidth + 1);
  });

  it('breaks a long unbroken heading instead of overflowing', async () => {
    const wrapper = await fixture<HTMLElement>(
      `<div style="inline-size:200px"><tct-banner heading="${'x'.repeat(80)}"></tct-banner></div>`,
    );
    const banner = wrapper.querySelector<TctBanner>('tct-banner')!;
    await banner.updateComplete;
    expect(banner.scrollWidth).toBeLessThanOrEqual(banner.clientWidth + 1);
  });
});

describe('tct-banner: dismiss control naming (Banner.test.tsx)', () => {
  it('names stacked banners distinctly, with the bare verb as the description', async () => {
    const first = await make('status="error" heading="Upload invoice failed" dismissable');
    const second = await make('status="error" heading="Delete report failed" dismissable');
    const a = await axNode(control(buttons(first)[0]!));
    const b = await axNode(control(buttons(second)[0]!));
    expect(a.name).toBe('Dismiss Upload invoice failed');
    expect(b.name).toBe('Dismiss Delete report failed');
    expect(a.description).toBe('Dismiss');
  });

  it('keeps the bare name and tooltip for a rich heading', async () => {
    const banner = await make('dismissable', '<span slot="heading">Rich heading</span>');
    const node = await axNode(control(buttons(banner)[0]!));
    expect(node.name).toBe('Dismiss');
  });

  it('uses a translated dismiss-label for a rich heading and its tooltip', async () => {
    const banner = await make(
      'dismissable dismiss-label="Wartungshinweis schließen"',
      '<span slot="heading">Wartungshinweis</span>',
    );
    const node = await axNode(control(buttons(banner)[0]!));
    expect(node.name).toBe('Wartungshinweis schließen');
    expect(shadow(banner, '.tooltip-surface, tct-button')).not.toBeNull();
    expect(buttons(banner)[0]!.tooltip).toBe('Wartungshinweis schließen');
  });

  it('localises the built-in strings from the language in scope', async () => {
    await loadLocale('de-DE');
    const wrapper = await fixture<HTMLElement>(
      '<div lang="de-DE"><tct-banner heading="Wartung" dismissable><div>Mehr</div></tct-banner></div>',
    );
    const banner = wrapper.querySelector<TctBanner>('tct-banner')!;
    await banner.updateComplete;
    await nextFrame();
    for (const button of buttons(banner)) await button.updateComplete;
    const names = await Promise.all(
      buttons(banner).map(async (b) => (await axNode(control(b))).name),
    );
    expect(names).toHaveLength(2);
    expect(names).not.toContain('Expand');
    expect(names[1]).toMatch(/Wartung$/);
    expect(names[1]).not.toBe('Dismiss Wartung');
  });

  it('localises to a right-to-left language and mirrors the layout', async () => {
    await loadLocale('ar-SA');
    const wrapper = await fixture<HTMLElement>(
      '<div lang="ar-SA" dir="rtl"><tct-banner heading="تنبيه" dismissable><div>المزيد</div></tct-banner></div>',
    );
    const banner = wrapper.querySelector<TctBanner>('tct-banner')!;
    await banner.updateComplete;
    await nextFrame();
    for (const button of buttons(banner)) await button.updateComplete;
    const names = await Promise.all(
      buttons(banner).map(async (b) => (await axNode(control(b))).name),
    );
    expect(names).not.toContain('Expand');
    const icon = shadow(banner, '.icon-wrapper')!.getBoundingClientRect();
    const end = shadow(banner, '.end')!.getBoundingClientRect();
    expect(icon.left).toBeGreaterThan(end.left);
  });
});

describe('tct-banner: colour and contrast on the filled statuses', () => {
  /** Relative luminance of a computed `rgb()` colour. */
  const luminance = (rgb: string): number => {
    const [r, g, b] = (rgb.match(/[\d.]+/g) ?? []).slice(0, 3).map((v) => {
      const c = Number(v) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    }) as [number, number, number];
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const contrast = (a: string, b: string): number => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
    return (hi + 0.05) / (lo + 0.05);
  };

  it.each(BANNER_STATUSES)('the %s header text reaches 4.5:1 on its fill', async (status) => {
    const banner = await make(`status="${status}" heading="Message" description="Details"`);
    const header = getComputedStyle(shadow(banner, '.header')!);
    expect(contrast(header.color, header.backgroundColor)).toBeGreaterThanOrEqual(4.5);
    const description = getComputedStyle(shadow(banner, '.description')!);
    expect(contrast(description.color, header.backgroundColor)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(BANNER_STATUSES)('the %s focus ring reaches 3:1 on its fill', async (status) => {
    const banner = await make(`status="${status}" heading="Message" dismissable`);
    const header = getComputedStyle(shadow(banner, '.header')!);
    const ring = header.getPropertyValue('--focus-outline-color');
    expect(ring).not.toBe('');
    const probe = await fixture<HTMLElement>('<span>x</span>');
    probe.style.color = ring.trim();
    expect(contrast(getComputedStyle(probe).color, header.backgroundColor)).toBeGreaterThanOrEqual(
      3,
    );
  });

  it('the ghost buttons on the fill take the ink colour', async () => {
    const banner = await make('status="error" heading="Message" dismissable');
    const dismiss = buttons(banner)[0]!;
    const header = getComputedStyle(shadow(banner, '.header')!);
    expect(
      contrast(getComputedStyle(control(dismiss)).color, header.backgroundColor),
    ).toBeGreaterThanOrEqual(3);
  });
});

describe('tct-banner: links in banner content', () => {
  // A plain <a> in the light DOM takes the UA link colour (#0000ee light, #9e9eff dark: 1.5:1 on the info
  // fill). ::slotted() reaches only the top-level slotted element, so a light-DOM sheet styles the links.
  const withLinks = (): string => `
    <span slot="heading">Read <a href="#h">the heading link</a></span>
    <span slot="description">Open the <a href="#d">production summary</a> or <a href="#e">docs</a>.</span>
    <a slot="end" href="#end">Details</a>`;

  it
    .skipIf(!isChromium)
    .each(
      BANNER_STATUSES.flatMap((status) =>
        (['light', 'dark'] as const).map((scheme) => [status, scheme]),
      ),
    )(
    'a plain link in the %s banner is readable and underlined (%s, axe color-contrast)',
    async (status, scheme) => {
      await emulateMedia({colorScheme: scheme as 'light' | 'dark'});
      const banner = await make(`status="${status}"`, withLinks());
      const wrapper = banner.parentElement!;
      wrapper.style.colorScheme = scheme;
      wrapper.style.backgroundColor = 'var(--color-background-body)';
      const results = await expectAccessible(wrapper, {
        runOnly: ['color-contrast', 'link-in-text-block'],
      });
      expect(results.passes.some((rule) => rule.id === 'color-contrast')).toBe(true);
      for (const link of banner.querySelectorAll('a')) {
        expect(getComputedStyle(link).textDecorationLine).toBe('underline');
      }
    },
  );

  it('a tct-link in the banner content takes the ink colour', async () => {
    const banner = await make(
      'status="info"',
      '<span slot="description">Open <tct-link href="#x">the summary</tct-link></span>',
    );
    const link = banner.querySelector('tct-link')!;
    await (link as HTMLElement & {updateComplete: Promise<boolean>}).updateComplete;
    const header = getComputedStyle(shadow(banner, '.header')!);
    const root = link.shadowRoot!.querySelector<HTMLElement>('.root')!;
    expect(getComputedStyle(root).color).toBe(header.color);
  });
});

describe('tct-banner: accessibility, RTL, forced colours', () => {
  it('passes axe in every status and state', async () => {
    for (const status of BANNER_STATUSES) {
      await expectAccessible(
        await make(`status="${status}" heading="Message" description="Details"`),
      );
    }
    await expectAccessible(await make('heading="Message" dismissable', '<div>Content</div>'));
    await expectAccessible(await make('heading="Message" open', '<div>Content</div>'));
    await expectAccessible(
      await make('heading="Message" no-collapse container="section"', '<p>Content</p>'),
    );
    await expectAccessible(await make('status="error" heading="Failed" elevation="high"'));
  });

  it('announces its heading through the role: alert for errors', async () => {
    const banner = await make('status="error" heading="Payment failed" description="Try again"');
    expect(await axNode(banner)).toMatchObject({role: 'alert'});
  });

  it('lays out the icon at the inline start and the end area at the inline end, mirrored in RTL', async () => {
    const wrapper = await fixture<HTMLElement>(
      '<div dir="rtl"><tct-banner heading="Message" dismissable></tct-banner></div>',
    );
    const banner = wrapper.querySelector<TctBanner>('tct-banner')!;
    await banner.updateComplete;
    const icon = shadow(banner, '.icon-wrapper')!.getBoundingClientRect();
    const text = shadow(banner, '.text')!.getBoundingClientRect();
    const end = shadow(banner, '.end')!.getBoundingClientRect();
    expect(icon.left).toBeGreaterThanOrEqual(text.right - 1);
    expect(end.right).toBeLessThanOrEqual(text.left + 1);
  });

  it.skipIf(!isChromium)('keeps a visible edge in forced colours', async () => {
    const restore = await emulateMedia({forcedColors: 'active'});
    try {
      const banner = await make('status="error" heading="Message"');
      expect(getComputedStyle(shadow(banner, '.header')!).borderTopWidth).toBe('1px');
    } finally {
      await restore();
    }
  });
});
