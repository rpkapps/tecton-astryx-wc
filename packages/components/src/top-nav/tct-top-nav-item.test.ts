/**
 * tct-top-nav-item: the link pill of the bar, the current page, the disabled state (an anchor without a
 * destination), icon-only items, the default slot, routing through a link provider, forced colours
 * (ported from the upstream TopNavItem tests).
 */
import {html} from 'lit';
import {describe, expect, it} from 'vitest';
import {page, userEvent} from 'vitest/browser';
import {axNode, expectAccessible} from '@tecton-wc/testing/a11y.js';
import {emulateMedia} from '@tecton-wc/testing/emulate.js';
import {recordEvents} from '@tecton-wc/testing/events.js';
import {fixture} from '@tecton-wc/testing/fixture.js';
import {runElementSuite} from '@tecton-wc/testing/suites/element.js';
import {animationsFinished, nextFrame} from '@tecton-wc/testing/timing.js';
import '../link/define.js';
import './define.js';
import type {TctTopNavItem} from './tct-top-nav-item.js';

runElementSuite({
  tag: 'tct-top-nav-item',
  render: () => html`<tct-top-nav-item label="Home" href="#"></tct-top-nav-item>`,
  properties: {
    label: 'Docs',
    href: '#docs',
    target: '_blank',
    rel: 'nofollow',
    referrerPolicy: 'no-referrer',
    selected: true,
    disabled: true,
    iconOnly: true,
    icon: 'search',
    size: 'lg',
  },
  attributes: {
    label: 'label',
    href: 'href',
    target: 'target',
    rel: 'rel',
    referrerPolicy: 'referrer-policy',
    selected: 'selected',
    disabled: 'disabled',
    iconOnly: 'icon-only',
    icon: 'icon',
    size: 'size',
  },
});

async function item(attributes = '', content = ''): Promise<TctTopNavItem> {
  await page.viewport(1000, 700);
  const bar = await fixture<HTMLElement>(
    `<tct-top-nav><tct-top-nav-item id="i" ${attributes}>${content}</tct-top-nav-item></tct-top-nav>`,
  );
  const element = bar.querySelector<TctTopNavItem>('#i')!;
  await element.updateComplete;
  await nextFrame();
  return element;
}

const link = (element: Element): HTMLAnchorElement =>
  element.shadowRoot!.querySelector<HTMLAnchorElement>('.item')!;

describe('tct-top-nav-item', () => {
  it('renders the label as text in an anchor', async () => {
    const element = await item('label="Home" href="#home"');
    expect(link(element).localName).toBe('a');
    expect(link(element).getAttribute('href')).toBe('#home');
    expect(link(element).textContent).toContain('Home');
    expect(await axNode(link(element))).toMatchObject({role: 'link', name: 'Home'});
  });

  it('renders the default slot instead of the label', async () => {
    const element = await item('label="Home" href="#home"', '<b id="custom">Custom</b>');
    expect(element.shadowRoot!.querySelector<HTMLSlotElement>('slot:not([name])')!.assignedElements()[0]!.id).toBe(
      'custom',
    );
    expect(link(element).textContent).not.toContain('Home');
  });

  it('marks the current page with aria-current="page", and only then', async () => {
    const current = await item('label="Home" href="#home" selected');
    expect(link(current).getAttribute('aria-current')).toBe('page');
    const other = await item('label="Docs" href="#docs"');
    expect(link(other).hasAttribute('aria-current')).toBe(false);
  });

  it('a disabled item is an anchor without a destination, out of the tab order, that never navigates', async () => {
    const element = await item('label="Docs" href="#docs" target="_blank" disabled');
    const anchor = link(element);
    expect(anchor.hasAttribute('href')).toBe(false);
    expect(anchor.hasAttribute('target')).toBe(false);
    expect(anchor.getAttribute('aria-disabled')).toBe('true');
    expect(anchor.tabIndex).toBe(-1);
    const events = recordEvents(element, ['click']);
    anchor.click();
    expect(events.named('click').length).toBe(0);
    await expectAccessible(element);
  });

  it('keeps the destination, the target and the download for an enabled item', async () => {
    const element = await item('label="Docs" href="#docs" target="_blank" download="file.txt"');
    const anchor = link(element);
    expect(anchor.getAttribute('target')).toBe('_blank');
    expect(anchor.getAttribute('rel')).toBe('noopener noreferrer');
    expect(anchor.getAttribute('download')).toBe('file.txt');
  });

  it('an icon-only item shows the icon, hides the label and is named by it', async () => {
    const element = await item('label="Search" href="#s" icon="search" icon-only');
    expect(element.shadowRoot!.querySelector('tct-icon')!.getAttribute('name')).toBe('search');
    expect(link(element).querySelector('.nav-row-label')).toBeNull();
    expect(await axNode(link(element))).toMatchObject({role: 'link', name: 'Search'});
  });

  it('shows an icon beside the label, or a custom icon from the icon slot', async () => {
    const element = await item(
      'label="Home" href="#h"',
      '<svg slot="icon" id="glyph" width="16" height="16"></svg>',
    );
    expect(element.shadowRoot!.querySelector<HTMLSlotElement>('slot[name="icon"]')!.assignedElements()[0]!.id).toBe(
      'glyph',
    );
  });

  it('a javascript: destination renders no href', async () => {
    const element = await item('label="Bad" href="javascript:alert(1)"');
    expect(link(element).hasAttribute('href')).toBe(false);
  });

  it('hands an unmodified click on an internal link to the router of a link provider', async () => {
    await page.viewport(1000, 700);
    const wrapper = await fixture<HTMLElement>(
      `<tct-link-provider><tct-top-nav><tct-top-nav-item id="i" label="One" href="/one"></tct-top-nav-item></tct-top-nav></tct-link-provider>`,
    );
    const calls: string[] = [];
    (wrapper as HTMLElement & {navigate?: (href: string) => boolean}).navigate = (href) => {
      calls.push(href);
      return true;
    };
    await userEvent.click(link(wrapper.querySelector('#i')!));
    expect(calls).toEqual(['/one']);
  });

  it('marks the current page with Highlight in forced colours', async () => {
    const element = await item('label="Home" href="#home" selected');
    await emulateMedia({forcedColors: 'active'});
    await nextFrame();
    await animationsFinished(link(element));
    const probe = document.createElement('div');
    probe.style.cssText = 'background: Highlight; color: HighlightText';
    document.body.append(probe);
    const expected = getComputedStyle(probe);
    const style = getComputedStyle(link(element));
    expect(style.backgroundColor).toBe(expected.backgroundColor);
    expect(style.color).toBe(expected.color);
    probe.remove();
  });

  it('is accessible in every state', async () => {
    await page.viewport(1000, 700);
    const bar = await fixture<HTMLElement>(
      `<tct-top-nav>
        <tct-top-nav-item label="Home" href="#home" selected></tct-top-nav-item>
        <tct-top-nav-item label="Docs" href="#docs"></tct-top-nav-item>
        <tct-top-nav-item label="Off" href="#off" disabled></tct-top-nav-item>
        <tct-top-nav-item label="Search" icon="search" icon-only href="#s"></tct-top-nav-item>
      </tct-top-nav>`,
    );
    await expectAccessible(bar);
  });
});
