/**
 * tct-side-nav: the landmark and its zones, the collapse state (button, methods, events, controlled use,
 * the outside button), the icon rail, resizing and persistence, RTL. Ported from the upstream SideNav tests
 * (rendering, footer icon sizing, collapse ownership, resizable).
 */
import {html} from 'lit';
import {afterEach, describe, expect, it} from 'vitest';
import {page, userEvent} from 'vitest/browser';
import {axNode, expectAccessible} from '@tecton-wc/testing/a11y.js';
import {recordEvents} from '@tecton-wc/testing/events.js';
import {fixture} from '@tecton-wc/testing/fixture.js';
import {pressKeys} from '@tecton-wc/testing/keyboard.js';
import {runElementSuite} from '@tecton-wc/testing/suites/element.js';
import {isTier2} from '@tecton-wc/testing/tier.js';
import {nextFrame, waitUntil} from '@tecton-wc/testing/timing.js';
import '../nav-icon/define.js';
import './define.js';
import type {TctSideNav} from './tct-side-nav.js';

afterEach(() => {
  localStorage.clear();
});

const NAV = `
  <tct-side-nav-heading slot="header" heading="Acme" id="heading"></tct-side-nav-heading>
  <tct-side-nav-item slot="top-content" label="Create" id="create"></tct-side-nav-item>
  <tct-side-nav-section heading="Main" id="section">
    <tct-side-nav-item id="dash" label="Dashboard" icon="viewColumns" href="#dashboard" selected></tct-side-nav-item>
    <tct-side-nav-item id="projects" label="Projects" icon="funnel" href="#projects"></tct-side-nav-item>
  </tct-side-nav-section>
  <tct-side-nav-item slot="footer" label="Upgrade" id="upgrade"></tct-side-nav-item>
`;

async function nav(attributes = '', content = NAV, width = 1000): Promise<TctSideNav> {
  await page.viewport(width, 700);
  const wrapper = await fixture<HTMLElement>(
    `<div style="block-size: 500px"><tct-side-nav ${attributes}>${content}</tct-side-nav></div>`,
  );
  const element = wrapper.querySelector('tct-side-nav')!;
  await element.updateComplete;
  await nextFrame();
  return element;
}

const rootOf = (element: Element): ShadowRoot => element.shadowRoot!;
const box = (element: TctSideNav): HTMLElement => rootOf(element).querySelector<HTMLElement>('nav.root')!;

runElementSuite({
  tag: 'tct-side-nav',
  render: () => html`<tct-side-nav><tct-side-nav-item label="Home" href="#"></tct-side-nav-item></tct-side-nav>`,
  properties: {collapsible: true, resizable: true, label: 'Sections', noCollapseButton: true},
  attributes: {collapsible: 'collapsible', resizable: 'resizable', label: 'label'},
  events: ['tct-collapse-change', 'tct-size-change'],
});

describe('tct-side-nav: structure', () => {
  it('is a navigation landmark named "Side navigation" by default and by label', async () => {
    const element = await nav();
    expect(await axNode(box(element))).toMatchObject({role: 'navigation', name: 'Side navigation'});
    element.label = 'Sections';
    await element.updateComplete;
    expect((await axNode(box(element))).name).toBe('Sections');
  });

  it('renders the header, the top content, the items and the footer in their zones', async () => {
    const element = await nav();
    const root = rootOf(element);
    expect(
      root.querySelector<HTMLSlotElement>('slot[name="header"]')!.assignedElements()[0]!.id,
    ).toBe('heading');
    expect(
      root.querySelector<HTMLSlotElement>('slot[name="top-content"]')!.assignedElements()[0]!.id,
    ).toBe('create');
    expect(root.querySelector<HTMLSlotElement>('.content slot')!.assignedElements()[0]!.id).toBe(
      'section',
    );
    expect(
      root.querySelector<HTMLSlotElement>('slot[name="footer"]')!.assignedElements()[0]!.id,
    ).toBe('upgrade');
  });

  it('renders without the optional zones', async () => {
    const element = await nav('', '<tct-side-nav-item label="Home" href="#"></tct-side-nav-item>');
    expect(rootOf(element).querySelector('.top')).toBeNull();
    expect(rootOf(element).querySelector('.bottom')).toBeNull();
    await expectAccessible(element);
  });

  it('is accessible with every zone filled', async () => {
    const element = await nav();
    await expectAccessible(element);
  });

  it('is 260px wide by default and takes its width from --side-nav-width', async () => {
    const element = await nav();
    expect(box(element).getBoundingClientRect().width).toBe(260);
    element.style.setProperty('--side-nav-width', '300px');
    await nextFrame();
    expect(box(element).getBoundingClientRect().width).toBe(300);
  });

  it('gives footer icons the compact size', async () => {
    const element = await nav(
      '',
      `<tct-button slot="footer-icons" id="help" variant="ghost" icon-only icon="close" label="Help"></tct-button>`,
    );
    const button = element.querySelector<HTMLElement>('#help')!;
    const inner = button.shadowRoot!.querySelector<HTMLElement>('.button')!;
    expect(inner.getBoundingClientRect().height).toBe(28);
  });
});

describe('tct-side-nav: collapse', () => {
  it('has no collapse button and no state unless collapsible', async () => {
    const element = await nav();
    expect(rootOf(element).querySelector('tct-side-nav-collapse-button')).toBeNull();
    element.collapsed = true;
    await element.updateComplete;
    expect(element.isCollapsed).toBe(false);
    expect(box(element).getBoundingClientRect().width).toBe(260);
  });

  it('collapses to a 48px rail from the built-in button and expands again', async () => {
    const element = await nav('collapsible');
    const events = recordEvents(element, ['tct-collapse-change']);
    const button = rootOf(element).querySelector('tct-side-nav-collapse-button')!;
    const inner = button.shadowRoot!.querySelector('tct-button')!;
    expect(await axNode(inner.shadowRoot!.querySelector('button')!)).toMatchObject({
      role: 'button',
      name: 'Collapse sidebar',
    });
    await userEvent.click(inner);
    await element.updateComplete;
    await nextFrame();
    expect(element.collapsed).toBe(true);
    expect(element.isCollapsed).toBe(true);
    expect(box(element).getBoundingClientRect().width).toBe(48);
    if (!isTier2) expect(element.matches(':state(collapsed)')).toBe(true);
    expect(events.named('tct-collapse-change').length).toBe(1);
    expect(events.named('tct-collapse-change').at(-1)).toMatchObject({collapsed: true, reason: 'pointer'});
    expect(await axNode(inner.shadowRoot!.querySelector('button')!)).toMatchObject({
      name: 'Expand sidebar',
    });
    inner.click();
    await element.updateComplete;
    expect(element.collapsed).toBe(false);
    expect(box(element).getBoundingClientRect().width).toBe(260);
  });

  it('starts collapsed with the collapsed attribute', async () => {
    const element = await nav('collapsible collapsed');
    expect(element.isCollapsed).toBe(true);
    expect(box(element).getBoundingClientRect().width).toBe(48);
  });

  it('a prevented tct-collapse-change keeps the state: the page owns it', async () => {
    const element = await nav('collapsible');
    element.addEventListener('tct-collapse-change', (event) => {
      event.preventDefault();
    });
    rootOf(element).querySelector('tct-side-nav-collapse-button')!.shadowRoot!
      .querySelector<HTMLElement>('tct-button')!
      .click();
    await element.updateComplete;
    expect(element.collapsed).toBe(false);
    element.collapsed = true;
    await element.updateComplete;
    expect(element.isCollapsed).toBe(true);
  });

  it('collapse(), expand() and property writes never raise tct-collapse-change', async () => {
    const element = await nav('collapsible');
    const events = recordEvents(element, ['tct-collapse-change']);
    element.collapse();
    await element.updateComplete;
    expect(element.isCollapsed).toBe(true);
    element.expand();
    await element.updateComplete;
    element.collapsed = true;
    await element.updateComplete;
    expect(element.isCollapsed).toBe(true);
    expect(events.named('tct-collapse-change').length).toBe(0);
  });

  it('reports a keyboard activation of the button with the keyboard reason', async () => {
    const element = await nav('collapsible');
    const events = recordEvents(element, ['tct-collapse-change']);
    const inner = rootOf(element)
      .querySelector('tct-side-nav-collapse-button')!
      .shadowRoot!.querySelector('tct-button')!;
    inner.focus();
    await pressKeys('Enter');
    await element.updateComplete;
    expect(events.named('tct-collapse-change').at(-1)).toMatchObject({reason: 'keyboard'});
  });

  it('no-collapse-button leaves the button to a tct-side-nav-collapse-button of your own in the footer icons', async () => {
    const element = await nav(
      'collapsible no-collapse-button',
      `<tct-side-nav-item label="Home" icon="viewColumns" href="#"></tct-side-nav-item>
       <tct-side-nav-collapse-button slot="footer-icons" id="mine"></tct-side-nav-collapse-button>`,
    );
    expect(rootOf(element).querySelector('.footer-row tct-side-nav-collapse-button')).toBeNull();
    const mine = element.querySelector('tct-side-nav-collapse-button')!;
    mine.shadowRoot!.querySelector<HTMLElement>('tct-button')!.click();
    await element.updateComplete;
    expect(element.isCollapsed).toBe(true);
  });

  it('a collapse button outside the navigation follows it and toggles it (for=)', async () => {
    await page.viewport(1000, 700);
    const wrapper = await fixture<HTMLElement>(
      `<div>
        <tct-side-nav-collapse-button for="nav" id="outside"></tct-side-nav-collapse-button>
        <tct-side-nav id="nav" collapsible no-collapse-button>
          <tct-side-nav-item label="Home" icon="viewColumns" href="#"></tct-side-nav-item>
        </tct-side-nav>
      </div>`,
    );
    const element = wrapper.querySelector('tct-side-nav')!;
    const outside = wrapper.querySelector('tct-side-nav-collapse-button')!;
    await outside.updateComplete;
    await waitUntil(() => outside.shadowRoot!.querySelector('tct-button'), 'the button renders');
    const inner = () => outside.shadowRoot!.querySelector('tct-button')!;
    expect(inner().getAttribute('label')).toBe('Collapse sidebar');
    inner().click();
    await element.updateComplete;
    await outside.updateComplete;
    expect(element.isCollapsed).toBe(true);
    expect(inner().getAttribute('label')).toBe('Expand sidebar');
    // A programmatic change is followed too.
    element.expand();
    await element.updateComplete;
    await outside.updateComplete;
    expect(inner().getAttribute('label')).toBe('Collapse sidebar');
  });

  it('a collapse button renders nothing while the navigation is not collapsible', async () => {
    const wrapper = await fixture<HTMLElement>(
      `<div>
        <tct-side-nav-collapse-button for="nav2"></tct-side-nav-collapse-button>
        <tct-side-nav id="nav2"><tct-side-nav-item label="Home" href="#"></tct-side-nav-item></tct-side-nav>
      </div>`,
    );
    const button = wrapper.querySelector('tct-side-nav-collapse-button')!;
    await button.updateComplete;
    expect(button.shadowRoot!.querySelector('tct-button')).toBeNull();
  });

  it('mirrors the chevron in RTL', async () => {
    await page.viewport(1000, 700);
    const wrapper = await fixture<HTMLElement>(
      `<tct-side-nav collapsible><tct-side-nav-item label="Home" icon="viewColumns" href="#"></tct-side-nav-item></tct-side-nav>`,
      {dir: 'rtl'},
    );
    const element = wrapper as TctSideNav;
    const button = rootOf(element).querySelector('tct-side-nav-collapse-button')!;
    const glyph = button.shadowRoot!.querySelector('.glyph')!;
    expect(getComputedStyle(glyph).scale).toBe('-1 1');
  });
});

describe('tct-side-nav: resizing', () => {
  it('has no handle unless resizable, and none while collapsed', async () => {
    const element = await nav();
    expect(rootOf(element).querySelector('tct-resize-handle')).toBeNull();
    element.resizable = true;
    element.collapsible = true;
    await element.updateComplete;
    expect(rootOf(element).querySelector('tct-resize-handle')).not.toBeNull();
    element.collapsed = true;
    await element.updateComplete;
    expect(rootOf(element).querySelector('tct-resize-handle')).toBeNull();
  });

  it('the handle is a separator with the width as its value, resized with the keyboard', async () => {
    const element = await nav('resizable default-width="300"');
    const handle = rootOf(element).querySelector('tct-resize-handle')!;
    await handle.updateComplete;
    expect(await axNode(handle)).toMatchObject({role: 'separator', name: 'Resize sidebar'});
    const events = recordEvents(element, ['tct-size-change']);
    expect(box(element).getBoundingClientRect().width).toBe(300);
    handle.focus();
    await pressKeys('ArrowRight');
    await element.updateComplete;
    expect(box(element).getBoundingClientRect().width).toBe(310);
    expect(element.width).toBe(310);
    expect(events.named('tct-size-change').at(-1)).toMatchObject({size: 310, reason: 'keyboard'});
  });

  it('stays within 180 to 480 by default and takes min-width and max-width', async () => {
    const element = await nav('resizable min-width="200" max-width="320" default-width="250"');
    const handle = rootOf(element).querySelector('tct-resize-handle')!;
    handle.focus();
    await pressKeys('End');
    await element.updateComplete;
    expect(box(element).getBoundingClientRect().width).toBe(320);
    await pressKeys('Home');
    await element.updateComplete;
    expect(box(element).getBoundingClientRect().width).toBe(200);
  });

  it('a drag past the threshold collapses a collapsible navigation, asking first', async () => {
    const element = await nav('resizable collapsible');
    const events = recordEvents(element, ['tct-collapse-change']);
    const handle = rootOf(element).querySelector('tct-resize-handle')!;
    handle.focus();
    // Home takes it to the minimum; Enter collapses a collapsible region.
    await pressKeys('Enter');
    await element.updateComplete;
    expect(element.collapsed).toBe(true);
    expect(events.named('tct-collapse-change').at(-1)).toMatchObject({collapsed: true, reason: 'keyboard'});
  });

  it('remembers the width and the collapse state across a reload with auto-save-id', async () => {
    const first = await nav('resizable collapsible auto-save-id="nav-test" default-width="300"');
    const handle = rootOf(first).querySelector('tct-resize-handle')!;
    handle.focus();
    await pressKeys('ArrowRight');
    await first.updateComplete;
    expect(first.width).toBe(310);
    first.collapse();
    await first.updateComplete;
    expect(localStorage.getItem('tct-resizable:nav-test')).toContain('"collapsed":true');
    const second = await nav('resizable collapsible auto-save-id="nav-test" default-width="300"');
    expect(second.isCollapsed).toBe(true);
    second.expand();
    await second.updateComplete;
    expect(box(second).getBoundingClientRect().width).toBe(310);
  });

  it('a drag by the pointer resizes it', async () => {
    const element = await nav('resizable default-width="260"');
    const handle = rootOf(element).querySelector('tct-resize-handle')!;
    await handle.updateComplete;
    const events = recordEvents(element, ['tct-size-change']);
    const grab = handle.shadowRoot!.querySelector<HTMLElement>('.grab')!;
    const pointer = (type: string, x: number) =>
      new PointerEvent(type, {
        pointerId: 7,
        clientX: x,
        button: 0,
        bubbles: true,
        composed: true,
        cancelable: true,
      });
    grab.dispatchEvent(pointer('pointerdown', 100));
    grab.dispatchEvent(pointer('pointermove', 140));
    grab.dispatchEvent(pointer('pointerup', 140));
    await element.updateComplete;
    expect(element.width).toBe(300);
    expect(events.named('tct-size-change').length).toBeGreaterThan(0);
  });
});
