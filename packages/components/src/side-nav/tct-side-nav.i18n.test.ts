/**
 * i18n of the side navigation: the landmark, the collapse button, the resize handle and the heading menu button
 * come from the catalogs in the language of the page (`de-DE`, `ar-SA`, which is right-to-left), lazily
 * loaded; an attribute of your own still wins.
 */
import {describe, expect, it} from 'vitest';
import {page} from 'vitest/browser';
import {axNode} from '@tecton-wc/testing/a11y.js';
import {fixture} from '@tecton-wc/testing/fixture.js';
import {nextFrame} from '@tecton-wc/testing/timing.js';
import '../nav-icon/define.js';
import './define.js';
import type {TctSideNav} from './tct-side-nav.js';

const CONTENT = `
  <tct-side-nav-heading slot="header" heading="Acme" id="heading">
    <div slot="menu"><a href="#one">One</a></div>
  </tct-side-nav-heading>
  <tct-side-nav-item id="dash" label="Dashboard" icon="viewColumns" href="#d"></tct-side-nav-item>
`;

async function nav(attributes: string, lang: string, dir?: 'rtl'): Promise<TctSideNav> {
  await page.viewport(1000, 700);
  const wrapper = await fixture<HTMLElement>(
    `<div style="block-size: 500px"><tct-side-nav ${attributes}>${CONTENT}</tct-side-nav></div>`,
    {lang, dir},
  );
  const element = wrapper.querySelector('tct-side-nav')!;
  await element.updateComplete;
  await nextFrame();
  return element;
}

const navBox = (element: TctSideNav): HTMLElement =>
  element.shadowRoot!.querySelector<HTMLElement>('nav.root')!;
const collapseButton = (element: TctSideNav): HTMLElement =>
  element
    .shadowRoot!.querySelector('tct-side-nav-collapse-button')!
    .shadowRoot!.querySelector('tct-button')!
    .shadowRoot!.querySelector<HTMLElement>('button')!;

/** Polls the accessible name until the catalog is loaded and rendered (the name is read asynchronously). */
async function waitForName(element: () => Element, expected: string, message: string): Promise<void> {
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

describe('side navigation i18n', () => {
  it('lang="de-DE" names the landmark, the collapse button, the resize handle and the heading menu', async () => {
    const element = await nav('collapsible resizable', 'de-DE');
    await waitForName(() => navBox(element), 'Seitennavigation', 'the landmark is German');
    await waitForName(() => collapseButton(element), 'Seitenleiste einklappen', 'the button is German');
    await waitForName(
      () => element.shadowRoot!.querySelector('tct-resize-handle')!,
      'Seitenleiste anpassen',
      'the handle is German',
    );
    const heading = element.querySelector('tct-side-nav-heading')!;
    await waitForName(
      () => heading.shadowRoot!.querySelector<HTMLElement>('.chevron-btn')!,
      'Menü öffnen',
      'the heading menu button is German',
    );
  });

  it('lang="ar-SA" is right-to-left: the names are Arabic and the handle sits at the inline-end (left) edge', async () => {
    const element = await nav('collapsible resizable', 'ar-SA', 'rtl');
    await waitForName(() => navBox(element), 'التنقل الجانبي', 'the landmark is Arabic');
    await waitForName(() => collapseButton(element), 'طيّ الشريط الجانبي', 'the button is Arabic');
    const handle = element.shadowRoot!.querySelector('tct-resize-handle')!;
    await waitForName(() => handle, 'تغيير حجم الشريط الجانبي', 'the handle is Arabic');
    expect(handle.getBoundingClientRect().left).toBeLessThan(
      navBox(element).getBoundingClientRect().left + 8,
    );
  });

  it('a label, a collapse-button-label and a resize-label of your own win over the catalog', async () => {
    const element = await nav(
      'collapsible resizable label="Bereiche" collapse-button-label="Zuklappen" resize-label="Breite"',
      'de-DE',
    );
    await waitForName(() => navBox(element), 'Bereiche', 'the label wins');
    await waitForName(() => collapseButton(element), 'Zuklappen', 'the button label wins');
    await waitForName(() => element.shadowRoot!.querySelector('tct-resize-handle')!, 'Breite', 'the handle label wins');
  });
});
