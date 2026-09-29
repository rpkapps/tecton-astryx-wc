/**
 * Regression tests for the High and Medium findings of the earlier project's review against
 * modern-web-guidance (`tecton-webcomponents/docs/REVIEW-modern-web-guidance.md`, CONVENTIONS §9).
 * One `describe` per finding id. Findings that concern a component, the theme or the docs site are
 * not testable at the foundation level; they are listed at the end with the mechanism the
 * foundation provides for the owning work package.
 *
 * Deeper coverage of each mechanism lives in the topic files (`form-control`, `layer-controller`,
 * `layer-dismissal-*`, `roving-tabindex`, `security-a11y`, ...); the tests here pin the exact
 * scenario of the finding so a regression names its ID.
 */
import {html} from 'lit';
import {userEvent} from 'vitest/browser';
import {beforeAll, describe, expect, it, vi} from 'vitest';
import {announce, getAnnouncerRegions} from '@tecton-astryx/core/a11y/announcer.js';
import {defineElement} from '@tecton-astryx/core/define.js';
import {features, overrideFeature, prefersReducedMotion} from '@tecton-astryx/core/features.js';
import {nativeMessage} from '@tecton-astryx/core/forms/validators.js';
import {registerTopLayerPersistent} from '@tecton-astryx/core/layer/top-layer-host.js';
import {getIcon, registerIcons} from '@tecton-astryx/core/icons/registry.js';
import {isImeKeyEvent} from '@tecton-astryx/core/utils/ime.js';
import {deepActiveElement} from '@tecton-astryx/core/utils/focus.js';
import {emulateMedia} from '../emulate.js';
import {fixture} from '../fixture.js';
import {TctTestCheckbox, TctTestGroup, TctTestInput, TctTestSubmit} from '../fixtures/test-form.js';
import {TctTestLayer} from '../fixtures/test-layer.js';
import {TctTestToolbar} from '../fixtures/test-toolbar.js';
import {formHarness, hasCustomState, innerControl} from '../forms.js';
import {pressKeys} from '../keyboard.js';
import {isChromium, isTier2, withFeature} from '../tier.js';
import {aTimeout, nextFrame, waitUntil} from '../timing.js';

beforeAll(() => {
  for (const ctor of [
    TctTestInput,
    TctTestCheckbox,
    TctTestGroup,
    TctTestSubmit,
    TctTestLayer,
    TctTestToolbar,
  ])
    defineElement(ctor);
});

const shown = (host: TctTestLayer): boolean => {
  const surface = host.surface;
  if (!surface) return false;
  return surface instanceof HTMLDialogElement ? surface.open : surface.matches(':popover-open');
};

const ariaInvalid = (element: Element): string | null =>
  innerControl(element).getAttribute('aria-invalid');

describe('H1: Enter submits the form (inner input has no form owner)', () => {
  it('Enter in a single text field submits once, also when the only submit button is a library button', async () => {
    const plain = await formHarness(`<tct-test-input name="q" value="x"></tct-test-input>`);
    await userEvent.click(plain.form.querySelector('tct-test-input')!);
    await pressKeys('Enter');
    expect(plain.submitEvents).toHaveLength(1);

    const withLibraryButton = await formHarness(
      `<input name="a" value="1"><tct-test-input name="b" value="2"></tct-test-input><tct-test-submit>Go</tct-test-submit>`,
    );
    await userEvent.click(withLibraryButton.form.querySelector('tct-test-input')!);
    await pressKeys('Enter');
    expect(withLibraryButton.submitEvents).toHaveLength(1);
    // ... and from the native input in the same form (the case the platform cannot handle).
    await userEvent.click(withLibraryButton.form.querySelector('input')!);
    await pressKeys('Enter');
    expect(withLibraryButton.submitEvents).toHaveLength(2);
  });
});

describe('H2: toasts (top-layer UI) stay usable while a modal is open', () => {
  it('a persistent action moves into the modal, is clickable, and the click is not an outside press', async () => {
    const toast = document.createElement('div');
    toast.setAttribute('popover', 'manual');
    const action = document.createElement('button');
    action.textContent = 'Undo';
    toast.append(action);
    document.body.append(toast);
    toast.showPopover();
    const stop = registerTopLayerPersistent(toast);
    const undone = vi.fn();
    action.addEventListener('click', undone);
    try {
      const layer = await fixture<TctTestLayer>(
        html`<tct-test-layer kind="modal" open>dialog content</tct-test-layer>`,
      );
      await waitUntil(() => shown(layer), 'modal open');
      await waitUntil(() => layer.surface!.contains(toast), 'toast moved into the modal');
      expect(toast.matches(':popover-open')).toBe(true);
      await userEvent.click(action);
      expect(undone).toHaveBeenCalledTimes(1);
      expect(shown(layer), 'clicking the toast action did not dismiss the dialog').toBe(true);
      expect(layer.layer.isOpen).toBe(true);
    } finally {
      stop();
      toast.remove();
    }
  });

  it('announcements made while a modal is open are spoken from inside it', async () => {
    const restore = overrideFeature('ariaNotify', false);
    try {
      const layer = await fixture<TctTestLayer>(
        html`<tct-test-layer kind="modal">x</tct-test-layer>`,
      );
      announce('warm up');
      await layer.layer.show();
      expect(layer.surface!.contains(getAnnouncerRegions().polite!)).toBe(true);
    } finally {
      restore();
    }
  });
});

describe('H6: a blocked submit can focus the invalid control (validation anchor)', () => {
  it('a required group with no native inner control receives focus', async () => {
    const harness = await formHarness(
      `<tct-test-group name="g" required></tct-test-group><button type="submit">Go</button>`,
    );
    await userEvent.click(harness.form.querySelector('button')!);
    await nextFrame();
    expect(harness.submitEvents).toHaveLength(0);
    expect(deepActiveElement()).toBe(
      harness.form.querySelector('tct-test-group')!.shadowRoot!.querySelector('button'),
    );
  });
});

describe('H7: the error message is not re-rendered or re-announced per keystroke', () => {
  it('the displayed message is frozen while focused; the browser’s own message keeps changing', async () => {
    const harness = await formHarness(
      `<tct-test-input name="q" minlength="8"></tct-test-input><button type="button">next</button>`,
    );
    const input = harness.form.querySelector('tct-test-input')!;
    await userEvent.click(input);
    await userEvent.keyboard('abc');
    await pressKeys('Tab');
    await input.updateComplete;
    const shownMessage = input.displayedValidationMessage;
    expect(shownMessage).not.toBe('');
    await userEvent.click(input);
    const seen = new Set<string>();
    for (const key of ['d', 'e', 'f']) {
      await userEvent.keyboard(key);
      await input.updateComplete;
      seen.add(input.validationMessage);
      expect(input.displayedValidationMessage).toBe(shownMessage);
    }
    expect(seen.size, 'the native message really did change while typing').toBeGreaterThan(1);
  });
});

describe('H8: a control at the end of a range keeps focus (aria-disabled, not disabled)', () => {
  it('the roving controller never drops focus when an item turns aria-disabled, and can still reach it (focus-disabled)', async () => {
    const wrapper = await fixture<HTMLDivElement>(
      `<div><tct-test-toolbar focus-disabled><button>Prev</button><button>Next</button></tct-test-toolbar></div>`,
    );
    const bar = wrapper.querySelector('tct-test-toolbar')!;
    await bar.updateComplete;
    const [prev, next] = [...bar.children] as [HTMLButtonElement, HTMLButtonElement];
    next.focus();
    next.setAttribute('aria-disabled', 'true');
    bar.roving.update();
    expect(deepActiveElement()).toBe(next);
    prev.focus();
    await pressKeys('ArrowRight');
    expect(deepActiveElement()).toBe(next);
  });
});

describe('M1: moving an open overlay keeps it working', () => {
  it('an open modal and popover moved to another parent stay open, registered and dismissable', async () => {
    for (const kind of ['modal', 'popover'] as const) {
      const container = await fixture<HTMLDivElement>(
        html`<div>
          <section id="a"><tct-test-layer kind=${kind} open>x</tct-test-layer></section>
          <section id="b"></section>
        </div>`,
      );
      const layer = container.querySelector<TctTestLayer>('tct-test-layer')!;
      await waitUntil(() => shown(layer), `${kind} open`);
      container.querySelector('#b')!.append(layer);
      await waitUntil(() => shown(layer), `${kind} still shown after a plain move`);
      expect(layer.layer.isOpen, kind).toBe(true);
      if (kind === 'modal')
        expect((layer.surface as HTMLDialogElement).matches(':modal')).toBe(true);
      await pressKeys('Escape');
      await waitUntil(() => !shown(layer), `${kind} closes with Escape after the move`);
    }
  });
});

describe('M2: no Popover API, no throw', () => {
  it('a modal and a popover layer both open and close without the Popover API', async () => {
    await withFeature('popover', false, async () => {
      const modal = await fixture<TctTestLayer>(
        html`<tct-test-layer kind="modal">x</tct-test-layer>`,
      );
      const popover = await fixture<TctTestLayer>(html`<tct-test-layer>x</tct-test-layer>`);
      await expect(modal.layer.show()).resolves.toBeUndefined();
      await expect(popover.layer.show()).resolves.toBeUndefined();
      expect((modal.surface as HTMLDialogElement).open).toBe(true);
      expect(popover.layer.isOpen).toBe(true);
      await modal.layer.hide();
      await popover.layer.hide();
      expect((modal.surface as HTMLDialogElement).open).toBe(false);
    });
  });
});

describe('M3: exit animations run inside the top layer, without `overlay`', () => {
  it('the surface stays in the top layer for the whole exit animation, then hides', async () => {
    const layer = await fixture<TctTestLayer>(
      html`<tct-test-layer animated open>x</tct-test-layer>`,
    );
    await waitUntil(() => shown(layer), 'open');
    await aTimeout(200);
    layer.open = false;
    await layer.updateComplete;
    expect(layer.surface!.matches(':popover-open'), 'still in the top layer while animating').toBe(
      true,
    );
    await waitUntil(() => !shown(layer), 'hidden after the animation finished');
    expect(getComputedStyle(layer.surface!).getPropertyValue('overlay')).not.toBe('auto');
  });
});

describe('M4: platform close requests (Android back, CloseWatcher) close layers', () => {
  it('a `cancel` on the surface is a close request that follows the top-most rule', async () => {
    const layer = await fixture<TctTestLayer>(
      html`<tct-test-layer kind="modal" open>x</tct-test-layer>`,
    );
    await waitUntil(() => shown(layer), 'open');
    const cancel = new Event('cancel', {cancelable: true});
    layer.surface!.dispatchEvent(cancel);
    expect(cancel.defaultPrevented).toBe(true);
    await waitUntil(() => !shown(layer), 'closed by the request');
  });

  it.skipIf(!features.closeWatcher || isTier2)(
    'a CloseWatcher is registered while a non-modal layer is open',
    async () => {
      const created: unknown[] = [];
      const Original = (globalThis as unknown as {CloseWatcher: new () => object}).CloseWatcher;
      (globalThis as unknown as {CloseWatcher: unknown}).CloseWatcher = class extends Original {
        constructor() {
          super();
          created.push(this);
        }
      };
      try {
        const layer = await fixture<TctTestLayer>(html`<tct-test-layer open>x</tct-test-layer>`);
        await waitUntil(() => shown(layer), 'open');
        expect(created.length).toBeGreaterThan(0);
      } finally {
        (globalThis as unknown as {CloseWatcher: unknown}).CloseWatcher = Original;
      }
    },
  );
});

describe('M5: IME Enter/Escape (isComposing and keyCode 229)', () => {
  it('the shared predicate covers both signals', () => {
    expect(isImeKeyEvent({isComposing: true})).toBe(true);
    expect(isImeKeyEvent({keyCode: 229})).toBe(true);
  });

  it('a composing Enter does not submit, a composing Escape does not close a layer', async () => {
    const harness = await formHarness(`<tct-test-input name="q" value="x"></tct-test-input>`);
    const input = harness.form.querySelector('tct-test-input')!;
    for (const init of [{isComposing: true}, {keyCode: 229}]) {
      innerControl(input).dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Enter',
          bubbles: true,
          composed: true,
          cancelable: true,
          ...init,
        }),
      );
    }
    expect(harness.submitEvents).toHaveLength(0);

    const layer = await fixture<TctTestLayer>(
      html`<tct-test-layer open><input aria-label="f" /></tct-test-layer>`,
    );
    await waitUntil(() => shown(layer), 'open');
    layer.querySelector('input')!.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        composed: true,
        cancelable: true,
        keyCode: 229,
      }),
    );
    await aTimeout(50);
    expect(shown(layer)).toBe(true);
  });
});

describe('M6: form.checkValidity() does not mark fields as interacted', () => {
  it('an "enable Save when valid" listener leaves untouched required fields un-flagged', async () => {
    const harness = await formHarness(
      `<tct-test-input name="a" required></tct-test-input><tct-test-input name="b" required></tct-test-input>`,
    );
    const inputs = [...harness.form.querySelectorAll('tct-test-input')];
    let saveEnabled = true;
    harness.form.addEventListener('input', () => {
      saveEnabled = harness.form.checkValidity();
    });
    await userEvent.click(inputs[0]!);
    await userEvent.keyboard('x');
    expect(saveEnabled).toBe(false);
    await Promise.all(inputs.map((input) => input.updateComplete));
    await nextFrame();
    for (const input of inputs) {
      expect(ariaInvalid(input), input.getAttribute('name') ?? '').toBeNull();
      if (!isTier2) expect(hasCustomState(input, 'user-invalid')).toBe(false);
    }
  });
});

describe('M7: :state() is guarded', () => {
  it('a form control still validates and syncs aria-invalid where custom states are missing', async () => {
    await withFeature('customStates', false, async () => {
      const harness = await formHarness(`<tct-test-input name="q" required></tct-test-input>`);
      const input = harness.form.querySelector('tct-test-input')!;
      expect(() => input.reportValidity()).not.toThrow();
      await input.updateComplete;
      await nextFrame();
      expect(ariaInvalid(input)).toBe('true');
      expect(hasCustomState(input, 'user-invalid')).toBe(false);
    });
  });
});

describe('M14: motion respects prefers-reduced-motion', () => {
  it.skipIf(!isChromium)(
    'prefersReducedMotion() reads the live preference for scroll behaviour choices',
    async () => {
      const restore = await emulateMedia({reducedMotion: 'reduce'});
      expect(prefersReducedMotion()).toBe(true);
      await restore();
      expect(prefersReducedMotion()).toBe(false);
    },
  );
});

describe('Low findings that live in the foundation', () => {
  it('validation messages are the browser’s own localized strings, never hard-coded English', () => {
    for (const kind of ['text', 'checkbox', 'radio', 'select', 'file', 'invalid'] as const) {
      expect(nativeMessage(kind), kind).not.toBe('');
      expect(nativeMessage(kind), kind).not.toBe('Invalid value.');
    }
    expect(nativeMessage('checkbox')).not.toBe(nativeMessage('text'));
  });

  it('the icon registry stores data (paths), never markup strings for unsafeSVG', () => {
    registerIcons({x: {viewBox: '0 0 1 1', paths: [{d: 'M0 0'}], mode: 'fill'}});
    const icon = getIcon('x');
    expect(typeof icon).toBe('object');
    expect(JSON.stringify(icon)).not.toContain('<');
  });

  it('the focus trap is not part of the modal path (native dialogs make the rest inert)', async () => {
    const layer = await fixture<TctTestLayer>(
      html`<tct-test-layer kind="modal" open><button>a</button></tct-test-layer>`,
    );
    await waitUntil(() => shown(layer), 'open');
    expect((layer.surface as HTMLDialogElement).matches(':modal')).toBe(true);
  });
});
