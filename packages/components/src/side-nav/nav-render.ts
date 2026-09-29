/**
 * Renders a navigation element synchronously when it connects, instead of at the next microtask.
 *
 * Why: these elements wrap slotted content in a `tct-size-provider` inside their own shadow root (footer
 * icons and row actions take the compact size). A consumer that connects *before* that provider exists
 * asks for `sizeContext`, gets no answer and waits for the provider's announcement; the context root
 * only retries consumers that are descendants of the provider through `parentNode`/`host` links, and a
 * slotted light-DOM child is not (its flat-tree parent is the `<slot>`). Lit renders at a microtask,
 * after the children connected, so without this the compact size would never reach them.
 *
 * The children of an element connect after it does (parsing and fragment insertion are in tree order),
 * so a shadow root rendered inside the host's `connectedCallback` has its provider in place before their
 * requests. A core fix (retry along the flat tree) would make this unnecessary: see the request in
 * `parity.json`.
 */
import type {ReactiveElement} from 'lit';

export function renderOnConnect(host: ReactiveElement): void {
  if (host.hasUpdated || !host.isConnected) return;
  // `performUpdate` is protected: it runs the update now and the pending microtask finds nothing to do.
  (host as unknown as {performUpdate(): unknown}).performUpdate();
}
