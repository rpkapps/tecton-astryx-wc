/**
 * Layer primitives without a host: the ref-counted scroll lock, the gesture counter, and the
 * placement-to-CSS mapping (`position-area`, fallbacks).
 */
import {afterEach, describe, expect, it} from 'vitest';
import {
  currentGesture,
  currentGestureHasClicked,
  noteGestureEvent,
  resetGesture,
} from './gesture.js';
import {isScrollLocked, lockScroll, resetScrollLock} from './scroll-lock.js';
import {positionAreaFor, positionTryFallbacksFor} from './position.js';

afterEach(() => {
  resetScrollLock();
  resetGesture();
  document.documentElement.removeAttribute('style');
});

describe('scroll lock', () => {
  it('locks and restores what the page had inline, not "empty"', () => {
    const root = document.documentElement;
    root.style.setProperty('overflow', 'scroll');
    const release = lockScroll();
    expect(isScrollLocked()).toBe(true);
    expect(root.style.getPropertyValue('overflow')).toBe('hidden');
    expect(root.style.getPropertyValue('scrollbar-gutter')).toBe('stable');
    release();
    expect(isScrollLocked()).toBe(false);
    expect(root.style.getPropertyValue('overflow')).toBe('scroll');
    expect(root.style.getPropertyValue('scrollbar-gutter')).toBe('');
  });

  it('is ref-counted: nested modals share one lock and release order does not matter', () => {
    const root = document.documentElement;
    const a = lockScroll();
    const b = lockScroll();
    a();
    expect(isScrollLocked()).toBe(true);
    expect(root.style.getPropertyValue('overflow')).toBe('hidden');
    b();
    expect(isScrollLocked()).toBe(false);
    expect(root.style.getPropertyValue('overflow')).toBe('');
  });

  it('each release function works once', () => {
    const a = lockScroll();
    const b = lockScroll();
    a();
    a();
    expect(isScrollLocked()).toBe(true);
    b();
    expect(isScrollLocked()).toBe(false);
  });
});

describe('gesture counter', () => {
  it('advances once per pointerdown or keydown, however many listeners read it', () => {
    const start = currentGesture();
    document.dispatchEvent(new PointerEvent('pointerdown', {bubbles: true}));
    expect(currentGesture()).toBe(start + 1);
    const event = new KeyboardEvent('keydown', {key: 'a'});
    document.dispatchEvent(event);
    noteGestureEvent(event);
    noteGestureEvent(event);
    expect(currentGesture()).toBe(start + 2);
  });

  it('knows whether the click of the current gesture already ran', () => {
    currentGesture();
    document.dispatchEvent(new PointerEvent('pointerdown', {bubbles: true}));
    expect(currentGestureHasClicked()).toBe(false);
    document.dispatchEvent(new MouseEvent('click', {bubbles: true}));
    expect(currentGestureHasClicked()).toBe(true);
    document.dispatchEvent(new PointerEvent('pointerdown', {bubbles: true}));
    expect(currentGestureHasClicked()).toBe(false);
  });
});

describe('placement mapping', () => {
  it('maps side and alignment to logical position-area keywords', () => {
    expect(positionAreaFor('below', 'start')).toBe(positionAreaFor('below', 'start'));
    const seen = new Set<string>();
    for (const placement of ['above', 'below', 'start', 'end'] as const) {
      for (const alignment of ['start', 'center', 'end'] as const) {
        const area = positionAreaFor(placement, alignment);
        expect(area, `${placement}/${alignment}`).toMatch(/\S/);
        seen.add(area);
      }
    }
    // Twelve distinct combinations, none collapsing into another.
    expect(seen.size).toBe(12);
  });

  it('block placements flip on the block axis first, inline placements on the inline axis first', () => {
    expect(positionTryFallbacksFor('below', 'start')).toBe(
      'flip-block, flip-inline, flip-block flip-inline',
    );
    expect(positionTryFallbacksFor('above', 'end')).toBe(
      'flip-block, flip-inline, flip-block flip-inline',
    );
    expect(positionTryFallbacksFor('start', 'start')).toBe(
      'flip-inline, flip-block, flip-block flip-inline',
    );
  });

  it('a centred layer gets span fallbacks so the browser can slide it along the alignment axis', () => {
    const centred = positionTryFallbacksFor('below', 'center');
    expect(centred).toContain('bottom span-left');
    expect(centred).toContain('top span-right');
    expect(positionTryFallbacksFor('end', 'center')).toContain('right span-top');
  });
});
