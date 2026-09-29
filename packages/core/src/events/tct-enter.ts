import {TctEvent} from './tct-event.js';

/**
 * Fired when the user presses an unmodified Enter in a single-line text control (upstream `onEnter`).
 * The Enter that commits an IME conversion (Japanese, Chinese, Korean) never fires it. Its default
 * action is the form's implicit submission; `preventDefault()` keeps the form from submitting.
 *
 * @eventName tct-enter
 * @bubbles
 * @composed
 * @cancelable
 */
export class TctEnterEvent extends TctEvent {
  static readonly eventName = 'tct-enter';

  constructor() {
    super(TctEnterEvent.eventName, {cancelable: true});
  }
}

declare global {
  interface GlobalEventHandlersEventMap {
    'tct-enter': TctEnterEvent;
  }
}
