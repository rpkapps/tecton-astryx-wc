/**
 * tct-hstack: a stack that always runs in a row (ported from upstream HStack.test.tsx).
 */
import {html} from 'lit';
import {describe, expect, it} from 'vitest';
import {axNode, expectAccessible} from '@tecton-astryx/testing/a11y.js';
import {fixture} from '@tecton-astryx/testing/fixture.js';
import {runElementSuite} from '@tecton-astryx/testing/suites/element.js';
import {isChromium} from '@tecton-astryx/testing/tier.js';
import './define.js';
import type {TctHStack} from './tct-hstack.js';

const baseOf = (element: Element): HTMLElement =>
  element.shadowRoot!.querySelector<HTMLElement>('[part~="base"]')!;
const css = (element: Element) => getComputedStyle(baseOf(element));

async function hstack(attributes = '', content = '<span>a</span><span>b</span>') {
  const root = await fixture<HTMLElement>(
    `<div style="inline-size: 400px"><tct-hstack ${attributes}>${content}</tct-hstack></div>`,
  );
  return root.querySelector<TctHStack>('tct-hstack')!;
}

runElementSuite({
  tag: 'tct-hstack',
  render: () => html`<tct-hstack gap="2"><span>one</span><span>two</span></tct-hstack>`,
  properties: {gap: 4, wrap: 'wrap', vAlign: 'center'},
  attributes: {gap: 'gap', wrap: 'wrap'},
});

describe('tct-hstack (HStack.test.tsx)', () => {
  it('renders children correctly, in a row', async () => {
    const element = await hstack();
    expect(css(element).flexDirection).toBe('row');
    const [a, b] = [...element.querySelectorAll('span')] as [HTMLElement, HTMLElement];
    expect(b.getBoundingClientRect().left).toBeGreaterThan(a.getBoundingClientRect().left);
  });

  it('renders as div by default, and with polymorphic as prop', async () => {
    const element = await hstack();
    expect(baseOf(element).localName).toBe('div');
    const nav = await hstack('as="nav"');
    expect(baseOf(nav).localName).toBe('nav');
  });

  it('renders with gap prop', async () => {
    const element = await hstack('gap="3"');
    expect(css(element).columnGap).toBe('12px');
  });

  it('renders with v-align prop (cross axis)', async () => {
    const element = await hstack('v-align="center"');
    expect(css(element).alignItems).toBe('center');
  });

  it('renders with h-align prop (main axis)', async () => {
    const element = await hstack('h-align="between"');
    expect(css(element).justifyContent).toBe('space-between');
  });

  it('renders with wrap prop', async () => {
    const element = await hstack('wrap="wrap"');
    expect(css(element).flexWrap).toBe('wrap');
  });

  it('accepts justify as alias for h-align', async () => {
    const element = await hstack('justify="end"');
    expect(css(element).justifyContent).toBe('flex-end');
  });

  it('accepts alignment as alias for v-align', async () => {
    const element = await hstack('alignment="end"');
    expect(css(element).alignItems).toBe('flex-end');
  });

  it('prefers explicit h-align over justify', async () => {
    const element = await hstack('h-align="center" justify="end"');
    expect(css(element).justifyContent).toBe('center');
  });

  it('keeps the direction horizontal whatever is written', async () => {
    const element = await hstack('direction="vertical"');
    expect(element.direction).toBe('horizontal');
    expect(element.getAttribute('direction')).toBe('horizontal');
    element.direction = 'vertical';
    await element.updateComplete;
    expect(css(element).flexDirection).toBe('row');
  });

  it('passes through additional attributes and sizes', async () => {
    const element = await hstack('id="row" data-testid="h" width="200" padding="2"');
    expect(element.id).toBe('row');
    expect(element.getBoundingClientRect().width).toBe(200);
    expect(css(element).paddingInlineStart).toBe('8px');
  });

  it('is accessible, and names a landmark through as', async () => {
    const element = await hstack(
      'as="nav" aria-label="Toolbar"',
      '<a href="#a">A</a><a href="#b">B</a>',
    );
    await expectAccessible(element);
    if (isChromium) {
      expect(await axNode(baseOf(element))).toMatchObject({role: 'navigation', name: 'Toolbar'});
    }
  });

  it('flows from the inline start in RTL', async () => {
    const root = await fixture<HTMLElement>(
      '<div style="inline-size: 400px"><tct-hstack width="300"><span id="a">a</span><span id="b">b</span></tct-hstack></div>',
      {dir: 'rtl'},
    );
    expect(root.querySelector('#a')!.getBoundingClientRect().left).toBeGreaterThan(
      root.querySelector('#b')!.getBoundingClientRect().left,
    );
  });
});
