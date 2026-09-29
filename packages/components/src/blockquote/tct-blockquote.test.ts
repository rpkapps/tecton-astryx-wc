/**
 * tct-blockquote: quotation markup, attribution, landmarks (ported from upstream Blockquote.test.tsx),
 * RTL, forced colours.
 */
import {html} from 'lit';
import {describe, expect, it} from 'vitest';
import {axNode, expectAccessible} from '@tecton-astryx/testing/a11y.js';
import {emulateMedia} from '@tecton-astryx/testing/emulate.js';
import {fixture} from '@tecton-astryx/testing/fixture.js';
import {runElementSuite} from '@tecton-astryx/testing/suites/element.js';
import {isChromium} from '@tecton-astryx/testing/tier.js';
import './define.js';
import type {TctBlockquote} from './tct-blockquote.js';

const baseOf = (element: Element): HTMLElement =>
  element.shadowRoot!.querySelector<HTMLElement>('[part~="base"]')!;
const citeOf = (element: Element): HTMLElement | null =>
  element.shadowRoot!.querySelector<HTMLElement>('cite');
const css = (element: Element) => getComputedStyle(baseOf(element));

async function quote(attributes = '', content = 'Design is not just what it looks like.') {
  const root = await fixture<HTMLElement>(
    `<div style="inline-size: 400px"><tct-blockquote ${attributes}>${content}</tct-blockquote></div>`,
  );
  return root.querySelector<TctBlockquote>('tct-blockquote')!;
}

const token = (name: string, property = 'color'): string => {
  const probe = document.createElement('div');
  probe.style.setProperty(property, `var(${name})`);
  document.body.append(probe);
  const value = getComputedStyle(probe).getPropertyValue(property);
  probe.remove();
  return value;
};

runElementSuite({
  tag: 'tct-blockquote',
  render: () => html`<tct-blockquote cite="Someone">Quote</tct-blockquote>`,
  properties: {cite: 'Steve Jobs'},
  attributes: {cite: 'cite'},
});

describe('tct-blockquote (Blockquote.test.tsx)', () => {
  it('renders children in a blockquote element', async () => {
    const element = await quote();
    expect(baseOf(element).localName).toBe('blockquote');
    expect(element.textContent).toBe('Design is not just what it looks like.');
    expect(baseOf(element).contains(element.shadowRoot!.querySelector('slot'))).toBe(true);
    if (isChromium) expect((await axNode(baseOf(element))).role).toBe('blockquote');
  });

  it('exposes the theming target as part "base"', async () => {
    expect(baseOf(await quote()).getAttribute('part')).toBe('base');
  });

  it('renders without cite by default', async () => {
    const element = await quote();
    expect(citeOf(element)).toBeNull();
    expect(element.cite).toBe('');
  });

  it('renders cite when provided, as a <cite> after the quotation', async () => {
    const element = await quote('cite="Steve Jobs"');
    const cite = citeOf(element)!;
    expect(cite.localName).toBe('cite');
    expect(cite.textContent).toBe('Steve Jobs');
    expect(baseOf(element).lastElementChild).toBe(cite);
    const slot = element.shadowRoot!.querySelector('slot:not([name])')!.getBoundingClientRect();
    expect(cite.getBoundingClientRect().top).toBeGreaterThanOrEqual(slot.bottom - 1);
  });

  it('never wraps the attribution in a landmark element', async () => {
    const element = await quote('cite="Steve Jobs"');
    expect(element.shadowRoot!.querySelector('footer')).toBeNull();
    expect(baseOf(element).querySelector('footer')).toBeNull();
    if (isChromium) {
      expect(await axNode(citeOf(element)!)).not.toMatchObject({role: 'contentinfo'});
    }
  });

  it.each([
    ['an empty string', 'cite=""'],
    ['whitespace', 'cite="   "'],
    ['not set', ''],
  ])('renders no cite element when cite is %s', async (_label, attributes) => {
    expect(citeOf(await quote(attributes))).toBeNull();
  });

  it('renders cite as markup through the cite slot', async () => {
    const element = await quote('', 'Quote<span slot="cite" id="custom">Custom attribution</span>');
    expect(citeOf(element)).not.toBeNull();
    expect(element.querySelector('#custom')!.textContent).toBe('Custom attribution');
    expect(
      element.shadowRoot!.querySelector<HTMLSlotElement>('slot[name="cite"]')!.assignedElements(),
    ).toHaveLength(1);
  });

  it('the cite slot wins over the cite attribute as the visible attribution', async () => {
    const element = await quote('cite="Attribute"', 'Quote<i slot="cite">Slot</i>');
    const slot = element.shadowRoot!.querySelector<HTMLSlotElement>('slot[name="cite"]')!;
    expect(slot.assignedElements()).toHaveLength(1);
  });

  it('adds and removes the cite element as the attribute changes', async () => {
    const element = await quote();
    element.cite = 'Later';
    await element.updateComplete;
    expect(citeOf(element)!.textContent).toBe('Later');
    element.cite = '';
    await element.updateComplete;
    expect(citeOf(element)).toBeNull();
  });

  it('passes through additional attributes, and names the quote from a host aria-label', async () => {
    const element = await quote('id="q" data-testid="bq" aria-label="Important quote"');
    expect(element.id).toBe('q');
    expect(baseOf(element).getAttribute('aria-label')).toBe('Important quote');
    if (isChromium) expect(await axNode(baseOf(element))).toMatchObject({name: 'Important quote'});
  });

  it('renders element children', async () => {
    const element = await quote('', '<p id="child-p">Paragraph inside blockquote</p>');
    expect(element.querySelector('#child-p')).not.toBeNull();
    expect(element.shadowRoot!.querySelector('slot')!.assignedElements()).toHaveLength(1);
  });

  it('renders multiple paragraphs and long content without overflowing', async () => {
    const element = await quote(
      'cite="Source"',
      '<p>One</p><p>Two</p><p>' + 'unbroken'.repeat(40) + '</p>',
    );
    expect(baseOf(element).scrollWidth).toBeLessThanOrEqual(baseOf(element).clientWidth + 1);
  });
});

describe('tct-blockquote: styling', () => {
  it('draws a spacing-0-5 rule on the inline-start edge in the emphasised border colour', async () => {
    const element = await quote();
    expect(css(element).borderInlineStartWidth).toBe('2px');
    expect(css(element).borderInlineStartStyle).toBe('solid');
    expect(css(element).borderInlineStartColor).toBe(token('--color-border-emphasized'));
    expect(css(element).borderInlineEndWidth).toBe('0px');
  });

  it('pads the inline start by spacing 4, sets secondary text, and has no UA margins', async () => {
    const element = await quote();
    expect(css(element).paddingInlineStart).toBe('16px');
    expect(css(element).color).toBe(token('--color-text-secondary'));
    expect(css(element).marginBlockStart).toBe('0px');
    expect(css(element).marginInlineStart).toBe('0px');
  });

  it('sets the attribution in the supporting size, block-level and not italic', async () => {
    const element = await quote('cite="Steve Jobs"');
    const cite = getComputedStyle(citeOf(element)!);
    expect(cite.display).toBe('block');
    expect(cite.fontStyle).toBe('normal');
    expect(cite.fontSize).toBe(token('--text-supporting-size', 'font-size'));
    expect(cite.marginBlockStart).toBe('8px');
  });

  it('the host is a block', async () => {
    expect(getComputedStyle(await quote()).display).toBe('block');
  });
});

describe('tct-blockquote: accessibility, RTL, forced colours', () => {
  it('passes axe with and without an attribution', async () => {
    await expectAccessible(await quote());
    await expectAccessible(await quote('cite="Steve Jobs"'));
    await expectAccessible(await quote('', 'Quote<em slot="cite">Markup</em>'));
  });

  it('moves the rule and the padding to the right edge in RTL', async () => {
    const root = await fixture<HTMLElement>(
      '<div style="inline-size: 400px"><tct-blockquote>שלום עולם</tct-blockquote></div>',
      {dir: 'rtl'},
    );
    const style = css(root.querySelector('tct-blockquote')!);
    expect(style.borderRightWidth).toBe('2px');
    expect(style.borderLeftWidth).toBe('0px');
    expect(style.paddingRight).toBe('16px');
  });

  it.skipIf(!isChromium)('keeps the rule in forced-colors mode', async () => {
    await emulateMedia({forcedColors: 'active'});
    const element = await quote('cite="Steve Jobs"');
    expect(css(element).borderInlineStartWidth).toBe('2px');
    expect(css(element).borderInlineStartStyle).toBe('solid');
    await expectAccessible(element);
  });
});
