/**
 * Acceptance 8 (positioning), CSS path: the tooltip is placed by CSS anchor positioning (the trigger is
 * the popover's implicit anchor) and the Floating UI module is never fetched. Each test file runs in a
 * fresh page, so "not loaded" is meaningful here; the forced fallback is in
 * `tct-tooltip.position-js.test.ts`. RTL `start` placement flips the side.
 */
import {describe, expect, it} from 'vitest';
import {features} from '@tecton-wc/core/features.js';
import {isFloatingLoaded} from '@tecton-wc/core/layer/floating.js';
import {fixture} from '@tecton-wc/testing/fixture.js';
import {isTier2} from '@tecton-wc/testing/tier.js';
import {nextFrame, waitUntil} from '@tecton-wc/testing/timing.js';
import './define.js';
import type {TctTooltip} from './tct-tooltip.js';

const cssPath = describe.skipIf(isTier2);

async function stage(attributes: string, dir?: 'rtl'): Promise<TctTooltip> {
  const container = await fixture<HTMLDivElement>(
    `<div style="position:relative;block-size:300px" ${dir ? `dir="${dir}"` : ''}>` +
      `<tct-tooltip content="Positioned tip" delay="0" ${attributes}>` +
      `<button style="position:absolute;inset-inline-start:180px;inset-block-start:130px;inline-size:80px;block-size:30px">T</button>` +
      `</tct-tooltip></div>`,
  );
  const tip = container.querySelector<TctTooltip>('tct-tooltip')!;
  await tip.updateComplete;
  await tip.show();
  await nextFrame();
  await nextFrame();
  return tip;
}

const rect = (element: Element): DOMRect => element.getBoundingClientRect();
const surfaceOf = (tip: TctTooltip): HTMLElement =>
  tip.querySelector<HTMLElement>(':scope > tct-tooltip-surface')!;
const near = (actual: number, expected: number, message: string): void => {
  expect(Math.abs(actual - expected), `${message}: ${actual} vs ${expected}`).toBeLessThan(2);
};

cssPath('tct-tooltip: CSS anchor positioning (acceptance 8)', () => {
  it('is placed above the trigger, centred, by CSS anchor positioning, without loading Floating UI', async () => {
    expect(features.implicitAnchor).toBe(true);
    const tip = await stage('');
    const trigger = tip.querySelector('button')!;
    near(rect(surfaceOf(tip)).bottom, rect(trigger).top - 4, 'above, with the 4px clearance');
    near(
      rect(surfaceOf(tip)).left + rect(surfaceOf(tip)).width / 2,
      rect(trigger).left + rect(trigger).width / 2,
      'centred on the trigger',
    );
    expect(surfaceOf(tip).style.getPropertyValue('position-area')).not.toBe('');
    expect(isFloatingLoaded(), 'the Floating UI module was fetched on the CSS path').toBe(false);
  });

  it('placement="below", "start" and "end" put the popup on that side of the trigger', async () => {
    const below = await stage('placement="below"');
    let trigger = below.querySelector('button')!;
    near(rect(surfaceOf(below)).top, rect(trigger).bottom + 4, 'below');

    const end = await stage('placement="end"');
    trigger = end.querySelector('button')!;
    near(rect(surfaceOf(end)).left, rect(trigger).right + 4, 'end (right in LTR)');

    const start = await stage('placement="start"');
    trigger = start.querySelector('button')!;
    near(rect(surfaceOf(start)).right, rect(trigger).left - 4, 'start (left in LTR)');
    expect(isFloatingLoaded()).toBe(false);
  });

  it('RTL: "start" flips to the right of the trigger and "end" to the left', async () => {
    const start = await stage('placement="start"', 'rtl');
    let trigger = start.querySelector('button')!;
    expect(rect(surfaceOf(start)).left).toBeGreaterThanOrEqual(rect(trigger).right - 2);

    const end = await stage('placement="end"', 'rtl');
    trigger = end.querySelector('button')!;
    expect(rect(surfaceOf(end)).right).toBeLessThanOrEqual(rect(trigger).left + 2);
    expect(isFloatingLoaded()).toBe(false);
  });

  it('flips below when there is no room above, keeping the clearance, and reports data-placement', async () => {
    const container = await fixture<HTMLDivElement>(
      `<div style="position:relative"><tct-tooltip content="Tip" delay="0">` +
        `<button style="position:fixed;inset-inline-start:200px;inset-block-start:4px;inline-size:80px;block-size:30px">T</button>` +
        `</tct-tooltip></div>`,
    );
    const tip = container.querySelector<TctTooltip>('tct-tooltip')!;
    await tip.updateComplete;
    await tip.show();
    await nextFrame();
    const trigger = tip.querySelector('button')!;
    expect(rect(surfaceOf(tip)).top).toBeGreaterThanOrEqual(rect(trigger).bottom - 1);
    near(rect(surfaceOf(tip)).top - rect(trigger).bottom, 4, 'the clearance survives the flip');
    await waitUntil(
      () => surfaceOf(tip).getAttribute('data-placement') === 'below',
      'data-placement follows the flip',
    );
  });
});
