/**
 * tct-toast: semantics, auto-hide with pause (hover, focus, window blur), the close button, the
 * dismiss / hide events, custom content, and swipe dismissal by touch and pen. Upstream test names are
 * kept where the behaviour applies.
 */
import {html} from 'lit';
import {beforeEach, describe, expect, it} from 'vitest';
import {userEvent} from 'vitest/browser';
import {TctToastDismissEvent} from '@tecton-astryx/core/events/tct-toast-dismiss.js';
import {TctToastHideEvent} from '@tecton-astryx/core/events/tct-toast-hide.js';
import {deepActiveElement} from '@tecton-astryx/core/utils/focus.js';
import {
  aTimeout,
  axNode,
  emulateMedia,
  expectAccessible,
  expectEventFlags,
  fixture,
  recordEvents,
  runElementSuite,
  waitUntil,
} from '@tecton-astryx/testing/index.js';
import './define.js';
import type {TctToast} from './tct-toast.js';

const markup = (attributes = '', body = 'Changes saved', end = '') =>
  `<tct-toast ${attributes}>${body}${end}</tct-toast>`;

async function mount(attributes = '', body?: string, end?: string): Promise<TctToast> {
  const el = await fixture<TctToast>(markup(attributes, body, end));
  await el.updateComplete;
  return el;
}

const card = (el: TctToast): HTMLElement => el.shadowRoot!.querySelector<HTMLElement>('.card')!;
const closeButton = (el: TctToast): HTMLButtonElement =>
  el.shadowRoot!.querySelector<HTMLButtonElement>('.dismiss')!;

// A stationary real pointer would "enter" (and so pause) a toast that a later test renders under it.
beforeEach(async () => {
  const parked = await fixture<HTMLElement>(
    '<div style="position:fixed;inset-block-end:0;inset-inline-end:0;inline-size:8px;block-size:8px"></div>',
  );
  await userEvent.hover(parked);
});

runElementSuite({
  tag: 'tct-toast',
  render: () => markup('auto-hide-duration="0"'),
  properties: {
    type: 'error',
    autoHideDuration: 8000,
    swipeEdge: 'start',
    dismissLabel: 'Close it',
  },
  attributes: {
    type: 'type',
    autoHideDuration: 'auto-hide-duration',
    swipeEdge: 'swipe-edge',
    dismissLabel: 'dismiss-label',
  },
  events: ['tct-toast-dismiss', 'tct-toast-hide'],
});

describe('events', () => {
  it('tct-toast-dismiss is cancelable, bubbling and composed and carries the reason; tct-toast-hide is not cancelable', () => {
    const dismiss = new TctToastDismissEvent('auto');
    expectEventFlags(dismiss, {bubbles: true, composed: true, cancelable: true});
    expect(dismiss.reason).toBe('auto');
    const hide = new TctToastHideEvent('manual');
    expectEventFlags(hide, {bubbles: true, composed: true, cancelable: false});
    expect(hide.reason).toBe('manual');
    expect([dismiss.type, hide.type]).toEqual(['tct-toast-dismiss', 'tct-toast-hide']);
  });
});

describe('semantics', () => {
  it('an info toast is a status, an error toast an alert, neither a live region of its own', async () => {
    const info = await mount();
    expect(await axNode(info)).toMatchObject({role: 'status'});
    const error = await mount('type="error"');
    expect(await axNode(error)).toMatchObject({role: 'alert'});
    expect(info.getAttribute('role')).toBeNull();
  });

  it('renders the message and the trailing content', async () => {
    const el = await mount('', 'Item removed', '<button slot="end" id="undo">Undo</button>');
    expect(el.textContent).toContain('Item removed');
    expect(el.querySelector('#undo')!.assignedSlot!.name).toBe('end');
  });

  it('passes axe, info and error, with an end action', async () => {
    for (const attributes of ['auto-hide-duration="0"', 'type="error"']) {
      const el = await mount(attributes, 'Something happened', '<button slot="end">Undo</button>');
      await expectAccessible(el);
    }
  });
});

describe('the close button', () => {
  it('is named "Dismiss notification" and dismisses manually', async () => {
    const el = await mount('auto-hide-duration="0"');
    expect(await axNode(closeButton(el))).toMatchObject({
      role: 'button',
      name: 'Dismiss notification',
    });
    const dismiss = recordEvents(el, 'tct-toast-dismiss');
    const hide = recordEvents(el, 'tct-toast-hide');
    await userEvent.click(closeButton(el));
    expect(dismiss.events).toHaveLength(1);
    expect(dismiss.events[0]).toMatchObject({reason: 'manual'});
    expect(hide.events).toHaveLength(1);
    expect(el.exiting).toBe(true);
    expect(el.hasAttribute('exiting')).toBe(true);
  });

  it('dismiss-label overrides the name, and the German catalog supplies it otherwise', async () => {
    const el = await mount('auto-hide-duration="0" dismiss-label="Close"');
    expect((await axNode(closeButton(el))).name).toBe('Close');
    const root = await fixture<HTMLElement>(
      `<div lang="de-DE">${markup('auto-hide-duration="0"')}</div>`,
    );
    const german = root.querySelector<TctToast>('tct-toast')!;
    await waitUntil(
      () => closeButton(german).getAttribute('aria-label') === 'Benachrichtigung schließen',
      'de-DE catalog',
    );
  });

  it('has a hit area of at least 24 by 24 CSS px', async () => {
    const el = await mount('auto-hide-duration="0"');
    const rect = closeButton(el).getBoundingClientRect();
    expect(rect.width).toBeGreaterThanOrEqual(24);
    expect(rect.height).toBeGreaterThanOrEqual(24);
  });

  it('keeps a visible focus ring, with the inner ring for inverted surfaces', async () => {
    const el = await mount('auto-hide-duration="0"');
    await userEvent.tab();
    expect(deepActiveElement()).toBe(closeButton(el));
    const style = getComputedStyle(closeButton(el));
    expect(style.outlineStyle).not.toBe('none');
    expect(closeButton(el).dataset.focusRing).toBe('double');
  });
});

describe('dismissal', () => {
  it('preventing tct-toast-dismiss keeps the toast', async () => {
    const el = await mount('auto-hide-duration="0"');
    el.addEventListener('tct-toast-dismiss', (event) => {
      event.preventDefault();
    });
    const hide = recordEvents(el, 'tct-toast-hide');
    el.dismiss();
    expect(el.exiting).toBe(false);
    expect(hide.events).toHaveLength(0);
  });

  it('fires tct-toast-hide exactly once when dismissed twice during the exit window', async () => {
    const el = await mount('auto-hide-duration="0"');
    const hide = recordEvents(el, 'tct-toast-hide');
    el.dismiss();
    el.dismiss();
    closeButton(el).click();
    expect(hide.events).toHaveLength(1);
  });

  it('the exiting state matches :state(exiting) and fades the card out', async () => {
    const el = await mount('auto-hide-duration="0"');
    el.dismiss();
    await el.updateComplete;
    expect(el.matches(':state(exiting)')).toBe(true);
    await waitUntil(() => Number.parseFloat(getComputedStyle(card(el)).opacity) === 0, 'faded out');
  });
});

describe('auto-hide', () => {
  it('an info toast dismisses itself after the duration with reason "auto"', async () => {
    const el = await mount('auto-hide-duration="120"');
    const dismiss = recordEvents(el, 'tct-toast-dismiss');
    expect(el.autoHide).toBe(true);
    await waitUntil(() => dismiss.events.length === 1, 'auto dismissed');
    expect(dismiss.events[0]).toMatchObject({reason: 'auto'});
  });

  it('defaults to 5000 ms for info and never for error', async () => {
    const info = await mount();
    const error = await mount('type="error"');
    expect([info.autoHide, error.autoHide]).toEqual([true, false]);
    const forced = await mount('type="error" auto-hide-duration="80"');
    expect(forced.autoHide).toBe(true);
    const off = await mount('auto-hide-duration="0"');
    expect(off.autoHide).toBe(false);
  });

  it('an error toast persists until dismissed', async () => {
    const el = await mount('type="error"');
    await aTimeout(300);
    expect(el.exiting).toBe(false);
  });

  it('pauses while the pointer is over it and resumes when it leaves (never with less than 1 s left)', async () => {
    const el = await mount('auto-hide-duration="200"');
    const dismiss = recordEvents(el, 'tct-toast-dismiss');
    el.dispatchEvent(new MouseEvent('mouseenter'));
    await aTimeout(400);
    expect(dismiss.events).toHaveLength(0);
    const resumed = performance.now();
    el.dispatchEvent(new MouseEvent('mouseleave'));
    await waitUntil(() => dismiss.events.length === 1, 'dismissed after resume', 3000);
    expect(performance.now() - resumed).toBeGreaterThanOrEqual(900);
  });

  it('pauses while focus is inside it', async () => {
    const el = await mount(
      'auto-hide-duration="200"',
      'Saved',
      '<button slot="end" id="undo">Undo</button>',
    );
    const dismiss = recordEvents(el, 'tct-toast-dismiss');
    el.querySelector<HTMLElement>('#undo')!.focus();
    await aTimeout(400);
    expect(dismiss.events).toHaveLength(0);
  });

  it('pauses the auto-hide timer while the window is blurred', async () => {
    const el = await mount('auto-hide-duration="200"');
    const dismiss = recordEvents(el, 'tct-toast-dismiss');
    window.dispatchEvent(new Event('blur'));
    await aTimeout(400);
    expect(dismiss.events).toHaveLength(0);
    window.dispatchEvent(new Event('focus'));
    await waitUntil(
      () => dismiss.events.length === 1,
      'dismissed after the window regained focus',
      3000,
    );
  });

  it('a new duration restarts the countdown', async () => {
    const el = await mount('auto-hide-duration="5000"');
    const dismiss = recordEvents(el, 'tct-toast-dismiss');
    el.autoHideDuration = 100;
    await waitUntil(() => dismiss.events.length === 1, 'dismissed on the new duration');
  });

  it('removing the toast stops its timer', async () => {
    const el = await mount('auto-hide-duration="100"');
    const dismiss = recordEvents(el, 'tct-toast-dismiss');
    el.remove();
    await aTimeout(250);
    expect(dismiss.events).toHaveLength(0);
  });
});

describe('renderContent', () => {
  const custom = async (extra = '') => {
    const el = await mount(extra);
    el.renderContent = ({dismiss, autoHide, autoHideDuration, type}) =>
      html`<div class="custom">
        <span id="custom-text">${type} ${autoHide} ${autoHideDuration}</span><slot></slot
        ><button id="custom-close" @click=${dismiss}>Close</button>
      </div>`;
    await el.updateComplete;
    return el;
  };

  it('replaces the default layout for that toast', async () => {
    const el = await custom('auto-hide-duration="0"');
    expect(card(el).querySelector('.custom')).not.toBeNull();
    expect(card(el).querySelector('.inner')).toBeNull();
  });

  it('does not inject a dismiss control into custom content', async () => {
    const el = await custom('auto-hide-duration="0"');
    expect(el.shadowRoot!.querySelector('.dismiss')).toBeNull();
    expect(el.shadowRoot!.querySelectorAll('button')).toHaveLength(1);
  });

  it('dismisses exactly once from a composed custom button and reports manual', async () => {
    const el = await custom('auto-hide-duration="0"');
    const dismiss = recordEvents(el, 'tct-toast-dismiss');
    const hide = recordEvents(el, 'tct-toast-hide');
    el.shadowRoot!.querySelector<HTMLElement>('#custom-close')!.click();
    expect(dismiss.events).toHaveLength(1);
    expect(dismiss.events[0]).toMatchObject({reason: 'manual'});
    expect(hide.events).toHaveLength(1);
  });

  it('still auto-dismisses and exposes its resolved timing, and keeps the status semantics', async () => {
    const el = await custom('auto-hide-duration="150"');
    expect(el.shadowRoot!.querySelector('#custom-text')!.textContent).toBe('info true 150');
    const dismiss = recordEvents(el, 'tct-toast-dismiss');
    await waitUntil(() => dismiss.events.length === 1, 'auto dismissed');
    expect((await axNode(el)).role).toBe('status');
  });
});

// A touch as the platform delivers it: one contact, moved in steps.
function touch(target: Element, x: number, y: number): Touch {
  return new Touch({identifier: 7, target, clientX: x, clientY: y});
}
function touchEvent(
  type: string,
  _target: Element,
  touches: Touch[],
  changed = touches,
): TouchEvent {
  return new TouchEvent(type, {
    bubbles: true,
    cancelable: true,
    composed: true,
    touches: type === 'touchend' || type === 'touchcancel' ? [] : touches,
    targetTouches: touches,
    changedTouches: changed,
  });
}
async function swipe(
  target: Element,
  root: Element,
  path: [number, number][],
): Promise<TouchEvent[]> {
  const events: TouchEvent[] = [];
  const [first, ...rest] = path;
  const fire = (type: string, point: [number, number]) => {
    const event = touchEvent(type, target, [touch(target, point[0], point[1])]);
    target.dispatchEvent(event);
    events.push(event);
  };
  void root;
  fire('touchstart', first!);
  for (const point of rest) fire('touchmove', point);
  fire('touchend', rest.at(-1) ?? first!);
  await aTimeout(20);
  return events;
}

describe('swipe dismissal', () => {
  it('dismisses on a touch swipe toward the block end past the threshold, with reason manual', async () => {
    const el = await mount('auto-hide-duration="0"');
    const dismiss = recordEvents(el, 'tct-toast-dismiss');
    const r = card(el).getBoundingClientRect();
    await swipe(card(el), card(el), [
      [r.left + 20, r.top + 10],
      [r.left + 20, r.top + 30],
      [r.left + 20, r.top + 80],
    ]);
    expect(dismiss.events).toHaveLength(1);
    expect(dismiss.events[0]).toMatchObject({reason: 'manual'});
    expect(card(el).style.getPropertyValue('--_toast-swipe-exit-y')).toBe('120%');
  });

  it('a top-edge toast dismisses upward', async () => {
    const el = await mount('auto-hide-duration="0" swipe-edge="start"');
    const dismiss = recordEvents(el, 'tct-toast-dismiss');
    const r = card(el).getBoundingClientRect();
    await swipe(card(el), card(el), [
      [r.left + 20, r.top + 60],
      [r.left + 20, r.top + 30],
      [r.left + 20, r.top - 20],
    ]);
    expect(dismiss.events).toHaveLength(1);
    expect(card(el).style.getPropertyValue('--_toast-swipe-exit-y')).toBe('calc(-1 * 120%)');
  });

  it('snaps back without dismissing after a short drag, and clears the swipe variables', async () => {
    const el = await mount('auto-hide-duration="0"');
    const dismiss = recordEvents(el, 'tct-toast-dismiss');
    const r = card(el).getBoundingClientRect();
    await swipe(card(el), card(el), [
      [r.left + 20, r.top + 10],
      [r.left + 20, r.top + 24],
    ]);
    expect(dismiss.events).toHaveLength(0);
    expect(card(el).style.getPropertyValue('--_toast-swipe-y')).toBe('');
  });

  it('fades and scales the card only after vertical intent, and lets horizontal intent go to the page', async () => {
    const el = await mount('auto-hide-duration="0"');
    const r = card(el).getBoundingClientRect();
    const target = card(el);
    target.dispatchEvent(
      touchEvent('touchstart', target, [touch(target, r.left + 20, r.top + 10)]),
    );
    const horizontal = touchEvent('touchmove', target, [touch(target, r.left + 60, r.top + 12)]);
    target.dispatchEvent(horizontal);
    expect(horizontal.defaultPrevented).toBe(false);
    expect(target.style.getPropertyValue('--_toast-swipe-opacity')).toBe('');
    target.dispatchEvent(touchEvent('touchend', target, [touch(target, r.left + 60, r.top + 12)]));
    // A fresh gesture: vertical.
    target.dispatchEvent(
      touchEvent('touchstart', target, [touch(target, r.left + 20, r.top + 10)]),
    );
    const vertical = touchEvent('touchmove', target, [touch(target, r.left + 20, r.top + 40)]);
    target.dispatchEvent(vertical);
    expect(vertical.defaultPrevented).toBe(true);
    expect(Number.parseFloat(target.style.getPropertyValue('--_toast-swipe-opacity'))).toBeLessThan(
      1,
    );
    expect(Number.parseFloat(target.style.getPropertyValue('--_toast-swipe-scale'))).toBeLessThan(
      1,
    );
    target.dispatchEvent(
      new TouchEvent('touchcancel', {bubbles: true, touches: [], changedTouches: []}),
    );
    expect(target.style.getPropertyValue('--_toast-swipe-y')).toBe('');
  });

  it('hands the opposite vertical direction back without moving the toast', async () => {
    const el = await mount('auto-hide-duration="0"');
    const r = card(el).getBoundingClientRect();
    const target = card(el);
    target.dispatchEvent(
      touchEvent('touchstart', target, [touch(target, r.left + 20, r.top + 30)]),
    );
    const up = touchEvent('touchmove', target, [touch(target, r.left + 20, r.top - 10)]);
    target.dispatchEvent(up);
    expect(up.defaultPrevented).toBe(false);
    expect(target.style.getPropertyValue('--_toast-swipe-y')).toBe('');
  });

  it('dismisses a fast flick below the distance threshold', async () => {
    const el = await mount('auto-hide-duration="0"');
    const dismiss = recordEvents(el, 'tct-toast-dismiss');
    const target = card(el);
    const r = target.getBoundingClientRect();
    target.dispatchEvent(
      touchEvent('touchstart', target, [touch(target, r.left + 20, r.top + 10)]),
    );
    target.dispatchEvent(touchEvent('touchmove', target, [touch(target, r.left + 20, r.top + 30)]));
    target.dispatchEvent(touchEvent('touchmove', target, [touch(target, r.left + 20, r.top + 66)]));
    target.dispatchEvent(touchEvent('touchend', target, [touch(target, r.left + 20, r.top + 66)]));
    expect(dismiss.events).toHaveLength(1);
  });

  it('abandons a one-finger swipe when a second touch starts', async () => {
    const el = await mount('auto-hide-duration="0"');
    const target = card(el);
    const r = target.getBoundingClientRect();
    target.dispatchEvent(
      touchEvent('touchstart', target, [touch(target, r.left + 20, r.top + 10)]),
    );
    target.dispatchEvent(touchEvent('touchmove', target, [touch(target, r.left + 20, r.top + 40)]));
    const second = new Touch({identifier: 8, target, clientX: r.left + 60, clientY: r.top + 10});
    target.dispatchEvent(
      new TouchEvent('touchstart', {
        bubbles: true,
        touches: [touch(target, r.left + 20, r.top + 40), second],
        changedTouches: [second],
      }),
    );
    expect(target.style.getPropertyValue('--_toast-swipe-y')).toBe('');
  });

  it('a pen swipe past the threshold dismisses; a mouse drag never does', async () => {
    const el = await mount('auto-hide-duration="0"');
    const dismiss = recordEvents(el, 'tct-toast-dismiss');
    const target = card(el);
    const r = target.getBoundingClientRect();
    const pointer = (type: string, y: number, pointerType: string) =>
      new PointerEvent(type, {
        bubbles: true,
        composed: true,
        cancelable: true,
        pointerId: 3,
        pointerType,
        button: 0,
        clientX: r.left + 20,
        clientY: r.top + y,
      });
    for (const [type, y] of [
      ['pointerdown', 10],
      ['pointermove', 30],
      ['pointermove', 90],
      ['pointerup', 90],
    ] as const) {
      target.dispatchEvent(pointer(type, y, 'mouse'));
    }
    expect(dismiss.events).toHaveLength(0);
    target.dispatchEvent(pointer('pointerdown', 10, 'pen'));
    target.dispatchEvent(pointer('pointermove', 30, 'pen'));
    target.dispatchEvent(pointer('pointermove', 90, 'pen'));
    target.dispatchEvent(pointer('pointerup', 90, 'pen'));
    expect(dismiss.events).toHaveLength(1);
  });

  it('does not start a swipe from interactive descendants, and keeps the button as the non-gesture alternative', async () => {
    const el = await mount(
      'auto-hide-duration="0"',
      'Saved',
      '<button slot="end" id="undo">Undo</button>',
    );
    const dismiss = recordEvents(el, 'tct-toast-dismiss');
    const undo = el.querySelector<HTMLElement>('#undo')!;
    const r = card(el).getBoundingClientRect();
    undo.dispatchEvent(touchEvent('touchstart', undo, [touch(undo, r.left + 20, r.top + 10)]));
    const move = touchEvent('touchmove', undo, [touch(undo, r.left + 20, r.top + 80)]);
    undo.dispatchEvent(move);
    undo.dispatchEvent(touchEvent('touchend', undo, [touch(undo, r.left + 20, r.top + 80)]));
    expect(dismiss.events).toHaveLength(0);
    expect(move.defaultPrevented).toBe(false);
    closeButton(el).click();
    expect(dismiss.events).toHaveLength(1);
  });

  it('resumes a paused auto-hide timer when the swipe resets', async () => {
    const el = await mount('auto-hide-duration="150"');
    const dismiss = recordEvents(el, 'tct-toast-dismiss');
    const target = card(el);
    const r = target.getBoundingClientRect();
    target.dispatchEvent(
      touchEvent('touchstart', target, [touch(target, r.left + 20, r.top + 10)]),
    );
    await aTimeout(300);
    expect(dismiss.events).toHaveLength(0);
    target.dispatchEvent(
      new TouchEvent('touchcancel', {bubbles: true, touches: [], changedTouches: []}),
    );
    await waitUntil(() => dismiss.events.length === 1, 'resumed and dismissed', 3000);
  });
});

describe('rtl, forced colours, reduced motion', () => {
  it('lays out the trailing controls at the inline end in RTL', async () => {
    const root = await fixture<HTMLElement>(
      `<div dir="rtl" style="inline-size:420px">${markup('auto-hide-duration="0"')}</div>`,
    );
    const el = root.querySelector<TctToast>('tct-toast')!;
    await el.updateComplete;
    const rect = el.getBoundingClientRect();
    expect(closeButton(el).getBoundingClientRect().left - rect.left).toBeLessThan(
      rect.right - closeButton(el).getBoundingClientRect().right + 1,
    );
  });

  it('keeps the card edge and the close button visible in forced colours', async () => {
    const restore = await emulateMedia({forcedColors: 'active'});
    try {
      const el = await mount('auto-hide-duration="0"');
      const style = getComputedStyle(card(el));
      expect(style.borderTopStyle).not.toBe('none');
      expect(style.borderTopColor).not.toBe('rgba(0, 0, 0, 0)');
      await userEvent.tab();
      expect(getComputedStyle(closeButton(el)).outlineStyle).not.toBe('none');
    } finally {
      await restore();
    }
  });

  it('runs no slide under reduced motion; the fade stays', async () => {
    const restore = await emulateMedia({reducedMotion: 'reduce'});
    try {
      const el = await mount('auto-hide-duration="0"');
      expect(getComputedStyle(card(el)).transitionProperty).toBe('opacity');
    } finally {
      await restore();
    }
  });

  it('the error card uses the error fill and the on-error ink', async () => {
    const info = await mount('auto-hide-duration="0"');
    const error = await mount('type="error"');
    expect(getComputedStyle(card(error)).backgroundColor).not.toBe(
      getComputedStyle(card(info)).backgroundColor,
    );
  });
});
