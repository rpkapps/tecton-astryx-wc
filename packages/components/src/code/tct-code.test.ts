/**
 * tct-code: inline code semantics, colour and size variants (ported from upstream Code.test.tsx),
 * wrapping, forced colours.
 */
import {html} from 'lit';
import {describe, expect, it} from 'vitest';
import {axNode, expectAccessible} from '@tecton-astryx/testing/a11y.js';
import {emulateMedia} from '@tecton-astryx/testing/emulate.js';
import {fixture} from '@tecton-astryx/testing/fixture.js';
import {runElementSuite} from '@tecton-astryx/testing/suites/element.js';
import {isChromium} from '@tecton-astryx/testing/tier.js';
import './define.js';
import type {TctCode} from './tct-code.js';

const baseOf = (element: Element): HTMLElement =>
  element.shadowRoot!.querySelector<HTMLElement>('[part~="base"]')!;
const css = (element: Element) => getComputedStyle(baseOf(element));

async function code(attributes = '', text = 'const x = 1') {
  const root = await fixture<HTMLElement>(
    `<p style="font-size: 20px; line-height: 30px; inline-size: 400px; color: rgb(10, 20, 30)">Use <tct-code ${attributes}>${text}</tct-code> here.</p>`,
  );
  return root.querySelector<TctCode>('tct-code')!;
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
  tag: 'tct-code',
  render: () => html`<p>Use <tct-code>npm install</tct-code> to install.</p>`,
  properties: {color: 'secondary', size: 'inherit'},
  attributes: {color: 'color', size: 'size'},
  // The suite mounts the fixture root (the paragraph); the element under test is found inside it.
});

describe('tct-code (Code.test.tsx)', () => {
  it('renders children inside a <code> element', async () => {
    const element = await code();
    expect(baseOf(element).localName).toBe('code');
    expect(element.textContent).toBe('const x = 1');
    expect(element.shadowRoot!.querySelector('slot')!.assignedNodes()).toHaveLength(1);
    expect(baseOf(element).contains(element.shadowRoot!.querySelector('slot'))).toBe(true);
  });

  it('exposes the base as the theming target part', async () => {
    const element = await code();
    expect(baseOf(element).getAttribute('part')).toBe('base');
  });

  it('defaults color to primary and reflects it', async () => {
    const element = await code();
    expect(element.color).toBe('primary');
    expect(element.getAttribute('color')).toBe('primary');
    expect(css(element).color).toBe(token('--color-text-primary'));
  });

  it('applies the secondary color', async () => {
    const element = await code('color="secondary"');
    expect(element.getAttribute('color')).toBe('secondary');
    expect(css(element).color).toBe(token('--color-text-secondary'));
  });

  it('applies the inherit color: the surrounding text colour', async () => {
    const element = await code('color="inherit"');
    expect(css(element).color).toBe('rgb(10, 20, 30)');
  });

  it('adds a size rule when size="inherit" (font-size and line-height inherit)', async () => {
    const element = await code();
    const natural = css(element).fontSize;
    expect(natural).toBe(token('--text-code-size', 'font-size'));
    element.size = 'inherit';
    await element.updateComplete;
    expect(element.getAttribute('size')).toBe('inherit');
    expect(css(element).fontSize).toBe('20px');
    expect(css(element).lineHeight).toBe('30px');
  });

  it('uses the monospace family, the muted surface, the inner radius and inline padding', async () => {
    const element = await code();
    expect(css(element).fontFamily).toContain('IBM Plex Mono');
    expect(css(element).backgroundColor).toBe(
      token('--color-background-muted', 'background-color'),
    );
    expect(css(element).borderTopLeftRadius).toBe('2px');
    expect(css(element).paddingInlineStart).toBe('4px');
    expect(css(element).paddingBlockStart).toBe('0px');
  });

  it('matches the x-height of the surrounding text with the numeric font-size-adjust', async () => {
    const element = await code();
    expect(css(element).fontSizeAdjust).toBe('0.516');
  });

  it('is inline: it flows in the sentence and wraps long content', async () => {
    const element = await code('', 'a_very_long_identifier_that_never_ends_'.repeat(6));
    expect(getComputedStyle(element).display).toBe('inline');
    const paragraph = element.parentElement!;
    expect(element.getBoundingClientRect().width).toBeLessThanOrEqual(
      paragraph.getBoundingClientRect().width,
    );
    expect(paragraph.scrollWidth).toBeLessThanOrEqual(paragraph.clientWidth);
  });

  it('forwards no box styles to the host', async () => {
    const element = await code();
    const style = getComputedStyle(element);
    expect(style.backgroundColor).toBe('rgba(0, 0, 0, 0)');
    expect(style.paddingInlineStart).toBe('0px');
  });

  it('passes through additional attributes on the host', async () => {
    const element = await code('id="snippet" data-testid="code"');
    expect(element.id).toBe('snippet');
    expect(element.getAttribute('data-testid')).toBe('code');
  });
});

describe('tct-code: accessibility and forced colours', () => {
  it('passes axe and exposes the code role in the accessibility tree', async () => {
    const element = await code();
    await expectAccessible(element.parentElement!);
    if (isChromium) expect((await axNode(baseOf(element))).role).toBe('code');
  });

  it('passes axe in every colour', async () => {
    for (const attributes of ['color="secondary"', 'color="inherit"', 'size="inherit"']) {
      await expectAccessible((await code(attributes)).parentElement!);
    }
  });

  it.skipIf(!isChromium)('keeps a visible edge in forced-colors mode', async () => {
    await emulateMedia({forcedColors: 'active'});
    const element = await code();
    expect(css(element).borderTopWidth).toBe('1px');
    expect(css(element).borderTopStyle).toBe('solid');
    await expectAccessible(element.parentElement!);
  });

  it('reads the same in RTL: inline padding is symmetric', async () => {
    const root = await fixture<HTMLElement>('<p>Use <tct-code>x = 1</tct-code></p>', {dir: 'rtl'});
    const style = css(root.querySelector('tct-code')!);
    expect(style.paddingLeft).toBe(style.paddingRight);
  });
});
