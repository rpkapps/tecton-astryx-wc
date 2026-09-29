import {html} from 'lit';
import {describe, expect, it} from 'vitest';
import {axNode, expectAccessible} from '@tecton-astryx/testing/a11y.js';
import {emulateMedia} from '@tecton-astryx/testing/emulate.js';
import {fixture} from '@tecton-astryx/testing/fixture.js';
import {runElementSuite} from '@tecton-astryx/testing/suites/element.js';
import {isChromium} from '@tecton-astryx/testing/tier.js';
import {aTimeout, waitUntil} from '@tecton-astryx/testing/timing.js';
import '../avatar/define.js';
import '../chat-message-list/define.js';
import './define.js';
import type {TctChatMessageList} from '../chat-message-list/tct-chat-message-list.js';
import type {TctChatMessage} from './tct-chat-message.js';

const part = (element: Element, name: string): HTMLElement | null =>
  element.shadowRoot!.querySelector<HTMLElement>(`[part~="${name}"]`);

/** A 600px column, so alignment is measurable in the narrow test viewport. */
const column = (content: ReturnType<typeof html>) =>
  html`<div style="inline-size: 600px">${content}</div>`;

async function make(content: ReturnType<typeof html>, options = {}): Promise<HTMLElement> {
  const root = await fixture<HTMLElement>(column(content), options);
  return root;
}

runElementSuite({
  tag: 'tct-chat-message',
  render: () =>
    `<tct-chat-message sender="assistant" name="Navi"><tct-chat-message-bubble>Hello</tct-chat-message-bubble></tct-chat-message>`,
  properties: {sender: 'user', density: 'compact', name: 'Ana'},
  attributes: {sender: 'sender', density: 'density', name: 'name'},
});

describe('tct-chat-message: sender', () => {
  it('defaults to an assistant message and reflects the sender', async () => {
    const root = await make(html`<tct-chat-message>Hi</tct-chat-message>`);
    const message = root.querySelector<TctChatMessage>('tct-chat-message')!;
    expect(message.sender).toBe('assistant');
    message.sender = 'user';
    await message.updateComplete;
    expect(message.getAttribute('sender')).toBe('user');
  });

  it('starts assistant messages at the inline start and ends user messages at the inline end', async () => {
    const root = await make(html`
      <tct-chat-message sender="assistant" id="a"
        ><tct-chat-message-bubble>Assistant</tct-chat-message-bubble></tct-chat-message
      >
      <tct-chat-message sender="user" id="u"
        ><tct-chat-message-bubble>User</tct-chat-message-bubble></tct-chat-message
      >
      <tct-chat-message sender="system" id="s"
        ><tct-chat-message-bubble>System</tct-chat-message-bubble></tct-chat-message
      >
    `);
    const box = root.getBoundingClientRect();
    const bubbleOf = (id: string) =>
      part(
        root.querySelector(`#${id} tct-chat-message-bubble`)!,
        'bubble',
      )!.getBoundingClientRect();
    expect(bubbleOf('a').left).toBeCloseTo(box.left, 0);
    expect(bubbleOf('u').right).toBeCloseTo(box.right, 0);
    const system = bubbleOf('s');
    expect(system.left + system.width / 2).toBeCloseTo(box.left + box.width / 2, 0);
  });

  it('mirrors in right-to-left: the user is at the left edge', async () => {
    const root = await make(
      html`<tct-chat-message sender="user"
          ><tct-chat-message-bubble>مرحبا</tct-chat-message-bubble></tct-chat-message
        >
        <tct-chat-message sender="assistant"
          ><tct-chat-message-bubble>أهلا</tct-chat-message-bubble></tct-chat-message
        >`,
      {dir: 'rtl', lang: 'ar-SA'},
    );
    const box = root.getBoundingClientRect();
    const [user, assistant] = [...root.querySelectorAll('tct-chat-message-bubble')].map((bubble) =>
      part(bubble, 'bubble')!.getBoundingClientRect(),
    ) as [DOMRect, DOMRect];
    expect(user.left).toBeCloseTo(box.left, 0);
    expect(assistant.right).toBeCloseTo(box.right, 0);
  });

  it('puts the avatar before the content for the assistant and after it for the user', async () => {
    const root = await make(html`
      <tct-chat-message sender="assistant" id="a"
        ><tct-avatar slot="avatar" name="Navi" size="sm"></tct-avatar
        ><tct-chat-message-bubble>Assistant</tct-chat-message-bubble></tct-chat-message
      >
      <tct-chat-message sender="user" id="u"
        ><tct-avatar slot="avatar" name="Ana" size="sm"></tct-avatar
        ><tct-chat-message-bubble>User</tct-chat-message-bubble></tct-chat-message
      >
    `);
    const at = (id: string) => ({
      avatar: root.querySelector(`#${id} tct-avatar`)!.getBoundingClientRect(),
      bubble: part(
        root.querySelector(`#${id} tct-chat-message-bubble`)!,
        'bubble',
      )!.getBoundingClientRect(),
    });
    expect(at('a').avatar.right).toBeLessThanOrEqual(at('a').bubble.left);
    expect(at('u').avatar.left).toBeGreaterThanOrEqual(at('u').bubble.right);
  });

  it('never shows the avatar, name or metadata of a system message', async () => {
    const root = await make(html`
      <tct-chat-message sender="system" name="Ignored"
        ><tct-avatar slot="avatar" name="Nobody"></tct-avatar>Joined
        <span slot="metadata">Meta</span></tct-chat-message
      >
    `);
    const message = root.querySelector<TctChatMessage>('tct-chat-message')!;
    expect(part(message, 'avatar')).toBeNull();
    expect(part(message, 'name')).toBeNull();
    expect(part(message, 'metadata')).toBeNull();
    expect(message.accessibleName).toBe('Message from system');
  });

  it('lets custom, non-bubble content sit flush with the message edge', async () => {
    const root = await make(html`
      <tct-chat-message sender="assistant"
        ><div id="raw" style="inline-size: 100px; block-size: 20px">raw</div></tct-chat-message
      >
    `);
    expect(root.querySelector('#raw')!.getBoundingClientRect().left).toBeCloseTo(
      root.getBoundingClientRect().left,
      0,
    );
  });
});

describe('tct-chat-message: name and semantics', () => {
  it('is an article named "Message from {sender}" without a name', async () => {
    const root = await make(html`<tct-chat-message sender="user">Hi</tct-chat-message>`);
    const message = root.querySelector<TctChatMessage>('tct-chat-message')!;
    expect(message.accessibleName).toBe('Message from user');
    if (isChromium) {
      const node = await axNode(message);
      expect(node.role).toBe('article');
      expect(node.name).toBe('Message from user');
    }
  });

  it('is named by the name attribute, and shows it above the body', async () => {
    const root = await make(html`<tct-chat-message name="Navi">Hi</tct-chat-message>`);
    const message = root.querySelector<TctChatMessage>('tct-chat-message')!;
    expect(message.accessibleName).toBe('Navi');
    expect(part(message, 'name')!.textContent.trim()).toBe('Navi');
    if (isChromium) expect((await axNode(message)).name).toBe('Navi');
  });

  it('prefers the name slot, follows its text, and keeps markup', async () => {
    const root = await make(
      html`<tct-chat-message name="Attr"><strong slot="name">Slotted</strong>Hi</tct-chat-message>`,
    );
    const message = root.querySelector<TctChatMessage>('tct-chat-message')!;
    expect(message.accessibleName).toBe('Slotted');
    message.querySelector('strong')!.textContent = 'Renamed';
    await waitUntil(() => message.accessibleName === 'Renamed', 'name follows the slot');
    if (isChromium) expect((await axNode(message)).name).toBe('Renamed');
  });

  it('does not re-render when only the body changes (a streaming body is cheap)', async () => {
    const root = await make(html`<tct-chat-message>Hi</tct-chat-message>`);
    const message = root.querySelector<TctChatMessage>('tct-chat-message')!;
    await message.updateComplete;
    let updates = 0;
    const original = message.requestUpdate.bind(message);
    message.requestUpdate = (...args: Parameters<typeof original>) => {
      updates++;
      return original(...args);
    };
    for (let index = 0; index < 20; index++) message.append(`chunk ${index} `);
    await aTimeout(30);
    expect(updates).toBe(0);
  });

  it('localises "Message from {sender}" (de-DE) and keeps an explicit name over it', async () => {
    const root = await make(html`<tct-chat-message sender="user">Hi</tct-chat-message>`, {
      lang: 'de-DE',
    });
    const message = root.querySelector<TctChatMessage>('tct-chat-message')!;
    await waitUntil(
      () => !message.accessibleName.startsWith('Message from'),
      'German catalog',
      5000,
    );
    expect(message.accessibleName).toContain('user');
    message.name = 'Ana';
    await message.updateComplete;
    expect(message.accessibleName).toBe('Ana');
  });

  it('localises in Arabic (ar-SA) and lays out right-to-left', async () => {
    const root = await make(html`<tct-chat-message sender="user">مرحبا</tct-chat-message>`, {
      lang: 'ar-SA',
      dir: 'rtl',
    });
    const message = root.querySelector<TctChatMessage>('tct-chat-message')!;
    await waitUntil(
      () => !message.accessibleName.startsWith('Message from'),
      'Arabic catalog',
      5000,
    );
    expect(getComputedStyle(message).direction).toBe('rtl');
  });

  it('passes axe with and without a name, with an avatar and metadata', async () => {
    const root = await make(html`
      <tct-chat-message sender="assistant" name="Navi"
        ><tct-avatar slot="avatar" name="Navi" size="sm"></tct-avatar
        ><tct-chat-message-bubble>Hello there</tct-chat-message-bubble
        ><span slot="metadata">Just now</span></tct-chat-message
      >
      <tct-chat-message sender="user"
        ><tct-chat-message-bubble>Hi</tct-chat-message-bubble></tct-chat-message
      >
    `);
    await expectAccessible(root);
  });

  it('passes axe in the dark theme', async () => {
    const root = await fixture<HTMLElement>(
      html`<div style="background: var(--color-background-body)">
        <tct-chat-message sender="user" name="Ana"
          ><tct-chat-message-bubble>Hi there</tct-chat-message-bubble></tct-chat-message
        >
      </div>`,
      {theme: 'dark'},
    );
    await expectAccessible(root);
  });
});

describe('tct-chat-message: density', () => {
  const gapOf = (message: HTMLElement) => getComputedStyle(part(message, 'body')!).rowGap;

  it('is balanced on its own, and takes the density of the list around it', async () => {
    const root = await fixture<HTMLElement>(html`
      <div>
        <tct-chat-message id="alone">Hi</tct-chat-message>
        <tct-chat-message-list density="compact" align="top"
          ><tct-chat-message id="inList">Hi</tct-chat-message></tct-chat-message-list
        >
      </div>
    `);
    const alone = root.querySelector<TctChatMessage>('#alone')!;
    const inList = root.querySelector<TctChatMessage>('#inList')!;
    await alone.updateComplete;
    await inList.updateComplete;
    expect(part(alone, 'base')!.dataset.density).toBe('balanced');
    expect(part(inList, 'base')!.dataset.density).toBe('compact');
    expect(gapOf(alone)).toBe('4px');
    expect(gapOf(inList)).toBe('2px');
  });

  it('lets an explicit density override the list, and follows the list when it changes', async () => {
    const root = await fixture<HTMLElement>(html`
      <tct-chat-message-list density="spacious" align="top">
        <tct-chat-message id="own" density="compact">Hi</tct-chat-message>
        <tct-chat-message id="inherit">Hi</tct-chat-message>
      </tct-chat-message-list>
    `);
    const list = root as TctChatMessageList;
    const own = root.querySelector<TctChatMessage>('#own')!;
    const inherit = root.querySelector<TctChatMessage>('#inherit')!;
    await own.updateComplete;
    await inherit.updateComplete;
    expect(part(own, 'base')!.dataset.density).toBe('compact');
    expect(part(inherit, 'base')!.dataset.density).toBe('spacious');
    list.density = 'compact';
    await waitUntil(() => part(inherit, 'base')!.dataset.density === 'compact', 'context update');
  });
});

describe('tct-chat-message: forced colours and motion', () => {
  it.skipIf(!isChromium)('renders in forced colours', async () => {
    await emulateMedia({forcedColors: 'active'});
    const root = await make(
      html`<tct-chat-message sender="user"
        ><tct-chat-message-bubble>Hi</tct-chat-message-bubble></tct-chat-message
      >`,
    );
    const bubble = part(root.querySelector('tct-chat-message-bubble')!, 'bubble')!;
    expect(getComputedStyle(bubble).outlineStyle).toBe('solid');
  });
});
