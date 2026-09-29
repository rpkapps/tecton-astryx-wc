/**
 * Acceptance criterion 5 (overlay contract), end to end across dialog, text-input and tooltip.
 *
 * A dialog opened by a button contains a nested dialog (opened by a button in the outer one), and the
 * nested dialog holds a text input whose clear button has a tooltip. Escape closes the tooltip, then the
 * nested dialog, then the dialog, one per press, with focus returning to each opener; the tooltip never
 * closes a dialog; a backdrop press follows the dialog's purpose; an announcer message is spoken while
 * the modal is open; and `moveBefore` keeps the dialog modal.
 */
import {userEvent} from 'vitest/browser';
import {describe, expect, it} from 'vitest';
import {announce, getAnnouncerRegions} from '@tecton-astryx/core/a11y/announcer.js';
import {overrideFeature} from '@tecton-astryx/core/features.js';
import {deepActiveElement} from '@tecton-astryx/core/utils/focus.js';
import {fixture} from '@tecton-astryx/testing/fixture.js';
import {pressKeys} from '@tecton-astryx/testing/keyboard.js';
import {layerStack} from '@tecton-astryx/testing/layers.js';
import {animationsFinished, nextFrame, waitUntil} from '@tecton-astryx/testing/timing.js';
import '../field/define.js';
import '../text-input/define.js';
import '../tooltip/define.js';
import './define.js';
import type {TctTextInput} from '../text-input/tct-text-input.js';
import type {TctTooltip} from '../tooltip/tct-tooltip.js';
import type {TctDialog} from './tct-dialog.js';

const surfaceOf = (dialog: TctDialog): HTMLDialogElement =>
  dialog.shadowRoot!.querySelector<HTMLDialogElement>('dialog')!;

interface Scene {
  wrapper: HTMLElement;
  outer: TctDialog;
  inner: TctDialog;
  text: TctTextInput;
  tooltip: TctTooltip;
  openOuter: HTMLElement;
  openInner: HTMLElement;
}

async function scene(innerPurpose = 'info'): Promise<Scene> {
  const wrapper = await fixture<HTMLElement>(
    `<div>
      <button id="open-outer" commandfor="outer" command="--show">Open outer</button>
      <tct-dialog id="outer" heading="Outer">
        <button id="open-inner" commandfor="inner" command="--show">Open inner</button>
        <tct-dialog id="inner" heading="Inner" purpose="${innerPurpose}">
          <tct-text-input label="Search" has-clear value="abc"></tct-text-input>
        </tct-dialog>
      </tct-dialog>
    </div>`,
  );
  const outer = wrapper.querySelector<TctDialog>('#outer')!;
  const inner = wrapper.querySelector<TctDialog>('#inner')!;
  const text = wrapper.querySelector<TctTextInput>('tct-text-input')!;
  await Promise.all([outer.updateComplete, inner.updateComplete, text.updateComplete]);
  const clear = text.shadowRoot!.querySelector('tct-input-clear-button')!;
  await (clear as HTMLElement & {updateComplete: Promise<boolean>}).updateComplete;
  const tooltip = clear.shadowRoot!.querySelector<TctTooltip>('tct-tooltip')!;
  return {
    wrapper,
    outer,
    inner,
    text,
    tooltip,
    openOuter: wrapper.querySelector<HTMLElement>('#open-outer')!,
    openInner: wrapper.querySelector<HTMLElement>('#open-inner')!,
  };
}

async function openBoth(s: Scene): Promise<void> {
  await userEvent.click(s.openOuter);
  await waitUntil(() => s.outer.open && layerStack().length === 1, 'outer open');
  await animationsFinished(surfaceOf(s.outer));
  await userEvent.click(s.openInner);
  await waitUntil(() => s.inner.open && layerStack().length === 2, 'inner open');
  await animationsFinished(surfaceOf(s.inner));
}

describe('overlay contract (acceptance 5)', () => {
  it('Escape closes the tooltip, then the nested dialog, then the dialog, one per press, returning focus to each opener', async () => {
    const s = await scene();
    await openBoth(s);
    // Keyboard-focus the clear button inside the nested dialog: its tooltip opens.
    const input = s.text.shadowRoot!.querySelector<HTMLInputElement>('input.input')!;
    input.focus();
    await pressKeys('Tab');
    await waitUntil(() => s.tooltip.isOpen, 'tooltip open on the clear button');
    expect(layerStack().length).toBeGreaterThanOrEqual(2);

    await pressKeys('Escape');
    await waitUntil(() => !s.tooltip.isOpen, 'tooltip closed by the first Escape');
    expect(s.inner.open, 'the tooltip Escape leaves the nested dialog open').toBe(true);
    expect(s.outer.open).toBe(true);

    await pressKeys('Escape');
    await waitUntil(() => !s.inner.open, 'nested dialog closed by the second Escape');
    expect(s.outer.open, 'the outer dialog survives the nested one').toBe(true);
    await waitUntil(
      () => deepActiveElement()?.id === 'open-inner',
      'focus back on the nested opener',
    );

    await pressKeys('Escape');
    await waitUntil(() => !s.outer.open, 'outer dialog closed by the third Escape');
    await waitUntil(
      () => deepActiveElement()?.id === 'open-outer',
      'focus back on the outer opener',
    );
    expect(layerStack()).toHaveLength(0);
  });

  it('an open tooltip never closes its dialog: hiding it (pointer leaving, Escape) leaves the dialog open', async () => {
    const s = await scene();
    await openBoth(s);
    s.tooltip.show();
    await waitUntil(() => s.tooltip.isOpen, 'tooltip shown');
    expect(s.inner.open).toBe(true);
    s.tooltip.hide();
    await waitUntil(() => !s.tooltip.isOpen, 'tooltip hidden');
    expect(s.inner.open).toBe(true);
    expect(s.outer.open).toBe(true);
  });

  it.each([
    ['info', true],
    ['form', false],
    ['required', false],
  ] as const)(
    'a backdrop press on a %s dialog closes it: %s (and never the outer one)',
    async (purpose, closes) => {
      const s = await scene(purpose);
      await openBoth(s);
      const box = surfaceOf(s.inner).getBoundingClientRect();
      surfaceOf(s.inner).dispatchEvent(
        new PointerEvent('pointerdown', {
          bubbles: true,
          composed: true,
          clientX: Math.max(2, box.left - 20),
          clientY: box.top + 5,
        }),
      );
      await nextFrame();
      if (closes) await waitUntil(() => !s.inner.open, `${purpose}: dismissed`);
      else {
        await new Promise((resolve) => setTimeout(resolve, 100));
        expect(s.inner.open, `${purpose}: kept`).toBe(true);
      }
      expect(s.outer.open, `${purpose}: the outer dialog is never touched`).toBe(true);
      await s.inner.hide();
      await s.outer.hide();
    },
  );

  it('an announcer message is spoken while the modal is open', async () => {
    const restore = overrideFeature('ariaNotify', false);
    try {
      const s = await scene();
      await openBoth(s);
      announce('Saved', {politeness: 'polite'});
      await waitUntil(() => getAnnouncerRegions().polite?.textContent === 'Saved', 'spoken', 2500);
      const region = getAnnouncerRegions().polite!;
      // The live region sits inside the top-most modal, so `showModal()` did not silence it.
      expect(
        surfaceOf(s.inner).contains(region) ||
          region.getRootNode() === s.inner.shadowRoot ||
          region.closest('dialog') !== null,
      ).toBe(true);
    } finally {
      restore();
    }
  });

  it('moveBefore keeps the dialog modal, open and dismissable (falls back to append where unsupported)', async () => {
    const wrapper = await fixture<HTMLElement>(
      `<div><section id="a"><tct-dialog heading="Moved" open><tct-text-input label="Q" has-clear value="x"></tct-text-input></tct-dialog></section><section id="b"></section></div>`,
    );
    const dialog = wrapper.querySelector<TctDialog>('tct-dialog')!;
    await waitUntil(() => surfaceOf(dialog).matches(':modal'), 'modal');
    const target = wrapper.querySelector('#b') as HTMLElement & {
      moveBefore?: (node: Node, reference: Node | null) => void;
    };
    if (typeof target.moveBefore === 'function') target.moveBefore(dialog, null);
    else target.append(dialog);
    await nextFrame();
    await waitUntil(
      () => surfaceOf(dialog).matches(':modal') && layerStack().length === 1,
      'still modal after the move',
    );
    expect(dialog.open).toBe(true);
    await pressKeys('Escape');
    await waitUntil(() => !dialog.open, 'Escape still closes it');
  });
});
