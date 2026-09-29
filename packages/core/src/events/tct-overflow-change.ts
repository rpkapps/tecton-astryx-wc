import {TctEvent} from './tct-event.js';

/** One collapsed item of an overflowing list: the element and its original index. */
export interface OverflowItem<T extends Element = HTMLElement> {
  /** The light-DOM child that is currently collapsed. */
  readonly element: T;
  /** Its index among all the list's items, in DOM order. */
  readonly index: number;
}

/**
 * Notification that the set of collapsed items of an overflowing list changed (upstream
 * `onOverflowChange`). It fires once measurement has collapsed something, and again with an empty
 * `items` array once everything fits; it is silent while nothing overflows, including on the first
 * measurement, and it fires when membership or order changes even if the count stays the same.
 * Not cancelable.
 *
 * @eventName tct-overflow-change
 * @bubbles
 * @composed
 */
export class TctOverflowChangeEvent extends TctEvent {
  static readonly eventName = 'tct-overflow-change';
  /** The items that are collapsed now, in DOM order. */
  readonly items: readonly OverflowItem[];

  constructor(items: readonly OverflowItem[]) {
    super(TctOverflowChangeEvent.eventName);
    this.items = items;
  }
}

declare global {
  interface GlobalEventHandlersEventMap {
    'tct-overflow-change': TctOverflowChangeEvent;
  }
}
