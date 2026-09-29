/**
 * `runOverlaySuite` (A§15.3): the dismissal contract of every layer component (A§9.9): one Escape
 * closes exactly one layer, nested layers close top-most first, an outside press dismisses, focus
 * returns, a moved layer keeps working, persistent UI (a toast) stays usable under a modal, and the
 * Popover-less Tier-2 path works.
 *
 * ```ts
 * runOverlaySuite({
 *   tag: 'tct-popover',
 *   render: ({attributes = '', children = ''}) =>
 *     `<tct-popover ${attributes}><button slot="trigger">Open</button>${children}content</tct-popover>`,
 *   trigger: (el) => el.querySelector('[slot=trigger]'),
 * });
 * ```
 *
 * The element must follow the element contract (A§7.6): a boolean `open` property (or the
 * `isOpen`/`open` options), `tct-open-change` (cancelable, with `reason`) for user-driven changes and
 * `tct-after-open-change` once a change settled.
 */
import {userEvent} from 'vitest/browser';
import {describe, expect, it, vi} from 'vitest';
import {registerTopLayerPersistent} from '@tecton-astryx/core/layer/top-layer-host.js';
import {deepActiveElement} from '@tecton-astryx/core/utils/focus.js';
import {fixture} from '../fixture.js';
import {recordEvents} from '../events.js';
import {pressKeys} from '../keyboard.js';
import {layerStack} from '../layers.js';
import {withFeature} from '../tier.js';
import {aTimeout, nextFrame, waitUntil} from '../timing.js';

interface OverlayElement extends HTMLElement {
  open: boolean;
  readonly updateComplete: Promise<boolean>;
}

export interface OverlaySuiteOptions {
  /** The registered tag name. */
  tag: string;
  /**
   * Markup of the overlay. `attributes` are appended to the tag (`open`, `id`, ...); `children` is
   * placed inside it (used to nest a second overlay of the same kind).
   */
  render: (options: {attributes?: string; children?: string}) => string;
  /** Modal layers (`showModal()`): no outside press, scroll locked, persistent UI moves inside. */
  modal?: boolean;
  /** Whether an outside press dismisses (default: `!modal`). */
  outsidePress?: boolean;
  /** Whether Escape closes (default true; false for required dialogs, then Escape must not close). */
  escapeCloses?: boolean;
  /** The element that must regain focus when the layer closes (usually the trigger). */
  trigger?: (element: OverlayElement) => HTMLElement | null;
  /** The layer's surface, for the "press inside" check (default: the first `[popover]`, `dialog` or `[role=dialog]`). */
  surface?: (element: OverlayElement) => HTMLElement | null;
  /** Reads the open state (default `element.open`). */
  isOpen?: (element: OverlayElement) => boolean;
  /** Opens the layer programmatically (default `element.open = true`). */
  open?: (element: OverlayElement) => void | Promise<void>;
  /** Closes the layer programmatically (default `element.open = false`). */
  close?: (element: OverlayElement) => void | Promise<void>;
}

export function runOverlaySuite(options: OverlaySuiteOptions): void {
  const {tag, render, modal = false} = options;
  const outsidePress = options.outsidePress ?? !modal;
  const escapeCloses = options.escapeCloses ?? true;
  const isOpen = options.isOpen ?? ((element: OverlayElement) => element.open === true);
  const open =
    options.open ??
    ((element: OverlayElement) => {
      element.open = true;
    });
  const close =
    options.close ??
    ((element: OverlayElement) => {
      element.open = false;
    });

  async function mount(attributes = '', children = ''): Promise<OverlayElement> {
    const root = await fixture<HTMLElement>(
      `<div style="padding:80px 40px">${render({attributes, children})}<p id="outside">outside</p></div>`,
    );
    const element = root.querySelector<OverlayElement>(tag)!;
    await element.updateComplete;
    return element;
  }

  describe(`${tag}: overlay contract`, () => {
    it('opens and closes programmatically without user-intent events, and settles with one after-open-change each', async () => {
      const element = await mount();
      const intent = recordEvents(element, 'tct-open-change');
      const after = recordEvents(element, 'tct-after-open-change');
      await open(element);
      await waitUntil(() => isOpen(element) && layerStack().length === 1, 'open and registered');
      await waitUntil(() => after.events.length === 1, 'after-open-change (open)');
      await close(element);
      await waitUntil(() => layerStack().length === 0, 'unregistered');
      await waitUntil(() => after.events.length === 2, 'after-open-change (close)');
      expect(intent.events, 'property writes never emit intent events').toHaveLength(0);
      expect(after.events.map((event) => event.open)).toEqual([true, false]);
    });

    it.skipIf(!escapeCloses)(
      'one Escape closes exactly the top-most layer, with reason "escape"',
      async () => {
        const outer = await mount('open', render({attributes: 'open'}));
        const inner = outer.querySelector<OverlayElement>(tag)!;
        await waitUntil(() => layerStack().length === 2, 'both registered');
        const changes = recordEvents(outer, 'tct-open-change');

        await pressKeys('Escape');
        await waitUntil(() => !isOpen(inner), 'inner closed');
        expect(isOpen(outer), 'the outer layer survives the first Escape').toBe(true);
        expect(changes.events).toHaveLength(1);
        expect(changes.events[0]!.reason).toBe('escape');

        await pressKeys('Escape');
        await waitUntil(() => !isOpen(outer), 'outer closed by the second Escape');
      },
    );

    it.skipIf(!escapeCloses)('preventing the intent event keeps the layer open', async () => {
      const element = await mount('open');
      await waitUntil(() => layerStack().length === 1, 'registered');
      element.addEventListener('tct-open-change', (event) => {
        event.preventDefault();
      });
      await pressKeys('Escape');
      await aTimeout(80);
      expect(isOpen(element)).toBe(true);
    });

    it.skipIf(escapeCloses)('Escape does not close a layer that blocks it', async () => {
      const element = await mount('open');
      await waitUntil(() => layerStack().length === 1, 'registered');
      await pressKeys('Escape');
      await aTimeout(80);
      expect(isOpen(element)).toBe(true);
    });

    it('a composing Escape (IME) does not close the layer', async () => {
      const element = await mount('open');
      await waitUntil(() => layerStack().length === 1, 'registered');
      for (const init of [{isComposing: true}, {keyCode: 229}]) {
        document.activeElement?.dispatchEvent(
          new KeyboardEvent('keydown', {
            key: 'Escape',
            bubbles: true,
            composed: true,
            cancelable: true,
            ...init,
          }),
        );
        document.dispatchEvent(
          new KeyboardEvent('keydown', {
            key: 'Escape',
            bubbles: true,
            composed: true,
            cancelable: true,
            ...init,
          }),
        );
      }
      await aTimeout(50);
      expect(isOpen(element)).toBe(true);
    });

    it.skipIf(!outsidePress)(
      'a press outside dismisses with reason "outside"; a press inside does not',
      async () => {
        const element = await mount('open');
        await waitUntil(() => layerStack().length === 1, 'registered');
        const changes = recordEvents(element, 'tct-open-change');
        const surface =
          options.surface?.(element) ??
          element.shadowRoot?.querySelector<HTMLElement>('[popover], dialog, [role="dialog"]') ??
          element.querySelector<HTMLElement>('[popover], dialog, [role="dialog"]') ??
          element;
        await userEvent.click(surface);
        await aTimeout(60);
        expect(isOpen(element), 'a press on the layer surface is inside').toBe(true);
        await userEvent.click(document.querySelector('#outside')!);
        await waitUntil(() => !isOpen(element), 'dismissed');
        expect(changes.events.at(-1)!.reason).toBe('outside');
      },
    );

    it.skipIf(!options.trigger || !escapeCloses)(
      'focus returns to the trigger after Escape',
      async () => {
        const element = await mount('open');
        await waitUntil(() => layerStack().length === 1, 'registered');
        const trigger = options.trigger!(element);
        expect(trigger, 'the trigger option must resolve an element').not.toBeNull();
        trigger!.focus();
        await open(element);
        await pressKeys('Escape');
        await waitUntil(() => !isOpen(element), 'closed');
        await waitUntil(() => deepActiveElement() === trigger, 'focus returned to the trigger');
      },
    );

    it('a layer moved while open stays open, registered and dismissable', async () => {
      const wrapper = await fixture<HTMLElement>(
        `<div><section id="a">${render({attributes: 'open'})}</section><section id="b"></section></div>`,
      );
      const element = wrapper.querySelector<OverlayElement>(tag)!;
      await waitUntil(() => isOpen(element) && layerStack().length === 1, 'open');
      wrapper.querySelector('#b')!.append(element);
      await nextFrame();
      await waitUntil(
        () => isOpen(element) && layerStack().length === 1,
        'still open and registered after the move',
      );
      if (escapeCloses) {
        await pressKeys('Escape');
        await waitUntil(() => !isOpen(element), 'dismissable after the move');
      }
    });

    it('works without the Popover API (Tier 2) and without CloseWatcher', async () => {
      await withFeature('popover', false, async () => {
        await withFeature('closeWatcher', false, async () => {
          const element = await mount();
          await expect(Promise.resolve(open(element))).resolves.toBeUndefined();
          await waitUntil(() => isOpen(element), 'opened');
          await close(element);
          await waitUntil(() => layerStack().length === 0, 'closed');
        });
      });
    });

    it.skipIf(!modal)(
      'a toast action stays clickable while the modal is open, and does not dismiss it',
      async () => {
        const toast = document.createElement('div');
        toast.setAttribute('popover', 'manual');
        const action = document.createElement('button');
        action.textContent = 'Undo';
        toast.append(action);
        document.body.append(toast);
        toast.showPopover();
        const stop = registerTopLayerPersistent(toast);
        const clicked = vi.fn();
        action.addEventListener('click', clicked);
        try {
          const element = await mount('open');
          await waitUntil(() => isOpen(element), 'open');
          await waitUntil(() => toast.closest('dialog') !== null, 'toast moved into the modal');
          await userEvent.click(action);
          expect(clicked).toHaveBeenCalledTimes(1);
          expect(isOpen(element), 'the click was not an outside press').toBe(true);
        } finally {
          stop();
          toast.remove();
        }
      },
    );
  });
}
