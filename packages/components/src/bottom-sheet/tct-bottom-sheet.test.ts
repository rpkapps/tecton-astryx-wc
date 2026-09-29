/**
 * tct-bottom-sheet: element contract, overlay contract (one Escape per layer, moved sheet, toast under a
 * modal), dismissal purposes (modal and non-modal), the grab handle and its non-drag alternatives
 * (WCAG 2.5.7), snap points and drag/flick/settle, the mobile keyboard, focus, a11y, RTL, forced colours,
 * reduced motion and i18n. Upstream test names (BottomSheet.test.tsx) are kept where the behaviour applies.
 */
import {afterEach, beforeAll, describe, expect, it, vi} from 'vitest';
import {userEvent} from 'vitest/browser';
import {defineElement} from '@tecton-astryx/core/define.js';
import {resetDevWarnings} from '@tecton-astryx/core/utils/dev.js';
import {deepActiveElement} from '@tecton-astryx/core/utils/focus.js';
import {
  aTimeout,
  axNode,
  emulateMedia,
  expectAccessible,
  expectEventFlags,
  fixture,
  layerStack,
  nextFrame,
  pressKeys,
  recordEvents,
  runElementSuite,
  runOverlaySuite,
  waitUntil,
} from '@tecton-astryx/testing/index.js';
import {TctTestLayer} from '@tecton-astryx/testing/fixtures/test-layer.js';
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

beforeAll(() => {
  defineElement(TctTestLayer);
});

const sheet = (attributes = '', content = '<p>Sheet content</p>') =>
  `<tct-bottom-sheet ${attributes.includes('label=') ? '' : 'label="Filters"'} ${attributes}>${content}</tct-bottom-sheet>`;

async function mount(attributes = '', content?: string): Promise<TctBottomSheet> {
  const root = await fixture<HTMLElement>(
    `<div style="padding:40px"><button id="opener">Open</button>${sheet(attributes, content)}<p id="outside">outside</p></div>`,
  );
  const el = root.querySelector<TctBottomSheet>('tct-bottom-sheet')!;
  await el.updateComplete;
  return el;
}

/** A backdrop press: a real click near the top-left corner, far from a sheet at the bottom edge. */
const pressBackdrop = () =>
  userEvent.click(document.documentElement, {position: {x: 5, y: 5}, force: true});

runElementSuite({
  tag: 'tct-bottom-sheet',
  render: () => sheet(),
  properties: {
    label: 'Other label',
    height: 'tall',
    snapPoints: [0.5, '96px'],
    purpose: 'form',
    noScrim: true,
    finalFocus: 'somewhere',
    sheetId: 'details',
    handleLabel: 'Resize it',
  },
  attributes: {
    label: 'label',
    height: 'height',
    purpose: 'purpose',
    finalFocus: 'final-focus',
    sheetId: 'sheet-id',
    handleLabel: 'handle-label',
  },
  events: ['tct-open-change', 'tct-after-open-change', 'tct-snap-change'],
});

runOverlaySuite({
  tag: 'tct-bottom-sheet',
  // The default slot carries the nested sheet of the suite (standalone: a sheet provides no switcher scope).
  render: ({attributes = '', children = ''}) =>
    `<tct-bottom-sheet label="Test" ${attributes}><button>Inside</button>${children}</tct-bottom-sheet>`,
  modal: true,
  surface: (element) => element.shadowRoot!.querySelector('.sheet'),
});

describe('BottomSheet', () => {
  it('renders children when open and applies the accessible label', async () => {
    const el = await mount('', '<p id="content">Sheet content</p>');
    await openSheet(el);
    expect(el.querySelector('#content')!.getBoundingClientRect().height).toBeGreaterThan(0);
    expect(dialogOf(el).getAttribute('aria-label')).toBe('Filters');
    expect(await axNode(dialogOf(el))).toMatchObject({role: 'dialog', name: 'Filters'});
  });

  it('keeps consumer content first and last inside the observed content box', async () => {
    const el = await mount(
      '',
      '<span id="first">First</span><span id="middle">Middle</span><span id="last">Last</span>',
    );
    await openSheet(el);
    const content = el.shadowRoot!.querySelector('.content')!;
    const slot = content.querySelector('slot')!;
    const assigned = slot.assignedElements();
    expect(assigned.map((child) => child.id)).toEqual(['first', 'middle', 'last']);
  });

  it('does not show when open is false', async () => {
    const el = await mount();
    expect(dialogOf(el).open).toBe(false);
    expect(layerStack()).toHaveLength(0);
    expect(el.open).toBe(false);
  });

  it('opens modally (showModal + aria-modal)', async () => {
    const el = await mount();
    await openSheet(el);
    expect(dialogOf(el).matches(':modal')).toBe(true);
    expect(dialogOf(el).getAttribute('aria-modal')).toBe('true');
    expect(el.matches(':state(open)')).toBe(true);
  });

  it('requests close on Escape (reason "escape"), and closes', async () => {
    const el = await mount();
    await openSheet(el);
    const changes = recordEvents(el, 'tct-open-change');
    await pressKeys('Escape');
    await waitUntil(() => !el.open, 'closed by Escape');
    expect(changes.events).toHaveLength(1);
    expect([changes.events[0]!.open, changes.events[0]!.reason]).toEqual([false, 'escape']);
    expectEventFlags(changes.events[0]!, {bubbles: true, composed: true, cancelable: true});
  });

  it('a prevented intent keeps the sheet open', async () => {
    const el = await mount();
    await openSheet(el);
    el.addEventListener('tct-open-change', (event) => {
      event.preventDefault();
    });
    await pressKeys('Escape');
    await aTimeout(120);
    expect(el.open).toBe(true);
  });

  it('requests close when the scrim (the backdrop) is pressed, reason "outside"', async () => {
    const el = await mount();
    await openSheet(el);
    const changes = recordEvents(el, 'tct-open-change');
    await pressBackdrop();
    await waitUntil(() => !el.open, 'closed by the backdrop press', 3000);
    expect(changes.events).toHaveLength(1);
    expect(changes.events[0]!.reason).toBe('outside');
  });

  it('does not dismiss when the sheet surface itself is pressed', async () => {
    const el = await mount();
    await openSheet(el);
    await userEvent.click(sheetOf(el), {position: {x: 20, y: 60}});
    await aTimeout(150);
    expect(el.open).toBe(true);
  });

  it('keeps a standalone modal sheet presented through its exit animation', async () => {
    const el = await mount();
    await openSheet(el);
    const hidden = el.hide();
    await waitUntil(() => dialogOf(el).hasAttribute('inert'), 'inert while leaving');
    expect(dialogOf(el).open, 'still presented while it leaves').toBe(true);
    await hidden;
    expect(dialogOf(el).open).toBe(false);
    expect(dialogOf(el).hasAttribute('inert')).toBe(false);
  });

  it('opens and closes through show() and hide() without intent events, settling once each', async () => {
    const el = await mount();
    const intent = recordEvents(el, 'tct-open-change');
    const after = recordEvents(el, 'tct-after-open-change');
    await el.show();
    await el.hide();
    expect(intent.events).toHaveLength(0);
    expect(after.events.map((event) => event.open)).toEqual([true, false]);
    await el.toggle();
    expect(el.open).toBe(true);
    await el.toggle(false);
    expect(el.open).toBe(false);
  });

  it('re-opens fully open at the tallest stop', async () => {
    const el = await mount('height="tall" snap-points="0.5"');
    await openSheet(el);
    el.snapTo(1);
    await settled(el);
    expect(el.snapIndex).toBe(1);
    await el.hide();
    await openSheet(el);
    expect(el.snapIndex).toBe(0);
    expect(offsetOf(el)).toBe(0);
  });
});

describe('purpose', () => {
  it('purpose=form blocks scrim and swipe dismissal but allows Escape', async () => {
    const el = await mount('purpose="form"');
    await openSheet(el);
    const changes = recordEvents(el, 'tct-open-change');
    await pressBackdrop();
    await aTimeout(300);
    expect(el.open, 'a scrim press does not dismiss a form sheet').toBe(true);
    await drag(handleOf(el), 500, 880, {stepMs: 60});
    await settled(el);
    expect(el.open, 'a swipe does not dismiss a form sheet').toBe(true);
    expect(changes.events).toHaveLength(0);
    await pressKeys('Escape');
    await waitUntil(() => !el.open, 'Escape dismisses');
    expect(changes.events[0]!.reason).toBe('escape');
  });

  it('purpose=required blocks every implicit dismissal path, and is an alertdialog', async () => {
    const el = await mount('purpose="required"');
    await openSheet(el);
    expect(dialogOf(el).getAttribute('role')).toBe('alertdialog');
    const changes = recordEvents(el, 'tct-open-change');
    await pressKeys('Escape');
    await pressBackdrop();
    await drag(handleOf(el), 500, 880, {stepMs: 60});
    await aTimeout(300);
    expect(el.open).toBe(true);
    expect(changes.events).toHaveLength(0);
    // Explicit controls still work.
    el.requestClose();
    await waitUntil(() => !el.open, 'requestClose closes it');
    expect(changes.events[0]!.reason).toBe('request');
  });

  it('purpose=info allows Escape, the scrim and swipe', async () => {
    const el = await mount('purpose="info"');
    await openSheet(el);
    expect(dialogOf(el).getAttribute('role')).toBeNull();
  });
});

describe('no-scrim (non-modal)', () => {
  it('opens non-modally: show() instead of showModal(), no aria-modal', async () => {
    const el = await mount('no-scrim');
    await openSheet(el);
    expect(dialogOf(el).open).toBe(true);
    expect(dialogOf(el).matches(':modal')).toBe(false);
    expect(dialogOf(el).hasAttribute('aria-modal')).toBe(false);
  });

  it('does not dismiss when the page behind is pressed, and keeps it interactive', async () => {
    const el = await mount('no-scrim');
    await openSheet(el);
    const opener = document.querySelector<HTMLButtonElement>('#opener')!;
    const clicked = vi.fn();
    opener.addEventListener('click', clicked);
    await userEvent.click(opener);
    await aTimeout(150);
    expect(clicked, 'the page behind stays interactive').toHaveBeenCalledTimes(1);
    expect(el.open).toBe(true);
  });

  it('does not lock page scroll', async () => {
    const el = await mount('no-scrim');
    await openSheet(el);
    expect(document.documentElement.style.getPropertyValue('overflow')).not.toBe('hidden');
  });

  it('still closes on Escape while focus is inside', async () => {
    const el = await mount('no-scrim', '<button id="inside" data-autofocus>Inside</button>');
    await openSheet(el);
    await waitUntil(() => deepActiveElement()?.id === 'inside', 'autofocus honoured');
    await pressKeys('Escape');
    await waitUntil(() => !el.open, 'closed');
  });

  it('does not steal focus onto the panel on open', async () => {
    const el = await mount('no-scrim');
    const opener = document.querySelector<HTMLButtonElement>('#opener')!;
    opener.focus();
    await openSheet(el);
    await nextFrame();
    expect(deepActiveElement()).toBe(opener);
  });

  it('still honors a descendant with data-autofocus', async () => {
    const el = await mount('no-scrim', '<input id="field" data-autofocus />');
    await openSheet(el);
    await waitUntil(() => deepActiveElement()?.id === 'field', 'autofocus honoured');
  });

  it('still dismisses on a downward swipe past the threshold', async () => {
    const el = await mount('no-scrim');
    await openSheet(el);
    await drag(handleOf(el), 500, 880, {stepMs: 60});
    await waitUntil(() => !el.open, 'swiped away');
  });

  it('keeps a standalone non-modal sheet visible until its exit ends', async () => {
    const el = await mount('no-scrim');
    await openSheet(el);
    const hidden = el.hide();
    await nextFrame();
    expect(dialogOf(el).open).toBe(true);
    await hidden;
    expect(dialogOf(el).open).toBe(false);
  });
});

describe('grab handle', () => {
  it('renders a decorative handle hidden from assistive tech when there are no snap points', async () => {
    const el = await mount();
    await openSheet(el);
    const handle = handleOf(el);
    expect(handle.getAttribute('aria-hidden')).toBe('true');
    expect(handle.getAttribute('role')).toBeNull();
    expect(handle.hasAttribute('tabindex')).toBe(false);
  });

  it('is at least 24px tall and as wide as the sheet (WCAG 2.5.8 target size)', async () => {
    const el = await mount();
    await openSheet(el);
    const box = handleOf(el).getBoundingClientRect();
    expect(box.height).toBeGreaterThanOrEqual(24);
    expect(box.width).toBeGreaterThanOrEqual(24);
  });
});

describe('swipe to dismiss', () => {
  it('requests close (reason "pointer") when dragged past the dismiss threshold', async () => {
    const el = await mount();
    await openSheet(el);
    const changes = recordEvents(el, 'tct-open-change');
    await drag(handleOf(el), 500, 880, {stepMs: 60});
    await waitUntil(() => !el.open, 'dismissed');
    expect(changes.events[0]!.reason).toBe('pointer');
  });

  it('a fast flick down dismisses', async () => {
    const el = await mount();
    await openSheet(el);
    await drag(handleOf(el), 500, 640, {steps: 3, stepMs: 8});
    await waitUntil(() => !el.open, 'flicked away');
  });

  it('springs back when the drag is released above the dismiss threshold', async () => {
    const el = await mount();
    await openSheet(el);
    await drag(handleOf(el), 500, 540, {stepMs: 80});
    await settled(el);
    expect(el.open).toBe(true);
    expect(offsetOf(el)).toBe(0);
  });

  it('a swipe whose dismissal is prevented settles back where it was', async () => {
    const el = await mount();
    await openSheet(el);
    el.addEventListener('tct-open-change', (event) => {
      event.preventDefault();
    });
    await drag(handleOf(el), 500, 880, {stepMs: 60});
    await settled(el);
    expect(el.open).toBe(true);
    expect(offsetOf(el)).toBe(0);
    expect(sheetOf(el).hasAttribute('data-dismissing')).toBe(false);
  });

  it('restores the sheet when a context menu interrupts an active drag', async () => {
    const el = await mount('height="tall" snap-points="0.5"');
    await openSheet(el);
    pointer(handleOf(el), 'pointerdown', 500);
    pointer(handleOf(el), 'pointermove', 620);
    handleOf(el).dispatchEvent(
      new MouseEvent('contextmenu', {bubbles: true, cancelable: true, composed: true}),
    );
    await settled(el);
    expect(offsetOf(el)).toBe(0);
    expect(sheetOf(el).hasAttribute('data-dragging')).toBe(false);
  });

  it('a pointercancel returns to the resting detent', async () => {
    const el = await mount('height="tall" snap-points="0.5"');
    await openSheet(el);
    pointer(handleOf(el), 'pointerdown', 500);
    pointer(handleOf(el), 'pointermove', 560);
    pointer(handleOf(el), 'pointercancel', 560);
    await settled(el);
    expect(offsetOf(el)).toBe(0);
  });

  it('ignores a secondary button and a non-primary pointer', async () => {
    const el = await mount('height="tall" snap-points="0.5"');
    await openSheet(el);
    handleOf(el).dispatchEvent(
      new PointerEvent('pointerdown', {
        bubbles: true,
        composed: true,
        cancelable: true,
        pointerId: 9,
        isPrimary: true,
        button: 2,
        clientY: 500,
      }),
    );
    pointer(handleOf(el), 'pointermove', 700);
    expect(sheetOf(el).hasAttribute('data-dragging')).toBe(false);
  });
});

describe('height', () => {
  for (const named of ['hug', 'capped', 'tall'] as const) {
    it(`renders the ${named} height without error`, async () => {
      const el = await mount(`height="${named}"`);
      await openSheet(el);
      expect(sheetOf(el).getAttribute('data-height')).toBe(named);
      expect(sheetOf(el).getBoundingClientRect().height).toBeGreaterThan(0);
    });
  }

  it('the tall sheet is taller than the capped one, and hug fits its content', async () => {
    const capped = await mount('height="capped"');
    await openSheet(capped);
    const cappedHeight = sheetOf(capped).getBoundingClientRect().height;
    await capped.hide();
    const tall = await mount('height="tall"');
    await openSheet(tall);
    const tallHeight = sheetOf(tall).getBoundingClientRect().height;
    await tall.hide();
    const hug = await mount('height="hug"', '<div style="block-size:120px">short</div>');
    await openSheet(hug);
    const hugHeight = sheetOf(hug).getBoundingClientRect().height;
    expect(tallHeight).toBeGreaterThan(cappedHeight);
    expect(hugHeight).toBeLessThan(cappedHeight);
    expect(hugHeight).toBeGreaterThan(120);
  });

  it('accepts a freeform height (number or CSS length)', async () => {
    const px = await mount('height="300"');
    await openSheet(px);
    expect(Math.round(sheetOf(px).getBoundingClientRect().height)).toBe(348); // 300 + the 48px band
    await px.hide();
    const css = await mount('height="40dvh"');
    await openSheet(css);
    expect(Math.round(sheetOf(css).getBoundingClientRect().height)).toBe(
      Math.round(window.innerHeight * 0.4) + 48,
    );
  });

  it('is never wider than 640px, centred', async () => {
    await mount();
    const el = await mount();
    await openSheet(el);
    expect(sheetOf(el).getBoundingClientRect().width).toBeLessThanOrEqual(640);
  });

  it('scrolls the body when the content is taller than the sheet', async () => {
    const el = await mount('height="capped"', '<div style="block-size:2000px">tall content</div>');
    await openSheet(el);
    const body = bodyOf(el);
    expect(body.scrollHeight).toBeGreaterThan(body.clientHeight);
    expect(getComputedStyle(body).overflowY).toBe('auto');
    expect(getComputedStyle(body).overscrollBehaviorY).toBe('contain');
  });
});

describe('initial focus', () => {
  it('focuses the sheet panel on open, not the first control', async () => {
    const el = await mount('', '<button id="first">First</button>');
    await openSheet(el);
    await waitUntil(() => deepActiveElement() === sheetOf(el), 'panel focused');
  });

  it('honors a descendant with data-autofocus', async () => {
    const el = await mount(
      '',
      '<button id="first">First</button><input id="auto" data-autofocus />',
    );
    await openSheet(el);
    await waitUntil(() => deepActiveElement()?.id === 'auto', 'autofocus focused');
  });
});

describe('focus restore', () => {
  it('restores focus to the opener after close', async () => {
    const el = await mount();
    const opener = document.querySelector<HTMLButtonElement>('#opener')!;
    opener.focus();
    await openSheet(el);
    await pressKeys('Escape');
    await waitUntil(() => !el.open, 'closed');
    await waitUntil(() => deepActiveElement() === opener, 'focus back on the opener');
  });

  it('prefers an explicit final focus target (id, or element)', async () => {
    const root = await fixture<HTMLElement>(
      `<div><button id="opener">Open</button><button id="elsewhere">Elsewhere</button>${sheet('final-focus="elsewhere"')}</div>`,
    );
    const el = root.querySelector<TctBottomSheet>('tct-bottom-sheet')!;
    root.querySelector<HTMLElement>('#opener')!.focus();
    await openSheet(el);
    await pressKeys('Escape');
    await waitUntil(() => deepActiveElement()?.id === 'elsewhere', 'focus on the final target');
    el.finalFocus = undefined;
    el.finalFocusElement = root.querySelector<HTMLElement>('#opener')!;
    await openSheet(el);
    await pressKeys('Escape');
    await waitUntil(() => deepActiveElement()?.id === 'opener', 'focus on the final element');
  });
});

describe('accessible name', () => {
  afterEach(() => {
    resetDevWarnings();
    delete (globalThis as {tctDevMode?: boolean}).tctDevMode;
  });

  it('warns in development when label is empty', async () => {
    (globalThis as {tctDevMode?: boolean}).tctDevMode = true;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      const el = await mount('label=""');
      await openSheet(el);
      expect(warn.mock.calls.flat().join(' ')).toContain('requires a non-empty `label`');
    } finally {
      warn.mockRestore();
    }
  });
});
