/**
 * Base class and shared vocabulary of every public library event (A§7.6, A§9.3).
 *
 * One `Event` subclass per event name lives in `core/src/events/<event-name>.ts`, with payload as
 * typed readonly fields (not `detail`). `new CustomEvent` and ad-hoc `new Event('tct-...')` outside
 * this folder are lint errors.
 */

/** Why an intent event was raised. */
export type ChangeReason =
  | 'trigger'
  | 'escape'
  | 'outside'
  | 'focus-out'
  | 'close-watcher'
  | 'close-button'
  | 'selection'
  | 'hover'
  | 'timeout'
  | 'keyboard'
  | 'pointer'
  | 'request';

/** Base for every public library event: bubbles + composed by default (A§7.6 flags). */
export abstract class TctEvent extends Event {
  constructor(type: string, init: {cancelable?: boolean} = {}) {
    super(type, {bubbles: true, composed: true, cancelable: init.cancelable ?? false});
  }
}
