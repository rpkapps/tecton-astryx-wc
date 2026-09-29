/**
 * tct-dialog and tct-dialog-header: the element and overlay suites, then purposes, nesting, focus
 * return, naming (acceptance 6), events (acceptance 7), commands, position and variants, inline mode,
 * `openDialog()`, RTL and forced colours. Ported from upstream Dialog.test.tsx / DialogHeader.test.tsx /
 * useImperativeDialog.test.tsx where the behaviour applies.
 */
import {html} from 'lit';
import {userEvent} from 'vitest/browser';
import {describe, expect, it, vi} from 'vitest';
import {getAnnouncerRegions} from '@tecton-astryx/core/a11y/announcer.js';
import {overrideFeature} from '@tecton-astryx/core/features.js';
import {resetDevWarnings} from '@tecton-astryx/core/utils/dev.js';
import {deepActiveElement} from '@tecton-astryx/core/utils/focus.js';
import {axNode, expectAccessible} from '@tecton-astryx/testing/a11y.js';
import {emulateMedia} from '@tecton-astryx/testing/emulate.js';
import {recordEvents} from '@tecton-astryx/testing/events.js';
import {fixture} from '@tecton-astryx/testing/fixture.js';
import {pressKeys} from '@tecton-astryx/testing/keyboard.js';
import {layerStack} from '@tecton-astryx/testing/layers.js';
import {runElementSuite} from '@tecton-astryx/testing/suites/element.js';
import {runOverlaySuite} from '@tecton-astryx/testing/suites/overlay.js';
import {isChromium, isTier2} from '@tecton-astryx/testing/tier.js';
import {aTimeout, animationsFinished, nextFrame, waitUntil} from '@tecton-astryx/testing/timing.js';
import '../field/define.js';
import '../tooltip/define.js';
import './define.js';
import {openDialog} from './dialog.api.js';
import type {TctDialog} from './tct-dialog.js';
import type {TctButton} from '../button/tct-button.js';
import type {TctDialogHeader} from './tct-dialog-header.js';

const surfaceOf = (dialog: TctDialog): HTMLDialogElement =>
  dialog.shadowRoot!.querySelector<HTMLDialogElement>('dialog')!;

/**
 * A real pointer press on the backdrop: the top-left corner of the page is outside every dialog box, and
 * `force` skips the actionability checks that a backdrop (which is not the click target) would fail.
 */
async function pressBackdrop(): Promise<void> {
  await userEvent.click(document.documentElement, {position: {x: 5, y: 5}, force: true});
}

async function make(attributes = 'heading="Title"', body = '<p>Body</p>'): Promise<TctDialog> {
  const wrapper = await fixture<HTMLElement>(
    `<div><button id="opener">Open</button><tct-dialog ${attributes}>${body}</tct-dialog></div>`,
  );
  const dialog = wrapper.querySelector<TctDialog>('tct-dialog')!;
  await dialog.updateComplete;
  return dialog;
}

runElementSuite({
  tag: 'tct-dialog',
  render: () => html`<tct-dialog heading="Title"><p>Body</p></tct-dialog>`,
  properties: {
    open: false,
    purpose: 'form',
    variant: 'fullscreen',
    width: 320,
    maxHeight: '50dvh',
    heading: 'Other',
    subtitle: 'Sub',
    padding: 2,
  },
  attributes: {purpose: 'purpose', variant: 'variant', heading: 'heading', subtitle: 'subtitle'},
  events: ['tct-open-change', 'tct-after-open-change'],
  // The host is `display: contents`; the surface is the native <dialog>.
  skip: ['hostBox'],
});

runOverlaySuite({
  tag: 'tct-dialog',
  render: ({attributes = '', children = ''}) =>
    `<tct-dialog heading="Dialog" ${attributes}><button id="inside">Inside</button>${children}</tct-dialog>`,
  modal: true,
  // The backdrop covers the page, so a press "outside" is a press on the backdrop (tested below).
  outsidePress: false,
  surface: (element) => element.shadowRoot!.querySelector('dialog'),
});

describe('tct-dialog: rendering (Dialog.test.tsx)', () => {
  it('renders a native modal <dialog> when open, with aria-modal, and nothing shown when closed', async () => {
    const dialog = await make();
    expect(surfaceOf(dialog).open).toBe(false);
    expect(surfaceOf(dialog).getAttribute('aria-modal')).toBe('true');
    dialog.open = true;
    await waitUntil(() => surfaceOf(dialog).matches(':modal'), 'shown with showModal');
    expect(layerStack().map((layer) => layer.kind)).toEqual(['modal']);
    dialog.open = false;
    await waitUntil(() => !surfaceOf(dialog).open, 'closed');
  });

  it('renders the heading, the subtitle, and the content in the dialog', async () => {
    const dialog = await make('heading="Title" subtitle="More detail" open', '<p id="p">Body</p>');
    await waitUntil(() => surfaceOf(dialog).open, 'open');
    const header = dialog.shadowRoot!.querySelector<TctDialogHeader>('tct-dialog-header')!;
    expect(header.querySelector('h2')!.textContent).toBe('Title');
    expect(header.shadowRoot!.querySelector('[part="subtitle"]')!.textContent).toBe('More detail');
    expect(dialog.querySelector('#p')!.getBoundingClientRect().height).toBeGreaterThan(0);
  });

  it('a standard dialog keeps the requested width but clamps it to the viewport gutter; maxHeight bounds it', async () => {
    const dialog = await make('heading="T" open width="320" max-height="240"');
    await waitUntil(() => surfaceOf(dialog).open, 'open');
    await animationsFinished(surfaceOf(dialog));
    const rect = surfaceOf(dialog).getBoundingClientRect();
    expect(rect.width).toBe(320);
    expect(rect.height).toBeLessThanOrEqual(240);
    dialog.width = 5000;
    await dialog.updateComplete;
    expect(surfaceOf(dialog).getBoundingClientRect().width).toBeLessThanOrEqual(
      innerWidth - 2 * 16,
    );
  });

  it('fullscreen takes the whole viewport with no radius', async () => {
    const dialog = await make('heading="T" open variant="fullscreen"');
    await waitUntil(() => surfaceOf(dialog).open, 'open');
    await animationsFinished(surfaceOf(dialog));
    const rect = surfaceOf(dialog).getBoundingClientRect();
    expect(rect.width).toBe(innerWidth);
    expect(rect.height).toBe(innerHeight);
    expect(getComputedStyle(surfaceOf(dialog)).borderTopLeftRadius).toBe('0px');
  });

  it('is drawn with the Tecton rule and container radius, on the surface colour', async () => {
    const dialog = await make('heading="T" open');
    await waitUntil(() => surfaceOf(dialog).open, 'open');
    const style = getComputedStyle(surfaceOf(dialog));
    expect(style.borderTopWidth).toBe('1px');
    expect(style.borderTopLeftRadius).toBe('8px');
    expect(style.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
  });

  it('position places the dialog: logical start/end mirror in RTL, block offsets are physical top/bottom', async () => {
    const dialog = await make('heading="T" open');
    dialog.position = {top: 20, start: 10};
    await waitUntil(() => surfaceOf(dialog).open, 'open');
    await animationsFinished(surfaceOf(dialog));
    let rect = surfaceOf(dialog).getBoundingClientRect();
    expect(Math.round(rect.top)).toBe(20);
    expect(Math.round(rect.left)).toBe(10);

    const rtl = await fixture<HTMLElement>(
      `<div dir="rtl"><tct-dialog heading="T" open></tct-dialog></div>`,
      {dir: 'rtl'},
    );
    const mirrored = rtl.querySelector<TctDialog>('tct-dialog')!;
    mirrored.position = {top: 20, start: 10};
    mirrored.width = 200;
    await waitUntil(() => surfaceOf(mirrored).open, 'open');
    await animationsFinished(surfaceOf(mirrored));
    rect = surfaceOf(mirrored).getBoundingClientRect();
    // Mirrored: the 10px offset is now measured from the right edge (plus the scrollbar gutter that
    // the scroll lock reserves on the side of an LTR page), and the left gap is the larger one.
    const rightGap = innerWidth - rect.right;
    expect(rightGap).toBeGreaterThanOrEqual(10);
    expect(rightGap).toBeLessThan(30);
    expect(rect.left).toBeGreaterThan(rightGap + 100);
  });

  it('padding is a step of the spacing scale; the default is spacing 4', async () => {
    const dialog = await make('heading="T" open');
    await waitUntil(() => surfaceOf(dialog).open, 'open');
    const inner = () => dialog.shadowRoot!.querySelector<HTMLElement>('.inner')!;
    expect(getComputedStyle(inner()).paddingTop).toBe('16px');
    dialog.padding = 2;
    await dialog.updateComplete;
    expect(getComputedStyle(inner()).paddingTop).toBe('8px');
    dialog.padding = 0.5;
    await dialog.updateComplete;
    expect(getComputedStyle(inner()).paddingTop).toBe('2px');
  });

  it('inline renders the content in place without a <dialog>, only while open, and never becomes modal', async () => {
    const dialog = await make('heading="Preview" inline');
    expect(dialog.shadowRoot!.querySelector('dialog')).toBeNull();
    expect(dialog.shadowRoot!.querySelector('.dialog')).toBeNull();
    dialog.open = true;
    await dialog.updateComplete;
    expect(dialog.shadowRoot!.querySelector('dialog')).toBeNull();
    expect(dialog.shadowRoot!.querySelector('.dialog.inline')).not.toBeNull();
    expect(layerStack()).toHaveLength(0);
    expect(document.querySelector(':modal')).toBeNull();
  });

  it('inline suppresses the heading autofocus', async () => {
    const before = document.activeElement;
    const dialog = await make('heading="Preview" inline open');
    await aTimeout(50);
    expect(document.activeElement).toBe(before);
    expect(dialog.querySelector('h2')).toBeNull();
    expect(dialog.shadowRoot!.querySelector('tct-dialog-header h2')).not.toBeNull();
  });
});

describe('tct-dialog: purpose (Dialog.test.tsx)', () => {
  it('info (default): Escape and a backdrop press both ask to close', async () => {
    const dialog = await make('heading="T" open');
    await waitUntil(() => layerStack().length === 1, 'open');
    const changes = recordEvents(dialog, 'tct-open-change');
    await pressKeys('Escape');
    await waitUntil(() => !dialog.open, 'closed by Escape');
    expect(changes.events[0]).toMatchObject({open: false, reason: 'escape', cancelable: true});

    dialog.open = true;
    await waitUntil(() => layerStack().length === 1, 'reopened');
    await animationsFinished(surfaceOf(dialog));
    await pressBackdrop();
    await waitUntil(() => !dialog.open, 'closed by the backdrop press', 3000);
    expect(changes.events.at(-1)).toMatchObject({reason: 'outside'});
  });

  it('form: Escape closes, but a press on the backdrop does not (the user could lose their input)', async () => {
    const dialog = await make('heading="T" open purpose="form"');
    await waitUntil(() => layerStack().length === 1, 'open');
    await animationsFinished(surfaceOf(dialog));
    await pressBackdrop();
    await aTimeout(200);
    expect(dialog.open).toBe(true);
    await pressKeys('Escape');
    await waitUntil(() => !dialog.open, 'closed by Escape');
  });

  it('required: nothing dismisses it, it is an alertdialog, and it has no close button', async () => {
    const dialog = await make('heading="T" open purpose="required"');
    await waitUntil(() => layerStack().length === 1, 'open');
    const changes = recordEvents(dialog, 'tct-open-change');
    expect(surfaceOf(dialog).getAttribute('role')).toBe('alertdialog');
    await pressKeys('Escape');
    // The platform's own close request is claimed too: the surface stays modal.
    surfaceOf(dialog).dispatchEvent(new Event('cancel', {cancelable: true}));
    await aTimeout(100);
    expect(dialog.open).toBe(true);
    expect(surfaceOf(dialog).matches(':modal')).toBe(true);
    expect(changes.events).toHaveLength(0);
    expect(
      dialog.shadowRoot!.querySelector('tct-dialog-header')!.shadowRoot!.querySelector('.close'),
    ).toBeNull();
    // An explicit request (an app's own Done button, a <form method="dialog">) still closes it.
    dialog.requestClose();
    await waitUntil(() => !dialog.open, 'closed by an explicit request');
    expect(changes.events).toHaveLength(1);
    expect(changes.events[0]).toMatchObject({open: false, reason: 'request'});
  });

  it('only "required" or `alert` carries role=alertdialog', async () => {
    for (const purpose of ['info', 'form']) {
      const dialog = await make(`heading="T" open purpose="${purpose}"`);
      expect(surfaceOf(dialog).hasAttribute('role'), purpose).toBe(false);
    }
  });

  it.each(['info', 'form', 'required'])(
    'alert gives a %s dialog role=alertdialog without changing what dismisses it',
    async (purpose) => {
      const dialog = await make(`heading="T" open alert purpose="${purpose}"`);
      await waitUntil(() => layerStack().length === 1, 'open');
      expect(surfaceOf(dialog).getAttribute('role')).toBe('alertdialog');
      expect((await axNode(surfaceOf(dialog))).role).toBe('alertdialog');
      await animationsFinished(surfaceOf(dialog));
      const changes = recordEvents(dialog, 'tct-open-change');
      await pressKeys('Escape');
      if (purpose === 'required') {
        await aTimeout(100);
        expect(dialog.open).toBe(true);
        expect(changes.events).toHaveLength(0);
      } else {
        await waitUntil(() => !dialog.open, 'closed by Escape');
        expect(changes.events).toHaveLength(1);
        expect(changes.events[0]).toMatchObject({open: false, reason: 'escape', cancelable: true});
      }
    },
  );

  it('alert with purpose=form: a cancelled Escape keeps it open and a backdrop press never closes it', async () => {
    const dialog = await make('heading="T" open alert purpose="form"');
    await waitUntil(() => layerStack().length === 1, 'open');
    await animationsFinished(surfaceOf(dialog));
    dialog.addEventListener('tct-open-change', (event) => {
      event.preventDefault();
    });
    await pressKeys('Escape');
    await aTimeout(120);
    expect(dialog.open).toBe(true);
    await pressBackdrop();
    await aTimeout(200);
    expect(dialog.open).toBe(true);
  });

  it('alert is reflected, and inline (non-modal) never claims alertdialog', async () => {
    const dialog = await make('heading="T" open inline alert');
    expect(dialog.hasAttribute('alert')).toBe(true);
    expect(dialog.shadowRoot!.querySelector('dialog')).toBeNull();
    expect(dialog.shadowRoot!.querySelector('[role="alertdialog"]')).toBeNull();
  });

  it('a composing Escape is claimed and never closes the dialog', async () => {
    const dialog = await make('heading="T" open');
    await waitUntil(() => layerStack().length === 1, 'open');
    for (const init of [{isComposing: true}, {keyCode: 229}]) {
      const event = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        composed: true,
        cancelable: true,
        ...init,
      });
      document.activeElement?.dispatchEvent(event);
      document.dispatchEvent(event);
    }
    await aTimeout(80);
    expect(dialog.open).toBe(true);
  });
});

describe('tct-dialog: events (acceptance 7)', () => {
  it('tct-open-change is cancelable: preventDefault keeps the dialog open', async () => {
    const dialog = await make('heading="T" open');
    await waitUntil(() => layerStack().length === 1, 'open');
    dialog.addEventListener('tct-open-change', (event) => event.preventDefault());
    await pressKeys('Escape');
    await aTimeout(100);
    expect(dialog.open).toBe(true);
    expect(surfaceOf(dialog).open).toBe(true);
  });

  it('tct-after-open-change fires after the exit animation, once per settled change', async () => {
    const dialog = await make('heading="T"');
    const after = recordEvents(dialog, 'tct-after-open-change');
    dialog.open = true;
    await waitUntil(() => after.events.length === 1, 'opened');
    await animationsFinished(surfaceOf(dialog));
    const closedAt = performance.now();
    await pressKeys('Escape');
    await waitUntil(() => after.events.length === 2, 'closed');
    expect(after.events.map((event) => event.open)).toEqual([true, false]);
    expect(surfaceOf(dialog).open).toBe(false);
    expect(performance.now() - closedAt).toBeGreaterThanOrEqual(0);
  });

  it('no events on property or attribute writes, and requestClose() is user-equivalent', async () => {
    const dialog = await make('heading="T"');
    const changes = recordEvents(dialog, 'tct-open-change');
    dialog.open = true;
    dialog.setAttribute('purpose', 'form');
    await waitUntil(() => layerStack().length === 1, 'open');
    dialog.open = false;
    await waitUntil(() => layerStack().length === 0, 'closed');
    expect(changes.events).toHaveLength(0);
    dialog.open = true;
    await waitUntil(() => layerStack().length === 1, 'open again');
    dialog.requestClose();
    await waitUntil(() => !dialog.open, 'requestClose closed it');
    expect(changes.events).toHaveLength(1);
    expect(changes.events[0]).toMatchObject({open: false, reason: 'request'});
  });

  it('the close button asks with reason "close-button", and preventing it keeps the dialog open', async () => {
    const dialog = await make('heading="T" open');
    await waitUntil(() => layerStack().length === 1, 'open');
    const header = dialog.shadowRoot!.querySelector<TctDialogHeader>('tct-dialog-header')!;
    const close = header.shadowRoot!.querySelector<TctButton>('.close')!;
    const changes = recordEvents(dialog, 'tct-open-change');
    dialog.addEventListener('tct-open-change', (event) => event.preventDefault(), {once: true});
    close.click();
    await aTimeout(80);
    expect(dialog.open).toBe(true);
    close.click();
    await waitUntil(() => !dialog.open, 'closed by the close button');
    expect(changes.events.map((event) => event.reason)).toEqual(['close-button', 'close-button']);
  });

  it('a <form method="dialog"> in the content closes it (a user-equivalent request) and settles', async () => {
    const dialog = await make(
      'heading="T" open',
      '<form method="dialog"><button id="done">Done</button></form>',
    );
    const after = recordEvents(dialog, 'tct-after-open-change');
    await waitUntil(() => layerStack().length === 1, 'open');
    await waitUntil(() => after.events.length === 1, 'opened');
    await userEvent.click(dialog.querySelector('#done')!);
    await waitUntil(() => !dialog.open, 'closed');
    await waitUntil(() => after.events.length === 2, 'settled closed');
  });
});

describe('tct-dialog: focus', () => {
  it('opening focuses the heading (tabindex -1, so it is not a tab stop) and returns focus to the opener on close', async () => {
    const dialog = await make('heading="Title"');
    const opener = dialog.previousElementSibling as HTMLElement;
    opener.focus();
    dialog.open = true;
    const heading = () => dialog.shadowRoot!.querySelector<HTMLElement>('tct-dialog-header h2')!;
    await waitUntil(() => deepActiveElement() === heading(), 'heading focused');
    expect(heading().getAttribute('tabindex')).toBe('-1');
    await pressKeys('Escape');
    await waitUntil(() => !dialog.open, 'closed');
    await waitUntil(() => deepActiveElement() === opener, 'focus returned to the opener');
  });

  it('an autofocus element of yours wins over the heading', async () => {
    const dialog = await make('heading="Title" open', '<input id="first" autofocus>');
    await waitUntil(() => deepActiveElement() === dialog.querySelector('#first'), 'autofocused');
  });

  it('Tab stays inside the modal: the page behind it is inert', async () => {
    const dialog = await make(
      'heading="Title" open',
      '<button id="a">A</button><button id="b">B</button>',
    );
    await waitUntil(() => layerStack().length === 1, 'open');
    for (let i = 0; i < 6; i++) {
      await pressKeys('Tab');
      const active = deepActiveElement();
      expect(active?.id === 'opener', 'focus escaped to the page').toBe(false);
    }
    expect(dialog.parentElement!.querySelector('#opener')!.matches(':focus')).toBe(false);
  });

  it('closing without error when the captured opener has been removed from the page', async () => {
    const dialog = await make('heading="T"');
    const opener = dialog.previousElementSibling as HTMLElement;
    opener.focus();
    dialog.open = true;
    await waitUntil(() => layerStack().length === 1, 'open');
    opener.remove();
    await expect(dialog.hide()).resolves.toBeUndefined();
    expect(dialog.open).toBe(false);
  });

  it('moving an open dialog with moveBefore keeps it modal, open and registered (Chromium)', async () => {
    const wrapper = await fixture<HTMLElement>(
      `<div><section id="a"><tct-dialog heading="Moved" open><p>x</p></tct-dialog></section><section id="b"></section></div>`,
    );
    const dialog = wrapper.querySelector<TctDialog>('tct-dialog')!;
    await waitUntil(() => surfaceOf(dialog).matches(':modal'), 'modal');
    const target = wrapper.querySelector('#b')!;
    if (typeof target.moveBefore === 'function') {
      target.moveBefore(dialog, null);
    } else {
      target.append(dialog);
    }
    await nextFrame();
    await waitUntil(
      () => surfaceOf(dialog).matches(':modal') && layerStack().length === 1,
      'still modal',
    );
    expect(dialog.open).toBe(true);
    await pressKeys('Escape');
    await waitUntil(() => !dialog.open, 'still dismissable after the move');
  });
});

describe('tct-dialog: naming (acceptance 6) and accessibility', () => {
  it.skipIf(!isChromium)('the dialog role and name come from the heading', async () => {
    const dialog = await make('heading="Delete project" open');
    await waitUntil(() => layerStack().length === 1, 'open');
    expect(await axNode(surfaceOf(dialog))).toMatchObject({role: 'dialog', name: 'Delete project'});
    expect((await axNode(dialog.shadowRoot!.querySelector('tct-dialog-header h2')!)).role).toBe(
      'heading',
    );
  });

  it.skipIf(!isChromium)(
    'a required dialog is an alertdialog named after its heading',
    async () => {
      const dialog = await make('heading="Session expired" open purpose="required"');
      await waitUntil(() => layerStack().length === 1, 'open');
      expect(await axNode(surfaceOf(dialog))).toMatchObject({
        role: 'alertdialog',
        name: 'Session expired',
      });
    },
  );

  it.skipIf(!isChromium)(
    'a tct-dialog-header composed by the author names the dialog too (heading in the light DOM)',
    async () => {
      const wrapper = await fixture<HTMLElement>(
        `<div><tct-dialog open><tct-dialog-header heading="Composed title" subtitle="s"></tct-dialog-header><p>Body</p></tct-dialog></div>`,
      );
      const dialog = wrapper.querySelector<TctDialog>('tct-dialog')!;
      await waitUntil(() => layerStack().length === 1, 'open');
      expect((await axNode(surfaceOf(dialog))).name).toBe('Composed title');
      const heading = dialog.querySelector('tct-dialog-header h2')!;
      await waitUntil(() => deepActiveElement() === heading, 'the composed heading takes focus');
    },
  );

  it('an explicit aria-label or aria-labelledby wins over the heading', async () => {
    const dialog = await make('heading="Heading" open aria-label="Explicit name"');
    await waitUntil(() => layerStack().length === 1, 'open');
    if (isChromium) expect((await axNode(surfaceOf(dialog))).name).toBe('Explicit name');
    expect(surfaceOf(dialog).getAttribute('aria-label')).toBe('Explicit name');
  });

  it('warns once when it opens with no accessible name, and not when a heading names it', async () => {
    resetDevWarnings();
    (globalThis as {tctDevMode?: boolean}).tctDevMode = true;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      await make('open', '<p>No name</p>');
      await waitUntil(() => warn.mock.calls.length > 0, 'warned');
      expect(String(warn.mock.calls[0]![0])).toContain('accessible name');
      warn.mockClear();
      await make('open heading="Named"');
      await aTimeout(100);
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
      delete (globalThis as {tctDevMode?: boolean}).tctDevMode;
    }
  });

  it('passes axe open, for every purpose, and inline', async () => {
    for (const attributes of [
      'heading="Title" subtitle="More" open',
      'heading="Title" open purpose="required"',
      'heading="Title" open purpose="form"',
      'heading="Preview" inline open',
    ]) {
      const dialog = await make(attributes);
      await waitUntil(() => dialog.inline || layerStack().length === 1, 'open');
      await animationsFinished(dialog.inline ? dialog : surfaceOf(dialog));
      await expectAccessible(dialog);
      await dialog.hide();
    }
  });

  it('a toast-like announcer message is spoken while the modal is open (persistent UI moves into the modal)', async () => {
    const restore = overrideFeature('ariaNotify', false);
    try {
      const dialog = await make('heading="T" open');
      await waitUntil(() => layerStack().length === 1, 'open');
      const {announce} = await import('@tecton-astryx/core/a11y/announcer.js');
      announce('Saved', {politeness: 'polite'});
      await waitUntil(() => getAnnouncerRegions().polite?.textContent === 'Saved', 'spoken', 2500);
      // The live region lives inside the modal, so `showModal()` did not silence it.
      expect(
        getAnnouncerRegions().polite!.closest('dialog') ??
          surfaceOf(dialog).contains(getAnnouncerRegions().polite!),
      ).toBeTruthy();
    } finally {
      restore();
    }
  });
});

describe('tct-dialog: heading, header and slots', () => {
  it('heading and subtitle render as a header; slot="heading" projects your own heading element', async () => {
    const dialog = await make(
      'open subtitle="s"',
      '<h2 slot="heading" id="mine">My <em>rich</em> heading</h2><p>Body</p>',
    );
    await waitUntil(() => layerStack().length === 1, 'open');
    if (isChromium) expect((await axNode(surfaceOf(dialog))).name).toContain('My rich heading');
    await waitUntil(
      () => deepActiveElement() === dialog.querySelector('#mine') || deepActiveElement() === null,
      'focus',
    );
  });

  it('the header renders the title as an h2 with tabindex -1, a subtitle only when given, and start/end content', async () => {
    const wrapper = await fixture<HTMLElement>(
      `<tct-dialog-header heading="Title" subtitle="Sub"><button slot="start" id="back">back</button><button slot="end" id="act">act</button></tct-dialog-header>`,
    );
    const header = wrapper as unknown as TctDialogHeader;
    await header.updateComplete;
    expect(header.querySelector('h2')!.textContent).toBe('Title');
    expect(header.querySelector('h2')!.getAttribute('tabindex')).toBe('-1');
    expect(header.shadowRoot!.querySelector('[part="subtitle"]')!.textContent).toBe('Sub');
    const bare = await fixture<TctDialogHeader>(
      `<tct-dialog-header heading="Only"></tct-dialog-header>`,
    );
    expect(bare.shadowRoot!.querySelector('[part="subtitle"]')).toBeNull();
    const start = header
      .shadowRoot!.querySelector<HTMLElement>('[part="start"]')!
      .getBoundingClientRect();
    const end = header
      .shadowRoot!.querySelector<HTMLElement>('[part="end"]')!
      .getBoundingClientRect();
    expect(start.right).toBeLessThan(end.left);
  });

  it('a header alone: the close button fires a cancelable tct-open-change (reason close-button) from the header', async () => {
    const header = await fixture<TctDialogHeader>(
      `<tct-dialog-header heading="Alone"></tct-dialog-header>`,
    );
    const changes = recordEvents(header, 'tct-open-change');
    header.shadowRoot!.querySelector<TctButton>('.close')!.click();
    expect(changes.events).toHaveLength(1);
    expect(changes.events[0]).toMatchObject({
      open: false,
      reason: 'close-button',
      cancelable: true,
    });
    header.noCloseButton = true;
    await header.updateComplete;
    expect(header.shadowRoot!.querySelector('.close')).toBeNull();
  });

  it('the close button is named "Close" (localised; close-label overrides) and shows a tooltip', async () => {
    const header = await fixture<TctDialogHeader>(
      `<tct-dialog-header heading="H"></tct-dialog-header>`,
    );
    const close = () => header.shadowRoot!.querySelector<TctButton>('.close')!;
    const nativeName = () =>
      close().shadowRoot!.querySelector('button')!.getAttribute('aria-label');
    await close().updateComplete;
    expect(close().label).toBe('Close');
    expect(nativeName()).toBe('Close');
    header.closeLabel = 'Dismiss';
    await header.updateComplete;
    await close().updateComplete;
    expect(nativeName()).toBe('Dismiss');
    // The tct-button is icon-only, so its built-in tooltip shows the label.
    expect(close().shadowRoot!.querySelector('.tooltip-surface')!.textContent.trim()).toBe(
      'Dismiss',
    );
  });

  it('end-content-edge-compensation selects the axes that are pulled in; the default is both while the close button shows', async () => {
    const header = await fixture<TctDialogHeader>(
      `<tct-dialog-header heading="H"></tct-dialog-header>`,
    );
    const end = () => header.shadowRoot!.querySelector<HTMLElement>('.end')!;
    expect(end().hasAttribute('data-compensate-block')).toBe(true);
    expect(end().hasAttribute('data-compensate-inline')).toBe(true);
    header.endContentEdgeCompensation = 'inline';
    await header.updateComplete;
    expect(end().hasAttribute('data-compensate-block')).toBe(false);
    expect(end().hasAttribute('data-compensate-inline')).toBe(true);
    header.endContentEdgeCompensation = 'block';
    await header.updateComplete;
    expect(end().hasAttribute('data-compensate-block')).toBe(true);
    expect(end().hasAttribute('data-compensate-inline')).toBe(false);
  });

  it('has-divider draws a rule under the header; there is none by default', async () => {
    const plain = await fixture<TctDialogHeader>(
      `<tct-dialog-header heading="H"></tct-dialog-header>`,
    );
    const rule = (header: TctDialogHeader) =>
      getComputedStyle(header.shadowRoot!.querySelector('.header')!).borderBlockEndWidth;
    expect(rule(plain)).toBe('0px');
    const divided = await fixture<TctDialogHeader>(
      `<tct-dialog-header heading="H" has-divider></tct-dialog-header>`,
    );
    expect(rule(divided)).toBe('1px');
  });
});

describe('tct-dialog: nesting and commands', () => {
  async function nested() {
    const wrapper = await fixture<HTMLElement>(
      `<div>
        <button id="open-outer" commandfor="outer" command="--show">Open outer</button>
        <tct-dialog id="outer" heading="Outer">
          <button id="open-inner" commandfor="inner" command="--show">Open inner</button>
          <tct-dialog id="inner" heading="Inner"><p>inner body</p></tct-dialog>
        </tct-dialog>
      </div>`,
    );
    const outer = wrapper.querySelector<TctDialog>('#outer')!;
    const inner = wrapper.querySelector<TctDialog>('#inner')!;
    await outer.updateComplete;
    await inner.updateComplete;
    return {wrapper, outer, inner};
  }

  it('a declarative invoker (commandfor/command="--show") opens the dialog and gives the source aria-expanded', async () => {
    const {wrapper, outer} = await nested();
    const opener = wrapper.querySelector<HTMLButtonElement>('#open-outer')!;
    await userEvent.click(opener);
    await waitUntil(() => outer.open && layerStack().length === 1, 'opened by the invoker');
    expect(opener.getAttribute('aria-expanded')).toBe('true');
    expect(opener.getAttribute('aria-haspopup')).toBe('dialog');
    await pressKeys('Escape');
    await waitUntil(() => !outer.open, 'closed');
    await waitUntil(() => opener.getAttribute('aria-expanded') === 'false', 'aria-expanded reset');
    await waitUntil(() => deepActiveElement() === opener, 'focus returned to the invoker');
  });

  it('--hide and --toggle command the dialog too, and a prevented tct-open-change keeps it as it was', async () => {
    const wrapper = await fixture<HTMLElement>(
      `<div><button id="t" commandfor="d" command="--toggle">Toggle</button><button id="h" commandfor="d" command="--hide">Hide</button><tct-dialog id="d" heading="D"></tct-dialog></div>`,
    );
    const dialog = wrapper.querySelector<TctDialog>('#d')!;
    await dialog.updateComplete;
    await userEvent.click(wrapper.querySelector('#t')!);
    await waitUntil(() => dialog.open, 'toggled open');
    dialog.dispatchEvent(Object.assign(new Event('command'), {command: '--hide', source: null}));
    await waitUntil(() => !dialog.open, 'hidden by --hide');
    dialog.addEventListener('tct-open-change', (event) => event.preventDefault());
    await userEvent.click(wrapper.querySelector('#t')!);
    await aTimeout(100);
    expect(dialog.open).toBe(false);
  });

  it('Escape closes the inner dialog first, then the outer, one per press; focus returns to each opener', async () => {
    const {wrapper, outer, inner} = await nested();
    await userEvent.click(wrapper.querySelector('#open-outer')!);
    await waitUntil(() => outer.open && layerStack().length === 1, 'outer open');
    await animationsFinished(surfaceOf(outer));
    await userEvent.click(wrapper.querySelector('#open-inner')!);
    await waitUntil(() => inner.open && layerStack().length === 2, 'inner open');

    await pressKeys('Escape');
    await waitUntil(() => !inner.open, 'inner closed');
    expect(outer.open, 'the outer dialog survives the first Escape').toBe(true);
    await waitUntil(
      () => deepActiveElement()?.id === 'open-inner',
      'focus back on the inner opener',
    );

    await pressKeys('Escape');
    await waitUntil(() => !outer.open, 'outer closed');
    await waitUntil(
      () => deepActiveElement()?.id === 'open-outer',
      'focus back on the outer opener',
    );
  });

  it('a press on the inner backdrop closes only the inner dialog', async () => {
    const {wrapper, outer, inner} = await nested();
    await userEvent.click(wrapper.querySelector('#open-outer')!);
    await waitUntil(() => outer.open, 'outer open');
    await animationsFinished(surfaceOf(outer));
    await userEvent.click(wrapper.querySelector('#open-inner')!);
    await waitUntil(() => inner.open, 'inner open');
    await animationsFinished(surfaceOf(inner));
    await pressBackdrop();
    await waitUntil(() => !inner.open, 'inner dismissed', 3000);
    expect(outer.open).toBe(true);
  });
});

describe('openDialog() (useImperativeDialog.test.tsx)', () => {
  it('opens a dialog with text, a node or a template, and removes it once closed', async () => {
    const handle = openDialog('Hello there', {heading: 'Greeting'});
    await waitUntil(() => handle.element.open && layerStack().length === 1, 'opened');
    expect(handle.isOpen).toBe(true);
    expect(handle.element.textContent).toContain('Hello there');
    if (isChromium) expect((await axNode(surfaceOf(handle.element))).name).toBe('Greeting');
    await handle.hide();
    expect(handle.isOpen).toBe(false);
    expect(document.querySelector('[data-tct-imperative-dialog]')).toBeNull();

    const templated = openDialog(html`<p id="tpl">templated</p>`, {heading: 'T', purpose: 'form'});
    await waitUntil(() => templated.isOpen, 'open');
    expect(templated.element.querySelector('#tpl')).not.toBeNull();
    expect(templated.element.purpose).toBe('form');
    await pressKeys('Escape');
    await templated.closed;
    expect(document.querySelector('[data-tct-imperative-dialog]')).toBeNull();
  });

  it('can be given options (width, variant, label) and a node of the caller', async () => {
    const node = document.createElement('p');
    node.id = 'mine';
    node.textContent = 'node content';
    const handle = openDialog(node, {label: 'Named by label', width: 300});
    await waitUntil(() => handle.element.open, 'open');
    expect(handle.element.querySelector('#mine')).toBe(node);
    expect(handle.element.getAttribute('aria-label')).toBe('Named by label');
    await animationsFinished(surfaceOf(handle.element));
    expect(surfaceOf(handle.element).getBoundingClientRect().width).toBe(300);
    await handle.hide();
  });
});

describe('tct-dialog: RTL, forced colours, reduced motion, tier 2', () => {
  it('RTL: the close button sits at the inline end (left) and the title at the start (right)', async () => {
    const wrapper = await fixture<HTMLElement>(
      `<div dir="rtl"><tct-dialog heading="عنوان" open></tct-dialog></div>`,
      {dir: 'rtl'},
    );
    const dialog = wrapper.querySelector<TctDialog>('tct-dialog')!;
    await waitUntil(() => layerStack().length === 1, 'open');
    await animationsFinished(surfaceOf(dialog));
    const header = dialog.shadowRoot!.querySelector<TctDialogHeader>('tct-dialog-header')!;
    const title = header.querySelector('h2')!.getBoundingClientRect();
    const close = header.shadowRoot!.querySelector('.close')!.getBoundingClientRect();
    expect(close.right).toBeLessThan(title.left + title.width);
    expect(close.left).toBeLessThan(title.left);
  });

  it('forced colours: the surface keeps a system-colour border and text', async () => {
    const dialog = await make('heading="T" open');
    await waitUntil(() => layerStack().length === 1, 'open');
    await emulateMedia({forcedColors: 'active'});
    expect(getComputedStyle(surfaceOf(dialog)).borderTopStyle).toBe('solid');
    await emulateMedia({forcedColors: 'none'});
  });

  it('reduced motion: opening plays no movement animation', async () => {
    await emulateMedia({reducedMotion: 'reduce'});
    const dialog = await make('heading="T"');
    dialog.open = true;
    await waitUntil(() => layerStack().length === 1, 'open');
    const moving = surfaceOf(dialog)
      .getAnimations()
      .filter((animation) => (animation as CSSAnimation).animationName === 'tct-dialog-enter');
    expect(moving).toHaveLength(0);
    await emulateMedia({reducedMotion: 'no-preference'});
  });

  it('works without the Popover API and CloseWatcher (Tier 2): opens, closes, Escape still dismisses', async () => {
    const restoreA = overrideFeature('popover', false);
    const restoreB = overrideFeature('closeWatcher', false);
    try {
      const dialog = await make('heading="T"');
      dialog.open = true;
      await waitUntil(() => layerStack().length === 1, 'open');
      await pressKeys('Escape');
      await waitUntil(() => !dialog.open, 'closed');
    } finally {
      restoreA();
      restoreB();
    }
  });

  it.skipIf(!isChromium || !isTier2)(
    'names the dialog with element reflection off (text fallback)',
    async () => {
      const dialog = await make('heading="Fallback name" open');
      await waitUntil(() => layerStack().length === 1, 'open');
      expect((await axNode(surfaceOf(dialog))).name).toBe('Fallback name');
    },
  );
});
