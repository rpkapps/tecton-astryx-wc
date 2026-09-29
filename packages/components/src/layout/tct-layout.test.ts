/**
 * tct-layout and its regions: slots, area and slot-presence context, dividers, padding collapse,
 * content width, height modes, scrolling (ported from upstream Layout.test.tsx, LayoutSlots.test.tsx and
 * the contentWidth tests, as geometry in a real browser), RTL.
 */
import {html} from 'lit';
import {describe, expect, it} from 'vitest';
import {expectAccessible} from '@tecton-wc/testing/a11y.js';
import {fixture} from '@tecton-wc/testing/fixture.js';
import {runElementSuite} from '@tecton-wc/testing/suites/element.js';
import '../card/define.js';
import './define.js';
import type {TctLayout} from './tct-layout.js';
import type {TctLayoutContent} from './tct-layout-content.js';
import type {TctLayoutFooter} from './tct-layout-footer.js';
import type {TctLayoutHeader} from './tct-layout-header.js';
import type {TctLayoutPanel} from './tct-layout-panel.js';

const baseOf = (element: Element): HTMLElement =>
  element.shadowRoot!.querySelector<HTMLElement>('[part~="base"]')!;
const pad = (element: Element) => {
  const style = getComputedStyle(element.shadowRoot!.querySelector('.base, .inner')!);
  return {
    top: parseFloat(style.paddingTop),
    end: parseFloat(style.paddingRight),
    bottom: parseFloat(style.paddingBottom),
    start: parseFloat(style.paddingLeft),
  };
};
const rect = (element: Element) => element.getBoundingClientRect();

/** A layout of a fixed size with every region. */
async function full(attributes = '', extra = '') {
  const root = await fixture<HTMLElement>(`<div style="block-size: 400px; inline-size: 600px">
    <tct-layout ${attributes}>
      <tct-layout-header slot="header" id="h">Header</tct-layout-header>
      <tct-layout-panel slot="start" id="s">Start</tct-layout-panel>
      <tct-layout-content id="c">${extra || 'Content'}</tct-layout-content>
      <tct-layout-panel slot="end" id="e">End</tct-layout-panel>
      <tct-layout-footer slot="footer" id="f">Footer</tct-layout-footer>
    </tct-layout>
  </div>`);
  return {
    root,
    layout: root.querySelector<TctLayout>('tct-layout')!,
    header: root.querySelector<TctLayoutHeader>('#h')!,
    start: root.querySelector<TctLayoutPanel>('#s')!,
    content: root.querySelector<TctLayoutContent>('#c')!,
    end: root.querySelector<TctLayoutPanel>('#e')!,
    footer: root.querySelector<TctLayoutFooter>('#f')!,
  };
}

runElementSuite({
  tag: 'tct-layout',
  render: () => html`<tct-layout><tct-layout-content>content</tct-layout-content></tct-layout>`,
  properties: {height: 'auto', padding: 2, contentWidth: 640},
  attributes: {height: 'height'},
});
runElementSuite({
  tag: 'tct-layout-header',
  render: () => html`<tct-layout-header>Header</tct-layout-header>`,
  properties: {hasDivider: true, label: 'Header', padding: 2},
});
runElementSuite({
  tag: 'tct-layout-footer',
  render: () => html`<tct-layout-footer>Footer</tct-layout-footer>`,
  properties: {hasDivider: true, label: 'Footer', padding: 2},
});
runElementSuite({
  tag: 'tct-layout-content',
  render: () => html`<tct-layout-content>Content</tct-layout-content>`,
  properties: {noScroll: true, padding: 2, focusable: true},
});
runElementSuite({
  tag: 'tct-layout-panel',
  render: () => html`<tct-layout-panel>Panel</tct-layout-panel>`,
  properties: {hasDivider: true, width: 240, noScroll: true},
});

describe('tct-layout: content and slots', () => {
  it('renders the content in the default slot and an empty shell without crashing', async () => {
    const root = await fixture<HTMLElement>(
      `<div style="block-size: 200px"><tct-layout><b id="x">Main</b></tct-layout></div>`,
    );
    const layout = root.querySelector('tct-layout')!;
    const slot = layout.shadowRoot!.querySelector<HTMLSlotElement>('.body slot')!;
    expect(slot.assignedElements().map((element) => element.id)).toEqual(['x']);
    const empty = await fixture<HTMLElement>(`<tct-layout></tct-layout>`);
    expect(empty.shadowRoot!.querySelector('[part="base"]')).not.toBeNull();
  });

  it('renders all four surrounding slots plus content, in order', async () => {
    const {layout, header, start, content, end, footer} = await full();
    const names = ['header', 'start', '', 'end', 'footer'];
    const slots = names.map((name) =>
      layout.shadowRoot!.querySelector<HTMLSlotElement>(
        name ? `slot[name="${name}"]` : '.body slot',
      )!,
    );
    expect(slots.map((slot) => slot.assignedElements()[0])).toEqual([
      header,
      start,
      content,
      end,
      footer,
    ]);
    // Header above the middle row, footer below it; start left of the content, end right of it (LTR).
    expect(rect(header).bottom).toBeLessThanOrEqual(rect(start).top + 1);
    expect(rect(footer).top).toBeGreaterThanOrEqual(rect(start).bottom - 1);
    expect(rect(start).right).toBeLessThanOrEqual(rect(content).left + 20);
    expect(rect(end).left).toBeGreaterThanOrEqual(rect(content).right - 1);
  });

  it('start and end swap in RTL', async () => {
    const root = await fixture<HTMLElement>(
      `<div style="block-size: 300px; inline-size: 600px"><tct-layout>
        <tct-layout-panel slot="start" id="s" width="100">S</tct-layout-panel>
        <tct-layout-content id="c">C</tct-layout-content>
        <tct-layout-panel slot="end" id="e" width="100">E</tct-layout-panel>
      </tct-layout></div>`,
      {dir: 'rtl'},
    );
    const [start, content, end] = ['#s', '#c', '#e'].map((selector) =>
      root.querySelector(selector)!,
    );
    expect(rect(start!).left).toBeGreaterThan(rect(content!).left);
    expect(rect(end!).right).toBeLessThan(rect(content!).right);
  });

  it('tags each slot with its area for the regions inside (layout area context)', async () => {
    const {start, end, header} = await full();
    expect(baseOf(start).dataset.area).toBe('start');
    expect(baseOf(end).dataset.area).toBe('end');
    // A header is not a panel: it has no area attribute of its own, but a panel placed in the
    // header slot would learn its area.
    expect(baseOf(header).dataset.area).toBeUndefined();
    const root = await fixture<HTMLElement>(
      `<div style="block-size: 200px"><tct-layout><tct-layout-panel id="p" slot="header">P</tct-layout-panel></tct-layout></div>`,
    );
    // Only start and end panels have an edge to draw a divider on.
    expect(baseOf(root.querySelector('#p')!).dataset.area).toBeUndefined();
  });

  it('reports which slots are filled to the regions inside', async () => {
    const {content} = await full();
    let base = baseOf(content);
    expect(base.hasAttribute('data-no-start')).toBe(false);
    expect(base.hasAttribute('data-no-header')).toBe(false);
    const only = await fixture<HTMLElement>(
      `<div style="block-size: 200px"><tct-layout><tct-layout-content id="c">C</tct-layout-content></tct-layout></div>`,
    );
    base = baseOf(only.querySelector('#c')!);
    for (const name of ['no-start', 'no-end', 'no-header', 'no-footer']) {
      expect(base.hasAttribute(`data-${name}`), name).toBe(true);
    }
  });

  it('follows a region that is added or removed later', async () => {
    const {root, content, header} = await full();
    header.remove();
    await new Promise((resolve) => setTimeout(resolve, 20));
    await content.updateComplete;
    expect(baseOf(content).hasAttribute('data-no-header')).toBe(true);
    const again = document.createElement('tct-layout-header');
    again.slot = 'header';
    root.querySelector('tct-layout')!.append(again);
    await new Promise((resolve) => setTimeout(resolve, 20));
    await content.updateComplete;
    expect(baseOf(content).hasAttribute('data-no-header')).toBe(false);
  });
});

describe('tct-layout: height', () => {
  it('reflects height and defaults to fill', async () => {
    const {layout} = await full();
    expect(layout.height).toBe('fill');
    expect(layout.getAttribute('height')).toBe('fill');
    layout.height = 'auto';
    await layout.updateComplete;
    expect(baseOf(layout).dataset.height).toBe('auto');
  });

  it('fill takes the height of its container and the content scrolls inside', async () => {
    const {root, layout, content} = await full('', '<div style="block-size: 1200px">tall</div>');
    expect(rect(layout).height).toBe(400);
    expect(rect(root).height).toBe(400);
    const box = baseOf(content);
    expect(getComputedStyle(box).overflowY).toBe('auto');
    expect(box.scrollHeight).toBeGreaterThan(box.clientHeight);
    // The scroller is a tab stop while it overflows and nothing inside is tabbable.
    expect(box.getAttribute('tabindex')).toBe('0');
  });

  it('auto grows with its content', async () => {
    const root = await fixture<HTMLElement>(
      `<div style="block-size: 200px"><tct-layout height="auto"><tct-layout-content no-scroll><div style="block-size: 500px">tall</div></tct-layout-content></tct-layout></div>`,
    );
    expect(rect(root.querySelector('tct-layout')!).height).toBeGreaterThanOrEqual(500);
  });

  it('no-scroll clips instead of scrolling and never becomes a tab stop', async () => {
    const root = await fixture<HTMLElement>(
      `<div style="block-size: 200px"><tct-layout><tct-layout-content no-scroll><div style="block-size: 800px">tall</div></tct-layout-content></tct-layout></div>`,
    );
    const box = baseOf(root.querySelector('tct-layout-content')!);
    expect(getComputedStyle(box).overflowY).toBe('clip');
    expect(box.hasAttribute('tabindex')).toBe(false);
  });
});

describe('tct-layout: dividers (defaultHasDividers)', () => {
  it('does not force dividers when default-has-dividers is unset', async () => {
    const {header, footer} = await full();
    expect(header.hasAttribute('data-divider')).toBe(false);
    expect(footer.hasAttribute('data-divider')).toBe(false);
    expect(header.resolvedHasDivider).toBe(false);
  });

  it('makes headers and footers default to having a divider', async () => {
    const {header, footer} = await full('default-has-dividers');
    expect(header.hasAttribute('data-divider')).toBe(true);
    expect(footer.hasAttribute('data-divider')).toBe(true);
    expect(getComputedStyle(baseOf(header)).borderBottomWidth).toBe('1px');
    expect(getComputedStyle(baseOf(footer)).borderTopWidth).toBe('1px');
  });

  it('an explicit has-divider false overrides the layout default', async () => {
    const {header, footer} = await full('default-has-dividers');
    header.hasDivider = false;
    await header.updateComplete;
    expect(header.hasAttribute('data-divider')).toBe(false);
    expect(footer.hasAttribute('data-divider')).toBe(true);
  });

  it('an explicit has-divider draws a divider without a layout default', async () => {
    const root = await fixture<HTMLElement>(
      `<div style="block-size: 200px"><tct-layout><tct-layout-header slot="header" has-divider>H</tct-layout-header><tct-layout-content>C</tct-layout-content></tct-layout></div>`,
    );
    const header = root.querySelector<TctLayoutHeader>('tct-layout-header')!;
    expect(header.getAttribute('data-divider')).toBe('');
    expect(getComputedStyle(baseOf(header)).borderBottomStyle).toBe('solid');
  });

  it('a nested layout inherits the default of the layout it is in, and its own wins', async () => {
    const root = await fixture<HTMLElement>(
      `<div style="block-size: 400px"><tct-layout default-has-dividers>
        <tct-layout-content>
          <div style="block-size: 150px"><tct-layout id="inner"><tct-layout-header slot="header" id="ih">H</tct-layout-header></tct-layout></div>
          <div style="block-size: 150px"><tct-layout id="own"><tct-layout-header slot="header" id="oh">H</tct-layout-header></tct-layout></div>
        </tct-layout-content></tct-layout></div>`,
    );
    const own = root.querySelector<TctLayout>('#own')!;
    expect(root.querySelector('#ih')!.hasAttribute('data-divider')).toBe(true);
    own.defaultHasDividers = false;
    await own.updateComplete;
    expect(root.querySelector('#oh')!.hasAttribute('data-divider')).toBe(false);
  });
});

describe('tct-layout: padding collapse between regions', () => {
  it('pads the content with the outer padding on edges that touch the layout', async () => {
    const root = await fixture<HTMLElement>(
      `<div style="block-size: 300px"><tct-layout><tct-layout-content>C</tct-layout-content></tct-layout></div>`,
    );
    expect(pad(root.querySelector('tct-layout-content')!)).toEqual({
      top: 16,
      end: 16,
      bottom: 16,
      start: 16,
    });
  });

  it('a header without a divider lets the content run into it; with a divider it does not', async () => {
    const {content, header} = await full();
    expect(pad(content).top).toBe(0);
    expect(pad(content).bottom).toBe(0);
    header.hasDivider = true;
    await header.updateComplete;
    await new Promise((resolve) => setTimeout(resolve, 20));
    await content.updateComplete;
    expect(pad(content).top).toBe(16);
  });

  it('uses the inner padding towards a panel and the outer padding on the other side', async () => {
    const root = await fixture<HTMLElement>(
      `<div style="block-size: 300px"><tct-layout>
        <tct-layout-panel slot="start" width="100">S</tct-layout-panel>
        <tct-layout-content id="c">C</tct-layout-content></tct-layout></div>`,
    );
    const p = pad(root.querySelector('#c')!);
    expect(p.start).toBe(16);
    expect(p.end).toBe(16);
  });

  it('collapses the spacing between a divider-less panel and the content', async () => {
    const root = await fixture<HTMLElement>(
      `<div style="block-size: 300px; inline-size: 600px"><tct-layout>
        <tct-layout-panel slot="start" id="s" width="100">S</tct-layout-panel>
        <tct-layout-content id="c">C</tct-layout-content></tct-layout></div>`,
    );
    const start = root.querySelector('#s')!;
    const content = root.querySelector('#c')!;
    // The panel keeps the width asked for; the content starts 16px into it.
    expect(rect(baseOf(start)).width).toBe(100);
    expect(rect(content).left).toBe(rect(baseOf(start)).right - 16);
  });

  it('a panel divider sits on the edge that faces the content, and nothing collapses', async () => {
    const root = await fixture<HTMLElement>(
      `<div style="block-size: 300px; inline-size: 600px"><tct-layout>
        <tct-layout-panel slot="start" id="s" width="100" has-divider>S</tct-layout-panel>
        <tct-layout-content id="c">C</tct-layout-content>
        <tct-layout-panel slot="end" id="e" width="100" has-divider>E</tct-layout-panel></tct-layout></div>`,
    );
    const s = getComputedStyle(baseOf(root.querySelector('#s')!));
    const e = getComputedStyle(baseOf(root.querySelector('#e')!));
    expect([s.borderRightWidth, s.borderLeftWidth]).toEqual(['1px', '0px']);
    expect([e.borderLeftWidth, e.borderRightWidth]).toEqual(['1px', '0px']);
    expect(rect(root.querySelector('#c')!).left).toBe(
      rect(baseOf(root.querySelector('#s')!)).right,
    );
  });

  it('the divider mirrors in RTL', async () => {
    const root = await fixture<HTMLElement>(
      `<div style="block-size: 300px; inline-size: 600px"><tct-layout>
        <tct-layout-panel slot="start" id="s" width="100" has-divider>S</tct-layout-panel>
        <tct-layout-content>C</tct-layout-content></tct-layout></div>`,
      {dir: 'rtl'},
    );
    const s = getComputedStyle(baseOf(root.querySelector('#s')!));
    expect([s.borderLeftWidth, s.borderRightWidth]).toEqual(['1px', '0px']);
  });

  it('the panel padding: outer edge, inner edge, top and bottom', async () => {
    const {start, end} = await full();
    // No header/footer padding difference for panels: top and bottom are the inner padding.
    expect(pad(start)).toEqual({top: 16, end: 16, bottom: 16, start: 16});
    expect(pad(end)).toEqual({top: 16, end: 16, bottom: 16, start: 16});
  });

  it('explicit padding wins per edge and 0 is edge to edge', async () => {
    const root = await fixture<HTMLElement>(
      `<div style="block-size: 300px"><tct-layout>
        <tct-layout-header slot="header" padding="0" id="h">H</tct-layout-header>
        <tct-layout-content padding="0" id="c">C</tct-layout-content>
        <tct-layout-footer slot="footer" padding="2" padding-block-end="0" id="f">F</tct-layout-footer>
      </tct-layout></div>`,
    );
    expect(pad(root.querySelector('#h')!)).toEqual({top: 0, end: 0, bottom: 0, start: 0});
    expect(pad(root.querySelector('#c')!)).toEqual({top: 0, end: 0, bottom: 0, start: 0});
    expect(pad(root.querySelector('#f')!)).toEqual({top: 8, end: 8, bottom: 0, start: 8});
  });

  it('the layout padding step sets the outer padding of every region', async () => {
    const root = await fixture<HTMLElement>(
      `<div style="block-size: 300px"><tct-layout padding="2">
        <tct-layout-header slot="header" id="h">H</tct-layout-header>
        <tct-layout-content id="c">C</tct-layout-content></tct-layout></div>`,
    );
    expect(pad(root.querySelector('#h')!)).toMatchObject({top: 8, start: 8, end: 8});
    expect(pad(root.querySelector('#c')!)).toMatchObject({start: 8, end: 8, bottom: 8});
  });

  it('padding 0 on the layout makes the regions touch the container edges', async () => {
    const root = await fixture<HTMLElement>(
      `<div style="block-size: 300px"><tct-layout padding="0"><tct-layout-content id="c">C</tct-layout-content></tct-layout></div>`,
    );
    expect(pad(root.querySelector('#c')!)).toEqual({top: 0, end: 0, bottom: 0, start: 0});
  });

  it('publishes its padding as container padding for descendants that bleed', async () => {
    const {content, header} = await full();
    expect(
      getComputedStyle(baseOf(content)).getPropertyValue('--container-padding-inline-start').trim(),
    ).toBe('16px');
    expect(
      getComputedStyle(header.shadowRoot!.querySelector('.inner')!)
        .getPropertyValue('--container-padding-block-start')
        .trim(),
    ).toBe('16px');
  });
});

describe('tct-layout: inside a padded container', () => {
  it('cancels the padding of a card so it runs edge to edge', async () => {
    const root = await fixture<HTMLElement>(
      `<tct-card padding="4" width="400" height="300"><tct-layout><tct-layout-content id="c">C</tct-layout-content></tct-layout></tct-card>`,
    );
    const card = root.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
    const layout = root.querySelector('tct-layout')!;
    const inner = layout.shadowRoot!.querySelector<HTMLElement>('.outer')!;
    const box = card.getBoundingClientRect();
    const outer = inner.getBoundingClientRect();
    // The layout's box covers the card's padding box: its edges are the card's edges (minus the border).
    expect(outer.left).toBeLessThanOrEqual(box.left + 1);
    expect(outer.right).toBeGreaterThanOrEqual(box.right - 1);
    expect(outer.top).toBeLessThanOrEqual(box.top + 1);
    expect(outer.bottom).toBeGreaterThanOrEqual(box.bottom - 1);
  });
});

describe('tct-layout: content width', () => {
  const wide = (attributes: string, body: string) =>
    fixture<HTMLElement>(
      `<div style="block-size: 300px; inline-size: 900px"><tct-layout ${attributes}>${body}</tct-layout></div>`,
    );

  it('keeps a panel-free content region full width and aligns its children internally', async () => {
    const root = await wide(
      'content-width="640"',
      `<tct-layout-content id="c"><div id="child" style="block-size: 900px">x</div></tct-layout-content>`,
    );
    const content = root.querySelector('#c')!;
    const child = root.querySelector('#child')!;
    // The scroller spans the full width (its scrollbar stays at the outer edge)...
    expect(rect(content).width).toBe(900);
    // ...and the children sit in a 640px lane (padding included), centred.
    expect(rect(child).width).toBe(640 - 2 * 16);
    expect(Math.round(rect(child).left - rect(content).left)).toBe(130 + 16);
  });

  it('keeps the complete middle composition constrained with both panels', async () => {
    const root = await wide(
      'content-width="600"',
      `<tct-layout-panel slot="start" id="s" width="100">S</tct-layout-panel>
       <tct-layout-content id="c">C</tct-layout-content>
       <tct-layout-panel slot="end" id="e" width="100">E</tct-layout-panel>`,
    );
    const start = rect(baseOf(root.querySelector('#s')!));
    const end = rect(baseOf(root.querySelector('#e')!));
    // The start + content + end row is 600px wide and centred in the 900px layout.
    expect(Math.round(end.right - start.left)).toBeGreaterThanOrEqual(600 - 2 * 16);
    expect(Math.round(end.right - start.left)).toBeLessThanOrEqual(600 + 2 * 16);
    expect(Math.round(start.left)).toBeGreaterThan(100);
  });

  it('keeps zero padding full bleed with arithmetic content width', async () => {
    const root = await wide(
      'content-width="640"',
      `<tct-layout-content padding="0" id="c"><div id="child">x</div></tct-layout-content>`,
    );
    expect(pad(root.querySelector('#c')!)).toEqual({top: 0, end: 0, bottom: 0, start: 0});
    expect(rect(root.querySelector('#child')!).width).toBe(900);
  });

  it('keeps arbitrary panel-free content constrained to the lane', async () => {
    const root = await wide('content-width="640"', `<div id="plain">plain</div>`);
    expect(rect(root.querySelector('#plain')!).width).toBe(640);
  });

  it('a percentage width keeps the constrained composition', async () => {
    const root = await wide(
      'content-width="50%"',
      `<tct-layout-content id="c"><div id="child">x</div></tct-layout-content>`,
    );
    expect(Math.round(rect(root.querySelector('#c')!).width)).toBe(450);
  });

  it('resets an inherited content width for a nested layout without one', async () => {
    const root = await wide(
      'content-width="500"',
      `<tct-layout-content id="c" padding="0"><div style="block-size: 200px"><tct-layout id="n"><tct-layout-content id="nc">n</tct-layout-content></tct-layout></div></tct-layout-content>`,
    );
    expect(pad(root.querySelector('#nc')!).start).toBe(16);
  });

  it('a header aligns its content to the content width; its divider stays full-bleed', async () => {
    const root = await wide(
      'content-width="640"',
      `<tct-layout-header slot="header" has-divider id="h"><div id="hc">head</div></tct-layout-header>`,
    );
    const header = root.querySelector('#h')!;
    expect(rect(baseOf(header)).width).toBe(900);
    const inner = header.shadowRoot!.querySelector('.inner')!;
    expect(rect(inner).width).toBe(640);
  });
});

describe('tct-layout: accessibility', () => {
  it('a landmark and label go on the region box', async () => {
    const root = await fixture<HTMLElement>(
      `<div style="block-size: 300px"><tct-layout>
        <tct-layout-header slot="header" landmark="banner" label="Site">H</tct-layout-header>
        <tct-layout-panel slot="start" landmark="navigation" label="Sections" width="120">P</tct-layout-panel>
        <tct-layout-content landmark="main" label="Body">C</tct-layout-content>
        <tct-layout-footer slot="footer" landmark="contentinfo" label="Footer">F</tct-layout-footer>
      </tct-layout></div>`,
    );
    const roles = ['banner', 'navigation', 'main', 'contentinfo'];
    const tags = [
      'tct-layout-header',
      'tct-layout-panel',
      'tct-layout-content',
      'tct-layout-footer',
    ];
    tags.forEach((tag, index) => {
      const box = baseOf(root.querySelector(tag)!);
      expect(box.getAttribute('role')).toBe(roles[index]);
      expect(box.hasAttribute('aria-label')).toBe(true);
    });
    await expectAccessible(root, {rules: {region: {enabled: false}}});
  });

  it('is accessible with every region present', async () => {
    const {root} = await full('default-has-dividers');
    await expectAccessible(root);
  });

  it('a scrolling content region is keyboard reachable and takes no tab stop when it fits', async () => {
    const tall = await full('', '<div style="block-size: 1200px">tall</div>');
    expect(baseOf(tall.content).getAttribute('tabindex')).toBe('0');
    const fits = await full();
    expect(baseOf(fits.content).hasAttribute('tabindex')).toBe(false);
  });

  it('a scrolling region with its own tab stop inside does not add another', async () => {
    const root = await fixture<HTMLElement>(
      `<div style="block-size: 100px"><tct-layout><tct-layout-content><button>a</button><div style="block-size: 900px"></div></tct-layout-content></tct-layout></div>`,
    );
    expect(baseOf(root.querySelector('tct-layout-content')!).hasAttribute('tabindex')).toBe(false);
  });

  it('a focusable content region takes focus by script but is not a tab stop', async () => {
    const root = await fixture<HTMLElement>(
      `<div style="block-size: 300px"><tct-layout><tct-layout-content focusable landmark="main">C</tct-layout-content></tct-layout></div>`,
    );
    const content = root.querySelector<TctLayoutContent>('tct-layout-content')!;
    const box = baseOf(content);
    expect(box.getAttribute('tabindex')).toBe('-1');
    content.focus();
    expect(content.shadowRoot!.activeElement).toBe(box);
  });
});
