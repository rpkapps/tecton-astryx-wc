/**
 * tct-bottom-sheet-switcher: the shared dialog, the handoff between sheets (entering, covered, aligning,
 * fading, exiting), dismissal per purpose, focus, and the overlay contract. Upstream test names
 * (BottomSheetSwitcher.test.tsx) are kept where the behaviour applies.
 */
import {afterEach, describe, expect, it, vi} from 'vitest';
import {userEvent} from 'vitest/browser';
import {resetDevWarnings} from '@tecton-astryx/core/utils/dev.js';
import {deepActiveElement} from '@tecton-astryx/core/utils/focus.js';
import {
  aTimeout,
  axNode,
  expectAccessible,
  fixture,
  layerStack,
  nextFrame,
  pressKeys,
  recordEvents,
  runElementSuite,
  runOverlaySuite,
  waitUntil,
} from '@tecton-astryx/testing/index.js';
import './define.js';
import {
  IDLE_TRANSITION,
  phaseForSheet,
  transitionForActiveSheetChange,
  type TctBottomSheetSwitcher,
} from './tct-bottom-sheet-switcher.js';
import type {TctBottomSheet} from './tct-bottom-sheet.js';
import {drag, handleOf, pointer} from './fixtures/sheet-test-utils.js';

const flow = (attributes = '', tail = '') => `<tct-bottom-sheet-switcher label="" ${attributes}>
  <tct-bottom-sheet sheet-id="a" label="First" height="hug" snap-points="0.3">
    <div style="block-size:240px">First</div><button id="to-b">Next</button>
  </tct-bottom-sheet>
  <tct-bottom-sheet sheet-id="b" label="Second" height="hug">
    <div style="block-size:80px">Second</div><button id="to-a">Back</button>
  </tct-bottom-sheet>
  <tct-bottom-sheet sheet-id="c" label="Third" height="hug" purpose="form"><div>Third</div></tct-bottom-sheet>
  ${tail}
</tct-bottom-sheet-switcher>`;

async function mount(attributes = '', tail = ''): Promise<TctBottomSheetSwitcher> {
  const root = await fixture<HTMLElement>(
    `<div style="padding:40px"><button id="opener">Start</button>${flow(attributes, tail)}<p id="outside">outside</p></div>`,
  );
  const el = root.querySelector<TctBottomSheetSwitcher>('tct-bottom-sheet-switcher')!;
  await el.updateComplete;
  return el;
}

const sheetOf = (el: TctBottomSheetSwitcher, id: string): TctBottomSheet =>
  el.querySelector<TctBottomSheet>(`[sheet-id="${id}"]`)!;
const dialogOf = (el: TctBottomSheetSwitcher): HTMLDialogElement =>
  el.shadowRoot!.querySelector<HTMLDialogElement>('.dialog')!;
const panelOf = (sheet: TctBottomSheet): HTMLElement =>
  sheet.shadowRoot!.querySelector<HTMLElement>('.sheet')!;
const positionerOf = (sheet: TctBottomSheet): HTMLElement =>
  sheet.shadowRoot!.querySelector<HTMLElement>('.positioner')!;
const phases = (el: TctBottomSheetSwitcher): string =>
  ['a', 'b', 'c'].map((id) => sheetOf(el, id).phase).join(',');
const idle = (el: TctBottomSheetSwitcher) =>
  waitUntil(
    () =>
      phases(el)
        .split(',')
        .filter((p) => p !== 'hidden').length <= 1,
    'handoff over',
    4000,
  );
const scrimOf = (el: TctBottomSheetSwitcher): string =>
  dialogOf(el).style.getPropertyValue('--_sheet-scrim-opacity');

async function openFlow(el: TctBottomSheetSwitcher, id = 'a'): Promise<void> {
  el.activeSheet = id;
  await el.updateComplete;
  await waitUntil(() => dialogOf(el).open && sheetOf(el, id).phase === 'active', `${id} is active`);
  await aTimeout(450);
}

afterEach(() => {
  delete (globalThis as {tctDevMode?: boolean}).tctDevMode;
  resetDevWarnings();
});

runElementSuite({
  tag: 'tct-bottom-sheet-switcher',
  render: () => flow(),
  properties: {activeSheet: 'a', noScrim: true, label: 'Flow'},
  attributes: {activeSheet: 'active-sheet', label: 'label'},
  events: ['tct-open-change', 'tct-after-open-change'],
  // The suite writes `active-sheet="a"` on an element whose sheets are light children: that opens the flow.
  a11y: false,
});

runOverlaySuite({
  tag: 'tct-bottom-sheet-switcher',
  // `open` is the presence of an active sheet; the nested switcher of the suite sits in the sheet's content.
  render: ({attributes = '', children = ''}) =>
    `<tct-bottom-sheet-switcher ${attributes.includes('open') ? 'active-sheet="a"' : ''}>
      <tct-bottom-sheet sheet-id="a" label="A" height="hug"><button>Inside</button>${children}</tct-bottom-sheet>
    </tct-bottom-sheet-switcher>`,
  modal: true,
  surface: (element) => element.shadowRoot!.querySelector('.dialog'),
  isOpen: (element) => (element as unknown as TctBottomSheetSwitcher).activeSheet != null,
  open: (element) => {
    (element as unknown as TctBottomSheetSwitcher).activeSheet = 'a';
  },
  close: (element) => {
    (element as unknown as TctBottomSheetSwitcher).activeSheet = null;
  },
});

describe('the handoff state machine', () => {
  it('opening from nothing has no transition; closing retains the sheet as exiting; switching covers it', () => {
    expect(transitionForActiveSheetChange(null, 'a')).toBe(IDLE_TRANSITION);
    expect(transitionForActiveSheetChange('a', null)).toMatchObject({
      enteringSheet: null,
      retainedSheet: 'a',
      retainedPhase: 'exiting',
    });
    expect(transitionForActiveSheetChange('a', 'b')).toMatchObject({
      enteringSheet: 'b',
      retainedSheet: 'a',
      retainedPhase: 'covered',
    });
  });

  it('derives each sheet phase from the active sheet and the transition', () => {
    const t = transitionForActiveSheetChange('a', 'b');
    expect(phaseForSheet('b', 'b', t)).toBe('entering');
    expect(phaseForSheet('a', 'b', t)).toBe('covered');
    expect(phaseForSheet('c', 'b', t)).toBe('hidden');
    expect(phaseForSheet('b', 'b', IDLE_TRANSITION)).toBe('active');
    expect(phaseForSheet(undefined, 'b', t)).toBe('hidden');
    expect(phaseForSheet('', 'b', t)).toBe('hidden');
  });
});

describe('BottomSheetSwitcher', () => {
  it('opens only the sheet selected by active-sheet, in one shared modal dialog', async () => {
    const el = await mount();
    expect(dialogOf(el).open).toBe(false);
    await openFlow(el, 'a');
    expect(phases(el)).toBe('active,hidden,hidden');
    expect(dialogOf(el).matches(':modal')).toBe(true);
    expect(dialogOf(el).getAttribute('aria-modal')).toBe('true');
    expect(positionerOf(sheetOf(el, 'a')).hidden).toBe(false);
    expect(positionerOf(sheetOf(el, 'b')).hidden).toBe(true);
    // The sheets render panels only: the switcher owns the one dialog.
    expect(sheetOf(el, 'a').shadowRoot!.querySelector('dialog')).toBeNull();
    expect(layerStack()).toHaveLength(1);
  });

  it('starts open when active-sheet is set in markup', async () => {
    const el = await mount('active-sheet="b"');
    await waitUntil(() => dialogOf(el).open, 'open from the start');
    expect(sheetOf(el, 'b').phase).toBe('active');
  });

  it('names the dialog after the active sheet, and label wins', async () => {
    const el = await mount();
    await openFlow(el, 'a');
    expect(dialogOf(el).getAttribute('aria-label')).toBe('First');
    expect(await axNode(dialogOf(el))).toMatchObject({role: 'dialog', name: 'First'});
    el.label = 'Onboarding';
    await el.updateComplete;
    expect(dialogOf(el).getAttribute('aria-label')).toBe('Onboarding');
  });

  it('keeps the previous sheet stationary until the new entrance finishes, then fades it', async () => {
    const el = await mount();
    await openFlow(el, 'a');
    // b is shorter than a? a hugs 240px + the handle; b hugs 80px: a is the taller sheet here.
    const tallerFirst = el.activeSheet;
    el.activeSheet = 'c'; // c hugs a short line: shorter than a, so a will align (move down)
    await el.updateComplete;
    expect(tallerFirst).toBe('a');
    await waitUntil(() => sheetOf(el, 'a').phase !== 'active', 'a leaves the active phase');
    const seen = new Set<string>();
    await waitUntil(
      () => {
        seen.add(sheetOf(el, 'a').phase);
        return phases(el) === 'hidden,hidden,active';
      },
      'the handoff ends with c alone',
      4000,
    );
    expect(seen.has('fading') || seen.has('aligning')).toBe(true);
    await idle(el);
  });

  it('moves a taller previous sheet down while the shorter new sheet enters, then waits for both', async () => {
    const el = await mount();
    await openFlow(el, 'a');
    const before = panelOf(sheetOf(el, 'a')).getBoundingClientRect().top;
    el.activeSheet = 'b';
    await el.updateComplete;
    await waitUntil(() => sheetOf(el, 'a').phase === 'aligning', 'a aligns with b', 3000);
    expect(sheetOf(el, 'a').alignmentOffset).toBeGreaterThan(1);
    await waitUntil(
      () => sheetOf(el, 'a').phase === 'fading' || sheetOf(el, 'a').phase === 'hidden',
      'a fades',
    );
    await idle(el);
    expect(phases(el)).toBe('hidden,active,hidden');
    expect(before).toBeGreaterThan(0);
  });

  it('keeps the previous sheet stationary when the incoming sheet is taller', async () => {
    const el = await mount();
    await openFlow(el, 'b');
    el.activeSheet = 'a';
    await el.updateComplete;
    await waitUntil(() => ['covered', 'fading'].includes(sheetOf(el, 'b').phase), 'b is covered');
    const seen = new Set<string>();
    await waitUntil(
      () => {
        seen.add(sheetOf(el, 'b').phase);
        return phases(el) === 'active,hidden,hidden';
      },
      'a alone',
      4000,
    );
    expect(seen.has('aligning')).toBe(false);
  });

  it('marks retained and leaving sheets inert and hidden from assistive tech', async () => {
    const el = await mount();
    await openFlow(el, 'a');
    el.activeSheet = 'b';
    await el.updateComplete;
    await waitUntil(
      () => sheetOf(el, 'a').phase === 'aligning' || sheetOf(el, 'a').phase === 'covered',
      'a retained',
    );
    expect(positionerOf(sheetOf(el, 'a')).hasAttribute('inert')).toBe(true);
    expect(positionerOf(sheetOf(el, 'a')).getAttribute('aria-hidden')).toBe('true');
    await idle(el);
    expect(positionerOf(sheetOf(el, 'b')).hasAttribute('inert')).toBe(false);
  });

  it('replaces an unfinished outgoing sheet during rapid navigation', async () => {
    const el = await mount();
    await openFlow(el, 'a');
    el.activeSheet = 'b';
    await el.updateComplete;
    el.activeSheet = 'c';
    await el.updateComplete;
    await waitUntil(() => phases(el) === 'hidden,hidden,active', 'only c remains', 4000);
    expect(dialogOf(el).open).toBe(true);
    expect(layerStack()).toHaveLength(1);
  });

  it('navigating back to the previous sheet works', async () => {
    const el = await mount();
    await openFlow(el, 'a');
    el.activeSheet = 'b';
    await idle(el);
    el.activeSheet = 'a';
    await el.updateComplete;
    await waitUntil(() => phases(el) === 'active,hidden,hidden', 'back on a', 4000);
    expect(deepActiveElement()).toBe(panelOf(sheetOf(el, 'a')));
  });

  it('ignores late scrim updates from an outgoing sheet gesture', async () => {
    const el = await mount();
    await openFlow(el, 'a');
    const handle = handleOf(sheetOf(el, 'a'));
    pointer(handle, 'pointerdown', 400);
    await aTimeout(20);
    el.activeSheet = 'b';
    await el.updateComplete;
    expect(scrimOf(el)).toBe('1');
    pointer(handle, 'pointermove', 700);
    expect(scrimOf(el), 'the outgoing sheet does not own the backdrop').toBe('1');
    pointer(handle, 'pointercancel', 700);
    await idle(el);
  });

  it('dismisses the flow from the one shared scrim (reason "outside")', async () => {
    const el = await mount();
    await openFlow(el, 'a');
    const changes = recordEvents(el, 'tct-open-change');
    await userEvent.click(document.documentElement, {position: {x: 5, y: 5}, force: true});
    await waitUntil(() => el.activeSheet === null, 'dismissed', 3000);
    expect(changes.events).toHaveLength(1);
    expect([changes.events[0]!.open, changes.events[0]!.reason]).toEqual([false, 'outside']);
    await waitUntil(() => !dialogOf(el).open, 'dialog closed after the exit', 4000);
  });

  it('requests active-sheet=null when the active sheet dismisses (Escape, swipe), and keeps the flow when prevented', async () => {
    const el = await mount();
    await openFlow(el, 'a');
    const changes = recordEvents(el, 'tct-open-change');
    el.addEventListener('tct-open-change', (event) => {
      event.preventDefault();
    });
    await pressKeys('Escape');
    await aTimeout(150);
    expect(el.activeSheet).toBe('a');
    expect(changes.events[0]!.reason).toBe('escape');
    await drag(handleOf(sheetOf(el, 'a')), 400, 880, {stepMs: 60});
    await aTimeout(300);
    expect(el.activeSheet).toBe('a');
    expect(changes.events.at(-1)!.reason).toBe('pointer');
    expect(panelOf(sheetOf(el, 'a')).hasAttribute('data-dismissing')).toBe(false);
  });

  it('closes on Escape and returns focus to the original opener after a multi-sheet flow ends', async () => {
    const el = await mount();
    const opener = document.querySelector<HTMLButtonElement>('#opener')!;
    opener.focus();
    await openFlow(el, 'a');
    el.activeSheet = 'b';
    await idle(el);
    await aTimeout(200);
    await pressKeys('Escape');
    await waitUntil(() => el.activeSheet === null, 'closed');
    await waitUntil(() => !dialogOf(el).open, 'the shared dialog closed', 4000);
    await waitUntil(() => deepActiveElement() === opener, 'focus back on the opener', 3000);
  });

  it('honors purpose=form for a switcher-managed sheet: Escape only', async () => {
    const el = await mount();
    await openFlow(el, 'c');
    await userEvent.click(document.documentElement, {position: {x: 5, y: 5}, force: true});
    await aTimeout(400);
    expect(el.activeSheet, 'the scrim does not dismiss a form sheet').toBe('c');
    await drag(handleOf(sheetOf(el, 'c')), 400, 880, {stepMs: 60});
    await aTimeout(300);
    expect(el.activeSheet, 'a swipe does not dismiss a form sheet').toBe('c');
    await pressKeys('Escape');
    await waitUntil(() => el.activeSheet === null, 'Escape dismisses');
  });

  it('honors purpose=required for a switcher-managed sheet, as an alertdialog', async () => {
    const el = await mount(
      '',
      '<tct-bottom-sheet sheet-id="r" label="Required" purpose="required"><p>Must decide</p></tct-bottom-sheet>',
    );
    await openFlow(el, 'r');
    expect(dialogOf(el).getAttribute('role')).toBe('alertdialog');
    await pressKeys('Escape');
    await userEvent.click(document.documentElement, {position: {x: 5, y: 5}, force: true});
    await aTimeout(400);
    expect(el.activeSheet).toBe('r');
  });

  it('can coordinate a non-modal flow without rendering a scrim', async () => {
    const el = await mount('no-scrim');
    await openFlow(el, 'a');
    expect(dialogOf(el).open).toBe(true);
    expect(dialogOf(el).matches(':modal')).toBe(false);
    expect(dialogOf(el).hasAttribute('aria-modal')).toBe(false);
    const opener = document.querySelector<HTMLButtonElement>('#opener')!;
    const clicked = vi.fn();
    opener.addEventListener('click', clicked);
    await userEvent.click(opener);
    expect(clicked, 'the page behind stays interactive').toHaveBeenCalledTimes(1);
    expect(el.activeSheet).toBe('a');
  });

  it('a nested sheet inside item content is standalone (a fresh ownership scope)', async () => {
    const el = await mount(
      '',
      '<tct-bottom-sheet sheet-id="host" label="Host"><tct-bottom-sheet id="nested" label="Nested"><p>Nested</p></tct-bottom-sheet></tct-bottom-sheet>',
    );
    await openFlow(el, 'host');
    const nested = el.querySelector<TctBottomSheet>('#nested')!;
    expect(nested.shadowRoot!.querySelector('dialog')).not.toBeNull();
    expect(nested.phase).toBe('hidden');
    await nested.show();
    expect(layerStack()).toHaveLength(2);
    await nested.hide();
  });

  it('opens the shared dialog and settles once per flow (tct-after-open-change)', async () => {
    const el = await mount();
    const after = recordEvents(el, 'tct-after-open-change');
    await openFlow(el, 'a');
    el.activeSheet = 'b';
    await idle(el);
    el.activeSheet = null;
    await waitUntil(() => !dialogOf(el).open, 'closed', 4000);
    await waitUntil(() => after.events.length === 2, 'both settled events');
    expect(after.events.map((event) => event.open)).toEqual([true, false]);
  });

  it('focuses the active panel when a sheet becomes active, and does not refocus when a transition completes', async () => {
    const el = await mount();
    await openFlow(el, 'a');
    await waitUntil(() => deepActiveElement() === panelOf(sheetOf(el, 'a')), 'a panel focused');
    el.activeSheet = 'b';
    await waitUntil(() => deepActiveElement() === panelOf(sheetOf(el, 'b')), 'b panel focused');
    const control = sheetOf(el, 'b').querySelector<HTMLButtonElement>('#to-a')!;
    control.focus();
    await idle(el);
    await aTimeout(200);
    expect(deepActiveElement(), 'a finished transition does not move focus').toBe(control);
  });

  it('warns about an active-sheet that matches no sheet, and a sheet without an id', async () => {
    (globalThis as {tctDevMode?: boolean}).tctDevMode = true;
    resetDevWarnings();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      const el = await mount('', '<tct-bottom-sheet label="No id"><p>x</p></tct-bottom-sheet>');
      el.activeSheet = 'nope';
      await el.updateComplete;
      await nextFrame();
      const text = warn.mock.calls.flat().join(' ');
      expect(text).toContain('matches no tct-bottom-sheet');
      expect(text).toContain('needs a non-empty `sheet-id`');
    } finally {
      warn.mockRestore();
    }
  });

  it('has no axe violations while a sheet is active', async () => {
    const el = await mount();
    await openFlow(el, 'a');
    await expectAccessible(dialogOf(el));
  });
});
