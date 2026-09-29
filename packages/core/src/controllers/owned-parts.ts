/**
 * Owned light-DOM satellites (A§8.2, A-06). IDREFs never cross a shadow boundary and element
 * reflection only points outward, so when author light-DOM content must reference something the
 * component renders (a tooltip describing a slotted trigger, a field labelling a slotted native
 * control), the target is rendered as a light-DOM child of the host: usually an internal custom
 * element with its own shadow root for styles and its text in light DOM so it takes part in name
 * computation. Satellites are marked `data-tct-owned`, assigned to a named slot of the host, and
 * re-created if a framework removes them (a reconciler prunes unknown children).
 *
 * ```ts
 * #parts = new OwnedPartsController(this, {parts: [{
 *   slot: 'surface', tag: 'tct-tooltip-surface',
 *   init: (el) => { el.textContent = this.content; },
 * }]});
 * ```
 * Guides: [mwg:shadow-dom] [mwg:accessible-web-components]
 */
import type {ReactiveController, ReactiveControllerHost} from 'lit';

export interface OwnedPart<E extends HTMLElement = HTMLElement> {
  /** Slot name the satellite is assigned to. */
  slot: string;
  /** Tag to render (registered by the component's `dependencies`). */
  tag: string;
  /** Called after creation and after every host update; must be idempotent. */
  init(element: E): void;
  /** Skip the part while this returns false (removed while false). Default: always present. */
  when?: () => boolean;
}

export interface OwnedPartsOptions {
  parts: readonly OwnedPart[];
}

export class OwnedPartsController implements ReactiveController {
  readonly #host: ReactiveControllerHost & HTMLElement;
  readonly #options: OwnedPartsOptions;
  readonly #elements = new Map<string, HTMLElement>();
  #observer: MutationObserver | undefined;

  constructor(host: ReactiveControllerHost & HTMLElement, options: OwnedPartsOptions) {
    this.#host = host;
    this.#options = options;
    host.addController(this);
  }

  /** The satellite for `slot`, or `undefined` while absent. */
  get(slot: string): HTMLElement | undefined {
    return this.#elements.get(slot);
  }

  hostConnected(): void {
    this.ensure();
    this.#observer ??= new MutationObserver(() => {
      // A reconciler removed a satellite: put it back on the next microtask (never mid-mutation).
      queueMicrotask(() => {
        this.ensure();
      });
    });
    this.#observer.observe(this.#host, {childList: true});
  }

  hostUpdated(): void {
    this.ensure();
  }

  hostDisconnected(): void {
    this.#observer?.disconnect();
  }

  /** Creates missing satellites, removes those whose `when` turned false, and re-runs `init`. */
  ensure(): void {
    if (!this.#host.isConnected) return;
    for (const part of this.#options.parts) {
      const wanted = part.when?.() ?? true;
      let element = this.#elements.get(part.slot);
      if (element && element.parentNode !== this.#host) {
        this.#elements.delete(part.slot);
        element = undefined;
      }
      if (!wanted) {
        if (element) {
          element.remove();
          this.#elements.delete(part.slot);
        }
        continue;
      }
      if (!element) {
        // The tag is data (registered dependency), never a literal `tct-` name in this module.
        element = this.#host.ownerDocument.createElement(part.tag);
        element.setAttribute('slot', part.slot);
        element.setAttribute('data-tct-owned', '');
        this.#host.append(element);
        this.#elements.set(part.slot, element);
      }
      part.init(element);
    }
  }
}
