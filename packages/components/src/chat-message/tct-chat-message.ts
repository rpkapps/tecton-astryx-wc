import {html, nothing, type CSSResultGroup, type PropertyValues, type TemplateResult} from 'lit';
import {property} from 'lit/decorators.js';
import english from '@tecton-astryx/locales/en/chatMessage.js';
import {ContextConsumer, ContextProvider} from '@tecton-astryx/core/context/protocol.js';
import {LocaleController} from '@tecton-astryx/core/i18n/locale-controller.js';
import {SlotController} from '@tecton-astryx/core/controllers/slot.js';
import {TctElement} from '@tecton-astryx/core/tct-element.js';
import base from '../styles/base.styles.css';
import {warnInvalidValue} from '../text/text.types.js';
import {
  chatListContext,
  chatMessageContext,
  type ChatMessageContextValue,
} from './chat-message.context.js';
import {
  CHAT_DENSITIES,
  CHAT_SENDERS,
  type ChatDensity,
  type ChatSender,
} from './chat-message.types.js';
import styles from './tct-chat-message.styles.css';

/**
 * One message in a conversation: the sender context wrapper that owns the avatar, the sender name,
 * the metadata row and the alignment of what is inside (bubbles, tool calls, images, any content).
 *
 * The host is an `article`. Its accessible name is the sender name (the `name` attribute or the `name`
 * slot) when there is one, otherwise "Message from {sender}". Content in the default slot is flush
 * with the message edge unless it is wrapped in a `tct-chat-message-bubble`; wrap custom content in a
 * ghost bubble to line it up with the text column of the bubbles around it. A `user` message is
 * end-aligned and its avatar comes last; a `system` message is centred and never shows an avatar,
 * a name or metadata (use `tct-chat-system-message` for notices).
 *
 * `density` is inherited from the enclosing `tct-chat-message-list`; set it here to override.
 *
 * @summary The sender context of one chat message: avatar, name, body and metadata.
 * @tag tct-chat-message
 * @upstream ChatMessage
 * @slot - The message body: bubbles, tool calls, images or any content.
 * @slot avatar - Avatar shown beside the message (a `tct-avatar`).
 * @slot name - Sender name above the body; the `name` attribute is the plain-text form. Use it when the first child is not a bubble (a bubble has its own `name`).
 * @slot metadata - Metadata below the body, typically a `tct-chat-message-metadata`. Use it when the last child is not a bubble.
 * @csspart base - The row that holds the avatar and the column (theme target `chat-message`).
 * @csspart avatar - The avatar box.
 * @csspart column - The column that holds the name, the body and the metadata.
 * @csspart name - The sender name.
 * @csspart body - The box that holds the body content and spaces it by density.
 * @csspart metadata - The metadata box.
 * @cloakDisplay block
 */
export class TctChatMessage extends TctElement {
  static override readonly tagName = 'tct-chat-message';
  static override styles: CSSResultGroup = [base, styles];

  /** Who sent the message: `user` (end-aligned), `assistant` (start-aligned, default) or `system` (centred). */
  @property({reflect: true}) sender: ChatSender = 'assistant';

  /**
   * Row spacing: `compact`, `balanced` or `spacious`. Unset, the message follows the enclosing
   * `tct-chat-message-list` (and `balanced` outside a list).
   */
  @property({reflect: true}) density: ChatDensity | undefined;

  /**
   * Plain-text sender name above the body; it also names the article. The `name` slot takes markup
   * and wins when both are given.
   */
  @property() name = '';

  readonly #locale = new LocaleController(this, {namespace: 'chatMessage', defaults: english});
  readonly #slots = new SlotController(this, 'avatar', 'name', 'metadata');
  readonly #list = new ContextConsumer(this, {context: chatListContext, subscribe: true});
  #context: ChatMessageContextValue = {
    sender: 'assistant',
    density: 'balanced',
    reportName: (source, hasName) => {
      this.#reportName(source, hasName);
    },
  };
  readonly #provider = new ContextProvider(this, {
    context: chatMessageContext,
    initialValue: this.#context,
  });
  readonly #namedBubbles = new Set<Element>();
  #nameObserver: MutationObserver | undefined;

  /**
   * What the message is called for assistive technology: the sender name, else "Message from
   * {sender}". The message list reads it to introduce an announced message.
   */
  get accessibleName(): string {
    const name = this.#nameText();
    return name !== '' ? name : this.#locale.t('messageFrom', {sender: this.#sender});
  }

  override connectedCallback(): void {
    super.connectedCallback();
    // A reconnected message watches its name again (disconnecting stopped the observer).
    if (this.hasUpdated) this.#observeName();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#nameObserver?.disconnect();
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('sender')) {
      warnInvalidValue('tct-chat-message', 'sender', this.sender, CHAT_SENDERS);
    }
    if (changed.has('density')) {
      warnInvalidValue('tct-chat-message', 'density', this.density, CHAT_DENSITIES);
    }
    this.internals.role = 'article';
    this.internals.ariaLabel = this.accessibleName;
    const sender = this.#sender;
    const density = this.#density;
    if (this.#context.sender !== sender || this.#context.density !== density) {
      this.#context = {...this.#context, sender, density};
      this.#provider.setValue(this.#context);
    }
  }

  protected override updated(): void {
    this.#observeName();
  }

  override render(): TemplateResult {
    const system = this.#sender === 'system';
    const hasAvatar = !system && this.#slots.has('avatar');
    const hasName = !system && (this.name !== '' || this.#slots.has('name'));
    const hasMetadata = !system && this.#slots.has('metadata');
    // The avatar sits level with the first bubble's text, so it drops by one name row when a name
    // is shown above the body (the message's own or a bubble's).
    const offset = !system && (hasName || this.#namedBubbles.size > 0);
    return html`<div
      class="base"
      part="base"
      data-sender=${this.#sender}
      data-density=${this.#density}
    >
      ${
        hasAvatar
          ? html`<div class="avatar" part="avatar" ?data-offset=${offset}>
              <slot name="avatar"></slot>
            </div>`
          : nothing
      }
      <div class="column" part="column">
        ${
          hasName
            ? html`<div class="name" part="name" data-chat-name>
                <slot name="name">${this.name}</slot>
              </div>`
            : nothing
        }
        <div class="body" part="body"><slot></slot></div>
        ${
          hasMetadata
            ? html`<div class="metadata" part="metadata"><slot name="metadata"></slot></div>`
            : nothing
        }
      </div>
    </div>`;
  }

  /** Unknown values fall back to the default, as the CSS does. */
  get #sender(): ChatSender {
    return (CHAT_SENDERS as readonly string[]).includes(this.sender) ? this.sender : 'assistant';
  }

  get #density(): ChatDensity {
    const wanted = this.density ?? this.#list.value?.density;
    return wanted !== undefined && (CHAT_DENSITIES as readonly string[]).includes(wanted)
      ? wanted
      : 'balanced';
  }

  /**
   * The name slot can change text in place; the article's name follows it. Only the name's own
   * subtree is watched, so a streaming body never re-renders the message.
   */
  #observeName(): void {
    this.#nameObserver ??= new MutationObserver(() => {
      this.requestUpdate();
    });
    this.#nameObserver.disconnect();
    for (const child of this.children) {
      if (child.getAttribute('slot') === 'name') {
        this.#nameObserver.observe(child, {childList: true, characterData: true, subtree: true});
      }
    }
  }

  /** Text of the name: the slotted name wins over the attribute, as it does visually. */
  #nameText(): string {
    // A system message has no name row (upstream), so it is never named by one.
    if (this.#sender === 'system') return '';
    const slotted = [...this.children]
      .filter((child) => child.getAttribute('slot') === 'name')
      .map((child) => child.textContent)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    return slotted !== '' ? slotted : this.name.trim();
  }

  #reportName(source: Element, hasName: boolean): void {
    const had = this.#namedBubbles.has(source);
    if (hasName === had) return;
    if (hasName) this.#namedBubbles.add(source);
    else this.#namedBubbles.delete(source);
    this.requestUpdate();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-chat-message': TctChatMessage;
  }
}
