/**
 * Port of upstream `Layer/layerDismissalFamilies.test.tsx` (A§9.9, A§15.3): every overlay family
 * shares the one dismissal stack. The stack routes an Escape to the top-most REGISTERED layer and
 * prevents its default, so a family that is not on the stack cannot be reached once anything else is.
 *
 * Upstream's families (Lightbox, MobileNav, Dialog, HoverCard, Tooltip) map to the layer kinds here:
 *   Lightbox / required Dialog  -> `kind="modal"` (`escape="block"` for the required one)
 *   MobileNav drawer            -> `kind="dialog"` (non-modal `<dialog>`, opened with `show()`)
 *   HoverCard / Tooltip         -> `TooltipController` (kind `hint`), controlled and uncontrolled
 * built from the small test-only hosts `tct-test-layer` and `tct-test-tooltip`.
 */
import {beforeAll, describe, expect, it} from 'vitest';
import {defineElement} from '@tecton-astryx/core/define.js';
import {fixture} from '../fixture.js';
import {pressKeys} from '../keyboard.js';
import {recordEvents} from '../events.js';
import {TctTestLayer} from '../fixtures/test-layer.js';
import {TctTestTooltip} from '../fixtures/test-tooltip.js';
import {aTimeout, waitUntil} from '../timing.js';

beforeAll(() => {
  defineElement(TctTestLayer);
  defineElement(TctTestTooltip);
});

const isShown = (surface: HTMLElement | null): boolean =>
  !!surface &&
  (surface instanceof HTMLDialogElement ? surface.open : surface.matches(':popover-open'));

async function escape(): Promise<KeyboardEvent> {
  let seen: KeyboardEvent | undefined;
  const listener = (event: KeyboardEvent): void => {
    seen = event;
  };
  document.addEventListener('keydown', listener);
  await pressKeys('Escape');
  document.removeEventListener('keydown', listener);
  return seen!;
}

describe('overlay families on the shared dismissal stack', () => {
  describe('a modal over a required dialog (Lightbox)', () => {
    it('takes the Escape when it is open over a required dialog', async () => {
      const required = await fixture<TctTestLayer>(
        `<tct-test-layer kind="modal" escape="block" open><tct-test-layer kind="modal" open>photo</tct-test-layer></tct-test-layer>`,
      );
      const photo = required.querySelector<TctTestLayer>('tct-test-layer')!;
      const requiredChanges = recordEvents(required, 'tct-open-change');
      const photoChanges = recordEvents(photo, 'tct-open-change');
      await waitUntil(() => isShown(photo.surface) && isShown(required.surface), 'both open');

      const event = await escape();

      expect(photoChanges.named('tct-open-change')).toHaveLength(1);
      // The required dialog's host also sees the (bubbling) event of its nested layer: one event.
      expect(requiredChanges.named('tct-open-change')).toHaveLength(1);
      expect(event.defaultPrevented).toBe(true);
      await waitUntil(() => !isShown(photo.surface), 'photo closed');
      expect(isShown(required.surface)).toBe(true);
    });

    it('closes on a browser-initiated cancel when it is top-most', async () => {
      const layer = await fixture<TctTestLayer>(
        `<tct-test-layer kind="modal" open>x</tct-test-layer>`,
      );
      await waitUntil(() => isShown(layer.surface), 'open');

      const request = new Event('cancel', {cancelable: true});
      layer.surface!.dispatchEvent(request);

      expect(request.defaultPrevented).toBe(true);
      await waitUntil(() => !isShown(layer.surface), 'closed');
    });

    it('stays open on a browser-initiated cancel when it is not top-most', async () => {
      const container = await fixture<HTMLDivElement>(
        `<div><tct-test-layer kind="modal" data-label="below" open>x</tct-test-layer>` +
          `<tct-test-layer kind="modal" data-label="above" open>x</tct-test-layer></div>`,
      );
      const below = container.querySelector<TctTestLayer>('[data-label="below"]')!;
      await waitUntil(
        () =>
          container.querySelectorAll<TctTestLayer>('tct-test-layer').length === 2 &&
          isShown(below.surface),
        'open',
      );
      const changes = recordEvents(below, 'tct-open-change');

      const request = new Event('cancel', {cancelable: true});
      below.surface!.dispatchEvent(request);

      expect(request.defaultPrevented).toBe(true);
      expect(changes.named('tct-open-change')).toHaveLength(0);
      expect(isShown(below.surface)).toBe(true);
    });
  });

  describe('a non-modal drawer (MobileNav)', () => {
    it('takes the Escape when it opens over a required dialog', async () => {
      const container = await fixture<HTMLDivElement>(
        `<div><tct-test-layer kind="modal" escape="block" data-label="required" open>choose</tct-test-layer>` +
          `<tct-test-layer kind="dialog" data-label="drawer" open>nav</tct-test-layer></div>`,
      );
      const required = container.querySelector<TctTestLayer>('[data-label="required"]')!;
      const drawer = container.querySelector<TctTestLayer>('[data-label="drawer"]')!;
      await waitUntil(() => isShown(required.surface) && isShown(drawer.surface), 'both open');
      const requiredChanges = recordEvents(required, 'tct-open-change');

      const event = await escape();

      await waitUntil(() => !isShown(drawer.surface), 'drawer closed');
      expect(requiredChanges.named('tct-open-change')).toHaveLength(0);
      expect(event.defaultPrevented).toBe(true);
    });

    it('closes on a browser-initiated cancel when it is top-most', async () => {
      const drawer = await fixture<TctTestLayer>(
        `<tct-test-layer kind="dialog" open>nav</tct-test-layer>`,
      );
      await waitUntil(() => isShown(drawer.surface), 'open');
      const request = new Event('cancel', {cancelable: true});
      drawer.surface!.dispatchEvent(request);
      expect(request.defaultPrevented).toBe(true);
      await waitUntil(() => !isShown(drawer.surface), 'closed');
    });
  });

  describe('required dialog', () => {
    it('still swallows an Escape when it is alone', async () => {
      const required = await fixture<TctTestLayer>(
        `<tct-test-layer kind="modal" escape="block" open>choose one</tct-test-layer>`,
      );
      await waitUntil(() => isShown(required.surface), 'open');
      const changes = recordEvents(required, 'tct-open-change');

      const event = await escape();
      await aTimeout(50);

      expect(changes.named('tct-open-change')).toHaveLength(0);
      expect(event.defaultPrevented).toBe(true);
      expect(isShown(required.surface)).toBe(true);
    });

    it('still swallows an Escape with another modal open UNDER it', async () => {
      const container = await fixture<HTMLDivElement>(
        `<div><tct-test-layer kind="modal" data-label="under" open>x</tct-test-layer>` +
          `<tct-test-layer kind="modal" escape="block" data-label="required" open>choose</tct-test-layer></div>`,
      );
      const under = container.querySelector<TctTestLayer>('[data-label="under"]')!;
      const required = container.querySelector<TctTestLayer>('[data-label="required"]')!;
      await waitUntil(() => isShown(under.surface) && isShown(required.surface), 'both open');
      const underChanges = recordEvents(under, 'tct-open-change');
      const requiredChanges = recordEvents(required, 'tct-open-change');

      await escape();
      await aTimeout(50);

      expect(requiredChanges.named('tct-open-change')).toHaveLength(0);
      expect(underChanges.named('tct-open-change')).toHaveLength(0);
    });
  });

  // Controlled follows control state for `open`: Escape still attempts the close, but only the
  // owner's update may perform it. A dialog has always worked this way; hover layers now do too.
  describe('controlled hover layers', () => {
    const pinned =
      `<tct-test-layer kind="modal" data-label="host" open>` +
      `<tct-test-tooltip content="Pinned tip" controlled-open="true" delay="0"><button>Trigger</button></tct-test-tooltip>` +
      `</tct-test-layer>`;

    it('a controlled tooltip takes the press and reports instead of hiding', async () => {
      const host = await fixture<TctTestLayer>(pinned);
      const tip = host.querySelector<TctTestTooltip>('tct-test-tooltip')!;
      await waitUntil(() => tip.tooltip.isOpen && isShown(host.surface), 'both open');
      const hostChanges = recordEvents(host, 'tct-open-change');
      const tipChanges = recordEvents(tip, 'tct-open-change');

      const event = await escape();
      await aTimeout(50);

      expect(tipChanges.named('tct-open-change')).toHaveLength(1);
      expect((tipChanges.events[0] as {open: boolean}).open).toBe(false);
      expect(hostChanges.named('tct-open-change')).toHaveLength(1); // the same bubbling event, from the tip
      expect(tip.tooltip.isOpen).toBe(true); // reported, not hidden
      expect(isShown(host.surface)).toBe(true); // the dialog underneath is untouched
      expect(event.defaultPrevented).toBe(true);
    });

    it('leaves the dialog unclosable when the owner discards the request', async () => {
      // A layer that holds itself open and ignores its own change event keeps taking the press, and
      // nothing behind it can be reached: consumer choice, not ours.
      const host = await fixture<TctTestLayer>(pinned);
      const tip = host.querySelector<TctTestTooltip>('tct-test-tooltip')!;
      await waitUntil(() => tip.tooltip.isOpen && isShown(host.surface), 'both open');
      const tipChanges = recordEvents(tip, 'tct-open-change');

      await escape();
      await escape();
      await aTimeout(50);

      expect(tipChanges.named('tct-open-change')).toHaveLength(2);
      expect(isShown(host.surface)).toBe(true);
    });

    it('an uncontrolled tooltip hides on Escape and leaves the dialog open (one press, one layer)', async () => {
      const host = await fixture<TctTestLayer>(
        `<tct-test-layer kind="modal" open><tct-test-tooltip content="Tip" delay="0"><button>Trigger</button></tct-test-tooltip></tct-test-layer>`,
      );
      const tip = host.querySelector<TctTestTooltip>('tct-test-tooltip')!;
      await waitUntil(() => isShown(host.surface), 'dialog open');
      await tip.tooltip.show();
      expect(tip.tooltip.isOpen).toBe(true);

      await escape();
      await waitUntil(() => !tip.tooltip.isOpen, 'tip hidden');
      expect(isShown(host.surface)).toBe(true);

      await escape();
      await waitUntil(() => !isShown(host.surface), 'dialog closed');
    });
  });
});
