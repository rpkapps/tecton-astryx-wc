/**
 * The side navigation inside a tct-app-shell: inline at 768px and wider, the content of the mobile drawer
 * below it (767px), the render mode shared with the shell, and a drawer that closes when a link or a button
 * item is chosen.
 */
import {afterEach, describe, expect, it} from 'vitest';
import {page, userEvent} from 'vitest/browser';
import {axNode, expectAccessible} from '@tecton-wc/testing/a11y.js';
import {fixture} from '@tecton-wc/testing/fixture.js';
import {animationsFinished, nextFrame, waitUntil} from '@tecton-wc/testing/timing.js';
import '../app-shell/define.js';
import '../nav-icon/define.js';
import './define.js';
import type {TctAppShell} from '../app-shell/tct-app-shell.js';
import type {TctSideNav} from './tct-side-nav.js';

afterEach(async () => {
  await page.viewport(1000, 700);
});

const SIDE = `
  <tct-side-nav slot="side-nav" id="side" collapsible resizable>
    <tct-side-nav-heading slot="header" heading="Acme" id="heading"></tct-side-nav-heading>
    <tct-side-nav-section heading="Main">
      <tct-side-nav-item id="dash" label="Dashboard" icon="viewColumns" href="#dash" selected></tct-side-nav-item>
      <tct-side-nav-item id="action" label="Export" icon="funnel"></tct-side-nav-item>
      <tct-side-nav-item id="group" label="Reports" icon="viewColumns" collapsed>
        <tct-side-nav-item id="sub" label="Monthly" href="#monthly"></tct-side-nav-item>
      </tct-side-nav-item>
    </tct-side-nav-section>
  </tct-side-nav>`;

async function shell(width: number): Promise<TctAppShell> {
  await page.viewport(width, 700);
  const element = await fixture<TctAppShell>(
    `<tct-app-shell no-landmarks style="--app-shell-height: 500px">${SIDE}<p>Main content</p></tct-app-shell>`,
  );
  await element.updateComplete;
  await nextFrame();
  await nextFrame();
  return element;
}

const side = (element: Element): TctSideNav => element.querySelector<TctSideNav>('#side')!;
const drawerOf = (element: Element): HTMLElement =>
  element.shadowRoot!.querySelector<HTMLElement>('tct-mobile-nav')!;
const isDrawerOpen = (element: Element): boolean =>
  drawerOf(element).shadowRoot!.querySelector('dialog')?.hasAttribute('open') ?? false;
const inner = (element: Element, selector: string): HTMLElement =>
  element.shadowRoot!.querySelector<HTMLElement>(selector)!;

async function openDrawer(element: TctAppShell): Promise<void> {
  const toggle = element.shadowRoot!.querySelector('tct-mobile-nav-toggle')!;
  await userEvent.click(toggle.shadowRoot!.querySelector('tct-button')!);
  await waitUntil(() => isDrawerOpen(element), 'the drawer opens');
  await animationsFinished(drawerOf(element).shadowRoot!.querySelector('dialog')!);
}

describe('tct-side-nav inside tct-app-shell', () => {
  it('is the inline navigation at 768px, with the collapse button and the resize handle', async () => {
    const element = await shell(768);
    expect(element.isMobile).toBe(false);
    expect(side(element).shadowRoot!.querySelector('nav.root')).not.toBeNull();
    expect(side(element).shadowRoot!.querySelector('tct-side-nav-collapse-button')).not.toBeNull();
    expect(side(element).shadowRoot!.querySelector('tct-resize-handle')).not.toBeNull();
    expect(side(element).getBoundingClientRect().width).toBeGreaterThan(0);
    expect(element.shadowRoot!.querySelector('tct-mobile-nav-toggle')).toBeNull();
  });

  it('is the content of the mobile drawer at 767px: no collapse button, no resize handle', async () => {
    const element = await shell(767);
    expect(element.isMobile).toBe(true);
    expect(side(element).getBoundingClientRect().width).toBe(0);
    await openDrawer(element);
    const nav = side(element);
    expect(nav.shadowRoot!.querySelector('tct-side-nav-collapse-button')).toBeNull();
    expect(nav.shadowRoot!.querySelector('tct-resize-handle')).toBeNull();
    expect(nav.getBoundingClientRect().width).toBeGreaterThan(0);
    expect(await axNode(nav.shadowRoot!.querySelector('nav')!)).toMatchObject({
      role: 'navigation',
      name: 'Side navigation',
    });
    // The items are full rows there, never the icon rail.
    expect(nav.isCollapsed).toBe(false);
    await expectAccessible(element);
  });

  it('follows the viewport across the breakpoint: inline again at 768px, the drawer at 767px', async () => {
    const element = await shell(768);
    await page.viewport(767, 700);
    await waitUntil(() => element.isMobile, 'the shell turns mobile');
    await nextFrame();
    expect(side(element).getBoundingClientRect().width).toBe(0);
    await page.viewport(768, 700);
    await waitUntil(() => !element.isMobile, 'the shell is wide again');
    await nextFrame();
    expect(side(element).getBoundingClientRect().width).toBeGreaterThan(0);
  });

  it('choosing a link item closes the drawer', async () => {
    const element = await shell(767);
    await openDrawer(element);
    const link = inner(element.querySelector('#dash')!, 'a.item, a');
    await userEvent.click(link);
    await waitUntil(() => !isDrawerOpen(element), 'the drawer closes');
  });

  it('choosing a button item closes the drawer', async () => {
    const element = await shell(767);
    await openDrawer(element);
    await userEvent.click(inner(element.querySelector('#action')!, 'button.item, button'));
    await waitUntil(() => !isDrawerOpen(element), 'the drawer closes');
  });

  it('expanding a group of sub-items keeps the drawer open, and choosing a sub-item closes it', async () => {
    const element = await shell(767);
    await openDrawer(element);
    const group = element.querySelector('#group')!;
    await userEvent.click(inner(group, '.toggle, button'));
    await waitUntil(
      () => !(group as unknown as {collapsed: boolean}).collapsed,
      'the group expands',
    );
    await animationsFinished(group.shadowRoot!.querySelector('.root')!);
    expect(isDrawerOpen(element)).toBe(true);
    await userEvent.click(inner(element.querySelector('#sub')!, 'a'));
    await waitUntil(() => !isDrawerOpen(element), 'the drawer closes');
  });
});
