import {TctEvent, type ChangeReason} from './tct-event.js';

/**
 * Fired before a branch of a tree expands or collapses because of the user (chevron, click on a
 * parent row, ArrowLeft/ArrowRight, Enter/Space). `preventDefault()` keeps the branch as it is. A host
 * that loads children lazily listens for it, and assigns the item's `children` when `expanded` is
 * `true`.
 *
 * @eventName tct-tree-toggle
 * @bubbles
 * @composed
 * @cancelable
 */
export class TctTreeToggleEvent extends TctEvent {
  static readonly eventName = 'tct-tree-toggle';
  /** The item's `id`. */
  readonly id: string;
  /** The state the branch is about to take. */
  readonly expanded: boolean;
  /** What asked for the change. */
  readonly reason: ChangeReason;

  constructor(id: string, expanded: boolean, reason: ChangeReason) {
    super(TctTreeToggleEvent.eventName, {cancelable: true});
    this.id = id;
    this.expanded = expanded;
    this.reason = reason;
  }
}

declare global {
  interface GlobalEventHandlersEventMap {
    'tct-tree-toggle': TctTreeToggleEvent;
  }
}
