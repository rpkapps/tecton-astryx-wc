import {html, nothing, type CSSResultGroup, type PropertyValues, type TemplateResult} from 'lit';
import {property} from 'lit/decorators.js';
import english from '@tecton-wc/locales/en/chatLayout.js';
import {ContextProvider} from '@tecton-wc/core/context/protocol.js';
import {SlotController} from '@tecton-wc/core/controllers/slot.js';
import {LocaleController} from '@tecton-wc/core/i18n/locale-controller.js';
import {TctElement} from '@tecton-wc/core/tct-element.js';
import base from '../styles/base.styles.css';
import {ChatNewMessagesController} from '../chat-message-list/chat-new-messages.js';
import {ChatStreamScrollController} from '../chat-message-list/chat-stream-scroll.js';
import {
  chatLayoutContext,
  type ChatLayoutContextValue,
} from '../chat-message-list/chat-layout.context.js';
import type {ChatScrollToBottomOptions} from '../chat-message-list/chat-message-list.types.js';
import {TctChatLayoutScrollButton} from '../chat-message-list/tct-chat-layout-scroll-button.js';
import {warnInvalidValue} from '../text/text.types.js';
import {CHAT_LAYOUT_DENSITIES, type ChatLayoutDensity} from './chat-layout.types.js';
import styles from './tct-chat-layout.styles.css';
import {isViewportScroller, viewportScroller} from './viewport-scroller.js';

/**
 * The shell of a full-page chat: the transcript in the message area, the composer docked at the bottom
 * behind a frosted-glass layer, a scroll-to-bottom button between them, and the scrolling that keeps a
 * growing conversation at the bottom wired in.
 *
 * **Layout.** The layout is a flex column that fills its container (give it a height: a flex parent, or a
 * `block-size`). The message area grows into the space the dock does not need and never shrinks below its
 * content, so a short conversation fills the layout exactly and a long one overflows it and scrolls. The
 * dock is `position: sticky` at the bottom of the scrolling layout, or `position: fixed` when the page (or
 * another element) scrolls (`scroll-target`).
 *
 * **Scrolling.** The layout scrolls itself by default. The message list inside it (`tct-chat-message-list`)
 * finds the layout through `chatLayoutContext` and registers its content, so the layout follows the newest
 * message while the reader is at the bottom (a spring; a jump under reduced motion), lets go the moment they
 * scroll up, and shows the scroll button when they are away from the bottom or a message arrived below the
 * fold ("New messages"). Activating it scrolls to the bottom and hands focus to the newest message. Use
 * `scroll-target="document"` (or set `scrollTarget` to an element) when the page scrolls instead.
 *
 * **Slots.** The default slot is the transcript (a `tct-chat-message-list`); `composer` holds the
 * `tct-chat-composer`; `empty-state` shows, centred, while the default slot has no content;
 * `scroll-button` replaces the wired button (or set `no-scroll-button` to have none).
 *
 * The layout assigns no landmark role or name to your regions, and it moves no focus while a reply streams.
 *
 * @summary Full-page chat shell: transcript, docked composer, scroll button and stick-to-bottom scrolling.
 * @tag tct-chat-layout
 * @upstream ChatLayout
 * @slot - The transcript, typically a `tct-chat-message-list`.
 * @slot composer - The composer, docked to the bottom.
 * @slot empty-state - Shown, centred, while the default slot is empty.
 * @slot scroll-button - Replaces the default scroll-to-bottom button.
 * @csspart base - The root: the scroll container when the layout scrolls itself (theme target `chat-layout`).
 * @csspart messages - The message area.
 * @csspart empty - The centring box of the empty state.
 * @csspart dock - The docked box that holds the composer.
 * @csspart dock-inner - The width-capped column inside the dock.
 * @csspart blur - The frosted-glass layer behind the dock.
 * @csspart scroll-button - The default scroll button (a `tct-chat-layout-scroll-button`).
 * @cloakDisplay flex
 */
export class TctChatLayout extends TctElement {
  static override readonly tagName = 'tct-chat-layout';
  static override readonly dependencies = [TctChatLayoutScrollButton];
  static override styles: CSSResultGroup = [base, styles];

  /**
   * Spacing of the dock, width of the message column and size of the blur layer: `compact`, `balanced`
   * (default) or `spacious` (a centred column of at most 800px).
   */
  @property({reflect: true}) density: ChatLayoutDensity = 'balanced';

  /**
   * An element that scrolls the conversation instead of the layout (upstream `scrollRef`): auto-scroll and
   * the scroll button then follow it, the layout itself does not scroll, and the dock is fixed to the
   * viewport. Property form of `scroll-target`; wins over it.
   */
  @property({attribute: false}) scrollTarget: HTMLElement | null = null;

  /**
   * Which element scrolls the conversation, as text: `document` for the page, or a CSS selector of an
   * element. Unset (and no `scrollTarget`): the layout scrolls itself.
   */
  @property({attribute: 'scroll-target'}) scrollTargetSelector: string | undefined;

  /** Renders no scroll-to-bottom button (upstream `scrollButton={null}`). Slot your own for a different one. */
  @property({type: Boolean, attribute: 'no-scroll-button'}) noScrollButton = false;

  readonly #locale: LocaleController = new LocaleController(this, {
    namespace: 'chatLayout',
    defaults: english,
  });
  readonly #slots: SlotController = new SlotController(
    this,
    'default',
    'empty-state',
    'scroll-button',
  );
  readonly #follow: ChatStreamScrollController = new ChatStreamScrollController(this, {
    scroller: () => this.#scroller,
  });
  readonly #news: ChatNewMessagesController = new ChatNewMessagesController(this, {
    isLocked: () => this.#follow.isLocked,
    onResize: () => {
      this.#follow.scrollIfLocked();
    },
  });
  readonly #context: ChatLayoutContextValue = {
    scrollContainer: () => this.#scroller,
    contentRef: this.#news.contentRef,
  };
  readonly #provider: ContextProvider<typeof chatLayoutContext> = new ContextProvider<
    typeof chatLayoutContext
  >(this, {context: chatLayoutContext, initialValue: this.#context});

  /** Whether the reader has scrolled away from the bottom (the scroll button shows). */
  get isScrolledUp(): boolean {
    return this.#follow.isScrolledUp;
  }

  /** Whether the view follows new content (the reader is at the bottom). */
  get isFollowing(): boolean {
    return this.#follow.isLocked;
  }

  /** Whether a message arrived while the reader was away from the bottom ("New messages"). */
  get hasNewMessages(): boolean {
    return this.#news.hasNewMessages;
  }

  /**
   * Scrolls to the bottom and follows new content again, dismissing the "New messages" hint. The default
   * animates with a spring (a jump under reduced motion); `instant` jumps at once (opening a conversation).
   */
  scrollToBottom(options?: ChatScrollToBottomOptions): void {
    this.#news.dismiss();
    this.#follow.scrollToBottom(options);
  }

  /** The element that scrolls the conversation: the external target, else the layout's own root. */
  get #scroller(): HTMLElement | null {
    const external = this.#external;
    if (external) return isViewportScroller(external) ? viewportScroller(external) : external;
    return this.renderRoot.querySelector<HTMLElement>('.root');
  }

  get #external(): HTMLElement | null {
    if (this.scrollTarget) return this.scrollTarget;
    const selector = this.scrollTargetSelector?.trim();
    if (!selector) return null;
    if (selector === 'document')
      return (this.ownerDocument.scrollingElement as HTMLElement | null) ?? null;
    try {
      return this.ownerDocument.querySelector<HTMLElement>(selector);
    } catch {
      return null;
    }
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('density')) {
      warnInvalidValue('tct-chat-layout', 'density', this.density, CHAT_LAYOUT_DENSITIES);
    }
  }

  protected override updated(changed: PropertyValues<this>): void {
    // The controller re-reads its scroller after every update; a changed target needs one more.
    if (changed.has('scrollTarget') || changed.has('scrollTargetSelector'))
      this.#provider.setValue({...this.#context}, true);
  }

  override render(): TemplateResult {
    const density = (CHAT_LAYOUT_DENSITIES as readonly string[]).includes(this.density)
      ? this.density
      : 'balanced';
    const selfScroll = this.#external === null;
    const showEmpty = !this.#slots.has('default') && this.#slots.has('empty-state');
    return html`<div
      class="root"
      part="base"
      data-density=${density}
      ?data-self-scroll=${selfScroll}
    >
      <div class="messages" part="messages">
        ${
          showEmpty
            ? html`<div class="empty" part="empty"><slot name="empty-state"></slot></div>`
            : html`<slot></slot>`
        }
      </div>
      <div class="dock-container" data-mode=${selfScroll ? 'sticky' : 'fixed'}>
        ${
          this.noScrollButton
            ? nothing
            : html`<slot name="scroll-button"
                >${
                  this.#slots.has('scroll-button')
                    ? nothing
                    : html`<tct-chat-layout-scroll-button
                        part="scroll-button"
                        ?visible=${this.#follow.isScrolledUp || this.#news.hasNewMessages}
                        label=${this.#news.hasNewMessages ? this.#locale.t('newMessages') : nothing}
                        @click=${this.#onScrollButton}
                      ></tct-chat-layout-scroll-button>`
                }</slot
              >`
        }
        <div class="blur" part="blur"></div>
        <div class="dock" part="dock">
          <div class="dock-inner" part="dock-inner"><slot name="composer"></slot></div>
        </div>
      </div>
    </div>`;
  }

  readonly #onScrollButton = (): void => {
    this.#news.dismiss();
    this.#follow.scrollToBottom();
  };
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-chat-layout': TctChatLayout;
  }
}
