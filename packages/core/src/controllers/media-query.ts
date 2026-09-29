/**
 * Reactive media query (A§9.18, upstream `useMediaQuery`). `matches` is `false` on the server and
 * before the host connects, then live; the host re-renders when it changes. First paint must not
 * depend on it (a server cannot know): prefer CSS media/container queries and use this only for
 * behaviour (which presentation to mount).
 *
 * ```ts
 * #narrow = new MediaQueryController(this, '(max-width: 40rem)');
 * render() { return this.#narrow.matches ? html`<drawer>` : html`<sidebar>`; }
 * ```
 */
import type {ReactiveController, ReactiveControllerHost} from 'lit';

export class MediaQueryController implements ReactiveController {
  readonly #host: ReactiveControllerHost;
  readonly #query: string | (() => string);
  #list: MediaQueryList | undefined;
  #matches = false;

  constructor(host: ReactiveControllerHost, query: string | (() => string)) {
    this.#host = host;
    this.#query = query;
    host.addController(this);
  }

  get matches(): boolean {
    return this.#matches;
  }

  hostConnected(): void {
    if (typeof matchMedia !== 'function') return;
    this.#list = matchMedia(typeof this.#query === 'function' ? this.#query() : this.#query);
    this.#list.addEventListener('change', this.#onChange);
    this.#set(this.#list.matches);
  }

  hostDisconnected(): void {
    this.#list?.removeEventListener('change', this.#onChange);
    this.#list = undefined;
  }

  readonly #onChange = (event: MediaQueryListEvent): void => {
    this.#set(event.matches);
  };

  #set(matches: boolean): void {
    if (matches === this.#matches) return;
    this.#matches = matches;
    this.#host.requestUpdate();
  }
}
