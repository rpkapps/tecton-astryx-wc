/**
 * In-house implementation of the Context Community Protocol (A-10, A§9.4). `@lit/context` is not an
 * approved dependency (D-007); the protocol is small and interoperable, so elements using
 * `@lit/context` or any other implementation of it work with ours in either direction.
 *
 * Protocol recap:
 *  - a consumer dispatches a bubbling, composed `context-request` event carrying
 *    `{context, contextTarget, callback, subscribe}`;
 *  - the nearest provider for that context answers by calling `callback(value, unsubscribe?)` and
 *    stops the event; with `subscribe` it calls back again on every change;
 *  - a provider that connects later announces itself with a bubbling `context-provider` event so
 *    consumers whose request went unanswered ask again (late upgrade order is arbitrary).
 */
import type {ReactiveController, ReactiveControllerHost} from 'lit';

/** A context key branded with the type of its value. */
export type Context<K, V> = K & {__context__: V};
export type UnknownContext = Context<unknown, unknown>;
export type ContextType<C extends UnknownContext> = C extends Context<unknown, infer V> ? V : never;

/** Creates a context key. Use a `Symbol.for(...)` (or a namespaced string) so copies interoperate. */
export function createContext<V, K extends string | symbol = string | symbol>(
  key: K,
): Context<K, V> {
  return key as Context<K, V>;
}

export type ContextCallback<V> = (value: V, unsubscribe?: () => void) => void;

/** Consumer to provider request. */
export class ContextRequestEvent<C extends UnknownContext> extends Event {
  readonly context: C;
  readonly contextTarget: Element;
  readonly callback: ContextCallback<ContextType<C>>;
  readonly subscribe: boolean | undefined;

  constructor(
    context: C,
    contextTarget: Element,
    callback: ContextCallback<ContextType<C>>,
    subscribe?: boolean,
  ) {
    super('context-request', {bubbles: true, composed: true});
    this.context = context;
    this.contextTarget = contextTarget;
    this.callback = callback;
    this.subscribe = subscribe;
  }
}

/** Provider announcement, so unanswered consumers re-request. */
export class ContextProviderEvent<C extends UnknownContext> extends Event {
  readonly context: C;
  readonly contextTarget: Element;

  constructor(context: C, contextTarget: Element) {
    super('context-provider', {bubbles: true, composed: true});
    this.context = context;
    this.contextTarget = contextTarget;
  }
}

declare global {
  interface HTMLElementEventMap {
    'context-request': ContextRequestEvent<UnknownContext>;
    'context-provider': ContextProviderEvent<UnknownContext>;
  }
}

type ContextHost = ReactiveControllerHost & HTMLElement;

// ------------------------------------------------------------------ root: unanswered requests

interface PendingRequest {
  readonly context: UnknownContext;
  readonly target: Element;
  /** Re-dispatches the request; the consumer removes itself when answered. */
  readonly retry: () => void;
}

/** Composed-tree containment: `node` is `ancestor` or inside it (shadow hosts count as parents). */
function isInsideComposed(ancestor: Node, node: Node | null): boolean {
  for (let current = node; current; current = current.parentNode ?? (current as ShadowRoot).host) {
    if (current === ancestor) return true;
  }
  return false;
}

const pending = new Set<PendingRequest>();
let rootListening = false;

function onProviderAnnounced(event: Event): void {
  const announcement = event as ContextProviderEvent<UnknownContext>;
  for (const request of [...pending]) {
    if (request.context !== announcement.context) continue;
    if (request.target === announcement.contextTarget) continue;
    if (isInsideComposed(announcement.contextTarget, request.target)) request.retry();
  }
}

function ensureRoot(): void {
  if (rootListening || typeof document === 'undefined') return;
  rootListening = true;
  // Announcements are composed and bubble to the document from any tree.
  document.addEventListener('context-provider', onProviderAnnounced);
}

// ---------------------------------------------------------------------------------- provider

export interface ContextProviderOptions<C extends UnknownContext> {
  context: C;
  initialValue?: ContextType<C>;
}

interface Subscription {
  consumer: Element;
  unsubscribe: () => void;
}

/**
 * Answers `context-request` events for one context on the host.
 *
 * ```ts
 * #size = new ContextProvider(this, {context: sizeContext, initialValue: null});
 * updated(changed) { if (changed.has('size')) this.#size.setValue(this.size ?? null); }
 * ```
 */
export class ContextProvider<C extends UnknownContext> implements ReactiveController {
  readonly #host: ContextHost;
  readonly #context: C;
  #value: ContextType<C>;
  readonly #subscriptions = new Map<ContextCallback<ContextType<C>>, Subscription>();

  constructor(host: ContextHost, options: ContextProviderOptions<C>) {
    this.#host = host;
    this.#context = options.context;
    this.#value = options.initialValue!;
    // Lit calls hostConnected() itself when the controller is added to an already connected host.
    host.addController(this);
  }

  get value(): ContextType<C> {
    return this.#value;
  }

  /** Sets the value and notifies subscribers; unchanged values are ignored unless `force`. */
  setValue(value: ContextType<C>, force = false): void {
    if (!force && Object.is(this.#value, value)) return;
    this.#value = value;
    for (const [callback, subscription] of [...this.#subscriptions]) {
      if (!subscription.consumer.isConnected) {
        this.#subscriptions.delete(callback);
        continue;
      }
      callback(value, subscription.unsubscribe);
    }
  }

  /** Number of live subscribers (tests and diagnostics). */
  get subscriberCount(): number {
    return this.#subscriptions.size;
  }

  hostConnected(): void {
    this.#host.addEventListener('context-request', this.#onRequest as EventListener);
    this.#host.dispatchEvent(new ContextProviderEvent(this.#context, this.#host));
  }

  hostDisconnected(): void {
    this.#host.removeEventListener('context-request', this.#onRequest as EventListener);
  }

  readonly #onRequest = (event: ContextRequestEvent<UnknownContext>): void => {
    if (event.context !== this.#context) return;
    const consumer = event.contextTarget ?? (event.composedPath()[0] as Element);
    // A provider does not answer its own consumer role; an ancestor provider does.
    if (consumer === this.#host) return;
    event.stopPropagation();
    const callback = event.callback as ContextCallback<ContextType<C>>;
    if (event.subscribe) {
      const unsubscribe = (): void => {
        this.#subscriptions.delete(callback);
      };
      this.#subscriptions.set(callback, {consumer, unsubscribe});
      callback(this.#value, unsubscribe);
    } else {
      callback(this.#value);
    }
  };
}

// ---------------------------------------------------------------------------------- consumer

export interface ContextConsumerOptions<C extends UnknownContext> {
  context: C;
  /** Keep receiving changes. Default `false` (one value, e.g. for values that never change). */
  subscribe?: boolean;
  /** Called with every delivered value, before the host re-renders. */
  callback?: (value: ContextType<C>) => void;
}

/**
 * Requests a context from the nearest provider when the host connects and re-renders the host when
 * the value changes. Late providers are found through the `context-provider` announcement.
 *
 * ```ts
 * #size = new ContextConsumer(this, {context: sizeContext, subscribe: true});
 * render() { const size = this.#size.value ?? 'md'; … }
 * ```
 */
export class ContextConsumer<C extends UnknownContext> implements ReactiveController {
  readonly #host: ContextHost;
  readonly #context: C;
  readonly #subscribe: boolean;
  readonly #callback: ((value: ContextType<C>) => void) | undefined;
  #value: ContextType<C> | undefined;
  #unsubscribe: (() => void) | undefined;
  #answered = false;
  readonly #request: PendingRequest;

  constructor(host: ContextHost, options: ContextConsumerOptions<C>) {
    this.#host = host;
    this.#context = options.context;
    this.#subscribe = options.subscribe ?? false;
    this.#callback = options.callback;
    this.#request = {context: this.#context, target: host, retry: () => this.#dispatch()};
    host.addController(this);
  }

  /** The latest delivered value, or `undefined` while no provider has answered. */
  get value(): ContextType<C> | undefined {
    return this.#value;
  }

  hostConnected(): void {
    this.#dispatch();
  }

  hostDisconnected(): void {
    this.#unsubscribe?.();
    this.#unsubscribe = undefined;
    this.#answered = false;
    pending.delete(this.#request);
  }

  #dispatch(): void {
    this.#answered = false;
    this.#host.dispatchEvent(
      new ContextRequestEvent(this.#context, this.#host, this.#onValue, this.#subscribe),
    );
    if (this.#answered) {
      pending.delete(this.#request);
    } else {
      ensureRoot();
      pending.add(this.#request);
    }
  }

  readonly #onValue = (value: ContextType<C>, unsubscribe?: () => void): void => {
    this.#answered = true;
    if (unsubscribe) {
      if (unsubscribe !== this.#unsubscribe) {
        // A different provider took over: drop the old subscription.
        this.#unsubscribe?.();
        this.#unsubscribe = unsubscribe;
      }
    } else {
      this.#unsubscribe = undefined;
    }
    this.#value = value;
    pending.delete(this.#request);
    this.#callback?.(value);
    this.#host.requestUpdate();
  };
}

/** Number of unanswered requests waiting for a provider (tests and diagnostics). */
export function pendingContextRequestCount(): number {
  return pending.size;
}
