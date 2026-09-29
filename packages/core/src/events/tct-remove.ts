import {TctEvent} from './tct-event.js';

/**
 * Fired when the user asks to remove an item (a token's remove button, a list row);
 * `preventDefault()` keeps the item.
 *
 * @eventName tct-remove
 * @bubbles
 * @composed
 * @cancelable
 */
export class TctRemoveEvent<T = unknown> extends TctEvent {
  static readonly eventName = 'tct-remove';
  /** The item the user asked to remove. */
  readonly value: T;

  constructor(value: T) {
    super(TctRemoveEvent.eventName, {cancelable: true});
    this.value = value;
  }
}

declare global {
  interface GlobalEventHandlersEventMap {
    'tct-remove': TctRemoveEvent;
  }
}
