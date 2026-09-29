/** Shared helpers of the top navigation menu tests (not a test file: it is imported by them). */
import {page} from 'vitest/browser';
import {fixture} from '@tecton-wc/testing/fixture.js';
import {nextFrame} from '@tecton-wc/testing/timing.js';
import '../nav-icon/define.js';
import './define.js';
import type {TctTopNavDisclosure} from './tct-top-nav-disclosure.js';
import type {TctTopNav} from './tct-top-nav.js';

export const MENU_ITEMS = `
  <tct-top-nav-mega-menu-item id="analytics" heading="Analytics" description="Track behaviour" icon="funnel" href="#analytics"></tct-top-nav-mega-menu-item>
  <tct-top-nav-mega-menu-item id="messaging" heading="Messaging" description="Real-time" icon="wrench" href="#messaging"></tct-top-nav-mega-menu-item>
  <tct-top-nav-mega-menu-item id="reports" heading="Reports" href="#reports"></tct-top-nav-mega-menu-item>`;

/** A bar with two menus (or mega menus) around a plain item, and the page outside it. */
export async function menuBar(
  tag: 'tct-top-nav-menu' | 'tct-top-nav-mega-menu',
  options: {dir?: 'rtl'; theme?: 'light' | 'dark'; region?: 'start' | 'center' | 'end'; width?: number} = {},
): Promise<{bar: TctTopNav; first: TctTopNavDisclosure; second: TctTopNavDisclosure}> {
  await page.viewport(options.width ?? 1000, 700);
  const region = options.region && options.region !== 'start' ? ` slot="${options.region}"` : '';
  const element = await fixture<TctTopNav>(
    `<tct-top-nav label="Main">
      <tct-top-nav-heading slot="heading" heading="Acme"></tct-top-nav-heading>
      <${tag} id="first" label="Products"${region}>${MENU_ITEMS}</${tag}>
      <tct-top-nav-item id="plain" label="Docs" href="#docs"></tct-top-nav-item>
      <${tag} id="second" label="Solutions"${region}>${MENU_ITEMS}</${tag}>
    </tct-top-nav>`,
    {dir: options.dir, theme: options.theme},
  );
  await element.updateComplete;
  await nextFrame();
  return {
    bar: element,
    first: element.querySelector<TctTopNavDisclosure>('#first')!,
    second: element.querySelector<TctTopNavDisclosure>('#second')!,
  };
}

export const triggerOf = (menu: Element): HTMLButtonElement =>
  menu.shadowRoot!.querySelector<HTMLButtonElement>('.trigger')!;
export const layerOf = (menu: Element): HTMLElement =>
  menu.shadowRoot!.querySelector<HTMLElement>('.layer')!;
export const panelOf = (menu: Element): HTMLElement =>
  menu.shadowRoot!.querySelector<HTMLElement>('.panel')!;
export const isOpen = (menu: Element): boolean => layerOf(menu).matches(':popover-open');
/** The link or button inside a menu item element. */
export const linkOf = (item: Element): HTMLElement =>
  item.shadowRoot!.querySelector<HTMLElement>('.entry')!;
