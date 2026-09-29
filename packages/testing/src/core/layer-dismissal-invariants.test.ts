/**
 * Port of upstream `Layer/layerDismissalInvariants.test.tsx` (A§9.9, A§15.3): the one invariant the
 * shared stack exists to hold, asked of real layers. Every assertion reads what is on screen (which
 * surfaces are natively shown) rather than a dismiss spy: a spy passes when the stack routes to the
 * wrong layer as long as something was called; the census cannot.
 *
 * Differences from upstream, all forced by real browsers:
 *  - keys go through the real keyboard (`pressKeys`), so the platform's own close-request handling
 *    (dialog `cancel`, CloseWatcher) is live and must be suppressed by the stack;
 *  - `cancel` is still fired synthetically for the "browser starts a close request itself" rows,
 *    because Chromium only raises it without a keydown for the Android back gesture.
 */
import {beforeAll, describe, expect, it} from 'vitest';
import {defineElement} from '@tecton-astryx/core/define.js';
import {fixture} from '../fixture.js';
import {pressKeys} from '../keyboard.js';
import {layerStack} from '../layers.js';
import {settle} from '../fixture.js';
import {TctTestLayer} from '../fixtures/test-layer.js';
import {aTimeout, nextFrame, waitUntil} from '../timing.js';

beforeAll(() => {
  defineElement(TctTestLayer);
});

/** Labels of every layer natively on screen, sorted so the census is about WHICH layers are up. */
function onScreen(): string[] {
  return [...document.querySelectorAll<TctTestLayer>('tct-test-layer')]
    .filter((host) => {
      const surface = host.surface;
      if (!surface) return false;
      return surface instanceof HTMLDialogElement ? surface.open : surface.matches(':popover-open');
    })
    .map((host) => host.dataset.label ?? '(unnamed)')
    .sort();
}

const settled = async (...expected: string[]): Promise<void> => {
  await waitUntil(() => onScreen().join() === expected.join(), `on screen: ${expected.join(', ')}`);
};

/** Presses Escape on the document and returns the event as the page saw it after the stack ran. */
async function escape(options: KeyboardEventInit = {}): Promise<KeyboardEvent> {
  let seen: KeyboardEvent | undefined;
  // Registered after the stack's own listener, so it observes `defaultPrevented` after the stack.
  const listener = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') seen = event;
  };
  document.addEventListener('keydown', listener);
  try {
    if (Object.keys(options).length === 0) {
      await pressKeys('Escape');
    } else {
      seen = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
        ...options,
      });
      document.dispatchEvent(seen);
    }
  } finally {
    document.removeEventListener('keydown', listener);
  }
  return seen!;
}

const modal = (label: string, extra = '') =>
  `<tct-test-layer kind="modal" data-label="${label}" open ${extra}>`;

describe('one Escape dismisses exactly one layer', () => {
  it('peels a modal-in-modal one press at a time', async () => {
    await fixture(
      `<div>${modal('Outer')}<button>x</button>${modal('Inner')}</tct-test-layer></tct-test-layer></div>`,
    );
    await waitUntil(() => onScreen().length === 2, 'both open');
    expect(onScreen()).toEqual(['Inner', 'Outer']);

    await escape();
    await settled('Outer');

    await escape();
    await settled();
  });

  it('peels three layers in order, never two on one press', async () => {
    await fixture(
      `<div>${modal('Outer')}${modal('Middle')}${modal('Inner')}</tct-test-layer></tct-test-layer></tct-test-layer></div>`,
    );
    await waitUntil(() => onScreen().length === 3, 'all open');

    await escape();
    await settled('Middle', 'Outer');
    await escape();
    await settled('Outer');
    await escape();
    await settled();
  });

  it('lets a modal opened over a required dialog take the press, and only it', async () => {
    await fixture(
      `<div>${modal('Required', 'escape="block"')}${modal('Photo')}</tct-test-layer></tct-test-layer></div>`,
    );
    await waitUntil(() => onScreen().length === 2, 'both open');

    await escape();
    await settled('Required');
  });

  it('reaches the layer below once the one above is closed another way', async () => {
    const outer = await fixture<TctTestLayer>(
      `${modal('Outer')}${modal('Inner')}</tct-test-layer></tct-test-layer>`,
    );
    await waitUntil(() => onScreen().length === 2, 'both open');
    const inner = outer.querySelector<TctTestLayer>('tct-test-layer')!;

    // Closing the inner layer with its own control must leave the stack clean, so the next Escape
    // finds the outer one rather than falling into a gap.
    inner.open = false;
    await settled('Outer');
    expect(layerStack()).toHaveLength(1);

    await escape();
    await settled();
  });
});

describe("escape behaviour 'block'", () => {
  it('swallows the press so nothing behind a required dialog dismisses either', async () => {
    await fixture(
      `<div>${modal('Host')}${modal('Required', 'escape="block"')}</tct-test-layer></tct-test-layer></div>`,
    );
    await waitUntil(() => onScreen().length === 2, 'both open');

    const event = await escape();
    await aTimeout(50);

    expect(onScreen()).toEqual(['Host', 'Required']);
    // Claimed, not merely ignored: an unclaimed press lets the browser's own close request dismiss
    // something behind our back.
    expect(event.defaultPrevented).toBe(true);
  });

  it('does not block a layer opened on top of the required dialog', async () => {
    await fixture(
      `<div>${modal('Required', 'escape="block"')}${modal('Above')}</tct-test-layer></tct-test-layer></div>`,
    );
    await waitUntil(() => onScreen().length === 2, 'both open');

    await escape();
    await settled('Required');
  });

  it('a layer with escape "none" is invisible to Escape: the press reaches the layer below', async () => {
    await fixture(
      `<div>${modal('Below')}<tct-test-layer kind="popover" data-label="Ghost" escape="none" open>x</tct-test-layer></tct-test-layer></div>`,
    );
    await waitUntil(() => onScreen().length === 2, 'both open');

    await escape();
    await settled('Ghost');
  });
});

describe('re-registration does not reorder the stack', () => {
  it('keeps a layer whose behaviour flips below the layer opened over it', async () => {
    // A layer's escape behaviour can change while open (a dialog whose purpose flips). Flipping it
    // must not promote it above a layer that opened later.
    const container = await fixture<HTMLDivElement>(
      `<div><tct-test-layer kind="popover" data-label="Host" open>x</tct-test-layer>` +
        `<tct-test-layer kind="popover" data-label="Later" open>x</tct-test-layer></div>`,
    );
    await waitUntil(() => onScreen().length === 2, 'both open');
    const host = container.querySelector<TctTestLayer>('[data-label="Host"]')!;

    host.escape = 'block';
    await host.updateComplete;

    await escape();
    await settled('Host');
  });
});

describe('close requests the browser starts itself', () => {
  const fireCancel = (host: TctTestLayer): Event => {
    const event = new Event('cancel', {bubbles: false, cancelable: true});
    host.surface!.dispatchEvent(event);
    return event;
  };

  it('follow the same top-most rule as a press', async () => {
    const outer = await fixture<TctTestLayer>(
      `${modal('Outer')}${modal('Inner')}</tct-test-layer></tct-test-layer>`,
    );
    await waitUntil(() => onScreen().length === 2, 'both open');
    const inner = outer.querySelector<TctTestLayer>('tct-test-layer')!;

    // The Android back gesture on the layer that is NOT on top.
    const outerRequest = fireCancel(outer);
    expect(outerRequest.defaultPrevented).toBe(true);
    await aTimeout(50);
    expect(onScreen()).toEqual(['Inner', 'Outer']);

    fireCancel(inner);
    await settled('Outer');
  });

  it('are declined while an IME composition is running', async () => {
    const host = await fixture<TctTestLayer>(
      `<tct-test-layer kind="modal" data-label="Composing" open><input aria-label="field"></tct-test-layer>`,
    );
    await waitUntil(() => onScreen().length === 1, 'open');
    const field = host.querySelector('input')!;

    field.dispatchEvent(new CompositionEvent('compositionstart', {bubbles: true, composed: true}));
    fireCancel(host);
    await aTimeout(50);
    expect(onScreen()).toEqual(['Composing']);

    field.dispatchEvent(new CompositionEvent('compositionend', {bubbles: true, composed: true}));
    fireCancel(host);
    await settled();
  });
});

describe('an Escape that cancels an IME composition', () => {
  it('dismisses nothing AND claims the press, so no close request follows', async () => {
    await fixture(`${modal('Composing')}</tct-test-layer>`);
    await waitUntil(() => onScreen().length === 1, 'open');

    const event = await escape({isComposing: true});
    await aTimeout(50);

    expect(onScreen()).toEqual(['Composing']);
    // The half that matters: standing down without claiming leaves the browser free to raise its own
    // close request, which reaches `cancel` with no composition state and closes the dialog.
    expect(event.defaultPrevented).toBe(true);
  });

  it('a keyCode 229 keydown (Safari confirming Enter/Escape) counts as composing', async () => {
    await fixture(`${modal('Composing')}</tct-test-layer>`);
    await waitUntil(() => onScreen().length === 1, 'open');

    const event = await escape({keyCode: 229});
    expect(onScreen()).toEqual(['Composing']);
    expect(event.defaultPrevented).toBe(true);
  });

  it('leaves the press alone when there is no layer to protect', async () => {
    await fixture(`<tct-test-layer kind="modal" data-label="Closed"></tct-test-layer>`);
    const event = await escape({isComposing: true});
    expect(event.defaultPrevented).toBe(false);
  });
});

describe('registration and teardown', () => {
  it('drops a layer from the stack when it is removed from the document', async () => {
    const outer = await fixture<TctTestLayer>(
      `${modal('Bottom')}${modal('Top')}</tct-test-layer></tct-test-layer>`,
    );
    await waitUntil(() => onScreen().length === 2, 'both open');
    outer.querySelector('tct-test-layer')!.remove();
    await nextFrame();
    expect(layerStack()).toHaveLength(1);

    await escape();
    await settled();
  });

  it('stops claiming Escape once the last layer is gone', async () => {
    const host = await fixture<TctTestLayer>(`${modal('Only')}</tct-test-layer>`);
    await waitUntil(() => onScreen().length === 1, 'open');
    expect((await escape()).defaultPrevented).toBe(true);
    await settled();

    // The listener is shared and lives on `document`: leaving an entry behind would keep losing
    // Escape presses to a layer that is not there, with no error and no visual tell.
    host.remove();
    expect((await escape()).defaultPrevented).toBe(false);
  });
});

describe('presence is asked at press time', () => {
  it('skips a registered layer that is no longer on screen', async () => {
    const container = await fixture<HTMLDivElement>(
      `<div>${modal('Host')}<tct-test-layer kind="popover" data-label="Tip" open>x</tct-test-layer></tct-test-layer></div>`,
    );
    await waitUntil(() => onScreen().length === 2, 'both open');
    const tip = container.querySelector<TctTestLayer>('[data-label="Tip"]')!;

    // The tip was hidden behind the stack's back (no toggle event has been processed yet): a cached
    // answer would let an idle tip eat a press meant for the dialog underneath it.
    tip.surface!.hidePopover();
    const event = await escape();
    expect(event.defaultPrevented).toBe(true);
    await settled();
  });
});

describe('the stack only holds settled facts', () => {
  it('reports layers bottom to top with the top-most flagged', async () => {
    await fixture(`<div>${modal('A')}${modal('B')}</tct-test-layer></tct-test-layer></div>`);
    await waitUntil(() => layerStack().length === 2, 'both registered');
    const stack = layerStack();
    expect(stack.map((layer) => (layer.host as HTMLElement).dataset.label)).toEqual(['A', 'B']);
    expect(stack.map((layer) => layer.isTopmost)).toEqual([false, true]);
    await settle(document.body);
  });
});
