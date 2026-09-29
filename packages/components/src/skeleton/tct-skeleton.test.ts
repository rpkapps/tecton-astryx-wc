import {html} from 'lit';
import {describe, expect, it} from 'vitest';
import {axNode, expectAccessible} from '@tecton-wc/testing/a11y.js';
import {emulateMedia} from '@tecton-wc/testing/emulate.js';
import {fixture} from '@tecton-wc/testing/fixture.js';
import {runElementSuite} from '@tecton-wc/testing/suites/element.js';
import {isChromium} from '@tecton-wc/testing/tier.js';
import {SKELETON_RADII} from './skeleton.types.js';
import './define.js';
import type {TctSkeleton} from './tct-skeleton.js';

const baseOf = (skeleton: TctSkeleton): HTMLElement =>
  skeleton.shadowRoot!.querySelector<HTMLElement>('.base')!;

runElementSuite({
  tag: 'tct-skeleton',
  render: () => `<tct-skeleton width="200" height="20"></tct-skeleton>`,
  properties: {width: '120', height: '16', radius: 'rounded', index: 2},
  attributes: {width: 'width', height: 'height', radius: 'radius', index: 'index'},
});

describe('tct-skeleton (Skeleton.test.tsx)', () => {
  it('renders a placeholder element', async () => {
    const skeleton = await fixture<TctSkeleton>(
      html`<tct-skeleton width="200" height="20"></tct-skeleton>`,
    );
    expect(baseOf(skeleton)).not.toBeNull();
    const box = baseOf(skeleton).getBoundingClientRect();
    expect([box.width, box.height]).toEqual([200, 20]);
  });

  it('is hidden from assistive tech by default (complex-20)', async () => {
    const skeleton = await fixture<TctSkeleton>(
      html`<tct-skeleton width="200" height="20"></tct-skeleton>`,
    );
    if (isChromium) expect((await axNode(skeleton)).ignored).toBe('true');
    // The default is element state, not an attribute on the host.
    expect(skeleton.hasAttribute('aria-hidden')).toBe(false);
  });

  it('allows the aria-hidden default to be overridden', async () => {
    const skeleton = await fixture<TctSkeleton>(
      html`<tct-skeleton width="200" height="20" aria-hidden="false"></tct-skeleton>`,
    );
    if (isChromium) expect((await axNode(skeleton)).ignored).toBeUndefined();
  });
});

describe('tct-skeleton: size', () => {
  it('a number or numeric string is pixels; a string is any CSS length', async () => {
    const skeleton = await fixture<TctSkeleton>(html`<tct-skeleton></tct-skeleton>`);
    skeleton.width = 120;
    skeleton.height = '3rem';
    await skeleton.updateComplete;
    const box = baseOf(skeleton).getBoundingClientRect();
    expect(box.width).toBe(120);
    expect(box.height).toBe(48);
    skeleton.width = '40%';
    await skeleton.updateComplete;
    expect(getComputedStyle(baseOf(skeleton)).inlineSize).toMatch(/px$/);
  });

  it('fills its container width by default', async () => {
    const wrapper = await fixture<HTMLElement>(
      html`<div style="inline-size: 240px"><tct-skeleton height="12"></tct-skeleton></div>`,
    );
    const skeleton = wrapper.querySelector<TctSkeleton>('tct-skeleton')!;
    expect(baseOf(skeleton).getBoundingClientRect().width).toBe(240);
  });

  it('the host draws no box of its own (the placeholder is an inner part)', async () => {
    const skeleton = await fixture<TctSkeleton>(
      html`<tct-skeleton width="50" height="10"></tct-skeleton>`,
    );
    expect(getComputedStyle(skeleton).backgroundColor).toBe('rgba(0, 0, 0, 0)');
    expect(getComputedStyle(baseOf(skeleton)).backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
  });
});

describe('tct-skeleton: radius scale', () => {
  const radiusOf = async (radius: string) => {
    const skeleton = await fixture<TctSkeleton>(
      html`<tct-skeleton width="40" height="40" radius=${radius}></tct-skeleton>`,
    );
    return getComputedStyle(baseOf(skeleton)).borderTopLeftRadius;
  };

  it('maps the numeric steps to the radius tokens', async () => {
    expect(await radiusOf('none')).toBe('0px');
    expect(await radiusOf('0')).toBe('0px');
    expect(await radiusOf('1')).toBe('2px');
    expect(await radiusOf('2')).toBe('4px');
    expect(await radiusOf('3')).toBe('8px');
    expect(await radiusOf('4')).toBe('8px');
  });

  it('rounded is fully rounded and the default is step 3', async () => {
    expect(parseFloat(await radiusOf('rounded'))).toBeGreaterThan(1000);
    const skeleton = await fixture<TctSkeleton>(
      html`<tct-skeleton width="9" height="9"></tct-skeleton>`,
    );
    expect(skeleton.radius).toBe(3);
    expect(getComputedStyle(baseOf(skeleton)).borderTopLeftRadius).toBe('8px');
  });

  it('parses numeric attributes to numbers and words to words', async () => {
    const skeleton = await fixture<TctSkeleton>(html`<tct-skeleton radius="2"></tct-skeleton>`);
    expect(skeleton.radius).toBe(2);
    skeleton.setAttribute('radius', 'rounded');
    expect(skeleton.radius).toBe('rounded');
    skeleton.removeAttribute('radius');
    expect(skeleton.radius).toBe(3);
    expect(SKELETON_RADII).toContain(skeleton.radius);
  });
});

describe('tct-skeleton: motion', () => {
  it('pulses after a 1000 ms hold and staggers by 100 ms per index', async () => {
    const wave = await fixture<HTMLElement>(
      html`<div>
        <tct-skeleton width="20" height="8" index="0"></tct-skeleton>
        <tct-skeleton width="20" height="8" index="1"></tct-skeleton>
        <tct-skeleton width="20" height="8" index="3"></tct-skeleton>
      </div>`,
    );
    const delays = [...wave.querySelectorAll<TctSkeleton>('tct-skeleton')].map(
      (skeleton) => getComputedStyle(baseOf(skeleton)).animationDelay,
    );
    expect(delays).toEqual(['1s', '1.1s', '1.3s']);
    const style = getComputedStyle(baseOf(wave.querySelector<TctSkeleton>('tct-skeleton')!));
    expect(style.animationName).toBe('tct-skeleton-fade');
    expect(style.animationIterationCount).toBe('infinite');
    expect(style.animationDirection).toBe('alternate');
  });

  it.skipIf(!isChromium)('shows a static placeholder under prefers-reduced-motion', async () => {
    await emulateMedia({reducedMotion: 'reduce'});
    const skeleton = await fixture<TctSkeleton>(
      html`<tct-skeleton width="20" height="8"></tct-skeleton>`,
    );
    expect(getComputedStyle(baseOf(skeleton)).animationName).toBe('none');
    expect(getComputedStyle(baseOf(skeleton)).opacity).toBe('0.25');
  });
});

describe('tct-skeleton: forced colours (WCAG 1.4.11)', () => {
  it.skipIf(!isChromium)(
    'paints GrayText at full opacity so the placeholder stays visible',
    async () => {
      const skeleton = await fixture<TctSkeleton>(
        html`<tct-skeleton width="20" height="8"></tct-skeleton>`,
      );
      const normal = getComputedStyle(baseOf(skeleton)).opacity;
      await emulateMedia({forcedColors: 'active'});
      const style = getComputedStyle(baseOf(skeleton));
      expect(normal).toBe('0.25');
      expect(style.opacity).toBe('1');
      expect(style.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
    },
  );
});

describe('tct-skeleton: accessibility and layout', () => {
  it('a loading region of skeletons passes axe with aria-busy', async () => {
    const region = await fixture<HTMLElement>(
      html`<section aria-busy="true" aria-label="Profile">
        <tct-skeleton width="40" height="40" radius="rounded"></tct-skeleton>
        <tct-skeleton width="200" height="16" index="1"></tct-skeleton>
        <tct-skeleton width="160" height="16" index="2"></tct-skeleton>
      </section>`,
    );
    await expectAccessible(region);
  });

  it('is not focusable and takes no part in the tab order', async () => {
    const skeleton = await fixture<TctSkeleton>(
      html`<tct-skeleton width="20" height="8"></tct-skeleton>`,
    );
    expect(skeleton.tabIndex).toBe(-1);
    expect(skeleton.shadowRoot!.querySelector('[tabindex]')).toBeNull();
  });

  it('lays out the same in right-to-left (the block has no direction)', async () => {
    const skeleton = await fixture<TctSkeleton>(
      html`<tct-skeleton width="30" height="10"></tct-skeleton>`,
      {dir: 'rtl'},
    );
    const box = baseOf(skeleton).getBoundingClientRect();
    expect([box.width, box.height]).toEqual([30, 10]);
  });
});
