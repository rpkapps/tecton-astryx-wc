/**
 * Adapts the page's own scroller for the stick-to-bottom controllers. When the document scrolls, its
 * `scroll` and `scrollend` events fire on `document`, never on `document.documentElement`, so a
 * controller that listens on the element it scrolls would never hear the reader. And the root element's
 * `offsetHeight` is the whole document, so "distance from the bottom" would always read zero. This
 * wrapper answers both: it forwards those listeners to `document` and reports the viewport height as
 * `offsetHeight`; everything else reaches the real element.
 *
 * ```ts
 * const scroller = isViewportScroller(element) ? viewportScroller(element) : element;
 * ```
 */

/** Whether `element` is what scrolls the page (the document's scrolling element, or `<body>` in quirks mode). */
export function isViewportScroller(element: Element): boolean {
  const doc = element.ownerDocument;
  return (
    element === doc.scrollingElement || element === doc.documentElement || element === doc.body
  );
}

const cache = new WeakMap<HTMLElement, HTMLElement>();

const isViewportEvent = (type: string): boolean => type === 'scroll' || type === 'scrollend';

/** A view of the page scroller that the scroll controllers can use as if it were an element scroller. */
export function viewportScroller(element: HTMLElement): HTMLElement {
  const existing = cache.get(element);
  if (existing) return existing;
  const doc = element.ownerDocument;
  const proxy = new Proxy(element, {
    get(target, property) {
      if (property === 'offsetHeight') return target.clientHeight;
      if (property === 'addEventListener') {
        return (
          type: string,
          listener: EventListenerOrEventListenerObject | null,
          options?: boolean | AddEventListenerOptions,
        ) => {
          (isViewportEvent(type) ? doc : target).addEventListener(type, listener!, options);
        };
      }
      if (property === 'removeEventListener') {
        return (
          type: string,
          listener: EventListenerOrEventListenerObject | null,
          options?: boolean | EventListenerOptions,
        ) => {
          (isViewportEvent(type) ? doc : target).removeEventListener(type, listener!, options);
        };
      }
      const value: unknown = Reflect.get(target, property, target);
      return typeof value === 'function'
        ? (value as (...args: unknown[]) => unknown).bind(target)
        : value;
    },
    set(target, property, value) {
      return Reflect.set(target, property, value, target);
    },
  });
  cache.set(element, proxy);
  return proxy;
}
