/// <reference types="@vitest/browser-playwright" />
import {describe, expect, it} from 'vitest';
import {userEvent} from 'vitest/browser';
import {axNode, expectAccessible} from '@tecton-wc/testing/a11y.js';
import {emulateMedia} from '@tecton-wc/testing/emulate.js';
import {expectEventCounts, expectEventFlags, recordEvents} from '@tecton-wc/testing/events.js';
import {fixture} from '@tecton-wc/testing/fixture.js';
import {pressKeys} from '@tecton-wc/testing/keyboard.js';
import {runElementSuite} from '@tecton-wc/testing/suites/element.js';
import {isChromium} from '@tecton-wc/testing/tier.js';
import {waitUntil} from '@tecton-wc/testing/timing.js';
import '../button/define.js';
import './define.js';
import type {TctChatSendButton} from './tct-chat-send-button.js';

const inner = (element: Element): HTMLElement => element.shadowRoot!.querySelector('tct-button')!;
const native = (element: Element): HTMLButtonElement =>
  inner(element).shadowRoot!.querySelector('button')!;

async function make(attributes = '', content = ''): Promise<TctChatSendButton> {
  const root = await fixture<HTMLElement>(
    `<div><tct-chat-send-button ${attributes}>${content}</tct-chat-send-button></div>`,
  );
  return root.querySelector<TctChatSendButton>('tct-chat-send-button')!;
}

runElementSuite({
  tag: 'tct-chat-send-button',
  properties: {stopShown: true, disabled: true, size: 'sm'},
  attributes: {stopShown: 'stop-shown', disabled: 'disabled', size: 'size'},
  events: ['tct-chat-send', 'tct-chat-stop'],
});

describe('tct-chat-send-button: states', () => {
  it('is a primary icon button named "Send" with an arrow, enabled on its own', async () => {
    const button = await make();
    const control = inner(button);
    expect(control.getAttribute('variant')).toBe('primary');
    expect(control.getAttribute('label')).toBe('Send');
    expect(control.getAttribute('icon')).toBe('arrowUp');
    expect(control.hasAttribute('icon-only')).toBe(true);
    expect(native(button).disabled).toBe(false);
    if (isChromium)
      expect(await axNode(native(button))).toMatchObject({role: 'button', name: 'Send'});
    await expectAccessible(button);
  });

  it('shows Stop as a secondary button when stop-shown, and Stop is never disabled', async () => {
    const button = await make('stop-shown disabled');
    const control = inner(button);
    expect(control.getAttribute('variant')).toBe('secondary');
    expect(control.getAttribute('label')).toBe('Stop');
    expect(control.getAttribute('icon')).toBe('stop');
    expect(native(button).disabled).toBe(false);
    if (isChromium)
      expect(await axNode(native(button))).toMatchObject({role: 'button', name: 'Stop'});
  });

  it('disabled disables the send state, and assigning false forces it enabled', async () => {
    const button = await make('disabled');
    expect(native(button).disabled).toBe(true);
    button.disabled = false;
    await button.updateComplete;
    await waitUntil(() => !native(button).disabled, 'enabled');
    button.disabled = undefined;
    button.stopShown = false;
    await button.updateComplete;
    expect(native(button).disabled).toBe(false);
  });

  it('is 32px (md) or 28px (sm) tall', async () => {
    const md = await make();
    const sm = await make('size="sm"');
    expect(native(md).getBoundingClientRect().height).toBe(32);
    expect(native(sm).getBoundingClientRect().height).toBe(28);
  });

  it('is a circle on its own', async () => {
    const button = await make();
    const box = getComputedStyle(inner(button).shadowRoot!.querySelector('.button')!);
    const radius = parseFloat(box.borderStartStartRadius);
    expect(radius).toBeGreaterThanOrEqual(16);
  });

  it('takes custom icons through the send-icon and stop-icon slots', async () => {
    const button = await make(
      '',
      '<span slot="send-icon" id="up">S</span><span slot="stop-icon" id="sq">X</span>',
    );
    expect(inner(button).getAttribute('icon')).toBe('');
    expect(inner(button).querySelector('slot[name="send-icon"]')).not.toBeNull();
    button.stopShown = true;
    await button.updateComplete;
    expect(inner(button).querySelector('slot[name="stop-icon"]')).not.toBeNull();
    expect(inner(button).querySelector('slot[name="send-icon"]')).toBeNull();
  });
});

describe('tct-chat-send-button: activation', () => {
  it('fires a cancelable tct-chat-send once per click, and the native click bubbles', async () => {
    const button = await make();
    const events = recordEvents(button, ['tct-chat-send', 'tct-chat-stop', 'click']);
    await userEvent.click(native(button));
    expectEventCounts(events, {'tct-chat-send': 1, 'tct-chat-stop': 0, click: 1});
    expectEventFlags(events.named('tct-chat-send')[0]!, {
      bubbles: true,
      composed: true,
      cancelable: true,
    });
  });

  it('activates with Enter and Space from the keyboard', async () => {
    const button = await make();
    const sends = recordEvents(button, ['tct-chat-send']);
    native(button).focus();
    await pressKeys('Enter');
    await pressKeys(' ');
    expect(sends.events).toHaveLength(2);
  });

  it('fires tct-chat-stop, not tct-chat-send, in the stop state', async () => {
    const button = await make('stop-shown');
    const events = recordEvents(button, ['tct-chat-send', 'tct-chat-stop']);
    await userEvent.click(native(button));
    expectEventCounts(events, {'tct-chat-send': 0, 'tct-chat-stop': 1});
    expectEventFlags(events.named('tct-chat-stop')[0]!, {
      bubbles: true,
      composed: true,
      cancelable: false,
    });
  });

  it('fires nothing while disabled', async () => {
    const button = await make('disabled');
    const events = recordEvents(button, ['tct-chat-send']);
    await userEvent.click(native(button), {force: true});
    expect(events.events).toHaveLength(0);
  });

  it('writes to its properties never fire events', async () => {
    const button = await make();
    const events = recordEvents(button, ['tct-chat-send', 'tct-chat-stop', 'click']);
    button.stopShown = true;
    button.disabled = true;
    button.size = 'sm';
    await button.updateComplete;
    expectEventCounts(events, {});
  });
});

describe('tct-chat-send-button: text contrast, states and locales', () => {
  for (const theme of ['light', 'dark'] as const) {
    it(`passes axe in the send and stop states (${theme})`, async () => {
      const root = await fixture<HTMLElement>(
        `<div><tct-chat-send-button></tct-chat-send-button><tct-chat-send-button stop-shown></tct-chat-send-button><tct-chat-send-button disabled></tct-chat-send-button></div>`,
        {theme},
      );
      await expectAccessible(root);
    });
  }

  it('keeps a visible edge and passes axe in forced colours, in both states', async () => {
    if (!isChromium) return;
    const restore = await emulateMedia({forcedColors: 'active'});
    try {
      const root = await fixture<HTMLElement>(
        `<div><tct-chat-send-button></tct-chat-send-button><tct-chat-send-button stop-shown></tct-chat-send-button></div>`,
      );
      for (const button of root.querySelectorAll<TctChatSendButton>('tct-chat-send-button')) {
        expect(getComputedStyle(native(button)).borderTopStyle).toBe('solid');
      }
      await expectAccessible(root);
    } finally {
      await restore();
    }
  });

  it('is named in German and Arabic, and the label follows the state', async () => {
    const german = await fixture<HTMLElement>(
      `<div lang="de-DE"><tct-chat-send-button></tct-chat-send-button></div>`,
    );
    const button = german.querySelector<TctChatSendButton>('tct-chat-send-button')!;
    await waitUntil(
      () => inner(button).getAttribute('label') !== 'Send',
      'the German catalog loads',
    );
    const arabic = await fixture<HTMLElement>(
      `<div lang="ar-SA" dir="rtl"><tct-chat-send-button stop-shown></tct-chat-send-button></div>`,
    );
    const stop = arabic.querySelector<TctChatSendButton>('tct-chat-send-button')!;
    await waitUntil(() => inner(stop).getAttribute('label') !== 'Stop', 'the Arabic catalog loads');
  });
});
