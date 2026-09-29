import {html} from 'lit';
import {afterEach, describe, expect, it} from 'vitest';
import {userEvent} from 'vitest/browser';
import {getAnnouncerRegions, resetAnnouncer} from '@tecton-astryx/core/a11y/announcer.js';
import {overrideFeature} from '@tecton-astryx/core/features.js';
import {axNode, expectAccessible} from '@tecton-astryx/testing/a11y.js';
import {fixture} from '@tecton-astryx/testing/fixture.js';
import {deepActiveElement} from '@tecton-astryx/testing/keyboard.js';
import {runElementSuite} from '@tecton-astryx/testing/suites/element.js';
import {isChromium, isTier2} from '@tecton-astryx/testing/tier.js';
import {aTimeout, nextFrame, waitUntil} from '@tecton-astryx/testing/timing.js';
import '../avatar/define.js';
import '../chat-message/define.js';
import '../chat-system-message/define.js';
import './define.js';
import type {TctChatMessage} from '../chat-message/tct-chat-message.js';
import type {TctChatMessageList} from './tct-chat-message-list.js';

const cleanups: (() => void)[] = [];
afterEach(() => {
  while (cleanups.length > 0) cleanups.pop()!();
  resetAnnouncer();
});

/** Replaces the announcer's transport with a recorder (it uses `ariaNotify` when the engine has it). */
function spyOnAnnouncements(): string[] {
  const messages: string[] = [];
  const restore = overrideFeature('ariaNotify', true);
  (document.body as unknown as {ariaNotify: (message: string) => void}).ariaNotify = (message) => {
    messages.push(message);
  };
  cleanups.push(() => {
    delete (document.body as unknown as {ariaNotify?: unknown}).ariaNotify;
    restore();
  });
  return messages;
}

/** Chromium reports `aria-busy` as "1"; other spellings mean the same. */
const isBusy = (node: Record<string, string | undefined>): boolean =>
  node.busy === 'true' || node.busy === '1';

const part = (element: Element, name: string): HTMLElement | null =>
  element.shadowRoot!.querySelector<HTMLElement>(`[part~="${name}"]`);

async function makeList(rows = '', attributes = '', options = {}): Promise<TctChatMessageList> {
  const root = await fixture<HTMLElement>(
    `<div style="block-size: 400px; display: flex; flex-direction: column; inline-size: 500px"><tct-chat-message-list ${attributes}>${rows}</tct-chat-message-list></div>`,
    options,
  );
  const list = root.querySelector<TctChatMessageList>('tct-chat-message-list')!;
  await list.updateComplete;
  return list;
}

const message = (sender: string, text: string, name = '') =>
  `<tct-chat-message sender="${sender}" ${name ? `name="${name}"` : ''}><tct-chat-message-bubble>${text}</tct-chat-message-bubble></tct-chat-message>`;

function append(list: TctChatMessageList, sender: string, text: string, name = ''): TctChatMessage {
  const holder = document.createElement('div');
  // Test-only: markup authored in this file.
  holder.innerHTML = message(sender, text, name);
  const element = holder.firstElementChild as TctChatMessage;
  list.append(element);
  return element;
}

/** Waits past the list's quiet period (500 ms) and the announcer's own debounce. */
const settleAnnouncements = () => aTimeout(900);

runElementSuite({
  tag: 'tct-chat-message-list',
  render: () => `<tct-chat-message-list>${message('assistant', 'Hello')}</tct-chat-message-list>`,
  properties: {density: 'compact', align: 'top', streaming: true, noAnnounce: true, gap: 2},
  attributes: {
    density: 'density',
    align: 'align',
    streaming: 'streaming',
    noAnnounce: 'no-announce',
    gap: 'gap',
  },
});

describe('tct-chat-message-list: semantics', () => {
  it('is a focusable log with its native live region off', async () => {
    const list = await makeList(message('assistant', 'Hi'));
    expect(list.tabIndex).toBe(0);
    if (isChromium) {
      const node = await axNode(list);
      expect(node.role).toBe('log');
      // Speech is the announcer's job: a live log would read a streaming message token by token.
      expect(node.live).not.toBe('polite');
    }
  });

  it('keeps an author tabindex', async () => {
    const list = await makeList('', 'tabindex="-1"');
    expect(list.tabIndex).toBe(-1);
  });

  it('is aria-busy while streaming, and clears it after', async () => {
    const list = await makeList(message('assistant', 'Hi'));
    if (!isChromium) return;
    expect(isBusy(await axNode(list))).toBe(false);
    list.streaming = true;
    await list.updateComplete;
    expect(isBusy(await axNode(list))).toBe(true);
    if (!isTier2) expect(list.matches(':state(busy)')).toBe(true);
    list.streaming = false;
    await list.updateComplete;
    expect(isBusy(await axNode(list))).toBe(false);
    if (!isTier2) expect(list.matches(':state(busy)')).toBe(false);
  });

  it('passes axe with messages, a system message and an empty state, light and dark', async () => {
    const rows = `${message('user', 'Question', '')}${message('assistant', 'Answer', 'Navi')}<tct-chat-system-message variant="divider">Today</tct-chat-system-message>`;
    await expectAccessible(await makeList(rows));
    const dark = await fixture<HTMLElement>(
      `<div style="background: var(--color-background-body)"><tct-chat-message-list>${rows}</tct-chat-message-list></div>`,
      {theme: 'dark'},
    );
    await expectAccessible(dark);
  });
});

describe('tct-chat-message-list: layout', () => {
  it('rests a short conversation at the bottom by default, and at the top with align="top"', async () => {
    const bottom = await makeList(message('assistant', 'Hi'));
    const container = bottom.parentElement!.getBoundingClientRect();
    const rowBottom = bottom.querySelector('tct-chat-message')!.getBoundingClientRect().bottom;
    // Balanced padding is 16px.
    expect(rowBottom).toBeCloseTo(container.bottom - 16, 0);
    expect(bottom.shadowRoot!.querySelector('.spacer')).not.toBeNull();

    const top = await makeList(message('assistant', 'Hi'), 'align="top"');
    const topBox = top.parentElement!.getBoundingClientRect();
    expect(top.querySelector('tct-chat-message')!.getBoundingClientRect().top).toBeCloseTo(
      topBox.top + 16,
      0,
    );
    expect(top.shadowRoot!.querySelector('.spacer')).toBeNull();
    expect(top.getAttribute('align')).toBe('top');
  });

  it('scrolls the same way for both alignments once the messages overflow', async () => {
    const rows = Array.from({length: 30}, (_, index) => message('assistant', `Row ${index}`)).join(
      '',
    );
    for (const align of ['top', 'bottom']) {
      const list = await makeList(rows, `align="${align}"`);
      const spacer = list.shadowRoot!.querySelector<HTMLElement>('.spacer');
      expect(spacer ? spacer.getBoundingClientRect().height : 0).toBe(0);
      const container = list.parentElement!.getBoundingClientRect();
      const last = list.lastElementChild!.getBoundingClientRect();
      expect(last.bottom).toBeGreaterThan(container.bottom);
      // Both start at the top of the first row: the spacer never opens a gap.
      expect(list.firstElementChild!.getBoundingClientRect().top).toBeCloseTo(
        container.top + 16,
        0,
      );
    }
  });

  it.each([
    ['compact', '8px', '8px', '12px'],
    ['balanced', '16px', '16px', '16px'],
    ['spacious', '24px', '24px', '24px'],
  ] as const)(
    '%s density spaces rows by %s and pads by %s / %s',
    async (density, gap, padBlock, padInline) => {
      const list = await makeList(
        `${message('assistant', 'a')}${message('assistant', 'b')}`,
        `align="top" density="${density}"`,
      );
      const style = getComputedStyle(part(list, 'base')!);
      expect(style.rowGap).toBe(gap);
      expect(style.paddingBlockStart).toBe(padBlock);
      expect(style.paddingInlineStart).toBe(padInline);
    },
  );

  it('lets gap override only the row gap, leaving the density padding', async () => {
    const list = await makeList(
      `${message('assistant', 'a')}${message('assistant', 'b')}`,
      'density="compact" gap="1.5" align="top"',
    );
    const style = getComputedStyle(part(list, 'base')!);
    expect(style.rowGap).toBe('6px');
    expect(style.paddingBlockStart).toBe('8px');
  });

  it('passes the density to every message, which can override it', async () => {
    const list = await makeList(
      `<tct-chat-message id="a">x</tct-chat-message><tct-chat-message id="b" density="spacious">y</tct-chat-message>`,
      'density="compact"',
    );
    await waitUntil(
      () => part(list.querySelector('#a')!, 'base')?.dataset.density === 'compact',
      'density context',
    );
    expect(part(list.querySelector('#b')!, 'base')!.dataset.density).toBe('spacious');
  });

  it('shows the empty state only while there are no messages', async () => {
    const list = await makeList('<p slot="empty-state" id="empty">Nothing yet</p>');
    expect(part(list, 'empty')).not.toBeNull();
    expect(
      list.querySelector<HTMLElement>('#empty')!.getBoundingClientRect().height,
    ).toBeGreaterThan(0);
    append(list, 'assistant', 'Hello');
    await waitUntil(() => part(list, 'empty') === null, 'empty state hides');
    expect(list.querySelector<HTMLElement>('#empty')!.getBoundingClientRect().height).toBe(0);
  });

  it('renders the empty state alone, without a spacer pushing it down (top-aligned)', async () => {
    const list = await makeList('<p slot="empty-state">Nothing yet</p>', 'align="top"');
    expect(part(list, 'empty')!.getBoundingClientRect().height).toBeGreaterThan(100);
  });

  it('renders right-to-left', async () => {
    const list = await makeList(message('user', 'مرحبا'), '', {dir: 'rtl', lang: 'ar-SA'});
    const box = list.getBoundingClientRect();
    const bubble = list
      .querySelector('tct-chat-message-bubble')!
      .shadowRoot!.querySelector('[part~="bubble"]')!
      .getBoundingClientRect();
    expect(bubble.left).toBeGreaterThanOrEqual(box.left);
    expect(bubble.left - box.left).toBeLessThan(40);
  });
});

describe('tct-chat-message-list: older messages (scrollToTopAction)', () => {
  async function scrolling(action: () => Promise<void>) {
    const root = await fixture<HTMLElement>(html`
      <div id="scroller" style="block-size: 200px; overflow: auto; inline-size: 400px">
        <tct-chat-message-list .scrollToTopAction=${action}
          >${Array.from({length: 20}, (_, index) => html`<tct-chat-message><tct-chat-message-bubble>Row ${index}</tct-chat-message-bubble></tct-chat-message>`)}</tct-chat-message-list
        >
      </div>
    `);
    return {scroller: root, list: root.querySelector<TctChatMessageList>('tct-chat-message-list')!};
  }

  it('renders a sentinel only when there is an action', async () => {
    const plain = await makeList(message('assistant', 'x'));
    expect(plain.shadowRoot!.querySelector('.sentinel')).toBeNull();
    const list = await makeList(message('assistant', 'x'));
    list.scrollToTopAction = () => Promise.resolve();
    await list.updateComplete;
    expect(list.shadowRoot!.querySelector('.sentinel')).not.toBeNull();
  });

  it('runs the action when the top scrolls into view, with a busy spinner while it is pending', async () => {
    let release!: () => void;
    let runs = 0;
    const {scroller, list} = await scrolling(() => {
      runs++;
      return new Promise<void>((resolve) => {
        release = resolve;
      });
    });
    scroller.scrollTop = 400;
    await aTimeout(100);
    runs = 0;
    scroller.scrollTop = 0;
    await waitUntil(() => runs > 0, 'action runs');
    await waitUntil(() => part(list, 'loading') !== null, 'spinner shows');
    expect(part(list, 'loading')!.querySelector('tct-spinner')).not.toBeNull();
    if (isChromium) expect(isBusy(await axNode(list))).toBe(true);
    release();
    await waitUntil(() => part(list, 'loading') === null, 'spinner goes');
    if (isChromium) expect(isBusy(await axNode(list))).toBe(false);
  });

  it('does not start a second run while one is pending', async () => {
    let runs = 0;
    let release!: () => void;
    const {scroller, list} = await scrolling(() => {
      runs++;
      return new Promise<void>((resolve) => {
        release = resolve;
      });
    });
    await waitUntil(() => runs > 0, 'first run (list starts at the top)');
    scroller.scrollTop = 500;
    await aTimeout(80);
    scroller.scrollTop = 0;
    await aTimeout(150);
    expect(runs).toBe(1);
    release();
    await waitUntil(() => part(list, 'loading') === null, 'settled');
  });

  it('recovers from a failing action', async () => {
    const {list} = await scrolling(() => Promise.reject(new Error('offline')));
    const errors: unknown[] = [];
    const onRejection = (event: PromiseRejectionEvent) => {
      errors.push(event.reason);
      event.preventDefault();
    };
    window.addEventListener('unhandledrejection', onRejection);
    cleanups.push(() => {
      window.removeEventListener('unhandledrejection', onRejection);
    });
    await waitUntil(() => errors.length > 0, 'rejection surfaces to the app');
    expect(part(list, 'loading')).toBeNull();
  });
});

describe('tct-chat-message-list: announcements', () => {
  it('speaks a message added to the list once, with its sender, after it has settled', async () => {
    const spoken = spyOnAnnouncements();
    const list = await makeList();
    append(list, 'assistant', 'Here is your summary.', 'Navi');
    await aTimeout(100);
    expect(spoken).toEqual([]);
    await settleAnnouncements();
    expect(spoken).toEqual(['Navi: Here is your summary.']);
  });

  it('introduces an unnamed message by its sender', async () => {
    const spoken = spyOnAnnouncements();
    const list = await makeList();
    append(list, 'assistant', 'Hi');
    await settleAnnouncements();
    expect(spoken).toEqual(['Message from assistant: Hi']);
  });

  it('does not read the user their own messages', async () => {
    const spoken = spyOnAnnouncements();
    const list = await makeList();
    append(list, 'user', 'My question');
    await settleAnnouncements();
    expect(spoken).toEqual([]);
  });

  it('does not speak messages that were in the list at load', async () => {
    const spoken = spyOnAnnouncements();
    await makeList(`${message('assistant', 'Old one')}${message('assistant', 'Old two')}`);
    await settleAnnouncements();
    expect(spoken).toEqual([]);
  });

  it('does not speak older messages inserted above the newest one', async () => {
    const spoken = spyOnAnnouncements();
    const list = await makeList(message('assistant', 'Newest'));
    const holder = document.createElement('div');
    holder.innerHTML = message('assistant', 'Older history');
    list.prepend(holder.firstElementChild!);
    await settleAnnouncements();
    expect(spoken).toEqual([]);
  });

  it('speaks a system message by its text', async () => {
    const spoken = spyOnAnnouncements();
    const list = await makeList();
    const notice = document.createElement('tct-chat-system-message');
    notice.textContent = 'Ana joined the chat';
    list.append(notice);
    await settleAnnouncements();
    expect(spoken).toEqual(['Ana joined the chat']);
  });

  it('speaks only the last of a large batch (a conversation loading, not live messages)', async () => {
    const spoken = spyOnAnnouncements();
    const list = await makeList();
    for (let index = 0; index < 12; index++) append(list, 'assistant', `Loaded ${index}`);
    await settleAnnouncements();
    expect(spoken).toEqual(['Message from assistant: Loaded 11']);
  });

  it('skips hidden content and named-slot content, and reads mentions by their label', async () => {
    const spoken = spyOnAnnouncements();
    const list = await makeList();
    const holder = document.createElement('div');
    holder.innerHTML =
      '<tct-chat-message sender="assistant" name="Navi"><tct-avatar slot="avatar" name="Navi"></tct-avatar><tct-chat-message-bubble>Hi <tct-chat-tokenized-text text="@u1 there"></tct-chat-tokenized-text><span hidden>secret</span><span aria-hidden="true">decor</span><span slot="metadata">2:30 PM</span></tct-chat-message-bubble></tct-chat-message>';
    const row = holder.firstElementChild as TctChatMessage;
    (row.querySelector('tct-chat-tokenized-text') as unknown as {tokens: unknown}).tokens = [
      {value: '@u1', label: '@Ana'},
    ];
    list.append(row);
    await settleAnnouncements();
    expect(spoken).toEqual(['Navi: Hi @Ana there']);
  });

  it('does not repeat a message whose text did not change', async () => {
    const spoken = spyOnAnnouncements();
    const list = await makeList();
    const row = append(list, 'assistant', 'Same text', 'Navi');
    await settleAnnouncements();
    row.setAttribute('data-touched', '');
    row.querySelector('tct-chat-message-bubble')!.append(' ');
    await settleAnnouncements();
    expect(spoken).toEqual(['Navi: Same text']);
  });

  it('is silent with no-announce', async () => {
    const spoken = spyOnAnnouncements();
    const list = await makeList('', 'no-announce');
    append(list, 'assistant', 'Hi');
    await settleAnnouncements();
    expect(spoken).toEqual([]);
  });

  describe('streaming: no per-token speech', () => {
    it('speaks 200 streamed chunks exactly once, when streaming ends', async () => {
      const spoken = spyOnAnnouncements();
      const list = await makeList();
      list.streaming = true;
      await list.updateComplete;
      const row = append(list, 'assistant', '', 'Navi');
      const bubble = row.querySelector('tct-chat-message-bubble')!;
      const words: string[] = [];
      for (let index = 0; index < 200; index++) {
        const word = `w${index}`;
        words.push(word);
        bubble.append(`${word} `);
        if (index % 20 === 0) await nextFrame();
      }
      // Even a long pause between chunks must not release the message before the stream ends.
      await aTimeout(700);
      expect(spoken).toEqual([]);
      list.streaming = false;
      await list.updateComplete;
      await settleAnnouncements();
      expect(spoken).toHaveLength(1);
      expect(spoken[0]).toBe(`Navi: ${words.join(' ')}`);
    });

    it('speaks exactly one announcement per completed message across several streams', async () => {
      const spoken = spyOnAnnouncements();
      const list = await makeList();
      for (let turn = 0; turn < 3; turn++) {
        append(list, 'user', `Question ${turn}`);
        list.streaming = true;
        await list.updateComplete;
        const row = append(list, 'assistant', '');
        for (let chunk = 0; chunk < 200; chunk++) {
          row.querySelector('tct-chat-message-bubble')!.append(`t${chunk} `);
        }
        list.streaming = false;
        await list.updateComplete;
        await settleAnnouncements();
        expect(spoken).toHaveLength(turn + 1);
      }
    });

    it('speaks a stream the app did not flag once, after it has been quiet', async () => {
      const spoken = spyOnAnnouncements();
      const list = await makeList();
      const row = append(list, 'assistant', '');
      for (let chunk = 0; chunk < 200; chunk++) {
        row.querySelector('tct-chat-message-bubble')!.append(`t${chunk} `);
        if (chunk % 40 === 0) await aTimeout(120);
      }
      await aTimeout(200);
      expect(spoken).toEqual([]);
      await settleAnnouncements();
      expect(spoken).toHaveLength(1);
      expect(spoken[0]).toContain('t199');
    });

    it('never moves focus while streaming', async () => {
      const root = await fixture<HTMLElement>(html`
        <div>
          <button id="composer" type="button">composer</button>
          <tct-chat-message-list></tct-chat-message-list>
        </div>
      `);
      const list = root.querySelector<TctChatMessageList>('tct-chat-message-list')!;
      const composer = root.querySelector<HTMLButtonElement>('#composer')!;
      composer.focus();
      list.streaming = true;
      const row = append(list, 'assistant', '');
      for (let chunk = 0; chunk < 200; chunk++) {
        row.querySelector('tct-chat-message-bubble')!.append(`t${chunk} `);
        if (chunk % 25 === 0) {
          await nextFrame();
          expect(document.activeElement).toBe(composer);
        }
      }
      list.streaming = false;
      await list.updateComplete;
      await settleAnnouncements();
      expect(document.activeElement).toBe(composer);
    });

    it('does not re-render the list for every chunk', async () => {
      const list = await makeList();
      const row = append(list, 'assistant', '');
      await aTimeout(20);
      let updates = 0;
      const original = list.requestUpdate.bind(list);
      list.requestUpdate = (...args: Parameters<typeof original>) => {
        updates++;
        return original(...args);
      };
      for (let chunk = 0; chunk < 200; chunk++) {
        row.querySelector('tct-chat-message-bubble')!.append(`t${chunk} `);
      }
      await aTimeout(50);
      expect(updates).toBe(0);
    });
  });

  it('reaches assistive technology through the announcer regions when ariaNotify is not available', async () => {
    const restore = overrideFeature('ariaNotify', false);
    cleanups.push(restore);
    const list = await makeList();
    list.streaming = true;
    const row = append(list, 'assistant', '', 'Navi');
    for (let chunk = 0; chunk < 50; chunk++) {
      row.querySelector('tct-chat-message-bubble')!.append(`t${chunk} `);
    }
    await aTimeout(300);
    expect(getAnnouncerRegions().polite?.textContent ?? '').toBe('');
    list.streaming = false;
    await waitUntil(
      () => (getAnnouncerRegions().polite?.textContent ?? '').includes('t49'),
      'the completed message reaches the polite region',
      3000,
    );
    // One message, spoken through the shared region and never through the list itself.
    expect(getAnnouncerRegions().polite!.textContent).toMatch(/^Navi: t0 .*t49$/);
    if (isChromium) expect((await axNode(list)).live).not.toBe('polite');
  });
});

describe('tct-chat-message-list: focusLatestMessage', () => {
  it('focuses the newest message without scrolling, and lets its tabindex go on blur', async () => {
    const list = await makeList(
      `${message('assistant', 'One')}${message('user', 'Two')}${message('assistant', 'Three')}`,
    );
    list.focusLatestMessage();
    const latest = list.lastElementChild as TctChatMessage;
    expect(deepActiveElement()).toBe(latest);
    expect(latest.getAttribute('tabindex')).toBe('-1');
    await userEvent.click(document.body);
    expect(latest.hasAttribute('tabindex')).toBe(false);
  });

  it('focuses the list when it has no messages', async () => {
    const list = await makeList();
    list.focusLatestMessage();
    expect(deepActiveElement()).toBe(list);
  });

  it('draws a focus ring on the list when it is focused with the keyboard', async () => {
    const root = await fixture<HTMLElement>(
      `<div><button type="button">before</button><tct-chat-message-list>${message('assistant', 'Hi')}</tct-chat-message-list></div>`,
    );
    const list = root.querySelector<TctChatMessageList>('tct-chat-message-list')!;
    root.querySelector('button')!.focus();
    await userEvent.tab();
    expect(deepActiveElement()).toBe(list);
    expect(getComputedStyle(part(list, 'base')!).outlineStyle).toBe('solid');
  });
});
