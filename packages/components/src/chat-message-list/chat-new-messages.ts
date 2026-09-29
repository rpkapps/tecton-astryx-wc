/**
 * `ChatNewMessagesController`: notices a new message arriving while the reader is scrolled away from the
 * bottom (upstream `useChatNewMessages`), so the scroll button can offer "New messages".
 *
 * It observes the conversation content with the shared resize observer and remembers the last message
 * element. When a different last message shows up while the view is not following, `hasNewMessages`
 * turns true until `dismiss()`. Every content resize also calls `onResize`, which is how the scroll
 * controller follows a message that grows while it streams (`scrollIfLocked`).
 *
 * `contentRef` accepts the content element whenever it appears (even late) or `null` when it goes, so
 * a provider such as `tct-chat-layout` can hand it over from the message list through context.
 *
 * ```ts
 * #newMessages = new ChatNewMessagesController(this, {
 *   isLocked: () => this.#scroll.isLocked,
 *   onResize: () => this.#scroll.scrollIfLocked(),
 * });
 * // the message list registers its content:  this.#newMessages.contentRef(innerElement)
 * ```
 *
 * Guides: [mwg:defer-work-until-scroll-ends] (work happens off the scroll path, in the observer).
 */
import type {ReactiveController, ReactiveControllerHost} from 'lit';
import {observeResize} from '@tecton-astryx/core/controllers/resize.js';
import {findLastMessage} from './chat-messages.js';

export interface ChatNewMessagesOptions {
  /** Whether the view is following new content; new messages do not flag while it is. */
  isLocked: () => boolean;
  /** Called on every content size change (a new message or streaming growth). */
  onResize?: () => void;
  /** CSS selector of a message. Default `tct-chat-message`. */
  messageSelector?: string;
}

export class ChatNewMessagesController implements ReactiveController {
  readonly #host: ReactiveControllerHost;
  readonly #options: ChatNewMessagesOptions;
  #element: HTMLElement | null = null;
  #stop: (() => void) | undefined;
  #last: Element | null = null;
  #hasNew = false;

  constructor(host: ReactiveControllerHost, options: ChatNewMessagesOptions) {
    this.#host = host;
    this.#options = options;
    host.addController(this);
  }

  /** Whether a message arrived while the view was not following. */
  get hasNewMessages(): boolean {
    return this.#hasNew;
  }

  /** Clears `hasNewMessages`. */
  dismiss(): void {
    if (!this.#hasNew) return;
    this.#hasNew = false;
    this.#host.requestUpdate();
  }

  /**
   * The content element to observe, or `null` to stop. A stable arrow function, so it can be passed
   * around (into a context value) as is.
   */
  readonly contentRef = (element: HTMLElement | null): void => {
    if (element === this.#element) return;
    this.#detach();
    this.#element = element;
    if (element?.isConnected) this.#attach(element);
  };

  hostConnected(): void {
    // A moved or re-attached host resumes observing what it was given.
    if (this.#element && !this.#stop) this.#attach(this.#element);
  }

  hostDisconnected(): void {
    this.#detach(false);
  }

  #attach(element: HTMLElement): void {
    this.#stop = observeResize(element, () => {
      this.#options.onResize?.();
      const last = findLastMessage(element, this.#options.messageSelector ?? 'tct-chat-message');
      if (last && last !== this.#last) {
        this.#last = last;
        if (!this.#options.isLocked() && !this.#hasNew) {
          this.#hasNew = true;
          this.#host.requestUpdate();
        }
      }
    });
  }

  #detach(forget = true): void {
    this.#stop?.();
    this.#stop = undefined;
    if (forget) this.#element = null;
  }
}
