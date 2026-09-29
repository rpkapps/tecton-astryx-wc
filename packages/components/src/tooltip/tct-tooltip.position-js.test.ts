/**
 * Acceptance 8 (positioning), JS path: with `implicitAnchor` forced off (Tier 2, or a failed probe) the
 * tooltip is placed by the lazily loaded Floating UI fallback, and the placement vocabulary still holds.
 */
import {describe, expect, it} from 'vitest';
import {isFloatingLoaded} from '@tecton-astryx/core/layer/floating.js';
import {fixture} from '@tecton-astryx/testing/fixture.js';
import {withFeature} from '@tecton-astryx/testing/tier.js';
import {nextFrame, waitUntil} from '@tecton-astryx/testing/timing.js';
import './define.js';
import type {TctTooltip} from './tct-tooltip.js';

const rect = (element: Element): DOMRect => element.getBoundingClientRect();
const surfaceOf = (tip: TctTooltip): HTMLElement =>
  tip.querySelector<HTMLElement>(':scope > tct-tooltip-surface')!;

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
  await waitUntil(() => surfaceOf(tip).style.left !== '', 'floating placed the surface');
  await nextFrame();
  return tip;
}

describe('tct-tooltip: Floating UI fallback (acceptance 8)', () => {
  it('with implicitAnchor off, the tooltip is placed above the trigger by Floating UI', async () => {
    await withFeature('implicitAnchor', false, async () => {
      const tip = await stage('');
      const trigger = tip.querySelector('button')!;
      expect(isFloatingLoaded(), 'the fallback module is loaded on this path').toBe(true);
      expect(surfaceOf(tip).style.getPropertyValue('position-area')).toBe('');
      expect(rect(surfaceOf(tip)).bottom).toBeLessThanOrEqual(rect(trigger).top + 1);
      expect(
        Math.abs(
          rect(surfaceOf(tip)).left +
            rect(surfaceOf(tip)).width / 2 -
            (rect(trigger).left + rect(trigger).width / 2),
        ),
      ).toBeLessThan(3);
      expect(surfaceOf(tip).getAttribute('data-placement')).toBe('above');
    });
  });

  it('RTL: "start" is placed on the right of the trigger', async () => {
    await withFeature('implicitAnchor', false, async () => {
      const tip = await stage('placement="start"', 'rtl');
      const trigger = tip.querySelector('button')!;
      expect(rect(surfaceOf(tip)).left).toBeGreaterThanOrEqual(rect(trigger).right - 2);
      expect(surfaceOf(tip).getAttribute('data-placement')).toBe('start');
    });
  });
});
