/**
 * The Floating UI fallback (A§9.10, Tier 2): the same placements as the CSS path, computed in JS by a
 * lazily imported `@floating-ui/dom`. Forced with `strategy="js"` (or by turning `implicitAnchor`
 * off, which is what `TCT_TIER2=1` does): RTL `start` flips the physical side, flips and shifts keep
 * the surface on screen, `data-placement` reports the side actually used.
 */
import {beforeAll, describe, expect, it} from 'vitest';
import {defineElement} from '@tecton-wc/core/define.js';
import {overrideFeature} from '@tecton-wc/core/features.js';
import {isFloatingLoaded} from '@tecton-wc/core/layer/floating.js';
import {fixture} from '../fixture.js';
import {TctTestLayer} from '../fixtures/test-layer.js';
import {nextFrame, waitUntil} from '../timing.js';

beforeAll(() => {
  defineElement(TctTestLayer);
});

async function stage(
  attributes: string,
  triggerStyle = 'left:120px;top:100px;',
  dir?: 'rtl',
): Promise<TctTestLayer> {
  const container = await fixture<HTMLDivElement>(
    `<div style="position:relative;block-size:420px" ${dir ? `dir="${dir}"` : ''}>` +
      `<tct-test-layer strategy="js" ${attributes} open>` +
      `<button slot="trigger" style="position:absolute;inline-size:80px;block-size:30px;${triggerStyle}">T</button>` +
      `<div style="inline-size:100px;block-size:50px">content</div>` +
      `</tct-test-layer></div>`,
  );
  const layer = container.querySelector<TctTestLayer>('tct-test-layer')!;
  await waitUntil(() => layer.surface!.style.left !== '', 'floating placed the surface');
  await nextFrame();
  return layer;
}

const rect = (element: Element): DOMRect => element.getBoundingClientRect();
const near = (actual: number, expected: number, message: string): void => {
  expect(Math.abs(actual - expected), `${message}: ${actual} vs ${expected}`).toBeLessThan(1.5);
};

describe('Floating UI fallback', () => {
  it('is lazily imported: nothing is fetched before a layer needs it', async () => {
    expect(isFloatingLoaded()).toBe(false);
    const layer = await stage('placement="below" alignment="start"');
    expect(isFloatingLoaded()).toBe(true);
    expect(layer.position.strategy).toBe('js');
    expect(layer.position.showOptions).toBeUndefined();
  });

  it('places below the trigger, inline-start aligned, with the clearance', async () => {
    const layer = await stage('placement="below" alignment="start" offset="8px"');
    const trigger = rect(layer.trigger!);
    const surface = rect(layer.surface!);
    near(surface.top, trigger.bottom + 8, 'below with 8px gap');
    near(surface.left, trigger.left, 'inline-start aligned');
    expect(layer.surface!.style.position).toBe('fixed');
    expect(layer.surface!.getAttribute('data-placement')).toBe('below');
  });

  it('places above centred, and end-aligned', async () => {
    const above = await stage(
      'placement="above" alignment="center" offset="8px"',
      'left:120px;top:200px;',
    );
    let trigger = rect(above.trigger!);
    let surface = rect(above.surface!);
    near(surface.bottom, trigger.top - 8, 'above with 8px gap');
    near(surface.left + surface.width / 2, trigger.left + trigger.width / 2, 'centred');
    expect(above.surface!.getAttribute('data-placement')).toBe('above');

    const end = await stage('placement="below" alignment="end"');
    trigger = rect(end.trigger!);
    surface = rect(end.surface!);
    near(surface.right, trigger.right, 'inline-end aligned');
  });

  it('places to the inline start and end of the trigger', async () => {
    const start = await stage(
      'placement="start" alignment="start" offset="4px"',
      'left:200px;top:100px;',
    );
    let trigger = rect(start.trigger!);
    let surface = rect(start.surface!);
    near(surface.right, trigger.left - 4, 'left of the trigger in LTR');
    near(surface.top, trigger.top, 'block-start aligned');
    expect(start.surface!.getAttribute('data-placement')).toBe('start');

    const end = await stage('placement="end" alignment="center"', 'left:120px;top:150px;');
    trigger = rect(end.trigger!);
    surface = rect(end.surface!);
    near(surface.left, trigger.right, 'right of the trigger in LTR');
    expect(end.surface!.getAttribute('data-placement')).toBe('end');
  });

  it('RTL: start placement flips the physical side, and start alignment follows the inline start', async () => {
    const start = await stage(
      'placement="start" alignment="start"',
      'right:220px;top:100px;',
      'rtl',
    );
    let trigger = rect(start.trigger!);
    let surface = rect(start.surface!);
    expect(surface.left).toBeGreaterThanOrEqual(trigger.right - 1.5);
    expect(start.surface!.getAttribute('data-placement')).toBe('start');

    const below = await stage(
      'placement="below" alignment="start"',
      'right:120px;top:100px;',
      'rtl',
    );
    trigger = rect(below.trigger!);
    surface = rect(below.surface!);
    near(surface.right, trigger.right, 'aligned to the right (inline start) edge');
  });

  it('flips when there is no room and reports the side actually used', async () => {
    const layer = await stage(
      'placement="below" alignment="start" offset="8px"',
      'position:fixed;left:120px;bottom:5px;',
    );
    const trigger = rect(layer.trigger!);
    const surface = rect(layer.surface!);
    expect(surface.bottom).toBeLessThanOrEqual(trigger.top + 1);
    near(trigger.top - surface.bottom, 8, 'gap after flip');
    expect(layer.surface!.getAttribute('data-placement')).toBe('above');
  });

  it('shifts to stay inside the viewport', async () => {
    const layer = await stage(
      'placement="below" alignment="start"',
      'position:fixed;right:2px;top:100px;',
    );
    const surface = rect(layer.surface!);
    expect(surface.right).toBeLessThanOrEqual(window.innerWidth + 0.5);
    expect(surface.left).toBeGreaterThanOrEqual(-0.5);
  });

  it('matches the anchor width', async () => {
    const layer = await stage(
      'placement="below" alignment="start" match-anchor-width',
      'left:120px;top:100px;inline-size:200px;',
    );
    near(rect(layer.surface!).width, 200, 'exact width');
  });

  it('positions at a point (virtual anchor)', async () => {
    const container = await fixture<HTMLDivElement>(
      `<div style="block-size:300px"><tct-test-layer strategy="js" placement="below" alignment="start"><button slot="trigger">T</button>x</tct-test-layer></div>`,
    );
    const layer = container.querySelector<TctTestLayer>('tct-test-layer')!;
    layer.point = {x: 150, y: 140};
    await layer.updateComplete;
    await layer.layer.show();
    await waitUntil(() => layer.surface!.style.left !== '', 'placed');
    await nextFrame();
    const surface = rect(layer.surface!);
    near(surface.left, 150, 'x of the point');
    near(surface.top, 140, 'y of the point');
  });

  it('removes its inline styles when hidden and stops tracking', async () => {
    const layer = await stage('placement="below" alignment="start"');
    await layer.layer.hide();
    for (const property of ['left', 'top', 'position', 'max-inline-size']) {
      expect(layer.surface!.style.getPropertyValue(property), property).toBe('');
    }
    expect(layer.surface!.hasAttribute('data-placement')).toBe(false);
  });

  it('is what an auto layer uses when the implicit-anchor probe is off (Tier 2)', async () => {
    const restore = overrideFeature('implicitAnchor', false);
    try {
      const container = await fixture<HTMLDivElement>(
        `<div style="block-size:300px"><tct-test-layer placement="below" alignment="start" open>` +
          `<button slot="trigger" style="position:absolute;left:120px;top:100px">T</button>x</tct-test-layer></div>`,
      );
      const layer = container.querySelector<TctTestLayer>('tct-test-layer')!;
      await waitUntil(() => layer.surface!.style.left !== '', 'placed by the fallback');
      expect(layer.position.strategy).toBe('js');
    } finally {
      restore();
    }
  });
});
