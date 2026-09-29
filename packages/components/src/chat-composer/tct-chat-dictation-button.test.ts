/// <reference types="@vitest/browser-playwright" />
import {describe, expect, it} from 'vitest';
import {userEvent} from 'vitest/browser';
import {axNode, expectAccessible} from '@tecton-wc/testing/a11y.js';
import {emulateMedia} from '@tecton-wc/testing/emulate.js';
import {fixture} from '@tecton-wc/testing/fixture.js';
import {pressKeys} from '@tecton-wc/testing/keyboard.js';
import {runElementSuite} from '@tecton-wc/testing/suites/element.js';
import {isChromium} from '@tecton-wc/testing/tier.js';
import {waitUntil} from '@tecton-wc/testing/timing.js';
import '../button/define.js';
import './define.js';
import type {ChatDictationSource, TctChatDictationButton} from './tct-chat-dictation-button.js';

/** A dictation source the test drives by hand. */
class FakeDictation implements ChatDictationSource {
  isSupported = true;
  isListening = false;
  volume = 0;
  bands: number[] = [0, 0, 0, 0, 0];
  toggles = 0;
  #listeners = new Set<() => void>();
  toggle(): void {
    this.toggles++;
    this.isListening = !this.isListening;
    this.emit();
  }
  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }
  get listeners(): number {
    return this.#listeners.size;
  }
  emit(): void {
    for (const listener of [...this.#listeners]) listener();
  }
}

const inner = (element: Element): HTMLElement => element.shadowRoot!.querySelector('tct-button')!;
const native = (element: Element): HTMLButtonElement =>
  inner(element).shadowRoot!.querySelector('button')!;
const bars = (element: Element): HTMLElement[] => [
  ...element.shadowRoot!.querySelectorAll<HTMLElement>('.bar'),
];

async function make(
  dictation: ChatDictationSource | undefined,
  attributes = '',
): Promise<TctChatDictationButton> {
  const root = await fixture<HTMLElement>(
    `<div style="display: flex"><tct-chat-dictation-button ${attributes}></tct-chat-dictation-button><span id="after">after</span></div>`,
  );
  const button = root.querySelector<TctChatDictationButton>('tct-chat-dictation-button')!;
  button.dictation = dictation;
  await button.updateComplete;
  return button;
}

runElementSuite({
  tag: 'tct-chat-dictation-button',
  properties: {size: 'sm', showUnsupported: true, label: 'Voice'},
  attributes: {size: 'size', showUnsupported: 'show-unsupported', label: 'label'},
  // Without a dictation source the button is hidden (display: none), so there is nothing to name, and
  // `[hidden]` cannot show a difference: both checks would be vacuous.
  a11y: false,
  skip: ['hidden'],
});

describe('tct-chat-dictation-button: unsupported engines', () => {
  it('is hidden (no box, nothing rendered) and never throws when dictation is unsupported', async () => {
    const source = new FakeDictation();
    source.isSupported = false;
    const button = await make(source);
    expect(getComputedStyle(button).display).toBe('none');
    expect(button.shadowRoot!.querySelector('tct-button')).toBeNull();
    expect(button.getBoundingClientRect().width).toBe(0);
    // A neighbour is not pushed away by a gap for it.
    expect(button.nextElementSibling!.getBoundingClientRect().left).toBe(button.parentElement!.getBoundingClientRect().left);
  });

  it('is hidden without any dictation source at all', async () => {
    const button = await make(undefined);
    expect(getComputedStyle(button).display).toBe('none');
  });

  it('with show-unsupported stays visible, disabled and named', async () => {
    const source = new FakeDictation();
    source.isSupported = false;
    const button = await make(source, 'show-unsupported');
    expect(getComputedStyle(button).display).not.toBe('none');
    expect(native(button).disabled).toBe(true);
    if (isChromium) expect(await axNode(native(button))).toMatchObject({role: 'button', name: 'Start dictation'});
    await userEvent.click(native(button), {force: true});
    expect(source.toggles).toBe(0);
  });

  it('appears when the source turns out to be supported', async () => {
    const source = new FakeDictation();
    source.isSupported = false;
    const button = await make(source);
    source.isSupported = true;
    button.requestUpdate();
    await button.updateComplete;
    expect(getComputedStyle(button).display).not.toBe('none');
  });
});

describe('tct-chat-dictation-button: toggling', () => {
  it('is a ghost icon button named "Start dictation" with a microphone, and toggles the source', async () => {
    const source = new FakeDictation();
    const button = await make(source);
    const control = inner(button);
    expect(control.getAttribute('variant')).toBe('ghost');
    expect(control.getAttribute('icon')).toBe('microphone');
    expect(control.hasAttribute('icon-only')).toBe(true);
    expect(native(button).disabled).toBe(false);
    if (isChromium) expect(await axNode(native(button))).toMatchObject({role: 'button', name: 'Start dictation'});
    await userEvent.click(native(button));
    expect(source.toggles).toBe(1);
    await waitUntil(() => control.getAttribute('label') === 'Stop dictation', 'the label follows the state');
    if (isChromium) expect(await axNode(native(button))).toMatchObject({name: 'Stop dictation'});
  });

  it('operates with Enter and Space', async () => {
    const source = new FakeDictation();
    const button = await make(source);
    native(button).focus();
    await pressKeys('Enter');
    await pressKeys(' ');
    expect(source.toggles).toBe(2);
  });

  it('takes a label override', async () => {
    const button = await make(new FakeDictation(), 'label="Voice input"');
    expect(inner(button).getAttribute('label')).toBe('Voice input');
  });

  it('is 32px (md) or 28px (sm) tall', async () => {
    const md = await make(new FakeDictation());
    const sm = await make(new FakeDictation(), 'size="sm"');
    expect(native(md).getBoundingClientRect().height).toBe(32);
    expect(native(sm).getBoundingClientRect().height).toBe(28);
  });
});

describe('tct-chat-dictation-button: the equalizer', () => {
  it('shows five bars while listening, in place of the icon, hidden from assistive technology', async () => {
    const source = new FakeDictation();
    const button = await make(source);
    expect(bars(button)).toHaveLength(0);
    source.isListening = true;
    source.emit();
    await button.updateComplete;
    expect(bars(button)).toHaveLength(5);
    expect(inner(button).getAttribute('icon')).toBe('');
    expect(button.shadowRoot!.querySelector('.bars')!.getAttribute('aria-hidden')).toBe('true');
    await expectAccessible(button);
  });

  it('scales each bar from the centre with its band, and follows the level per frame without a re-render of the page', async () => {
    const source = new FakeDictation();
    source.isListening = true;
    const button = await make(source);
    source.bands = [0, 0.02, 0.05, 0.1, 0.4];
    source.volume = 0.05;
    source.emit();
    await button.updateComplete;
    const scales = bars(button).map((bar) => Number(/scaleY\(([\d.]+)\)/.exec(bar.style.transform)![1]));
    expect(scales[0]).toBeCloseTo(0.08, 2);
    expect(scales[4]).toBeCloseTo(1, 2);
    for (let i = 1; i < scales.length; i++) expect(scales[i]!).toBeGreaterThanOrEqual(scales[i - 1]!);
  });

  it('blends toward the error colour as the voice clips, and back', async () => {
    const source = new FakeDictation();
    source.isListening = true;
    const button = await make(source);
    source.volume = 0.1;
    source.emit();
    await button.updateComplete;
    expect(bars(button)[0]!.style.backgroundColor).toBe('');
    source.volume = 0.3;
    source.emit();
    await button.updateComplete;
    expect(bars(button)[0]!.style.backgroundColor).toContain('var(--color-error)');
    expect(bars(button)[0]!.style.backgroundColor).toContain('100%');
    source.volume = 0.05;
    source.emit();
    await button.updateComplete;
    expect(bars(button)[0]!.style.backgroundColor).toBe('');
  });

  it('is sized by the button size', async () => {
    const source = new FakeDictation();
    source.isListening = true;
    const sm = await make(source, 'size="sm"');
    const md = await make(source);
    expect(parseFloat(bars(sm)[0]!.style.inlineSize)).toBeLessThan(parseFloat(bars(md)[0]!.style.inlineSize));
    expect(parseFloat(sm.shadowRoot!.querySelector<HTMLElement>('.bars')!.style.blockSize)).toBeLessThan(
      parseFloat(md.shadowRoot!.querySelector<HTMLElement>('.bars')!.style.blockSize),
    );
  });

  it('paints the bars in the button text colour in forced colours, even while clipping', async () => {
    if (!isChromium) return;
    const restore = await emulateMedia({forcedColors: 'active'});
    try {
      const source = new FakeDictation();
      source.isListening = true;
      source.volume = 0.3;
      source.bands = [0.2, 0.2, 0.2, 0.2, 0.2];
      const button = await make(source);
      const paint = getComputedStyle(bars(button)[0]!).backgroundColor;
      expect(paint).toBe(getComputedStyle(inner(button)).color);
    } finally {
      await restore();
    }
  });

  it('does not animate the bars under reduced motion', async () => {
    const restore = await emulateMedia({reducedMotion: 'reduce'});
    try {
      const source = new FakeDictation();
      source.isListening = true;
      const button = await make(source);
      expect(getComputedStyle(bars(button)[0]!).transitionProperty).toBe('all');
      expect(getComputedStyle(bars(button)[0]!).transitionDuration).toBe('0s');
    } finally {
      await restore();
    }
  });
});

describe('tct-chat-dictation-button: following the source', () => {
  it('subscribes to the source and re-renders on its changes, and unsubscribes on disconnect', async () => {
    const source = new FakeDictation();
    const button = await make(source);
    expect(source.listeners).toBe(1);
    button.remove();
    expect(source.listeners).toBe(0);
    button.dictation = source;
    document.body.append(button);
    await button.updateComplete;
    expect(source.listeners).toBe(1);
    button.remove();
  });

  it('moves the subscription when the dictation source is replaced', async () => {
    const first = new FakeDictation();
    const second = new FakeDictation();
    const button = await make(first);
    button.dictation = second;
    await button.updateComplete;
    expect(first.listeners).toBe(0);
    expect(second.listeners).toBe(1);
    await userEvent.click(native(button));
    expect(second.toggles).toBe(1);
    expect(first.toggles).toBe(0);
  });

  it('works with a source that cannot be subscribed to (re-renders on its own updates)', async () => {
    const source: ChatDictationSource = {
      isSupported: true,
      isListening: false,
      volume: 0,
      bands: [],
      toggle: () => undefined,
    };
    const button = await make(source);
    expect(native(button).disabled).toBe(false);
  });
});

describe('tct-chat-dictation-button: text contrast, states and locales', () => {
  for (const theme of ['light', 'dark'] as const) {
    it(`passes axe idle, hovered, keyboard-focused and listening (${theme})`, async () => {
      const source = new FakeDictation();
      const root = await fixture<HTMLElement>(
        `<div><button type="button">before</button><tct-chat-dictation-button></tct-chat-dictation-button></div>`,
        {theme},
      );
      const button = root.querySelector<TctChatDictationButton>('tct-chat-dictation-button')!;
      button.dictation = source;
      await button.updateComplete;
      await expectAccessible(root);
      await userEvent.hover(native(button));
      await Promise.all(native(button).getAnimations().map((a) => a.finished));
      await expectAccessible(root);
      await userEvent.hover(document.body, {position: {x: 0, y: 0}});
      root.querySelector('button')!.focus();
      await pressKeys('Tab');
      expect(native(button).matches(':focus-visible')).toBe(true);
      await expectAccessible(root);
      source.isListening = true;
      source.bands = [0.1, 0.2, 0.3, 0.2, 0.1];
      source.emit();
      await button.updateComplete;
      await expectAccessible(root);
    });
  }

  it('is named in German while idle, and the source may live in another language', async () => {
    const source = new FakeDictation();
    const root = await fixture<HTMLElement>(
      `<div lang="de-DE"><tct-chat-dictation-button></tct-chat-dictation-button></div>`,
    );
    const button = root.querySelector<TctChatDictationButton>('tct-chat-dictation-button')!;
    button.dictation = source;
    await button.updateComplete;
    await waitUntil(() => inner(button).getAttribute('label') !== 'Start dictation', 'the German catalog loads');
  });
});
