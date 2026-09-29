/**
 * The in-house Context Community Protocol (A§9.4): request/response, subscriptions, late providers,
 * nesting, interoperability with another implementation of the protocol, and the `SizeController`
 * built on it.
 */
import {html} from 'lit';
import {property} from 'lit/decorators.js';
import {beforeAll, describe, expect, it, vi} from 'vitest';
import {
  ContextConsumer,
  ContextProvider,
  ContextRequestEvent,
  createContext,
  pendingContextRequestCount,
} from '@tecton-wc/core/context/protocol.js';
import {sizeContext, type ElementSize} from '@tecton-wc/core/context/keys.js';
import {SizeController} from '@tecton-wc/core/controllers/size.js';
import {defineElement} from '@tecton-wc/core/define.js';
import {TctElement} from '@tecton-wc/core/tct-element.js';
import {fixture} from '../fixture.js';
import {nextFrame} from '../timing.js';

const testContext = createContext<string, symbol>(Symbol.for('tct.test.context'));

class TctTestProvider extends TctElement {
  static override readonly tagName = 'tct-test-provider';
  readonly provider = new ContextProvider(this, {context: testContext, initialValue: 'initial'});
  @property() value = 'initial';
  protected override willUpdate(): void {
    this.provider.setValue(this.value);
  }
  override render() {
    return html`<slot></slot>`;
  }
}

class TctTestConsumer extends TctElement {
  static override readonly tagName = 'tct-test-consumer';
  @property({type: Boolean}) subscribe = true;
  received: string[] = [];
  consumer!: ContextConsumer<typeof testContext>;
  override connectedCallback(): void {
    this.consumer ??= new ContextConsumer(this, {
      context: testContext,
      subscribe: this.subscribe,
      callback: (value) => this.received.push(value ?? '(none)'),
    });
    super.connectedCallback();
  }
  override render() {
    return html`<span>${this.consumer.value ?? 'none'}</span>`;
  }
}

class TctTestSized extends TctElement {
  static override readonly tagName = 'tct-test-sized';
  @property() size: ElementSize | undefined;
  readonly sizeController = new SizeController(this, {explicit: () => this.size, fallback: 'md'});
  override render() {
    return html`<span>${this.sizeController.value}</span>`;
  }
}

class TctTestSizeProvider extends TctElement {
  static override readonly tagName = 'tct-test-size-provider';
  @property() size: ElementSize | null = null;
  readonly provider = new ContextProvider(this, {context: sizeContext, initialValue: null});
  protected override willUpdate(): void {
    this.provider.setValue(this.size);
  }
  override render() {
    return html`<slot></slot>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-test-provider': TctTestProvider;
    'tct-test-consumer': TctTestConsumer;
    'tct-test-sized': TctTestSized;
    'tct-test-size-provider': TctTestSizeProvider;
  }
}

beforeAll(() => {
  for (const ctor of [TctTestProvider, TctTestConsumer, TctTestSized, TctTestSizeProvider])
    defineElement(ctor);
});

const text = (element: Element): string => element.shadowRoot!.querySelector('span')!.textContent;

describe('provider and consumer', () => {
  it('a consumer receives the nearest provider’s value and follows changes', async () => {
    const root = await fixture<HTMLElement>(
      html`<tct-test-provider value="outer"
        ><tct-test-provider value="inner"><tct-test-consumer></tct-test-consumer></tct-test-provider
        ><tct-test-consumer></tct-test-consumer
      ></tct-test-provider>`,
    );
    const inner = root.querySelector<TctTestProvider>('tct-test-provider')!;
    const [nested, direct] = root.querySelectorAll<TctTestConsumer>(
      'tct-test-consumer',
    ) as unknown as [TctTestConsumer, TctTestConsumer];
    await nested.updateComplete;
    expect(text(nested)).toBe('inner');
    expect(text(direct)).toBe('outer');

    inner.value = 'changed';
    await nested.updateComplete;
    await nextFrame();
    expect(text(nested)).toBe('changed');
    expect(text(direct)).toBe('outer');
  });

  it('a consumer without a provider has no value, then finds a provider that connects later', async () => {
    const holder = await fixture<HTMLDivElement>(
      html`<div><tct-test-consumer></tct-test-consumer></div>`,
    );
    const consumer = holder.querySelector('tct-test-consumer')!;
    expect(consumer.consumer.value).toBeUndefined();
    expect(pendingContextRequestCount()).toBeGreaterThan(0);

    // A provider upgrades around the consumer afterwards (arbitrary upgrade order).
    const provider = document.createElement('tct-test-provider');
    provider.value = 'late';
    holder.replaceChildren(provider);
    provider.append(consumer);
    await consumer.updateComplete;
    await nextFrame();
    expect(consumer.consumer.value).toBe('late');
    expect(pendingContextRequestCount()).toBe(0);
  });

  it('an unanswered request is forgotten when the consumer disconnects', async () => {
    const before = pendingContextRequestCount();
    const holder = await fixture<HTMLDivElement>(
      html`<div><tct-test-consumer></tct-test-consumer></div>`,
    );
    expect(pendingContextRequestCount()).toBe(before + 1);
    holder.replaceChildren();
    expect(pendingContextRequestCount()).toBe(before);
  });

  it('a non-subscribing consumer receives one value only', async () => {
    const root = await fixture<TctTestProvider>(
      html`<tct-test-provider value="a"
        ><tct-test-consumer .subscribe=${false}></tct-test-consumer
      ></tct-test-provider>`,
    );
    const consumer = root.querySelector('tct-test-consumer')!;
    root.value = 'b';
    await root.updateComplete;
    await nextFrame();
    // Delivered once (whatever the provider held when the request was answered), never updated.
    expect(consumer.received).toHaveLength(1);
  });

  it('unsubscribes on disconnect: the provider drops the subscriber and no callback arrives', async () => {
    const root = await fixture<TctTestProvider>(
      html`<tct-test-provider value="a"
        ><tct-test-consumer></tct-test-consumer
      ></tct-test-provider>`,
    );
    const consumer = root.querySelector('tct-test-consumer')!;
    expect(root.provider.subscriberCount).toBe(1);
    await consumer.updateComplete;
    const received = [...consumer.received];
    consumer.remove();
    root.value = 'b';
    await root.updateComplete;
    expect(root.provider.subscriberCount).toBe(0);
    expect(consumer.received).toEqual(received);
  });

  it('setValue ignores unchanged values unless forced', async () => {
    const root = await fixture<TctTestProvider>(
      html`<tct-test-provider value="a"
        ><tct-test-consumer></tct-test-consumer
      ></tct-test-provider>`,
    );
    const consumer = root.querySelector('tct-test-consumer')!;
    await consumer.updateComplete;
    const before = consumer.received.length;
    root.provider.setValue('a');
    expect(consumer.received).toHaveLength(before);
    root.provider.setValue('a', true);
    expect(consumer.received).toHaveLength(before + 1);
  });

  it('a provider does not answer its own consumer role (an ancestor does)', async () => {
    const outer = await fixture<TctTestProvider>(
      html`<tct-test-provider value="outer"
        ><tct-test-provider value="inner"></tct-test-provider
      ></tct-test-provider>`,
    );
    const innerHost = outer.querySelector('tct-test-provider')!;
    const callback = vi.fn();
    innerHost.dispatchEvent(new ContextRequestEvent(testContext, innerHost, callback, false));
    expect(callback).toHaveBeenCalledExactlyOnceWith('outer');
  });

  it('interoperates with another implementation of the protocol (plain events)', async () => {
    const root = await fixture<TctTestProvider>(
      html`<tct-test-provider value="from-tct"><div id="foreign"></div></tct-test-provider>`,
    );
    const seen: string[] = [];
    const foreign = root.querySelector('#foreign')!;
    // What `@lit/context` (or any implementation) dispatches: a composed, bubbling context-request.
    const event = new Event('context-request', {bubbles: true, composed: true}) as Event & {
      context: symbol;
      contextTarget: Element;
      callback: (value: string) => void;
      subscribe: boolean;
    };
    event.context = Symbol.for('tct.test.context');
    event.contextTarget = foreign;
    event.callback = (value) => seen.push(value);
    event.subscribe = false;
    foreign.dispatchEvent(event);
    expect(seen).toEqual(['from-tct']);
  });

  it('answers requests that cross shadow boundaries', async () => {
    const root = await fixture<TctTestProvider>(
      html`<tct-test-provider value="crossing"
        ><tct-test-consumer></tct-test-consumer
      ></tct-test-provider>`,
    );
    const consumer = root.querySelector('tct-test-consumer')!;
    await consumer.updateComplete;
    // The consumer is a shadow host itself; its context request originates on the host and is composed.
    expect(text(consumer)).toBe('crossing');
  });
});

describe('SizeController (explicit, then context, then fallback)', () => {
  it('uses the fallback with no provider and the explicit value when set', async () => {
    const alone = await fixture<TctTestSized>(html`<tct-test-sized></tct-test-sized>`);
    expect(text(alone)).toBe('md');
    alone.size = 'lg';
    await alone.updateComplete;
    expect(text(alone)).toBe('lg');
    expect(alone.sizeController.provided).toBeNull();
  });

  it('follows a provider, lets the explicit size win, and reacts to provider changes', async () => {
    const provider = await fixture<TctTestSizeProvider>(
      html`<tct-test-size-provider size="sm"
        ><tct-test-sized></tct-test-sized><tct-test-sized size="lg"></tct-test-sized
      ></tct-test-size-provider>`,
    );
    const [implicit, explicit] = provider.querySelectorAll<TctTestSized>(
      'tct-test-sized',
    ) as unknown as [TctTestSized, TctTestSized];
    await implicit.updateComplete;
    expect(text(implicit)).toBe('sm');
    expect(text(explicit)).toBe('lg');
    expect(implicit.sizeController.provided).toBe('sm');

    provider.size = 'lg';
    await provider.updateComplete;
    await implicit.updateComplete;
    expect(text(implicit)).toBe('lg');

    provider.size = null;
    await provider.updateComplete;
    await implicit.updateComplete;
    expect(text(implicit)).toBe('md');
  });
});

describe('context: reconnecting without a provider (orchestrator fix, reported by WP-2)', () => {
  beforeAll(() => {
    defineElement(TctTestProvider);
    defineElement(TctTestConsumer);
  });

  it('drops the old provider value when the element is re-inserted where no provider answers', async () => {
    const root = await fixture<HTMLElement>(
      `<div><tct-test-provider value="grouped"><tct-test-consumer></tct-test-consumer></tct-test-provider><div id="outside"></div></div>`,
    );
    const consumer = root.querySelector<TctTestConsumer>('tct-test-consumer')!;
    await consumer.updateComplete;
    expect(consumer.consumer.value).toBe('grouped');
    root.querySelector('#outside')!.append(consumer);
    await consumer.updateComplete;
    await nextFrame();
    expect(consumer.consumer.value).toBeUndefined();
    expect(consumer.shadowRoot!.textContent).toContain('none');
    expect(consumer.received.at(-1)).toBe('(none)');
  });
});
