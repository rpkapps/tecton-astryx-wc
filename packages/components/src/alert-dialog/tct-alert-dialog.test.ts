/**
 * tct-alert-dialog: element contract, overlay contract (modal: Escape cancels one layer, focus returns,
 * a moved dialog stays modal, a toast action stays clickable), the keyboard table, purposes (not light
 * dismissable), responsive actions, a11y, RTL, forced colours, reduced motion and i18n. Upstream test
 * names are kept where the behaviour applies.
 */
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {userEvent} from 'vitest/browser';
import {deepActiveElement} from '@tecton-wc/core/utils/focus.js';
import {
  aTimeout,
  animationsFinished,
  axNode,
  emulateMedia,
  expectAccessible,
  expectEventFlags,
  fixture,
  layerStack,
  nextFrame,
  pressKeys,
  recordEvents,
  runElementSuite,
  runKeyboardSuite,
  runOverlaySuite,
  waitUntil,
} from '@tecton-wc/testing/index.js';
import '../popover/define.js';
import './define.js';
import type {TctButton} from '../button/tct-button.js';
import type {TctAlertDialog} from './tct-alert-dialog.js';

// `import.meta.glob` keeps parity.json (not part of the TypeScript project) out of the program.
const parity = Object.values(
  import.meta.glob<{
    entries: {'core.alert-dialog': {keyboard: {keys: string; action: string; when?: string}[]}};
  }>('./parity.json', {eager: true, import: 'default'}),
)[0]!;

const alert = (attributes = '', children = '') =>
  `<tct-alert-dialog heading="Delete item?" description="This action cannot be undone." action-label="Delete" ${attributes}>${children}</tct-alert-dialog>`;

async function mount(attributes = '', children = ''): Promise<TctAlertDialog> {
  const root = await fixture<HTMLElement>(
    `<div style="padding:40px"><button id="trigger">Delete</button>${alert(attributes, children)}<p id="outside">outside</p></div>`,
  );
  const el = root.querySelector<TctAlertDialog>('tct-alert-dialog')!;
  await el.updateComplete;
  return el;
}

const innerDialog = (el: TctAlertDialog) => el.shadowRoot!.querySelector('tct-dialog')!;
const surface = (el: TctAlertDialog): HTMLDialogElement =>
  innerDialog(el).shadowRoot!.querySelector<HTMLDialogElement>('dialog')!;
const buttons = (el: TctAlertDialog): TctButton[] => [
  ...el.shadowRoot!.querySelectorAll<TctButton>('.footer tct-button'),
];
const button = (el: TctAlertDialog, label: string): TctButton =>
  buttons(el).find((candidate) => candidate.label === label)!;
const isFocused = (element: Element): boolean => element.matches(':focus');

/** Switches the current test to the narrow layout. */
function narrowHere(): () => void {
  restoreScreen?.();
  restoreScreen = smallScreen(true);
  return () => {
    restoreScreen?.();
    restoreScreen = smallScreen(false);
  };
}

async function openIt(el: TctAlertDialog): Promise<void> {
  await el.show();
  await animationsFinished(surface(el));
}

/**
 * Answers the small-screen query (`(max-width: 640px)`) with `narrow`; every other query is the browser's.
 * The test page is a phone-sized frame, so the wide layout is stubbed too. (CDP emulation cannot be undone.)
 */
function smallScreen(narrow: boolean): () => void {
  const original = window.matchMedia.bind(window);
  window.matchMedia = (query: string): MediaQueryList => {
    if (query !== '(max-width: 640px)') return original(query);
    return Object.assign(new EventTarget(), {
      matches: narrow,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
    });
  };
  return () => {
    window.matchMedia = original;
  };
}

let restoreScreen: (() => void) | undefined;
beforeEach(() => {
  restoreScreen = smallScreen(false);
});
afterEach(() => {
  restoreScreen?.();
  restoreScreen = undefined;
});

runElementSuite({
  tag: 'tct-alert-dialog',
  render: () => alert(),
  properties: {
    inline: true,
    heading: 'Other?',
    description: 'Other consequence.',
    cancelLabel: 'Keep',
    actionLabel: 'Remove',
    actionVariant: 'primary',
    actionLoading: true,
    width: '320',
  },
  attributes: {
    heading: 'heading',
    description: 'description',
    cancelLabel: 'cancel-label',
    actionLabel: 'action-label',
    actionVariant: 'action-variant',
    width: 'width',
  },
  events: ['tct-open-change', 'tct-after-open-change', 'tct-action'],
});

runOverlaySuite({
  tag: 'tct-alert-dialog',
  // The default slot carries the nested alert dialog of the suite. Focus return is tested below (`focus`).
  render: ({attributes = '', children = ''}) => alert(attributes, children),
  modal: true,
  surface: (element) => element.shadowRoot!.querySelector('tct-dialog'),
});

describe('AlertDialog', () => {
  it('renders with alertdialog role', async () => {
    const el = await mount('open');
    await animationsFinished(surface(el));
    expect(surface(el).getAttribute('role')).toBe('alertdialog');
    expect((await axNode(surface(el))).role).toBe('alertdialog');
  });

  it('renders title and description', async () => {
    const el = await mount('open');
    expect(el.shadowRoot!.querySelector('tct-heading')!.textContent).toBe('Delete item?');
    expect(el.shadowRoot!.querySelector('tct-text')!.textContent).toBe(
      'This action cannot be undone.',
    );
  });

  it('links title via aria-labelledby, and the dialog is named by it', async () => {
    const el = await mount('open');
    await animationsFinished(surface(el));
    expect(await axNode(surface(el))).toMatchObject({role: 'alertdialog', name: 'Delete item?'});
  });

  it('links description via aria-describedby', async () => {
    const el = await mount('open');
    await animationsFinished(surface(el));
    expect(await axNode(surface(el))).toMatchObject({
      description: 'This action cannot be undone.',
    });
  });

  it('renders cancel and action buttons', async () => {
    const el = await mount('open');
    expect(buttons(el).map((candidate) => candidate.label)).toEqual(['Cancel', 'Delete']);
  });

  it('uses custom cancel label', async () => {
    const el = await mount('open cancel-label="Keep it"');
    expect(buttons(el)[0]!.label).toBe('Keep it');
  });

  it('defaults cancel label to Cancel', async () => {
    const el = await mount();
    expect(buttons(el)[0]!.label).toBe('Cancel');
  });

  it('calls tct-open-change(false) when cancel is clicked, and closes', async () => {
    const el = await mount('open');
    await animationsFinished(surface(el));
    const changes = recordEvents(el, 'tct-open-change');
    await userEvent.click(button(el, 'Cancel'));
    await waitUntil(() => !el.open, 'closed by Cancel');
    expect(changes.events).toHaveLength(1);
    expect([changes.events[0]!.open, changes.events[0]!.reason]).toEqual([false, 'close-button']);
  });

  it('calls tct-action when action is clicked, and does not close', async () => {
    const el = await mount('open');
    await animationsFinished(surface(el));
    const actions = recordEvents(el, 'tct-action');
    const changes = recordEvents(el, 'tct-open-change');
    await userEvent.click(button(el, 'Delete'));
    await aTimeout(80);
    expect(actions.events).toHaveLength(1);
    expect(changes.events).toHaveLength(0);
    expect(el.open).toBe(true);
    expectEventFlags(actions.events[0]!, {bubbles: true, composed: true, cancelable: false});
  });

  it('does not render the dialog when closed', async () => {
    const el = await mount();
    expect(surface(el).open).toBe(false);
    expect(layerStack()).toHaveLength(0);
  });

  it('accepts custom width', async () => {
    const el = await mount('open width="320"');
    await animationsFinished(surface(el));
    expect(Math.round(surface(el).getBoundingClientRect().width)).toBeLessThanOrEqual(320);
    expect(Math.round(surface(el).getBoundingClientRect().width)).toBeGreaterThan(280);
  });

  it('is a modal: the page behind is inert and the dialog reports aria-modal', async () => {
    const el = await mount('open');
    await animationsFinished(surface(el));
    expect(surface(el).matches(':modal')).toBe(true);
    expect(surface(el).getAttribute('aria-modal')).toBe('true');
  });
});

describe('purposes: not light-dismissable', () => {
  it('a press on the backdrop does not dismiss it', async () => {
    const el = await mount('open');
    await animationsFinished(surface(el));
    const changes = recordEvents(el, 'tct-open-change');
    await userEvent.click(document.documentElement, {position: {x: 5, y: 5}, force: true});
    await aTimeout(500);
    expect(el.open).toBe(true);
    expect(changes.events).toHaveLength(0);
  });

  it('does not show a close button (the dialog is required)', async () => {
    const el = await mount('open');
    expect(innerDialog(el).shadowRoot!.querySelector('tct-dialog-header')).toBeNull();
  });

  it('Escape cancels: tct-open-change with reason "escape", cancelable, and it closes', async () => {
    const el = await mount('open');
    await animationsFinished(surface(el));
    const changes = recordEvents(el, 'tct-open-change');
    await pressKeys('Escape');
    await waitUntil(() => !el.open, 'closed by Escape');
    expect(changes.events).toHaveLength(1);
    expect(changes.events[0]!.reason).toBe('escape');
    expectEventFlags(changes.events[0]!, {bubbles: true, composed: true, cancelable: true});
  });

  it('preventing the Escape intent keeps it open', async () => {
    const el = await mount('open');
    await animationsFinished(surface(el));
    el.addEventListener('tct-open-change', (event) => {
      event.preventDefault();
    });
    await pressKeys('Escape');
    await aTimeout(120);
    expect(el.open).toBe(true);
  });

  it('does not call onAction on Escape', async () => {
    const el = await mount('open');
    await animationsFinished(surface(el));
    const actions = recordEvents(el, 'tct-action');
    await pressKeys('Escape');
    await waitUntil(() => !el.open, 'closed');
    expect(actions.events).toHaveLength(0);
  });

  it('is an alertdialog whose Escape policy comes from its own layer, not a page-level listener', async () => {
    const el = await mount('open');
    await animationsFinished(surface(el));
    const inner = innerDialog(el);
    expect(inner.purpose).toBe('form');
    expect(inner.alert).toBe(true);
    expect(surface(el).getAttribute('role')).toBe('alertdialog');
    expect((await axNode(surface(el))).role).toBe('alertdialog');
    // The dialog's own LayerController is the one that answers: it is on the stack as a modal that
    // closes on Escape. A capture-phase document listener would have claimed the press before it.
    const seen: boolean[] = [];
    const spy = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') seen.push(event.defaultPrevented);
    };
    document.addEventListener('keydown', spy, true);
    try {
      await pressKeys('Escape');
      await waitUntil(() => !el.open, 'closed by Escape');
    } finally {
      document.removeEventListener('keydown', spy, true);
    }
    expect(seen).toEqual([false]);
  });

  it('a platform close request (the dialog `cancel` event, Android back) asks to close once', async () => {
    const el = await mount('open');
    await animationsFinished(surface(el));
    const changes = recordEvents(el, 'tct-open-change');
    surface(el).dispatchEvent(new Event('cancel', {cancelable: true}));
    await waitUntil(() => !el.open, 'closed by the close request');
    expect(changes.events).toHaveLength(1);
    expectEventFlags(changes.events[0]!, {bubbles: true, composed: true, cancelable: true});
  });

  it('a popover opened inside closes first on Escape, the dialog on the second', async () => {
    const el = await mount(
      'open',
      `<tct-popover id="inner" label="Inner"><button id="inner-trigger">More</button><div slot="content">Details</div></tct-popover>`,
    );
    await animationsFinished(surface(el));
    const popover = el.querySelector<HTMLElement & {open: boolean}>('#inner')!;
    popover.open = true;
    await waitUntil(() => layerStack().length === 2, 'popover on top of the dialog');
    const changes = recordEvents(el, 'tct-open-change');
    await pressKeys('Escape');
    await waitUntil(() => !popover.open, 'popover closed by the first Escape');
    expect(el.open, 'the dialog survives the first Escape').toBe(true);
    // The popover's own intent event bubbles out of the dialog; the dialog has raised none yet.
    expect(changes.events.map((event) => event.reason)).toEqual(['escape']);
    await pressKeys('Escape');
    await waitUntil(() => !el.open, 'dialog closed by the second Escape');
    expect(changes.events.map((event) => event.reason)).toEqual(['escape', 'escape']);
  });

  it('requestClose() asks with reason "request"', async () => {
    const el = await mount('open');
    await animationsFinished(surface(el));
    const changes = recordEvents(el, 'tct-open-change');
    el.requestClose();
    await waitUntil(() => !el.open, 'closed');
    expect(changes.events[0]!.reason).toBe('request');
  });
});

describe('keyboard', () => {
  it('activates cancel with Enter', async () => {
    const el = await mount('open');
    await animationsFinished(surface(el));
    await waitUntil(() => isFocused(button(el, 'Cancel')), 'cancel focused');
    await pressKeys('Enter');
    await waitUntil(() => !el.open, 'closed by Enter on Cancel');
  });

  it('activates the action button with Space', async () => {
    const el = await mount('open');
    await animationsFinished(surface(el));
    const actions = recordEvents(el, 'tct-action');
    await pressKeys('Tab');
    await waitUntil(() => isFocused(button(el, 'Delete')), 'action focused');
    await pressKeys(' ');
    await waitUntil(() => actions.events.length === 1, 'tct-action');
    expect(el.open).toBe(true);
  });

  it('reaches both buttons by Tab, cancel first', async () => {
    const el = await mount('open');
    await animationsFinished(surface(el));
    await waitUntil(() => isFocused(button(el, 'Cancel')), 'cancel is the initial focus');
    await pressKeys('Tab');
    expect(isFocused(button(el, 'Delete'))).toBe(true);
  });
});

describe('focus', () => {
  it('marks cancel as the initial focus target', async () => {
    const el = await mount('open');
    await animationsFinished(surface(el));
    expect(button(el, 'Cancel').hasAttribute('data-autofocus')).toBe(true);
    await waitUntil(() => isFocused(button(el, 'Cancel')), 'cancel focused');
  });

  it('keeps the initial focus target on the least destructive action', async () => {
    const el = await mount('open action-variant="primary"');
    await animationsFinished(surface(el));
    expect(isFocused(button(el, 'Cancel'))).toBe(true);
  });

  it('returns focus to the trigger when it closes', async () => {
    const el = await mount();
    const trigger = document.querySelector<HTMLElement>('#trigger')!;
    trigger.focus();
    await openIt(el);
    await pressKeys('Escape');
    await waitUntil(() => !el.open, 'closed');
    await waitUntil(() => deepActiveElement() === trigger, 'focus returned to the trigger');
  });

  it('does not disable the cancel button while the action is loading', async () => {
    const el = await mount('open action-loading');
    expect(button(el, 'Cancel').disabled).toBe(false);
  });
});

describe('aria', () => {
  it('marks the action button busy while loading, and blocks it', async () => {
    const el = await mount('open action-loading');
    await animationsFinished(surface(el));
    const action = button(el, 'Delete');
    expect(action.loading).toBe(true);
    const actions = recordEvents(el, 'tct-action');
    await userEvent.click(action);
    await aTimeout(60);
    expect(actions.events).toHaveLength(0);
  });
});

describe('the inline preview path', () => {
  it('does not claim the alertdialog role, and exposes a named group with no aria-modal', async () => {
    const el = await mount('open inline');
    await nextFrame();
    const group = el.shadowRoot!.querySelector<HTMLElement>('.content')!;
    expect(group.getAttribute('role')).toBe('group');
    expect(await axNode(group)).toMatchObject({role: 'group', name: 'Delete item?'});
    expect(innerDialog(el).shadowRoot!.querySelector('dialog')).toBeNull();
    expect(layerStack()).toHaveLength(0);
  });
});

describe('responsive actions', () => {
  it('keeps horizontal order (cancel, action) above the small breakpoint', async () => {
    const el = await mount('open');
    const [first, second] = buttons(el);
    expect([first!.label, second!.label]).toEqual(['Cancel', 'Delete']);
    expect(el.shadowRoot!.querySelector('.footer')!.hasAttribute('data-compact')).toBe(false);
  });

  it('stacks the destructive action above cancel on a narrow screen, aligning DOM and tab order, with autofocus staying on cancel', async () => {
    const restore = narrowHere();
    try {
      const el = await mount('open');
      await animationsFinished(surface(el));
      const footer = el.shadowRoot!.querySelector<HTMLElement>('.footer')!;
      expect(footer.hasAttribute('data-compact')).toBe(true);
      expect(buttons(el).map((candidate) => candidate.label)).toEqual(['Delete', 'Cancel']);
      const [action, cancel] = buttons(el);
      expect(action!.getBoundingClientRect().top).toBeLessThan(cancel!.getBoundingClientRect().top);
      expect(Math.round(action!.getBoundingClientRect().width)).toBe(
        Math.round(footer.getBoundingClientRect().width),
      );
      await waitUntil(() => isFocused(cancel!), 'cancel keeps the initial focus');
      await pressKeys('Shift+Tab');
      expect(isFocused(action!)).toBe(true);
    } finally {
      restore();
    }
  });

  it('keeps long action labels within the wide footer', async () => {
    const el = await mount(
      'open action-label="Delete every project in this workspace and remove all of their contents forever"',
    );
    await animationsFinished(surface(el));
    const footer = el.shadowRoot!.querySelector<HTMLElement>('.footer')!;
    const box = footer.getBoundingClientRect();
    for (const candidate of buttons(el)) {
      expect(candidate.getBoundingClientRect().right).toBeLessThanOrEqual(box.right + 1);
    }
  });
});

describe('layers', () => {
  it('a toast action stays clickable while the alert dialog is modal', async () => {
    const el = await mount();
    await openIt(el);
    const {toast, dismissAllToasts} = await import('../toast/toast.api.js');
    const clicked = vi.fn();
    const action = document.createElement('button');
    action.textContent = 'Undo';
    action.addEventListener('click', clicked);
    toast({body: 'Deleted', endContent: action});
    await waitUntil(() => action.isConnected && action.getBoundingClientRect().width > 0, 'toast');
    await userEvent.click(action);
    expect(clicked).toHaveBeenCalledTimes(1);
    expect(el.open, 'the toast click is not an outside press').toBe(true);
    dismissAllToasts();
  });
});

describe('a11y', () => {
  it('has no axe violations open', async () => {
    const el = await mount('open');
    await animationsFinished(surface(el));
    await expectAccessible(el);
  });

  it('has no axe violations inline', async () => {
    const el = await mount('open inline');
    await expectAccessible(el);
  });

  it('has no axe violations on a narrow screen', async () => {
    const restore = narrowHere();
    try {
      const el = await mount('open');
      await animationsFinished(surface(el));
      await expectAccessible(el);
    } finally {
      restore();
    }
  });
});

describe('RTL', () => {
  it('keeps Cancel first and aligns the actions to the end in a right-to-left container', async () => {
    const root = await fixture<HTMLElement>(`<div dir="rtl" lang="ar">${alert('open')}</div>`);
    const el = root.querySelector<TctAlertDialog>('tct-alert-dialog')!;
    await el.updateComplete;
    await animationsFinished(surface(el));
    const [cancel, action] = buttons(el);
    // Logical order: the first button is at the inline start, which is the right in RTL.
    expect(cancel!.getBoundingClientRect().left).toBeGreaterThan(
      action!.getBoundingClientRect().left,
    );
    const footer = el.shadowRoot!.querySelector<HTMLElement>('.footer')!;
    expect(
      Math.abs(action!.getBoundingClientRect().left - footer.getBoundingClientRect().left),
    ).toBeLessThan(2);
  });
});

describe('forced colours', () => {
  it('keeps the dialog bordered and the buttons visible', async () => {
    const restore = await emulateMedia({forcedColors: 'active'});
    try {
      const el = await mount('open');
      await animationsFinished(surface(el));
      const style = getComputedStyle(surface(el));
      expect(parseFloat(style.borderTopWidth)).toBeGreaterThan(0);
      expect(style.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
      for (const candidate of buttons(el)) {
        expect(candidate.getBoundingClientRect().width).toBeGreaterThan(0);
      }
    } finally {
      await restore();
    }
  });
});

describe('reduced motion', () => {
  it('opens and closes without a movement animation', async () => {
    const restore = await emulateMedia({reducedMotion: 'reduce'});
    try {
      const el = await mount();
      await el.show();
      const moving = surface(el)
        .getAnimations()
        .filter((animation) => {
          const effect = animation.effect as KeyframeEffect | null;
          return effect
            ?.getKeyframes()
            .some((frame) => 'transform' in frame || 'translate' in frame);
        });
      expect(moving).toHaveLength(0);
      await el.hide();
      expect(el.open).toBe(false);
    } finally {
      await restore();
    }
  });
});

describe('i18n', () => {
  it('shows the German Cancel label, and cancel-label wins', async () => {
    const root = await fixture<HTMLElement>(`<div lang="de-DE">${alert('open')}</div>`);
    const el = root.querySelector<TctAlertDialog>('tct-alert-dialog')!;
    await waitUntil(() => buttons(el)[0]!.label === 'Abbrechen', 'de-DE catalog');
    el.setAttribute('cancel-label', 'Zurück');
    await el.updateComplete;
    expect(buttons(el)[0]!.label).toBe('Zurück');
  });

  it('shows the Arabic Cancel label in an RTL container', async () => {
    const root = await fixture<HTMLElement>(`<div lang="ar-SA" dir="rtl">${alert('open')}</div>`);
    const el = root.querySelector<TctAlertDialog>('tct-alert-dialog')!;
    await waitUntil(() => buttons(el)[0]!.label === 'إلغاء', 'ar-SA catalog');
  });
});

describe('properties', () => {
  it('opens and closes through show() and hide() without intent events, settling once each', async () => {
    const el = await mount();
    const intent = recordEvents(el, 'tct-open-change');
    const after = recordEvents(el, 'tct-after-open-change');
    await el.show();
    expect(el.open).toBe(true);
    await el.hide();
    expect(el.open).toBe(false);
    expect(intent.events).toHaveLength(0);
    expect(after.events.map((event) => event.open)).toEqual([true, false]);
  });

  it('toggle() flips and toggle(force) sets', async () => {
    const el = await mount();
    await el.toggle();
    expect(el.open).toBe(true);
    await el.toggle(true);
    expect(el.open).toBe(true);
    await el.toggle(false);
    expect(el.open).toBe(false);
  });

  it('action-variant falls back to destructive for an unknown value', async () => {
    const el = await mount('open action-variant="nonsense"');
    expect(button(el, 'Delete').variant).toBe('destructive');
  });

  it('the action button takes the given variant', async () => {
    const el = await mount('open action-variant="primary"');
    expect(button(el, 'Delete').variant).toBe('primary');
  });

  it('exposes the open custom state', async () => {
    const el = await mount('open');
    await animationsFinished(surface(el));
    expect(el.matches(':state(open)')).toBe(true);
  });
});

runKeyboardSuite({
  tag: 'tct-alert-dialog',
  render: () => alert(),
  table: parity.entries['core.alert-dialog'].keyboard,
  steps: {
    'Cancels: asks to close (cancelable tct-open-change) and returns focus to the opener': {
      setup: async (el) => {
        await (el as TctAlertDialog).show();
      },
      focus: (el) =>
        (el as TctAlertDialog).shadowRoot!.querySelector<HTMLElement>('.footer tct-button'),
      keys: ['Escape'],
      expect: async ({element}) => {
        await waitUntil(() => !(element as TctAlertDialog).open, 'closed by Escape');
      },
    },
    'Moves between Cancel and the action; focus stays inside the modal': {
      setup: async (el) => {
        await (el as TctAlertDialog).show();
        await animationsFinished(surface(el as TctAlertDialog));
      },
      focus: (el) => button(el as TctAlertDialog, 'Cancel'),
      keys: ['Tab'],
      expect: ({element}) => {
        expect(isFocused(button(element as TctAlertDialog, 'Delete'))).toBe(true);
      },
    },
    'Activates the focused button': {
      setup: async (el) => {
        await (el as TctAlertDialog).show();
        await animationsFinished(surface(el as TctAlertDialog));
      },
      focus: (el) => button(el as TctAlertDialog, 'Cancel'),
      keys: ['Enter'],
      expect: async ({element}) => {
        await waitUntil(() => !(element as TctAlertDialog).open, 'closed by Enter on Cancel');
      },
    },
  },
});
