import {html, nothing, type CSSResultGroup, type PropertyValues, type TemplateResult} from 'lit';
import {property} from 'lit/decorators.js';
import {SlotController} from '@tecton-astryx/core/controllers/slot.js';
import {TctElement} from '@tecton-astryx/core/tct-element.js';
import base from '../styles/base.styles.css';
import {chatPlainText} from '../chat-message/chat-message.text.js';
import {TctDivider} from '../divider/tct-divider.js';
import {warnInvalidValue} from '../text/text.types.js';
import {
  CHAT_SYSTEM_MESSAGE_VARIANTS,
  type ChatSystemMessageVariant,
} from './chat-system-message.types.js';
import styles from './tct-chat-system-message.styles.css';

/**
 * A centred notice in a conversation that no participant sent: "Conversation started", "Ana joined",
 * a date separator. It has no avatar, no bubble and no alignment; think of it as the chat's status
 * line. The `divider` variant sets the text between two rules, for date and section breaks.
 *
 * The host is a `status` (upstream parity), and the divider variant contains a separator named by the
 * text. Keep the text short and complete on its own: the optional icon is decoration and must not be
 * the only carrier of meaning. The icon shows in the default variant only, as upstream.
 *
 * @summary A centred, muted notice for date separators, joins and status changes.
 * @tag tct-chat-system-message
 * @upstream ChatSystemMessage
 * @slot - The message: factual text, or any inline content such as a date.
 * @slot icon - Optional icon before the message (default variant only).
 * @csspart base - The row that holds the icon and the text (theme target `chat-system-message`).
 * @csspart icon - The icon box.
 * @csspart content - The message text.
 * @csspart divider - The divider of the `divider` variant.
 * @cloakDisplay block
 */
export class TctChatSystemMessage extends TctElement {
  static override readonly tagName = 'tct-chat-system-message';
  static override readonly dependencies = [TctDivider];
  static override styles: CSSResultGroup = [base, styles];

  /** `default` (plain centred text) or `divider` (text between two rules). */
  @property({reflect: true}) variant: ChatSystemMessageVariant = 'default';

  readonly #slots = new SlotController(this, 'icon');
  #observer: MutationObserver | undefined;

  override connectedCallback(): void {
    super.connectedCallback();
    // The separator's name is the message text, which can change in place.
    this.#observer ??= new MutationObserver(() => {
      if (this.variant === 'divider') this.requestUpdate();
    });
    this.#observer.observe(this, {childList: true, characterData: true, subtree: true});
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#observer?.disconnect();
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('variant')) {
      warnInvalidValue(
        'tct-chat-system-message',
        'variant',
        this.variant,
        CHAT_SYSTEM_MESSAGE_VARIANTS,
      );
    }
    this.internals.role = 'status';
  }

  override render(): TemplateResult {
    if (this.variant === 'divider') {
      // Slot forwarding: the divider shows this element's own content, and is named by its text.
      return html`<tct-divider part="divider" aria-label=${this.#text() || nothing}
        ><slot slot="label"></slot
      ></tct-divider>`;
    }
    return html`<div class="base" part="base">
      <span class="content" part="content">
        ${
          this.#slots.has('icon')
            ? html`<span class="icon" part="icon"><slot name="icon"></slot></span>`
            : nothing
        }
        <span class="text"><slot></slot></span>
      </span>
    </div>`;
  }

  /** Text of the default slot (the separator's accessible name). */
  #text(): string {
    return [...this.childNodes]
      .filter((node) => !(node instanceof Element && node.hasAttribute('slot')))
      .map((node) => chatPlainText(node))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-chat-system-message': TctChatSystemMessage;
  }
}
