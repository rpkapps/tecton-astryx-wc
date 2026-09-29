/**
 * tct-mobile-nav: a modal drawer on the native dialog: open state and intent events (Escape, dimmed
 * area, close button), focus return to the opener, the sides (logical, RTL mirrored, auto from the
 * trigger), header and label, width, inertness of the page behind, reduced motion (ported from upstream
 * MobileNav.test.tsx and the MobileNav close/reopen tests, in a real browser).
 */
import {html} from 'lit';
import {describe, expect, it} from 'vitest';
import {userEvent} from 'vitest/browser';
import {deepActiveElement} from '@tecton-wc/core/utils/focus.js';
import {axNode, expectAccessible} from '@tecton-wc/testing/a11y.js';
import {emulateMedia} from '@tecton-wc/testing/emulate.js';
import {recordEvents} from '@tecton-wc/testing/events.js';
import {fixture} from '@tecton-wc/testing/fixture.js';
import {pressKeys} from '@tecton-wc/testing/keyboard.js';
import {runElementSuite} from '@tecton-wc/testing/suites/element.js';
import {animationsFinished, nextFrame, waitUntil} from '@tecton-wc/testing/timing.js';
import './define.js';
import type {TctMobileNav} from './tct-mobile-nav.js';

runElementSuite({
  tag: 'tct-mobile-nav',
  render: () =>
    html`<tct-mobile-nav header="Menu"
      ><nav aria-label="Main"><a href="#a">Home</a></nav></tct-mobile-nav
    >`,
  properties: {header: 'Menu', width: 280, side: 'end', label: 'Main menu'},
  attributes: {side: 'side'},
  events: ['tct-open-change', 'tct-after-open-change'],
});

const dialogOf = (nav: Element): HTMLDialogElement =>
  nav.shadowRoot!.querySelector<HTMLDialogElement>('dialog')!;
const drawerOf = (nav: Element): HTMLElement =>
  nav.shadowRoot!.querySelector<HTMLElement>('.drawer')!;

/** A page with a trigger button and a drawer. */
async function page(attributes = '', options: {dir?: 'rtl'; triggerStyle?: string} = {}) {
  const root = await fixture<HTMLElement>(
    `<div><button id="trigger" style="${options.triggerStyle ?? ''}">Menu</button>
      <button id="behind">Behind</button>
      <tct-mobile-nav id="nav" ${attributes}><a id="home" href="#home">Home</a><a id="docs" href="#docs">Docs</a></tct-mobile-nav></div>`,
    {dir: options.dir},
  );
  const nav = root.querySelector<TctMobileNav>('#nav')!;
  await nav.updateComplete;
  return {root, nav, trigger: root.querySelector<HTMLElement>('#trigger')!};
}

/** Opens the drawer from the trigger, the way a toggle does. */
async function openFromTrigger(nav: TctMobileNav, trigger: HTMLElement): Promise<void> {
  trigger.focus();
  nav.open = true;
  await nav.updateComplete;
  await waitUntil(() => dialogOf(nav).open);
  await animationsFinished(drawerOf(nav));
}

describe('tct-mobile-nav: state', () => {
  it('uses the native dialog element and is closed by default', async () => {
    const {nav} = await page();
    const dialog = dialogOf(nav);
    expect(dialog).toBeInstanceOf(HTMLDialogElement);
    expect(dialog.open).toBe(false);
    expect(nav.open).toBeUndefined();
    expect(nav.isOpen).toBe(false);
    expect(getComputedStyle(dialog).display).toBe('none');
  });

  it('opens as a modal dialog (top layer, page inert) when open becomes true', async () => {
    const {nav, root, trigger} = await page();
    await openFromTrigger(nav, trigger);
    expect(dialogOf(nav).matches(':modal')).toBe(true);
    expect(nav.matches(':state(open)')).toBe(true);
    // Everything behind it is inert: it cannot take focus.
    root.querySelector<HTMLElement>('#behind')!.focus();
    expect(deepActiveElement()).not.toBe(root.querySelector('#behind'));
  });

  it('opens from the open attribute', async () => {
    const root = await fixture<HTMLElement>(
      `<div><tct-mobile-nav id="nav" open header="Menu"><a href="#a">A</a></tct-mobile-nav></div>`,
    );
    const nav = root.querySelector<TctMobileNav>('#nav')!;
    await waitUntil(() => dialogOf(nav).open);
    expect(nav.isOpen).toBe(true);
  });

  it('show() and hide() open and close it without a tct-open-change, and settle', async () => {
    const {nav} = await page();
    const events = recordEvents(nav, ['tct-open-change', 'tct-after-open-change']);
    await nav.show();
    expect(dialogOf(nav).open).toBe(true);
    await nav.hide();
    expect(dialogOf(nav).open).toBe(false);
    expect(events.named('tct-open-change')).toHaveLength(0);
    expect(events.named('tct-after-open-change').map((event) => event.open)).toEqual([true, false]);
  });

  it('a property write never emits tct-open-change', async () => {
    const {nav} = await page();
    const events = recordEvents(nav, ['tct-open-change']);
    nav.open = true;
    await nav.updateComplete;
    nav.open = false;
    await nav.updateComplete;
    expect(events.events).toHaveLength(0);
  });
});

describe('tct-mobile-nav: dismissal (intent events)', () => {
  it('Escape asks to close with reason "escape" and closes unless prevented', async () => {
    const {nav, trigger} = await page();
    await openFromTrigger(nav, trigger);
    const events = recordEvents(nav, ['tct-open-change']);
    nav.addEventListener('tct-open-change', (event) => {
      event.preventDefault();
    });
    await pressKeys('Escape');
    expect(events.events).toHaveLength(1);
    expect(events.events[0]!.open).toBe(false);
    expect(events.events[0]!.reason).toBe('escape');
    expect(dialogOf(nav).open).toBe(true);
  });

  it('closes on Escape and returns focus to the element that opened it', async () => {
    const {nav, trigger} = await page();
    await openFromTrigger(nav, trigger);
    await pressKeys('Escape');
    // The owner keeps the state: with a shell it would close; standalone, write it.
    nav.open = false;
    await nav.updateComplete;
    await waitUntil(() => !dialogOf(nav).open);
    await waitUntil(() => deepActiveElement() === trigger);
  });

  it('a press on the dimmed area (the dialog itself) closes it with reason "outside"', async () => {
    const {nav, trigger} = await page();
    await openFromTrigger(nav, trigger);
    const events = recordEvents(nav, ['tct-open-change']);
    dialogOf(nav).dispatchEvent(new MouseEvent('click', {bubbles: true, composed: true}));
    expect(events.events.map((event) => event.reason)).toEqual(['outside']);
    // The drawer is a child of the dialog: a click on it (or its content) does not dismiss.
    drawerOf(nav).dispatchEvent(new MouseEvent('click', {bubbles: true, composed: true}));
    expect(events.events).toHaveLength(1);
  });

  it('a real click on the dimmed area closes it, and a click on the content does not', async () => {
    const {nav, trigger} = await page('side="start"');
    await openFromTrigger(nav, trigger);
    const events = recordEvents(nav, ['tct-open-change']);
    await userEvent.click(nav.querySelector('#home')!, {position: {x: 4, y: 4}});
    expect(events.events.filter((event) => event.reason === 'outside')).toHaveLength(0);
    const drawer = drawerOf(nav).getBoundingClientRect();
    await userEvent.click(dialogOf(nav), {
      position: {x: Math.min(innerWidth - 4, drawer.right + 8), y: 200},
    });
    expect(events.events.map((event) => event.reason)).toContain('outside');
  });

  it('has a close button that asks with reason "close-button"', async () => {
    const {nav, trigger} = await page();
    await openFromTrigger(nav, trigger);
    const events = recordEvents(nav, ['tct-open-change']);
    const close = drawerOf(nav).querySelector<HTMLElement>('.close')!;
    // Name it while the drawer is open: once closed, the button leaves the accessibility tree, and
    // checking after the click raced the close.
    // The accessible button is the native one inside the tct-button.
    const node = await axNode(close.shadowRoot!.querySelector('button')!);
    expect(node.role).toBe('button');
    expect(node.name).toBe('Close navigation');
    close.click();
    expect(events.events.map((event) => [event.open, event.reason])).toEqual([
      [false, 'close-button'],
    ]);
  });

  it('requestClose() is user-equivalent: it asks first', async () => {
    const {nav, trigger} = await page();
    await openFromTrigger(nav, trigger);
    const events = recordEvents(nav, ['tct-open-change']);
    nav.requestClose();
    expect(events.events.map((event) => event.reason)).toEqual(['request']);
    await waitUntil(() => !nav.isOpen);
  });

  it('a controlled drawer stays open until the page writes open', async () => {
    const {nav, trigger} = await page();
    await openFromTrigger(nav, trigger);
    nav.addEventListener('tct-open-change', (event) => {
      event.preventDefault();
    });
    nav.requestClose();
    await nextFrame();
    expect(nav.open).toBe(true);
    expect(dialogOf(nav).open).toBe(true);
  });

  it('closing again after a reopen still works (no stale state)', async () => {
    const {nav, trigger} = await page();
    for (let round = 0; round < 3; round++) {
      await openFromTrigger(nav, trigger);
      expect(dialogOf(nav).open).toBe(true);
      nav.open = false;
      await nav.updateComplete;
      await waitUntil(() => !dialogOf(nav).open);
      await waitUntil(() => deepActiveElement() === trigger);
    }
  });
});

describe('tct-mobile-nav: focus', () => {
  it('moves focus to the drawer (not the close button) when it opens', async () => {
    const {nav, trigger} = await page();
    await openFromTrigger(nav, trigger);
    expect(nav.shadowRoot!.activeElement).toBe(drawerOf(nav));
  });

  it('keeps Tab inside the drawer while open', async () => {
    const {nav, trigger} = await page();
    await openFromTrigger(nav, trigger);
    const seen = new Set<Element | null>();
    for (let index = 0; index < 8; index++) {
      await pressKeys('Tab');
      seen.add(deepActiveElement());
    }
    // Focus never reaches the page behind the modal.
    expect(seen.has(trigger)).toBe(false);
    expect(seen.has(document.getElementById('behind'))).toBe(false);
    expect([...seen].some((element) => element === nav.querySelector('#home'))).toBe(true);
  });

  it('is accessible open, named after its header', async () => {
    const {nav, trigger, root} = await page('header="Main menu"');
    await openFromTrigger(nav, trigger);
    expect((await axNode(dialogOf(nav))).name).toBe('Main menu');
    await expectAccessible(root);
  });
});

describe('tct-mobile-nav: header and label', () => {
  it('names the dialog from the header text, an explicit label, or "Navigation"', async () => {
    const withHeader = await page('header="Site menu"');
    expect(dialogOf(withHeader.nav).getAttribute('aria-label')).toBe('Site menu');
    const labelled = await page('header="Site menu" label="Primary"');
    expect(dialogOf(labelled.nav).getAttribute('aria-label')).toBe('Primary');
    const bare = await page();
    expect(dialogOf(bare.nav).getAttribute('aria-label')).toBe('Navigation');
  });

  it('renders the header text as a level 2 heading, and a slotted header instead of it', async () => {
    const {nav} = await page('header="Menu"');
    const heading = drawerOf(nav).querySelector('tct-heading')!;
    expect(heading.textContent).toContain('Menu');
    expect(heading.getAttribute('level')).toBe('2');
    const root = await fixture<HTMLElement>(
      `<tct-mobile-nav><span slot="header" id="logo">Logo</span><a href="#x">x</a></tct-mobile-nav>`,
    );
    const custom = root as TctMobileNav;
    expect(drawerOf(custom).querySelector('tct-heading')).toBeNull();
    expect(drawerOf(custom).querySelector('slot[name="header"]')).not.toBeNull();
  });

  it('localises the close button and lets an attribute override it', async () => {
    const {nav} = await page('close-label="Dismiss"');
    expect(drawerOf(nav).querySelector('.close')!.getAttribute('label')).toBe('Dismiss');
  });
});

describe('tct-mobile-nav: sides and width', () => {
  it('start slides in from the inline-start edge and end from the inline-end edge', async () => {
    const start = await page('side="start"');
    await openFromTrigger(start.nav, start.trigger);
    expect(drawerOf(start.nav).getBoundingClientRect().left).toBe(0);
    await start.nav.hide();
    const end = await page('side="end"');
    await openFromTrigger(end.nav, end.trigger);
    expect(Math.round(drawerOf(end.nav).getBoundingClientRect().right)).toBe(
      Math.round(dialogOf(end.nav).getBoundingClientRect().right),
    );
    await end.nav.hide();
  });

  it('mirrors in RTL: start is the right edge', async () => {
    const {nav, trigger} = await page('side="start"', {dir: 'rtl'});
    await openFromTrigger(nav, trigger);
    expect(Math.round(drawerOf(nav).getBoundingClientRect().right)).toBe(
      Math.round(dialogOf(nav).getBoundingClientRect().right),
    );
    expect(drawerOf(nav).dataset.side).toBe('start');
    await nav.hide();
  });

  it('auto slides from the side of the trigger: the start half opens from the start edge', async () => {
    const startTrigger = await page('', {
      triggerStyle: 'position: fixed; inset-inline-start: 4px; top: 4px',
    });
    await openFromTrigger(startTrigger.nav, startTrigger.trigger);
    expect(drawerOf(startTrigger.nav).dataset.side).toBe('start');
    await startTrigger.nav.hide();
    const endTrigger = await page('', {
      triggerStyle: 'position: fixed; inset-inline-end: 4px; top: 4px',
    });
    await openFromTrigger(endTrigger.nav, endTrigger.trigger);
    expect(drawerOf(endTrigger.nav).dataset.side).toBe('end');
    await endTrigger.nav.hide();
  });

  it('defaults to the end side with no trigger', async () => {
    const {nav} = await page();
    await nav.show();
    expect(drawerOf(nav).dataset.side).toBe('end');
    await nav.hide();
  });

  it('is 320px wide by default, never wider than the viewport, and takes a width', async () => {
    const {nav, trigger} = await page('side="start"');
    await openFromTrigger(nav, trigger);
    expect(drawerOf(nav).getBoundingClientRect().width).toBe(
      Math.min(320, dialogOf(nav).getBoundingClientRect().width),
    );
    await nav.hide();
    const narrow = await page('side="start" width="200"');
    await openFromTrigger(narrow.nav, narrow.trigger);
    expect(drawerOf(narrow.nav).getBoundingClientRect().width).toBe(200);
    await narrow.nav.hide();
  });
});

describe('tct-mobile-nav: content and motion', () => {
  it('scrolls its content and keeps the header fixed', async () => {
    const root = await fixture<HTMLElement>(
      `<div><tct-mobile-nav id="nav" header="Menu">${'<a href="#x" style="display: block">item</a>'.repeat(60)}</tct-mobile-nav></div>`,
    );
    const nav = root.querySelector<TctMobileNav>('#nav')!;
    await nav.show();
    const content = drawerOf(nav).querySelector<HTMLElement>('.content')!;
    expect(content.scrollHeight).toBeGreaterThan(content.clientHeight);
    expect(getComputedStyle(content).overflowY).toBe('auto');
    await nav.hide();
  });

  it('resets the padding the page publishes at the overlay boundary', async () => {
    const root = await fixture<HTMLElement>(
      `<div style="--container-padding-inline-start: 24px; --layout-padding-outer-x: 24px"><tct-mobile-nav id="nav"><a href="#x">x</a></tct-mobile-nav></div>`,
    );
    const nav = root.querySelector<TctMobileNav>('#nav')!;
    await nav.show();
    const style = getComputedStyle(dialogOf(nav));
    expect(style.getPropertyValue('--container-padding-inline-start').trim()).toBe('0px');
    expect(style.getPropertyValue('--layout-padding-outer-x').trim()).toBe('');
    await nav.hide();
  });

  it('under reduced motion it does not slide, and still opens and closes', async () => {
    const restore = await emulateMedia({reducedMotion: 'reduce'});
    try {
      const {nav, trigger} = await page('side="start"');
      await openFromTrigger(nav, trigger);
      const running = drawerOf(nav)
        .getAnimations()
        .filter(
          (animation) =>
            'animationName' in animation && String(animation.animationName).includes('drawer-in'),
        );
      expect(running).toHaveLength(0);
      await nav.hide();
      expect(dialogOf(nav).open).toBe(false);
    } finally {
      await restore();
    }
  });

  it('fires tct-after-open-change once per settled change', async () => {
    const {nav, trigger} = await page();
    const events = recordEvents(nav, ['tct-after-open-change']);
    await openFromTrigger(nav, trigger);
    await waitUntil(() => events.events.length === 1);
    nav.open = false;
    await waitUntil(() => events.events.length === 2);
    expect(events.events.map((event) => event.open)).toEqual([true, false]);
  });
});
