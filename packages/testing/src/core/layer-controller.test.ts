/**
 * `LayerController` behaviour (A§9.9): nesting, outside press, focus return, scroll lock, exit
 * animation, native closes, moves while open, top-layer persistence, context parents, Tier-2 paths.
 */
import {html} from 'lit';
import {userEvent} from 'vitest/browser';
import {beforeAll, describe, expect, it} from 'vitest';
import {announce, getAnnouncerRegions} from '@tecton-wc/core/a11y/announcer.js';
import {defineElement} from '@tecton-wc/core/define.js';
import {overrideFeature} from '@tecton-wc/core/features.js';
import {isScrollLocked} from '@tecton-wc/core/layer/scroll-lock.js';
import {
  registerTopLayerPersistent,
  topmostModalSurface,
} from '@tecton-wc/core/layer/top-layer-host.js';
import {deepActiveElement} from '@tecton-wc/core/utils/focus.js';
import {fixture, settle} from '../fixture.js';
import {recordEvents} from '../events.js';
import {pressKeys} from '../keyboard.js';
import {layerStack, openLayer} from '../layers.js';
import {TctTestLayer} from '../fixtures/test-layer.js';
import {aTimeout, nextFrame, waitUntil} from '../timing.js';

beforeAll(() => {
  defineElement(TctTestLayer);
});

const shown = (host: TctTestLayer): boolean => {
  const surface = host.surface;
  if (!surface) return false;
  return surface instanceof HTMLDialogElement ? surface.open : surface.matches(':popover-open');
};

describe('show, hide and events', () => {
  it('show() and hide() emit nothing; property writes emit no intent events', async () => {
    const layer = await fixture<TctTestLayer>(html`<tct-test-layer>content</tct-test-layer>`);
    const events = recordEvents(layer, ['tct-open-change', 'tct-after-open-change']);

    layer.open = true;
    await waitUntil(() => events.named('tct-after-open-change').length === 1, 'after-open');
    expect(shown(layer)).toBe(true);
    layer.open = false;
    await waitUntil(() => events.named('tct-after-open-change').length === 2, 'after-close');

    expect(events.named('tct-open-change')).toHaveLength(0);
    expect(events.named('tct-after-open-change').map((e) => (e as {open: boolean}).open)).toEqual([
      true,
      false,
    ]);
  });

  it('isOpen turns true synchronously with show() and false synchronously with hide()', async () => {
    const layer = await fixture<TctTestLayer>(html`<tct-test-layer>content</tct-test-layer>`);
    const shownPromise = layer.layer.show();
    expect(layer.layer.isOpen).toBe(true);
    await shownPromise;
    const hiddenPromise = layer.layer.hide();
    expect(layer.layer.isOpen).toBe(false);
    await hiddenPromise;
    expect(shown(layer)).toBe(false);
  });

  it('a second show() while open is a no-op', async () => {
    const layer = await fixture<TctTestLayer>(html`<tct-test-layer>content</tct-test-layer>`);
    await layer.layer.show();
    await layer.layer.show();
    expect(layerStack()).toHaveLength(1);
  });
});

describe('trigger ARIA', () => {
  it('sets aria-expanded and aria-controls on the trigger of a dialog layer', async () => {
    const layer = await fixture<TctTestLayer>(
      html`<tct-test-layer kind="dialog"
        ><button slot="trigger">Open</button>content</tct-test-layer
      >`,
    );
    const trigger = layer.trigger!;
    await layer.layer.show();
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(trigger.getAttribute('aria-haspopup')).toBe('dialog');
    // The surface lives in the host's shadow root, the trigger in the light tree: an id cannot cross.
    expect(trigger.hasAttribute('aria-controls')).toBe(false);
    await layer.layer.hide();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('a popover layer sets aria-expanded but only aria-haspopup when asked', async () => {
    const layer = await fixture<TctTestLayer>(
      html`<tct-test-layer><button slot="trigger">Open</button>content</tct-test-layer>`,
    );
    await layer.layer.show();
    expect(layer.trigger!.getAttribute('aria-expanded')).toBe('true');
    expect(layer.trigger!.hasAttribute('aria-haspopup')).toBe(false);
    const menu = await fixture<TctTestLayer>(
      html`<tct-test-layer aria-haspopup-value="menu"
        ><button slot="trigger">Menu</button>x</tct-test-layer
      >`,
    );
    await menu.layer.show();
    expect(menu.trigger!.getAttribute('aria-haspopup')).toBe('menu');
  });
});

describe('outside press', () => {
  it('closes a popover when the press lands outside, and not for a press inside or on the trigger', async () => {
    const container = await fixture<HTMLDivElement>(
      html`<div>
        <tct-test-layer open
          ><button slot="trigger">Trigger</button
          ><button id="inside">Inside</button></tct-test-layer
        >
        <button id="outside">Outside</button>
      </div>`,
    );
    const layer = container.querySelector<TctTestLayer>('tct-test-layer')!;
    await waitUntil(() => shown(layer), 'open');
    const changes = recordEvents(layer, 'tct-open-change');

    await userEvent.click(container.querySelector('#inside')!);
    expect(changes.named('tct-open-change')).toHaveLength(0);

    await userEvent.click(container.querySelector('#outside')!);
    await waitUntil(() => !shown(layer), 'closed');
    expect(changes.named('tct-open-change')).toHaveLength(1);
    expect((changes.events[0] as {reason: string}).reason).toBe('outside');
  });

  it('never closes a parent because of a press in its child; a press outside closes both', async () => {
    const container = await fixture<HTMLDivElement>(
      html`<div>
        <tct-test-layer data-label="parent" open>
          <button slot="trigger">Parent trigger</button>
          <button id="parent-button">In parent</button>
          <tct-test-layer data-label="child" open>
            <button slot="trigger">Child trigger</button>
            <button id="child-button">In child</button>
          </tct-test-layer>
        </tct-test-layer>
        <button id="outside">Outside</button>
      </div>`,
    );
    const parent = container.querySelector<TctTestLayer>('[data-label="parent"]')!;
    const child = container.querySelector<TctTestLayer>('[data-label="child"]')!;
    await waitUntil(() => shown(parent) && shown(child), 'both open');

    await userEvent.click(container.querySelector('#child-button')!);
    await aTimeout(50);
    expect(shown(parent) && shown(child)).toBe(true);

    // A press in the parent (outside the child) closes the child only.
    await userEvent.click(container.querySelector('#parent-button')!);
    await waitUntil(() => !shown(child), 'child closed');
    expect(shown(parent)).toBe(true);

    child.open = true;
    await waitUntil(() => shown(child), 'child reopened');
    await userEvent.click(container.querySelector('#outside')!);
    await waitUntil(() => !shown(parent) && !shown(child), 'both closed');
  });

  it('a press that dismissed the layer does not reopen it through the same gesture (toggleFromTrigger)', async () => {
    const container = await fixture<HTMLDivElement>(
      html`<div>
        <tct-test-layer open><button slot="trigger">Trigger</button>content</tct-test-layer>
        <button id="external">External toggle</button>
      </div>`,
    );
    const layer = container.querySelector<TctTestLayer>('tct-test-layer')!;
    const external = container.querySelector<HTMLButtonElement>('#external')!;
    // A second toggle control that is NOT the layer's trigger: its press is an outside press.
    external.addEventListener('click', (event) => {
      layer.layer.toggleFromTrigger(event);
    });
    await waitUntil(() => shown(layer), 'open');

    await userEvent.click(external);
    await aTimeout(80);
    expect(shown(layer)).toBe(false);
    expect(layer.open).toBe(false);

    // The next, separate gesture opens it again.
    await userEvent.click(external);
    await waitUntil(() => shown(layer), 'reopened by a new gesture');
  });

  it('the trigger toggles the layer, and a second click closes it', async () => {
    const layer = await fixture<TctTestLayer>(
      html`<tct-test-layer><button slot="trigger">Trigger</button>content</tct-test-layer>`,
    );
    await userEvent.click(layer.trigger!);
    await waitUntil(() => shown(layer), 'opened by click');
    await userEvent.click(layer.trigger!);
    await waitUntil(() => !shown(layer), 'closed by click');
  });

  it('a modal is not dismissed by an outside press unless it asks to; its backdrop counts as outside', async () => {
    const layer = await fixture<TctTestLayer>(
      html`<tct-test-layer kind="modal" open outside-press="true">content</tct-test-layer>`,
    );
    await waitUntil(() => shown(layer), 'open');
    const box = layer.surface!.getBoundingClientRect();
    const changes = recordEvents(layer, 'tct-open-change');
    // A press inside the dialog's box (its own padding) is not outside.
    layer.surface!.dispatchEvent(
      new PointerEvent('pointerdown', {
        bubbles: true,
        composed: true,
        clientX: box.left + box.width / 2,
        clientY: box.top + box.height / 2,
      }),
    );
    expect(changes.named('tct-open-change')).toHaveLength(0);
    // The backdrop dispatches to the dialog itself, with coordinates outside its box.
    layer.surface!.dispatchEvent(
      new PointerEvent('pointerdown', {bubbles: true, composed: true, clientX: 1, clientY: 1}),
    );
    expect(changes.named('tct-open-change')).toHaveLength(1);
  });

  it('modal layers ignore outside presses by default', async () => {
    const layer = await fixture<TctTestLayer>(
      html`<tct-test-layer kind="modal" open>content</tct-test-layer>`,
    );
    await waitUntil(() => shown(layer), 'open');
    const changes = recordEvents(layer, 'tct-open-change');
    layer.surface!.dispatchEvent(
      new PointerEvent('pointerdown', {bubbles: true, composed: true, clientX: 1, clientY: 1}),
    );
    expect(changes.named('tct-open-change')).toHaveLength(0);
  });
});

describe('focus', () => {
  it('returns focus to the trigger when Escape closes the layer', async () => {
    const layer = await fixture<TctTestLayer>(
      html`<tct-test-layer initial-focus="first"
        ><button slot="trigger">Trigger</button><button id="first">First</button></tct-test-layer
      >`,
    );
    layer.trigger!.focus();
    await userEvent.click(layer.trigger!);
    await waitUntil(() => shown(layer), 'open');
    await waitUntil(
      () => deepActiveElement()?.id === 'first',
      'initial focus moved into the layer',
    );

    await pressKeys('Escape');
    await waitUntil(() => !shown(layer), 'closed');
    await waitUntil(() => deepActiveElement() === layer.trigger, 'focus returned to the trigger');
  });

  it('does not steal focus back when the dismissing press landed on another control', async () => {
    const container = await fixture<HTMLDivElement>(
      html`<div>
        <tct-test-layer initial-focus="first"
          ><button slot="trigger">Trigger</button><button id="first">First</button></tct-test-layer
        >
        <input id="elsewhere" aria-label="elsewhere" />
      </div>`,
    );
    const layer = container.querySelector<TctTestLayer>('tct-test-layer')!;
    await userEvent.click(layer.trigger!);
    await waitUntil(() => deepActiveElement()?.id === 'first', 'focus inside');

    await userEvent.click(container.querySelector('#elsewhere')!);
    await waitUntil(() => !shown(layer), 'closed');
    await aTimeout(100);
    expect(deepActiveElement()).toBe(container.querySelector('#elsewhere'));
  });

  it('returns focus to the trigger when the press landed on nothing focusable', async () => {
    const container = await fixture<HTMLDivElement>(
      html`<div>
        <tct-test-layer initial-focus="first"
          ><button slot="trigger">Trigger</button><button id="first">First</button></tct-test-layer
        >
        <p id="empty" style="padding:24px">plain text</p>
      </div>`,
    );
    const layer = container.querySelector<TctTestLayer>('tct-test-layer')!;
    await userEvent.click(layer.trigger!);
    await waitUntil(() => deepActiveElement()?.id === 'first', 'focus inside');

    await userEvent.click(container.querySelector('#empty')!);
    await waitUntil(() => !shown(layer), 'closed');
    await waitUntil(() => deepActiveElement() === layer.trigger, 'focus back on the trigger');
  });

  it('return-focus="false" leaves focus wherever it fell', async () => {
    const layer = await fixture<TctTestLayer>(
      html`<tct-test-layer initial-focus="first" return-focus="false"
        ><button slot="trigger">Trigger</button><button id="first">First</button></tct-test-layer
      >`,
    );
    await userEvent.click(layer.trigger!);
    await waitUntil(() => deepActiveElement()?.id === 'first', 'focus inside');
    await pressKeys('Escape');
    await waitUntil(() => !shown(layer), 'closed');
    await aTimeout(50);
    expect(deepActiveElement()).not.toBe(layer.trigger);
  });

  it('initial-focus="surface" focuses the surface itself', async () => {
    const layer = await fixture<TctTestLayer>(
      html`<tct-test-layer initial-focus="surface"
        ><button slot="trigger">T</button>x</tct-test-layer
      >`,
    );
    await layer.layer.show();
    expect(deepActiveElement()).toBe(layer.surface);
  });
});

describe('modal layers', () => {
  it('uses showModal, locks page scroll, and releases everything on close', async () => {
    expect(isScrollLocked()).toBe(false);
    const layer = await fixture<TctTestLayer>(
      html`<tct-test-layer kind="modal">content</tct-test-layer>`,
    );
    await layer.layer.show();
    expect((layer.surface as HTMLDialogElement).matches(':modal')).toBe(true);
    expect(isScrollLocked()).toBe(true);
    expect(document.documentElement.style.overflow).toBe('hidden');
    expect(topmostModalSurface()).toBe(layer.surface);

    await layer.layer.hide();
    expect(isScrollLocked()).toBe(false);
    expect(document.documentElement.style.overflow).toBe('');
    expect(topmostModalSurface()).toBeNull();
  });

  it('nested modals share the lock, released with the last one', async () => {
    const outer = await fixture<TctTestLayer>(
      html`<tct-test-layer kind="modal" open
        ><tct-test-layer kind="modal" open>x</tct-test-layer></tct-test-layer
      >`,
    );
    const inner = outer.querySelector<TctTestLayer>('tct-test-layer')!;
    await waitUntil(() => shown(outer) && shown(inner), 'both open');
    expect(isScrollLocked()).toBe(true);
    inner.open = false;
    await waitUntil(() => !shown(inner), 'inner closed');
    expect(isScrollLocked()).toBe(true);
    outer.open = false;
    await waitUntil(() => !shown(outer), 'outer closed');
    expect(isScrollLocked()).toBe(false);
  });

  it('non-modal dialog and popover layers do not lock scroll', async () => {
    const dialog = await fixture<TctTestLayer>(
      html`<tct-test-layer kind="dialog">x</tct-test-layer>`,
    );
    await dialog.layer.show();
    expect(isScrollLocked()).toBe(false);
    const popover = await fixture<TctTestLayer>(html`<tct-test-layer>x</tct-test-layer>`);
    await popover.layer.show();
    expect(isScrollLocked()).toBe(false);
  });

  it('a dialog opened non-modally by markup is upgraded to a modal by showModal()', async () => {
    const layer = await fixture<TctTestLayer>(
      html`<tct-test-layer kind="modal">x</tct-test-layer>`,
    );
    (layer.surface as HTMLDialogElement).show();
    expect((layer.surface as HTMLDialogElement).matches(':modal')).toBe(false);
    await layer.layer.show();
    expect((layer.surface as HTMLDialogElement).matches(':modal')).toBe(true);
  });
});

describe('exit animation', () => {
  it('is awaited before the native hide, with isOpen already false', async () => {
    const layer = await fixture<TctTestLayer>(
      html`<tct-test-layer animated open>x</tct-test-layer>`,
    );
    await waitUntil(() => shown(layer), 'open');
    await waitUntil(() => layer.layer.isOpen, 'registered');
    await aTimeout(200); // the entry settles and its own after-open-change fires
    const after = recordEvents(layer, 'tct-after-open-change');

    layer.open = false;
    await layer.updateComplete;
    expect(layer.layer.isOpen).toBe(false);
    expect(shown(layer)).toBe(true); // still visible while the exit animation runs
    expect(after.events).toHaveLength(0);
    await waitUntil(() => !shown(layer), 'hidden after the animation');
    await waitUntil(() => after.events.length > 0, 'after event');
    expect(after.events).toHaveLength(1);
    expect((after.events[0] as {open: boolean}).open).toBe(false);
  });

  it('a layer being hidden is off the stack: the next Escape belongs to the layer below', async () => {
    const container = await fixture<HTMLDivElement>(
      html`<div>
        <tct-test-layer data-label="below" open>x</tct-test-layer>
        <tct-test-layer data-label="above" animated open>x</tct-test-layer>
      </div>`,
    );
    const below = container.querySelector<TctTestLayer>('[data-label="below"]')!;
    const above = container.querySelector<TctTestLayer>('[data-label="above"]')!;
    await waitUntil(() => shown(below) && shown(above), 'both open');

    above.open = false;
    await above.updateComplete;
    expect(layerStack().map((entry) => (entry.host as HTMLElement).dataset.label)).toEqual([
      'below',
    ]);
    await pressKeys('Escape');
    await waitUntil(() => !shown(below) && !shown(above), 'both closed');
  });

  it('a show() during the exit animation cancels the hide', async () => {
    const layer = await fixture<TctTestLayer>(
      html`<tct-test-layer animated open>x</tct-test-layer>`,
    );
    await waitUntil(() => shown(layer), 'open');
    layer.open = false;
    await layer.updateComplete;
    layer.open = true;
    await layer.updateComplete;
    await aTimeout(300);
    expect(shown(layer)).toBe(true);
    expect(layer.layer.isOpen).toBe(true);
    expect(layerStack()).toHaveLength(1);
  });
});

describe('closes the platform did on its own', () => {
  it('a popover hidden by hidePopover() syncs state and unregisters the layer', async () => {
    const layer = await fixture<TctTestLayer>(html`<tct-test-layer open>x</tct-test-layer>`);
    await waitUntil(() => shown(layer), 'open');
    layer.surface!.hidePopover();
    await waitUntil(() => !layer.open, 'owner told');
    expect(layer.layer.isOpen).toBe(false);
    expect(layerStack()).toHaveLength(0);
  });

  it('a modal closed by dialog.close() (form method=dialog) unlocks scroll and tells the owner', async () => {
    const layer = await fixture<TctTestLayer>(
      html`<tct-test-layer kind="modal" open>x</tct-test-layer>`,
    );
    await waitUntil(() => shown(layer), 'open');
    (layer.surface as HTMLDialogElement).close();
    await waitUntil(() => !layer.open, 'owner told');
    expect(isScrollLocked()).toBe(false);
    expect(layerStack()).toHaveLength(0);
  });
});

describe('moving an open layer', () => {
  it('moveBefore() keeps a modal modal, registered and locked', async () => {
    const container = await fixture<HTMLDivElement>(
      html`<div>
        <section id="a"><tct-test-layer kind="modal" open>x</tct-test-layer></section>
        <section id="b"></section>
      </div>`,
    );
    const layer = container.querySelector<TctTestLayer>('tct-test-layer')!;
    await waitUntil(() => shown(layer), 'open');
    const target = container.querySelector('#b')!;
    if (!('moveBefore' in target)) return; // engines without moveBefore are covered by the next test
    (target as unknown as {moveBefore(node: Node, ref: Node | null): void}).moveBefore(layer, null);
    await nextFrame();
    expect(layer.parentElement).toBe(target);
    expect((layer.surface as HTMLDialogElement).matches(':modal')).toBe(true);
    expect(layerStack()).toHaveLength(1);
    expect(isScrollLocked()).toBe(true);
  });

  it('a plain DOM move (which closes the dialog natively) re-shows it on reconnect', async () => {
    const container = await fixture<HTMLDivElement>(
      html`<div>
        <section id="a"><tct-test-layer kind="modal" open>x</tct-test-layer></section>
        <section id="b"></section>
      </div>`,
    );
    const layer = container.querySelector<TctTestLayer>('tct-test-layer')!;
    await waitUntil(() => shown(layer), 'open');

    container.querySelector('#b')!.append(layer);
    await waitUntil(
      () => (layer.surface as HTMLDialogElement).matches(':modal'),
      're-shown as a modal',
    );
    expect(layer.open).toBe(true);
    expect(layer.layer.isOpen).toBe(true);
    expect(layerStack()).toHaveLength(1);
    expect(isScrollLocked()).toBe(true);
  });

  it('a plain move of a popover layer re-shows it too, and a removed layer releases its lock', async () => {
    const container = await fixture<HTMLDivElement>(
      html`<div>
        <section id="a"><tct-test-layer open>x</tct-test-layer></section>
        <section id="b"></section>
      </div>`,
    );
    const layer = container.querySelector<TctTestLayer>('tct-test-layer')!;
    await waitUntil(() => shown(layer), 'open');
    container.querySelector('#b')!.append(layer);
    await waitUntil(() => shown(layer), 're-shown');
    expect(layerStack()).toHaveLength(1);

    const modal = await fixture<TctTestLayer>(
      html`<tct-test-layer kind="modal" open>x</tct-test-layer>`,
    );
    await waitUntil(() => isScrollLocked(), 'locked');
    modal.remove();
    expect(isScrollLocked()).toBe(false);
  });
});

describe('top-layer persistence', () => {
  it('moves registered UI into the top-most modal and back home when it closes', async () => {
    const region = document.createElement('div');
    region.dataset.persistent = '';
    document.body.append(region);
    const stop = registerTopLayerPersistent(region);
    try {
      const layer = await fixture<TctTestLayer>(
        html`<tct-test-layer kind="modal">x</tct-test-layer>`,
      );
      expect(region.parentNode).toBe(document.body);
      await layer.layer.show();
      expect(region.parentNode).toBe(layer.surface);
      await layer.layer.hide();
      expect(region.parentNode).toBe(document.body);
    } finally {
      stop();
      region.remove();
    }
  });

  it('follows the top-most of several modals', async () => {
    const region = document.createElement('div');
    document.body.append(region);
    const stop = registerTopLayerPersistent(region);
    try {
      const outer = await fixture<TctTestLayer>(
        html`<tct-test-layer kind="modal" open
          ><tct-test-layer kind="modal" open>x</tct-test-layer></tct-test-layer
        >`,
      );
      const inner = outer.querySelector<TctTestLayer>('tct-test-layer')!;
      await waitUntil(() => shown(outer) && shown(inner), 'both open');
      expect(region.parentNode).toBe(inner.surface);
      inner.open = false;
      await waitUntil(() => region.parentNode === outer.surface, 'moved to the outer modal');
    } finally {
      stop();
      region.remove();
    }
  });

  it('keeps an open popover open across the move (moveBefore) and re-shows it without moveBefore', async () => {
    for (const moveBefore of [true, false]) {
      const restore = overrideFeature('moveBefore', moveBefore);
      const toast = document.createElement('div');
      toast.setAttribute('popover', 'manual');
      toast.textContent = 'toast';
      document.body.append(toast);
      toast.showPopover();
      const stop = registerTopLayerPersistent(toast);
      try {
        const layer = await fixture<TctTestLayer>(
          html`<tct-test-layer kind="modal">x</tct-test-layer>`,
        );
        await layer.layer.show();
        expect(toast.parentNode).toBe(layer.surface);
        expect(toast.matches(':popover-open'), `moveBefore=${moveBefore}`).toBe(true);
        await layer.layer.hide();
        expect(toast.parentNode).toBe(document.body);
        expect(toast.matches(':popover-open'), `moveBefore=${moveBefore} back`).toBe(true);
      } finally {
        stop();
        toast.remove();
        restore();
      }
    }
  });

  it('an announcement made while a modal is open is spoken from inside the modal', async () => {
    const restore = overrideFeature('ariaNotify', false);
    try {
      const layer = await fixture<TctTestLayer>(
        html`<tct-test-layer kind="modal">x</tct-test-layer>`,
      );
      announce('warm up');
      await layer.layer.show();
      const {polite} = getAnnouncerRegions();
      expect(polite).toBeDefined();
      expect(layer.surface!.contains(polite!)).toBe(true);
      await layer.layer.hide();
      expect(polite!.parentNode).toBe(document.body);
    } finally {
      restore();
    }
  });
});

describe('context: parent layers', () => {
  it('a nested layer finds its enclosing layer through context', async () => {
    const outer = await fixture<TctTestLayer>(
      html`<tct-test-layer><tct-test-layer>x</tct-test-layer></tct-test-layer>`,
    );
    const inner = outer.querySelector<TctTestLayer>('tct-test-layer')!;
    await settle(outer);
    expect(inner.layer.parent).toBe(outer.layer);
    expect(outer.layer.parent).toBeNull();
  });

  it('containment orders layers even when the inner one registered first', async () => {
    const outer = await fixture<TctTestLayer>(
      html`<tct-test-layer><tct-test-layer>x</tct-test-layer></tct-test-layer>`,
    );
    const inner = outer.querySelector<TctTestLayer>('tct-test-layer')!;
    inner.open = true;
    await waitUntil(() => shown(inner), 'inner open first');
    outer.open = true;
    await waitUntil(() => shown(outer), 'outer open second');
    expect(layerStack().map((entry) => entry.token)).toEqual([outer.layer, inner.layer]);
    expect(inner.layer.isTopmost).toBe(true);
    await pressKeys('Escape');
    await waitUntil(() => !shown(inner), 'inner closed first');
    expect(shown(outer)).toBe(true);
  });
});

describe('Tier-2 paths', () => {
  it('works without the Popover API (display fallback) and without CloseWatcher', async () => {
    const restorePopover = overrideFeature('popover', false);
    const restoreWatcher = overrideFeature('closeWatcher', false);
    try {
      const layer = await fixture<TctTestLayer>(html`<tct-test-layer>x</tct-test-layer>`);
      await openLayer(layer);
      expect(layer.layer.isOpen).toBe(true);
      expect(layer.surface!.style.display).toBe('block');
      await layer.layer.hide();
      expect(layer.surface!.style.display).toBe('none');
    } finally {
      restorePopover();
      restoreWatcher();
    }
  });

  it('never throws for a layer whose surface is missing', async () => {
    const layer = await fixture<TctTestLayer>(html`<tct-test-layer>x</tct-test-layer>`);
    layer.surface!.remove();
    await expect(layer.layer.show()).resolves.toBeUndefined();
    expect(layer.layer.isOpen).toBe(false);
  });
});
