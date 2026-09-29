import {TctEvent, type ChangeReason} from './tct-event.js';

/** What changed a selection: an item was picked, added, created from free text, removed, or all were cleared. */
export type SelectionChangeAction = 'select' | 'add' | 'create' | 'remove' | 'clear';

/**
 * Fired before a searchable selection changes because of the user (typeahead, tokenizer): picking a
 * result, creating a token from text, removing a token, or clearing. `items` is the selection the
 * change would produce; `preventDefault()` keeps the current selection. The native `input` and `change`
 * events follow a change that was not prevented.
 *
 * @eventName tct-selection-change
 * @bubbles
 * @composed
 * @cancelable
 */
export class TctSelectionChangeEvent<T = unknown> extends TctEvent {
  static readonly eventName = 'tct-selection-change';
  /** What the user did. */
  readonly action: SelectionChangeAction;
  /** The item picked, added, created or removed; the last removed item for `clear`; `null` when a single selection is cleared. */
  readonly item: T | null;
  /** The selection after the change (a single selection has zero or one entry). */
  readonly items: readonly T[];
  /** What asked for the change. */
  readonly reason: ChangeReason;

  constructor(
    action: SelectionChangeAction,
    item: T | null,
    items: readonly T[],
    reason: ChangeReason,
  ) {
    super(TctSelectionChangeEvent.eventName, {cancelable: true});
    this.action = action;
    this.item = item;
    this.items = items;
    this.reason = reason;
  }
}

declare global {
  interface GlobalEventHandlersEventMap {
    'tct-selection-change': TctSelectionChangeEvent;
  }
}
