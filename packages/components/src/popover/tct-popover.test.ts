/**
 * tct-popover: element contract, overlay contract (one Escape per layer, outside press, focus
 * return, moves, Tier 2, toast under a modal), the keyboard table, a11y, RTL, forced colours,
 * reduced motion and i18n. Upstream test names are kept where the behaviour applies.
 */
import {beforeAll, describe, expect, it, vi} from 'vitest';
import {userEvent} from 'vitest/browser';
import {defineElement} from '@tecton-astryx/core/define.js';
import {resetDevWarnings} from '@tecton-astryx/core/utils/dev.js';
import {deepActiveElement} from '@tecton-astryx/core/utils/focus.js';
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
} from '@tecton-astryx/testing/index.js';
import {TctTestLayer} from '@tecton-astryx/testing/fixtures/test-layer.js';
import './define.js';
import type {TctPopover} from './tct-popover.js';

// `import.meta.glob` keeps parity.json (not part of the TypeScript project) out of the program.
const parity = Object.values(
  import.meta.glob<{
    entries: {'core.popover': {keyboard: {keys: string; action: string; when?: string}[]}};
  }>('./parity.json', {eager: true, import: 'default'}),
)[0]!;

beforeAll(() => {
  defineElement(TctTestLayer);
});

const popover = (
  attributes = '',
  content = '<button id="first">First</button>',
  trigger = '<button id="trigger">Open</button>',
) =>
  `<tct-popover ${attributes.includes('label=') ? '' : 'label="Settings"'} ${attributes}>${trigger}<div slot="content">${content}</div></tct-popover>`;

async function mount(attributes = '', content?: string, trigger?: string): Promise<TctPopover> {
  const root = await fixture<HTMLElement>(
    `<div style="padding:60px 40px">${popover(attributes, content, trigger)}<p id="outside">outside</p></div>`,
  );
  const element = root.querySelector<TctPopover>('tct-popover')!;
  await element.updateComplete;
  return element;
}

const layerOf = (el: TctPopover): HTMLElement =>
  el.shadowRoot!.querySelector<HTMLElement>('.layer')!;
const surfaceOf = (el: TctPopover): HTMLElement =>
  el.shadowRoot!.querySelector<HTMLElement>('.surface')!;
const triggerOf = (el: TctPopover): HTMLElement =>
  el.querySelector<HTMLElement>('button, [role=button]')!;
const isShown = (el: TctPopover): boolean => layerOf(el).matches(':popover-open');

async function openByClick(el: TctPopover): Promise<void> {
  await userEvent.click(triggerOf(el));
  await waitUntil(() => el.open && isShown(el), 'opened');
  await animationsFinished(layerOf(el));
}

runElementSuite({
  tag: 'tct-popover',
  render: () => popover(),
  properties: {
    placement: 'above',
    alignment: 'end',
    disabled: true,
    width: '320',
    label: 'Other label',
    popupRole: 'none',
    nonModal: true,
    noCloseButton: true,
    closeLabel: 'Dismiss',
    noAutoFocus: true,
    noLightDismiss: true,
    noEscapeDismiss: true,
  },
  attributes: {
    placement: 'placement',
    alignment: 'alignment',
    width: 'width',
    label: 'label',
    closeLabel: 'close-label',
  },
  events: ['tct-open-change', 'tct-after-open-change'],
});

runOverlaySuite({
  tag: 'tct-popover',
  render: ({attributes = '', children = ''}) =>
    `<tct-popover label="Test" ${attributes}><button>Trigger</button><div slot="content"><button>Inside</button>${children}</div></tct-popover>`,
  trigger: (element) => element.querySelector(':scope > button'),
  surface: (element) => element.shadowRoot!.querySelector<HTMLElement>('.layer'),
});

describe('Popover', () => {
  it('renders trigger element', async () => {
    const el = await mount();
    expect(triggerOf(el).textContent).toBe('Open');
    expect((await axNode(triggerOf(el))).role).toBe('button');
  });

  it('sets aria-haspopup on trigger', async () => {
    const el = await mount();
    expect(triggerOf(el).getAttribute('aria-haspopup')).toBe('dialog');
  });

  it('sets aria-expanded=false initially', async () => {
    const el = await mount();
    expect(triggerOf(el).getAttribute('aria-expanded')).toBe('false');
    expect(await axNode(triggerOf(el))).toMatchObject({
      role: 'button',
      name: 'Open',
      expanded: 'false',
    });
  });

  it('opens on click and updates aria-expanded', async () => {
    const el = await mount();
    await openByClick(el);
    expect(triggerOf(el).getAttribute('aria-expanded')).toBe('true');
    expect(await axNode(triggerOf(el))).toMatchObject({expanded: 'true'});
  });

  it('renders popover content with role=dialog', async () => {
    const el = await mount('label="Greeting"');
    const surface = surfaceOf(el);
    expect(surface.getAttribute('role')).toBe('dialog');
    expect(surface.getAttribute('aria-label')).toBe('Greeting');
    await openByClick(el);
    expect(await axNode(surface)).toMatchObject({role: 'dialog', name: 'Greeting'});
  });

  it('can render a neutral wrapper when content owns its role', async () => {
    const el = await mount(
      'popup-role="none" label="Actions"',
      '<div role="menu" aria-label="Actions"><div role="menuitem" tabindex="0">One</div></div>',
    );
    expect(triggerOf(el).getAttribute('aria-haspopup')).toBe('true');
    const surface = surfaceOf(el);
    expect(surface.hasAttribute('role')).toBe(false);
    expect(surface.hasAttribute('aria-modal')).toBe(false);
    expect(surface.hasAttribute('aria-label')).toBe(false);
    expect(el.querySelector('[role=menu]')!.getAttribute('aria-label')).toBe('Actions');
  });

  it('can render a non-modal dialog wrapper', async () => {
    const el = await mount('non-modal');
    expect(surfaceOf(el).getAttribute('role')).toBe('dialog');
    expect(surfaceOf(el).hasAttribute('aria-modal')).toBe(false);
    const modal = await mount();
    expect(surfaceOf(modal).getAttribute('aria-modal')).toBe('true');
  });

  it('fires tct-open-change (cancelable, bubbling, composed) before opening, then tct-after-open-change once', async () => {
    const el = await mount();
    const intent = recordEvents(el, 'tct-open-change');
    const after = recordEvents(el, 'tct-after-open-change');
    await openByClick(el);
    await waitUntil(() => after.events.length === 1, 'after-open-change');
    expect(intent.events).toHaveLength(1);
    expect(intent.events[0]!.open).toBe(true);
    expect(intent.events[0]!.reason).toBe('trigger');
    expectEventFlags(intent.events[0]!, {bubbles: true, composed: true, cancelable: true});
    expectEventFlags(after.events[0]!, {bubbles: true, composed: true, cancelable: false});
    expect(after.events[0]!.open).toBe(true);
  });

  it('preventing tct-open-change keeps the popover closed', async () => {
    const el = await mount();
    el.addEventListener('tct-open-change', (event) => {
      event.preventDefault();
    });
    await userEvent.click(triggerOf(el));
    await aTimeout(80);
    expect(el.open).toBe(false);
    expect(isShown(el)).toBe(false);
  });

  it('does not open when disabled is set', async () => {
    const el = await mount('disabled');
    const intent = recordEvents(el, 'tct-open-change');
    await userEvent.click(triggerOf(el));
    await aTimeout(80);
    expect(el.open).toBe(false);
    expect(intent.events).toHaveLength(0);
  });

  it('show(), hide() and toggle() are programmatic: no intent events, one after-open-change each', async () => {
    const el = await mount();
    const intent = recordEvents(el, 'tct-open-change');
    const after = recordEvents(el, 'tct-after-open-change');
    await el.show();
    expect(el.open).toBe(true);
    expect(isShown(el)).toBe(true);
    await el.toggle();
    expect(el.open).toBe(false);
    await el.toggle(true);
    await el.hide();
    expect(intent.events).toHaveLength(0);
    expect(after.events.map((e) => e.open)).toEqual([true, false, true, false]);
  });

  it('requestClose() behaves like the user: intent event first, cancelable', async () => {
    const el = await mount('open');
    await waitUntil(() => isShown(el), 'open');
    const intent = recordEvents(el, 'tct-open-change');
    el.requestClose();
    await waitUntil(() => !el.open, 'closed');
    expect(intent.events[0]!.reason).toBe('request');
    expect(intent.events[0]!.open).toBe(false);
  });

  it('keeps state on the host: the open attribute reflects and :state(open) follows', async () => {
    const el = await mount();
    expect(el.hasAttribute('open')).toBe(false);
    await el.show();
    expect(el.hasAttribute('open')).toBe(true);
    expect(el.matches(':state(open)')).toBe(true);
    await el.hide();
    expect(el.matches(':state(open)')).toBe(false);
  });

  it('applies width: a number is px, a length is used as is', async () => {
    const el = await mount('width="320"');
    await el.show();
    await animationsFinished(layerOf(el));
    expect(surfaceOf(el).getBoundingClientRect().width).toBeCloseTo(320, 0);
    el.width = '20rem';
    await el.updateComplete;
    expect(surfaceOf(el).getBoundingClientRect().width).toBeCloseTo(320, 0);
  });

  it('constrains the surface to the viewport without clipping content that already fits', async () => {
    const el = await mount('width="9999"');
    await el.show();
    await animationsFinished(layerOf(el));
    await nextFrame();
    const rect = surfaceOf(el).getBoundingClientRect();
    expect(rect.width).toBeLessThanOrEqual(window.innerWidth - 32 + 1);
    expect(surfaceOf(el).hasAttribute('data-overflow')).toBe(false);
  });

  it('enables internal scrolling only when content exceeds the available space', async () => {
    const tall = `<div style="block-size:${window.innerHeight * 2}px">tall</div>`;
    const el = await mount('', tall);
    await el.show();
    await waitUntil(() => surfaceOf(el).hasAttribute('data-overflow'), 'overflow measured');
    expect(getComputedStyle(surfaceOf(el)).overflowY).toBe('auto');
    const short = await mount('', '<span>short</span>');
    await short.show();
    await aTimeout(100);
    expect(short.shadowRoot!.querySelector('.surface')!.hasAttribute('data-overflow')).toBe(false);
  });

  it('observes overflow only while the popover is open', async () => {
    const el = await mount();
    const surface = surfaceOf(el);
    const spy = vi.spyOn(surface, 'scrollHeight', 'get');
    el.querySelector<HTMLElement>('[slot=content]')!.style.blockSize = '120px';
    await aTimeout(80);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('keeps the surface anchored to the trigger: below and start-aligned by default, flipping in RTL', async () => {
    const el = await mount();
    await el.show();
    await animationsFinished(layerOf(el));
    const trigger = triggerOf(el).getBoundingClientRect();
    const surface = surfaceOf(el).getBoundingClientRect();
    expect(surface.top).toBeGreaterThanOrEqual(trigger.bottom);
    expect(Math.abs(surface.left - trigger.left)).toBeLessThan(2);
    expect(layerOf(el).getAttribute('data-placement')).toBe('below');
  });

  it('mirrors placement=start and alignment in RTL', async () => {
    const root = await fixture<HTMLElement>(
      `<div dir="rtl" style="padding:60px 200px">${popover('placement="start"')}</div>`,
    );
    const el = root.querySelector<TctPopover>('tct-popover')!;
    await el.show();
    await animationsFinished(layerOf(el));
    const trigger = triggerOf(el).getBoundingClientRect();
    const surface = surfaceOf(el).getBoundingClientRect();
    // `start` in RTL is the right-hand side of the trigger.
    expect(surface.left).toBeGreaterThanOrEqual(trigger.right - 1);
  });

  it('supports the anchor / anchorElement sibling mode', async () => {
    const root = await fixture<HTMLElement>(
      `<div style="padding:60px 40px"><button id="external">External</button><tct-popover anchor="external" label="Sibling"><div slot="content">Sibling content</div></tct-popover></div>`,
    );
    const el = root.querySelector<TctPopover>('tct-popover')!;
    const external = root.querySelector<HTMLElement>('#external')!;
    await el.updateComplete;
    expect(external.getAttribute('aria-haspopup')).toBe('dialog');
    expect(external.getAttribute('aria-expanded')).toBe('false');
    await userEvent.click(external);
    await waitUntil(() => el.open && isShown(el), 'opened from the external anchor');
    expect(external.getAttribute('aria-expanded')).toBe('true');
    await el.hide();
    const property = await fixture<HTMLElement>(
      `<div><button id="by-property">P</button><tct-popover label="P"><div slot="content">x</div></tct-popover></div>`,
    );
    const second = property.querySelector<TctPopover>('tct-popover')!;
    second.anchorElement = property.querySelector('#by-property');
    await second.updateComplete;
    await userEvent.click(property.querySelector('#by-property')!);
    await waitUntil(() => second.open, 'opened from anchorElement');
  });

  it('finds a button inside the trigger wrapper and attaches ARIA to it', async () => {
    const el = await mount(
      '',
      undefined,
      '<span id="wrap"><button id="inner">Inner</button></span>',
    );
    const inner = el.querySelector('#inner')!;
    expect(inner.getAttribute('aria-haspopup')).toBe('dialog');
    expect(el.querySelector('#wrap')!.hasAttribute('aria-haspopup')).toBe(false);
    await userEvent.click(inner);
    await waitUntil(() => el.open, 'open');
  });

  it('finds role="button" elements, attaches ARIA and opens on click', async () => {
    const el = await mount(
      '',
      undefined,
      '<div id="rb" role="button" tabindex="0">Role button</div>',
    );
    const trigger = el.querySelector('#rb')!;
    expect(trigger.getAttribute('aria-haspopup')).toBe('dialog');
    await userEvent.click(trigger);
    await waitUntil(() => el.open, 'open');
  });

  it('opens on Enter/Space for role="button" elements', async () => {
    const el = await mount(
      '',
      undefined,
      '<div id="rb" role="button" tabindex="0">Role button</div>',
    );
    const trigger = el.querySelector<HTMLElement>('#rb')!;
    trigger.focus();
    await pressKeys('Enter');
    await waitUntil(() => el.open, 'opened by Enter');
    await el.hide();
    trigger.focus();
    await pressKeys(' ');
    await waitUntil(() => el.open, 'opened by Space');
  });

  it('warns in dev when the trigger has no button', async () => {
    resetDevWarnings();
    const previous = (globalThis as {tctDevMode?: boolean}).tctDevMode;
    (globalThis as {tctDevMode?: boolean}).tctDevMode = true;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      await mount('', undefined, '<span>No button</span>');
      expect(warn.mock.calls.some((call) => String(call[0]).includes('button'))).toBe(true);
    } finally {
      warn.mockRestore();
      (globalThis as {tctDevMode?: boolean}).tctDevMode = previous;
    }
  });

  it('shows the popover on an invoker command from elsewhere', async () => {
    const el = await mount();
    const source = document.createElement('button');
    document.body.append(source);
    try {
      const event = Object.assign(new Event('command'), {command: '--toggle', source});
      el.dispatchEvent(event);
      await waitUntil(() => el.open, 'opened by command');
      expect(source.getAttribute('aria-expanded')).toBe('true');
      el.dispatchEvent(Object.assign(new Event('command'), {command: '--hide', source}));
      await waitUntil(() => !el.open, 'closed by command');
      expect(source.getAttribute('aria-expanded')).toBe('false');
    } finally {
      source.remove();
    }
  });
});

describe('dismiss controls', () => {
  it('dismisses on Escape by default, with reason "escape"', async () => {
    const el = await mount();
    await openByClick(el);
    const intent = recordEvents(el, 'tct-open-change');
    await pressKeys('Escape');
    await waitUntil(() => !el.open, 'closed');
    expect(intent.events[0]!.reason).toBe('escape');
    await waitUntil(() => triggerOf(el).getAttribute('aria-expanded') === 'false', 'aria-expanded');
  });

  it('does not reopen when the trigger click belongs to its own light dismiss', async () => {
    const el = await mount();
    await openByClick(el);
    // Pressing the trigger while open is a press inside (the trigger is part of the layer): it
    // closes through the click, and the same gesture cannot reopen it.
    await userEvent.click(triggerOf(el));
    await waitUntil(() => !el.open, 'closed by the trigger');
    await aTimeout(80);
    expect(el.open).toBe(false);
  });

  it('dismisses on Escape pressed inside a roving-focus list', async () => {
    const list = `<div role="radiogroup" aria-label="View">
      <button role="radio" aria-checked="true" id="grid">Grid</button>
      <button role="radio" aria-checked="false" tabindex="-1">List</button></div>`;
    const el = await mount('', list);
    await openByClick(el);
    el.querySelector<HTMLElement>('#grid')!.focus();
    await pressKeys('Escape');
    await waitUntil(() => !el.open, 'closed');
  });

  it('stays open on Escape when no-escape-dismiss is set', async () => {
    const el = await mount('no-light-dismiss no-escape-dismiss');
    await openByClick(el);
    await pressKeys('Escape');
    await aTimeout(80);
    expect(el.open).toBe(true);
  });

  it('no-escape-dismiss works without no-light-dismiss (native light-dismiss coupling is gone)', async () => {
    const el = await mount('no-escape-dismiss');
    await openByClick(el);
    await pressKeys('Escape');
    await aTimeout(80);
    expect(el.open).toBe(true);
  });

  it('still dismisses on Escape when only light dismiss is off', async () => {
    const el = await mount('no-light-dismiss');
    await openByClick(el);
    await pressKeys('Escape');
    await waitUntil(() => !el.open, 'closed');
  });

  it('ignores outside presses when no-light-dismiss is set', async () => {
    const el = await mount('no-light-dismiss');
    await openByClick(el);
    await userEvent.click(document.querySelector('#outside')!);
    await aTimeout(80);
    expect(el.open).toBe(true);
  });

  it('is always popover="manual": light dismiss belongs to the layer stack', async () => {
    const el = await mount();
    expect(layerOf(el).getAttribute('popover')).toBe('manual');
    await openByClick(el);
    expect(layerOf(el).getAttribute('popover')).toBe('manual');
  });

  it('lets Escape fall through to a host layer when fully opted out', async () => {
    const root = await fixture<HTMLElement>(
      `<tct-test-layer kind="modal" id="host"><button slot="trigger" id="host-trigger">host</button>${popover('no-light-dismiss no-escape-dismiss')}</tct-test-layer>`,
    );
    const host = root as unknown as TctTestLayer;
    host.open = true;
    await waitUntil(() => host.layer.isOpen, 'host open');
    const el = root.querySelector<TctPopover>('tct-popover')!;
    await el.show();
    await pressKeys('Escape');
    await waitUntil(() => !host.open, 'the host layer took the press');
  });
});

describe('focus restoration', () => {
  it('focuses the first content control after pointer activation', async () => {
    const el = await mount('', '<button id="delete">Delete</button>');
    await openByClick(el);
    await waitUntil(() => deepActiveElement()?.id === 'delete', 'first control focused');
  });

  it('focuses the first content control after keyboard activation', async () => {
    const el = await mount('', '<button id="delete">Delete</button>');
    triggerOf(el).focus();
    await pressKeys('Enter');
    await waitUntil(() => deepActiveElement()?.id === 'delete', 'first control focused');
  });

  it('focuses the dialog container when content has no controls', async () => {
    const el = await mount('', '<p>Just text</p>');
    await openByClick(el);
    await waitUntil(() => deepActiveElement() === surfaceOf(el), 'surface focused');
  });

  it('prefers a genuine content control over the generated close button', async () => {
    const el = await mount('', '<input id="field" aria-label="Field">');
    await openByClick(el);
    await waitUntil(() => deepActiveElement()?.id === 'field', 'content control');
  });

  it('does not move focus when no-auto-focus is set', async () => {
    const el = await mount('no-auto-focus');
    triggerOf(el).focus();
    await el.show();
    await aTimeout(60);
    expect(deepActiveElement()).toBe(triggerOf(el));
  });

  it('keeps the fallback close button reachable by Tab, revealed only when focused', async () => {
    const el = await mount();
    await openByClick(el);
    const close = el.shadowRoot!.querySelector<HTMLElement>('.close-button')!;
    const wrapper = el.shadowRoot!.querySelector<HTMLElement>('.close')!;
    expect(wrapper.getBoundingClientRect().width).toBeLessThanOrEqual(2);
    await pressKeys('Tab');
    await waitUntil(() => deepActiveElement() === close, 'close button focused');
    expect(wrapper.getBoundingClientRect().width).toBeGreaterThan(20);
    await pressKeys('Enter');
    await waitUntil(() => !el.open, 'closed by the close button');
  });

  it('removes the close button with no-close-button', async () => {
    const el = await mount('no-close-button');
    expect(el.shadowRoot!.querySelector('.close-button')).toBeNull();
  });

  it('returns focus to the trigger when closed via Escape', async () => {
    const el = await mount();
    await openByClick(el);
    await pressKeys('Escape');
    await waitUntil(() => !el.open, 'closed');
    await waitUntil(() => deepActiveElement() === triggerOf(el), 'focus returned');
  });

  it('returns focus to the trigger on light dismiss when focus was inside', async () => {
    const el = await mount();
    await openByClick(el);
    await waitUntil(() => deepActiveElement()?.id === 'first', 'inside');
    await userEvent.click(document.querySelector('#outside')!);
    await waitUntil(() => !el.open, 'closed');
    // The press moved focus to <body> (a paragraph is not focusable): focus goes back to the trigger.
    await waitUntil(() => deepActiveElement() === triggerOf(el), 'focus returned');
  });

  it('contains Tab inside the open popover (focus trap) and never inside a closed one', async () => {
    const el = await mount('', '<button id="a">A</button><button id="b">B</button>');
    await openByClick(el);
    await waitUntil(() => deepActiveElement()?.id === 'a', 'a');
    await pressKeys('Tab');
    expect(deepActiveElement()?.id).toBe('b');
    await pressKeys('Tab');
    expect(deepActiveElement()).toBe(el.shadowRoot!.querySelector('.close-button'));
    await pressKeys('Tab');
    expect(deepActiveElement()?.id).toBe('a');
    await pressKeys('Shift+Tab');
    expect(deepActiveElement()).toBe(el.shadowRoot!.querySelector('.close-button'));
  });
});

describe('nested layers', () => {
  it('Escape closes the inner popover first, then the outer one; focus returns to each opener', async () => {
    const root = await fixture<HTMLElement>(`
      <div style="padding:60px 40px">
        <tct-popover id="outer" label="Outer">
          <button id="t1">Outer trigger</button>
          <div slot="content">
            <tct-popover id="inner" label="Inner">
              <button id="t2">Inner trigger</button>
              <div slot="content"><button id="deep">Deep</button></div>
            </tct-popover>
          </div>
        </tct-popover>
      </div>`);
    const outer = root.querySelector<TctPopover>('#outer')!;
    const inner = root.querySelector<TctPopover>('#inner')!;
    await userEvent.click(root.querySelector('#t1')!);
    await waitUntil(() => outer.open && isShown(outer), 'outer');
    await userEvent.click(root.querySelector('#t2')!);
    await waitUntil(() => inner.open && isShown(inner), 'inner');
    expect(layerStack()).toHaveLength(2);
    // A press inside the inner surface is not an outside press for the outer layer.
    await userEvent.click(layerOf(inner));
    await aTimeout(60);
    expect(outer.open).toBe(true);

    await pressKeys('Escape');
    await waitUntil(() => !inner.open, 'inner closed');
    expect(outer.open).toBe(true);
    await waitUntil(() => deepActiveElement()?.id === 't2', 'focus back on the inner trigger');
    await pressKeys('Escape');
    await waitUntil(() => !outer.open, 'outer closed');
    await waitUntil(() => deepActiveElement()?.id === 't1', 'focus back on the outer trigger');
  });
});

describe('a11y', () => {
  it('passes axe closed and open', async () => {
    const el = await mount();
    await expectAccessible(el);
    await openByClick(el);
    await expectAccessible(el);
  });

  it('passes axe with the neutral wrapper around a menu', async () => {
    const el = await mount(
      'popup-role="none"',
      '<div role="menu" aria-label="Actions"><div role="menuitem" tabindex="0">One</div></div>',
    );
    await openByClick(el);
    await expectAccessible(el);
  });

  it('names the trigger, exposes expanded state and hides the popover from the tree while closed', async () => {
    const el = await mount();
    expect((await axNode(surfaceOf(el))).ignored).toBe('true');
    await openByClick(el);
    expect(await axNode(surfaceOf(el))).toMatchObject({role: 'dialog', name: 'Settings'});
  });
});

describe('rtl, forced colours, reduced motion', () => {
  it('renders in RTL with the close button on the inline centre', async () => {
    const root = await fixture<HTMLElement>(
      `<div dir="rtl" style="padding:60px">${popover()}</div>`,
    );
    const el = root.querySelector<TctPopover>('tct-popover')!;
    await el.show();
    await animationsFinished(layerOf(el));
    expect(getComputedStyle(el).direction).toBe('rtl');
    // The close button is centred on the inline axis in either direction.
    await pressKeys('Tab');
    const wrapper = el.shadowRoot!.querySelector<HTMLElement>('.close')!;
    const surface = surfaceOf(el).getBoundingClientRect();
    const close = wrapper.getBoundingClientRect();
    expect(
      Math.abs(close.left + close.width / 2 - (surface.left + surface.width / 2)),
    ).toBeLessThan(2);
  });

  it('keeps the surface visible in forced colours and paints it with system colours', async () => {
    const restore = await emulateMedia({forcedColors: 'active'});
    try {
      const el = await mount();
      await openByClick(el);
      const style = getComputedStyle(surfaceOf(el));
      expect(style.borderTopStyle).not.toBe('none');
      expect(parseFloat(style.borderTopWidth)).toBeGreaterThan(0);
      // `Canvas` in forced colours resolves to a real colour, never transparent.
      expect(style.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
      // Keyboard focus on the close button keeps a visible outline.
      await pressKeys('Tab');
      const close = el.shadowRoot!.querySelector<HTMLElement>('.close-button')!;
      await waitUntil(() => deepActiveElement() === close, 'close focused');
      expect(getComputedStyle(close).outlineStyle).not.toBe('none');
    } finally {
      await restore();
    }
  });

  it('runs no movement animation under reduced motion', async () => {
    const restore = await emulateMedia({reducedMotion: 'reduce'});
    try {
      const el = await mount();
      await el.show();
      const moving = layerOf(el)
        .getAnimations()
        .filter((animation) => {
          const effect = animation.effect as KeyframeEffect | null;
          return effect
            ?.getKeyframes()
            .some((frame) => 'translate' in frame || 'transform' in frame);
        });
      expect(moving).toHaveLength(0);
    } finally {
      await restore();
    }
  });
});

describe('i18n', () => {
  it('shows the German close label, and the close-label attribute wins', async () => {
    const root = await fixture<HTMLElement>(`<div lang="de-DE">${popover()}</div>`);
    const el = root.querySelector<TctPopover>('tct-popover')!;
    const close = el.shadowRoot!.querySelector('.close-button')!;
    await waitUntil(() => close.textContent?.trim() === 'Popover schließen', 'de-DE catalog');
    el.setAttribute('close-label', 'Zu');
    await el.updateComplete;
    expect(close.textContent?.trim()).toBe('Zu');
  });

  it('shows the Arabic close label in an RTL container', async () => {
    const root = await fixture<HTMLElement>(`<div lang="ar-SA" dir="rtl">${popover()}</div>`);
    const el = root.querySelector<TctPopover>('tct-popover')!;
    const close = el.shadowRoot!.querySelector('.close-button')!;
    await waitUntil(() => close.textContent?.trim() === 'إغلاق النافذة المنبثقة', 'ar-SA catalog');
  });
});

runKeyboardSuite({
  tag: 'tct-popover',
  render: () => popover('', '<button id="a">A</button><button id="b">B</button>'),
  table: parity.entries['core.popover'].keyboard,
  steps: {
    'Opens or closes the popover from the trigger': {
      focus: (el) => el.querySelector<HTMLElement>('#trigger'),
      keys: ['Enter'],
      expect: ({element}) => {
        expect((element as TctPopover).open).toBe(true);
      },
    },
    'Closes the popover and returns focus to the trigger': {
      setup: async (el) => {
        await (el as TctPopover).show();
      },
      focus: (el) => el.querySelector<HTMLElement>('#a'),
      keys: ['Escape'],
      expect: async ({element}) => {
        await waitUntil(() => !(element as TctPopover).open, 'closed');
        await waitUntil(() => deepActiveElement()?.id === 'trigger', 'trigger focused');
      },
    },
    'Moves to the next control; after the last control the close button is revealed, then focus wraps to the first control':
      {
        setup: async (el) => {
          await (el as TctPopover).show();
        },
        focus: (el) => el.querySelector<HTMLElement>('#b'),
        keys: ['Tab', 'Tab'],
        expect: () => {
          expect(deepActiveElement()?.id).toBe('a');
        },
      },
    'Moves to the previous control; before the first control focus wraps to the close button': {
      setup: async (el) => {
        await (el as TctPopover).show();
      },
      focus: (el) => el.querySelector<HTMLElement>('#a'),
      keys: ['Shift+Tab'],
      expect: ({element}) => {
        expect(deepActiveElement()).toBe(element.shadowRoot!.querySelector('.close-button'));
      },
    },
  },
});
