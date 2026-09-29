/**
 * tct-aspect-ratio: ratio boxes, shapes and fit modes (ported from upstream AspectRatio.test.tsx),
 * responsive overrides, accessibility, forced colours.
 */
import {html} from 'lit';
import {describe, expect, it, vi} from 'vitest';
import {resetDevWarnings} from '@tecton-wc/core/utils/dev.js';
import {expectAccessible} from '@tecton-wc/testing/a11y.js';
import {emulateMedia} from '@tecton-wc/testing/emulate.js';
import {fixture} from '@tecton-wc/testing/fixture.js';
import {runElementSuite} from '@tecton-wc/testing/suites/element.js';
import {isChromium} from '@tecton-wc/testing/tier.js';
import {toCssRatio} from './aspect-ratio.types.js';
import './define.js';
import type {TctAspectRatio} from './tct-aspect-ratio.js';

const baseOf = (element: Element): HTMLElement =>
  element.shadowRoot!.querySelector<HTMLElement>('[part~="base"]')!;
const childOf = (element: Element): HTMLElement =>
  element.shadowRoot!.querySelector<HTMLElement>('.child')!;

/** A 1x1 transparent gif, so images have a natural size without a network request. */
const PIXEL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

async function box(attributes: string, content = '<div id="child">content</div>', width = 400) {
  const root = await fixture<HTMLElement>(
    `<div style="inline-size: ${width}px"><tct-aspect-ratio ${attributes}>${content}</tct-aspect-ratio></div>`,
  );
  return root.querySelector<TctAspectRatio>('tct-aspect-ratio')!;
}

const size = (element: Element) => {
  const rect = baseOf(element).getBoundingClientRect();
  return {width: rect.width, height: rect.height};
};

runElementSuite({
  tag: 'tct-aspect-ratio',
  render: () => html`<tct-aspect-ratio ratio="2"><div>content</div></tct-aspect-ratio>`,
  properties: {ratio: 1.5, shape: 'ellipse', fit: 'cover'},
  attributes: {shape: 'shape', fit: 'fit'},
});

describe('toCssRatio', () => {
  it('accepts numbers, numeric strings and fractions', () => {
    expect(toCssRatio(16 / 9)).toBe(String(16 / 9));
    expect(toCssRatio('1.5')).toBe('1.5');
    expect(toCssRatio('16/9')).toBe('16 / 9');
    expect(toCssRatio(' 4 / 3 ')).toBe('4 / 3');
  });

  it('rejects everything that is not a positive ratio', () => {
    for (const bad of [undefined, null, '', 'wide', 0, -1, NaN, Infinity, '0/9', '16/0', {}]) {
      expect(toCssRatio(bad)).toBeUndefined();
    }
  });
});

describe('tct-aspect-ratio: ratios (AspectRatio.test.tsx)', () => {
  it.each([
    ['16 / 9 as a fraction', '16/9', 400, 225],
    ['16:9 as a decimal', '1.7778', 400, 225],
    ['4:3', '4/3', 400, 300],
    ['1:1 square', '1', 400, 400],
    ['21:9 ultrawide', '21/9', 420, 180],
  ])('renders with correct aspect ratio: %s', async (_name, ratio, width, height) => {
    const element = await box(`ratio="${ratio}"`, '<div>x</div>', width);
    const {width: w, height: h} = size(element);
    expect(w).toBe(width);
    expect(h).toBeCloseTo(height, 0);
  });

  it('accepts a number property, like ratio={16 / 9}', async () => {
    const element = await box('');
    element.ratio = 16 / 9;
    await element.updateComplete;
    expect(size(element).height).toBeCloseTo(225, 0);
  });

  it('takes its width from the container and follows a resize', async () => {
    const root = await fixture<HTMLElement>(
      '<div id="wrap" style="inline-size: 400px"><tct-aspect-ratio ratio="2"><div>x</div></tct-aspect-ratio></div>',
    );
    const element = root.querySelector('tct-aspect-ratio')!;
    expect(size(element).height).toBe(200);
    root.style.inlineSize = '200px';
    expect(size(element).height).toBe(100);
  });

  it('children fill the container', async () => {
    const element = await box('ratio="2"');
    const child = childOf(element).getBoundingClientRect();
    expect(child.width).toBe(400);
    expect(child.height).toBe(200);
  });

  it('falls back to a square and warns in dev mode when the ratio is missing', async () => {
    globalThis.tctDevMode = true;
    resetDevWarnings();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      const element = await box('');
      expect(size(element)).toEqual({width: 400, height: 400});
      expect(warn).toHaveBeenCalled();
    } finally {
      warn.mockRestore();
      globalThis.tctDevMode = undefined;
    }
  });

  it('renders an ellipse that respects the ratio (circle at 1:1)', async () => {
    const element = await box('ratio="1" shape="ellipse"', '<div>x</div>', 200);
    expect(getComputedStyle(baseOf(element)).borderTopLeftRadius).toBe('50%');
    expect(size(element)).toEqual({width: 200, height: 200});
  });

  it('an ellipse respects a non-square ratio (oval)', async () => {
    const element = await box('ratio="2" shape="ellipse"', '<div>x</div>', 200);
    expect(size(element)).toEqual({width: 200, height: 100});
    expect(getComputedStyle(baseOf(element)).borderTopLeftRadius).toBe('50%');
  });

  it('defaults to the rectangle shape, and clips its content', async () => {
    const element = await box('ratio="2"');
    expect(element.shape).toBe('rectangle');
    expect(element.getAttribute('shape')).toBe('rectangle');
    expect(getComputedStyle(baseOf(element)).borderTopLeftRadius).toBe('0px');
    expect(getComputedStyle(baseOf(element)).overflowX).toBe('clip');
  });

  it('passes through additional attributes', async () => {
    const element = await box('ratio="2" id="hero" data-testid="ar"');
    expect(element.id).toBe('hero');
    expect(element.getAttribute('data-testid')).toBe('ar');
  });

  it('renders different content types', async () => {
    const element = await box(
      'ratio="2"',
      '<img id="a" src="' + PIXEL + '" alt=""><video id="b"></video>',
    );
    expect(element.querySelector('#a')).not.toBeNull();
    expect(element.querySelector('#b')).not.toBeNull();
  });

  it('does not collapse with long or empty content', async () => {
    const empty = await box('ratio="2"', '');
    expect(size(empty).height).toBe(200);
    const long = await box('ratio="2"', '<p>' + 'word '.repeat(500) + '</p>');
    expect(size(long).height).toBe(200);
  });
});

describe('tct-aspect-ratio: responsive ratio', () => {
  it('emits the ratio through a custom property, not an inline aspect-ratio', async () => {
    const element = await box('ratio="2"');
    expect(baseOf(element).style.aspectRatio).toBe('');
    expect(baseOf(element).style.getPropertyValue('--_ratio')).toBe('2');
  });

  it('lets a consumer rule on the part win, including inside a media query', async () => {
    const element = await box('ratio="2"');
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(
      '@media (min-width: 1px) { tct-aspect-ratio::part(base) { aspect-ratio: 4 / 1; } }',
    );
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
    try {
      expect(size(element).height).toBe(100);
    } finally {
      document.adoptedStyleSheets = document.adoptedStyleSheets.filter((s) => s !== sheet);
    }
  });
});

describe('tct-aspect-ratio: fit', () => {
  it('reflects fit and marks the content wrapper', async () => {
    const element = await box('ratio="2" fit="cover"', `<img src="${PIXEL}" alt="">`);
    expect(element.getAttribute('fit')).toBe('cover');
    expect(childOf(element).dataset.fit).toBe('cover');
  });

  it('cover sizes the child to the box and crops media with object-fit: cover', async () => {
    const element = await box('ratio="2" fit="cover"', `<img id="i" src="${PIXEL}" alt="">`);
    const image = element.querySelector<HTMLImageElement>('#i')!;
    expect(image.getBoundingClientRect().width).toBe(400);
    expect(image.getBoundingClientRect().height).toBe(200);
    expect(getComputedStyle(image).objectFit).toBe('cover');
  });

  it('contain sizes the child to the box and letterboxes media with object-fit: contain', async () => {
    const element = await box('ratio="2" fit="contain"', `<img id="i" src="${PIXEL}" alt="">`);
    const image = element.querySelector<HTMLImageElement>('#i')!;
    expect(image.getBoundingClientRect().width).toBe(400);
    expect(getComputedStyle(image).objectFit).toBe('contain');
  });

  it('cover and contain stretch a non-media child to fill the box', async () => {
    const element = await box('ratio="2" fit="cover"');
    const child = element.querySelector<HTMLElement>('#child')!;
    expect(child.getBoundingClientRect().height).toBe(200);
    expect(getComputedStyle(child).objectFit).toBe('fill');
  });

  it('center keeps the natural size and centres the child in the box', async () => {
    const element = await box(
      'ratio="2" fit="center"',
      '<div id="child" style="inline-size: 40px; block-size: 20px">x</div>',
    );
    const child = element.querySelector('#child')!.getBoundingClientRect();
    expect(child.width).toBe(40);
    expect(
      Math.round(child.left + child.width / 2 - (element.getBoundingClientRect().left + 200)),
    ).toBe(0);
    expect(
      Math.round(child.top + child.height / 2 - (element.getBoundingClientRect().top + 100)),
    ).toBe(0);
  });

  it('leaves the child alone without fit, so it styles itself', async () => {
    const element = await box(
      'ratio="2"',
      `<img id="i" src="${PIXEL}" alt="" width="10" height="10">`,
    );
    const image = element.querySelector('#i')!.getBoundingClientRect();
    expect(image.width).toBe(10);
    expect(getComputedStyle(element.querySelector('#i')!).objectFit).toBe('fill');
  });

  it('never touches the child: its own styles win over the fit sizing', async () => {
    const element = await box(
      'ratio="2" fit="cover"',
      `<img id="i" src="${PIXEL}" alt="" style="object-fit: contain; inline-size: 50%; block-size: 50%">`,
    );
    const image = element.querySelector<HTMLImageElement>('#i')!;
    expect(getComputedStyle(image).objectFit).toBe('contain');
    expect(image.getBoundingClientRect().width).toBe(200);
  });

  it('does not centre the wrapper for other fit values', async () => {
    const element = await box('ratio="2" fit="cover"');
    expect(getComputedStyle(childOf(element)).display).toBe('block');
  });
});

describe('tct-aspect-ratio: accessibility and forced colours', () => {
  it('adds no role or name: the child carries the description', async () => {
    const element = await box('ratio="2" fit="cover"', `<img src="${PIXEL}" alt="A well pad">`);
    await expectAccessible(element);
  });

  it('passes axe for a decorative image and for text content', async () => {
    await expectAccessible(await box('ratio="1" fit="contain"', `<img src="${PIXEL}" alt="">`));
    await expectAccessible(await box('ratio="2"', '<p>Caption</p>'));
  });

  it.skipIf(!isChromium)('keeps its size and elliptical clip in forced-colors mode', async () => {
    await emulateMedia({forcedColors: 'active'});
    const element = await box('ratio="2" shape="ellipse"', '<div>x</div>', 200);
    expect(size(element).height).toBe(100);
    expect(getComputedStyle(baseOf(element)).borderTopLeftRadius).toBe('50%');
    await expectAccessible(element);
  });

  it('is symmetrical in RTL', async () => {
    const root = await fixture<HTMLElement>(
      '<div style="inline-size: 300px"><tct-aspect-ratio ratio="2" fit="center"><div id="c" style="inline-size: 30px">x</div></tct-aspect-ratio></div>',
      {dir: 'rtl'},
    );
    const box = root.querySelector('tct-aspect-ratio')!.getBoundingClientRect();
    const child = root.querySelector('#c')!.getBoundingClientRect();
    expect(Math.round(child.left + child.width / 2 - (box.left + box.width / 2))).toBe(0);
  });
});
