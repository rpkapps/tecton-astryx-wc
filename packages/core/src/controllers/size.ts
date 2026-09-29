/**
 * Size cascade (A§7.2, A§9.18): explicit attribute, then the nearest `sizeContext` provider
 * (`tct-size-provider`, or a container such as a button group), then the component default. An
 * explicit empty value is not a value; `null` from a provider means "no container is providing one".
 *
 * ```ts
 * #size = new SizeController(this, {explicit: () => this.size, fallback: 'md'});
 * render() { return html`<div data-size=${this.#size.value}>…`; }
 * ```
 */
import type {ReactiveControllerHost} from 'lit';
import {ContextConsumer} from '../context/protocol.js';
import {sizeContext, type ElementSize} from '../context/keys.js';

export interface SizeControllerOptions<S extends string = ElementSize> {
  /** The element's own `size` (attribute/property); `undefined` or `null` when unset. */
  explicit: () => S | null | undefined;
  /** Used when neither an explicit size nor a provider supplies one. Default `'md'`. */
  fallback?: S;
}

export class SizeController<S extends string = ElementSize> {
  readonly #options: SizeControllerOptions<S>;
  readonly #consumer: ContextConsumer<typeof sizeContext>;

  constructor(host: ReactiveControllerHost & HTMLElement, options: SizeControllerOptions<S>) {
    this.#options = options;
    this.#consumer = new ContextConsumer(host, {context: sizeContext, subscribe: true});
  }

  /** The resolved size. */
  get value(): S {
    const explicit = this.#options.explicit();
    if (explicit) return explicit;
    const provided = this.#consumer.value;
    if (provided) return provided as unknown as S;
    return this.#options.fallback ?? ('md' as S);
  }

  /** The size a provider supplies, ignoring the element's own (for styling relative to the container). */
  get provided(): ElementSize | null {
    return this.#consumer.value ?? null;
  }
}
