/**
 * tct-divider: separator semantics, label naming, orientation, variants, full-bleed (ported from
 * upstream Divider.test.tsx), RTL, forced colours.
 */
import {html} from 'lit';
import {describe, expect, it} from 'vitest';
import {axNode, expectAccessible} from '@tecton-astryx/testing/a11y.js';
import {emulateMedia} from '@tecton-astryx/testing/emulate.js';
import {fixture} from '@tecton-astryx/testing/fixture.js';
import {runElementSuite} from '@tecton-astryx/testing/suites/element.js';
import {isChromium} from '@tecton-astryx/testing/tier.js';
import './define.js';
import type {TctDivider} from './tct-divider.js';

const baseOf = (element: Element): HTMLElement =>
  element.shadowRoot!.querySelector<HTMLElement>('[part~="base"]')!;
const lines = (element: Element): HTMLElement[] => [
  ...element.shadowRoot!.querySelectorAll<HTMLElement>('[part~="line"]'),
];

async function divider(attributes = '', content = '', wrapperStyle = 'inline-size: 300px') {
  const root = await fixture<HTMLElement>(
    `<div style="${wrapperStyle}"><tct-divider ${attributes}>${content}</tct-divider></div>`,
  );
  return root.querySelector<TctDivider>('tct-divider')!;
}

runElementSuite({
  tag: 'tct-divider',
  render: () => html`<tct-divider label="Section"></tct-divider>`,
  properties: {orientation: 'vertical', variant: 'strong', label: 'More', fullBleed: true},
  attributes: {orientation: 'orientation', variant: 'variant', label: 'label'},
  // The rule is a hairline: nothing to name without a label, and axe rules for separators pass either way.
});

describe('tct-divider (Divider.test.tsx)', () => {
  it('renders horizontal by default, as a separator', async () => {
    const element = await divider();
    expect(element.orientation).toBe('horizontal');
    expect(element.getAttribute('orientation')).toBe('horizontal');
    if (isChromium) {
      expect(await axNode(element)).toMatchObject({role: 'separator', orientation: 'horizontal'});
    }
    // Without a label there is a single line.
    expect(lines(element)).toHaveLength(1);
  });

  it('renders vertical when specified', async () => {
    const element = await divider('orientation="vertical"', '', 'block-size: 100px');
    if (isChromium) {
      expect(await axNode(element)).toMatchObject({role: 'separator', orientation: 'vertical'});
    }
    expect(element.getBoundingClientRect().height).toBe(100);
    expect(lines(element)[0]!.getBoundingClientRect().width).toBe(1);
  });

  it('renders with label', async () => {
    const element = await divider('label="Section"');
    expect(baseOf(element).textContent).toContain('Section');
  });

  it('renders the label centred with a line on both sides', async () => {
    const element = await divider('label="Center"');
    expect(baseOf(element).children).toHaveLength(3);
    const [before, after] = lines(element) as [HTMLElement, HTMLElement];
    const label = element.shadowRoot!.querySelector('[part~="label"]')!.getBoundingClientRect();
    expect(before.getBoundingClientRect().right).toBeCloseTo(label.left, 0);
    expect(after.getBoundingClientRect().left).toBeCloseTo(label.right, 0);
    expect(before.getBoundingClientRect().width).toBeCloseTo(
      after.getBoundingClientRect().width,
      0,
    );
  });

  it('applies the subtle variant by default, and strong when specified', async () => {
    const subtle = await divider();
    const strong = await divider('variant="strong"');
    expect(subtle.variant).toBe('subtle');
    const colour = (element: Element) => getComputedStyle(lines(element)[0]!).backgroundColor;
    expect(colour(subtle)).not.toBe(colour(strong));
    expect(colour(subtle)).not.toBe('rgba(0, 0, 0, 0)');
  });

  it('is one border-width thick in both weights (emphasis is colour only)', async () => {
    for (const variant of ['subtle', 'strong']) {
      const element = await divider(`variant="${variant}"`);
      expect(lines(element)[0]!.getBoundingClientRect().height).toBe(1);
    }
  });

  it('fills the width of its container', async () => {
    const element = await divider();
    expect(element.getBoundingClientRect().width).toBe(300);
    expect(lines(element)[0]!.getBoundingClientRect().width).toBe(300);
  });

  it('a vertical divider fills the height of its parent and separates neighbours', async () => {
    const root = await fixture<HTMLElement>(
      '<div style="display: flex; block-size: 80px; gap: 8px"><span>a</span><tct-divider orientation="vertical"></tct-divider><span>b</span></div>',
    );
    const element = root.querySelector('tct-divider')!;
    expect(element.getBoundingClientRect().height).toBe(80);
    expect(element.getBoundingClientRect().width).toBe(1);
  });

  it('applies full-bleed: cancels the padding of a padded container', async () => {
    const root = await fixture<HTMLElement>(
      `<div style="inline-size: 300px; padding: 20px; box-sizing: border-box;
        --container-padding-inline-start: 20px; --container-padding-inline-end: 20px">
        <tct-divider full-bleed></tct-divider></div>`,
    );
    const line = lines(root.querySelector('tct-divider')!)[0]!.getBoundingClientRect();
    const box = root.getBoundingClientRect();
    expect(line.left).toBeCloseTo(box.left, 0);
    expect(line.width).toBeCloseTo(300, 0);
  });

  it('full-bleed without a padded container does nothing', async () => {
    const element = await divider('full-bleed');
    expect(lines(element)[0]!.getBoundingClientRect().width).toBe(300);
  });

  it('a vertical full-bleed extends by the block padding', async () => {
    const root = await fixture<HTMLElement>(
      `<div style="display: flex; block-size: 100px; padding-block: 10px; box-sizing: border-box;
        --container-padding-block-start: 10px; --container-padding-block-end: 10px">
        <tct-divider orientation="vertical" full-bleed></tct-divider></div>`,
    );
    const element = root.querySelector('tct-divider')!;
    const line = lines(element)[0]!.getBoundingClientRect();
    expect(line.height).toBeCloseTo(100, 0);
  });

  it('passes through additional attributes', async () => {
    const element = await divider('id="rule" data-testid="d"');
    expect(element.id).toBe('rule');
  });

  it('renders markup in the label slot', async () => {
    const element = await divider('', '<span slot="label" id="custom">Custom</span>');
    expect(element.querySelector('#custom')).not.toBeNull();
    expect(lines(element)).toHaveLength(2);
    expect(
      element.shadowRoot!.querySelector<HTMLSlotElement>('slot[name="label"]')!.assignedElements(),
    ).toHaveLength(1);
  });

  it('renders a vertical divider with a label', async () => {
    const element = await divider(
      'orientation="vertical" label="Vertical"',
      '',
      'block-size: 120px',
    );
    expect(baseOf(element).textContent).toContain('Vertical');
    expect(lines(element)).toHaveLength(2);
    if (isChromium) {
      expect(await axNode(element)).toMatchObject({orientation: 'vertical', name: 'Vertical'});
    }
  });

  it('has no label parts without a label', async () => {
    const element = await divider();
    expect(element.shadowRoot!.querySelector('[part~="label"]')).toBeNull();
  });

  it('adds and removes the label when the attribute changes', async () => {
    const element = await divider();
    element.label = 'Later';
    await element.updateComplete;
    expect(lines(element)).toHaveLength(2);
    element.label = '';
    await element.updateComplete;
    expect(lines(element)).toHaveLength(1);
  });
});

describe('tct-divider: accessible name', () => {
  it('exposes the label as the accessible name of the separator', async () => {
    const element = await divider('label="Section"');
    if (isChromium) {
      expect(await axNode(element)).toMatchObject({role: 'separator', name: 'Section'});
    }
  });

  it('names the separator from a slotted label, and follows edits to it', async () => {
    const element = await divider('', '<span slot="label">Custom</span>');
    if (!isChromium) return;
    expect(await axNode(element)).toMatchObject({name: 'Custom'});
    element.querySelector('span')!.textContent = 'Changed';
    await new Promise((resolve) => setTimeout(resolve, 20));
    await element.updateComplete;
    expect(await axNode(element)).toMatchObject({name: 'Changed'});
  });

  it('has no name without a label', async () => {
    const element = await divider();
    if (isChromium) expect((await axNode(element)).name).toBe('');
  });

  it('prefers an explicit aria-label over the rendered label', async () => {
    const element = await divider('label="Section" aria-label="Custom name"');
    if (isChromium) expect(await axNode(element)).toMatchObject({name: 'Custom name'});
    expect(element.getAttribute('aria-label')).toBe('Custom name');
  });

  it('prefers aria-labelledby over the rendered label', async () => {
    const root = await fixture<HTMLElement>(
      '<div><span id="name">Outside name</span><tct-divider label="Section" aria-labelledby="name"></tct-divider></div>',
    );
    if (isChromium) {
      expect(await axNode(root.querySelector('tct-divider')!)).toMatchObject({
        name: 'Outside name',
      });
    }
  });

  it('passes axe for every orientation, variant and label form', async () => {
    for (const attributes of [
      '',
      'variant="strong"',
      'label="Section"',
      'orientation="vertical" label="Side"',
      'full-bleed',
    ]) {
      await expectAccessible(
        await divider(attributes, '', 'inline-size: 300px; block-size: 100px'),
      );
    }
    await expectAccessible(await divider('', '<em slot="label">Markup</em>'));
  });
});

describe('tct-divider: RTL and forced colours', () => {
  it('padding of a label is symmetric and full-bleed uses logical margins', async () => {
    const root = await fixture<HTMLElement>(
      `<div style="inline-size: 300px; padding: 20px; box-sizing: border-box;
        --container-padding-inline-start: 30px; --container-padding-inline-end: 10px">
        <tct-divider full-bleed></tct-divider></div>`,
      {dir: 'rtl'},
    );
    const line = lines(root.querySelector('tct-divider')!)[0]!.getBoundingClientRect();
    const box = root.getBoundingClientRect();
    // inline-start is the right edge in RTL: the rule extends 30px past the content box there.
    expect(Math.round(line.right - box.right)).toBe(-20 + 30);
    expect(Math.round(box.left - line.left)).toBe(-20 + 10);
  });

  it.skipIf(!isChromium)('keeps a visible rule in forced-colors mode', async () => {
    await emulateMedia({forcedColors: 'active'});
    const element = await divider('label="Section"');
    const colour = getComputedStyle(lines(element)[0]!).backgroundColor;
    expect(colour).not.toBe('rgba(0, 0, 0, 0)');
    await expectAccessible(element);
  });
});
