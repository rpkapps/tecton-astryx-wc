/**
 * tct-mobile-nav-toggle: renders only below the breakpoint with a mobile navigation, aria-expanded state,
 * asks before it acts (cancelable tct-open-change), returns focus from the drawer, custom icon
 * (ported from upstream MobileNavToggle.test.tsx).
 */
import {html} from 'lit';
import {afterEach, describe, expect, it} from 'vitest';
import {page} from 'vitest/browser';
import {deepActiveElement} from '@tecton-wc/core/utils/focus.js';
import {axNode} from '@tecton-wc/testing/a11y.js';
import {recordEvents} from '@tecton-wc/testing/events.js';
import {fixture} from '@tecton-wc/testing/fixture.js';
import {pressKeys} from '@tecton-wc/testing/keyboard.js';
import {runElementSuite} from '@tecton-wc/testing/suites/element.js';
import {waitUntil} from '@tecton-wc/testing/timing.js';
import '../app-shell/define.js';
import './define.js';
import type {TctAppShell} from '../app-shell/tct-app-shell.js';
import type {TctMobileNavToggle} from './tct-mobile-nav-toggle.js';

afterEach(async () => {
  await page.viewport(414, 896);
});

runElementSuite({
  tag: 'tct-mobile-nav-toggle',
  render: () => html`<tct-mobile-nav-toggle label="Menu"></tct-mobile-nav-toggle>`,
  properties: {label: 'Menu'},
});

const buttonOf = (toggle: Element): HTMLElement | null =>
  toggle.shadowRoot!.querySelector<HTMLElement>('tct-button');
const innerButton = (toggle: Element): HTMLButtonElement =>
  buttonOf(toggle)!.shadowRoot!.querySelector('button')!;

async function shell(attributes = '', width = 500) {
  await page.viewport(width, 800);
  const root = await fixture<HTMLElement>(
    `<tct-app-shell ${attributes} style="block-size: 600px">
      <nav slot="side-nav" aria-label="Sections"><a href="#one">One</a></nav>
      <div slot="top-nav"><tct-mobile-nav-toggle id="toggle"></tct-mobile-nav-toggle></div>
      <p>Content</p>
    </tct-app-shell>`,
  );
  const element = root as TctAppShell;
  const toggle = element.querySelector<TctMobileNavToggle>('#toggle')!;
  await element.updateComplete;
  await toggle.updateComplete;
  return {shell: element, toggle};
}

describe('tct-mobile-nav-toggle', () => {
  it('renders nothing outside an app shell', async () => {
    const toggle = await fixture<TctMobileNavToggle>(
      `<tct-mobile-nav-toggle></tct-mobile-nav-toggle>`,
    );
    expect(buttonOf(toggle)).toBeNull();
    expect(toggle.isRendered).toBe(false);
  });

  it('renders nothing above the mobile breakpoint, and a button below it', async () => {
    const wide = await shell('', 900);
    expect(buttonOf(wide.toggle)).toBeNull();
    const narrow = await shell('', 500);
    expect(buttonOf(narrow.toggle)).not.toBeNull();
  });

  it('renders nothing when the shell has no mobile navigation', async () => {
    const {toggle} = await shell('no-mobile-nav', 500);
    expect(buttonOf(toggle)).toBeNull();
  });

  it('is a named ghost icon button ("Open navigation") that follows the label', async () => {
    const {toggle} = await shell();
    const node = await axNode(innerButton(toggle));
    expect(node.role).toBe('button');
    expect(node.name).toBe('Open navigation');
    toggle.label = 'Menu';
    await toggle.updateComplete;
    await waitUntil(() => buttonOf(toggle)!.getAttribute('label') === 'Menu');
    expect(buttonOf(toggle)!.getAttribute('variant')).toBe('ghost');
    expect(buttonOf(toggle)!.hasAttribute('icon-only')).toBe(true);
    expect(buttonOf(toggle)!.getAttribute('icon')).toBe('menu');
  });

  it('exposes aria-expanded false when the drawer is closed and true after opening it', async () => {
    const {toggle, shell: element} = await shell();
    expect(await axNode(innerButton(toggle))).toMatchObject({expanded: 'false'});
    innerButton(toggle).click();
    await element.updateComplete;
    await toggle.updateComplete;
    await waitUntil(() => element.mobileNavOpen);
    // (While the modal drawer is open the page behind it, the toggle included, is inert.)
    await waitUntil(() => buttonOf(toggle)?.getAttribute('aria-expanded') === 'true');
    await waitUntil(() => innerButton(toggle).getAttribute('aria-expanded') === 'true');
  });

  it('asks before it acts: a cancelable tct-open-change with reason "trigger", and toggles unless prevented', async () => {
    const {toggle, shell: element} = await shell();
    const events = recordEvents(element, ['tct-open-change']);
    element.addEventListener('tct-open-change', (event) => {
      event.preventDefault();
    });
    innerButton(toggle).click();
    expect(events.events.map((event) => [event.open, event.reason])).toEqual([[true, 'trigger']]);
    expect(events.events[0]!.cancelable).toBe(true);
    expect(element.mobileNavOpen).toBe(false);
  });

  it('opens the drawer and focus returns to the toggle when the drawer closes with Escape', async () => {
    const {toggle, shell: element} = await shell();
    innerButton(toggle).focus();
    await pressKeys('Enter');
    await waitUntil(() => element.mobileNavOpen);
    const nav = element.shadowRoot!.querySelector('tct-mobile-nav')!;
    await waitUntil(() => nav.shadowRoot!.querySelector('dialog')!.open);
    await pressKeys('Escape');
    await waitUntil(() => !element.mobileNavOpen);
    await waitUntil(() => deepActiveElement() === innerButton(toggle));
  });

  it('a custom icon replaces the hamburger', async () => {
    await page.viewport(500, 800);
    const root = await fixture<HTMLElement>(
      `<tct-app-shell><nav slot="side-nav"><a href="#a">a</a></nav><div slot="top-nav"><tct-mobile-nav-toggle id="t"><span id="glyph">≡</span></tct-mobile-nav-toggle></div></tct-app-shell>`,
    );
    const toggle = root.querySelector<TctMobileNavToggle>('#t')!;
    await (root as TctAppShell).updateComplete;
    await toggle.updateComplete;
    expect(buttonOf(toggle)!.getAttribute('icon')).toBe('');
    expect(toggle.shadowRoot!.querySelector('slot')).not.toBeNull();
  });
});
