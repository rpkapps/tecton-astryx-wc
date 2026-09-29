/**
 * The pure parts of the drag machinery: the magnet that eases a drag onto a stop, the constants a flick
 * and a promotion are judged by, and the transition-settled helper the layout swap waits for.
 */
import {describe, expect, it} from 'vitest';
import {fixture, nextFrame} from '@tecton-astryx/testing/index.js';
import {
  CONTENT_END_HANDOFF_SLOP,
  DISMISS_OVERSHOOT_RATIO,
  DRAG_PROMOTION_SLOP,
  FLICK_MIN_DISTANCE,
  FLICK_VELOCITY,
  MAGNET_RANGE,
  magnetize,
  OVERSCROLL_RESISTANCE,
  whenTransitionSettled,
} from './sheet-gestures.js';

describe('magnetize', () => {
  const stops = [0, 200, 400];

  it('leaves a value alone outside the magnet range of every stop', () => {
    expect(magnetize(100, stops)).toBe(100);
    expect(magnetize(300, stops)).toBe(300);
  });

  it('pulls a value toward the nearest stop inside the range, harder as it gets closer', () => {
    const near = magnetize(190, stops);
    const nearer = magnetize(198, stops);
    expect(near).toBeGreaterThan(190);
    expect(near).toBeLessThan(200);
    expect(nearer).toBeGreaterThan(near);
    expect(200 - nearer).toBeLessThan(200 - near);
  });

  it('lands exactly on a stop and does not overshoot it', () => {
    expect(magnetize(200, stops)).toBe(200);
    for (let value = 161; value < 240; value++) {
      const eased = magnetize(value, stops);
      expect(Math.abs(eased - 200)).toBeLessThanOrEqual(Math.abs(value - 200));
    }
  });

  it('works below the first stop and with a single stop', () => {
    expect(magnetize(-30, stops)).toBeGreaterThan(-30);
    expect(magnetize(20, [0])).toBeLessThan(20);
    expect(magnetize(90, [0])).toBe(90);
  });
});

describe('gesture constants', () => {
  it('judge a flick by speed and distance, and a promotion by slop', () => {
    expect(FLICK_VELOCITY).toBe(1.2);
    expect(FLICK_MIN_DISTANCE).toBe(48);
    expect(DISMISS_OVERSHOOT_RATIO).toBe(0.4);
    expect(MAGNET_RANGE).toBe(40);
    expect(OVERSCROLL_RESISTANCE).toBeGreaterThan(0);
    expect(OVERSCROLL_RESISTANCE).toBeLessThan(1);
    expect(CONTENT_END_HANDOFF_SLOP).toBeLessThan(DRAG_PROMOTION_SLOP);
    expect(DRAG_PROMOTION_SLOP).toBe(8);
  });
});

describe('whenTransitionSettled', () => {
  it('calls back at once when the element has no transition (reduced motion, a zero duration)', async () => {
    const root = await fixture<HTMLElement>('<div style="transition:none">x</div>');
    let called = 0;
    whenTransitionSettled(root, 'translate', () => {
      called++;
    });
    expect(called).toBe(1);
  });

  it('calls back once the transition ends, or after the backstop, and can be cancelled', async () => {
    const root = await fixture<HTMLElement>(
      '<div style="transition:translate 60ms linear;translate:0 0">x</div>',
    );
    let called = 0;
    whenTransitionSettled(root, 'translate', () => {
      called++;
    });
    root.style.translate = '0 40px';
    await nextFrame();
    expect(called).toBe(0);
    await new Promise((resolve) => setTimeout(resolve, 250));
    expect(called).toBe(1);

    let cancelled = 0;
    const cancel = whenTransitionSettled(root, 'translate', () => {
      cancelled++;
    });
    cancel();
    root.style.translate = '0 0';
    await new Promise((resolve) => setTimeout(resolve, 250));
    expect(cancelled).toBe(0);
  });

  it('ignores a transition of another property', async () => {
    const root = await fixture<HTMLElement>(
      '<div style="transition:opacity 40ms linear;opacity:1">x</div>',
    );
    let called = 0;
    whenTransitionSettled(root, 'translate', () => {
      called++;
    });
    // The element has no translate transition: it settles immediately.
    expect(called).toBe(1);
  });
});
