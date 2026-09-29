/**
 * ResizableController (upstream useResizable): defaults and clamping, snapping, collapse (drag threshold,
 * veto, programmatic), persistence, percentage sizes (one-time default vs live bounds, container and
 * viewport basis, structured percent()), invalid input, gestures, and several regions sharing a container.
 */
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {page} from 'vitest/browser';
import {fixture} from '@tecton-wc/testing/fixture.js';
import {nextFrame, waitUntil} from '@tecton-wc/testing/timing.js';
import {resetDevWarnings} from '../utils/dev.js';
import {
  parseResizableSize,
  percent,
  pixel,
  ResizableController,
  type ResizableOptions,
} from './resizable.js';

const region = (options: ResizableOptions = {}) => new ResizableController(null, options);

/** Drags by `delta` px the way a handle does: start, moves, end. */
function drag(controller: ResizableController, ...deltas: number[]): void {
  controller.start('pointer');
  for (const delta of deltas) controller.move(delta);
  controller.end();
}

beforeEach(() => {
  localStorage.clear();
  resetDevWarnings();
});
afterEach(async () => {
  localStorage.clear();
  await page.viewport(414, 896);
});

describe('ResizableController: size and bounds', () => {
  it('starts at the default size (250), with a 50px minimum and no maximum', () => {
    const r = region();
    expect(r.size).toBe(250);
    expect(r.minSize).toBe(50);
    expect(r.maxSize).toBe(Infinity);
    expect(r.collapsed).toBe(false);
    expect(r.props).toBe(r);
  });

  it('honours defaultSize, minSize and maxSize, clamping the default into the bounds', () => {
    expect(region({defaultSize: 320}).size).toBe(320);
    expect(region({defaultSize: 20, minSize: 80}).size).toBe(80);
    expect(region({defaultSize: 900, maxSize: 400}).size).toBe(400);
  });

  it('accepts a number, an exact Npx string, a plain number string and pixel(n)', () => {
    expect(region({defaultSize: '300px'}).size).toBe(300);
    expect(region({defaultSize: '300'}).size).toBe(300);
    expect(region({defaultSize: pixel(300)}).size).toBe(300);
  });

  it('resize() sets a size within the bounds and never emits for an invalid one', () => {
    const r = region({minSize: 100, maxSize: 300});
    r.resize(240);
    expect(r.size).toBe(240);
    r.resize(1000);
    expect(r.size).toBe(300);
    r.resize(10);
    expect(r.size).toBe(100);
    // Invalid input repairs nothing: the selection is kept, not replaced by NaN.
    r.resize(Number.NaN);
    r.resize(-5);
    expect(r.size).toBe(100);
  });

  it('a maximum below the minimum loses: the maximum wins, as it always has', () => {
    const r = region({defaultSize: 200, minSize: 300, maxSize: 150});
    expect(r.size).toBe(150);
  });

  it('warns once for a size that is not accepted and falls back', () => {
    (globalThis as {tctDevMode?: boolean}).tctDevMode = true;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      const r = region({
        defaultSize: 'wide',
        minSize: '150%',
        maxSize: {type: 'percent', value: 5} as never,
      });
      expect(r.size).toBe(250);
      expect(r.minSize).toBe(50);
      expect(r.maxSize).toBe(Infinity);
      expect(
        warn.mock.calls.filter((call) => String(call[0]).includes('is not a size')),
      ).toHaveLength(3);
    } finally {
      warn.mockRestore();
      (globalThis as {tctDevMode?: boolean}).tctDevMode = undefined;
    }
  });

  it('parseResizableSize validates every accepted form and rejects the rest', () => {
    expect(parseResizableSize(12)).toEqual({kind: 'px', value: 12});
    expect(parseResizableSize('12px')).toEqual({kind: 'px', value: 12});
    expect(parseResizableSize('40%')).toEqual({kind: 'percent', value: 40});
    expect(parseResizableSize(percent(40, {min: pixel(300)}))).toEqual({
      kind: 'percent',
      value: 40,
      min: 300,
    });
    expect(parseResizableSize(percent(40, {max: pixel(300)}))).toEqual({
      kind: 'percent',
      value: 40,
      max: 300,
    });
    for (const bad of [-1, Number.NaN, '101%', '4em', 'min(40%, 300px)', null, undefined, [], {}]) {
      expect(parseResizableSize(bad), JSON.stringify(bad) ?? 'undefined').toBeNull();
    }
    // Exactly one bound.
    expect(
      parseResizableSize({type: 'percent', value: 40, min: pixel(1), max: pixel(2)}),
    ).toBeNull();
    expect(parseResizableSize({type: 'percent', value: 40})).toBeNull();
  });
});

describe('ResizableController: snapping', () => {
  it('only rests on the snap points', () => {
    const r = region({defaultSize: 200, minSize: 56, snaps: [56, 160, 260, 400]});
    expect(r.size).toBe(160);
    drag(r, 100);
    expect(r.size).toBe(260);
    drag(r, 25);
    expect(r.size).toBe(260);
    drag(r, 500);
    expect(r.size).toBe(400);
  });

  it('snaps within the bounds', () => {
    const r = region({defaultSize: 100, minSize: 120, maxSize: 300, snaps: [150, 200, 900]});
    // 100 clamps to 120 first, then snaps to the nearest point (150).
    expect(r.size).toBe(150);
    // 5100 clamps to 300, then snaps to the nearest point (200); 900 is out of the bounds.
    drag(r, 5000);
    expect(r.size).toBe(200);
  });
});

describe('ResizableController: gestures', () => {
  it('moves by the delta from where the gesture started', () => {
    const r = region({defaultSize: 200, minSize: 100, maxSize: 400});
    r.start('pointer');
    r.move(30);
    expect(r.size).toBe(230);
    r.move(-70);
    expect(r.size).toBe(130);
    r.move(500);
    expect(r.size).toBe(400);
    r.end();
    // A new gesture starts from the size reached.
    drag(r, -100);
    expect(r.size).toBe(300);
  });

  it('reports every step with its reason, and never for a method call', () => {
    const steps: [number, string][] = [];
    const r = region({
      defaultSize: 200,
      onSizeChange: (size, reason) => steps.push([size, reason]),
    });
    r.start('keyboard');
    r.move(10);
    r.move(20);
    r.end();
    expect(steps).toEqual([
      [210, 'keyboard'],
      [220, 'keyboard'],
    ]);
    r.resize(300);
    expect(steps.at(-1)).toEqual([300, 'request']);
  });

  it('does not report a step that changed nothing', () => {
    const steps: number[] = [];
    const r = region({defaultSize: 300, maxSize: 300, onSizeChange: (size) => steps.push(size)});
    drag(r, 50, 60);
    expect(steps).toEqual([]);
  });

  it('cancel() ends the gesture like end() without losing the size reached', () => {
    const r = region({defaultSize: 200});
    r.start('pointer');
    r.move(40);
    r.cancel();
    expect(r.size).toBe(240);
    drag(r, 10);
    expect(r.size).toBe(250);
  });
});

describe('ResizableController: collapse', () => {
  const options = (extra: ResizableOptions = {}): ResizableOptions => ({
    defaultSize: 200,
    minSize: 100,
    collapsible: true,
    ...extra,
  });

  it('collapses when a drag goes below the collapsed size, and expands when it comes back', () => {
    const r = region(options());
    r.start('pointer');
    // Deltas are measured from where the gesture started (200): 20 is below the 40px threshold.
    r.move(-180);
    expect(r.collapsed).toBe(true);
    expect(r.size).toBe(0);
    r.move(-190);
    expect(r.collapsed).toBe(true);
    // Coming back to 150 (above the threshold) expands it again.
    r.move(-50);
    expect(r.collapsed).toBe(false);
    expect(r.size).toBe(150);
    r.end();
  });

  it('a non-collapsible region never collapses', () => {
    const r = region({defaultSize: 200, minSize: 100});
    drag(r, -500);
    expect(r.collapsed).toBe(false);
    expect(r.size).toBe(100);
  });

  it('uses collapsedSize as the threshold', () => {
    const r = region(options({collapsedSize: 120}));
    r.start('pointer');
    r.move(-90);
    expect(r.collapsed).toBe(true);
    r.end();
  });

  it('collapse() and expand() are programmatic: no veto, no repeated notification', () => {
    const changes: boolean[] = [];
    const veto = vi.fn(() => false);
    const r = region(
      options({beforeCollapseChange: veto, onCollapseChange: (c) => changes.push(c)}),
    );
    r.collapse();
    r.collapse();
    expect(r.collapsed).toBe(true);
    expect(veto).not.toHaveBeenCalled();
    r.expand();
    expect(r.collapsed).toBe(false);
    expect(r.size).toBe(200);
    expect(changes).toEqual([true, false]);
  });

  it('a user gesture asks first, and a veto keeps the state (a page that owns it)', () => {
    const asked: [boolean, string][] = [];
    const r = region(
      options({
        beforeCollapseChange: (collapsed, reason) => {
          asked.push([collapsed, reason]);
          return false;
        },
      }),
    );
    drag(r, -500);
    expect(r.collapsed).toBe(false);
    expect(r.size).toBe(200);
    expect(asked[0]).toEqual([true, 'pointer']);
  });

  it('resize() expands a collapsed region', () => {
    const r = region(options({defaultCollapsed: true}));
    expect(r.collapsed).toBe(true);
    r.resize(180);
    expect(r.collapsed).toBe(false);
    expect(r.size).toBe(180);
  });

  it('defaultCollapsed is only honoured when collapsible', () => {
    expect(region({defaultCollapsed: true}).collapsed).toBe(false);
    expect(region(options({defaultCollapsed: true})).collapsed).toBe(true);
  });

  it('the expanded size survives a collapsed session', () => {
    const r = region(options());
    r.collapse();
    expect(r.size).toBe(0);
    r.expand();
    expect(r.size).toBe(200);
  });
});

describe('ResizableController: persistence', () => {
  it('remembers the size and collapse state under a key, and restores them', () => {
    const first = region({defaultSize: 200, minSize: 100, collapsible: true, autoSaveId: 'nav'});
    drag(first, 60);
    expect(JSON.parse(localStorage.getItem('tct-resizable:nav')!)).toEqual({
      size: 260,
      collapsed: false,
    });
    const second = region({defaultSize: 200, minSize: 100, collapsible: true, autoSaveId: 'nav'});
    expect(second.size).toBe(260);
    second.collapse();
    const third = region({defaultSize: 200, minSize: 100, collapsible: true, autoSaveId: 'nav'});
    expect(third.collapsed).toBe(true);
    third.expand();
    expect(third.size).toBe(260);
  });

  it('a remembered entry wins over defaultCollapsed', () => {
    localStorage.setItem('tct-resizable:x', JSON.stringify({size: 180, collapsed: false}));
    const r = region({
      defaultSize: 200,
      collapsible: true,
      defaultCollapsed: true,
      autoSaveId: 'x',
    });
    expect(r.collapsed).toBe(false);
    expect(r.size).toBe(180);
  });

  it('reads the legacy width-only entries and ignores garbage', () => {
    localStorage.setItem('tct-resizable:legacy', '320');
    expect(region({autoSaveId: 'legacy'}).size).toBe(320);
    localStorage.setItem('tct-resizable:zero', '0');
    expect(region({collapsible: true, autoSaveId: 'zero'}).collapsed).toBe(true);
    localStorage.setItem('tct-resizable:bad', '{not json');
    expect(region({defaultSize: 210, autoSaveId: 'bad'}).size).toBe(210);
  });

  it('never writes without a key', () => {
    drag(region({defaultSize: 200}), 30);
    expect(localStorage.length).toBe(0);
  });

  it('does not throw when storage is blocked', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    try {
      expect(() => drag(region({defaultSize: 200, autoSaveId: 'blocked'}), 30)).not.toThrow();
    } finally {
      spy.mockRestore();
    }
  });
});

describe('ResizableController: percentages', () => {
  it('a percentage default resolves once against the viewport and does not track it', async () => {
    await page.viewport(800, 600);
    const r = region({defaultSize: '25%'});
    expect(r.size).toBe(200);
    await page.viewport(1000, 600);
    await nextFrame();
    expect(r.size).toBe(200);
  });

  it('a percentage bound is live and clamps the selection', async () => {
    await page.viewport(800, 600);
    const r = region({defaultSize: 500, maxSize: '50%'});
    expect(r.maxSize).toBe(400);
    expect(r.size).toBe(400);
    await page.viewport(400, 600);
    await waitUntil(() => r.maxSize === 200);
    expect(r.size).toBe(200);
    // The clamp is committed: growing the basis again does not revive the pre-clamp size.
    await page.viewport(1000, 600);
    await waitUntil(() => r.maxSize === 500);
    expect(r.size).toBe(200);
  });

  it('percent(n, {min}) adds a pixel floor and percent(n, {max}) a pixel ceiling', async () => {
    await page.viewport(800, 600);
    expect(region({defaultSize: percent(10, {min: pixel(120)})}).size).toBe(120);
    expect(region({defaultSize: percent(50, {max: pixel(300)})}).size).toBe(300);
    expect(region({defaultSize: percent(25, {min: pixel(120)})}).size).toBe(200);
    expect(region({minSize: percent(40, {min: pixel(333)})}).minSize).toBe(333);
    expect(region({maxSize: percent(10, {max: pixel(400)})}).maxSize).toBe(80);
  });

  it('a container is the basis: its content box, observed', async () => {
    const box = await fixture<HTMLElement>(
      `<div style="inline-size: 400px; padding: 20px; box-sizing: border-box"></div>`,
    );
    const r = region({defaultSize: '50%', maxSize: '75%', container: () => box});
    await waitUntil(() => r.isBasisMeasured);
    // Content box: 400 - 2 * 20.
    expect(r.size).toBe(180);
    expect(r.maxSize).toBe(270);
    box.style.inlineSize = '800px';
    await waitUntil(() => r.maxSize === 570);
    // The default was resolved once; the live bound followed the container.
    expect(r.size).toBe(180);
  });

  it('a container that is not laid out yet is unmeasured: nothing is persisted from the stand-in basis', async () => {
    const box = await fixture<HTMLElement>(`<div style="display: none"></div>`);
    const r = region({defaultSize: '50%', container: () => box, autoSaveId: 'hidden'});
    await nextFrame();
    expect(r.isBasisMeasured).toBe(false);
    expect(localStorage.getItem('tct-resizable:hidden')).toBeNull();
    box.style.display = 'block';
    box.style.inlineSize = '300px';
    await waitUntil(() => r.isBasisMeasured);
    expect(r.size).toBe(150);
    expect(JSON.parse(localStorage.getItem('tct-resizable:hidden')!).size).toBe(150);
  });

  it('a vertical region measures the block axis', async () => {
    const box = await fixture<HTMLElement>(
      `<div style="block-size: 500px; inline-size: 100px"></div>`,
    );
    const r = region({defaultSize: '20%', direction: 'vertical', container: () => box});
    await waitUntil(() => r.isBasisMeasured);
    expect(r.size).toBe(100);
  });

  it('freezes the basis for the length of a gesture', async () => {
    const box = await fixture<HTMLElement>(`<div style="inline-size: 400px"></div>`);
    const r = region({defaultSize: 100, maxSize: '50%', container: () => box});
    await waitUntil(() => r.maxSize === 200);
    r.start('pointer');
    box.style.inlineSize = '1000px';
    await nextFrame();
    await nextFrame();
    expect(r.maxSize).toBe(200);
    r.move(900);
    expect(r.size).toBe(200);
    r.end();
    await waitUntil(() => r.maxSize === 500);
  });
});

describe('ResizableController: store', () => {
  it('notifies subscribers of every change and stops when unsubscribed', () => {
    const r = region({defaultSize: 200});
    const listener = vi.fn();
    const stop = r.subscribe(listener);
    r.resize(220);
    expect(listener).toHaveBeenCalled();
    listener.mockClear();
    stop();
    r.resize(240);
    expect(listener).not.toHaveBeenCalled();
  });

  it('regions() builds regions that share a container and axis, each remembered under its own key', async () => {
    await page.viewport(800, 600);
    const regions = ResizableController.regions(null, {
      autoSaveId: 'ide',
      regions: {
        left: {defaultSize: '25%', minSize: 100},
        right: {defaultSize: 300, snaps: [200, 300, 400]},
      },
    });
    expect(regions.left.size).toBe(200);
    expect(regions.right.size).toBe(300);
    drag(regions.right, 90);
    expect(regions.right.size).toBe(400);
    expect(localStorage.getItem('tct-resizable:ide:right')).not.toBeNull();
    expect(localStorage.getItem('tct-resizable:ide:left')).not.toBeNull();
  });
});
