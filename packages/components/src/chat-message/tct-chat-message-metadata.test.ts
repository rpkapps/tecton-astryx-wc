import {html} from 'lit';
import {describe, expect, it} from 'vitest';
import {axNode, expectAccessible} from '@tecton-wc/testing/a11y.js';
import {emulateMedia} from '@tecton-wc/testing/emulate.js';
import {fixture} from '@tecton-wc/testing/fixture.js';
import {runElementSuite} from '@tecton-wc/testing/suites/element.js';
import {isChromium} from '@tecton-wc/testing/tier.js';
import {waitUntil} from '@tecton-wc/testing/timing.js';
import '../icon/define.js';
import './define.js';
import {CHAT_MESSAGE_STATUSES} from './chat-message.types.js';
import type {TctChatMessageMetadata} from './tct-chat-message-metadata.js';

const part = (element: Element, name: string): HTMLElement | null =>
  element.shadowRoot!.querySelector<HTMLElement>(`[part~="${name}"]`);

async function make(
  content: ReturnType<typeof html>,
  options = {},
): Promise<TctChatMessageMetadata> {
  const root = await fixture<HTMLElement>(
    html`<div style="inline-size: 400px">${content}</div>`,
    options,
  );
  return root.querySelector<TctChatMessageMetadata>('tct-chat-message-metadata')!;
}

runElementSuite({
  tag: 'tct-chat-message-metadata',
  render: () =>
    `<tct-chat-message-metadata timestamp="2:30 PM" status="read"></tct-chat-message-metadata>`,
  properties: {timestamp: 'Now', footer: 'GPT', status: 'sent'},
  attributes: {timestamp: 'timestamp', footer: 'footer', status: 'status'},
});

const dots = (element: Element) =>
  [...element.shadowRoot!.querySelectorAll('[aria-hidden="true"]')].filter(
    (node) => node.textContent === '·',
  );

describe('tct-chat-message-metadata: content', () => {
  it('renders nothing at all when there is no timestamp, footer or status', async () => {
    const metadata = await make(html`<tct-chat-message-metadata></tct-chat-message-metadata>`);
    expect(part(metadata, 'base')).toBeNull();
    expect(metadata.getBoundingClientRect().height).toBe(0);
  });

  it('shows a timestamp alone, without a separator', async () => {
    const metadata = await make(
      html`<tct-chat-message-metadata timestamp="2:30 PM"></tct-chat-message-metadata>`,
    );
    expect(part(metadata, 'timestamp')!.textContent.trim()).toBe('2:30 PM');
    expect(dots(metadata)).toHaveLength(0);
  });

  it('separates timestamp, footer and status with dots, and only between things that exist', async () => {
    const all = await make(
      html`<tct-chat-message-metadata
        timestamp="2:30 PM"
        footer="Model X"
        status="sent"
      ></tct-chat-message-metadata>`,
    );
    expect(dots(all)).toHaveLength(2);
    const timeAndStatus = await make(
      html`<tct-chat-message-metadata
        timestamp="2:30 PM"
        status="sent"
      ></tct-chat-message-metadata>`,
    );
    expect(dots(timeAndStatus)).toHaveLength(1);
    const footerOnly = await make(
      html`<tct-chat-message-metadata footer="Model X"></tct-chat-message-metadata>`,
    );
    expect(dots(footerOnly)).toHaveLength(0);
  });

  it('takes markup through the timestamp and footer slots', async () => {
    const metadata = await make(html`
      <tct-chat-message-metadata
        ><time slot="timestamp" datetime="2026-09-29T14:30">2:30 PM</time
        ><button slot="footer" type="button">Copy</button></tct-chat-message-metadata
      >
    `);
    expect(part(metadata, 'timestamp')!.querySelector('slot')!.assignedElements()).toHaveLength(1);
    expect(part(metadata, 'footer')!.querySelector('slot')!.assignedElements()).toHaveLength(1);
    expect(dots(metadata)).toHaveLength(1);
  });

  it('picks up a slotted timestamp added later', async () => {
    const metadata = await make(html`<tct-chat-message-metadata></tct-chat-message-metadata>`);
    const time = document.createElement('span');
    time.slot = 'timestamp';
    time.textContent = 'Later';
    metadata.append(time);
    await waitUntil(() => part(metadata, 'timestamp') !== null, 'timestamp rendered');
  });
});

describe('tct-chat-message-metadata: status', () => {
  it.each(CHAT_MESSAGE_STATUSES)('shows an icon and the word for %s', async (status) => {
    const metadata = await make(
      html`<tct-chat-message-metadata status=${status}></tct-chat-message-metadata>`,
    );
    const row = part(metadata, 'status')!;
    const word = {
      sending: 'Sending',
      sent: 'Sent',
      delivered: 'Delivered',
      read: 'Read',
      error: 'Failed',
    }[status];
    expect(row.textContent.trim()).toBe(word);
    expect(row.getAttribute('title')).toBe(word);
    expect(row.querySelector('tct-icon')).not.toBeNull();
  });

  it.each([
    ['sent', 'Message sent'],
    ['read', 'Message read'],
    ['error', 'Message failed'],
  ] as const)('names the %s status "%s" for assistive technology', async (status, name) => {
    const metadata = await make(
      html`<tct-chat-message-metadata status=${status}></tct-chat-message-metadata>`,
    );
    const row = part(metadata, 'status')!;
    expect(row.getAttribute('aria-label')).toBe(name);
    if (isChromium) {
      const node = await axNode(row);
      expect(node.role).toBe('image');
      expect(node.name).toBe(name);
    }
  });

  it('hides the decorative dots from assistive technology', async () => {
    const metadata = await make(
      html`<tct-chat-message-metadata timestamp="now" status="sent"></tct-chat-message-metadata>`,
    );
    for (const dot of dots(metadata)) expect(dot.getAttribute('aria-hidden')).toBe('true');
    await expectAccessible(metadata);
  });

  it('draws a failed status in the error ink and a sending status pulsing', async () => {
    const failed = await make(
      html`<tct-chat-message-metadata status="error"></tct-chat-message-metadata>`,
    );
    const sending = await make(
      html`<tct-chat-message-metadata status="sending"></tct-chat-message-metadata>`,
    );
    const plain = await make(
      html`<tct-chat-message-metadata status="sent"></tct-chat-message-metadata>`,
    );
    expect(getComputedStyle(part(failed, 'status')!).color).not.toBe(
      getComputedStyle(part(plain, 'status')!).color,
    );
    expect(getComputedStyle(part(sending, 'status')!).animationName).toBe('tct-pulse');
    expect(getComputedStyle(part(plain, 'status')!).animationName).toBe('none');
  });

  it.skipIf(!isChromium)('does not pulse under reduced motion', async () => {
    await emulateMedia({reducedMotion: 'reduce'});
    const sending = await make(
      html`<tct-chat-message-metadata status="sending"></tct-chat-message-metadata>`,
    );
    expect(getComputedStyle(part(sending, 'status')!).animationName).toBe('none');
  });
});

describe('tct-chat-message-metadata: sender direction', () => {
  it('runs start to end for the assistant and end to start for the user', async () => {
    const root = await fixture<HTMLElement>(html`
      <div style="inline-size: 400px">
        <tct-chat-message sender="assistant"
          ><tct-chat-message-metadata
            id="a"
            timestamp="now"
            status="sent"
          ></tct-chat-message-metadata
        ></tct-chat-message>
        <tct-chat-message sender="user"
          ><tct-chat-message-metadata
            id="u"
            timestamp="now"
            status="sent"
          ></tct-chat-message-metadata
        ></tct-chat-message>
      </div>
    `);
    const order = (id: string) => {
      const metadata = root.querySelector(`#${id}`)!;
      const time = part(metadata, 'timestamp')!.getBoundingClientRect().left;
      const status = part(metadata, 'status')!.getBoundingClientRect().left;
      return time < status ? 'time-first' : 'status-first';
    };
    await waitUntil(() => order('u') === 'status-first', 'user row reverses');
    expect(order('a')).toBe('time-first');
  });

  it('reverses in right-to-left too (the row is a flex line)', async () => {
    const root = await fixture<HTMLElement>(
      html`<div style="inline-size: 400px">
        <tct-chat-message sender="assistant"
          ><tct-chat-message-metadata timestamp="now" status="sent"></tct-chat-message-metadata
        ></tct-chat-message>
      </div>`,
      {dir: 'rtl'},
    );
    const metadata = root.querySelector('tct-chat-message-metadata')!;
    await waitUntil(() => part(metadata, 'status') !== null, 'rendered');
    expect(part(metadata, 'timestamp')!.getBoundingClientRect().left).toBeGreaterThan(
      part(metadata, 'status')!.getBoundingClientRect().left,
    );
  });
});

describe('tct-chat-message-metadata: i18n and theming', () => {
  it('localises the status word (de-DE) and keeps the name pattern', async () => {
    const metadata = await make(
      html`<tct-chat-message-metadata status="sent"></tct-chat-message-metadata>`,
      {
        lang: 'de-DE',
      },
    );
    await waitUntil(
      () => part(metadata, 'status')!.textContent.trim() !== 'Sent',
      'German catalog',
      5000,
    );
    expect(part(metadata, 'status')!.getAttribute('aria-label')).not.toBe('Message sent');
  });

  it('renders in Arabic (ar-SA) right-to-left', async () => {
    const metadata = await make(
      html`<tct-chat-message-metadata status="read" timestamp="١٢:٣٠"></tct-chat-message-metadata>`,
      {
        lang: 'ar-SA',
        dir: 'rtl',
      },
    );
    await waitUntil(
      () => part(metadata, 'status')!.textContent.trim() !== 'Read',
      'Arabic catalog',
      5000,
    );
    expect(getComputedStyle(part(metadata, 'base')!).direction).toBe('rtl');
  });

  it('passes axe in every status, light and dark', async () => {
    const cells = html`${CHAT_MESSAGE_STATUSES.map(
      (status) =>
        html`<tct-chat-message-metadata
          timestamp="2:30 PM"
          footer="Model"
          status=${status}
        ></tct-chat-message-metadata>`,
    )}`;
    await expectAccessible(await fixture<HTMLElement>(html`<div>${cells}</div>`));
    await expectAccessible(
      await fixture<HTMLElement>(
        html`<div style="background: var(--color-background-body)">${cells}</div>`,
        {theme: 'dark'},
      ),
    );
  });
});
