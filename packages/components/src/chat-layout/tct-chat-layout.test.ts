/// <reference types="@vitest/browser-playwright" />
import {html} from 'lit';
import {afterEach, describe, expect, it} from 'vitest';
import {userEvent} from 'vitest/browser';
import {resetAnnouncer} from '@tecton-wc/core/a11y/announcer.js';
import {expectAccessible} from '@tecton-wc/testing/a11y.js';
import {emulateMedia} from '@tecton-wc/testing/emulate.js';
import {fixture} from '@tecton-wc/testing/fixture.js';
import {deepActiveElement} from '@tecton-wc/testing/keyboard.js';
import {runElementSuite} from '@tecton-wc/testing/suites/element.js';
import {isChromium} from '@tecton-wc/testing/tier.js';
import {nextFrame, waitUntil} from '@tecton-wc/testing/timing.js';
import '../chat-composer/define.js';
import '../chat-message/define.js';
import '../chat-message-list/define.js';
import './define.js';
import type {TctChatComposer} from '../chat-composer/tct-chat-composer.js';
import type {TctChatLayoutScrollButton} from '../chat-message-list/tct-chat-layout-scroll-button.js';
import type {TctChatMessageList} from '../chat-message-list/tct-chat-message-list.js';
import type {TctChatLayout} from './tct-chat-layout.js';

afterEach(() => {
  resetAnnouncer();
});

/** The spring approaches the bottom asymptotically; give a busy machine room. */
const ARRIVE_MS = 8000;

const message = (text: string, sender = 'assistant') =>
  html`<tct-chat-message sender=${sender}
    ><tct-chat-message-bubble>${text}</tct-chat-message-bubble></tct-chat-message
  >`;

const rootOf = (layout: Element): HTMLElement => layout.shadowRoot!.querySelector<HTMLElement>('.root')!;
const areaOf = (layout: Element): HTMLElement => layout.shadowRoot!.querySelector<HTMLElement>('.messages')!;
const dockOf = (layout: Element): HTMLElement =>
  layout.shadowRoot!.querySelector<HTMLElement>('.dock-container')!;
const buttonOf = (layout: Element): TctChatLayoutScrollButton =>
  layout.shadowRoot!.querySelector<TctChatLayoutScrollButton>('tct-chat-layout-scroll-button')!;
const distanceFromBottom = (scroller: HTMLElement): number =>
  scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;

interface Chat {
  frame: HTMLElement;
  layout: TctChatLayout;
  list: TctChatMessageList;
  composer: TctChatComposer;
  scroller: HTMLElement;
}

/** A layout in a bounded column, the way an app places it: a message list, and a composer in the dock. */
async function makeChat(count = 30, attributes = '', height = 420): Promise<Chat> {
  const frame = await fixture<HTMLElement>(html`
    <div style="display: flex; flex-direction: column; block-size: ${height}px; inline-size: 480px">
      <tct-chat-layout>
        <tct-chat-message-list no-announce>
          ${Array.from({length: count}, (_, index) => message(`Message number ${index}`, index % 2 ? 'user' : 'assistant'))}
        </tct-chat-message-list>
        <tct-chat-composer slot="composer"></tct-chat-composer>
      </tct-chat-layout>
    </div>
  `);
  const layout = frame.querySelector<TctChatLayout>('tct-chat-layout')!;
  for (const pair of attributes.split(/\s+/).filter(Boolean)) {
    const [name, value] = pair.split('=');
    layout.setAttribute(name!, value?.replace(/^"|"$/g, '') ?? '');
  }
  const list = layout.querySelector<TctChatMessageList>('tct-chat-message-list')!;
  const composer = layout.querySelector<TctChatComposer>('tct-chat-composer')!;
  await layout.updateComplete;
  await list.updateComplete;
  return {frame, layout, list, composer, scroller: rootOf(layout)};
}

function addMessage(list: TctChatMessageList, text: string, sender = 'assistant') {
  const element = document.createElement('tct-chat-message');
  element.setAttribute('sender', sender);
  const bubble = document.createElement('tct-chat-message-bubble');
  bubble.textContent = text;
  element.append(bubble);
  list.append(element);
  return {element, bubble};
}

/** The first fill positions the view at the bottom (a frame later). */
const filled = async (chat: Chat): Promise<void> => {
  await waitUntil(() => chat.scroller.scrollHeight > chat.scroller.clientHeight, 'content overflows');
  await waitUntil(() => distanceFromBottom(chat.scroller) < 2, 'initial fill at the bottom');
};

runElementSuite({
  tag: 'tct-chat-layout',
  render: () =>
    `<div style="display: flex; flex-direction: column; block-size: 300px"><tct-chat-layout><tct-chat-message-list no-announce></tct-chat-message-list></tct-chat-layout></div>`,
  properties: {density: 'spacious', noScrollButton: true},
  attributes: {density: 'density', noScrollButton: 'no-scroll-button'},
});

describe('tct-chat-layout: the layout contract', () => {
  it('is a flex column that fills its container, with a message area that grows and never shrinks', async () => {
    const {layout} = await makeChat(3);
    expect(getComputedStyle(layout).display).toBe('flex');
    expect(getComputedStyle(rootOf(layout)).display).toBe('flex');
    expect(getComputedStyle(rootOf(layout)).flexDirection).toBe('column');
    const area = getComputedStyle(areaOf(layout));
    // WP-9's requirement: the list grows with its messages, so the resize observer fires.
    expect([area.flexGrow, area.flexShrink]).toEqual(['1', '0']);
    expect(getComputedStyle(rootOf(layout)).containerType).toBe('inline-size');
    expect(layout.getBoundingClientRect().height).toBe(420);
  });

  it('a short transcript fills the layout exactly, with no overflow and no phantom scrollbar', async () => {
    const {scroller} = await makeChat(2);
    await nextFrame();
    expect(scroller.scrollHeight).toBe(scroller.clientHeight);
    expect(scroller.scrollTop).toBe(0);
  });

  it('a long transcript overflows the root, which scrolls; the message area keeps its content height', async () => {
    const chat = await makeChat(40);
    await filled(chat);
    expect(getComputedStyle(chat.scroller).overflowY).toBe('auto');
    expect(getComputedStyle(chat.scroller).overflowX).toBe('hidden');
    expect(areaOf(chat.layout).getBoundingClientRect().height).toBeGreaterThan(chat.scroller.clientHeight);
  });

  it('docks the composer at the bottom, sticky, above the transcript', async () => {
    const chat = await makeChat(40);
    await filled(chat);
    expect(getComputedStyle(dockOf(chat.layout)).position).toBe('sticky');
    const dock = chat.layout.shadowRoot!.querySelector('.dock')!.getBoundingClientRect();
    const layout = chat.layout.getBoundingClientRect();
    // Flush with the bottom of the layout, whatever the scroll position (the padding is inside the dock).
    expect(Math.abs(layout.bottom - dock.bottom)).toBeLessThan(2);
    chat.scroller.scrollTop = 0;
    await nextFrame();
    const after = chat.layout.shadowRoot!.querySelector('.dock')!.getBoundingClientRect();
    expect(after.bottom).toBe(dock.bottom);
    expect(chat.composer.getBoundingClientRect().bottom).toBeLessThanOrEqual(layout.bottom);
  });

  it('paints a frosted glass layer behind the dock: blur with a mask, never catching pointer events', async () => {
    const chat = await makeChat(3);
    const blur = getComputedStyle(chat.layout.shadowRoot!.querySelector('.blur')!);
    expect(blur.backdropFilter).toContain('blur(12px)');
    expect(blur.pointerEvents).toBe('none');
    expect(blur.maskImage).toContain('linear-gradient');
    expect(getComputedStyle(dockOf(chat.layout)).pointerEvents).toBe('none');
    expect(getComputedStyle(chat.layout.shadowRoot!.querySelector('.dock')!).pointerEvents).toBe('auto');
  });

  it('honours the reduced-transparency-free forced colours setting (no blur layer)', async () => {
    if (!isChromium) return;
    const restore = await emulateMedia({forcedColors: 'active'});
    try {
      const chat = await makeChat(3);
      expect(getComputedStyle(chat.layout.shadowRoot!.querySelector('.blur')!).display).toBe('none');
    } finally {
      await restore();
    }
  });
});

describe('tct-chat-layout: the empty state', () => {
  it('shows the empty state, centred, while the default slot has no content', async () => {
    const frame = await fixture<HTMLElement>(
      `<div style="display: flex; flex-direction: column; block-size: 420px; inline-size: 480px"><tct-chat-layout><p slot="empty-state" id="empty">Nothing yet</p><tct-chat-composer slot="composer"></tct-chat-composer></tct-chat-layout></div>`,
    );
    const layout = frame.querySelector<TctChatLayout>('tct-chat-layout')!;
    const empty = layout.shadowRoot!.querySelector<HTMLElement>('.empty')!;
    expect(empty).not.toBeNull();
    const text = layout.querySelector('#empty')!.getBoundingClientRect();
    const box = empty.getBoundingClientRect();
    expect(Math.abs(text.left + text.width / 2 - (box.left + box.width / 2))).toBeLessThan(2);
    expect(box.height).toBeGreaterThanOrEqual(200);
  });

  it('prefers content over the empty state, and swaps back when the content goes', async () => {
    const chat = await makeChat(1);
    const note = document.createElement('p');
    note.slot = 'empty-state';
    note.id = 'empty';
    note.textContent = 'Nothing yet';
    chat.layout.append(note);
    await chat.layout.updateComplete;
    expect(chat.layout.shadowRoot!.querySelector('.empty')).toBeNull();
    chat.list.remove();
    await waitUntil(() => chat.layout.shadowRoot!.querySelector('.empty') !== null, 'the empty state appears');
    expect(chat.layout.shadowRoot!.querySelector('slot:not([name])')).toBeNull();
  });

  it('renders nothing extra without an empty state', async () => {
    const frame = await fixture<HTMLElement>(
      `<div style="display: flex; flex-direction: column; block-size: 300px"><tct-chat-layout></tct-chat-layout></div>`,
    );
    const layout = frame.querySelector<TctChatLayout>('tct-chat-layout')!;
    expect(layout.shadowRoot!.querySelector('.empty')).toBeNull();
  });
});

describe('tct-chat-layout: density', () => {
  it('steps the dock padding, the column width and the blur size together', async () => {
    const compact = await makeChat(2, 'density=compact');
    const balanced = await makeChat(2);
    const spacious = await makeChat(2, 'density=spacious', 420);
    const dockPadding = (chat: Chat): number =>
      parseFloat(getComputedStyle(chat.layout.shadowRoot!.querySelector('.dock')!).paddingBlockEnd);
    expect(dockPadding(compact)).toBeLessThan(dockPadding(balanced));
    const blurHeight = (chat: Chat): number =>
      chat.layout.shadowRoot!.querySelector('.blur')!.getBoundingClientRect().height;
    expect(blurHeight(compact)).toBe(80);
    expect(blurHeight(balanced)).toBe(100);
    expect(blurHeight(spacious)).toBe(120);
    expect(getComputedStyle(areaOf(compact.layout)).maxWidth).toBe('100%');
    expect(getComputedStyle(areaOf(spacious.layout)).maxWidth).toBe('800px');
    expect(parseFloat(getComputedStyle(areaOf(spacious.layout)).paddingInlineStart)).toBeGreaterThan(0);
    expect(parseFloat(getComputedStyle(areaOf(balanced.layout)).paddingInlineStart)).toBe(0);
    expect(compact.layout.getAttribute('density')).toBe('compact');
    expect(balanced.layout.getAttribute('density')).toBe('balanced');
  });

  it('falls back to balanced for an unknown value', async () => {
    const chat = await makeChat(2, 'density=huge');
    expect(chat.layout.shadowRoot!.querySelector('.blur')!.getBoundingClientRect().height).toBe(100);
  });

  it('centres a spacious column and caps it at 800px on a wide container', async () => {
    const frame = await fixture<HTMLElement>(
      `<div style="display: flex; flex-direction: column; block-size: 300px; inline-size: 1200px"><tct-chat-layout density="spacious"><tct-chat-message-list no-announce></tct-chat-message-list><tct-chat-composer slot="composer"></tct-chat-composer></tct-chat-layout></div>`,
    );
    const layout = frame.querySelector<TctChatLayout>('tct-chat-layout')!;
    const area = areaOf(layout).getBoundingClientRect();
    expect(area.width).toBe(800);
    const outer = layout.getBoundingClientRect();
    expect(Math.abs(area.left - outer.left - (outer.right - area.right))).toBeLessThan(2);
    const composer = layout.querySelector('tct-chat-composer')!.getBoundingClientRect();
    expect(composer.width).toBeLessThanOrEqual(800);
  });
});

describe('tct-chat-layout: stick to bottom and the scroll button', () => {
  it('lands at the bottom when the conversation fills, and follows a streamed reply while the reader is there', async () => {
    const chat = await makeChat();
    await filled(chat);
    chat.list.streaming = true;
    const {bubble} = addMessage(chat.list, '');
    for (let index = 0; index < 120; index++) {
      bubble.append(`token${index} lorem ipsum dolor sit `);
      if (index % 4 === 3) await nextFrame();
    }
    await waitUntil(() => distanceFromBottom(chat.scroller) < 2, 'catches up', ARRIVE_MS);
    expect(chat.scroller.scrollHeight).toBeGreaterThan(chat.scroller.clientHeight + 600);
    expect(chat.layout.isFollowing).toBe(true);
    expect(chat.layout.isScrolledUp).toBe(false);
  });

  it('lets go when the reader scrolls up, shows the button, and leaves their position alone while streaming', async () => {
    const chat = await makeChat();
    await filled(chat);
    expect(buttonOf(chat.layout).visible).toBe(false);
    chat.scroller.scrollTop -= 500;
    await waitUntil(() => !chat.layout.isFollowing, 'unlocked by the reader');
    await waitUntil(() => buttonOf(chat.layout).visible, 'the button shows');
    expect(chat.layout.isScrolledUp).toBe(true);
    const held = chat.scroller.scrollTop;
    chat.list.streaming = true;
    const {bubble} = addMessage(chat.list, '');
    for (let index = 0; index < 100; index++) {
      bubble.append(`token${index} lorem ipsum dolor sit `);
      if (index % 4 === 3) await nextFrame();
    }
    expect(Math.abs(chat.scroller.scrollTop - held)).toBeLessThan(2);
    expect(distanceFromBottom(chat.scroller)).toBeGreaterThan(400);
  });

  it('offers "New messages" when one arrives below the fold, and clears it when the button is used', async () => {
    const chat = await makeChat();
    await filled(chat);
    chat.scroller.scrollTop -= 400;
    await waitUntil(() => !chat.layout.isFollowing, 'unlocked');
    addMessage(chat.list, 'Something new');
    await waitUntil(() => chat.layout.hasNewMessages, 'the new message is noticed');
    const button = buttonOf(chat.layout);
    await waitUntil(() => button.label === 'New messages', 'the button is labelled');
    expect(button.visible).toBe(true);
    button.shadowRoot!.querySelector('tct-button')!.shadowRoot!.querySelector('button')!.click();
    await waitUntil(() => distanceFromBottom(chat.scroller) < 2, 'scrolled to the bottom', ARRIVE_MS);
    expect(chat.layout.hasNewMessages).toBe(false);
    await waitUntil(() => !button.visible, 'the button hides');
    expect(button.label ?? undefined).toBeUndefined();
    expect(chat.layout.isFollowing).toBe(true);
  });

  it('hands focus to the newest message when the focused button hides after its activation', async () => {
    const chat = await makeChat();
    await filled(chat);
    chat.scroller.scrollTop = 0;
    await waitUntil(() => buttonOf(chat.layout).visible, 'the button shows');
    const native = buttonOf(chat.layout).shadowRoot!.querySelector('tct-button')!.shadowRoot!.querySelector('button')!;
    await waitUntil(
      () => getComputedStyle(buttonOf(chat.layout).shadowRoot!.querySelector('.pill')!).visibility === 'visible',
      'the pill is visible',
    );
    native.focus();
    await userEvent.keyboard('{Enter}');
    await waitUntil(() => distanceFromBottom(chat.scroller) < 2, 'at the bottom', ARRIVE_MS);
    await waitUntil(() => !buttonOf(chat.layout).visible, 'hidden');
    const active = deepActiveElement();
    expect(active).not.toBe(document.body);
    expect(chat.list.querySelector('tct-chat-message:last-of-type')!.contains(active) || active === chat.list.querySelector('tct-chat-message:last-of-type')).toBe(true);
  });

  it('scrollToBottom() jumps or springs, follows again and dismisses the hint', async () => {
    const chat = await makeChat();
    await filled(chat);
    chat.scroller.scrollTop = 0;
    await waitUntil(() => !chat.layout.isFollowing, 'unlocked');
    chat.layout.scrollToBottom({behavior: 'instant'});
    expect(distanceFromBottom(chat.scroller)).toBeLessThan(2);
    expect(chat.layout.isFollowing).toBe(true);
  });

  it('is never the first tab stop, and reachable only while visible', async () => {
    const chat = await makeChat(40);
    await filled(chat);
    const before = document.createElement('button');
    chat.frame.parentElement!.prepend(before);
    before.focus();
    await userEvent.tab();
    // The next stop after the page is the list (a log with tabindex 0) or the composer, never the hidden pill.
    const active = deepActiveElement();
    expect(buttonOf(chat.layout).shadowRoot!.contains(active)).toBe(false);
    before.remove();
  });

  it('under reduced motion follows in one jump', async () => {
    if (!isChromium) return;
    const restore = await emulateMedia({reducedMotion: 'reduce'});
    try {
      const chat = await makeChat();
      await filled(chat);
      const {bubble} = addMessage(chat.list, '');
      bubble.append('tall '.repeat(400));
      await waitUntil(() => chat.scroller.scrollHeight > chat.scroller.clientHeight + 600, 'tall message');
      await nextFrame();
      await nextFrame();
      await nextFrame();
      expect(distanceFromBottom(chat.scroller)).toBeLessThan(2);
    } finally {
      await restore();
    }
  });
});

describe('tct-chat-layout: the scroll button slot', () => {
  it('replaces the default button with your own, which the layout leaves alone', async () => {
    const frame = await fixture<HTMLElement>(
      `<div style="display: flex; flex-direction: column; block-size: 300px"><tct-chat-layout><tct-chat-message-list no-announce></tct-chat-message-list><button slot="scroll-button" type="button" id="mine">Down</button></tct-chat-layout></div>`,
    );
    const layout = frame.querySelector<TctChatLayout>('tct-chat-layout')!;
    expect(layout.shadowRoot!.querySelector('tct-chat-layout-scroll-button')).toBeNull();
    expect(layout.querySelector<HTMLElement>('#mine')!.getBoundingClientRect().height).toBeGreaterThan(0);
  });

  it('no-scroll-button renders no button at all', async () => {
    const chat = await makeChat(30, 'no-scroll-button');
    expect(chat.layout.shadowRoot!.querySelector('tct-chat-layout-scroll-button')).toBeNull();
    expect(chat.layout.shadowRoot!.querySelector('slot[name="scroll-button"]')).toBeNull();
    await filled(chat);
    // Auto-scroll still works.
    const {element} = addMessage(chat.list, 'more');
    await waitUntil(() => distanceFromBottom(chat.scroller) < 2, 'still follows', ARRIVE_MS);
    element.remove();
  });
});

describe('tct-chat-layout: an external scroller', () => {
  it('scrolls another element, docks the composer fixed, and does not scroll itself', async () => {
    const outer = await fixture<HTMLElement>(html`
      <div id="outer" style="block-size: 360px; inline-size: 480px; overflow: auto; position: relative; transform: translateZ(0)">
        <tct-chat-layout style="flex: none">
          <tct-chat-message-list no-announce>
            ${Array.from({length: 30}, (_, index) => message(`Message number ${index}`))}
          </tct-chat-message-list>
          <tct-chat-composer slot="composer"></tct-chat-composer>
        </tct-chat-layout>
      </div>
    `);
    const layout = outer.querySelector<TctChatLayout>('tct-chat-layout')!;
    layout.scrollTarget = outer;
    await layout.updateComplete;
    expect(getComputedStyle(dockOf(layout)).position).toBe('fixed');
    expect(getComputedStyle(rootOf(layout)).overflowY).toBe('visible');
    await waitUntil(() => outer.scrollHeight > outer.clientHeight, 'the outer element overflows');
    await waitUntil(() => distanceFromBottom(outer) < 2, 'lands at the bottom of the outer scroller', ARRIVE_MS);
    outer.scrollTop = 0;
    await waitUntil(() => buttonOf(layout).visible, 'the button follows the outer scroller');
    layout.scrollToBottom({behavior: 'instant'});
    expect(distanceFromBottom(outer)).toBeLessThan(2);
  });

  it('a selector in scroll-target names the scroller', async () => {
    const outer = await fixture<HTMLElement>(html`
      <div id="chat-outer" style="block-size: 300px; inline-size: 480px; overflow: auto; transform: translateZ(0)">
        <tct-chat-layout scroll-target="#chat-outer" style="flex: none">
          <tct-chat-message-list no-announce>
            ${Array.from({length: 30}, (_, index) => message(`Message number ${index}`))}
          </tct-chat-message-list>
          <tct-chat-composer slot="composer"></tct-chat-composer>
        </tct-chat-layout>
      </div>
    `);
    const layout = outer.querySelector<TctChatLayout>('tct-chat-layout')!;
    await layout.updateComplete;
    await waitUntil(() => distanceFromBottom(outer) < 2, 'the selected element is followed', ARRIVE_MS);
    expect(getComputedStyle(dockOf(layout)).position).toBe('fixed');
  });

  it('scroll-target="document" follows the page: the scroll button appears when the reader scrolls the page up', async () => {
    const frame = await fixture<HTMLElement>(html`
      <div style="inline-size: 480px">
        <tct-chat-layout scroll-target="document" style="flex: none">
          <tct-chat-message-list no-announce>
            ${Array.from({length: 60}, (_, index) => message(`Message number ${index}`))}
          </tct-chat-message-list>
          <tct-chat-composer slot="composer"></tct-chat-composer>
        </tct-chat-layout>
      </div>
    `);
    const layout = frame.querySelector<TctChatLayout>('tct-chat-layout')!;
    const page = document.scrollingElement as HTMLElement;
    try {
      await layout.updateComplete;
      await waitUntil(() => page.scrollHeight > page.clientHeight, 'the page overflows');
      await waitUntil(() => distanceFromBottom(page) < 2, 'the page is at the bottom', ARRIVE_MS);
      expect(layout.isFollowing).toBe(true);
      page.scrollTop = 0;
      await waitUntil(() => layout.isScrolledUp, 'the layout notices the page scroll');
      await waitUntil(() => buttonOf(layout).visible, 'the button shows');
      layout.scrollToBottom({behavior: 'instant'});
      expect(distanceFromBottom(page)).toBeLessThan(2);
    } finally {
      page.scrollTop = 0;
    }
  });
});

describe('tct-chat-layout: composing with the composer', () => {
  it('a message sent from the composer reaches the transcript and the layout follows it', async () => {
    const chat = await makeChat();
    await filled(chat);
    chat.composer.addEventListener('tct-chat-submit', (event) => {
      addMessage(chat.list, event.value, 'user');
    });
    const editable = chat.composer.shadowRoot!.querySelector('tct-chat-composer-input')!.shadowRoot!.querySelector<HTMLElement>('.editable')!;
    editable.focus();
    await userEvent.keyboard('hello from the composer{Enter}');
    await waitUntil(() => chat.list.textContent.includes('hello from the composer'), 'the message arrived');
    await waitUntil(() => distanceFromBottom(chat.scroller) < 2, 'followed', ARRIVE_MS);
    expect(chat.composer.value).toBe('');
  });

  it('the first tab stop is the composer, not the hidden scroll button, and tab order flows list to composer', async () => {
    const chat = await makeChat(3);
    const before = document.createElement('button');
    chat.frame.parentElement!.prepend(before);
    before.focus();
    const seen: Element[] = [];
    for (let i = 0; i < 4; i++) {
      await userEvent.tab();
      const active = deepActiveElement();
      if (active) seen.push(active);
    }
    expect(seen.some((element) => buttonOf(chat.layout).shadowRoot!.contains(element))).toBe(false);
    expect(seen.some((element) => element.classList.contains('editable'))).toBe(true);
    before.remove();
  });
});

describe('tct-chat-layout: accessibility, localisation and direction', () => {
  it('passes axe in light and dark, with a transcript, a composer and a visible scroll button', async () => {
    for (const theme of ['light', 'dark'] as const) {
      const frame = await fixture<HTMLElement>(html`
        <div style="display: flex; flex-direction: column; block-size: 420px; inline-size: 480px">
          <tct-chat-layout>
            <tct-chat-message-list no-announce>
              ${Array.from({length: 20}, (_, index) => message(`Message number ${index}`, index % 2 ? 'user' : 'assistant'))}
            </tct-chat-message-list>
            <tct-chat-composer slot="composer"></tct-chat-composer>
          </tct-chat-layout>
        </div>
      `, {theme});
      const layout = frame.querySelector<TctChatLayout>('tct-chat-layout')!;
      await waitUntil(() => distanceFromBottom(rootOf(layout)) < 2, 'at the bottom', ARRIVE_MS);
      await expectAccessible(frame);
      rootOf(layout).scrollTop = 0;
      await waitUntil(() => buttonOf(layout).visible, 'the button shows');
      await waitUntil(
        () => getComputedStyle(buttonOf(layout).shadowRoot!.querySelector('.pill')!).opacity === '1',
        'the fade finished',
      );
      await expectAccessible(frame);
    }
  });

  it('labels the new-messages hint in German', async () => {
    const frame = await fixture<HTMLElement>(html`
      <div lang="de-DE" style="display: flex; flex-direction: column; block-size: 300px; inline-size: 480px">
        <tct-chat-layout>
          <tct-chat-message-list no-announce>
            ${Array.from({length: 20}, (_, index) => message(`Nachricht ${index}`))}
          </tct-chat-message-list>
          <tct-chat-composer slot="composer"></tct-chat-composer>
        </tct-chat-layout>
      </div>
    `);
    const layout = frame.querySelector<TctChatLayout>('tct-chat-layout')!;
    const list = layout.querySelector<TctChatMessageList>('tct-chat-message-list')!;
    await waitUntil(() => distanceFromBottom(rootOf(layout)) < 2, 'at the bottom', ARRIVE_MS);
    rootOf(layout).scrollTop -= 300;
    await waitUntil(() => !layout.isFollowing, 'unlocked');
    addMessage(list, 'Neu');
    await waitUntil(() => {
      const label = buttonOf(layout).label;
      return label != null && label !== 'New messages';
    }, 'the hint shows in German');
  });

  it('mirrors in right-to-left: the dock stays at the bottom, the column stays centred', async () => {
    const frame = await fixture<HTMLElement>(
      html`<div style="display: flex; flex-direction: column; block-size: 300px; inline-size: 480px"><tct-chat-layout density="spacious"><tct-chat-message-list no-announce></tct-chat-message-list><tct-chat-composer slot="composer"></tct-chat-composer></tct-chat-layout></div>`,
      {dir: 'rtl'},
    );
    const layout = frame.querySelector<TctChatLayout>('tct-chat-layout')!;
    const layoutRect = layout.getBoundingClientRect();
    const composer = layout.querySelector('tct-chat-composer')!.getBoundingClientRect();
    expect(composer.bottom).toBeLessThanOrEqual(layoutRect.bottom);
    expect(composer.left).toBeGreaterThanOrEqual(layoutRect.left);
    expect(composer.right).toBeLessThanOrEqual(layoutRect.right);
  });

  it('assigns no landmark role or name to the regions it holds', async () => {
    const chat = await makeChat(3);
    const roles = [...chat.layout.shadowRoot!.querySelectorAll('[role]')];
    expect(roles).toHaveLength(0);
    expect(chat.layout.hasAttribute('role')).toBe(false);
  });
});
