import {html} from 'lit';
import {describe, expect, it} from 'vitest';
import {axNode, expectAccessible} from '@tecton-wc/testing/a11y.js';
import {fixture} from '@tecton-wc/testing/fixture.js';
import {runElementSuite} from '@tecton-wc/testing/suites/element.js';
import {isChromium} from '@tecton-wc/testing/tier.js';
import {waitUntil} from '@tecton-wc/testing/timing.js';
import '../icon/define.js';
import './define.js';
import type {TctChatSystemMessage} from './tct-chat-system-message.js';

const part = (element: Element, name: string): HTMLElement | null =>
  element.shadowRoot!.querySelector<HTMLElement>(`[part~="${name}"]`);

async function make(content: ReturnType<typeof html>, options = {}): Promise<TctChatSystemMessage> {
  const root = await fixture<HTMLElement>(
    html`<div style="inline-size: 500px">${content}</div>`,
    options,
  );
  return root.querySelector<TctChatSystemMessage>('tct-chat-system-message')!;
}

runElementSuite({
  tag: 'tct-chat-system-message',
  render: () => `<tct-chat-system-message>Conversation started</tct-chat-system-message>`,
  properties: {variant: 'divider'},
  attributes: {variant: 'variant'},
});

describe('tct-chat-system-message: default variant', () => {
  it('centres a muted line of text', async () => {
    const message = await make(
      html`<tct-chat-system-message>Conversation started</tct-chat-system-message>`,
    );
    expect(message.variant).toBe('default');
    const text = part(message, 'content')!.getBoundingClientRect();
    const host = message.getBoundingClientRect();
    expect(text.left + text.width / 2).toBeCloseTo(host.left + host.width / 2, 0);
    expect(getComputedStyle(part(message, 'base')!).textAlign).toBe('center');
  });

  it('is a status', async () => {
    const message = await make(html`<tct-chat-system-message>Ana joined</tct-chat-system-message>`);
    if (isChromium) {
      const node = await axNode(message);
      expect(node.role).toBe('status');
    }
    await expectAccessible(message.parentElement!);
  });

  it('shows the icon before the text, and only when there is one', async () => {
    const plain = await make(html`<tct-chat-system-message>No icon</tct-chat-system-message>`);
    expect(part(plain, 'icon')).toBeNull();
    const withIcon = await make(
      html`<tct-chat-system-message
        ><tct-icon slot="icon" name="check"></tct-icon>Saved</tct-chat-system-message
      >`,
    );
    const icon = part(withIcon, 'icon')!.getBoundingClientRect();
    const words = withIcon.shadowRoot!.querySelector('.text')!.getBoundingClientRect();
    expect(icon.right).toBeLessThanOrEqual(words.left);
    await expectAccessible(withIcon.parentElement!);
  });

  it('keeps inline markup in the text as one run (no gap between text and <strong>)', async () => {
    const message = await make(
      html`<tct-chat-system-message>Ana <strong>joined</strong> the chat</tct-chat-system-message>`,
    );
    const words = message.shadowRoot!.querySelector<HTMLElement>('.text')!;
    expect(words.getBoundingClientRect().height).toBeLessThan(30);
  });

  it('wraps long text within the available width', async () => {
    const message = await make(
      html`<tct-chat-system-message>${'a long notice '.repeat(40)}</tct-chat-system-message>`,
    );
    expect(part(message, 'base')!.getBoundingClientRect().width).toBeLessThanOrEqual(500);
    expect(part(message, 'base')!.scrollWidth).toBeLessThanOrEqual(
      part(message, 'base')!.clientWidth,
    );
  });
});

describe('tct-chat-system-message: divider variant', () => {
  it('sets the text between two rules', async () => {
    const message = await make(
      html`<tct-chat-system-message variant="divider">Today</tct-chat-system-message>`,
    );
    const divider = part(message, 'divider')!;
    expect(divider.localName).toBe('tct-divider');
    const lines = divider.shadowRoot!.querySelectorAll('[part~="line"]');
    expect(lines).toHaveLength(2);
    const label = divider
      .shadowRoot!.querySelector<HTMLElement>('[part~="label"]')!
      .getBoundingClientRect();
    expect(lines[0]!.getBoundingClientRect().right).toBeLessThanOrEqual(label.left + 1);
    expect(lines[1]!.getBoundingClientRect().left).toBeGreaterThanOrEqual(label.right - 1);
    expect(message.getBoundingClientRect().width).toBeCloseTo(500, 0);
  });

  it('names the separator by the text, and keeps the status role', async () => {
    const message = await make(
      html`<tct-chat-system-message variant="divider">March 15, 2026</tct-chat-system-message>`,
    );
    const divider = part(message, 'divider')!;
    expect(divider.getAttribute('aria-label')).toBe('March 15, 2026');
    if (isChromium) {
      expect((await axNode(message)).role).toBe('status');
      const separator = await axNode(divider);
      expect(separator.role).toBe('separator');
      expect(separator.name).toBe('March 15, 2026');
    }
    await expectAccessible(message.parentElement!);
  });

  it('follows the text as it changes', async () => {
    const message = await make(
      html`<tct-chat-system-message variant="divider">Yesterday</tct-chat-system-message>`,
    );
    message.textContent = 'Today';
    await waitUntil(
      () => part(message, 'divider')!.getAttribute('aria-label') === 'Today',
      'name follows text',
    );
  });

  it('takes rich content and names the separator by its text', async () => {
    const message = await make(
      html`<tct-chat-system-message variant="divider"
        ><time datetime="2026-03-15">March <b>15</b></time></tct-chat-system-message
      >`,
    );
    expect(part(message, 'divider')!.getAttribute('aria-label')).toBe('March 15');
    expect(message.querySelector('time')!.getBoundingClientRect().width).toBeGreaterThan(0);
  });

  it('does not render the icon (upstream: the divider variant ignores it)', async () => {
    const message = await make(
      html`<tct-chat-system-message variant="divider"
        ><tct-icon slot="icon" name="check"></tct-icon>Today</tct-chat-system-message
      >`,
    );
    expect(part(message, 'icon')).toBeNull();
    expect(message.querySelector('tct-icon')!.getBoundingClientRect().width).toBe(0);
  });

  it('switches between the variants', async () => {
    const message = await make(html`<tct-chat-system-message>Today</tct-chat-system-message>`);
    expect(part(message, 'base')).not.toBeNull();
    message.variant = 'divider';
    await message.updateComplete;
    expect(message.getAttribute('variant')).toBe('divider');
    expect(part(message, 'divider')).not.toBeNull();
    expect(part(message, 'base')).toBeNull();
  });
});

describe('tct-chat-system-message: direction and theming', () => {
  it('renders right-to-left, icon first at the inline start', async () => {
    const message = await make(
      html`<tct-chat-system-message
        ><tct-icon slot="icon" name="check"></tct-icon>تم الحفظ</tct-chat-system-message
      >`,
      {dir: 'rtl', lang: 'ar-SA'},
    );
    const icon = part(message, 'icon')!.getBoundingClientRect();
    const words = message.shadowRoot!.querySelector('.text')!.getBoundingClientRect();
    expect(icon.left).toBeGreaterThanOrEqual(words.right - 1);
  });

  it('passes axe in the dark theme, both variants', async () => {
    const root = await fixture<HTMLElement>(
      html`<div style="background: var(--color-background-body)">
        <tct-chat-system-message>Conversation started</tct-chat-system-message>
        <tct-chat-system-message variant="divider">Today</tct-chat-system-message>
      </div>`,
      {theme: 'dark'},
    );
    await expectAccessible(root);
  });
});
