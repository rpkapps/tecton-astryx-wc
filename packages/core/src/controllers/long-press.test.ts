/**
 * `LongPressController` (A§9.18, upstream `useLongPress`): a still single touch held for the delay calls
 * back with the touch start point; movement, release, a second finger, pointercancel, a disabled host and
 * a disconnect cancel it; mice and pens are ignored.
 */
import {LitElement, html} from 'lit';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {
  LONG_PRESS_DEFAULT_DELAY_MS,
  LONG_PRESS_DEFAULT_MOVE_CANCEL_PX,
  LongPressController,
  type LongPressPoint,
} from './long-press.js';

class LongPressHost extends LitElement {
  presses: LongPressPoint[] = [];
  disabled = false;
  delayMs: number | undefined;
  moveCancelPx: number | undefined;
  readonly press: LongPressController = new LongPressController(this, {
    onLongPress: (point) => this.presses.push(point),
    disabled: () => this.disabled,
    delayMs: () => this.delayMs ?? LONG_PRESS_DEFAULT_DELAY_MS,
    moveCancelPx: () => this.moveCancelPx ?? LONG_PRESS_DEFAULT_MOVE_CANCEL_PX,
  });
  protected override render() {
    return html`<slot></slot>`;
  }
}
customElements.define('tct-long-press-test-host', LongPressHost);

function pointer(
  target: EventTarget,
  type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel',
  init: {x?: number; y?: number; id?: number; type?: string} = {},
): void {
  target.dispatchEvent(
    new PointerEvent(type, {
      pointerType: init.type ?? 'touch',
      pointerId: init.id ?? 1,
      clientX: init.x ?? 100,
      clientY: init.y ?? 200,
      bubbles: true,
      composed: true,
    }),
  );
}

let host: LongPressHost;

beforeEach(async () => {
  vi.useFakeTimers();
  host = document.createElement('tct-long-press-test-host') as LongPressHost;
  document.body.append(host);
  await host.updateComplete;
});
afterEach(() => {
  vi.useRealTimers();
  host.remove();
});

describe('LongPressController', () => {
  it('uses the upstream tuning', () => {
    expect(LONG_PRESS_DEFAULT_DELAY_MS).toBe(500);
    expect(LONG_PRESS_DEFAULT_MOVE_CANCEL_PX).toBe(10);
  });

  it('fires onLongPress with the start point after the delay', () => {
    pointer(host, 'pointerdown', {x: 120, y: 340});
    vi.advanceTimersByTime(499);
    expect(host.presses).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(host.presses).toEqual([{x: 120, y: 340}]);
  });

  it('respects a custom delay', () => {
    host.delayMs = 100;
    pointer(host, 'pointerdown');
    vi.advanceTimersByTime(100);
    expect(host.presses).toHaveLength(1);
  });

  it('fires once per press, even when held longer', () => {
    pointer(host, 'pointerdown');
    vi.advanceTimersByTime(2000);
    expect(host.presses).toHaveLength(1);
  });

  it('does nothing when disabled', () => {
    host.disabled = true;
    pointer(host, 'pointerdown');
    vi.advanceTimersByTime(1000);
    expect(host.presses).toEqual([]);
  });

  it('ignores a mouse and a pen', () => {
    pointer(host, 'pointerdown', {type: 'mouse'});
    pointer(host, 'pointerdown', {type: 'pen', id: 2});
    vi.advanceTimersByTime(1000);
    expect(host.presses).toEqual([]);
  });

  it('a second finger is not a long press, and cancels a pending one', () => {
    pointer(host, 'pointerdown', {id: 1});
    vi.advanceTimersByTime(200);
    pointer(host, 'pointerdown', {id: 2, x: 300});
    vi.advanceTimersByTime(1000);
    expect(host.presses).toEqual([]);
    expect(host.press.pending).toBe(false);
  });

  it('cancels when the finger moves past the threshold, on either axis', () => {
    pointer(host, 'pointerdown', {x: 100, y: 100});
    pointer(host, 'pointermove', {x: 111, y: 100});
    vi.advanceTimersByTime(1000);
    expect(host.presses).toEqual([]);
    pointer(host, 'pointerup');
    pointer(host, 'pointerdown', {x: 100, y: 100});
    pointer(host, 'pointermove', {x: 100, y: 89});
    vi.advanceTimersByTime(1000);
    expect(host.presses).toEqual([]);
  });

  it('does not cancel for movement within the threshold', () => {
    pointer(host, 'pointerdown', {x: 100, y: 100});
    pointer(host, 'pointermove', {x: 105, y: 108});
    vi.advanceTimersByTime(500);
    expect(host.presses).toEqual([{x: 100, y: 100}]);
  });

  it('cancels on release and on pointercancel', () => {
    pointer(host, 'pointerdown');
    pointer(host, 'pointerup');
    vi.advanceTimersByTime(1000);
    pointer(host, 'pointerdown');
    pointer(host, 'pointercancel');
    vi.advanceTimersByTime(1000);
    expect(host.presses).toEqual([]);
  });

  it('a new press after a cancelled one starts a fresh timer', () => {
    pointer(host, 'pointerdown');
    vi.advanceTimersByTime(300);
    pointer(host, 'pointerup');
    pointer(host, 'pointerdown', {x: 5, y: 6});
    vi.advanceTimersByTime(499);
    expect(host.presses).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(host.presses).toEqual([{x: 5, y: 6}]);
  });

  it('cancels the pending timer when the host disconnects', () => {
    pointer(host, 'pointerdown');
    host.remove();
    vi.advanceTimersByTime(1000);
    expect(host.presses).toEqual([]);
  });

  it('listens on a custom target that renders later', async () => {
    class Inner extends LitElement {
      presses = 0;
      readonly press: LongPressController = new LongPressController(this, {
        target: () => this.renderRoot.querySelector('.area'),
        onLongPress: () => {
          this.presses++;
        },
      });
      protected override render() {
        return html`<div class="area"></div>`;
      }
    }
    customElements.define('tct-long-press-inner-host', Inner);
    const inner = document.createElement('tct-long-press-inner-host') as Inner;
    document.body.append(inner);
    await inner.updateComplete;
    pointer(inner.renderRoot.querySelector('.area')!, 'pointerdown');
    vi.advanceTimersByTime(500);
    expect(inner.presses).toBe(1);
    inner.remove();
  });
});
