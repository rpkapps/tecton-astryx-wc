import {html, nothing, type CSSResultGroup, type PropertyValues, type TemplateResult} from 'lit';
import {property} from 'lit/decorators.js';
import english from '@tecton-wc/locales/en/chat.js';
import {ContextConsumer} from '@tecton-wc/core/context/protocol.js';
import {SlotController} from '@tecton-wc/core/controllers/slot.js';
import {LocaleController} from '@tecton-wc/core/i18n/locale-controller.js';
import {TctElement} from '@tecton-wc/core/tct-element.js';
import base from '../styles/base.styles.css';
import motion from '../styles/motion.styles.css';
import {TctIcon} from '../icon/tct-icon.js';
import {warnInvalidValue} from '../text/text.types.js';
import {chatMessageContext} from './chat-message.context.js';
import {CHAT_MESSAGE_STATUSES, type ChatMessageStatus} from './chat-message.types.js';
import styles from './tct-chat-message-metadata.styles.css';

/** Icon (registered name) and message key of each delivery status (upstream `STATUS_CONFIG`). */
const STATUS: Record<ChatMessageStatus, {icon: string; key: string}> = {
  sending: {icon: 'clock', key: 'status.sending'},
  sent: {icon: 'check', key: 'status.sent'},
  delivered: {icon: 'checkDouble', key: 'status.delivered'},
  read: {icon: 'checkDouble', key: 'status.read'},
  error: {icon: 'error', key: 'status.failed'},
};

/**
 * The metadata row of a message: a timestamp, free footer content (model name, reactions, a copy
 * button) and the delivery status, separated by dots. The row reverses for a `user` message, so the
 * status sits nearest the bubble's outer edge. It renders nothing when all three are absent.
 *
 * The status is an image with the accessible name "Message {status}" ("Message sent") and a native
 * `title` with the status word. The dots between the items are decorative and hidden from assistive
 * technology. The row never owns the controls a footer holds: give them their own names.
 *
 * Place it in a bubble's `metadata` slot, or in the message's `metadata` slot when the last child is
 * not a bubble. Use one or the other, not both.
 *
 * @summary Timestamp, footer and delivery status under a chat message.
 * @tag tct-chat-message-metadata
 * @upstream ChatMessageMetadata
 * @slot timestamp - Time content (a `tct-timer`, a formatted time); the `timestamp` attribute is the plain-text form.
 * @slot footer - Footer content: model information, reactions, a copy button; the `footer` attribute is the plain-text form.
 * @csspart base - The metadata row (theme target `chat-message-metadata`).
 * @csspart timestamp - The timestamp.
 * @csspart footer - The footer.
 * @csspart status - The delivery status (icon and word).
 * @cloakDisplay contents
 */
export class TctChatMessageMetadata extends TctElement {
  static override readonly tagName = 'tct-chat-message-metadata';
  static override readonly dependencies = [TctIcon];
  static override styles: CSSResultGroup = [base, motion, styles];

  /** Plain-text timestamp. The `timestamp` slot takes markup. */
  @property() timestamp = '';

  /** Plain-text footer. The `footer` slot takes markup. */
  @property() footer = '';

  /** Delivery status: `sending`, `sent`, `delivered`, `read` or `error` (shown as "Failed"). */
  @property({reflect: true}) status: ChatMessageStatus | undefined;

  readonly #locale: LocaleController = new LocaleController(this, {
    namespace: 'chat',
    defaults: english,
  });
  readonly #slots: SlotController = new SlotController(this, 'timestamp', 'footer');
  readonly #message: ContextConsumer<typeof chatMessageContext> = new ContextConsumer<
    typeof chatMessageContext
  >(this, {context: chatMessageContext, subscribe: true});

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('status')) {
      warnInvalidValue('tct-chat-message-metadata', 'status', this.status, CHAT_MESSAGE_STATUSES);
    }
  }

  override render(): TemplateResult | typeof nothing {
    const status = this.status !== undefined ? STATUS[this.status] : undefined;
    const hasTimestamp = this.timestamp !== '' || this.#slots.has('timestamp');
    const hasFooter = this.footer !== '' || this.#slots.has('footer');
    if (!hasTimestamp && !hasFooter && status === undefined) return nothing;
    const word = status ? this.#locale.t(status.key) : '';
    return html`<div
      class="base"
      part="base"
      data-sender=${this.#message.value?.sender ?? 'assistant'}
    >
      ${
        hasTimestamp
          ? html`<span part="timestamp"><slot name="timestamp">${this.timestamp}</slot></span>`
          : nothing
      }
      ${hasTimestamp && (hasFooter || status) ? html`<span aria-hidden="true">·</span>` : nothing}
      ${
        hasFooter
          ? html`<span part="footer"><slot name="footer">${this.footer}</slot></span>`
          : nothing
      }
      ${hasFooter && status ? html`<span aria-hidden="true">·</span>` : nothing}
      ${
        status
          ? html`<span
              class="status"
              part="status"
              role="img"
              title=${word}
              aria-label=${this.#locale.t('messageAriaLabel', {status: word.toLowerCase()})}
              data-status=${this.status ?? nothing}
              ><tct-icon name=${status.icon} size="xsm" color="inherit"></tct-icon
              ><span>${word}</span></span
            >`
          : nothing
      }
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-chat-message-metadata': TctChatMessageMetadata;
  }
}
