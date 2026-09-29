/**
 * Anchored positioning on the CSS path (A§9.10, A-09): `showPopover({source})` implicit anchors with
 * inline `position-area`. Also asserts the dependency rule: the Floating UI fallback module is NEVER
 * fetched on this path. (Each test file runs in a fresh page, so "not loaded" is meaningful here; the
 * forced fallback is in `position-js.test.ts`.)
 */
import {html} from 'lit';
import {beforeAll, describe, expect, it} from 'vitest';
import {defineElement} from '@tecton-astryx/core/define.js';
import {features} from '@tecton-astryx/core/features.js';
import {isFloatingLoaded} from '@tecton-astryx/core/layer/floating.js';
import {fixture} from '../fixture.js';
import {TctTestLayer} from '../fixtures/test-layer.js';
import {isTier2} from '../tier.js';
import {nextFrame, waitUntil} from '../timing.js';

beforeAll(() => {
  defineElement(TctTestLayer);
});

const cssPath = describe.skipIf(isTier2);

/** A stage with the trigger at a known spot. */
async function stage(
  attributes: string,
  triggerStyle = 'left:120px;top:100px;',
  dir?: 'rtl',
): Promise<TctTestLayer> {
  const container = await fixture<HTMLDivElement>(
    `<div style="position:relative;block-size:420px" ${dir ? `dir="${dir}"` : ''}>` +
      `<tct-test-layer ${attributes} open>` +
      `<button slot="trigger" style="position:absolute;inline-size:80px;block-size:30px;${triggerStyle}">T</button>` +
      `<div style="inline-size:100px;block-size:50px">content</div>` +
      `</tct-test-layer></div>`,
  );
  const layer = container.querySelector<TctTestLayer>('tct-test-layer')!;
  await waitUntil(() => layer.surface!.matches(':popover-open'), 'open');
  await nextFrame();
  await nextFrame();
  return layer;
}

const rect = (element: Element): DOMRect => element.getBoundingClientRect();
const near = (actual: number, expected: number, message: string): void => {
  expect(Math.abs(actual - expected), `${message}: ${actual} vs ${expected}`).toBeLessThan(1.5);
};

cssPath('CSS anchor positioning (implicit anchor)', () => {
  it('the probe finds implicit anchors in Chromium and the CSS path is chosen', async () => {
    expect(features.anchorPositioning).toBe(true);
    expect(features.implicitAnchor).toBe(true);
    const layer = await stage('placement="below" alignment="start"');
    expect(layer.position.strategy).toBe('css');
    expect(layer.position.showOptions?.source).toBe(layer.trigger);
  });

  it('places the surface below the trigger, aligned to its inline start, with the clearance', async () => {
    const layer = await stage('placement="below" alignment="start" offset="8px"');
    const trigger = rect(layer.trigger!);
    const surface = rect(layer.surface!);
    near(surface.top, trigger.bottom + 8, 'below with 8px gap');
    near(surface.left, trigger.left, 'inline-start aligned');
    expect(layer.surface!.getAttribute('data-placement')).toBe('below');
  });

  it('places above, and centres / end-aligns on the trigger', async () => {
    const above = await stage(
      'placement="above" alignment="center" offset="8px"',
      'left:120px;top:200px;',
    );
    let trigger = rect(above.trigger!);
    let surface = rect(above.surface!);
    near(surface.bottom, trigger.top - 8, 'above with 8px gap');
    near(surface.left + surface.width / 2, trigger.left + trigger.width / 2, 'centred');

    const end = await stage('placement="below" alignment="end"', 'left:120px;top:100px;');
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

    const end = await stage('placement="end" alignment="center"', 'left:120px;top:150px;');
    trigger = rect(end.trigger!);
    surface = rect(end.surface!);
    near(surface.left, trigger.right, 'right of the trigger in LTR');
    near(surface.top + surface.height / 2, trigger.top + trigger.height / 2, 'centred vertically');
  });

  it('mirrors inline placements in RTL', async () => {
    const start = await stage(
      'placement="start" alignment="start"',
      'right:220px;top:100px;',
      'rtl',
    );
    let trigger = rect(start.trigger!);
    let surface = rect(start.surface!);
    // inline-start in RTL is the right side.
    expect(surface.left).toBeGreaterThanOrEqual(trigger.right - 1.5);

    const below = await stage(
      'placement="below" alignment="start"',
      'right:120px;top:100px;',
      'rtl',
    );
    trigger = rect(below.trigger!);
    surface = rect(below.surface!);
    near(
      surface.right,
      trigger.right,
      'aligned to the inline START edge, which is the right one in RTL',
    );
  });

  it('flips to the other side when there is no room, keeping the clearance on the flipped side', async () => {
    const layer = await stage(
      'placement="below" alignment="start" offset="8px"',
      // Bottom edge of the small test viewport: no room below.
      'position:fixed;left:120px;bottom:5px;',
    );
    const trigger = rect(layer.trigger!);
    const surface = rect(layer.surface!);
    expect(surface.bottom).toBeLessThanOrEqual(trigger.top + 1);
    // Upstream #4803: margins on BOTH edges of the axis, so the gap survives the flip.
    near(trigger.top - surface.bottom, 8, 'gap after flip');
    await waitUntil(
      () => layer.surface!.getAttribute('data-placement') === 'above',
      'data-placement follows the flip',
    );
  });

  it('matches the anchor width', async () => {
    const exact = await stage(
      'placement="below" alignment="start" match-anchor-width',
      'left:120px;top:100px;inline-size:200px;',
    );
    near(rect(exact.surface!).width, rect(exact.trigger!).width, 'exact width');
  });

  it('positions at a point with a virtual anchor, still on the CSS path', async () => {
    const container = await fixture<HTMLDivElement>(
      html`<div style="block-size:300px">
        <tct-test-layer placement="below" alignment="start"
          ><button slot="trigger">T</button>x</tct-test-layer
        >
      </div>`,
    );
    const layer = container.querySelector<TctTestLayer>('tct-test-layer')!;
    layer.point = {x: 150, y: 140};
    await layer.updateComplete;
    await layer.layer.show();
    await nextFrame();
    expect(layer.position.strategy).toBe('css');
    const surface = rect(layer.surface!);
    near(surface.left, 150, 'x of the point');
    near(surface.top, 140, 'y of the point');
    await layer.layer.hide();
    expect(document.querySelectorAll('body > div[style*="visibility:hidden"]')).toHaveLength(0);
  });

  it('removes its inline styles and data-placement when hidden', async () => {
    const layer = await stage('placement="below" alignment="start"');
    expect(layer.surface!.style.getPropertyValue('position-area')).not.toBe('');
    await layer.layer.hide();
    expect(layer.surface!.style.getPropertyValue('position-area')).toBe('');
    expect(layer.surface!.hasAttribute('data-placement')).toBe(false);
  });

  it('update() re-applies placement while open', async () => {
    const layer = await stage('placement="below" alignment="start"');
    layer.placement = 'above';
    layer.position.update();
    await nextFrame();
    const trigger = rect(layer.trigger!);
    expect(rect(layer.surface!).bottom).toBeLessThanOrEqual(trigger.top + 1);
    expect(layer.surface!.getAttribute('data-placement')).toBe('above');
  });

  it('never fetches the Floating UI fallback on this path', async () => {
    const layer = await stage('placement="below" alignment="center"');
    await layer.layer.hide();
    await layer.layer.show();
    expect(isFloatingLoaded()).toBe(false);
    const fetched = performance
      .getEntriesByType('resource')
      .map((entry) => entry.name)
      .filter((name) => /floating-ui/i.test(name));
    expect(fetched).toEqual([]);
  });
});
