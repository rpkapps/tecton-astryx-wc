/**
 * Declarative invokers for overlay hosts [mwg:declarative-dialog-popover-control] [mwg:custom-button-actions]:
 * `<button commandfor="dlg" command="--show">` sends a `command` event to the element `dlg`. Engines with
 * invoker commands (`features.invokerCommands`) dispatch it natively; without them this small enhancement
 * dispatches the same event for custom (`--`) commands, so markup written for the platform keeps working.
 * Nothing here manages ARIA: the overlay owns `aria-expanded` on its source itself.
 */
import {features} from '@tecton-wc/core/features.js';

/** The event an invoker sends: the platform's `CommandEvent`, or this stand-in without it. */
export interface CommandLikeEvent extends Event {
  readonly command: string;
  readonly source: Element | null;
}

let installed = false;

function onClick(event: MouseEvent): void {
  // The platform dispatches its own event; only the missing engines need this.
  if (features.invokerCommands || event.defaultPrevented) return;
  const button = event
    .composedPath()
    .find(
      (node): node is HTMLButtonElement =>
        node instanceof HTMLButtonElement &&
        node.hasAttribute('commandfor') &&
        (node.getAttribute('command') ?? '').startsWith('--') &&
        !node.disabled,
    );
  if (!button) return;
  const root = button.getRootNode() as Document | ShadowRoot;
  const target = root.getElementById?.(button.getAttribute('commandfor') ?? '');
  if (!target) return;
  const command = new Event('command', {cancelable: true});
  Object.defineProperties(command, {
    command: {value: button.getAttribute('command')},
    source: {value: button},
  });
  target.dispatchEvent(command);
}

/** Installs the document listener once. Safe to call from every overlay's `connectedCallback`. */
export function installCommandFallback(): void {
  if (installed || typeof document === 'undefined') return;
  installed = true;
  document.addEventListener('click', onClick);
}
