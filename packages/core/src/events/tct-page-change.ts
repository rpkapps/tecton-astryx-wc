import {TctEvent, type ChangeReason} from './tct-event.js';

/**
 * Fired before a paginator moves to another page because of the user (a page, previous, next, first or
 * last button, a dot, or a page number typed into the box); `preventDefault()` keeps the current page.
 * Property and attribute writes never emit it.
 *
 * @eventName tct-page-change
 * @bubbles
 * @composed
 * @cancelable
 */
export class TctPageChangeEvent extends TctEvent {
  static readonly eventName = 'tct-page-change';
  /** The requested page (1-based). */
  readonly page: number;
  /** The current page. */
  readonly oldPage: number;
  /** What asked for the change. */
  readonly reason: ChangeReason;

  constructor(page: number, oldPage: number, reason: ChangeReason) {
    super(TctPageChangeEvent.eventName, {cancelable: true});
    this.page = page;
    this.oldPage = oldPage;
    this.reason = reason;
  }
}

declare global {
  interface GlobalEventHandlersEventMap {
    'tct-page-change': TctPageChangeEvent;
  }
}
