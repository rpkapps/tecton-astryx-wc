/**
 * tct-bottom-sheet in its environment: the on-screen keyboard (tall sheets), a11y, right-to-left,
 * forced colours, reduced motion, i18n, and adaptive presentation (a popover on a fine pointer, a bottom
 * sheet on a compact touch device). Upstream test names (BottomSheet.test.tsx `mobile keyboard`) are kept
 * where the behaviour applies.
 */
import {html, LitElement} from 'lit';
import {afterEach, describe, expect, it} from 'vitest';
import {AdaptivePresentationController} from '@tecton-astryx/core/controllers/adaptive-presentation.js';
import {deepActiveElement} from '@tecton-astryx/core/utils/focus.js';
import {
  aTimeout,
  emulateMedia,
  expectAccessible,
  fixture,
  nextFrame,
  pressKeys,
  waitUntil,
} from '@tecton-astryx/testing/index.js';
import '../popover/define.js';
import './define.js';
import {
  findTextEntryControl,
  isTextEntryControl,
  keyboardInset,
  revealDelta,
} from './sheet-keyboard.js';
import type {TctBottomSheet} from './tct-bottom-sheet.js';
import {
  bodyOf,
  dialogOf,
  drag,
  handleOf,
  openSheet,
  pointer,
  settled,
  sheetOf,
} from './sheet-test-utils.js';

const form = `<form style="display:grid;gap:60px;padding:16px">
  ${Array.from({length: 8}, (_, i) => `<input id="f${i}" aria-label="Field ${i}" style="block-size:40px" />`).join('')}
</form>`;

async function mount(attributes = '', content = '<p>Content</p>'): Promise<TctBottomSheet> {
  const root = await fixture<HTMLElement>(
    `<div><button id="opener">Open</button><tct-bottom-sheet label="Comment" ${attributes}>${content}</tct-bottom-sheet></div>`,
  );
  const el = root.querySelector<TctBottomSheet>('tct-bottom-sheet')!;
  await el.updateComplete;
  return el;
}

/** Replaces `window.visualViewport` with a controllable one: the on-screen keyboard is `layout - height`. */
function stubViewport(): {
  keyboard: (px: number) => void;
  restore: () => void;
} {
  const original = Object.getOwnPropertyDescriptor(window, 'visualViewport');
  const fake = Object.assign(new EventTarget(), {
    height: window.innerHeight,
    width: window.innerWidth,
    offsetTop: 0,
    offsetLeft: 0,
    pageTop: 0,
    pageLeft: 0,
    scale: 1,
  });
  Object.defineProperty(window, 'visualViewport', {configurable: true, value: fake});
  return {
    keyboard(px) {
      fake.height = window.innerHeight - px;
      fake.dispatchEvent(new Event('resize'));
    },
    restore() {
      if (original) Object.defineProperty(window, 'visualViewport', original);
      else delete (window as {visualViewport?: unknown}).visualViewport;
    },
  };
}

let stub: ReturnType<typeof stubViewport> | undefined;
afterEach(() => {
  stub?.restore();
  stub = undefined;
});

describe('keyboard geometry', () => {
  it('measures the part of the layout viewport the keyboard covers', () => {
    expect(keyboardInset(800, {height: 500, offsetTop: 0})).toBe(300);
    expect(keyboardInset(800, {height: 480, offsetTop: 20})).toBe(300);
    expect(keyboardInset(800, {height: 800, offsetTop: 0})).toBe(0);
    expect(keyboardInset(800, {height: 900, offsetTop: 0})).toBe(0);
    expect(keyboardInset(800, null)).toBe(0);
  });

  it('scrolls a control up just far enough to clear the keyboard, never past its own top', () => {
    const body = {top: 100, bottom: 700};
    expect(revealDelta({top: 400, bottom: 440}, body, 500, 48)).toBe(0);
    expect(revealDelta({top: 480, bottom: 520}, body, 500, 48)).toBe(68);
    // A control taller than the free space: its top stays in view.
    expect(revealDelta({top: 150, bottom: 900}, body, 500, 48)).toBe(50);
    // Above the body: scroll back up to it.
    expect(revealDelta({top: 60, bottom: 100}, body, 500, 48)).toBe(-40);
  });

  it('recognizes text-entry controls, through a label', async () => {
    const root = await fixture<HTMLElement>(
      `<div><label id="l">Name <input id="text" /></label><input id="cb" type="checkbox" /><input id="ro" readonly /><textarea id="ta"></textarea><div id="ce" contenteditable="true"></div><button id="b">b</button></div>`,
    );
    const q = (id: string) => root.querySelector<HTMLElement>(`#${id}`);
    expect(isTextEntryControl(q('text'))).toBe(true);
    expect(isTextEntryControl(q('ta'))).toBe(true);
    expect(isTextEntryControl(q('ce'))).toBe(true);
    expect(isTextEntryControl(q('cb'))).toBe(false);
    expect(isTextEntryControl(q('ro'))).toBe(false);
    expect(isTextEntryControl(q('b'))).toBe(false);
    expect(findTextEntryControl(q('l'))).toBe(q('text'));
    expect(findTextEntryControl(document)).toBeNull();
  });
});

describe('mobile keyboard', () => {
  it('keeps Tall geometry fixed while extending and cleaning up its internal scroll range', async () => {
    stub = stubViewport();
    const el = await mount('height="tall"', form);
    await openSheet(el);
    const top = sheetOf(el).getBoundingClientRect().top;
    const field = el.querySelector<HTMLInputElement>('#f7')!;
    field.focus();
    stub.keyboard(300);
    await waitUntil(
      () => sheetOf(el).style.getPropertyValue('--_sheet-keyboard-inset') === '300px',
      'inset',
    );
    expect(sheetOf(el).getBoundingClientRect().top, 'the sheet itself never moves').toBe(top);
    const spacer = getComputedStyle(bodyOf(el), '::after');
    expect(spacer.blockSize).toBe('300px');
    field.blur();
    await waitUntil(
      () => sheetOf(el).style.getPropertyValue('--_sheet-keyboard-inset') === '',
      'cleaned up',
    );
  });

  it('scrolls a focused Tall control above the keyboard', async () => {
    stub = stubViewport();
    const el = await mount('height="tall"', form);
    await openSheet(el);
    const field = el.querySelector<HTMLInputElement>('#f7')!;
    field.focus();
    stub.keyboard(300);
    await waitUntil(
      () => field.getBoundingClientRect().bottom <= window.innerHeight - 300 - 48 + 1,
      'the field is above the keyboard with clearance',
    );
    expect(field.getBoundingClientRect().top).toBeGreaterThan(
      bodyOf(el).getBoundingClientRect().top,
    );
  });

  it('re-reveals a focused Tall control when the keyboard grows', async () => {
    stub = stubViewport();
    const el = await mount('height="tall"', form);
    await openSheet(el);
    const field = el.querySelector<HTMLInputElement>('#f7')!;
    field.focus();
    stub.keyboard(200);
    await waitUntil(
      () => field.getBoundingClientRect().bottom <= window.innerHeight - 200 - 48 + 1,
      'above 200',
    );
    stub.keyboard(380);
    await waitUntil(
      () => field.getBoundingClientRect().bottom <= window.innerHeight - 380 - 48 + 1,
      'above 380',
    );
  });

  it('does not add clearance or scroll when the viewport is unobstructed', async () => {
    stub = stubViewport();
    const el = await mount('height="tall"', form);
    await openSheet(el);
    const field = el.querySelector<HTMLInputElement>('#f7')!;
    const before = bodyOf(el).scrollTop;
    field.focus();
    await aTimeout(120);
    expect(sheetOf(el).style.getPropertyValue('--_sheet-keyboard-inset')).toBe('0px');
    expect(bodyOf(el).scrollTop).toBe(before);
  });

  it('does not accommodate the keyboard at a shorter Tall stop', async () => {
    stub = stubViewport();
    const el = await mount('height="tall" snap-points="0.5"', form);
    await openSheet(el);
    el.snapTo(1);
    await settled(el);
    const field = el.querySelector<HTMLInputElement>('#f0')!;
    field.focus();
    stub.keyboard(300);
    await aTimeout(120);
    expect(sheetOf(el).style.getPropertyValue('--_sheet-keyboard-inset')).toBe('');
  });

  it('never accommodates the keyboard for hug, capped, numeric or CSS-length heights', async () => {
    for (const height of ['hug', 'capped', '500', '70dvh']) {
      stub?.restore();
      stub = stubViewport();
      const el = await mount(`height="${height}"`, form);
      await openSheet(el);
      el.querySelector<HTMLInputElement>('#f0')!.focus();
      stub.keyboard(300);
      await aTimeout(100);
      expect(sheetOf(el).style.getPropertyValue('--_sheet-keyboard-inset'), height).toBe('');
      await el.hide();
    }
  });

  it('blurs the focused Tall field when the sheet starts to travel, and drops the inset', async () => {
    stub = stubViewport();
    const el = await mount('height="tall" snap-points="0.5"', form);
    await openSheet(el);
    const field = el.querySelector<HTMLInputElement>('#f0')!;
    field.focus();
    stub.keyboard(300);
    await waitUntil(
      () => sheetOf(el).style.getPropertyValue('--_sheet-keyboard-inset') === '300px',
      'inset',
    );
    pointer(handleOf(el), 'pointerdown', 500);
    await aTimeout(20);
    pointer(handleOf(el), 'pointermove', 560);
    expect(deepActiveElement()).not.toBe(field);
    expect(sheetOf(el).style.getPropertyValue('--_sheet-keyboard-inset')).toBe('');
    pointer(handleOf(el), 'pointercancel', 560);
  });

  it('leaves the page alone behind a non-modal sheet, and desktop focus unchanged', async () => {
    stub = stubViewport();
    const el = await mount('height="capped" no-scrim', form);
    await openSheet(el);
    const before = document.scrollingElement!.scrollTop;
    el.querySelector<HTMLInputElement>('#f0')!.focus();
    await aTimeout(100);
    expect(document.scrollingElement!.scrollTop).toBe(before);
  });
});

describe('a11y', () => {
  it('has no axe violations open, with a scrolling body', async () => {
    const el = await mount('height="capped"', '<div style="block-size:2000px">long</div>');
    await openSheet(el);
    await expectAccessible(dialogOf(el));
  });

  it('a scrolling body with nothing focusable is a named tab stop; fitting content adds none', async () => {
    const overflowing = await mount(
      'height="capped"',
      '<div style="block-size:2000px">long text</div>',
    );
    await openSheet(overflowing);
    await waitUntil(() => bodyOf(overflowing).getAttribute('tabindex') === '0', 'tab stop');
    expect(bodyOf(overflowing).getAttribute('role')).toBe('region');
    expect(bodyOf(overflowing).getAttribute('aria-label')).toBe('Comment');
    await overflowing.hide();
    const fitting = await mount('height="capped"', '<p>short</p>');
    await openSheet(fitting);
    await aTimeout(60);
    expect(bodyOf(fitting).hasAttribute('tabindex')).toBe(false);
  });

  it('a scrolling body with focusable content is not itself a tab stop', async () => {
    const el = await mount(
      'height="capped"',
      '<button id="b">Only</button><div style="block-size:2000px"></div>',
    );
    await openSheet(el);
    await aTimeout(60);
    expect(bodyOf(el).hasAttribute('tabindex')).toBe(false);
  });

  it('exposes the sheet as a modal dialog with the rest of the page inert', async () => {
    const el = await mount();
    await openSheet(el);
    const opener = document.querySelector<HTMLElement>('#opener')!;
    expect(dialogOf(el).matches(':modal')).toBe(true);
    opener.focus();
    expect(deepActiveElement(), 'focus cannot move to the inert page').not.toBe(opener);
  });

  it('keeps focus in a modal sheet that has no tabbable controls: the page behind never gets it', async () => {
    const el = await mount('', '<p>Only text</p>');
    await openSheet(el);
    await waitUntil(() => deepActiveElement() === sheetOf(el), 'the panel has focus');
    await pressKeys('Tab');
    await pressKeys('Tab');
    expect(deepActiveElement()).not.toBe(document.querySelector('#opener'));
  });
});

describe('RTL', () => {
  it('mirrors nothing on the block axis, keeps the sheet centred, and localizes the handle value', async () => {
    const root = await fixture<HTMLElement>(
      `<div dir="rtl" lang="ar-SA"><tct-bottom-sheet label="عوامل التصفية" height="tall" snap-points="0.5"><p>محتوى</p></tct-bottom-sheet></div>`,
    );
    const el = root.querySelector<TctBottomSheet>('tct-bottom-sheet')!;
    await el.updateComplete;
    await openSheet(el);
    const box = sheetOf(el).getBoundingClientRect();
    const positioner = el.shadowRoot!.querySelector('.positioner')!.getBoundingClientRect();
    expect(Math.abs(box.left - positioner.left - (positioner.right - box.right))).toBeLessThan(2);
    await waitUntil(
      () => handleOf(el).getAttribute('aria-label') === 'مقبض تغيير الحجم',
      'Arabic handle label',
    );
    // Arabic-Indic digits, not "92%".
    expect(handleOf(el).getAttribute('aria-valuetext')).not.toMatch(/[0-9]/);
    // The keys are block-axis keys and do not mirror.
    handleOf(el).focus();
    await pressKeys('ArrowDown');
    await settled(el);
    expect(el.snapIndex).toBe(1);
  });
});

describe('forced colours', () => {
  it('keeps the panel bordered, the handle visible, and the focus ring', async () => {
    const restore = await emulateMedia({forcedColors: 'active'});
    try {
      const el = await mount('height="capped" snap-points="0.5"', '<button>Inside</button>');
      await openSheet(el);
      const style = getComputedStyle(sheetOf(el));
      expect(parseFloat(style.borderTopWidth)).toBeGreaterThan(0);
      expect(style.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
      expect(getComputedStyle(el.shadowRoot!.querySelector('.pill')!).backgroundColor).not.toBe(
        'rgba(0, 0, 0, 0)',
      );
      await pressKeys('Tab');
      expect(deepActiveElement()).toBe(handleOf(el));
      expect(getComputedStyle(handleOf(el)).outlineStyle).not.toBe('none');
    } finally {
      await restore();
    }
  });
});

describe('reduced motion', () => {
  it('opens and closes without a movement animation', async () => {
    const restore = await emulateMedia({reducedMotion: 'reduce'});
    try {
      const el = await mount('height="capped" snap-points="0.5"');
      await el.show();
      const moving = () =>
        dialogOf(el)
          .getAnimations({subtree: true})
          .filter((animation) => {
            const transition = animation as CSSTransition;
            return transition.transitionProperty === 'translate';
          });
      expect(moving()).toHaveLength(0);
      el.snapTo(1);
      await nextFrame();
      expect(moving(), 'a stop change does not slide').toHaveLength(0);
      const hidden = el.hide();
      await nextFrame();
      expect(moving()).toHaveLength(0);
      await hidden;
      expect(el.open).toBe(false);
    } finally {
      await restore();
    }
  });

  it('a settle under reduced motion reconciles at once (no transitionend is coming)', async () => {
    const restore = await emulateMedia({reducedMotion: 'reduce'});
    try {
      const el = await mount('snap-points="0.5"', '<div style="block-size:2000px">long</div>');
      await openSheet(el);
      el.snapTo(1);
      await nextFrame();
      await waitUntil(
        () => sheetOf(el).hasAttribute('data-pinned'),
        'pinned without waiting for a transition',
      );
    } finally {
      await restore();
    }
  });
});

describe('i18n', () => {
  it('shows the German handle label, and handle-label wins', async () => {
    const root = await fixture<HTMLElement>(
      `<div lang="de-DE"><tct-bottom-sheet label="Filter" height="tall" snap-points="0.5"><p>Inhalt</p></tct-bottom-sheet></div>`,
    );
    const el = root.querySelector<TctBottomSheet>('tct-bottom-sheet')!;
    await el.updateComplete;
    await openSheet(el);
    await waitUntil(
      () => handleOf(el).getAttribute('aria-label') === 'Ziehpunkt zum Anpassen',
      'de-DE catalog',
    );
    el.handleLabel = 'Höhe';
    await el.updateComplete;
    expect(handleOf(el).getAttribute('aria-label')).toBe('Höhe');
    expect(handleOf(el).getAttribute('aria-valuetext')).toMatch(/\d+\s?%/);
  });
});

describe('adaptive presentation', () => {
  /** A consumer host: the same content in a popover on a fine pointer, in a bottom sheet on compact touch. */
  class AdaptiveHost extends LitElement {
    readonly adaptive = new AdaptivePresentationController(this, () => 'adaptive');
    protected override render() {
      return this.adaptive.resolved === 'bottom-sheet'
        ? html`<tct-bottom-sheet label="Options"><p>Options</p></tct-bottom-sheet>`
        : html`<tct-popover label="Options"
            ><button>Options</button>
            <div slot="content">Options</div></tct-popover
          >`;
    }
  }
  if (!customElements.get('tct-adaptive-demo-host')) {
    customElements.define('tct-adaptive-demo-host', AdaptiveHost);
  }

  it('switches under an emulated compact touch device, and back', async () => {
    const original = window.matchMedia.bind(window);
    const lists = new Set<EventTarget & {matches: boolean}>();
    let compact = false;
    window.matchMedia = (query: string): MediaQueryList => {
      if (query !== '(max-width: 768px) and (pointer: coarse)') return original(query);
      const list = Object.assign(new EventTarget(), {media: query}) as unknown as EventTarget & {
        matches: boolean;
      };
      Object.defineProperty(list, 'matches', {get: () => compact});
      lists.add(list);
      return list as unknown as MediaQueryList;
    };
    try {
      const root = await fixture<HTMLElement>('<tct-adaptive-demo-host></tct-adaptive-demo-host>');
      const host = root as unknown as AdaptiveHost;
      await host.updateComplete;
      expect(host.shadowRoot!.querySelector('tct-popover')).not.toBeNull();
      expect(host.shadowRoot!.querySelector('tct-bottom-sheet')).toBeNull();
      compact = true;
      for (const list of lists)
        list.dispatchEvent(Object.assign(new Event('change'), {matches: compact}));
      await host.updateComplete;
      expect(host.shadowRoot!.querySelector('tct-bottom-sheet')).not.toBeNull();
      expect(host.shadowRoot!.querySelector('tct-popover')).toBeNull();
      compact = false;
      for (const list of lists)
        list.dispatchEvent(Object.assign(new Event('change'), {matches: compact}));
      await host.updateComplete;
      expect(host.shadowRoot!.querySelector('tct-popover')).not.toBeNull();
    } finally {
      window.matchMedia = original;
    }
  });
});

describe('drag with a real mouse gesture', () => {
  it('a slow drag of the handle by a few px is a drag, not a tap (no cycle)', async () => {
    const el = await mount('height="tall" snap-points="0.5"');
    await openSheet(el);
    await drag(handleOf(el), 300, 312, {stepMs: 60});
    await settled(el);
    // A 12px travel that stays short of the next stop springs back to the stop it left.
    expect(el.snapIndex).toBe(0);
  });
});
