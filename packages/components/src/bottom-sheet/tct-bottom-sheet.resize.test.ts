/**
 * tct-bottom-sheet resizing: snap points, drag / flick / settle, the scrim, touch handoff from the body,
 * scroll reach at lower stops, and the non-drag alternatives (WCAG 2.5.7): the resizable handle is a
 * slider with keys, a tap cycles the stops, and no stop is reachable by dragging only.
 * Upstream test names (BottomSheet.test.tsx `snapPoints`, `height`) are kept where the behaviour applies.
 */
import {afterEach, describe, expect, it, vi} from 'vitest';
import type {TctSnapChangeEvent} from '@tecton-astryx/core/events/tct-snap-change.js';
import {resetDevWarnings} from '@tecton-astryx/core/utils/dev.js';
import {deepActiveElement} from '@tecton-astryx/core/utils/focus.js';
import {
  aTimeout,
  axNode,
  expectAccessible,
  expectEventFlags,
  fixture,
  nextFrame,
  pressKeys,
  recordEvents,
  waitUntil,
} from '@tecton-astryx/testing/index.js';
import './define.js';
import type {TctBottomSheet} from './tct-bottom-sheet.js';
import {
  bodyOf,
  dialogOf,
  drag,
  handleOf,
  offsetOf,
  openSheet,
  pointer,
  settled,
  sheetOf,
  touch,
} from './sheet-test-utils.js';

async function mount(attributes = '', content = '<p>Sheet content</p>'): Promise<TctBottomSheet> {
  const root = await fixture<HTMLElement>(
    `<div style="padding:40px"><tct-bottom-sheet label="Route" height="tall" ${attributes}>${content}</tct-bottom-sheet></div>`,
  );
  const el = root.querySelector<TctBottomSheet>('tct-bottom-sheet')!;
  await el.updateComplete;
  return el;
}

/** The visible height of the sheet at its resting stop, measured on screen. */
const visibleOnScreen = (el: TctBottomSheet): number =>
  window.innerHeight - sheetOf(el).getBoundingClientRect().top;
const scrimOf = (el: TctBottomSheet): number =>
  Number.parseFloat(dialogOf(el).style.getPropertyValue('--_sheet-scrim-opacity'));
const HALF = () => Math.round(window.innerHeight * 0.5);

describe('snapPoints', () => {
  it('has no stops of its own, so a released drag springs back', async () => {
    const el = await mount();
    await openSheet(el);
    expect(el.snapCount).toBe(1);
    await drag(handleOf(el), 500, 540, {stepMs: 80});
    await settled(el);
    expect(offsetOf(el)).toBe(0);
    expect(el.open).toBe(true);
  });

  it('rests at a stop given as a fraction of the viewport', async () => {
    const el = await mount('snap-points="0.5"');
    await openSheet(el);
    expect(el.snapCount).toBe(2);
    await drag(handleOf(el), 300, 520, {stepMs: 80});
    await settled(el);
    expect(el.snapIndex).toBe(1);
    expect(Math.round(visibleOnScreen(el))).toBe(HALF());
    expect(Math.round(el.visibleHeight)).toBe(HALF());
    expect(el.open).toBe(true);
  });

  it('reads a percentage as the same stop as the fraction', async () => {
    const el = await mount();
    el.snapPoints = ['50%'];
    await el.updateComplete;
    await openSheet(el);
    el.snapTo(1);
    await settled(el);
    expect(Math.round(visibleOnScreen(el))).toBe(HALF());
  });

  it('rests at a stop given as an absolute px length', async () => {
    const el = await mount('snap-points="320px"');
    await openSheet(el);
    el.snapTo(1);
    await settled(el);
    expect(Math.round(visibleOnScreen(el))).toBe(320);
  });

  it('accepts several stops, ascending by height', async () => {
    const el = await mount('snap-points="96px, 50%"');
    await openSheet(el);
    expect(el.snapCount).toBe(3);
    el.snapTo(1);
    await settled(el);
    expect(Math.round(el.visibleHeight)).toBe(HALF());
    el.snapTo(2);
    await settled(el);
    expect(Math.round(el.visibleHeight)).toBe(96);
  });

  it('re-anchors to the same stop when the points change under a resting sheet', async () => {
    const el = await mount('snap-points="0.5"');
    await openSheet(el);
    el.snapTo(1);
    await settled(el);
    el.snapPoints = ['30%'];
    await el.updateComplete;
    await nextFrame();
    expect(el.snapIndex).toBe(1);
    expect(Math.round(visibleOnScreen(el))).toBe(Math.round(window.innerHeight * 0.3));
    // No animation: the geometry moved, not the finger.
    expect(sheetOf(el).getAnimations()).toHaveLength(0);
  });

  it('re-resolves the settled stop when the window is resized', async () => {
    const el = await mount('snap-points="0.5"');
    await openSheet(el);
    el.snapTo(1);
    await settled(el);
    // Stops are viewport fractions: a resize event makes the sheet resolve them again.
    const before = offsetOf(el);
    window.dispatchEvent(new Event('resize'));
    await nextFrame();
    expect(offsetOf(el)).toBe(before);
    expect(el.snapIndex).toBe(1);
  });

  it('ignores a stop it cannot resolve, and warns which one', async () => {
    (globalThis as {tctDevMode?: boolean}).tctDevMode = true;
    resetDevWarnings();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      const el = await mount('snap-points="0.5 50"');
      await openSheet(el);
      expect(el.snapCount).toBe(2);
      expect(warn.mock.calls.flat().join(' ')).toContain('[50]');
    } finally {
      warn.mockRestore();
      resetDevWarnings();
      delete (globalThis as {tctDevMode?: boolean}).tctDevMode;
    }
  });

  it('a stop within 48px of the tallest one is the same stop', async () => {
    const el = await mount('snap-points="0.9"'); // 806 of 824 visible: 18px apart
    await openSheet(el);
    expect(el.snapCount).toBe(1);
  });
});

describe('drag, flick and settle', () => {
  it('a fast flick up expands to the tallest stop', async () => {
    const el = await mount('snap-points="0.5"');
    await openSheet(el);
    el.snapTo(1);
    await settled(el);
    await drag(handleOf(el), 700, 560, {steps: 3, stepMs: 8});
    await settled(el);
    expect(el.snapIndex).toBe(0);
    expect(offsetOf(el)).toBe(0);
  });

  it('a slow drag past the shortest stop dismisses the sheet', async () => {
    const el = await mount('snap-points="0.5"');
    await openSheet(el);
    el.snapTo(1);
    await settled(el);
    await drag(handleOf(el), 500, 880, {stepMs: 70});
    await waitUntil(() => !el.open, 'dismissed past the shortest stop');
  });

  it('a slow drag below the shortest stop that stays short of the threshold snaps back to it', async () => {
    const el = await mount('snap-points="0.5"');
    await openSheet(el);
    el.snapTo(1);
    await settled(el);
    await drag(handleOf(el), 500, 540, {stepMs: 80});
    await settled(el);
    expect(el.open).toBe(true);
    expect(el.snapIndex).toBe(1);
  });

  it('a down-drag never settles above the starting stop', async () => {
    const el = await mount('snap-points="0.5"');
    await openSheet(el);
    el.snapTo(1);
    await settled(el);
    await drag(handleOf(el), 500, 480, {stepMs: 80});
    await settled(el);
    expect(el.snapIndex).toBe(1);
  });

  it('rubber-bands when pulled up past fully open, then springs back', async () => {
    const el = await mount('snap-points="0.5"');
    await openSheet(el);
    pointer(handleOf(el), 'pointerdown', 600);
    await aTimeout(30);
    pointer(handleOf(el), 'pointermove', 400);
    expect(offsetOf(el)).toBeLessThan(0);
    expect(offsetOf(el)).toBeGreaterThanOrEqual(-48);
    pointer(handleOf(el), 'pointerup', 400);
    await settled(el);
    expect(offsetOf(el)).toBe(0);
  });

  it('follows the finger with no transition while dragging', async () => {
    const el = await mount('snap-points="0.5"');
    await openSheet(el);
    pointer(handleOf(el), 'pointerdown', 300);
    await aTimeout(20);
    pointer(handleOf(el), 'pointermove', 340);
    expect(sheetOf(el).hasAttribute('data-dragging')).toBe(true);
    expect(getComputedStyle(sheetOf(el)).transitionDuration).toBe('0s');
    pointer(handleOf(el), 'pointerup', 340);
    await settled(el);
    expect(sheetOf(el).hasAttribute('data-dragging')).toBe(false);
  });

  it('reports the settled stop with tct-snap-change (reason "pointer"), once per change', async () => {
    const el = await mount('snap-points="0.5"');
    await openSheet(el);
    const changes = recordEvents(el, 'tct-snap-change');
    await drag(handleOf(el), 300, 520, {stepMs: 80});
    await settled(el);
    expect(changes.events).toHaveLength(1);
    expect((changes.events[0] as TctSnapChangeEvent).index).toBe(1);
    expect(Math.round((changes.events[0] as TctSnapChangeEvent).height)).toBe(HALF());
    expect(changes.events[0]!.reason).toBe('pointer');
    expectEventFlags(changes.events[0]!, {bubbles: true, composed: true, cancelable: false});
  });

  it('the shortest stop and a stop above it thin the scrim only for a peek', async () => {
    const working = await mount('snap-points="0.5"');
    await openSheet(working);
    working.snapTo(1);
    await settled(working);
    expect(scrimOf(working)).toBe(1); // a working height keeps a full scrim
    await working.hide();
    const peek = await mount('snap-points="96px"');
    await openSheet(peek);
    peek.snapTo(1);
    await settled(peek);
    expect(scrimOf(peek)).toBeCloseTo(0.3, 5); // a peek thins the scrim but never clears it
  });

  it('mirrors the drag on the scrim, clearing it as the sheet leaves', async () => {
    const el = await mount('snap-points="0.5"');
    await openSheet(el);
    el.snapTo(1);
    await settled(el);
    pointer(handleOf(el), 'pointerdown', 500);
    await aTimeout(30);
    pointer(handleOf(el), 'pointermove', 640);
    expect(scrimOf(el)).toBeLessThan(1);
    pointer(handleOf(el), 'pointermove', 900);
    expect(scrimOf(el)).toBe(0);
    pointer(handleOf(el), 'pointercancel', 900);
    await settled(el);
    expect(scrimOf(el)).toBe(1);
  });
});

describe('scroll reach at lower stops', () => {
  const long = '<div style="block-size:2400px">long</div><p id="last">Last line</p>';

  it('keeps the last content reachable when the sheet rests at a lower stop', async () => {
    const el = await mount('snap-points="0.5"', long);
    await openSheet(el);
    el.snapTo(1);
    await settled(el);
    await waitUntil(() => sheetOf(el).hasAttribute('data-pinned'), 'body gives up the offset');
    const body = bodyOf(el);
    body.scrollTop = body.scrollHeight;
    await nextFrame();
    const last = el.querySelector('#last')!.getBoundingClientRect();
    expect(last.bottom).toBeLessThanOrEqual(window.innerHeight + 1);
    expect(last.height).toBeGreaterThan(0);
  });

  it('pins the height while a lower stop is resting, so a hugging sheet does not shrink', async () => {
    const el = await mount(
      'height="hug" snap-points="0.4"',
      '<div style="block-size:700px">hug</div>',
    );
    await openSheet(el);
    const full = sheetOf(el).getBoundingClientRect().height;
    el.snapTo(1);
    await settled(el);
    await waitUntil(() => sheetOf(el).hasAttribute('data-pinned'), 'pinned');
    expect(Math.round(sheetOf(el).getBoundingClientRect().height)).toBe(Math.round(full));
  });

  it('drops the offset margin again when the sheet expands', async () => {
    const el = await mount('snap-points="0.5"', long);
    await openSheet(el);
    el.snapTo(1);
    await settled(el);
    await waitUntil(() => sheetOf(el).hasAttribute('data-pinned'), 'pinned');
    el.snapTo(0);
    await waitUntil(() => !sheetOf(el).hasAttribute('data-pinned'), 'unpinned once up');
    expect(sheetOf(el).style.getPropertyValue('--_sheet-inset')).toBe('');
  });

  it('a peek keeps the full body and slides instead of giving up the offset', async () => {
    const el = await mount('snap-points="96px"', long);
    await openSheet(el);
    el.snapTo(1);
    await settled(el);
    await aTimeout(60);
    expect(sheetOf(el).hasAttribute('data-pinned')).toBe(false);
  });
});

describe('touch handoff from the scrolling body', () => {
  const long = '<div style="block-size:2400px">long</div>';

  it('a pull down at the top of the body starts a sheet drag and claims the gesture', async () => {
    const el = await mount('snap-points="0.5"', long);
    await openSheet(el);
    const body = bodyOf(el);
    touch(body, 'touchstart', 300);
    const first = touch(body, 'touchmove', 306);
    expect(first.defaultPrevented, 'below the slop it is still a tap or a scroll').toBe(false);
    const promoted = touch(body, 'touchmove', 340);
    expect(promoted.defaultPrevented, 'past the slop the sheet takes the gesture').toBe(true);
    await aTimeout(20);
    touch(body, 'touchmove', 380);
    expect(sheetOf(el).hasAttribute('data-dragging')).toBe(true);
    expect(offsetOf(el)).toBeGreaterThan(0);
    touch(body, 'touchend', 380);
    await settled(el);
    expect(sheetOf(el).hasAttribute('data-dragging')).toBe(false);
  });

  it('a pull down in the middle of the content is an ordinary scroll', async () => {
    const el = await mount('snap-points="0.5"', long);
    await openSheet(el);
    const body = bodyOf(el);
    body.scrollTop = 300;
    touch(body, 'touchstart', 300);
    const move = touch(body, 'touchmove', 380);
    expect(move.defaultPrevented).toBe(false);
    expect(sheetOf(el).hasAttribute('data-dragging')).toBe(false);
    touch(body, 'touchend', 380);
  });

  it('a pull up at the bottom expands a sheet that rests at a lower stop', async () => {
    const el = await mount('snap-points="0.5"', long);
    await openSheet(el);
    el.snapTo(1);
    await settled(el);
    await waitUntil(() => sheetOf(el).hasAttribute('data-pinned'), 'pinned');
    const body = bodyOf(el);
    body.scrollTop = body.scrollHeight;
    await nextFrame();
    touch(body, 'touchstart', 500);
    const move = touch(body, 'touchmove', 440);
    expect(move.defaultPrevented).toBe(true);
    await aTimeout(20);
    touch(body, 'touchmove', 300);
    touch(body, 'touchend', 300);
    await settled(el);
    expect(el.snapIndex).toBe(0);
  });

  it('a pull up at the bottom of the tallest stop belongs to the content', async () => {
    const el = await mount('snap-points="0.5"', long);
    await openSheet(el);
    const body = bodyOf(el);
    body.scrollTop = body.scrollHeight;
    await nextFrame();
    touch(body, 'touchstart', 500);
    const move = touch(body, 'touchmove', 400);
    expect(move.defaultPrevented).toBe(false);
    touch(body, 'touchend', 400);
    expect(sheetOf(el).hasAttribute('data-dragging')).toBe(false);
  });

  it('a tap that drifts a pixel or two does not start a drag', async () => {
    const el = await mount('snap-points="0.5"', long);
    await openSheet(el);
    const body = bodyOf(el);
    touch(body, 'touchstart', 300);
    const drift = touch(body, 'touchmove', 303);
    expect(drift.defaultPrevented).toBe(false);
    touch(body, 'touchend', 303);
    expect(sheetOf(el).hasAttribute('data-dragging')).toBe(false);
  });

  it('a mouse pull down at the top of the body promotes; scrolled content does not', async () => {
    const el = await mount('snap-points="0.5"', long);
    await openSheet(el);
    const body = bodyOf(el);
    pointer(body, 'pointerdown', 300);
    pointer(body, 'pointermove', 340);
    expect(sheetOf(el).hasAttribute('data-dragging')).toBe(true);
    pointer(body, 'pointercancel', 340);
    await settled(el);

    body.scrollTop = 200;
    pointer(body, 'pointerdown', 300);
    pointer(body, 'pointermove', 340);
    expect(sheetOf(el).hasAttribute('data-dragging')).toBe(false);
    pointer(body, 'pointerup', 340);
  });

  it('an interrupted touch (touchcancel) returns to the resting stop', async () => {
    const el = await mount('snap-points="0.5"', long);
    await openSheet(el);
    const body = bodyOf(el);
    touch(body, 'touchstart', 300);
    touch(body, 'touchmove', 340);
    await aTimeout(20);
    touch(body, 'touchmove', 400);
    touch(body, 'touchcancel', 400);
    await settled(el);
    expect(offsetOf(el)).toBe(0);
  });
});

describe('the resizable handle (WCAG 2.5.7: keyboard and single-pointer alternatives to dragging)', () => {
  it('is a labelled vertical slider over the stops when the sheet has snap points', async () => {
    const el = await mount('snap-points="0.5 96px"');
    await openSheet(el);
    const handle = handleOf(el);
    expect(handle.getAttribute('role')).toBe('slider');
    expect(handle.getAttribute('tabindex')).toBe('0');
    expect(handle.getAttribute('aria-orientation')).toBe('vertical');
    expect(handle.getAttribute('aria-valuemin')).toBe('0');
    expect(handle.getAttribute('aria-valuemax')).toBe('2');
    // Higher is taller: the tallest stop is the maximum.
    expect(handle.getAttribute('aria-valuenow')).toBe('2');
    expect(await axNode(handle)).toMatchObject({role: 'slider', name: 'Resize handle'});
    expect(handle.getAttribute('aria-hidden')).toBeNull();
  });

  it('reports the visible share of the viewport as its value text', async () => {
    const el = await mount('snap-points="0.5"');
    await openSheet(el);
    const handle = handleOf(el);
    expect(handle.getAttribute('aria-valuetext')).toMatch(/9\d\s?%|92\s?%/);
    el.snapTo(1);
    await settled(el);
    await el.updateComplete;
    expect(handle.getAttribute('aria-valuetext')).toMatch(/50\s?%/);
    expect(handle.getAttribute('aria-valuenow')).toBe('0');
  });

  it('is the first tab stop of an open sheet and shows a focus ring', async () => {
    const el = await mount('snap-points="0.5"', '<button id="inside">Inside</button>');
    await openSheet(el);
    await pressKeys('Tab');
    expect(deepActiveElement()).toBe(handleOf(el));
    expect(getComputedStyle(handleOf(el)).outlineStyle).not.toBe('none');
    await pressKeys('Tab');
    expect(deepActiveElement()?.id).toBe('inside');
  });

  it('Arrow Down / Arrow Up move one stop shorter / taller, and stop at the ends', async () => {
    const el = await mount('snap-points="0.5 96px"');
    await openSheet(el);
    const changes = recordEvents(el, 'tct-snap-change');
    handleOf(el).focus();
    await pressKeys('ArrowDown');
    await settled(el);
    expect(el.snapIndex).toBe(1);
    await pressKeys('ArrowDown');
    await settled(el);
    expect(el.snapIndex).toBe(2);
    await pressKeys('ArrowDown');
    await settled(el);
    expect(el.snapIndex, 'no wrap past the shortest stop').toBe(2);
    await pressKeys('ArrowUp');
    await settled(el);
    expect(el.snapIndex).toBe(1);
    expect((changes.events as TctSnapChangeEvent[]).map((event) => [event.index, event.reason])).toEqual([
      [1, 'keyboard'],
      [2, 'keyboard'],
      [1, 'keyboard'],
    ]);
  });

  it('Page Down / Page Up step like the arrows; Home is the shortest stop and End the tallest', async () => {
    const el = await mount('snap-points="0.5 96px"');
    await openSheet(el);
    handleOf(el).focus();
    await pressKeys('PageDown');
    await settled(el);
    expect(el.snapIndex).toBe(1);
    await pressKeys('PageUp');
    await settled(el);
    expect(el.snapIndex).toBe(0);
    await pressKeys('Home');
    await settled(el);
    expect(el.snapIndex).toBe(2);
    await pressKeys('End');
    await settled(el);
    expect(el.snapIndex).toBe(0);
  });

  it('Enter and Space cycle the stops, from the tallest to the shortest and up', async () => {
    const el = await mount('snap-points="0.5"');
    await openSheet(el);
    handleOf(el).focus();
    await pressKeys('Enter');
    await settled(el);
    expect(el.snapIndex, 'from the tallest to the shortest').toBe(1);
    await pressKeys(' ');
    await settled(el);
    expect(el.snapIndex).toBe(0);
  });

  it('a tap (a press that never moves) on the handle cycles the stops: every stop is reachable by taps', async () => {
    const el = await mount('snap-points="0.5 96px"');
    await openSheet(el);
    const changes = recordEvents(el, 'tct-snap-change');
    const visited: number[] = [el.snapIndex];
    for (let i = 0; i < 3; i++) {
      pointer(handleOf(el), 'pointerdown', 500);
      pointer(handleOf(el), 'pointerup', 500);
      await settled(el);
      visited.push(el.snapIndex);
    }
    // The tallest goes to the shortest, then one taller at a time.
    expect(visited).toEqual([0, 2, 1, 0]);
    expect(changes.events.every((event) => event.reason === 'pointer')).toBe(true);
    expect(sheetOf(el).hasAttribute('data-dragging')).toBe(false);
  });

  it('a tap does not move a sheet without stops, and does not dismiss it', async () => {
    const el = await mount();
    await openSheet(el);
    pointer(handleOf(el), 'pointerdown', 500);
    pointer(handleOf(el), 'pointerup', 500);
    await settled(el);
    expect(el.open).toBe(true);
    expect(offsetOf(el)).toBe(0);
  });

  it('Escape still closes the sheet while the slider has focus', async () => {
    const el = await mount('snap-points="0.5"');
    await openSheet(el);
    handleOf(el).focus();
    await pressKeys('Escape');
    await waitUntil(() => !el.open, 'closed');
  });

  it('snapTo() moves without an event, clamps its index, and property writes emit nothing', async () => {
    const el = await mount('snap-points="0.5"');
    await openSheet(el);
    const changes = recordEvents(el, 'tct-snap-change');
    el.snapTo(1);
    await settled(el);
    expect(el.snapIndex).toBe(1);
    el.snapTo(9);
    await settled(el);
    expect(el.snapIndex).toBe(1);
    el.snapTo(-4);
    await settled(el);
    expect(el.snapIndex).toBe(0);
    expect(changes.events).toHaveLength(0);
  });

  it('every stop of a three-stop sheet can be reached without dragging, and each has a named value', async () => {
    const el = await mount('snap-points="0.5 96px"');
    await openSheet(el);
    handleOf(el).focus();
    const heights: number[] = [];
    for (const key of ['ArrowDown', 'ArrowDown']) {
      await pressKeys(key);
      await settled(el);
      await el.updateComplete;
      heights.push(Math.round(el.visibleHeight));
      expect(handleOf(el).getAttribute('aria-valuetext')).not.toBe('');
    }
    expect(heights).toEqual([HALF(), 96]);
  });

  it('has no axe violations as a slider, at a lower stop', async () => {
    const el = await mount('snap-points="0.5"', '<button>Inside</button>');
    await openSheet(el);
    el.snapTo(1);
    await settled(el);
    await expectAccessible(dialogOf(el));
  });

  it('the decorative handle of a sheet without stops is not focusable and hidden from AT', async () => {
    const el = await mount();
    await openSheet(el);
    await pressKeys('Tab');
    expect(deepActiveElement()).not.toBe(handleOf(el));
    expect(handleOf(el).getAttribute('aria-hidden')).toBe('true');
  });
});

afterEach(() => {
  delete (globalThis as {tctDevMode?: boolean}).tctDevMode;
});
