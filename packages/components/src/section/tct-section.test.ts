/**
 * tct-section: variants, dividers, padding precedence and propagation, escaping a padded container
 * (ported from upstream Section.test.tsx), RTL, forced colours.
 */
import {html} from 'lit';
import {describe, expect, it} from 'vitest';
import {expectAccessible} from '@tecton-wc/testing/a11y.js';
import {emulateMedia} from '@tecton-wc/testing/emulate.js';
import {fixture} from '@tecton-wc/testing/fixture.js';
import {runElementSuite} from '@tecton-wc/testing/suites/element.js';
import {isChromium} from '@tecton-wc/testing/tier.js';
import '../card/define.js';
import './define.js';
import {parseSectionDividers} from './section.types.js';
import type {TctSection} from './tct-section.js';

const baseOf = (element: Element): HTMLElement =>
  element.shadowRoot!.querySelector<HTMLElement>('[part~="base"]')!;
const css = (element: Element) => getComputedStyle(baseOf(element));

async function section(attributes = '', content = '<p>Content</p>') {
  const root = await fixture<HTMLElement>(
    `<div style="inline-size: 300px"><tct-section ${attributes}>${content}</tct-section></div>`,
  );
  return root.querySelector<TctSection>('tct-section')!;
}

const token = (name: string): string => {
  const probe = document.createElement('div');
  probe.style.backgroundColor = `var(${name})`;
  document.body.append(probe);
  const value = getComputedStyle(probe).backgroundColor;
  probe.remove();
  return value;
};

const insets = (element: Element) => {
  const style = css(element);
  return [
    style.paddingInlineStart,
    style.paddingInlineEnd,
    style.paddingBlockStart,
    style.paddingBlockEnd,
  ].map(parseFloat);
};

runElementSuite({
  tag: 'tct-section',
  render: () => html`<tct-section padding="2"><p>content</p></tct-section>`,
  properties: {variant: 'muted', dividers: ['top', 'end'], padding: 3, height: 100},
  attributes: {variant: 'variant'},
});

describe('parseSectionDividers', () => {
  it('reads space and comma separated sides, ignoring anything else', () => {
    expect(parseSectionDividers('top bottom')).toEqual(['top', 'bottom']);
    expect(parseSectionDividers('start, end,top')).toEqual(['start', 'end', 'top']);
    expect(parseSectionDividers('left top top')).toEqual(['top']);
    expect(parseSectionDividers('left')).toBeUndefined();
    expect(parseSectionDividers('')).toBeUndefined();
    expect(parseSectionDividers(null)).toBeUndefined();
  });
});

describe('tct-section (Section.test.tsx)', () => {
  it('renders with default props', async () => {
    const element = await section();
    expect(element.variant).toBe('section');
    expect(element.getAttribute('variant')).toBe('section');
    expect(element.dividers).toBeUndefined();
    expect(insets(element)).toEqual([16, 16, 16, 16]);
  });

  it('renders children inside the painted box', async () => {
    const element = await section('', '<b id="c">Section content</b>');
    expect(element.querySelector('#c')!.textContent).toBe('Section content');
    expect(baseOf(element).contains(element.shadowRoot!.querySelector('slot'))).toBe(true);
  });

  it('renders with variant="section" (default): the surface colour', async () => {
    expect(css(await section()).backgroundColor).toBe(token('--color-background-surface'));
  });

  it('renders with variant="transparent"', async () => {
    const element = await section('variant="transparent"');
    expect(css(element).backgroundColor).toBe('rgba(0, 0, 0, 0)');
  });

  it('renders with variant="muted"', async () => {
    expect(css(await section('variant="muted"')).backgroundColor).toBe(
      token('--color-background-muted'),
    );
  });

  it('renders with dividers on the chosen sides', async () => {
    const element = await section('dividers="top bottom"');
    expect(css(element).borderTopWidth).toBe('1px');
    expect(css(element).borderBottomWidth).toBe('1px');
    expect(css(element).borderLeftWidth).toBe('0px');
    expect(css(element).borderTopColor).toBe(token('--color-border'));
    const sides = await section('dividers="start end"');
    expect(css(sides).borderLeftWidth).toBe('1px');
    expect(css(sides).borderRightWidth).toBe('1px');
  });

  it('takes dividers as an array property, and drops them again', async () => {
    const element = await section();
    element.dividers = ['bottom'];
    await element.updateComplete;
    expect(css(element).borderBottomWidth).toBe('1px');
    expect(css(element).borderTopWidth).toBe('0px');
    element.dividers = undefined;
    await element.updateComplete;
    expect(css(element).borderBottomWidth).toBe('0px');
  });

  it('start and end dividers follow the direction', async () => {
    const root = await fixture<HTMLElement>(
      '<div style="inline-size: 300px"><tct-section dividers="start"><p>x</p></tct-section></div>',
      {dir: 'rtl'},
    );
    const style = css(root.querySelector('tct-section')!);
    expect(style.borderRightWidth).toBe('1px');
    expect(style.borderLeftWidth).toBe('0px');
  });

  it('renders with a padding prop, and zero for edge-to-edge content', async () => {
    expect(insets(await section('padding="6"'))).toEqual([24, 24, 24, 24]);
    expect(insets(await section('padding="0"'))).toEqual([0, 0, 0, 0]);
  });

  it('renders with width, height, max-width and min-height', async () => {
    const element = await section('width="200" height="120"');
    expect(element.getBoundingClientRect().width).toBe(200);
    expect(element.getBoundingClientRect().height).toBe(120);
    const capped = await section('max-width="150" min-height="90"');
    expect(capped.getBoundingClientRect().width).toBe(150);
    expect(capped.getBoundingClientRect().height).toBeGreaterThanOrEqual(90);
    const strings = await section('width="50%" height="5rem"');
    expect(strings.getBoundingClientRect().width).toBe(150);
    expect(strings.getBoundingClientRect().height).toBe(80);
  });

  it('has a two-box structure: an escape wrapper and the painted box', async () => {
    const element = await section();
    const outer = element.shadowRoot!.querySelector('.escape')!;
    expect(outer.children).toHaveLength(1);
    expect(outer.firstElementChild).toBe(baseOf(element));
    expect(outer.localName).toBe('div');
    expect(baseOf(element).localName).toBe('div');
  });

  it('passes through additional attributes on the host', async () => {
    const element = await section('id="s1" data-testid="custom-section"');
    expect(element.id).toBe('s1');
  });
});

describe('tct-section: padding precedence and propagation', () => {
  it('lets padding-inline/padding-block override padding on their axis', async () => {
    expect(insets(await section('padding="1" padding-inline="4" padding-block="2"'))).toEqual([
      16, 16, 8, 8,
    ]);
  });

  it('applies a class-equivalent for paddingBlockStart on its own, keeping the rest at step 4', async () => {
    expect(insets(await section('padding-block-start="8"'))).toEqual([16, 16, 32, 16]);
  });

  it('gives block edges precedence over padding-block, and inline edges over padding-inline', async () => {
    expect(insets(await section('padding-block="2" padding-block-end="5"'))).toEqual([
      16, 16, 8, 20,
    ]);
    expect(insets(await section('padding-inline="2" padding-inline-start="10"'))).toEqual([
      40, 8, 16, 16,
    ]);
  });

  it('keeps inline padding when only a block edge is overridden, and the reverse', async () => {
    expect(insets(await section('padding="6" padding-block-start="1"'))).toEqual([24, 24, 4, 24]);
    expect(insets(await section('padding="6" padding-inline-end="1"'))).toEqual([24, 4, 24, 24]);
  });

  it('resolves all four edges independently', async () => {
    expect(
      insets(
        await section(
          'padding-inline-start="1" padding-inline-end="2" padding-block-start="3" padding-block-end="4"',
        ),
      ),
    ).toEqual([4, 8, 12, 16]);
  });

  it('moves the published container variables with a per-edge override', async () => {
    const element = await section('padding="6" padding-inline-start="2"');
    const style = css(element);
    expect(style.getPropertyValue('--container-padding-inline-start').trim()).toBe('8px');
    expect(style.getPropertyValue('--container-padding-inline-end').trim()).toBe('24px');
    expect(style.getPropertyValue('--container-padding-block-start').trim()).toBe('24px');
    expect(style.getPropertyValue('--layout-padding-outer-x').trim()).toBe('8px');
  });

  it('takes the theme padding from --section-padding and its overrides', async () => {
    const root = await fixture<HTMLElement>(
      `<div style="inline-size: 300px; --section-padding: 20px; --section-padding-inline-start: 6px">
        <tct-section><p>x</p></tct-section></div>`,
    );
    expect(insets(root.querySelector('tct-section')!)).toEqual([6, 20, 20, 20]);
  });

  it('propagates explicit padding to nested sections via --_section-padding-propagated', async () => {
    const root = await fixture<HTMLElement>(
      `<div style="inline-size: 400px"><tct-section padding="6" id="outer">
        <tct-section id="inner" variant="muted"><p>Inner</p></tct-section></tct-section></div>`,
    );
    const outer = root.querySelector('#outer')!;
    const inner = root.querySelector('#inner')!;
    // The outer announces its step on the private propagation property, not the public theme one.
    expect(css(outer).getPropertyValue('--_section-padding-propagated').trim()).toBe('24px');
    expect(css(outer).getPropertyValue('--section-padding')).toBe('');
    expect(insets(outer)).toEqual([24, 24, 24, 24]);
    expect(insets(inner)).toEqual([24, 24, 24, 24]);
  });

  it('a nested section with explicit padding overrides the propagated step', async () => {
    const root = await fixture<HTMLElement>(
      `<div style="inline-size: 400px"><tct-section padding="6"><tct-section id="inner" padding="2">x</tct-section></tct-section></div>`,
    );
    expect(insets(root.querySelector('#inner')!)).toEqual([8, 8, 8, 8]);
  });

  it('a section without explicit padding propagates nothing', async () => {
    const root = await fixture<HTMLElement>(
      `<div style="inline-size: 400px"><tct-section><tct-section id="inner">x</tct-section></tct-section></div>`,
    );
    expect(insets(root.querySelector('#inner')!)).toEqual([16, 16, 16, 16]);
    expect(
      css(root.querySelector('tct-section')!).getPropertyValue('--_section-padding-propagated'),
    ).toBe('');
  });

  it('an overlay can drop the propagated padding with --_section-padding-propagated: initial', async () => {
    const root = await fixture<HTMLElement>(
      `<div style="inline-size: 400px"><tct-section padding="6">
        <div style="--_section-padding-propagated: initial"><tct-section id="inner">x</tct-section></div>
      </tct-section></div>`,
    );
    expect(insets(root.querySelector('#inner')!)).toEqual([16, 16, 16, 16]);
  });
});

describe('tct-section: nested in a padded container', () => {
  it('a section runs edge to edge across the inline padding of its container', async () => {
    const root = await fixture<HTMLElement>(
      `<div style="inline-size: 300px"><tct-card variant="muted" padding="4">
        <p>before</p><tct-section id="s" padding="2"><p>inside</p></tct-section><p>after</p></tct-card></div>`,
    );
    const host = root.querySelector('tct-card')!.getBoundingClientRect();
    const box = baseOf(root.querySelector('#s')!).getBoundingClientRect();
    expect(Math.round(box.left - host.left)).toBe(0);
    expect(Math.round(host.right - box.right)).toBe(0);
  });

  it('a first-child section also escapes the block-start padding; a middle one does not', async () => {
    const root = await fixture<HTMLElement>(
      `<div style="inline-size: 300px"><tct-card variant="muted" padding="4">
        <tct-section id="first" padding="1"><p>a</p></tct-section>
        <tct-section id="middle" padding="1"><p>b</p></tct-section>
        <tct-section id="last" padding="1"><p>c</p></tct-section></tct-card></div>`,
    );
    const host = root.querySelector('tct-card')!.getBoundingClientRect();
    const first = baseOf(root.querySelector('#first')!).getBoundingClientRect();
    const middle = baseOf(root.querySelector('#middle')!).getBoundingClientRect();
    const last = baseOf(root.querySelector('#last')!).getBoundingClientRect();
    expect(Math.round(first.top - host.top)).toBe(0);
    expect(Math.round(middle.top - first.bottom)).toBe(0);
    expect(Math.round(host.bottom - last.bottom)).toBe(0);
  });

  it('a section that is not first keeps its block-start position', async () => {
    const root = await fixture<HTMLElement>(
      `<div style="inline-size: 300px"><tct-card variant="muted" padding="4">
        <p id="lead">lead</p><tct-section id="s" padding="1"><p>b</p></tct-section></tct-card></div>`,
    );
    const lead = root.querySelector('#lead')!.getBoundingClientRect();
    const box = baseOf(root.querySelector('#s')!).getBoundingClientRect();
    expect(Math.round(box.top - lead.bottom)).toBeGreaterThanOrEqual(0);
  });

  it('nested sections publish their own padding to their content', async () => {
    const root = await fixture<HTMLElement>(
      `<tct-section padding="6"><tct-section id="inner" padding="1">x</tct-section></tct-section>`,
    );
    const style = css(root.querySelector('#inner')!);
    expect(style.getPropertyValue('--container-padding-inline-start').trim()).toBe('4px');
  });

  it('outside a padded container nothing escapes', async () => {
    const element = await section();
    const box = element.getBoundingClientRect();
    expect(baseOf(element).getBoundingClientRect().left).toBe(box.left);
    expect(baseOf(element).getBoundingClientRect().width).toBe(300);
  });
});

describe('tct-section: accessibility, RTL, forced colours', () => {
  it('adds no semantics and passes axe in every variant', async () => {
    for (const attributes of [
      '',
      'variant="muted"',
      'variant="transparent" dividers="top bottom"',
      'padding="0"',
    ]) {
      await expectAccessible(await section(attributes, '<h3>Title</h3><p>Body</p>'));
    }
  });

  it('padding-inline-start pads the right edge in RTL', async () => {
    const root = await fixture<HTMLElement>(
      '<div style="inline-size: 300px"><tct-section padding-inline-start="8"><p>x</p></tct-section></div>',
      {dir: 'rtl'},
    );
    const style = css(root.querySelector('tct-section')!);
    expect(style.paddingRight).toBe('32px');
    expect(style.paddingLeft).toBe('16px');
  });

  it.skipIf(!isChromium)('keeps the divider rules in forced-colors mode', async () => {
    await emulateMedia({forcedColors: 'active'});
    const element = await section('dividers="top end"');
    expect(css(element).borderTopWidth).toBe('1px');
    expect(css(element).borderTopStyle).toBe('solid');
    expect(css(element).borderRightWidth).toBe('1px');
    await expectAccessible(element);
  });
});
