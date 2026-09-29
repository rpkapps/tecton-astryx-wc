/**
 * tct-vstack: a stack that always runs in a column (ported from upstream VStack.test.tsx).
 */
import {html} from 'lit';
import {describe, expect, it} from 'vitest';
import {axNode, expectAccessible} from '@tecton-astryx/testing/a11y.js';
import {fixture} from '@tecton-astryx/testing/fixture.js';
import {runElementSuite} from '@tecton-astryx/testing/suites/element.js';
import {isChromium} from '@tecton-astryx/testing/tier.js';
import './define.js';
import type {TctVStack} from './tct-vstack.js';

const baseOf = (element: Element): HTMLElement =>
  element.shadowRoot!.querySelector<HTMLElement>('[part~="base"]')!;
const css = (element: Element) => getComputedStyle(baseOf(element));

async function vstack(attributes = '', content = '<span>a</span><span>b</span>') {
  const root = await fixture<HTMLElement>(
    `<div style="inline-size: 400px"><tct-vstack ${attributes}>${content}</tct-vstack></div>`,
  );
  return root.querySelector<TctVStack>('tct-vstack')!;
}

runElementSuite({
  tag: 'tct-vstack',
  render: () => html`<tct-vstack gap="2"><span>one</span><span>two</span></tct-vstack>`,
  properties: {gap: 4, wrap: 'wrap', hAlign: 'center'},
  attributes: {gap: 'gap', wrap: 'wrap'},
});

describe('tct-vstack (VStack.test.tsx)', () => {
  it('renders children correctly, in a column', async () => {
    const element = await vstack('', '<b>first</b><i>second</i>');
    expect(css(element).flexDirection).toBe('column');
    const first = element.querySelector('b')!.getBoundingClientRect();
    const second = element.querySelector('i')!.getBoundingClientRect();
    expect(second.top).toBeGreaterThanOrEqual(first.bottom - 1);
  });

  it('renders as div by default, and with polymorphic as prop', async () => {
    const element = await vstack();
    expect(baseOf(element).localName).toBe('div');
    const section = await vstack('as="section"');
    expect(baseOf(section).localName).toBe('section');
  });

  it('renders with gap prop', async () => {
    const element = await vstack('gap="4"');
    expect(css(element).rowGap).toBe('16px');
  });

  it('renders with h-align prop (cross axis)', async () => {
    const element = await vstack('h-align="center"');
    expect(css(element).alignItems).toBe('center');
  });

  it('renders with v-align prop (main axis)', async () => {
    const element = await vstack('v-align="around"');
    expect(css(element).justifyContent).toBe('space-around');
  });

  it('renders with wrap prop', async () => {
    const element = await vstack('wrap="wrap"');
    expect(css(element).flexWrap).toBe('wrap');
  });

  it('accepts justify as alias for v-align', async () => {
    const element = await vstack('justify="end"');
    expect(css(element).justifyContent).toBe('flex-end');
  });

  it('accepts alignment as alias for h-align', async () => {
    const element = await vstack('alignment="center"');
    expect(css(element).alignItems).toBe('center');
  });

  it('prefers explicit v-align over justify', async () => {
    const element = await vstack('v-align="center" justify="end"');
    expect(css(element).justifyContent).toBe('center');
  });

  it('keeps the direction vertical whatever is written', async () => {
    const element = await vstack('direction="horizontal"');
    expect(element.direction).toBe('vertical');
    expect(element.getAttribute('direction')).toBe('vertical');
    element.direction = 'horizontal';
    await element.updateComplete;
    expect(css(element).flexDirection).toBe('column');
  });

  it('is scrollable with a fixed height', async () => {
    const element = await vstack(
      'scrollable height="80"',
      '<div style="block-size: 200px; flex: none">tall</div>',
    );
    const box = baseOf(element);
    expect(box.clientHeight).toBe(80);
    expect(box.scrollHeight).toBeGreaterThan(80);
  });

  it('is accessible, and renders a named list through as', async () => {
    const element = await vstack('as="ul" aria-label="Items"', '<li>One</li><li>Two</li>');
    await expectAccessible(element);
    if (isChromium) {
      expect(await axNode(baseOf(element))).toMatchObject({role: 'list', name: 'Items'});
    }
  });
});
