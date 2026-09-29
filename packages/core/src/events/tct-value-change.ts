import {TctEvent, type ChangeReason} from './tct-event.js';

/**
 * Fired before a non-form selection changes (tabs, segmented navigation, accordions); never use
 * `change` for these. `preventDefault()` keeps the current value.
 *
 * @eventName tct-value-change
 * @bubbles
 * @composed
 * @cancelable
 */
export class TctValueChangeEvent<T = string> extends TctEvent {
  static readonly eventName = 'tct-value-change';
  /** The requested value. */
  readonly value: T;
  /** The current value. */
  readonly oldValue: T | undefined;
  /** What asked for the change. */
  readonly reason: ChangeReason;

  constructor(value: T, oldValue: T | undefined, reason: ChangeReason) {
    super(TctValueChangeEvent.eventName, {cancelable: true});
    this.value = value;
    this.oldValue = oldValue;
    this.reason = reason;
  }
}

declare global {
  interface GlobalEventHandlersEventMap {
    'tct-value-change': TctValueChangeEvent;
  }
}
