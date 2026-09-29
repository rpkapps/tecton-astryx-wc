/**
 * `toast()` / `tct-layer-provider` / the toast viewport: fallback and provider viewports, placement and
 * stacking, the visible limit, F6 and focus hand-off, announcements, uniqueId, exit collapse, the
 * region landmark, a toast under a modal dialog, and the overlay contract for the viewport layer.
 */
import {html} from 'lit';
import {afterEach, beforeAll, beforeEach, describe, expect, it, vi} from 'vitest';
import {userEvent} from 'vitest/browser';
import {getAnnouncerRegions} from '@tecton-wc/core/a11y/announcer.js';
import {defineElement} from '@tecton-wc/core/define.js';
import {overrideFeature} from '@tecton-wc/core/features.js';
import {resetDevWarnings} from '@tecton-wc/core/utils/dev.js';
import {deepActiveElement} from '@tecton-wc/core/utils/focus.js';
import {
  aTimeout,
  axNode,
  emulateMedia,
  expectAccessible,
  fixture,
  layerStack,
  pressKeys,
  runKeyboardSuite,
  waitUntil,
} from '@tecton-wc/testing/index.js';
import {TctTestLayer} from '@tecton-wc/testing/fixtures/test-layer.js';
import './define.js';
import {
  dismissAllToasts,
  dismissToast,
  resetToastFallback,
  toast,
  toastViewport,
} from './toast.api.js';
import {resetToastProviders} from './toaster.js';
import type {TctLayerProvider} from './tct-layer-provider.js';
import type {TctToast} from './tct-toast.js';
import type {TctToastViewport} from './tct-toast-viewport.js';

beforeAll(() => {
  defineElement(TctTestLayer);
});

beforeEach(async () => {
  const parked = await fixture<HTMLElement>(
    '<div style="position:fixed;inset-block-end:0;inset-inline-end:0;inline-size:8px;block-size:8px"></div>',
  );
  await userEvent.hover(parked);
});

afterEach(() => {
  resetToastFallback();
  resetToastProviders();
  for (const stray of document.querySelectorAll('[data-tct-toast-fallback]')) stray.remove();
});

const viewportOf = (): TctToastViewport => document.querySelector('tct-toast-viewport')!;
const rows = (viewport: TctToastViewport): HTMLElement[] => [
  ...viewport.shadowRoot!.querySelectorAll<HTMLElement>('[data-toast-id]'),
];
const toastsOf = (viewport: TctToastViewport): TctToast[] =>
  rows(viewport).map((row) => row.querySelector<TctToast>('tct-toast')!);
const settled = async (): Promise<void> => {
  await aTimeout(260);
};

async function provider(
  attributes = '',
  inner = '<main id="app">app</main>',
): Promise<TctLayerProvider> {
  const root = await fixture<HTMLElement>(
    `<tct-layer-provider ${attributes}>${inner}</tct-layer-provider>`,
  );
  const el = root as TctLayerProvider;
  await el.updateComplete;
  await viewportOfProvider(el).updateComplete;
  return el;
}
const viewportOfProvider = (el: TctLayerProvider): TctToastViewport => el.viewport!;

describe('the fallback viewport', () => {
  it('toast() with no provider creates a viewport on document.body and warns once in dev', async () => {
    resetDevWarnings();
    const previous = (globalThis as {tctDevMode?: boolean}).tctDevMode;
    (globalThis as {tctDevMode?: boolean}).tctDevMode = true;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      toast({body: 'Saved'});
      toast({body: 'Saved again'});
      const viewport = viewportOf();
      await waitUntil(() => rows(viewport).length === 2, 'two rows');
      expect(viewport.closest('[data-tct-toast-fallback]')!.parentElement).toBe(document.body);
      expect(
        warn.mock.calls.filter((call) => String(call[0]).includes('layer-provider')),
      ).toHaveLength(1);
    } finally {
      warn.mockRestore();
      (globalThis as {tctDevMode?: boolean}).tctDevMode = previous;
    }
  });

  it('shows the toast content, in the top layer, above an open popover', async () => {
    toast({body: 'Saved successfully'});
    const viewport = viewportOf();
    await waitUntil(() => rows(viewport).length === 1, 'row');
    expect(viewport.matches(':popover-open')).toBe(true);
    expect(toastsOf(viewport)[0]!.textContent).toContain('Saved successfully');
  });

  it('text content is text: markup in a string is not parsed', async () => {
    toast({body: '<img src=x onerror=alert(1)>'});
    const viewport = viewportOf();
    await waitUntil(() => rows(viewport).length === 1, 'row');
    expect(viewport.shadowRoot!.querySelector('img')).toBeNull();
    expect(toastsOf(viewport)[0]!.textContent).toContain('<img');
  });

  it('accepts a DOM node or a Lit template as the body and as endContent', async () => {
    const node = document.createElement('strong');
    node.textContent = 'Node body';
    toast({
      body: node,
      endContent: html`<button id="undo" style="color:inherit">Undo</button>`,
      autoHide: false,
    });
    toast({body: html`<em>Template body</em>`, autoHide: false});
    const viewport = viewportOf();
    await waitUntil(() => rows(viewport).length === 2, 'rows');
    expect(toastsOf(viewport)[0]!.querySelector('strong')!.textContent).toBe('Node body');
    expect(toastsOf(viewport)[0]!.querySelector('#undo')).not.toBeNull();
    expect(toastsOf(viewport)[1]!.querySelector('em')!.textContent).toBe('Template body');
  });
});

describe('placement and stacking', () => {
  it('defaults to bottom-end with an end-aligned stack and 16px gutters', async () => {
    toast({body: 'One', autoHide: false});
    const viewport = viewportOf();
    await waitUntil(() => rows(viewport).length === 1, 'row');
    await settled();
    expect(viewport.position).toBe('bottom-end');
    const row = rows(viewport)[0]!.getBoundingClientRect();
    expect(window.innerHeight - row.bottom).toBeGreaterThanOrEqual(15);
    expect(window.innerWidth - row.right).toBeGreaterThanOrEqual(15);
  });

  it('maps the four positions to their edge and side (logical, so they mirror in RTL)', async () => {
    for (const [position, top, alignItems] of [
      ['top-start', true, 'flex-start'],
      ['top-end', true, 'flex-end'],
      ['bottom-start', false, 'flex-start'],
      ['bottom-end', false, 'flex-end'],
    ] as const) {
      const el = await provider(`toast-position="${position}"`);
      toast({body: position, autoHide: false});
      const viewport = viewportOfProvider(el);
      await waitUntil(() => rows(viewport).length === 1, `row ${position}`);
      await settled();
      const box = rows(viewport)[0]!.getBoundingClientRect();
      expect(box.top < window.innerHeight / 2, position).toBe(top);
      const stack = viewport.shadowRoot!.querySelector('.stack')!;
      expect(getComputedStyle(stack).alignItems, position).toBe(alignItems);
      dismissAllToasts();
      await waitUntil(() => rows(viewport).length === 0, 'cleared');
      el.remove();
      resetToastProviders();
    }
  });

  it('keeps the newest toast nearest the configured edge', async () => {
    for (const [position, newestNearEdge] of [
      ['bottom-end', 'bottom'],
      ['top-end', 'top'],
    ] as const) {
      const el = await provider(`toast-position="${position}"`);
      toast({body: 'first', autoHide: false});
      toast({body: 'second', autoHide: false});
      const viewport = viewportOfProvider(el);
      await waitUntil(() => rows(viewport).length === 2, 'rows');
      await settled();
      const [first, second] = rows(viewport).map((row) => row.getBoundingClientRect());
      if (newestNearEdge === 'bottom') expect(second!.top).toBeGreaterThan(first!.top);
      else expect(second!.top).toBeLessThan(first!.top);
      dismissAllToasts();
      await waitUntil(() => rows(viewport).length === 0, 'cleared');
      el.remove();
      resetToastProviders();
    }
  });

  it('puts 8px between toasts and none at the screen edge', async () => {
    toast({body: 'first', autoHide: false});
    toast({body: 'second', autoHide: false});
    const viewport = viewportOf();
    await waitUntil(() => rows(viewport).length === 2, 'rows');
    await settled();
    const boxes = rows(viewport).map((row) => row.getBoundingClientRect());
    expect(boxes[1]!.top - boxes[0]!.bottom).toBeCloseTo(0, 0);
    const style = rows(viewport).map((row) => getComputedStyle(row).paddingBottom);
    expect(style).toEqual(['8px', '0px']);
  });

  it('applies custom insets from the provider config', async () => {
    const el = await provider();
    el.toastInset = {bottom: 60, end: 40};
    await el.updateComplete;
    toast({body: 'inset', autoHide: false});
    const viewport = viewportOfProvider(el);
    await waitUntil(() => rows(viewport).length === 1, 'row');
    await settled();
    const box = rows(viewport)[0]!.getBoundingClientRect();
    expect(window.innerHeight - box.bottom).toBeGreaterThanOrEqual(60);
    expect(window.innerWidth - box.right).toBeGreaterThanOrEqual(40);
  });
});

describe('visible limit', () => {
  it('keeps the five-toast default and supports an explicit cap; older toasts resurface when room appears', async () => {
    for (let i = 1; i <= 6; i++) toast({body: `toast ${i}`, autoHide: false});
    const viewport = viewportOf();
    await waitUntil(() => rows(viewport).length === 5, 'five rows');
    expect(toastsOf(viewport)[0]!.textContent).toContain('toast 2');
    viewport.maxVisible = 1;
    await waitUntil(() => rows(viewport).length === 1, 'one row');
    expect(toastsOf(viewport)[0]!.textContent).toContain('toast 6');
    viewport.maxVisible = 5;
    await waitUntil(() => rows(viewport).length === 5, 'five again');
  });

  it('the provider passes toast-max-visible on', async () => {
    const el = await provider('toast-max-visible="2"');
    for (let i = 1; i <= 4; i++) toast({body: `toast ${i}`, autoHide: false});
    await waitUntil(() => rows(viewportOfProvider(el)).length === 2, 'two rows');
  });
});

describe('uniqueId', () => {
  it('overwrites a toast with the same uniqueId by default, in place', async () => {
    toast({body: 'v1', uniqueId: 'save', autoHide: false});
    toast({body: 'other', autoHide: false});
    toast({body: 'v2', uniqueId: 'save', autoHide: false});
    const viewport = viewportOf();
    await waitUntil(() => rows(viewport).length === 2, 'rows');
    await waitUntil(() => toastsOf(viewport)[0]!.textContent.includes('v2'), 'overwritten');
    expect(toastsOf(viewport)[1]!.textContent).toContain('other');
  });

  it('collisionBehavior "ignore" keeps the existing one and does not announce the ignored one', async () => {
    toast({body: 'first', uniqueId: 'once', autoHide: false, collisionBehavior: 'ignore'});
    toast({body: 'second', uniqueId: 'once', autoHide: false, collisionBehavior: 'ignore'});
    const viewport = viewportOf();
    await waitUntil(() => rows(viewport).length === 1, 'row');
    await aTimeout(100);
    expect(rows(viewport)).toHaveLength(1);
    expect(toastsOf(viewport)[0]!.textContent).toContain('first');
  });

  it('dismissToast(uniqueId) dismisses it; dismissAllToasts() clears the stack', async () => {
    toast({body: 'a', uniqueId: 'a', autoHide: false});
    toast({body: 'b', uniqueId: 'b', autoHide: false});
    const viewport = viewportOf();
    await waitUntil(() => rows(viewport).length === 2, 'rows');
    dismissToast('a');
    await waitUntil(() => rows(viewport).length === 1, 'a removed');
    dismissAllToasts();
    await waitUntil(() => rows(viewport).length === 0, 'all removed');
  });
});

describe('dismissing', () => {
  it('the returned function dismisses with reason manual and onHide fires exactly once, even if dismissed twice', async () => {
    const onHide = vi.fn();
    const dismiss = toast({body: 'bye', autoHide: false, onHide});
    const viewport = viewportOf();
    await waitUntil(() => rows(viewport).length === 1, 'row');
    dismiss();
    dismiss();
    await waitUntil(() => rows(viewport).length === 0, 'removed');
    expect(onHide).toHaveBeenCalledTimes(1);
    expect(onHide).toHaveBeenCalledWith('manual');
  });

  it('auto-hide reports "auto" and removes the toast; error toasts persist by default', async () => {
    const onHide = vi.fn();
    toast({body: 'auto', autoHideDuration: 100, onHide});
    toast({body: 'stays', type: 'error'});
    const viewport = viewportOf();
    await waitUntil(() => onHide.mock.calls.length === 1, 'auto hidden');
    expect(onHide).toHaveBeenCalledWith('auto');
    await waitUntil(() => rows(viewport).length === 1, 'one row left');
    expect(toastsOf(viewport)[0]!.type).toBe('error');
    await aTimeout(200);
    expect(rows(viewport)).toHaveLength(1);
  });

  it('collapses a dismissed toast before removing it', async () => {
    const dismiss = toast({body: 'collapse', autoHide: false});
    const viewport = viewportOf();
    await waitUntil(() => rows(viewport).length === 1, 'row');
    await settled();
    dismiss();
    await waitUntil(() => rows(viewport)[0]?.hasAttribute('data-exiting') === true, 'exiting');
    expect(rows(viewport)).toHaveLength(1);
    await waitUntil(() => rows(viewport).length === 0, 'removed');
  });

  it('a prevented tct-toast-dismiss keeps the toast', async () => {
    toast({body: 'keep', autoHide: false});
    const viewport = viewportOf();
    await waitUntil(() => rows(viewport).length === 1, 'row');
    document.addEventListener('tct-toast-dismiss', (event) => event.preventDefault(), {once: true});
    toastsOf(viewport)[0]!.dismiss();
    await aTimeout(300);
    expect(rows(viewport)).toHaveLength(1);
  });

  it('the visible close button is a single-pointer alternative to swiping', async () => {
    toast({body: 'button', autoHide: false});
    const viewport = viewportOf();
    await waitUntil(() => rows(viewport).length === 1, 'row');
    await settled();
    await userEvent.click(toastsOf(viewport)[0]!.shadowRoot!.querySelector('.dismiss')!);
    await waitUntil(() => rows(viewport).length === 0, 'removed');
  });

  it('ignores a grid-template-rows transition bubbling from a descendant', async () => {
    toast({body: 'x', autoHide: false});
    const viewport = viewportOf();
    await waitUntil(() => rows(viewport).length === 1, 'row');
    const row = rows(viewport)[0]!;
    row.querySelector('tct-toast')!.dispatchEvent(
      new TransitionEvent('transitionend', {
        propertyName: 'grid-template-rows',
        bubbles: true,
        composed: true,
      }),
    );
    await aTimeout(50);
    expect(rows(viewport)).toHaveLength(1);
  });
});

describe('keyboard reach and focus', () => {
  it('F6 moves focus into the newest toast, and dismissing the last focused toast restores the previous focus', async () => {
    const outside = await fixture<HTMLElement>('<div><button id="before">before</button></div>');
    const before = outside.querySelector<HTMLElement>('#before')!;
    toast({body: 'older', autoHide: false});
    toast({body: 'newer', autoHide: false});
    const viewport = viewportOf();
    await waitUntil(() => rows(viewport).length === 2, 'rows');
    before.focus();
    await pressKeys('F6');
    const newest = toastsOf(viewport)[1]!;
    expect(newest.shadowRoot!.contains(deepActiveElement())).toBe(true);
    await pressKeys('Enter');
    await waitUntil(() => rows(viewport).length === 1, 'newer dismissed');
    // Focus moved to the remaining toast, not <body>.
    await waitUntil(
      () => toastsOf(viewport)[0]!.shadowRoot!.contains(deepActiveElement()),
      'focus on the remaining toast',
    );
    await pressKeys('Enter');
    await waitUntil(() => rows(viewport).length === 0, 'all dismissed');
    await waitUntil(() => deepActiveElement() === before, 'focus restored to where it was');
  });

  it('a toast with a trailing action focuses that action first', async () => {
    toast({body: 'Deleted', endContent: html`<button id="undo">Undo</button>`, autoHide: false});
    const viewport = viewportOf();
    await waitUntil(() => rows(viewport).length === 1, 'row');
    await pressKeys('F6');
    expect(deepActiveElement()?.id).toBe('undo');
  });
});

describe('landmark and announcements', () => {
  it('does not expose an empty notifications landmark', async () => {
    const el = await provider();
    expect((await axNode(viewportOfProvider(el))).role).not.toBe('region');
  });

  it('exposes the "Notifications" region, without aria-modal, while a toast is visible', async () => {
    const el = await provider();
    toast({body: 'hello', autoHide: false});
    const viewport = viewportOfProvider(el);
    await waitUntil(() => rows(viewport).length === 1, 'row');
    expect(await axNode(viewport)).toMatchObject({role: 'region', name: 'Notifications'});
    expect(viewport.hasAttribute('aria-modal')).toBe(false);
  });

  it('does not duplicate the landmark for nested providers', async () => {
    const root = await fixture<HTMLElement>(
      `<tct-layer-provider><tct-layer-provider><main>x</main></tct-layer-provider></tct-layer-provider>`,
    );
    const outer = root as TctLayerProvider;
    const inner = outer.querySelector<TctLayerProvider>('tct-layer-provider')!;
    await outer.updateComplete;
    await inner.updateComplete;
    expect(inner.nested).toBe(true);
    expect(document.querySelectorAll('tct-toast-viewport')).toHaveLength(1);
  });

  it('announces an info toast politely with its flattened text, and an error assertively, once', async () => {
    // The live-region path (engines without ariaNotify); with ariaNotify the same text goes there.
    const restore = overrideFeature('ariaNotify', false);
    try {
      toast({body: html`Saved <b>3</b> items`, autoHide: false});
      await waitUntil(
        () => (getAnnouncerRegions().polite?.textContent ?? '') !== '',
        'polite announcement',
        3000,
      );
      expect(getAnnouncerRegions().polite!.textContent).toBe('Saved 3 items');
      toast({body: 'It failed', type: 'error'});
      await waitUntil(
        () => (getAnnouncerRegions().assertive?.textContent ?? '') !== '',
        'assertive announcement',
        3000,
      );
      expect(getAnnouncerRegions().assertive!.textContent).toBe('It failed');
    } finally {
      restore();
    }
  });

  it('the toast is not a live region of its own (no double announcement)', async () => {
    toast({body: 'quiet', autoHide: false});
    const viewport = viewportOf();
    await waitUntil(() => rows(viewport).length === 1, 'row');
    const node = toastsOf(viewport)[0]!;
    expect(node.matches('[aria-live]')).toBe(false);
    expect(await axNode(node)).toMatchObject({role: 'status'});
  });
});

describe('renderContent through toast()', () => {
  it('replaces the layout of that toast only, hands over body and endContent, and keeps auto-hide', async () => {
    toast({
      body: 'Custom body',
      endContent: 'end!',
      autoHideDuration: 150,
      renderContent: ({body, endContent, dismiss, autoHide, autoHideDuration}) =>
        html`<div id="custom">
          <span>${body}</span><span>${endContent}</span><span>${autoHide} ${autoHideDuration}</span
          ><button id="close" @click=${dismiss}>x</button>
        </div>`,
    });
    toast({body: 'Plain', autoHide: false});
    const viewport = viewportOf();
    await waitUntil(() => rows(viewport).length === 2, 'rows');
    const custom = toastsOf(viewport)[0]!.shadowRoot!.querySelector('#custom')!;
    expect(custom.textContent).toContain('Custom body');
    expect(custom.textContent).toContain('end!');
    expect(custom.textContent).toContain('true 150');
    expect(toastsOf(viewport)[1]!.shadowRoot!.querySelector('.dismiss')).not.toBeNull();
    await waitUntil(() => rows(viewport).length === 1, 'auto dismissed');
  });
});

describe('under a modal dialog', () => {
  it('a toast action stays clickable while the dialog is modal, and does not dismiss it', async () => {
    const clicked = vi.fn();
    const modal = await fixture<TctTestLayer>(
      `<tct-test-layer kind="modal"><button slot="trigger">open</button><p>modal body</p></tct-test-layer>`,
    );
    modal.open = true;
    await waitUntil(() => modal.layer.isOpen, 'modal open');
    toast({
      body: 'Deleted',
      endContent: html`<button
        id="undo"
        style="color:inherit;background:transparent;border:1px solid"
        @click=${clicked}
      >
        Undo
      </button>`,
      autoHide: false,
    });
    const viewport = toastViewport();
    await waitUntil(() => rows(viewport).length === 1, 'row');
    await waitUntil(
      () => viewport.closest('dialog') !== null || modal.shadowRoot!.contains(viewport),
      'moved into the modal',
    );
    await settled();
    const undo = toastsOf(viewport)[0]!.querySelector<HTMLElement>('#undo')!;
    await userEvent.click(undo);
    expect(clicked).toHaveBeenCalledTimes(1);
    expect(modal.layer.isOpen).toBe(true);
    // Closing the modal gives the viewport back to where it came from.
    modal.open = false;
    await waitUntil(() => !modal.layer.isOpen, 'modal closed');
    await waitUntil(
      () => viewport.closest('dialog') === null && viewport.isConnected,
      'moved back',
    );
    expect(rows(viewport)).toHaveLength(1);
  });

  it('a toast raised before the modal opens is moved into it, and stays above it', async () => {
    toast({
      body: 'early',
      endContent: html`<button
        id="early-action"
        style="color:inherit;background:transparent;border:1px solid"
      >
        Go
      </button>`,
      autoHide: false,
    });
    const viewport = toastViewport();
    await waitUntil(() => rows(viewport).length === 1, 'row');
    const modal = await fixture<TctTestLayer>(
      `<tct-test-layer kind="modal"><button slot="trigger">open</button><p>modal body</p></tct-test-layer>`,
    );
    modal.open = true;
    await waitUntil(() => modal.layer.isOpen, 'modal open');
    await settled();
    const action = toastsOf(viewport)[0]!.querySelector<HTMLElement>('#early-action')!;
    const rect = action.getBoundingClientRect();
    // Painted above the modal: the top-most element at the action is the viewport (moved into the dialog).
    const hit = modal.shadowRoot!.elementsFromPoint(
      rect.left + rect.width / 2,
      rect.top + rect.height / 2,
    );
    expect(hit[0]).toBe(viewport);
  });
});

describe('a11y, motion, forced colours', () => {
  it('passes axe with toasts of every kind in the stack', async () => {
    const el = await provider();
    toast({
      body: 'Info toast',
      endContent: html`<button style="color:inherit;background:transparent;border:1px solid">
        Undo
      </button>`,
      autoHide: false,
    });
    toast({body: 'Error toast', type: 'error'});
    await waitUntil(() => rows(viewportOfProvider(el)).length === 2, 'rows');
    await settled();
    await expectAccessible(viewportOfProvider(el));
  });

  it('runs no slide under reduced motion but still collapses (the transition stays eventful)', async () => {
    const restore = await emulateMedia({reducedMotion: 'reduce'});
    try {
      const dismiss = toast({body: 'reduced', autoHide: false});
      const viewport = viewportOf();
      await waitUntil(() => rows(viewport).length === 1, 'row');
      dismiss();
      await waitUntil(() => rows(viewport).length === 0, 'removed');
    } finally {
      await restore();
    }
  });

  it('does not paint the host: no background, no border, clicks pass through the empty stack', async () => {
    toast({body: 'x', autoHide: false});
    const viewport = viewportOf();
    await waitUntil(() => rows(viewport).length === 1, 'row');
    const style = getComputedStyle(viewport);
    expect(style.backgroundColor).toBe('rgba(0, 0, 0, 0)');
    expect(style.pointerEvents).toBe('none');
    expect(getComputedStyle(rows(viewport)[0]!).pointerEvents).toBe('auto');
  });

  it('the viewport is registered on the layer stack without taking Escape or outside presses', async () => {
    toast({body: 'x', autoHide: false});
    const viewport = viewportOf();
    await waitUntil(() => rows(viewport).length === 1, 'row');
    const layers = layerStack();
    expect(layers.some((layer) => layer.kind === 'toast')).toBe(true);
    await pressKeys('Escape');
    await aTimeout(80);
    expect(rows(viewport)).toHaveLength(1);
    await userEvent.click(document.body);
    await aTimeout(50);
    expect(rows(viewport)).toHaveLength(1);
  });
});

describe('tct-layer-provider', () => {
  it('has no box of its own and no shadow root; the app stays in it', async () => {
    const el = await provider();
    expect(getComputedStyle(el).display).toBe('contents');
    expect(el.shadowRoot).toBeNull();
    expect(el.querySelector('#app')).not.toBeNull();
    expect(el.viewport).not.toBeNull();
  });

  it('routes toast() to the outermost connected provider and scopes with { from }', async () => {
    const root = await fixture<HTMLElement>(
      `<div><tct-layer-provider id="a" toast-position="top-end"><span id="a-inner">a</span></tct-layer-provider><tct-layer-provider id="b" toast-position="bottom-start"><span id="b-inner">b</span></tct-layer-provider></div>`,
    );
    const a = root.querySelector<TctLayerProvider>('#a')!;
    const b = root.querySelector<TctLayerProvider>('#b')!;
    await a.updateComplete;
    await b.updateComplete;
    toast({body: 'to a', autoHide: false});
    toast({body: 'to b', autoHide: false}, {from: root.querySelector('#b-inner')!});
    await waitUntil(() => rows(a.viewport!).length === 1 && rows(b.viewport!).length === 1, 'rows');
    expect(toastsOf(a.viewport!)[0]!.textContent).toContain('to a');
    expect(toastsOf(b.viewport!)[0]!.textContent).toContain('to b');
  });

  it('carries the whole toast config as one object', async () => {
    const el = await provider();
    el.toast = {position: 'top-start', maxVisible: 1, inset: {top: 30}};
    await el.updateComplete;
    const viewport = viewportOfProvider(el);
    expect([viewport.position, viewport.maxVisible, viewport.inset]).toEqual([
      'top-start',
      1,
      {top: 30},
    ]);
    el.toastPosition = 'bottom-end';
    await el.updateComplete;
    expect(viewport.position).toBe('bottom-end');
  });
});

// ---------------------------------------------------------------------------- keyboard table

type Row = {keys: string; action: string; when?: string};
const parity = Object.values(
  import.meta.glob<{entries: {'core.toast': {keyboard: Row[]}}}>('./parity.json', {
    eager: true,
    import: 'default',
  }),
)[0]!;

const closeOf = (viewport: TctToastViewport): HTMLElement =>
  toastsOf(viewport)[0]!.shadowRoot!.querySelector<HTMLElement>('.dismiss')!;

runKeyboardSuite({
  tag: 'tct-toast-viewport',
  render: () => '<tct-toast-viewport></tct-toast-viewport>',
  table: parity.entries['core.toast'].keyboard,
  steps: {
    'Moves focus into the newest toast (its trailing action first, then the close button)': {
      setup: async (element) => {
        const viewport = element as TctToastViewport;
        viewport.parentElement!.insertAdjacentHTML(
          'afterbegin',
          '<button id="before">before</button>',
        );
        viewport.addToast({
          id: 'kb-1',
          createdAt: 0,
          options: {
            body: 'Deleted',
            autoHide: false,
            endContent: html`<button id="undo" style="color:inherit">Undo</button>`,
          },
        });
        await waitUntil(() => rows(viewport).length === 1, 'row');
      },
      focus: (element) => element.parentElement!.querySelector<HTMLElement>('#before'),
      keys: ['F6'],
      expect: () => {
        expect(deepActiveElement()?.id).toBe('undo');
      },
    },
    'Activates the focused close button or trailing action; dismissing a focused toast hands focus to a remaining toast, or back to where it was':
      {
        setup: async (element) => {
          const viewport = element as TctToastViewport;
          viewport.addToast({
            id: 'kb-2',
            createdAt: 0,
            options: {body: 'Closable', autoHide: false},
          });
          await waitUntil(() => rows(viewport).length === 1, 'row');
          await aTimeout(260);
        },
        focus: (element) => closeOf(element as TctToastViewport),
        keys: ['Enter'],
        expect: async ({element}) => {
          await waitUntil(
            () => rows(element as TctToastViewport).length === 0,
            'dismissed by Enter',
          );
        },
      },
    "Moves between the toast's controls; leaving the toast resumes the auto-hide countdown": {
      setup: async (element) => {
        const viewport = element as TctToastViewport;
        viewport.addToast({
          id: 'kb-3',
          createdAt: 0,
          options: {
            body: 'Two controls',
            autoHide: false,
            endContent: html`<button id="action" style="color:inherit">Do</button>`,
          },
        });
        await waitUntil(() => rows(viewport).length === 1, 'row');
      },
      focus: (element) =>
        (element as TctToastViewport).querySelector<HTMLElement>('#action') ??
        toastsOf(element as TctToastViewport)[0]!.querySelector<HTMLElement>('#action'),
      keys: ['Tab'],
      expect: ({element}) => {
        expect(deepActiveElement()).toBe(closeOf(element as TctToastViewport));
      },
    },
  },
  waive: {},
});
