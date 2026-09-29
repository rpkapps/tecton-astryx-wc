/// <reference types="@vitest/browser-playwright" />
import {html, LitElement} from 'lit';
import {afterEach, describe, expect, it} from 'vitest';
import {cdp, userEvent} from 'vitest/browser';
import {resetAnnouncer} from '@tecton-wc/core/a11y/announcer.js';
import {ContextConsumer} from '@tecton-wc/core/context/protocol.js';
import {overrideFeature} from '@tecton-wc/core/features.js';
import {axNode, expectAccessible} from '@tecton-wc/testing/a11y.js';
import {emulateMedia} from '@tecton-wc/testing/emulate.js';
import {expectEventCounts, expectEventFlags, recordEvents} from '@tecton-wc/testing/events.js';
import {fixture} from '@tecton-wc/testing/fixture.js';
import {deepActiveElement, pressKeys} from '@tecton-wc/testing/keyboard.js';
import {runElementSuite} from '@tecton-wc/testing/suites/element.js';
import {isChromium} from '@tecton-wc/testing/tier.js';
import {waitUntil} from '@tecton-wc/testing/timing.js';
import '../badge/define.js';
import '../button/define.js';
import '../icon-button/define.js';
import './define.js';
import {chatComposerContext} from './chat-composer.context.js';
import type {TctChatComposer} from './tct-chat-composer.js';
import type {TctChatComposerInput} from './tct-chat-composer-input.js';
import type {TctChatSendButton} from './tct-chat-send-button.js';

/** A custom input that follows the composition contract: reads and writes the draft through context. */
class TestContextInput extends LitElement {
  readonly composer: ContextConsumer<typeof chatComposerContext> = new ContextConsumer<
    typeof chatComposerContext
  >(this, {
    context: chatComposerContext,
    subscribe: true,
    callback: (context) => {
      context?.registerInput({
        focus: () => {
          this.focusCalls++;
          this.renderRoot.querySelector('input')?.focus();
        },
      });
    },
  });
  focusCalls = 0;

  override render() {
    const context = this.composer.value;
    return html`<input
      .value=${context?.value ?? ''}
      placeholder=${context?.placeholder ?? ''}
      ?disabled=${context?.disabled}
      aria-label="Custom"
      @input=${(event: Event) => context?.setValue((event.target as HTMLInputElement).value)}
    />`;
  }
}
customElements.define('test-context-input', TestContextInput);

const cleanups: (() => void)[] = [];
afterEach(() => {
  while (cleanups.length > 0) cleanups.pop()!();
  resetAnnouncer();
});

/** Replaces the announcer's transport with a recorder (it uses `ariaNotify` when the engine has it). */
function spyOnAnnouncements(): {message: string; priority: string | undefined}[] {
  const messages: {message: string; priority: string | undefined}[] = [];
  const restore = overrideFeature('ariaNotify', true);
  (
    document.body as unknown as {ariaNotify: (m: string, o?: {priority?: string}) => void}
  ).ariaNotify = (message, options) => {
    messages.push({message, priority: options?.priority});
  };
  cleanups.push(() => {
    delete (document.body as unknown as {ariaNotify?: unknown}).ariaNotify;
    restore();
  });
  return messages;
}

const inputOf = (composer: Element): TctChatComposerInput =>
  composer.shadowRoot!.querySelector<TctChatComposerInput>('tct-chat-composer-input')!;
const editableOf = (input: Element): HTMLElement =>
  input.shadowRoot!.querySelector<HTMLElement>('.editable')!;
const sendOf = (composer: Element): TctChatSendButton =>
  composer.shadowRoot!.querySelector<TctChatSendButton>('tct-chat-send-button')!;
const nativeSend = (composer: Element): HTMLButtonElement =>
  sendOf(composer).shadowRoot!.querySelector('tct-button')!.shadowRoot!.querySelector('button')!;
const body = (composer: Element): HTMLElement =>
  composer.shadowRoot!.querySelector<HTMLElement>('.body')!;

async function make(attributes = '', slots = ''): Promise<TctChatComposer> {
  const root = await fixture<HTMLElement>(
    `<div style="inline-size: 480px; padding-block: 24px"><tct-chat-composer ${attributes}>${slots}</tct-chat-composer></div>`,
  );
  return root.querySelector<TctChatComposer>('tct-chat-composer')!;
}

async function typeInto(composer: TctChatComposer, text: string): Promise<void> {
  editableOf(inputOf(composer)).focus();
  await userEvent.keyboard(text);
  await composer.updateComplete;
}

runElementSuite({
  tag: 'tct-chat-composer',
  properties: {
    value: 'draft',
    placeholder: 'Ask',
    disabled: true,
    stopShown: true,
    density: 'compact',
    elevation: 'none',
    statusType: 'error',
    statusMessage: 'Too long',
    statusPosition: 'top',
  },
  attributes: {
    value: 'value',
    placeholder: 'placeholder',
    disabled: 'disabled',
    stopShown: 'stop-shown',
    density: 'density',
    elevation: 'elevation',
    statusType: 'status-type',
    statusMessage: 'status-message',
    statusPosition: 'status-position',
  },
  events: ['tct-chat-submit', 'tct-chat-stop'],
});

describe('tct-chat-composer: default composition', () => {
  it('renders an input and a send button with no slots, and is accessible', async () => {
    const composer = await make();
    expect(inputOf(composer)).not.toBeNull();
    expect(sendOf(composer)).not.toBeNull();
    expect(editableOf(inputOf(composer)).getAttribute('aria-label')).toBe('Message input');
    await expectAccessible(composer);
  });

  it('shares the placeholder, the disabled state and the draft with its input', async () => {
    const composer = await make('placeholder="Ask anything" value="hello"');
    const input = inputOf(composer);
    expect(input.shadowRoot!.querySelector('.placeholder')).toBeNull();
    expect(editableOf(input).textContent).toBe('hello');
    composer.value = '';
    await composer.updateComplete;
    await input.updateComplete;
    expect(input.shadowRoot!.querySelector('.placeholder')!.textContent).toContain('Ask anything');
    composer.disabled = true;
    await composer.updateComplete;
    await input.updateComplete;
    expect(editableOf(input).getAttribute('aria-disabled')).toBe('true');
  });

  it('typing updates the composer value; writing it does not fire events', async () => {
    const composer = await make();
    const events = recordEvents(composer, ['input', 'change', 'tct-chat-submit']);
    await typeInto(composer, 'abc');
    expect(composer.value).toBe('abc');
    events.events.length = 0;
    composer.value = 'from outside';
    await composer.updateComplete;
    await inputOf(composer).updateComplete;
    expect(editableOf(inputOf(composer)).textContent).toBe('from outside');
    expectEventCounts(events, {});
  });
});

describe('tct-chat-composer: sending', () => {
  it('Enter in the input fires one tct-chat-submit from the composer with the trimmed draft, then clears', async () => {
    const composer = await make();
    const submits = recordEvents(composer, ['tct-chat-submit']);
    await typeInto(composer, '  hello there ');
    await userEvent.keyboard('{Enter}');
    await composer.updateComplete;
    expect(submits.events).toHaveLength(1);
    expect(submits.events[0]!.value).toBe('hello there');
    expectEventFlags(submits.events[0]!, {bubbles: true, composed: true, cancelable: true});
    expect(submits.events[0]!.target).toBe(composer);
    expect(composer.value).toBe('');
    expect(editableOf(inputOf(composer)).textContent).toBe('');
  });

  it('the send button is disabled while there is nothing to send and sends the draft when clicked', async () => {
    const composer = await make();
    const submits = recordEvents(composer, ['tct-chat-submit']);
    const sends = recordEvents(composer, ['tct-chat-send']);
    expect(nativeSend(composer).disabled).toBe(true);
    await typeInto(composer, '   ');
    expect(nativeSend(composer).disabled).toBe(true);
    await userEvent.keyboard('go');
    await composer.updateComplete;
    await sendOf(composer).updateComplete;
    await waitUntil(() => !nativeSend(composer).disabled, 'the send button enables');
    await userEvent.click(nativeSend(composer));
    expect(sends.events).toHaveLength(1);
    expectEventFlags(sends.events[0]!, {bubbles: true, composed: true, cancelable: true});
    expect(submits.events).toHaveLength(1);
    expect(submits.events[0]!.value).toBe('go');
    expect(composer.value).toBe('');
    await sendOf(composer).updateComplete;
    expect(nativeSend(composer).disabled).toBe(true);
  });

  it('preventDefault on tct-chat-submit keeps the draft; on tct-chat-send it replaces the submit', async () => {
    const composer = await make('value="keep me"');
    composer.addEventListener('tct-chat-submit', (event) => {
      event.preventDefault();
    });
    await typeInto(composer, '!');
    await userEvent.keyboard('{Enter}');
    expect(composer.value).toContain('keep me');
    const other = await make('value="own handling"');
    const submits = recordEvents(other, ['tct-chat-submit']);
    other.addEventListener('tct-chat-send', (event) => {
      event.preventDefault();
    });
    await other.updateComplete;
    await waitUntil(() => !nativeSend(other).disabled, 'enabled');
    await userEvent.click(nativeSend(other));
    expect(submits.events).toHaveLength(0);
    expect(other.value).toBe('own handling');
  });

  it('never submits a blank draft or from a disabled composer', async () => {
    const composer = await make('disabled');
    const submits = recordEvents(composer, ['tct-chat-submit']);
    const input = inputOf(composer);
    input.value = 'ignored';
    await input.updateComplete;
    expect(input.submit()).toBe(false);
    expect(submits.events).toHaveLength(0);
  });

  it('a stop-shown composer shows Stop, which stays operable while the composer is disabled', async () => {
    const composer = await make('disabled stop-shown');
    const stops = recordEvents(composer, ['tct-chat-stop']);
    const send = sendOf(composer);
    expect(send.shadowRoot!.querySelector('tct-button')!.getAttribute('label')).toBe('Stop');
    expect(nativeSend(composer).disabled).toBe(false);
    const foot = composer.shadowRoot!.querySelector<HTMLElement>('.footer-end')!;
    expect(getComputedStyle(foot).pointerEvents).toBe('auto');
    await userEvent.click(nativeSend(composer));
    expect(stops.events).toHaveLength(1);
    expectEventFlags(stops.events[0]!, {bubbles: true, composed: true, cancelable: false});
    const bodyRect = body(composer).getBoundingClientRect();
    expect(getComputedStyle(body(composer)).cursor).toBe('default');
    expect(bodyRect.width).toBeGreaterThan(0);
  });
});

describe('tct-chat-composer: disabled', () => {
  it('dims the body, blocks the pointer, and keeps focus where it was when a send disables it', async () => {
    const composer = await make();
    await typeInto(composer, 'hi');
    composer.disabled = true;
    await composer.updateComplete;
    const base = composer.shadowRoot!.querySelector<HTMLElement>('.base')!;
    expect(getComputedStyle(base).pointerEvents).toBe('none');
    expect(Number(getComputedStyle(base).opacity)).toBeCloseTo(0.6, 1);
    expect(deepActiveElement()).toBe(editableOf(inputOf(composer)));
    await expectAccessible(composer);
  });
});

describe('tct-chat-composer: slots', () => {
  it('renders the header only when it has content, with actions at the start and context at the end', async () => {
    const plain = await make();
    expect(plain.shadowRoot!.querySelector('.header')).toBeNull();
    const composer = await make(
      '',
      `<tct-icon-button slot="header-actions" size="sm" icon="chevronDown" label="Attach"></tct-icon-button>
       <span slot="header-context">72% context</span>`,
    );
    const header = composer.shadowRoot!.querySelector<HTMLElement>('.header')!;
    expect(header).not.toBeNull();
    const start = header.querySelector('.header-start')!.getBoundingClientRect();
    const end = header.querySelector('.header-end')!.getBoundingClientRect();
    expect(end.left).toBeGreaterThan(start.left);
    await expectAccessible(composer);
  });

  it('places footer actions before, and send actions next to, the send button', async () => {
    const composer = await make(
      '',
      `<tct-button slot="footer-actions" size="md" label="Tools"></tct-button>
       <tct-button slot="send-actions" size="md" label="Voice"></tct-button>`,
    );
    const tools = composer.querySelector('[slot="footer-actions"]')!.getBoundingClientRect();
    const voice = composer.querySelector('[slot="send-actions"]')!.getBoundingClientRect();
    const send = sendOf(composer).getBoundingClientRect();
    expect(tools.left).toBeLessThan(voice.left);
    expect(voice.right).toBeLessThanOrEqual(send.left + 1);
    expect(Math.abs(tools.height - send.height)).toBeLessThan(1);
  });

  it('takes a custom input and a custom send button instead of the defaults', async () => {
    const composer = await make(
      '',
      `<tct-chat-composer-input slot="input" placeholder="Custom placeholder"></tct-chat-composer-input>
       <tct-chat-send-button slot="send-button" size="sm"></tct-chat-send-button>`,
    );
    expect(composer.shadowRoot!.querySelector('tct-chat-composer-input')).toBeNull();
    const input = composer.querySelector<TctChatComposerInput>('tct-chat-composer-input')!;
    expect(input.shadowRoot!.querySelector('.placeholder')!.textContent).toContain(
      'Custom placeholder',
    );
    expect(composer.querySelector<TctChatSendButton>('tct-chat-send-button')!.size).toBe('sm');
    // The slotted input is wired to the composer like the default one.
    const submits = recordEvents(composer, ['tct-chat-submit']);
    editableOf(input).focus();
    await userEvent.keyboard('slotted{Enter}');
    expect(submits.events[0]!.value).toBe('slotted');
    expect(composer.value).toBe('');
  });

  it('a trigger-enabled slotted input works inside the composer (the menu escapes the shadow root)', async () => {
    const composer = await make(
      '',
      `<tct-chat-composer-input slot="input"></tct-chat-composer-input>`,
    );
    const input = composer.querySelector<TctChatComposerInput>('tct-chat-composer-input')!;
    input.triggers = [
      {
        character: '@',
        searchSource: {search: () => [{id: 'ada', label: 'Ada'}]},
        onSelect: (item) => ({value: `@${item.id}`, label: item.label}),
      },
    ];
    await input.updateComplete;
    editableOf(input).focus();
    await userEvent.keyboard('@');
    await waitUntil(
      () => input.shadowRoot!.querySelector('.trigger-menu')!.matches(':popover-open'),
      'the menu opens',
    );
    await userEvent.keyboard('{Enter}');
    expect(composer.value).toBe('@ada ');
  });
});

describe('tct-chat-composer: a custom input through the composer context', () => {
  it('reads value, placeholder and disabled, writes the draft, and lets the shell focus it', async () => {
    const composer = await make(
      'value="hello" placeholder="Say something"',
      `<test-context-input slot="input"></test-context-input>`,
    );
    const custom = composer.querySelector<TestContextInput>('test-context-input')!;
    await custom.updateComplete;
    const native = custom.shadowRoot!.querySelector('input')!;
    expect(native.value).toBe('hello');
    expect(native.placeholder).toBe('Say something');
    composer.disabled = true;
    await composer.updateComplete;
    await custom.updateComplete;
    expect(native.disabled).toBe(true);
    composer.disabled = false;
    await composer.updateComplete;
    await userEvent.type(native, ' world');
    expect(composer.value).toBe('hello world');
    // A click on the body's empty space calls the registered control.
    const footer = composer.shadowRoot!.querySelector<HTMLElement>('.footer')!;
    const rect = footer.getBoundingClientRect();
    await userEvent.click(footer, {position: {x: rect.width / 2, y: 2}});
    expect(custom.focusCalls).toBeGreaterThan(0);
    expect(deepActiveElement()).toBe(native);
  });

  it('submits the value through the public context operation', async () => {
    const composer = await make('value="  from context  "');
    const consumer = document.createElement('div');
    composer.append(consumer);
    const submits = recordEvents(composer, ['tct-chat-submit']);
    const input = inputOf(composer);
    // The input reads the composer through the same context a custom send button would.
    expect(input.submit()).toBe(true);
    expect(submits.events[0]!.value).toBe('from context');
    consumer.remove();
  });

  it('falls back to focusing a bare textarea when no control is registered', async () => {
    const composer = await make('', `<textarea slot="input" aria-label="Plain"></textarea>`);
    const textarea = composer.querySelector('textarea')!;
    const footer = composer.shadowRoot!.querySelector<HTMLElement>('.footer')!;
    const rect = footer.getBoundingClientRect();
    await userEvent.click(footer, {position: {x: rect.width / 2, y: 2}});
    expect(deepActiveElement()).toBe(textarea);
  });
});

describe('tct-chat-composer: clicking the body focuses the input after the draft', () => {
  it('puts the caret after the draft, so typing continues there', async () => {
    const composer = await make('value="pending draft"');
    const input = inputOf(composer);
    const footer = composer.shadowRoot!.querySelector<HTMLElement>('.footer')!;
    const rect = footer.getBoundingClientRect();
    await userEvent.click(footer, {position: {x: rect.width / 2, y: 2}});
    expect(deepActiveElement()).toBe(editableOf(input));
    await userEvent.keyboard('!');
    expect(input.value).toBe('pending draft!');
  });

  it('a following ArrowUp keeps the pending draft rather than recalling history', async () => {
    const composer = await make();
    await typeInto(composer, 'first');
    await userEvent.keyboard('{Enter}');
    await composer.updateComplete;
    const input = inputOf(composer);
    input.value = 'pending draft';
    await input.updateComplete;
    (document.activeElement as HTMLElement | null)?.blur();
    const footer = composer.shadowRoot!.querySelector<HTMLElement>('.footer')!;
    const rect = footer.getBoundingClientRect();
    await userEvent.click(footer, {position: {x: rect.width / 2, y: 2}});
    expect(deepActiveElement()).toBe(editableOf(input));
    await userEvent.keyboard('{ArrowUp}');
    expect(input.value).toBe('pending draft');
  });

  it('a click on a control in the body is left alone', async () => {
    const composer = await make(
      '',
      `<tct-button slot="footer-actions" label="Tools" size="md"></tct-button>`,
    );
    await userEvent.click(composer.querySelector('tct-button')!);
    expect(deepActiveElement()).not.toBe(editableOf(inputOf(composer)));
  });
});

describe('tct-chat-composer: status strip', () => {
  it('shows a tinted strip with an icon below (or above) the body, and no live region of its own', async () => {
    const composer = await make('status-type="error" status-message="Message too long"');
    const strip = composer.shadowRoot!.querySelector<HTMLElement>('.status')!;
    expect(strip.textContent).toContain('Message too long');
    expect(strip.hasAttribute('role')).toBe(false);
    expect(strip.hasAttribute('aria-live')).toBe(false);
    expect(strip.querySelector('tct-icon')!.getAttribute('name')).toBe('error');
    expect(strip.getBoundingClientRect().top).toBeGreaterThan(
      body(composer).getBoundingClientRect().top,
    );
    composer.statusPosition = 'top';
    await composer.updateComplete;
    const top = composer.shadowRoot!.querySelector<HTMLElement>('.status')!;
    expect(top.getBoundingClientRect().top).toBeLessThan(
      body(composer).getBoundingClientRect().top,
    );
    composer.statusType = undefined;
    await composer.updateComplete;
    expect(composer.shadowRoot!.querySelector('.status')).toBeNull();
  });

  it('announces the message once through the announcer: assertively for an error, politely for a warning', async () => {
    const spoken = spyOnAnnouncements();
    const composer = await make('status-type="error" status-message="Send failed"');
    await waitUntil(() => spoken.length > 0, 'the error is announced');
    expect(spoken).toEqual([{message: 'Send failed', priority: 'high'}]);
    composer.statusMessage = 'Send failed';
    await composer.updateComplete;
    composer.statusType = 'warning';
    composer.statusMessage = 'Approaching the limit';
    await composer.updateComplete;
    await waitUntil(() => spoken.length === 2, 'the warning is announced');
    expect(spoken[1]).toEqual({message: 'Approaching the limit', priority: 'normal'});
  });

  it('meets contrast in light and dark, for both severities and both positions', async () => {
    for (const theme of ['light', 'dark'] as const) {
      for (const type of ['error', 'warning'] as const) {
        for (const position of ['top', 'bottom'] as const) {
          const root = await fixture<HTMLElement>(
            `<div style="inline-size: 480px"><tct-chat-composer status-type="${type}" status-message="Something to know" status-position="${position}"></tct-chat-composer></div>`,
            {theme},
          );
          await expectAccessible(root, {runOnly: {type: 'rule', values: ['color-contrast']}});
        }
      }
    }
  });
});

describe('tct-chat-composer: elevation and density', () => {
  it('low is raised with a shadow that deepens on focus; none is flat with an input border', async () => {
    const low = await make();
    const flat = await make('elevation="none"');
    expect(getComputedStyle(body(low)).boxShadow).not.toBe('none');
    expect(getComputedStyle(body(low)).borderTopWidth).toBe('0px');
    expect(getComputedStyle(body(flat)).boxShadow).toBe('none');
    expect(getComputedStyle(body(flat)).borderTopWidth).toBe('1px');
    const resting = getComputedStyle(body(low)).boxShadow;
    editableOf(inputOf(low)).focus();
    await waitUntil(() => getComputedStyle(body(low)).boxShadow !== resting, 'the shadow deepens');
  });

  it('the border of a flat composer is an input border role, not the decorative separator', async () => {
    const flat = await make('elevation="none"');
    const expected = getComputedStyle(flat)
      .getPropertyValue('--tecton-color-input-outlined-border')
      .trim();
    expect(expected).not.toBe('');
    const swatch = document.createElement('div');
    swatch.style.color = expected;
    document.body.append(swatch);
    const rgb = getComputedStyle(swatch).color;
    swatch.remove();
    expect(getComputedStyle(body(flat)).borderTopColor).toBe(rgb);
  });

  it('compact tightens the padding and the gap, and an invalid value falls back', async () => {
    const balanced = await make();
    const compact = await make('density="compact"');
    expect(parseFloat(getComputedStyle(body(compact)).paddingTop)).toBeLessThan(
      parseFloat(getComputedStyle(body(balanced)).paddingTop),
    );
    const invalid = await make('density="huge"');
    expect(getComputedStyle(body(invalid)).paddingTop).toBe(
      getComputedStyle(body(balanced)).paddingTop,
    );
  });

  it('buttons in the footer follow the shell concentrically: never squarer than the element radius', async () => {
    const composer = await make(
      '',
      `<tct-button slot="footer-actions" size="md" label="Tools"></tct-button>`,
    );
    const radius = getComputedStyle(
      composer.querySelector('tct-button')!.shadowRoot!.querySelector('.button')!,
    ).borderStartStartRadius;
    const element = getComputedStyle(composer).getPropertyValue('--radius-element').trim();
    expect(parseFloat(radius)).toBeGreaterThanOrEqual(parseFloat(element));
    const send = getComputedStyle(
      sendOf(composer)
        .shadowRoot!.querySelector('tct-button')!
        .shadowRoot!.querySelector('.button')!,
    ).borderStartStartRadius;
    expect(send).toBe(radius);
  });

  it('honours the two admitted custom properties', async () => {
    const composer = await make();
    composer.style.setProperty('--chat-composer-radius', '20px');
    composer.style.setProperty('--chat-composer-padding', '16px');
    expect(getComputedStyle(body(composer)).borderTopLeftRadius).toBe('20px');
    expect(getComputedStyle(body(composer)).paddingTop).toBe('16px');
  });
});

describe('tct-chat-composer: focus ring', () => {
  it('draws the ring around the whole body for keyboard focus in the editor, and not for pointer focus', async () => {
    const root = await fixture<HTMLElement>(
      `<div style="inline-size: 480px"><button type="button">before</button><tct-chat-composer></tct-chat-composer></div>`,
    );
    const composer = root.querySelector<TctChatComposer>('tct-chat-composer')!;
    root.querySelector('button')!.focus();
    await pressKeys('Tab');
    expect(deepActiveElement()).toBe(editableOf(inputOf(composer)));
    await composer.updateComplete;
    expect(body(composer).hasAttribute('data-keyboard-focus')).toBe(true);
    expect(getComputedStyle(body(composer)).outlineStyle).not.toBe('none');
    // The input draws none of its own inside the composer.
    expect(getComputedStyle(editableOf(inputOf(composer))).outlineStyle).toBe('none');
    (document.activeElement as HTMLElement).blur();
    await userEvent.click(editableOf(inputOf(composer)));
    await composer.updateComplete;
    expect(body(composer).hasAttribute('data-keyboard-focus')).toBe(false);
    expect(getComputedStyle(body(composer)).outlineStyle).toBe('none');
  });

  it('leaves focus indication on an inner button instead of the body', async () => {
    const composer = await make('value="go"');
    editableOf(inputOf(composer)).focus();
    await pressKeys('Tab');
    await composer.updateComplete;
    expect(body(composer).hasAttribute('data-keyboard-focus')).toBe(false);
  });

  it('removes the ring when a pointer press lands in the focused editor', async () => {
    const composer = await make();
    editableOf(inputOf(composer)).focus();
    await pressKeys('a');
    await composer.updateComplete;
    expect(body(composer).hasAttribute('data-keyboard-focus')).toBe(true);
    await userEvent.click(editableOf(inputOf(composer)));
    await composer.updateComplete;
    expect(body(composer).hasAttribute('data-keyboard-focus')).toBe(false);
  });
});

/** Runs `check` while `element` is held pressed with the real pointer (CDP), then releases. */
async function whilePressed(element: Element, check: () => Promise<void>): Promise<void> {
  const rect = element.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  const session = cdp();
  await session.send('Input.dispatchMouseEvent', {type: 'mouseMoved', x, y});
  await session.send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x,
    y,
    button: 'left',
    clickCount: 1,
  });
  try {
    await check();
  } finally {
    // Released away from the element, so the press never becomes a click.
    await session.send('Input.dispatchMouseEvent', {type: 'mouseMoved', x: 0, y: 0});
    await session.send('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      x: 0,
      y: 0,
      button: 'left',
      clickCount: 1,
    });
  }
}

/** A state's colours arrive through a transition: measure the settled state. */
async function settled(...roots: Element[]): Promise<void> {
  await Promise.all(
    roots.flatMap((root) =>
      root.getAnimations({subtree: true}).map((animation) => animation.finished),
    ),
  );
  await Promise.all(
    [...root2(roots)].flatMap((node) =>
      node.getAnimations().map((animation) => animation.finished),
    ),
  );
}

function* root2(roots: Element[]): Generator<Element> {
  for (const root of roots) {
    yield root;
    for (const el of root.shadowRoot?.querySelectorAll('*') ?? []) {
      yield el;
      for (const inner of el.shadowRoot?.querySelectorAll('*') ?? []) yield inner;
    }
  }
}

describe('tct-chat-composer: text contrast in every state', () => {
  const contrast = {runOnly: {type: 'rule' as const, values: ['color-contrast']}};
  const slots = `<tct-button slot="footer-actions" size="md" label="Tools" variant="secondary"></tct-button>
    <tct-icon-button slot="header-actions" size="sm" icon="chevronDown" label="Attach"></tct-icon-button>
    <span slot="header-context">72% used</span>`;

  for (const theme of ['light', 'dark'] as const) {
    for (const elevation of ['low', 'none'] as const) {
      it(`resting, with a draft and a status strip (${theme}, ${elevation})`, async () => {
        const root = await fixture<HTMLElement>(
          `<div style="inline-size: 480px"><tct-chat-composer value="Hello" elevation="${elevation}" status-type="warning" status-message="Almost at the limit">${slots}</tct-chat-composer></div>`,
          {theme},
        );
        await expectAccessible(root, contrast);
        await expectAccessible(root);
      });

      it(`keyboard focus in the editor (${theme}, ${elevation})`, async () => {
        const root = await fixture<HTMLElement>(
          `<div style="inline-size: 480px"><button type="button">before</button><tct-chat-composer elevation="${elevation}">${slots}</tct-chat-composer></div>`,
          {theme},
        );
        root.querySelector('button')!.focus();
        await pressKeys('Tab');
        const composer = root.querySelector('tct-chat-composer')!;
        await settled(composer);
        await expectAccessible(root, contrast);
      });

      it(`hovering the body (${theme}, ${elevation})`, async () => {
        const root = await fixture<HTMLElement>(
          `<div style="inline-size: 480px"><tct-chat-composer value="Hello" elevation="${elevation}">${slots}</tct-chat-composer></div>`,
          {theme},
        );
        const composer = root.querySelector('tct-chat-composer')!;
        await userEvent.hover(body(composer), {position: {x: 20, y: 6}});
        await settled(composer);
        await expectAccessible(root, contrast);
      });
    }

    it(`the send button hovered, keyboard-focused and pressed (${theme})`, async () => {
      const root = await fixture<HTMLElement>(
        `<div style="inline-size: 480px"><tct-chat-composer value="Hello"></tct-chat-composer></div>`,
        {theme},
      );
      const composer = root.querySelector<TctChatComposer>('tct-chat-composer')!;
      await composer.updateComplete;
      const send = sendOf(composer);
      const inner = send.shadowRoot!.querySelector('tct-button')!;
      await waitUntil(() => !nativeSend(composer).disabled, 'enabled');
      await userEvent.hover(send);
      await settled(inner);
      await expectAccessible(root, contrast);
      await whilePressed(send, async () => {
        expect(nativeSend(composer).matches(':active')).toBe(true);
        await settled(inner);
        await expectAccessible(root, contrast);
      });
      await userEvent.hover(document.body, {position: {x: 0, y: 0}});
      editableOf(inputOf(composer)).focus();
      await pressKeys('Tab');
      expect(nativeSend(composer).matches(':focus-visible')).toBe(true);
      await settled(inner);
      await expectAccessible(root, contrast);
    });
  }
});

describe('tct-chat-composer: forced colours and reduced motion', () => {
  it('keeps the body edge and the keyboard ring in forced colours', async () => {
    if (!isChromium) return;
    const restore = await emulateMedia({forcedColors: 'active'});
    try {
      const composer = await make('status-type="error" status-message="Nope"');
      editableOf(inputOf(composer)).focus();
      await pressKeys('a');
      await composer.updateComplete;
      expect(getComputedStyle(body(composer)).borderTopStyle).toBe('solid');
      expect(getComputedStyle(body(composer)).outlineStyle).not.toBe('none');
      const strip = composer.shadowRoot!.querySelector<HTMLElement>('.status')!;
      expect(getComputedStyle(strip).borderTopStyle).toBe('solid');
    } finally {
      await restore();
    }
  });
});

describe('tct-chat-composer: right to left and localisation', () => {
  it('mirrors the footer and header in right-to-left', async () => {
    const root = await fixture<HTMLElement>(
      `<div style="inline-size: 480px"><tct-chat-composer><tct-icon-button slot="header-actions" size="sm" icon="chevronDown" label="x"></tct-icon-button><span slot="header-context">ctx</span></tct-chat-composer></div>`,
      {dir: 'rtl'},
    );
    const composer = root.querySelector<TctChatComposer>('tct-chat-composer')!;
    const send = sendOf(composer).getBoundingClientRect();
    const composerRect = composer.getBoundingClientRect();
    // The send button sits at the inline end, which is the left side in RTL.
    expect(send.left - composerRect.left).toBeLessThan(composerRect.right - send.right);
    const start = composer.shadowRoot!.querySelector('.header-start')!.getBoundingClientRect();
    expect(start.right).toBeGreaterThan(composerRect.left + composerRect.width / 2);
  });

  it('translates the default placeholder and labels (de-DE, ar-SA), and attribute overrides win', async () => {
    const german = await fixture<HTMLElement>(
      `<div lang="de-DE"><tct-chat-composer></tct-chat-composer></div>`,
    );
    const composer = german.querySelector<TctChatComposer>('tct-chat-composer')!;
    await waitUntil(
      () =>
        !inputOf(composer)
          .shadowRoot!.querySelector('.placeholder')!
          .textContent.includes('Type a message'),
      'the German catalog loads',
    );
    const label = editableOf(inputOf(composer)).getAttribute('aria-label')!;
    expect(label).not.toBe('Message input');
    const arabic = await fixture<HTMLElement>(
      `<div lang="ar-SA" dir="rtl"><tct-chat-composer></tct-chat-composer></div>`,
    );
    const rtl = arabic.querySelector<TctChatComposer>('tct-chat-composer')!;
    await waitUntil(
      () =>
        !inputOf(rtl)
          .shadowRoot!.querySelector('.placeholder')!
          .textContent.includes('Type a message'),
      'the Arabic catalog loads',
    );
    const overridden = await make('placeholder="Mine"');
    expect(inputOf(overridden).shadowRoot!.querySelector('.placeholder')!.textContent).toContain(
      'Mine',
    );
    if (isChromium) {
      expect(
        await axNode(
          sendOf(rtl).shadowRoot!.querySelector('tct-button')!.shadowRoot!.querySelector('button')!,
        ),
      ).toMatchObject({
        role: 'button',
      });
    }
  });
});

describe('tct-chat-composer: with a drawer', () => {
  it('tucks the drawer behind the body so the top corners line up', async () => {
    const composer = await make(
      '',
      `<tct-chat-composer-drawer slot="drawer" count="2" label="Attachments"><span>one.png</span><span>two.png</span></tct-chat-composer-drawer>`,
    );
    const drawer = composer.querySelector('tct-chat-composer-drawer')!;
    const drawerBase = drawer.shadowRoot!.querySelector('.base')!.getBoundingClientRect();
    const bodyRect = body(composer).getBoundingClientRect();
    // The drawer overlaps the body by the chat radius, and the body paints over it.
    expect(drawerBase.bottom).toBeGreaterThan(bodyRect.top);
    expect(drawerBase.top).toBeLessThan(bodyRect.top);
    await expectAccessible(composer);
  });
});

describe('tct-chat-composer: not form-associated', () => {
  it('does not take part in a form, and Enter never submits the surrounding form', async () => {
    const root = await fixture<HTMLElement>(
      `<form><tct-chat-composer value="text"></tct-chat-composer><button type="submit">Post</button></form>`,
    );
    const form = root.tagName === 'FORM' ? (root as HTMLFormElement) : root.querySelector('form')!;
    let submitted = 0;
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      submitted++;
    });
    const composer = form.querySelector<TctChatComposer>('tct-chat-composer')!;
    expect(new FormData(form).has('')).toBe(false);
    editableOf(inputOf(composer)).focus();
    await userEvent.keyboard('{Enter}');
    expect(submitted).toBe(0);
  });
});
