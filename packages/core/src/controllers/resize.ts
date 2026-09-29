/**
 * Shared `ResizeObserver` (A§9.18, port of upstream `sharedResizeObserver`). A single observer can
 * watch thousands of elements; one per component (per table cell) is wasteful because browsers batch
 * observations per observer, so a shared one means one callback dispatch per frame instead of N.
 *
 * Callbacks receive the platform's entries; the platform delivers an initial observation for every
 * newly observed element, so no synthetic first call is made.
 */
import type {ReactiveController, ReactiveControllerHost} from 'lit';

type ResizeCallback = (entry: ResizeObserverEntry) => void;

let observer: ResizeObserver | null = null;
// A callback may be registered more than once for one element; the count keeps registrations
// independent without dispatching duplicate work for the same reference.
const callbacks = new Map<Element, Map<ResizeCallback, number>>();

function sharedObserver(): ResizeObserver {
  observer ??= new ResizeObserver((entries) => {
    for (const entry of entries) {
      const registered = callbacks.get(entry.target);
      // A callback may unsubscribe while dispatch is in progress.
      if (registered) for (const callback of [...registered.keys()]) callback(entry);
    }
  });
  return observer;
}

/**
 * Observes `element`; returns an unsubscribe function that removes only this registration (prefer
 * it over `unobserveResize(element)`, which drops every callback on the element). The shared
 * observer is released when the last element is unobserved.
 */
export function observeResize(
  element: Element,
  callback: ResizeCallback,
  options?: ResizeObserverOptions,
): () => void {
  const existing = callbacks.get(element);
  if (existing) existing.set(callback, (existing.get(callback) ?? 0) + 1);
  else callbacks.set(element, new Map([[callback, 1]]));
  sharedObserver().observe(element, options);

  let subscribed = true;
  return () => {
    if (!subscribed) return;
    subscribed = false;
    unobserveResize(element, callback);
  };
}

/**
 * Stops observing an element. With a callback only that registration is removed; without one EVERY
 * callback on the element is dropped, which is only right for a caller that owns the element.
 */
export function unobserveResize(element: Element, callback?: ResizeCallback): void {
  const registered = callbacks.get(element);
  if (callback) {
    const count = registered?.get(callback);
    if (!registered || count === undefined) return;
    if (count > 1) {
      registered.set(callback, count - 1);
      return;
    }
    registered.delete(callback);
    if (registered.size > 0) return;
  }
  callbacks.delete(element);
  if (observer) {
    observer.unobserve(element);
    if (callbacks.size === 0) {
      observer.disconnect();
      observer = null;
    }
  }
}

export interface ResizeControllerOptions {
  /** The element(s) to watch; re-read after every host update. */
  target: () => Element | null | undefined | readonly (Element | null | undefined)[];
  callback: ResizeCallback;
  box?: ResizeObserverBoxOptions;
}

/** Observes the host's targets through the shared observer for as long as the host is connected. */
export class ResizeController implements ReactiveController {
  readonly #options: ResizeControllerOptions;
  #active = new Map<Element, () => void>();

  constructor(host: ReactiveControllerHost, options: ResizeControllerOptions) {
    this.#options = options;
    host.addController(this);
  }

  hostConnected(): void {
    this.#sync();
  }

  hostUpdated(): void {
    this.#sync();
  }

  hostDisconnected(): void {
    for (const stop of this.#active.values()) stop();
    this.#active.clear();
  }

  #sync(): void {
    const raw = this.#options.target();
    const wanted = new Set(
      (Array.isArray(raw)
        ? (raw as readonly (Element | null | undefined)[])
        : [raw as Element | null | undefined]
      ).filter((element): element is Element => element instanceof Element),
    );
    for (const [element, stop] of this.#active) {
      if (!wanted.has(element)) {
        stop();
        this.#active.delete(element);
      }
    }
    for (const element of wanted) {
      if (!this.#active.has(element)) {
        this.#active.set(
          element,
          observeResize(
            element,
            this.#options.callback,
            this.#options.box ? {box: this.#options.box} : undefined,
          ),
        );
      }
    }
  }
}

/** Disconnects the shared observer and forgets every registration. Test-only. */
export function resetResizeObserver(): void {
  callbacks.clear();
  observer?.disconnect();
  observer = null;
}
