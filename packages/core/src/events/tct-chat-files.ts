import {TctEvent} from './tct-event.js';

/**
 * Fired when files are pasted into, or dropped on, the composer input (upstream `onFiles`). The browser
 * never inserts or opens them; upload, validation and progress are yours. Not fired while the input is
 * disabled.
 *
 * @eventName tct-chat-files
 * @bubbles
 * @composed
 */
export class TctChatFilesEvent extends TctEvent {
  static readonly eventName = 'tct-chat-files';
  /** The files, in the order the clipboard or drag data listed them. */
  readonly files: readonly File[];
  /** Where they came from. */
  readonly source: 'paste' | 'drop';

  constructor(files: readonly File[], source: 'paste' | 'drop') {
    super(TctChatFilesEvent.eventName);
    this.files = files;
    this.source = source;
  }
}

declare global {
  interface GlobalEventHandlersEventMap {
    'tct-chat-files': TctChatFilesEvent;
  }
}
