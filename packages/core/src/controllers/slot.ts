/**
 * Slot presence (A§7.7, A§9.18): does a named slot (or the default slot) have content? Computed from
 * the host's own children, so it is right before the first render and needs no template cooperation.
 * Whitespace-only text never counts (`<slot>` would otherwise be "full" of formatting whitespace).
 * The host re-renders when presence changes, and consumers can style `:state(has-<slot>)`; internal
 * layout must not depend on it, because a server cannot know (A§14).
 *
 * ```ts
 * #slots = new SlotController(this, 'icon', 'description', 'default');
 * render() { return html`${this.#slots.has('icon') ? html`<span part="icon"><slot name="icon"></slot></span>` : nothing}…`; }
 * ```
 */
import type {ReactiveController, ReactiveControllerHost} from 'lit';

type SlotHost = ReactiveControllerHost & HTMLElement;

const DEFAULT_NAMES = new Set(['', 'default', '[default]']);

export class SlotController implements ReactiveController {
  readonly #host: SlotHost;
  readonly #names: readonly string[];
  readonly #last = new Map<string, boolean>();
  #observer: MutationObserver | undefined;

  constructor(host: SlotHost, ...slotNames: string[]) {
    this.#host = host;
    this.#names = slotNames;
    host.addController(this);
  }

  /** Whether `name` (`'default'` for the default slot) currently has content. */
  has(name: string): boolean {
    if (DEFAULT_NAMES.has(name)) {
      return [...this.#host.childNodes].some((node) => {
        if (node.nodeType === Node.TEXT_NODE) return (node.textContent ?? '').trim() !== '';
        if (node.nodeType !== Node.ELEMENT_NODE) return false;
        const element = node as Element;
        return !element.hasAttribute('slot') && element.localName !== 'template';
      });
    }
    return [...this.#host.children].some((element) => element.getAttribute('slot') === name);
  }

  hostConnected(): void {
    this.#observer ??= new MutationObserver(() => {
      this.#sync(true);
    });
    // `subtree` is needed to see a direct text node edited in place (characterData); deeper changes
    // are filtered out by `#sync`, which only re-renders when presence actually changed.
    this.#observer.observe(this.#host, {
      childList: true,
      characterData: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['slot'],
    });
    this.#sync(false);
  }

  hostDisconnected(): void {
    this.#observer?.disconnect();
  }

  #sync(update: boolean): void {
    let changed = false;
    for (const name of this.#names) {
      const has = this.has(name);
      if (this.#last.get(name) === has) continue;
      this.#last.set(name, has);
      changed = true;
      const state = DEFAULT_NAMES.has(name) ? 'has-default' : `has-${name}`;
      (this.#host as unknown as {toggleState?: (name: string, on: boolean) => void}).toggleState?.(
        state,
        has,
      );
    }
    if (changed && update) this.#host.requestUpdate();
  }
}
