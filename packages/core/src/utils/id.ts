/**
 * Document-unique ids (A§9.17). Ids only ever relate elements inside one tree, so prefer element
 * references or owned parts over ids when a relationship would cross a shadow boundary
 * [mwg:accessible-web-components].
 */
import type {ReactiveController, ReactiveControllerHost} from 'lit';

let counter = 0;
// A per-load seed keeps ids unique when two copies of the library share a document.
const seed = Math.random().toString(36).slice(2, 6);

/** `uniqueId('tct-tab')` -> `tct-tab-k3x9-12`. */
export function uniqueId(prefix = 'tct'): string {
  counter += 1;
  return `${prefix}-${seed}-${counter}`;
}

/**
 * Per-element id factory: `id('label')` is stable for the life of the host, so templates can render
 * the same id on every update.
 *
 * ```ts
 * #ids = new IdController(this, 'tct-field');
 * render() { return html`<label id=${this.#ids.id('label')}>…`; }
 * ```
 */
export class IdController implements ReactiveController {
  readonly #prefix: string;
  readonly #ids = new Map<string, string>();
  #base: string | undefined;

  constructor(host: ReactiveControllerHost, prefix: string) {
    this.#prefix = prefix;
    host.addController(this);
  }

  /** The stable id for `part`; created on first use. */
  id(part: string): string {
    let value = this.#ids.get(part);
    if (value === undefined) {
      this.#base ??= uniqueId(this.#prefix);
      value = `${this.#base}-${part}`;
      this.#ids.set(part, value);
    }
    return value;
  }

  hostConnected(): void {
    // Nothing to do: ids are lazily created and survive reconnects (A§7.9 keeps state on move).
  }
}
