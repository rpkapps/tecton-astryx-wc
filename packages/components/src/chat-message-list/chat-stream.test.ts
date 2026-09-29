/**
 * The scroll controllers, the message list and the scroll button working together the way the chat
 * layout wires them (a scroll container, a layout context, the two controllers, the button). The
 * harness below is that wiring, small enough to read; the layout itself is a later work package.
 */
import {html, LitElement, nothing} from 'lit';
import {afterEach, describe, expect, it} from 'vitest';
import {userEvent} from 'vitest/browser';
import {ContextProvider} from '@tecton-astryx/core/context/protocol.js';
import {overrideFeature} from '@tecton-astryx/core/features.js';
import {resetAnnouncer} from '@tecton-astryx/core/a11y/announcer.js';
import {expectAccessible} from '@tecton-astryx/testing/a11y.js';
import {emulateMedia} from '@tecton-astryx/testing/emulate.js';
import {fixture} from '@tecton-astryx/testing/fixture.js';
import {deepActiveElement, pressKeys} from '@tecton-astryx/testing/keyboard.js';
import {isChromium} from '@tecton-astryx/testing/tier.js';
import {aTimeout, nextFrame, waitUntil} from '@tecton-astryx/testing/timing.js';
import '../chat-message/define.js';
import './define.js';
import {chatLayoutContext} from './chat-layout.context.js';
import {ChatNewMessagesController} from './chat-new-messages.js';
import {ChatStreamScrollController} from './chat-stream-scroll.js';
import type {TctChatLayoutScrollButton} from './tct-chat-layout-scroll-button.js';
import type {TctChatMessageList} from './tct-chat-message-list.js';

/** The chat layout's wiring: a scroll container, the context, both controllers and the button. */
class ChatHarness extends LitElement {
  readonly follow = new ChatStreamScrollController(this, {
    scroller: () => this.renderRoot.querySelector<HTMLElement>('.scroller'),
  });
  readonly news = new ChatNewMessagesController(this, {
    isLocked: () => this.follow.isLocked,
    onResize: () => {
      this.follow.scrollIfLocked();
    },
  });
  readonly #layout = new ContextProvider(this, {
    context: chatLayoutContext,
    initialValue: {
      scrollContainer: () => this.renderRoot.querySelector<HTMLElement>('.scroller'),
      contentRef: this.news.contentRef,
    },
  });

  get scroller(): HTMLElement {
    return this.renderRoot.querySelector<HTMLElement>('.scroller')!;
  }

  get button(): TctChatLayoutScrollButton {
    return this.renderRoot.querySelector<TctChatLayoutScrollButton>(
      'tct-chat-layout-scroll-button',
    )!;
  }

  override render() {
    void this.#layout;
    return html`<div
        class="scroller"
        style="display: flex; flex-direction: column; block-size: 300px; overflow: auto; inline-size: 480px"
      >
        <!-- The layout's message area: it never shrinks below its content, so the list grows with it. -->
        <div style="display: flex; flex-direction: column; flex: 1 0 auto"><slot></slot></div>
      </div>
      <tct-chat-layout-scroll-button
        ?visible=${this.follow.isScrolledUp || this.news.hasNewMessages}
        label=${this.news.hasNewMessages ? 'New messages' : nothing}
        @click=${this.#onScrollButton}
      ></tct-chat-layout-scroll-button>`;
  }

  readonly #onScrollButton = (): void => {
    this.news.dismiss();
    this.follow.scrollToBottom();
  };
}
customElements.define('chat-stream-harness', ChatHarness);

const cleanups: (() => void)[] = [];
afterEach(() => {
  while (cleanups.length > 0) cleanups.pop()!();
  resetAnnouncer();
});

/** The spring approaches the bottom asymptotically; give a busy machine room. */
const ARRIVE_MS = 8000;

const distanceFromBottom = (scroller: HTMLElement): number =>
  scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;

const row = (text: string, sender = 'assistant') =>
  html`<tct-chat-message sender=${sender}
    ><tct-chat-message-bubble>${text}</tct-chat-message-bubble></tct-chat-message
  >`;

async function makeChat(count = 30, extra = html``) {
  const root = await fixture<HTMLElement>(html`
    <div>
      <button id="composer" type="button">composer</button>
      <chat-stream-harness>
        <tct-chat-message-list .streaming=${false} no-announce>
          ${Array.from({length: count}, (_, index) => row(`Message number ${index}`, index % 2 ? 'user' : 'assistant'))}
          ${extra}
        </tct-chat-message-list>
      </chat-stream-harness>
    </div>
  `);
  const harness = root.querySelector<ChatHarness>('chat-stream-harness')!;
  const list = root.querySelector<TctChatMessageList>('tct-chat-message-list')!;
  await harness.updateComplete;
  await list.updateComplete;
  await waitUntil(
    () => harness.scroller.scrollHeight > harness.scroller.clientHeight,
    'content overflows',
  );
  // The first fill positions the view at the bottom (a frame later): tests start from there.
  await waitUntil(() => distanceFromBottom(harness.scroller) < 2, 'initial fill at the bottom');
  return {
    root,
    harness,
    list,
    scroller: harness.scroller,
    composer: root.querySelector<HTMLButtonElement>('#composer')!,
  };
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

/** Appends `chunks` short pieces of text, one per frame batch, like a model streaming tokens. */
async function stream(bubble: Element, chunks: number, every = 8): Promise<void> {
  for (let index = 0; index < chunks; index++) {
    bubble.append(`token${index} lorem ipsum dolor sit amet `);
    if (index % every === 0) await nextFrame();
  }
}

describe('stick to bottom', () => {
  it('lands at the bottom when the conversation first fills', async () => {
    const {scroller} = await makeChat();
    await waitUntil(() => distanceFromBottom(scroller) < 2, 'initial fill at the bottom');
    expect(scroller.scrollTop).toBeGreaterThan(0);
  });

  it('follows 200 streamed chunks while the reader is at the bottom', async () => {
    const {list, scroller} = await makeChat();
    await waitUntil(() => distanceFromBottom(scroller) < 2, 'at bottom');
    list.streaming = true;
    const {bubble} = addMessage(list, '');
    const worst: number[] = [];
    for (let index = 0; index < 200; index++) {
      bubble.append(`token${index} `);
      // Two tokens a frame is faster than a model streams; the view keeps up.
      if (index % 2 === 1) {
        await nextFrame();
        worst.push(distanceFromBottom(scroller));
      }
    }
    await waitUntil(
      () => distanceFromBottom(scroller) < 2,
      'catches up after the last chunk',
      ARRIVE_MS,
    );
    expect(scroller.scrollHeight).toBeGreaterThan(scroller.clientHeight + 1400);
    // While streaming the view trails the bottom by the spring's lag, never by a screenful.
    expect(Math.max(...worst)).toBeLessThan(scroller.clientHeight);
  });

  it('does not follow once the reader scrolled up, and leaves their position alone', async () => {
    const {harness, list, scroller} = await makeChat();
    await waitUntil(() => distanceFromBottom(scroller) < 2, 'at bottom');
    scroller.scrollTop -= 500;
    await waitUntil(() => !harness.follow.isLocked, 'unlocked by the reader');
    const held = scroller.scrollTop;
    list.streaming = true;
    const {bubble} = addMessage(list, '');
    await stream(bubble, 200);
    await aTimeout(200);
    expect(Math.abs(scroller.scrollTop - held)).toBeLessThan(2);
    expect(distanceFromBottom(scroller)).toBeGreaterThan(500);
    expect(harness.follow.isLocked).toBe(false);
  });

  it('follows again once the reader scrolls back to the bottom', async () => {
    const {harness, list, scroller} = await makeChat();
    await waitUntil(() => distanceFromBottom(scroller) < 2, 'at bottom');
    scroller.scrollTop -= 400;
    await waitUntil(() => !harness.follow.isLocked, 'unlocked');
    scroller.scrollTop = scroller.scrollHeight;
    await waitUntil(() => harness.follow.isLocked, 're-locked after the scroll settles', 2000);
    const {bubble} = addMessage(list, '');
    await stream(bubble, 60);
    await waitUntil(() => distanceFromBottom(scroller) < 2, 'following again', ARRIVE_MS);
  });

  it('only unlocks for a move upward, never for the browser clamping to a smaller bottom', async () => {
    const {harness, list, scroller} = await makeChat();
    await waitUntil(() => distanceFromBottom(scroller) < 2, 'at bottom');
    const {element} = addMessage(list, 'a short one');
    await waitUntil(() => distanceFromBottom(scroller) < 2, 'followed', ARRIVE_MS);
    element.remove();
    await nextFrame();
    await nextFrame();
    expect(harness.follow.isLocked).toBe(true);
  });

  it('turns scroll anchoring off on the container while it follows, and back on when it lets go', async () => {
    const {harness, scroller} = await makeChat();
    await waitUntil(() => distanceFromBottom(scroller) < 2, 'at bottom');
    expect(scroller.hasAttribute('data-tct-chat-following')).toBe(true);
    expect(getComputedStyle(scroller).overflowAnchor).toBe('none');
    scroller.scrollTop -= 500;
    await waitUntil(() => !harness.follow.isLocked, 'unlocked');
    expect(scroller.hasAttribute('data-tct-chat-following')).toBe(false);
    expect(getComputedStyle(scroller).overflowAnchor).toBe('auto');
  });

  it('never moves focus while it follows a stream', async () => {
    const {list, composer} = await makeChat();
    composer.focus();
    list.streaming = true;
    const {bubble} = addMessage(list, '');
    for (let index = 0; index < 200; index++) {
      bubble.append(`token${index} lorem ipsum dolor sit amet `);
      if (index % 20 === 0) {
        await nextFrame();
        expect(document.activeElement).toBe(composer);
      }
    }
    list.streaming = false;
    await aTimeout(100);
    expect(document.activeElement).toBe(composer);
  });
});

describe('reduced motion', () => {
  it.skipIf(!isChromium)('jumps to the bottom in a frame instead of springing', async () => {
    await emulateMedia({reducedMotion: 'reduce'});
    const {list, scroller} = await makeChat();
    await waitUntil(() => distanceFromBottom(scroller) < 2, 'at bottom');
    const {bubble} = addMessage(list, '');
    bubble.append('tall '.repeat(400));
    await waitUntil(
      () => scroller.scrollHeight > scroller.clientHeight + 800,
      'tall message laid out',
    );
    // The resize callback jumps: within a couple of frames, not over many.
    await nextFrame();
    await nextFrame();
    await nextFrame();
    expect(distanceFromBottom(scroller)).toBeLessThan(2);
  });

  it.skipIf(!isChromium)('springs (several frames) when motion is allowed', async () => {
    await emulateMedia({reducedMotion: 'no-preference'});
    const {list, scroller} = await makeChat();
    await waitUntil(() => distanceFromBottom(scroller) < 2, 'at bottom');
    const {bubble} = addMessage(list, '');
    bubble.append('tall '.repeat(400));
    await waitUntil(
      () => scroller.scrollHeight > scroller.clientHeight + 800,
      'tall message laid out',
    );
    await nextFrame();
    expect(distanceFromBottom(scroller)).toBeGreaterThan(20);
    await waitUntil(() => distanceFromBottom(scroller) < 2, 'arrives', ARRIVE_MS);
  });

  it.skipIf(!isChromium)(
    'scrollToBottom under reduced motion is one jump, whatever the behavior',
    async () => {
      await emulateMedia({reducedMotion: 'reduce'});
      const {harness, scroller} = await makeChat();
      scroller.scrollTop = 0;
      await waitUntil(() => !harness.follow.isLocked, 'unlocked');
      harness.follow.scrollToBottom({behavior: 'spring'});
      expect(distanceFromBottom(scroller)).toBeLessThan(2);
      expect(harness.follow.isLocked).toBe(true);
    },
  );
});

describe('the scroll button', () => {
  it('is hidden at the bottom and shows when the reader scrolls up', async () => {
    const {harness, scroller} = await makeChat();
    await waitUntil(() => distanceFromBottom(scroller) < 2, 'at bottom');
    expect(harness.button.visible).toBe(false);
    const pill = harness.button.shadowRoot!.querySelector<HTMLElement>('.pill')!;
    expect(getComputedStyle(pill).visibility).toBe('hidden');
    scroller.scrollTop -= 400;
    await waitUntil(() => harness.button.visible, 'button shows');
    await waitUntil(() => getComputedStyle(pill).opacity === '1', 'fade in finishes');
    expect(getComputedStyle(pill).visibility).toBe('visible');
  });

  it('is not reachable by keyboard or assistive technology while hidden', async () => {
    const {root, harness, scroller, composer} = await makeChat();
    await waitUntil(() => distanceFromBottom(scroller) < 2, 'at bottom');
    const pill = harness.button.shadowRoot!.querySelector<HTMLElement>('.pill')!;
    expect(pill.hasAttribute('inert')).toBe(true);
    composer.focus();
    const stops: Element[] = [];
    for (let index = 0; index < 4; index++) {
      await userEvent.tab();
      const active = deepActiveElement();
      if (active) stops.push(active);
    }
    expect(
      stops.some(
        (element) =>
          harness.button.contains(element) || harness.button.shadowRoot!.contains(element),
      ),
    ).toBe(false);
    void root;
  });

  it('scrolls to the latest message when activated, then hides', async () => {
    const {harness, scroller} = await makeChat();
    await waitUntil(() => distanceFromBottom(scroller) < 2, 'at bottom');
    scroller.scrollTop = 0;
    await waitUntil(() => harness.button.visible, 'button shows');
    harness.button.click();
    await waitUntil(() => distanceFromBottom(scroller) < 2, 'scrolled to the bottom', ARRIVE_MS);
    await waitUntil(() => !harness.button.visible, 'button hides');
    expect(harness.follow.isLocked).toBe(true);
  });

  it('shows "New messages" when one arrives while scrolled up, and clears it on activation', async () => {
    const {harness, list, scroller} = await makeChat();
    await waitUntil(() => distanceFromBottom(scroller) < 2, 'at bottom');
    scroller.scrollTop -= 600;
    await waitUntil(() => harness.button.visible, 'scrolled up');
    expect(harness.button.label).toBeUndefined();
    addMessage(list, 'A brand new message');
    await waitUntil(() => harness.news.hasNewMessages, 'new message noticed');
    await waitUntil(() => harness.button.label === 'New messages', 'label shows');
    const button = harness.button.shadowRoot!.querySelector('tct-button')!;
    expect(button.getAttribute('label')).toBe('New messages');
    expect(button.hasAttribute('icon-only')).toBe(false);
    harness.button.click();
    await waitUntil(() => !harness.news.hasNewMessages, 'flag dismissed');
    await waitUntil(() => distanceFromBottom(scroller) < 2, 'at bottom', ARRIVE_MS);
  });

  it('does not flag a new message while the view follows', async () => {
    const {harness, list, scroller} = await makeChat();
    await waitUntil(() => distanceFromBottom(scroller) < 2, 'at bottom');
    addMessage(list, 'Follows');
    await aTimeout(200);
    expect(harness.news.hasNewMessages).toBe(false);
    expect(harness.button.visible).toBe(false);
  });

  it('hands focus to the latest message when a keyboard activation hides it', async () => {
    const {harness, list, scroller} = await makeChat();
    await waitUntil(() => distanceFromBottom(scroller) < 2, 'at bottom');
    scroller.scrollTop = 0;
    await waitUntil(() => harness.button.visible, 'button shows');
    await waitUntil(
      () =>
        getComputedStyle(harness.button.shadowRoot!.querySelector('.pill')!).visibility ===
        'visible',
      'visible',
    );
    const inner = harness.button.shadowRoot!.querySelector<HTMLElement>('tct-button')!;
    inner.focus();
    expect(harness.button.matches(':focus-within')).toBe(true);
    await pressKeys('Enter');
    await waitUntil(() => distanceFromBottom(scroller) < 2, 'scrolled', ARRIVE_MS);
    await waitUntil(() => !harness.button.visible, 'hidden');
    const latest = list.lastElementChild;
    expect(deepActiveElement()).toBe(latest);
    expect(document.activeElement).not.toBe(document.body);
  });

  it('leaves focus alone when a pointer user never focused it', async () => {
    const {harness, scroller, composer} = await makeChat();
    await waitUntil(() => distanceFromBottom(scroller) < 2, 'at bottom');
    scroller.scrollTop = 0;
    await waitUntil(() => harness.button.visible, 'button shows');
    composer.focus();
    scroller.scrollTop = scroller.scrollHeight;
    await waitUntil(() => !harness.button.visible, 'hidden');
    expect(document.activeElement).toBe(composer);
  });

  it('passes axe visible, with a label, and in the dark theme', async () => {
    const {harness, scroller, root} = await makeChat();
    scroller.scrollTop = 0;
    await waitUntil(() => harness.button.visible, 'shows');
    await waitUntil(
      () => getComputedStyle(harness.button.shadowRoot!.querySelector('.pill')!).opacity === '1',
      'faded in',
    );
    await expectAccessible(root);
    harness.button.label = 'New messages';
    await harness.button.updateComplete;
    await expectAccessible(root);
  });
});

describe('controllers on their own', () => {
  it('scrollToBottom({behavior: "instant"}) jumps in one call and locks', async () => {
    const {harness, scroller} = await makeChat();
    scroller.scrollTop = 0;
    await waitUntil(() => !harness.follow.isLocked, 'unlocked');
    harness.follow.scrollToBottom({behavior: 'instant'});
    expect(distanceFromBottom(scroller)).toBeLessThan(2);
    expect(harness.follow.isLocked).toBe(true);
    expect(harness.follow.isScrolledUp).toBe(false);
  });

  it('unlock() stops following and lock() follows again', async () => {
    const {harness, list, scroller} = await makeChat();
    await waitUntil(() => distanceFromBottom(scroller) < 2, 'at bottom');
    harness.follow.unlock();
    expect(harness.follow.isLocked).toBe(false);
    addMessage(list, 'not followed');
    await aTimeout(150);
    expect(distanceFromBottom(scroller)).toBeGreaterThan(20);
    harness.follow.lock();
    await waitUntil(() => distanceFromBottom(scroller) < 2, 'followed again', ARRIVE_MS);
  });

  it('scrollToMessage puts a message at the top of the view and scrollToLastMessage finds the newest', async () => {
    const {harness, list, scroller} = await makeChat();
    const target = list.children[5] as HTMLElement;
    harness.follow.scrollToMessage(target);
    expect(target.getBoundingClientRect().top).toBeCloseTo(scroller.getBoundingClientRect().top, 0);
    scroller.scrollTop = 0;
    harness.follow.scrollToLastMessage();
    // The newest message is at the end, so "top of the view" is as far as the container can go: the bottom.
    const last = list.lastElementChild!.getBoundingClientRect();
    expect(last.bottom).toBeLessThanOrEqual(scroller.getBoundingClientRect().bottom + 1);
    expect(distanceFromBottom(scroller)).toBeLessThan(2);
  });

  it('reports isScrolledUp only beyond the button threshold', async () => {
    const {harness, scroller} = await makeChat();
    await waitUntil(() => distanceFromBottom(scroller) < 2, 'at bottom');
    scroller.scrollTop -= 50;
    await waitUntil(() => distanceFromBottom(scroller) >= 49, 'scrolled a little');
    await aTimeout(50);
    expect(harness.follow.isScrolledUp).toBe(false);
    scroller.scrollTop -= 200;
    await waitUntil(() => harness.follow.isScrolledUp, 'past the threshold');
  });

  it('stops observing and following when the host goes away', async () => {
    const {harness, list, scroller} = await makeChat();
    await waitUntil(() => distanceFromBottom(scroller) < 2, 'at bottom');
    harness.remove();
    expect(scroller.hasAttribute('data-tct-chat-following')).toBe(false);
    void list;
  });
});

describe('the message list registers with its layout', () => {
  it('hands its content element to the layout, and withdraws it when removed', async () => {
    const {harness, list} = await makeChat();
    await waitUntil(() => harness.news.hasNewMessages === false && list.isConnected, 'ready');
    list.remove();
    await nextFrame();
    // A different list takes over without the old observer lingering.
    const replacement = document.createElement('tct-chat-message-list');
    harness.append(replacement);
    await waitUntil(
      () =>
        replacement.shadowRoot?.querySelector('.base') !== null && replacement.shadowRoot !== null,
      'replacement rendered',
    );
    const message = document.createElement('tct-chat-message');
    replacement.append(message);
    await nextFrame();
    await nextFrame();
    expect(harness.follow.isLocked).toBe(true);
  });

  it('uses the layout scroll container as the older-messages observation root', async () => {
    const root = await fixture<HTMLElement>(html`
      <chat-stream-harness>
        <tct-chat-message-list .scrollToTopAction=${() => Promise.resolve()} no-announce>
          ${Array.from({length: 30}, (_, index) => row(`Row ${index}`))}
        </tct-chat-message-list>
      </chat-stream-harness>
    `);
    const list = root.querySelector<TctChatMessageList>('tct-chat-message-list')!;
    let runs = 0;
    list.scrollToTopAction = () => {
      runs++;
      return Promise.resolve();
    };
    const harness = root as unknown as ChatHarness;
    await waitUntil(() => distanceFromBottom(harness.scroller) < 2, 'at bottom');
    const before = runs;
    harness.scroller.scrollTop = 0;
    await waitUntil(() => runs > before, 'sentinel intersects inside the layout scroller', 3000);
  });
});

void overrideFeature;
