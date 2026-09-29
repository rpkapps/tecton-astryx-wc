/**
 * tct-center: centring on one or both axes, inline mode, padding and sizes (ported from upstream
 * Center.test.tsx), RTL, forced colours.
 */
import {html} from 'lit';
import {describe, expect, it} from 'vitest';
import {expectAccessible} from '@tecton-wc/testing/a11y.js';
import {emulateMedia} from '@tecton-wc/testing/emulate.js';
import {fixture} from '@tecton-wc/testing/fixture.js';
import {runElementSuite} from '@tecton-wc/testing/suites/element.js';
import {isChromium} from '@tecton-wc/testing/tier.js';
import './define.js';
import type {TctCenter} from './tct-center.js';

const baseOf = (element: Element): HTMLElement =>
  element.shadowRoot!.querySelector<HTMLElement>('[part~="base"]')!;
const css = (element: Element) => getComputedStyle(baseOf(element));

/** A 400 by 200 area with a 40 by 20 child inside a centre. */
async function center(attributes = 'height="200"') {
  const root = await fixture<HTMLElement>(
    `<div style="inline-size: 400px"><tct-center ${attributes}><div id="child" style="inline-size: 40px; block-size: 20px">x</div></tct-center></div>`,
  );
  const element = root.querySelector<TctCenter>('tct-center')!;
  return {element, child: root.querySelector<HTMLElement>('#child')!};
}

/** How far the child's middle is from the middle of the centre, per axis. */
const offsets = (element: Element, child: Element) => {
  const box = element.getBoundingClientRect();
  const item = child.getBoundingClientRect();
  return {
    x: Math.round(item.left + item.width / 2 - (box.left + box.width / 2)),
    y: Math.round(item.top + item.height / 2 - (box.top + box.height / 2)),
    startInline: Math.round(item.left - box.left),
    startBlock: Math.round(item.top - box.top),
  };
};

runElementSuite({
  tag: 'tct-center',
  render: () => html`<tct-center height="100"><span>centred</span></tct-center>`,
  properties: {axis: 'vertical', inline: true, padding: 2, width: 120},
  attributes: {axis: 'axis'},
});

describe('tct-center (Center.test.tsx)', () => {
  it('renders and centres children (both axes by default)', async () => {
    const {element, child} = await center();
    expect(element.axis).toBe('both');
    expect(css(element).display).toBe('flex');
    expect(css(element).alignItems).toBe('center');
    expect(css(element).justifyContent).toBe('center');
    expect(offsets(element, child)).toMatchObject({x: 0, y: 0});
  });

  it('centres horizontally only', async () => {
    const {element, child} = await center('axis="horizontal" height="200"');
    expect(css(element).justifyContent).toBe('center');
    expect(css(element).alignItems).not.toBe('center');
    const {x, startBlock} = offsets(element, child);
    expect(x).toBe(0);
    expect(startBlock).toBe(0);
  });

  it('centres vertically only', async () => {
    const {element, child} = await center('axis="vertical" height="200"');
    expect(css(element).alignItems).toBe('center');
    expect(css(element).justifyContent).not.toBe('center');
    const {y, startInline} = offsets(element, child);
    expect(y).toBe(0);
    expect(startInline).toBe(0);
  });

  it('reflects the axis and falls back to both for an unknown value', async () => {
    const {element, child} = await center('height="200"');
    expect(element.getAttribute('axis')).toBe('both');
    (element as unknown as {axis: string}).axis = 'diagonal';
    await element.updateComplete;
    expect(offsets(element, child)).toMatchObject({x: 0, y: 0});
  });

  it('applies the height prop', async () => {
    const {element} = await center('height="150"');
    expect(element.getBoundingClientRect().height).toBe(150);
    expect(baseOf(element).getBoundingClientRect().height).toBe(150);
  });

  it('applies the width prop', async () => {
    const {element} = await center('width="250"');
    expect(element.getBoundingClientRect().width).toBe(250);
  });

  it('applies width and height together, as strings too', async () => {
    const {element} = await center('width="50%" height="10rem"');
    expect(element.getBoundingClientRect().width).toBe(200);
    expect(element.getBoundingClientRect().height).toBe(160);
  });

  it('applies max-width and min-height', async () => {
    const {element} = await center('max-width="120" min-height="90"');
    expect(element.getBoundingClientRect().width).toBe(120);
    expect(element.getBoundingClientRect().height).toBeGreaterThanOrEqual(90);
  });

  it('renders as inline-flex when inline is set, so it sits in a line of text', async () => {
    const root = await fixture<HTMLElement>(
      '<p>before <tct-center inline padding="1"><span>icon</span></tct-center> after</p>',
    );
    const element = root.querySelector<TctCenter>('tct-center')!;
    expect(getComputedStyle(element).display).toBe('inline-flex');
    const text = root.getBoundingClientRect();
    expect(element.getBoundingClientRect().width).toBeLessThan(text.width / 2);
  });

  it('is block-level flex by default', async () => {
    const {element} = await center();
    expect(getComputedStyle(element).display).toBe('flex');
  });

  it('carries no padding unless asked', async () => {
    const {element} = await center('');
    expect(css(element).paddingInlineStart).toBe('0px');
    expect(css(element).paddingBlockStart).toBe('0px');
  });

  it('applies a padding step, including zero', async () => {
    const {element} = await center('padding="3"');
    expect(css(element).paddingInlineStart).toBe('12px');
    expect(css(element).paddingBlockEnd).toBe('12px');
    const zero = await center('padding="0"');
    expect(css(zero.element).paddingInlineStart).toBe('0px');
  });

  it('lets padding-inline/padding-block override padding on their axis', async () => {
    const {element} = await center('padding="1" padding-inline="4" padding-block="2"');
    const style = css(element);
    expect([style.paddingInlineStart, style.paddingInlineEnd]).toEqual(['16px', '16px']);
    expect([style.paddingBlockStart, style.paddingBlockEnd]).toEqual(['8px', '8px']);
  });

  it('lets an edge override only its own edge, and beat the axis', async () => {
    const {element} = await center(
      'padding="1" padding-block="2" padding-block-start="8" padding-inline-end="5"',
    );
    const style = css(element);
    expect(style.paddingBlockStart).toBe('32px');
    expect(style.paddingBlockEnd).toBe('8px');
    expect(style.paddingInlineEnd).toBe('20px');
    expect(style.paddingInlineStart).toBe('4px');
  });

  it('resolves all four edges independently', async () => {
    const {element} = await center(
      'padding-inline-start="1" padding-inline-end="2" padding-block-start="3" padding-block-end="4"',
    );
    const style = css(element);
    expect([
      style.paddingInlineStart,
      style.paddingInlineEnd,
      style.paddingBlockStart,
      style.paddingBlockEnd,
    ]).toEqual(['4px', '8px', '12px', '16px']);
  });

  it('centres inside its padding box', async () => {
    const {element, child} = await center('height="200" padding-inline-start="10"');
    // The padding shifts the centre of the content box by half the padding.
    expect(offsets(element, child).x).toBe(20);
  });

  it('a nested centre does not inherit its parent padding', async () => {
    const root = await fixture<HTMLElement>(
      '<div style="inline-size: 400px"><tct-center padding="4" id="outer"><tct-center id="inner">x</tct-center></tct-center></div>',
    );
    expect(css(root.querySelector('#inner')!).paddingInlineStart).toBe('0px');
  });

  it('passes through additional attributes', async () => {
    const {element} = await center('id="hero" data-testid="c" aria-label="Loading"');
    expect(element.id).toBe('hero');
    expect(element.getAttribute('data-testid')).toBe('c');
  });

  it('adds no role or accessible name of its own', async () => {
    const root = await fixture<HTMLElement>(
      '<tct-center height="100"><button type="button">Retry</button></tct-center>',
    );
    await expectAccessible(root);
  });
});

describe('tct-center: RTL and forced colours', () => {
  it('padding-inline-start pads the right edge in RTL, and centring is unchanged', async () => {
    const root = await fixture<HTMLElement>(
      '<div style="inline-size: 400px"><tct-center axis="horizontal" padding-inline-start="10"><div id="child" style="inline-size: 40px">x</div></tct-center></div>',
      {dir: 'rtl'},
    );
    const element = root.querySelector('tct-center')!;
    expect(css(element).paddingRight).toBe('40px');
    expect(css(element).paddingLeft).toBe('0px');
    const box = element.getBoundingClientRect();
    const child = root.querySelector('#child')!.getBoundingClientRect();
    expect(Math.round(child.left + child.width / 2 - (box.left + box.width / 2))).toBe(-20);
  });

  it.skipIf(!isChromium)('renders the same layout in forced-colors mode', async () => {
    await emulateMedia({forcedColors: 'active'});
    const {element, child} = await center();
    expect(offsets(element, child)).toMatchObject({x: 0, y: 0});
    await expectAccessible(element);
  });
});
