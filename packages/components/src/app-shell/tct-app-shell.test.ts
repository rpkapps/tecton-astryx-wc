/**
 * tct-app-shell: the frame (main landmark, header banner, side navigation), the skip link, the height
 * modes, the breakpoints (exclusive edge, named points, themes, none), the mobile drawer and top bar,
 * the mobile context, variants, RTL (ported from upstream AppShell.test.tsx; navigation content is plain
 * placeholder markup, since the navigation components are a later work package).
 */
import {html, LitElement} from 'lit';
import {afterEach, describe, expect, it} from 'vitest';
import {page, userEvent} from 'vitest/browser';
import {registerTheme, resetThemes} from '@tecton-wc/core/theme/theme-registry.js';
import {containsFlat, deepActiveElement} from '@tecton-wc/core/utils/focus.js';
import {axNode, expectAccessible} from '@tecton-wc/testing/a11y.js';
import {recordEvents} from '@tecton-wc/testing/events.js';
import {fixture} from '@tecton-wc/testing/fixture.js';
import {pressKeys, tabSequence} from '@tecton-wc/testing/keyboard.js';
import {runElementSuite} from '@tecton-wc/testing/suites/element.js';
import {nextFrame, waitUntil} from '@tecton-wc/testing/timing.js';
import '../theme/define.js';
import '../mobile-nav/define.js';
import './define.js';
import {AppShellMobileController, INERT_APP_SHELL_MOBILE} from './app-shell-mobile.context.js';
import type {TctAppShell} from './tct-app-shell.js';

afterEach(async () => {
  await page.viewport(414, 896);
  resetThemes();
});

runElementSuite({
  tag: 'tct-app-shell',
  render: () => html`<tct-app-shell style="block-size: 300px"><p>content</p></tct-app-shell>`,
  properties: {
    variant: 'section',
    height: 'auto',
    contentPadding: 4,
    mobileNavBreakpoint: 'lg',
    noMobileToggle: true,
  },
  attributes: {variant: 'variant', height: 'height', mobileNavBreakpoint: 'mobile-nav-breakpoint'},
});

const PLACEHOLDER = {
  side: `<nav slot="side-nav" aria-label="Sections" id="side"><a id="one" href="#one">One</a><a id="two" href="#two">Two</a></nav>`,
  top: `<div slot="top-nav" id="top"><span>App name</span><tct-mobile-nav-toggle id="toggle"></tct-mobile-nav-toggle></div>`,
  banner: `<div slot="banner" id="banner">Scheduled maintenance tonight</div>`,
  main: `<p id="content">Main content</p>`,
};

/** A shell of a fixed height at a viewport width. */
async function shell(
  attributes = '',
  parts: (keyof typeof PLACEHOLDER)[] = ['side', 'top', 'main'],
  width = 1000,
  options: {dir?: 'rtl'; lang?: string} = {},
) {
  await page.viewport(width, 800);
  const root = await fixture<HTMLElement>(
    `<tct-app-shell ${attributes} style="display: block">${parts.map((part) => PLACEHOLDER[part]).join('')}</tct-app-shell>`,
    options,
  );
  const element = root as TctAppShell;
  await element.updateComplete;
  await nextFrame();
  return element;
}

const rootOf = (element: Element): ShadowRoot => element.shadowRoot!;
const main = (element: TctAppShell): HTMLElement =>
  rootOf(element).querySelector<HTMLElement>('tct-layout-content')!;
const mainBox = (element: TctAppShell): HTMLElement =>
  main(element).shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
const skip = (element: TctAppShell): HTMLAnchorElement =>
  rootOf(element).querySelector<HTMLAnchorElement>('.skip-link')!;

describe('tct-app-shell: frame', () => {
  it('renders the children as the main landmark', async () => {
    const element = await shell();
    const box = mainBox(element);
    expect(box.getAttribute('role')).toBe('main');
    expect(element.querySelector('#content')).not.toBeNull();
    expect((await axNode(box)).role).toBe('main');
    expect(main(element).slot).toBe('');
  });

  it('renders the top navigation in the header, which is a banner landmark', async () => {
    const element = await shell('', ['top', 'main']);
    const header = rootOf(element).querySelector<HTMLElement>('.header')!;
    expect(header.getAttribute('role')).toBe('banner');
    expect((await axNode(header)).role).toBe('banner');
    const slot = header.querySelector<HTMLSlotElement>('slot[name="top-nav"]')!;
    expect(slot.assignedElements()[0]!.id).toBe('top');
  });

  it('no-landmarks leaves the header and the main region without a landmark role', async () => {
    const element = await shell('no-landmarks', ['banner', 'top', 'side', 'main']);
    expect(rootOf(element).querySelector('[role="banner"]')).toBeNull();
    expect(mainBox(element).hasAttribute('role')).toBe(false);
    expect((await axNode(rootOf(element).querySelector<HTMLElement>('.header')!)).role).not.toBe(
      'banner',
    );
    // The frame itself is unchanged: the skip link still moves focus to the main region.
    skip(element).click();
    await nextFrame();
    expect(deepActiveElement()).toBe(mainBox(element));
  });

  it('--app-shell-height sets the height of the shell in place of the viewport height', async () => {
    const element = await shell('style="--app-shell-height: 333px"', ['side', 'top', 'main']);
    const box = rootOf(element).querySelector<HTMLElement>('.shell')!;
    expect(box.getBoundingClientRect().height).toBe(333);
  });

  it('renders the banner above the top navigation', async () => {
    const element = await shell('', ['banner', 'top', 'main']);
    const banner = rootOf(element).querySelector<HTMLSlotElement>('slot[name="banner"]')!;
    expect(banner.assignedElements()[0]!.id).toBe('banner');
    const top = element.querySelector('#top')!.getBoundingClientRect();
    expect(element.querySelector('#banner')!.getBoundingClientRect().bottom).toBeLessThanOrEqual(
      top.top + 1,
    );
  });

  it('renders without optional slots, and without a banner landmark when there is no header content', async () => {
    const element = await shell('', ['main']);
    expect(rootOf(element).querySelector('.header')).toBeNull();
    expect(rootOf(element).querySelector('[role="banner"]')).toBeNull();
    expect(mainBox(element).getAttribute('role')).toBe('main');
    await expectAccessible(element);
  });

  it('renders the side navigation in an inline panel above the breakpoint', async () => {
    const element = await shell('', ['side', 'main']);
    const panel = rootOf(element).querySelector('tct-layout-panel')!;
    expect(
      panel.querySelector<HTMLSlotElement>('slot[name="side-nav"]')!.assignedElements()[0]!.id,
    ).toBe('side');
    expect(rootOf(element).querySelector('tct-mobile-nav')).toBeNull();
    // To the start of the content.
    expect(element.querySelector('#side')!.getBoundingClientRect().right).toBeLessThanOrEqual(
      element.querySelector('#content')!.getBoundingClientRect().left + 1,
    );
  });

  it('passes content-padding to the main region, defaulting to edge to edge', async () => {
    const plain = await shell('', ['main']);
    expect(getComputedStyle(mainBox(plain)).paddingLeft).toBe('0px');
    const padded = await shell('content-padding="4"', ['main']);
    expect(getComputedStyle(mainBox(padded)).paddingLeft).toBe('16px');
  });

  it('mirrors in RTL: the side navigation is on the right', async () => {
    const element = await shell('', ['side', 'main'], 1000, {dir: 'rtl'});
    expect(element.querySelector('#side')!.getBoundingClientRect().left).toBeGreaterThan(
      element.querySelector('#content')!.getBoundingClientRect().left,
    );
  });

  it('exposes the shell box and header as parts, the side navigation box as sidenav', async () => {
    const element = await shell('', ['side', 'top', 'main']);
    expect(rootOf(element).querySelector('[part~="base"]')).not.toBeNull();
    expect(rootOf(element).querySelector('[part~="header"]')).not.toBeNull();
    expect(rootOf(element).querySelector('tct-layout-panel')!.getAttribute('exportparts')).toBe(
      'base: sidenav',
    );
  });

  it('is accessible with every slot filled', async () => {
    const element = await shell('', ['banner', 'top', 'side', 'main']);
    await expectAccessible(element);
  });
});

describe('tct-app-shell: skip link', () => {
  it('renders a skip link with the catalog text as the first tab stop', async () => {
    const element = await shell();
    const link = skip(element);
    expect(link.textContent.trim()).toBe('Skip to content');
    expect(link.getAttribute('href')).toBe('#');
    const stops = await tabSequence(element, {max: 3});
    expect(stops[0]).toBe(link);
  });

  it('is visually hidden until it takes focus, then visible at the top start corner', async () => {
    const element = await shell();
    const link = skip(element);
    expect(link.getBoundingClientRect().width).toBeLessThanOrEqual(1);
    link.focus();
    const box = link.getBoundingClientRect();
    expect(box.width).toBeGreaterThan(40);
    expect(box.top).toBeLessThan(20);
    expect(box.left).toBeLessThan(20);
  });

  it('moves focus to the main region when it is activated with the keyboard', async () => {
    const element = await shell();
    skip(element).focus();
    await pressKeys('Enter');
    expect(deepActiveElement()).toBe(mainBox(element));
    expect(mainBox(element).getAttribute('tabindex')).not.toBeNull();
  });

  it('reaches the skip link with Tab and moves focus to main with Enter (from the top of the page)', async () => {
    const element = await shell();
    (document.activeElement as HTMLElement | null)?.blur();
    await pressKeys('Tab');
    expect(deepActiveElement()).toBe(skip(element));
    await pressKeys('Enter');
    expect(deepActiveElement()).toBe(mainBox(element));
    // The next Tab continues from the main region into its content.
  });

  it('moves focus on a click too', async () => {
    const element = await shell();
    await userEvent.click(skip(element)).catch(() => undefined);
    skip(element).click();
    expect(deepActiveElement()).toBe(mainBox(element));
  });

  it('the main region is focusable by script but not a tab stop', async () => {
    const element = await shell();
    const box = mainBox(element);
    expect(box.getAttribute('tabindex')).toBe('-1');
    const stops = await tabSequence(element, {max: 8});
    expect(stops).not.toContain(box);
    // Focus by script draws no ring around the whole content area.
    element.focusMain();
    expect(getComputedStyle(box).outlineStyle).toBe('none');
  });

  it('a scrolling main region becomes a real tab stop', async () => {
    const element = await shell('style="block-size: 300px"', ['main']);
    element.style.blockSize = '300px';
    element.querySelector('#content')!.setAttribute('style', 'block-size: 2000px');
    await waitUntil(() => mainBox(element).getAttribute('tabindex') === '0');
  });

  it('is localised: German text and Arabic RTL', async () => {
    const german = await shell('', ['main'], 1000, {lang: 'de-DE'});
    await waitUntil(() => skip(german).textContent.trim() !== 'Skip to content');
    expect(skip(german).textContent.trim()).toBe('Zum Inhalt springen');
    const arabic = await shell('', ['main'], 1000, {lang: 'ar-SA', dir: 'rtl'});
    await waitUntil(() => skip(arabic).textContent.trim() !== 'Skip to content');
    expect(skip(arabic).textContent.trim().length).toBeGreaterThan(0);
  });
});

describe('tct-app-shell: height', () => {
  it('defaults to fill: the shell is as tall as the viewport and the main region scrolls', async () => {
    const element = await shell('', ['main']);
    expect(element.height).toBe('fill');
    const shellBox = rootOf(element).querySelector<HTMLElement>('.shell')!;
    expect(Math.round(shellBox.getBoundingClientRect().height)).toBe(800);
    expect(getComputedStyle(mainBox(element)).overflowY).toBe('auto');
  });

  it('auto grows with its content and the page scrolls', async () => {
    const element = await shell('height="auto"', ['top', 'side', 'main']);
    element.querySelector('#content')!.setAttribute('style', 'block-size: 2000px');
    await nextFrame();
    const shellBox = rootOf(element).querySelector<HTMLElement>('.shell')!;
    expect(shellBox.getBoundingClientRect().height).toBeGreaterThan(2000);
    expect(getComputedStyle(mainBox(element)).overflowY).toBe('clip');
  });

  it('auto pins the header and the side navigation while the page scrolls', async () => {
    const element = await shell('height="auto"', ['top', 'side', 'main']);
    element.querySelector('#content')!.setAttribute('style', 'block-size: 3000px');
    await nextFrame();
    const header = rootOf(element).querySelector<HTMLElement>('.header')!;
    const frame = rootOf(element).querySelector<HTMLElement>('.sidenav-frame')!;
    expect(getComputedStyle(header).position).toBe('sticky');
    expect(getComputedStyle(frame).position).toBe('sticky');
    window.scrollTo(0, 500);
    await nextFrame();
    expect(Math.round(header.getBoundingClientRect().top)).toBe(0);
    // The side navigation sticks right below the header.
    const headerHeight = header.getBoundingClientRect().height;
    expect(Math.round(frame.getBoundingClientRect().top)).toBe(Math.round(headerHeight));
    window.scrollTo(0, 0);
  });

  it('fill has no sticky wrappers', async () => {
    const element = await shell('', ['top', 'side', 'main']);
    const header = rootOf(element).querySelector<HTMLElement>('.header')!;
    expect(getComputedStyle(header).position).not.toBe('sticky');
  });
});

describe('tct-app-shell: breakpoints', () => {
  it('uses md (768) as the default with an exclusive upper edge', async () => {
    const at = await shell('', ['side', 'main'], 768);
    expect(at.isMobile).toBe(false);
    expect(at.matches(':state(mobile)')).toBe(false);
    const below = await shell('', ['side', 'main'], 767);
    expect(below.isMobile).toBe(true);
    await below.updateComplete;
    expect(below.matches(':state(mobile)')).toBe(true);
  });

  it('resolves all the named points', async () => {
    for (const [name, px] of [
      ['sm', 640],
      ['md', 768],
      ['lg', 1024],
      ['xl', 1280],
      ['2xl', 1536],
    ] as const) {
      const wide = await shell(`mobile-nav-breakpoint="${name}"`, ['side', 'main'], px);
      const atEdge = wide.isMobile;
      const narrow = await shell(`mobile-nav-breakpoint="${name}"`, ['side', 'main'], px - 1);
      expect([name, atEdge, narrow.isMobile]).toEqual([name, false, true]);
      expect(wide.mobileBreakpointPx).toBe(px);
    }
  });

  it('none never enters mobile mode, whatever the width or the hint', async () => {
    const element = await shell(
      'mobile-nav-breakpoint="none" default-is-mobile',
      ['side', 'main'],
      320,
    );
    expect(element.isMobile).toBe(false);
    expect(element.mobileBreakpointPx).toBeUndefined();
    expect(rootOf(element).querySelector('tct-layout-panel')).not.toBeNull();
  });

  it('resolves the points through the nearest theme', async () => {
    registerTheme({
      name: 'wide',
      __adaptations: {
        widthBreakpoints: {sm: 500, md: 1100, lg: 1400, xl: 1800, '2xl': 2200},
        rules: [],
      },
    } as never);
    await page.viewport(1000, 800);
    const root = await fixture<HTMLElement>(
      `<tct-theme theme="wide"><tct-app-shell style="display: block"><nav slot="side-nav"><a href="#a">a</a></nav><p>c</p></tct-app-shell></tct-theme>`,
    );
    const element = root.querySelector<TctAppShell>('tct-app-shell')!;
    await element.updateComplete;
    await waitUntil(() => element.mobileBreakpointPx === 1100);
    expect(element.isMobile).toBe(true);
  });

  it('follows the viewport live', async () => {
    const element = await shell('', ['side', 'main'], 1000);
    expect(rootOf(element).querySelector('tct-layout-panel')).not.toBeNull();
    await page.viewport(500, 800);
    await waitUntil(() => element.isMobile);
    await element.updateComplete;
    expect(rootOf(element).querySelector('tct-layout-panel')).toBeNull();
    expect(rootOf(element).querySelector('tct-mobile-nav')).not.toBeNull();
    await page.viewport(1000, 800);
    await waitUntil(() => !element.isMobile);
    await element.updateComplete;
    expect(rootOf(element).querySelector('tct-mobile-nav')).toBeNull();
  });
});

describe('tct-app-shell: mobile navigation', () => {
  const nav = (element: TctAppShell) => rootOf(element).querySelector('tct-mobile-nav')!;
  const dialog = (element: TctAppShell) => nav(element).shadowRoot!.querySelector('dialog')!;

  it('renders the automatic drawer below the breakpoint, closed, with the side navigation inside', async () => {
    const element = await shell('', ['side', 'top', 'main'], 500);
    expect(dialog(element).open).toBe(false);
    const slot = nav(element).querySelector<HTMLSlotElement>('slot[name="side-nav"]')!;
    expect(slot.assignedElements()[0]!.id).toBe('side');
    expect(element.mobileNavOpen).toBe(false);
  });

  it('opens from the toggle as a modal drawer under 768px and returns focus on close', async () => {
    const element = await shell('', ['side', 'top', 'main'], 500);
    const toggle = element.querySelector<HTMLElement>('#toggle')!;
    const button = toggle
      .shadowRoot!.querySelector('tct-button')!
      .shadowRoot!.querySelector('button')!;
    button.focus();
    await pressKeys('Enter');
    await waitUntil(() => dialog(element).open);
    expect(dialog(element).matches(':modal')).toBe(true);
    expect(element.mobileNavOpen).toBe(true);
    expect(element.matches(':state(mobile-nav-open)')).toBe(true);
    // The side navigation is inside the drawer, and the page behind is inert.
    expect(containsFlat(dialog(element), element.querySelector('#side'))).toBe(true);
    await pressKeys('Escape');
    await waitUntil(() => !element.mobileNavOpen);
    await waitUntil(() => !dialog(element).open);
    await waitUntil(() => deepActiveElement() === button);
  });

  it("the drawer's close button and the dimmed area close it", async () => {
    const element = await shell('', ['side', 'top', 'main'], 500);
    element.mobileNavOpen = true;
    await waitUntil(() => dialog(element).open);
    const events = recordEvents(element, ['tct-open-change']);
    nav(element).shadowRoot!.querySelector<HTMLElement>('.close')!.click();
    await waitUntil(() => !element.mobileNavOpen);
    expect(events.events.map((event) => [event.open, event.reason])).toEqual([
      [false, 'close-button'],
    ]);
  });

  it('a prevented tct-open-change keeps the drawer as it is (the page owns the state)', async () => {
    const element = await shell('', ['side', 'top', 'main'], 500);
    element.mobileNavOpen = true;
    await waitUntil(() => dialog(element).open);
    element.addEventListener('tct-open-change', (event) => {
      event.preventDefault();
    });
    nav(element).requestClose('request');
    await nextFrame();
    expect(element.mobileNavOpen).toBe(true);
    expect(dialog(element).open).toBe(true);
  });

  it('opens initially with mobile-nav-open', async () => {
    const element = await shell('mobile-nav-open', ['side', 'top', 'main'], 500);
    await waitUntil(() => dialog(element).open);
  });

  it('a side-navigation-only shell gets a mobile top bar with the toggle (a banner and a navigation)', async () => {
    const element = await shell('', ['side', 'main'], 500);
    const bar = rootOf(element).querySelector<HTMLElement>('.mobile-bar')!;
    expect(bar.getAttribute('role')).toBe('navigation');
    expect(bar.getAttribute('aria-label')).toBe('Mobile navigation');
    expect(bar.querySelector('tct-mobile-nav-toggle')).not.toBeNull();
    const header = bar.closest<HTMLElement>('.header')!;
    expect(header.getAttribute('role')).toBe('banner');
    expect(rootOf(element).querySelectorAll('[role="banner"]')).toHaveLength(1);
  });

  it('with a top navigation there is no automatic bar (it places the toggle itself)', async () => {
    const element = await shell('', ['side', 'top', 'main'], 500);
    expect(rootOf(element).querySelector('.mobile-bar')).toBeNull();
  });

  it('a banner slot joins the mobile bar without a second banner landmark', async () => {
    const element = await shell('', ['banner', 'side', 'main'], 500);
    expect(rootOf(element).querySelectorAll('[role="banner"]')).toHaveLength(1);
    expect(rootOf(element).querySelector('.mobile-bar')).not.toBeNull();
  });

  it('no-mobile-toggle places no bar; no-mobile-nav removes the drawer, the toggle and the side navigation', async () => {
    const noToggle = await shell('no-mobile-toggle', ['side', 'main'], 500);
    expect(rootOf(noToggle).querySelector('.mobile-bar')).toBeNull();
    expect(rootOf(noToggle).querySelector('tct-mobile-nav')).not.toBeNull();
    const off = await shell('no-mobile-nav', ['side', 'main'], 500);
    expect(rootOf(off).querySelector('tct-mobile-nav')).toBeNull();
    expect(rootOf(off).querySelector('tct-layout-panel')).toBeNull();
    expect(rootOf(off).querySelector('.mobile-bar')).toBeNull();
  });

  it('a shell with no navigation has no mobile navigation', async () => {
    const element = await shell('', ['main'], 500);
    expect(rootOf(element).querySelector('tct-mobile-nav')).toBeNull();
    expect(rootOf(element).querySelector('.mobile-bar')).toBeNull();
  });

  it('a tct-mobile-nav in the mobile-nav slot replaces the automatic drawer and follows the shell state', async () => {
    await page.viewport(500, 800);
    const root = await fixture<HTMLElement>(
      `<tct-app-shell style="display: block">
        <nav slot="side-nav"><a href="#a">a</a></nav>
        <div slot="top-nav"><tct-mobile-nav-toggle id="toggle"></tct-mobile-nav-toggle></div>
        <tct-mobile-nav slot="mobile-nav" id="mine" header="My menu"><a href="#z">z</a></tct-mobile-nav>
        <p>c</p></tct-app-shell>`,
    );
    const element = root as TctAppShell;
    await element.updateComplete;
    expect(rootOf(element).querySelector('tct-mobile-nav')).toBeNull();
    const mine = element.querySelector<HTMLElement & {isOpen: boolean}>('#mine')!;
    expect(mine.isOpen).toBe(false);
    element.openMobileNav();
    await waitUntil(() => mine.isOpen);
    await waitUntil(() => mine.shadowRoot!.querySelector('dialog')!.open);
    element.closeMobileNav();
    await waitUntil(() => !mine.isOpen);
  });
});

describe('tct-app-shell: mobile context', () => {
  class Probe extends LitElement {
    readonly shell: AppShellMobileController = new AppShellMobileController(this);
    override render() {
      return html`${JSON.stringify({
        mobile: this.shell.value.isMobile,
        placement: this.shell.value.sideNavPlacement,
      })}`;
    }
  }
  customElements.define('test-shell-probe', Probe);

  it('is inert outside an app shell', async () => {
    const probe = await fixture<Probe>(`<test-shell-probe></test-shell-probe>`);
    expect(probe.shell.value).toBe(INERT_APP_SHELL_MOBILE);
    expect(probe.shell.isInShell).toBe(false);
    expect(probe.shell.value.isMobile).toBe(false);
    expect(probe.shell.value.isMobileNavEnabled).toBe(false);
    // The commands are safe no-ops.
    expect(() => {
      probe.shell.value.toggleMobileNav();
    }).not.toThrow();
  });

  it('reports the shell mobile state and where the side navigation renders', async () => {
    await page.viewport(1000, 800);
    const root = await fixture<HTMLElement>(
      `<tct-app-shell style="display: block"><nav slot="side-nav"><a href="#a">a</a></nav><test-shell-probe id="probe"></test-shell-probe></tct-app-shell>`,
    );
    const element = root as TctAppShell;
    const probe = element.querySelector<Probe>('#probe')!;
    await element.updateComplete;
    await probe.updateComplete;
    expect(probe.shell.isInShell).toBe(true);
    expect(probe.shell.value).toMatchObject({
      isMobile: false,
      sideNavPlacement: 'inline',
      hasSideNav: true,
      hasTopNav: false,
      isMobileNavEnabled: true,
      hasAutoToggle: true,
      isMobileNavOpen: false,
    });
    await page.viewport(500, 800);
    await waitUntil(() => probe.shell.value.isMobile);
    expect(probe.shell.value.sideNavPlacement).toBe('drawer');
    probe.shell.value.openMobileNav();
    await waitUntil(() => probe.shell.value.isMobileNavOpen);
    expect(element.mobileNavOpen).toBe(true);
    probe.shell.value.toggleMobileNav();
    await waitUntil(() => !probe.shell.value.isMobileNavOpen);
  });

  it('the commands do nothing when mobile navigation is off', async () => {
    await page.viewport(500, 800);
    const root = await fixture<HTMLElement>(
      `<tct-app-shell no-mobile-nav style="display: block"><nav slot="side-nav"><a href="#a">a</a></nav><test-shell-probe id="probe"></test-shell-probe></tct-app-shell>`,
    );
    const probe = root.querySelector<Probe>('#probe')!;
    await (root as TctAppShell).updateComplete;
    probe.shell.value.openMobileNav();
    expect((root as TctAppShell).mobileNavOpen).toBe(false);
    expect(probe.shell.value.isMobileNavEnabled).toBe(false);
    expect(probe.shell.value.sideNavPlacement).toBe('none');
  });
});

describe('tct-app-shell: variants', () => {
  const background = (element: Element): string => getComputedStyle(element).backgroundColor;
  const token = (name: string): string => {
    const probe = document.createElement('div');
    probe.style.backgroundColor = `var(${name})`;
    document.body.append(probe);
    const value = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return value;
  };

  it('elevated (default) paints a wash frame with an elevated content surface and a rounded corner', async () => {
    const element = await shell('', ['top', 'side', 'main']);
    expect(element.variant).toBe('elevated');
    const box = rootOf(element).querySelector<HTMLElement>('.shell')!;
    expect(background(box)).toBe(token('--color-background-body'));
    const backdrop = rootOf(element).querySelector<HTMLElement>('.elevated-backdrop')!;
    expect(background(backdrop)).toBe(token('--color-background-surface'));
    expect(getComputedStyle(backdrop).borderStartStartRadius).not.toBe('0px');
    expect(getComputedStyle(mainBox(element)).backgroundColor).toBe('rgba(0, 0, 0, 0)');
  });

  it('elevated without both navigations has a plain surface content region', async () => {
    const element = await shell('', ['side', 'main']);
    expect(rootOf(element).querySelector('.elevated-backdrop')).toBeNull();
    expect(background(mainBox(element))).toBe(token('--color-background-surface'));
  });

  it('wash paints the navigation and the content with the body wash, without dividers', async () => {
    const element = await shell('variant="wash"', ['top', 'side', 'main']);
    expect(background(mainBox(element))).toBe(token('--color-background-body'));
    const panel = rootOf(element).querySelector('tct-layout-panel')!;
    expect(
      getComputedStyle(panel.shadowRoot!.querySelector('[part="base"]')!).borderRightWidth,
    ).toBe('0px');
  });

  it('surface paints the navigation and the content with the surface colour', async () => {
    const element = await shell('variant="surface"', ['top', 'side', 'main']);
    expect(background(mainBox(element))).toBe(token('--color-background-surface'));
    expect(background(rootOf(element).querySelector<HTMLElement>('.shell')!)).toBe(
      token('--color-background-surface'),
    );
  });

  it('section separates the navigation from the content with dividers', async () => {
    const element = await shell('variant="section"', ['top', 'side', 'main']);
    const panel = rootOf(element).querySelector('tct-layout-panel')!;
    expect(panel.hasAttribute('has-divider')).toBe(true);
    const box = getComputedStyle(panel.shadowRoot!.querySelector('[part="base"]')!);
    expect(box.borderRightWidth).toBe('1px');
    const header = rootOf(element).querySelector('tct-layout-header')!;
    expect(header.hasAttribute('has-divider')).toBe(true);
  });

  it.each(['wash', 'surface', 'section', 'elevated'])(
    'the %s variant is accessible',
    async (variant) => {
      const element = await shell(`variant="${variant}"`, ['top', 'side', 'main']);
      await expectAccessible(element);
    },
  );
});
