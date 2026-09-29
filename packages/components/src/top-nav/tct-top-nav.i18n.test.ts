/**
 * i18n of the top navigation: the landmark and the heading menu button come from the catalogs in the
 * language of the page (`de-DE`, `ar-SA`, which is right-to-left), lazily loaded; the mega menu hangs from the
 * start edge in right-to-left text; a `label` of your own still wins.
 */
import {describe, expect, it} from 'vitest';
import {page} from 'vitest/browser';
import {axNode} from '@tecton-wc/testing/a11y.js';
import {fixture} from '@tecton-wc/testing/fixture.js';
import {animationsFinished, nextFrame} from '@tecton-wc/testing/timing.js';
import '../nav-icon/define.js';
import './define.js';
import type {TctTopNav} from './tct-top-nav.js';
import {isOpen, layerOf} from './top-nav-test-helpers.js';

const CONTENT = `
  <tct-top-nav-heading slot="heading" heading="Acme"><div slot="menu"><a href="#one">One</a></div></tct-top-nav-heading>
  <tct-top-nav-mega-menu id="products" label="Produkte">
    <tct-top-nav-mega-menu-item heading="Analytics" href="#a"></tct-top-nav-mega-menu-item>
  </tct-top-nav-mega-menu>
`;

async function bar(attributes: string, lang: string, dir?: 'rtl'): Promise<TctTopNav> {
  await page.viewport(1000, 700);
  const element = await fixture<TctTopNav>(`<tct-top-nav ${attributes}>${CONTENT}</tct-top-nav>`, {
    lang,
    dir,
  });
  await element.updateComplete;
  await nextFrame();
  return element;
}

const landmark = (element: TctTopNav): HTMLElement =>
  element.shadowRoot!.querySelector<HTMLElement>('nav')!;
const chevron = (element: TctTopNav): HTMLElement =>
  element
    .querySelector('tct-top-nav-heading')!
    .shadowRoot!.querySelector<HTMLElement>('.chevron-btn')!;

/** Polls the accessible name until the catalog is loaded and rendered (the name is read asynchronously). */
async function waitForName(
  element: () => Element,
  expected: string,
  message: string,
): Promise<void> {
  let name: string | undefined;
  const start = performance.now();
  while (name !== expected) {
    try {
      name = (await axNode(element())).name;
    } catch {
      name = undefined; // the element was replaced by a re-render
    }
    if (name === expected) break;
    if (performance.now() - start > 3000) break;
    await nextFrame();
  }
  expect(name, message).toBe(expected);
}

describe('top navigation i18n', () => {
  it('lang="de-DE" names the landmark and the heading menu button', async () => {
    const element = await bar('', 'de-DE');
    await waitForName(() => landmark(element), 'Obere Navigation', 'the landmark is German');
    await waitForName(() => chevron(element), 'Menü öffnen', 'the heading menu button is German');
  });

  it('lang="ar-SA" is right-to-left: the names are Arabic and the mega menu hangs from the right edge', async () => {
    const element = await bar('', 'ar-SA', 'rtl');
    await waitForName(() => landmark(element), 'التنقل العلوي', 'the landmark is Arabic');
    await waitForName(() => chevron(element), 'فتح القائمة', 'the heading menu button is Arabic');
    const menu = element.querySelector<HTMLElement & {show(): Promise<void>}>('#products')!;
    await menu.show();
    await animationsFinished(layerOf(menu));
    expect(isOpen(menu)).toBe(true);
    const anchor = element.anchorElement!.getBoundingClientRect();
    // The JS fallback keeps an 8px gutter to the viewport edge.
    expect(Math.abs(layerOf(menu).getBoundingClientRect().right - anchor.right)).toBeLessThan(10);
  });

  it('a label of your own wins over the catalog', async () => {
    const element = await bar('label="Hauptmenü"', 'de-DE');
    await waitForName(() => landmark(element), 'Hauptmenü', 'the label wins');
  });
});
