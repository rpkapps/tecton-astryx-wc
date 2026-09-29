/**
 * tct-size-provider: cascade of a default size through the sizeContext (ported from upstream
 * SizeContext.test.tsx), across shadow roots, on change, on move, and with nested providers.
 */
import {html} from 'lit';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {expectAccessible} from '@tecton-wc/testing/a11y.js';
import {fixture} from '@tecton-wc/testing/fixture.js';
import {runElementSuite} from '@tecton-wc/testing/suites/element.js';
import {aTimeout} from '@tecton-wc/testing/timing.js';
import {ContextConsumer} from '@tecton-wc/core/context/protocol.js';
import {sizeContext} from '@tecton-wc/core/context/keys.js';
import {TctElement} from '@tecton-wc/core/tct-element.js';
import {defineElement} from '@tecton-wc/core/define.js';
import '../button/define.js';
import './define.js';
import type {TctButton} from '../button/tct-button.js';
import type {TctSizeProvider} from './tct-size-provider.js';

/** A consumer written the way any family reads the context, with no button in the way. */
class TestSizeProbe extends TctElement {
  static override readonly tagName = 'tct-test-size-probe';
  readonly consumer: ContextConsumer<typeof sizeContext> = new ContextConsumer<typeof sizeContext>(
    this,
    {
      context: sizeContext,
      subscribe: true,
    },
  );
  get size(): string | null | undefined {
    return this.consumer.value;
  }
}
defineElement(TestSizeProbe);

/** Renders a button in its own shadow root: the request must cross the boundary. */
class TestSizeHost extends TctElement {
  static override readonly tagName = 'tct-test-size-host';
  override render() {
    return html`<tct-button>Inside</tct-button>`;
  }
}
defineElement(TestSizeHost);

const sizeOf = (button: TctButton): string | null =>
  button.shadowRoot!.querySelector('[data-size]')!.getAttribute('data-size');

async function mount(markup: string): Promise<HTMLElement> {
  // The fixture settles every tct-* element (and its shadow roots) before it resolves.
  return fixture<HTMLElement>(`<div>${markup}</div>`);
}

afterEach(() => {
  globalThis.tctDevMode = undefined;
});

runElementSuite({
  tag: 'tct-size-provider',
  render: () => html`<tct-size-provider><tct-button>Save</tct-button></tct-size-provider>`,
  properties: {size: 'lg'},
  attributes: {size: 'size'},
  // display: contents on the host is the whole point of a provider, and it draws no box.
  hostBox: false,
  shadow: false,
});

describe('tct-size-provider: cascade (SizeContext.test.tsx)', () => {
  it.each(['sm', 'md', 'lg'] as const)('gives a button inside the size %s', async (size) => {
    const root = await mount(
      `<tct-size-provider size="${size}"><tct-button>Go</tct-button></tct-size-provider>`,
    );
    expect(sizeOf(root.querySelector('tct-button')!)).toBe(size);
  });

  it('without a provider, controls use their own default', async () => {
    const root = await mount('<tct-button>Go</tct-button>');
    expect(sizeOf(root.querySelector('tct-button')!)).toBe('md');
  });

  it('an explicit size on the control wins over the provider', async () => {
    const root = await mount(
      '<tct-size-provider size="lg"><tct-button size="sm">Go</tct-button></tct-size-provider>',
    );
    expect(sizeOf(root.querySelector('tct-button')!)).toBe('sm');
  });

  it('reaches controls deep in the subtree and inside other elements shadow roots', async () => {
    const root = await mount(
      '<tct-size-provider size="sm"><div><section><tct-test-size-host></tct-test-size-host></section></div></tct-size-provider>',
    );
    const host = root.querySelector('tct-test-size-host')!;
    const button = host.shadowRoot!.querySelector<TctButton>('tct-button')!;
    await button.updateComplete;
    expect(sizeOf(button)).toBe('sm');
  });

  it('serves every consumer in the subtree, and only that subtree', async () => {
    const root = await mount(
      '<tct-size-provider size="lg"><tct-test-size-probe id="in"></tct-test-size-probe></tct-size-provider><tct-test-size-probe id="out"></tct-test-size-probe>',
    );
    expect(root.querySelector<TestSizeProbe>('#in')!.size).toBe('lg');
    expect(root.querySelector<TestSizeProbe>('#out')!.size).toBeUndefined();
  });

  it('the nearest provider wins', async () => {
    const root = await mount(
      '<tct-size-provider size="lg"><tct-size-provider size="sm"><tct-button id="inner">A</tct-button></tct-size-provider><tct-button id="outer">B</tct-button></tct-size-provider>',
    );
    expect(sizeOf(root.querySelector('#inner')!)).toBe('sm');
    expect(sizeOf(root.querySelector('#outer')!)).toBe('lg');
  });

  it('a nested provider without a size cancels the outer size', async () => {
    const root = await mount(
      '<tct-size-provider size="lg"><tct-size-provider><tct-button>A</tct-button></tct-size-provider></tct-size-provider>',
    );
    expect(sizeOf(root.querySelector('tct-button')!)).toBe('md');
  });
});

describe('tct-size-provider: changes', () => {
  it('re-sizes the controls when the size changes and when it is removed', async () => {
    const root = await mount(
      '<tct-size-provider size="sm"><tct-button>Go</tct-button></tct-size-provider>',
    );
    const provider = root.querySelector<TctSizeProvider>('tct-size-provider')!;
    const button = root.querySelector<TctButton>('tct-button')!;
    expect(sizeOf(button)).toBe('sm');

    provider.size = 'lg';
    await provider.updateComplete;
    await button.updateComplete;
    expect(sizeOf(button)).toBe('lg');

    provider.removeAttribute('size');
    await provider.updateComplete;
    await button.updateComplete;
    expect(sizeOf(button)).toBe('md');
  });

  it('a control moved into a provider picks its size up', async () => {
    const root = await mount(
      '<tct-button>Go</tct-button><tct-size-provider size="lg"></tct-size-provider>',
    );
    const button = root.querySelector<TctButton>('tct-button')!;
    expect(sizeOf(button)).toBe('md');
    root.querySelector('tct-size-provider')!.append(button);
    await button.updateComplete;
    expect(sizeOf(button)).toBe('lg');
  });

  it('a provider inserted around existing controls is found through the announcement', async () => {
    const root = await mount('<div id="slot"><tct-test-size-probe></tct-test-size-probe></div>');
    const probe = root.querySelector<TestSizeProbe>('tct-test-size-probe')!;
    expect(probe.size).toBeUndefined();
    const provider = document.createElement('tct-size-provider');
    provider.size = 'sm';
    root.append(provider);
    await provider.updateComplete;
    provider.append(probe);
    expect(probe.size).toBe('sm');
  });

  it('property writes before the element is upgraded are honoured', async () => {
    const root = await mount('<div></div>');
    const provider = document.createElement('tct-size-provider');
    provider.size = 'lg';
    provider.innerHTML = '<tct-button>Go</tct-button>';
    root.append(provider);
    const button = provider.querySelector<TctButton>('tct-button')!;
    await button.updateComplete;
    expect(sizeOf(button)).toBe('lg');
  });

  it('ignores a value that is not a size and warns in dev mode', async () => {
    globalThis.tctDevMode = true;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      const root = await mount(
        '<tct-size-provider size="huge"><tct-button>Go</tct-button></tct-size-provider>',
      );
      expect(sizeOf(root.querySelector('tct-button')!)).toBe('md');
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('tct-size-provider'));
    } finally {
      warn.mockRestore();
    }
  });
});

describe('tct-size-provider: element contract', () => {
  it('has no shadow root, no role, and leaves its children untouched (no marker nodes)', async () => {
    const root = await mount(
      '<tct-size-provider size="sm"><tct-button>Go</tct-button></tct-size-provider>',
    );
    const provider = root.querySelector<TctSizeProvider>('tct-size-provider')!;
    expect(provider.shadowRoot).toBeNull();
    expect(provider.hasAttribute('role')).toBe(false);
    expect([...provider.childNodes].map((node) => node.nodeName.toLowerCase())).toEqual([
      'tct-button',
    ]);
  });

  it('is display: contents, so it adds no box and no layout', async () => {
    const root = await mount(
      '<div style="display: flex; gap: 8px"><tct-size-provider size="sm"><span id="a">A</span><span id="b">B</span></tct-size-provider></div>',
    );
    const provider = root.querySelector('tct-size-provider')!;
    expect(getComputedStyle(provider).display).toBe('contents');
    const a = root.querySelector('#a')!.getBoundingClientRect();
    const b = root.querySelector('#b')!.getBoundingClientRect();
    // The two spans are flex items of the outer container: side by side with the gap between them.
    expect(b.left - a.right).toBeCloseTo(8, 0);
  });

  it('adopts its light-DOM sheet once per root, however many providers there are', async () => {
    const before = document.adoptedStyleSheets.length;
    await mount('<tct-size-provider></tct-size-provider><tct-size-provider></tct-size-provider>');
    await aTimeout();
    expect(document.adoptedStyleSheets.length - before).toBeLessThanOrEqual(1);
  });

  it('works under an RTL container', async () => {
    const root = await fixture<HTMLElement>(
      '<div><tct-size-provider size="lg"><tct-button>Go</tct-button></tct-size-provider></div>',
      {dir: 'rtl'},
    );
    const button = root.querySelector<TctButton>('tct-button')!;
    await button.updateComplete;
    expect(sizeOf(button)).toBe('lg');
  });

  it('passes axe with controls inside', async () => {
    const root = await mount(
      '<tct-size-provider size="lg"><tct-button>Save</tct-button><tct-button variant="primary">Send</tct-button></tct-size-provider>',
    );
    await expectAccessible(root);
  });
});
