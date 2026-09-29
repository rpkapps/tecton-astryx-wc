import {TctEvent} from './tct-event.js';

/**
 * Fired before a paginator's page size changes because the user chose another size; `preventDefault()`
 * keeps the current size. When it is not prevented the page size changes and the paginator then asks to
 * return to page 1 with a `tct-page-change`.
 *
 * @eventName tct-page-size-change
 * @bubbles
 * @composed
 * @cancelable
 */
export class TctPageSizeChangeEvent extends TctEvent {
  static readonly eventName = 'tct-page-size-change';
  /** The requested number of items per page. */
  readonly pageSize: number;
  /** The current number of items per page. */
  readonly oldPageSize: number;

  constructor(pageSize: number, oldPageSize: number) {
    super(TctPageSizeChangeEvent.eventName, {cancelable: true});
    this.pageSize = pageSize;
    this.oldPageSize = oldPageSize;
  }
}

declare global {
  interface GlobalEventHandlersEventMap {
    'tct-page-size-change': TctPageSizeChangeEvent;
  }
}
